import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  InboxIcon,
  EnvelopeIcon,
  StarIcon,
  UserGroupIcon,
  ArchiveBoxIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CheckIcon,
  TrashIcon,
  MapPinIcon,
  EllipsisHorizontalIcon,
  PaperAirplaneIcon,
  PhotoIcon,
  PaperClipIcon,
  FaceSmileIcon,
  PhoneIcon,
  VideoCameraIcon,
  XMarkIcon,
  ChevronLeftIcon,
  BellSlashIcon,
  ExclamationCircleIcon,
  CurrencyDollarIcon,
  ChatBubbleLeftRightIcon,
  MicrophoneIcon,
  FilmIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import {
  StarIcon as StarIconSolid,
  MapPinIcon as MapPinIconSolid
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import MassMessageModal from './MassMessageModal';
import FanProfileModal from './FanProfileModal';
import MessageTemplatesModal from './MessageTemplatesModal';
import MentionNotification from './MentionNotification';
import BroadcastMessageModal from './BroadcastMessageModal';
import RealTimeNotificationsHybrid from './RealTimeNotificationsHybrid';
import PPVPricingModal from './messages/PPVPricingModal';
import { getAuthToken } from '../utils/supabase-auth';
import { fetchWithRetry } from '../utils/fetchWithRetry';

const EnhancedMessagesPage = ({ 
  user, 
  isCreator = false,
  onStartVideoCall,
  onStartVoiceCall,
  websocket
}) => {
  // State for conversations
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  
  // Inbox management
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState(new Set());
  const [bulkActionMode, setBulkActionMode] = useState(false);
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  
  // Mobile responsive
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showConversationList, setShowConversationList] = useState(true);
  
  // Mass messaging
  const [showMassMessageModal, setShowMassMessageModal] = useState(false);
  const [massMessageFilterType, setMassMessageFilterType] = useState('all');
  
  // Fan profile modal
  const [showFanProfile, setShowFanProfile] = useState(false);
  const [selectedFanId, setSelectedFanId] = useState(null);
  const [selectedFanData, setSelectedFanData] = useState(null);
  
  // Message pricing for creators
  const [messageRates, setMessageRates] = useState({
    text: 1,
    image: 2,
    audio: 3,
    video: 5
  });
  const [showRates, setShowRates] = useState(false);

  // PPV (Pay-Per-View) messaging
  const [showPPVModal, setShowPPVModal] = useState(false);
  const [ppvFile, setPPVFile] = useState(null);
  const [ppvFileType, setPPVFileType] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const ppvFileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // WebSocket integration for real-time messaging
  useEffect(() => {
    if (!websocket || !selectedConversation) return;

    const handleWebSocketMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'new_message':
            if (data.conversationId === selectedConversation.id) {
              setMessages(prev => [...prev, data.message]);
              // Mark as read if viewing
              markMessageAsRead(data.message.id);
            }
            // Update conversation list
            updateConversationWithNewMessage(data.conversationId, data.message);
            break;
            
          case 'typing_start':
            if (data.conversationId === selectedConversation.id && data.userId !== user?.uid) {
              setTypingUsers(prev => new Set([...prev, data.userId]));
            }
            break;
            
          case 'typing_stop':
            if (data.conversationId === selectedConversation.id) {
              setTypingUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(data.userId);
                return newSet;
              });
            }
            break;
            
          case 'message_read':
            if (data.conversationId === selectedConversation.id) {
              setMessages(prev => prev.map(msg => 
                msg.id === data.messageId ? { ...msg, isRead: true } : msg
              ));
            }
            break;
        }
      } catch (error) {
        console.error('WebSocket message parsing error:', error);
      }
    };

    websocket.addEventListener('message', handleWebSocketMessage);
    
    return () => {
      websocket.removeEventListener('message', handleWebSocketMessage);
    };
  }, [websocket, selectedConversation, user]);

  // Listen for compose event from navigation
  useEffect(() => {
    const handleOpenCompose = () => {
      if (isCreator) {
        setMassMessageFilterType('all');
        setShowMassMessageModal(true);
      }
    };

    window.addEventListener('openCompose', handleOpenCompose);
    return () => {
      window.removeEventListener('openCompose', handleOpenCompose);
    };
  }, [isCreator]);

  // Inbox tabs configuration - different for creators and fans
  // Debug logging for isCreator prop
  console.log('💬 EnhancedMessagesPage - isCreator:', isCreator, 'user:', user?.email);

  const inboxTabs = isCreator ? [
    { id: 'all', label: 'All', icon: InboxIcon, count: 0 },
    { id: 'unread', label: 'Unread', icon: EnvelopeIcon, count: 0 },
    { id: 'vips', label: 'VIPs', icon: StarIcon, count: 0 },
    { id: 'requests', label: 'Requests', icon: UserGroupIcon, count: 0 },
    { id: 'archived', label: 'Archived', icon: ArchiveBoxIcon, count: 0 }
  ] : [
    // Fan tabs - no VIPs or Requests
    { id: 'all', label: 'All', icon: InboxIcon, count: 0 },
    { id: 'unread', label: 'Unread', icon: EnvelopeIcon, count: 0 },
    { id: 'archived', label: 'Archived', icon: ArchiveBoxIcon, count: 0 }
  ];

  // Mock conversations data
  const mockConversations = [
    {
      id: '1',
      participant: {
        id: 'user1',
        name: 'Alice Johnson',
        username: 'alice_j',
        avatar: null,
        isOnline: true,
        isVIP: true,
        tier: 'Diamond'
      },
      lastMessage: {
        content: 'Hey! When are you going live next?',
        timestamp: new Date(Date.now() - 300000), // 5 mins ago
        isRead: false,
        sender: 'user1'
      },
      unreadCount: 2,
      isPinned: true,
      isArchived: false,
      isRequest: false,
      totalSpent: 5420,
      sessionCount: 12
    },
    {
      id: '2',
      participant: {
        id: 'user2',
        name: 'Bob Smith',
        username: 'bob_smith',
        avatar: null,
        isOnline: false,
        isVIP: false,
        lastSeen: new Date(Date.now() - 3600000) // 1 hour ago
      },
      lastMessage: {
        content: 'Thanks for the amazing session!',
        timestamp: new Date(Date.now() - 7200000), // 2 hours ago
        isRead: true,
        sender: 'user2'
      },
      unreadCount: 0,
      isPinned: false,
      isArchived: false,
      isRequest: false,
      totalSpent: 1200,
      sessionCount: 3
    },
    {
      id: '3',
      participant: {
        id: 'user3',
        name: 'Carol Davis',
        username: 'carol_d',
        avatar: null,
        isOnline: true,
        isVIP: false
      },
      lastMessage: {
        content: 'Can we schedule a call tomorrow?',
        timestamp: new Date(Date.now() - 1800000), // 30 mins ago
        isRead: false,
        sender: 'user3'
      },
      unreadCount: 1,
      isPinned: false,
      isArchived: false,
      isRequest: true,
      totalSpent: 0,
      sessionCount: 0
    }
  ];

  // Fetch creator's message rates
  useEffect(() => {
    const fetchMessageRates = async () => {
      if (!isCreator || !user?.uid) return;
      
      try {
        const token = await getAuthToken();
        const response = await fetchWithRetry(
          `${import.meta.env.VITE_BACKEND_URL}/creators/rates`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.rates) {
            setMessageRates({
              text: data.rates.textMessage || 1,
              image: data.rates.imageMessage || 2,
              audio: data.rates.audioMessage || 3,
              video: data.rates.videoMessage || 5
            });
          }
        }
      } catch (error) {
        console.error('Error fetching message rates:', error);
      }
    };
    
    fetchMessageRates();
  }, [isCreator, user]);

  // Fetch conversations from API
  useEffect(() => {
    const fetchConversations = async () => {
      if (!user?.uid) {
        // No user - show empty conversations
        setConversations([]);
        updateTabCounts([]);
        return;
      }
      
      setLoading(true);
      setConversationsLoading(true);
      try {
        const token = await getAuthToken();
        const response = await fetchWithRetry(
          `${import.meta.env.VITE_BACKEND_URL}/conversations`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          const conversations = data.conversations || data || [];
          setConversations(conversations);
          updateTabCounts(conversations);
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to fetch conversations');
        }
      } catch (error) {
        console.error('Error fetching conversations:', error);
        // Don't show mock data - just set empty conversations
        setConversations([]);
        updateTabCounts([]);
      } finally {
        setLoading(false);
        setConversationsLoading(false);
      }
    };

    fetchConversations();
  }, [user]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setShowConversationList(true);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update tab counts based on conversations
  const updateTabCounts = (convs) => {
    const counts = {
      all: convs.filter(c => !c.isArchived).length,
      unread: convs.filter(c => !c.isArchived && c.unreadCount > 0).length,
      archived: convs.filter(c => c.isArchived).length
    };
    
    // Add creator-specific counts only if user is a creator
    if (isCreator) {
      counts.vips = convs.filter(c => !c.isArchived && c.participant.isVIP).length;
      counts.requests = convs.filter(c => !c.isArchived && c.isRequest).length;
    }
    
    // Update inboxTabs counts
    inboxTabs.forEach(tab => {
      tab.count = counts[tab.id] || 0;
    });
  };

  // Filter conversations based on active tab and search - Memoized for performance
  const getFilteredConversations = useMemo(() => {
    let filtered = [...conversations];
    
    // Apply tab filter
    switch (activeTab) {
      case 'unread':
        filtered = filtered.filter(c => !c.isArchived && c.unreadCount > 0);
        break;
      case 'vips':
        // Only filter by VIP if user is a creator
        if (isCreator) {
          filtered = filtered.filter(c => !c.isArchived && c.participant.isVIP);
        } else {
          filtered = filtered.filter(c => !c.isArchived);
        }
        break;
      case 'requests':
        // Only filter by requests if user is a creator
        if (isCreator) {
          filtered = filtered.filter(c => !c.isArchived && c.isRequest);
        } else {
          filtered = filtered.filter(c => !c.isArchived);
        }
        break;
      case 'archived':
        filtered = filtered.filter(c => c.isArchived);
        break;
      default: // 'all'
        filtered = filtered.filter(c => !c.isArchived);
    }
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(c => 
        c.participant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.participant.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.lastMessage.content.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Sort: pinned first, then by last message timestamp
    filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.lastMessage.timestamp - a.lastMessage.timestamp;
    });
    
    return filtered;
  }, [conversations, activeTab, searchQuery, isCreator]);

  // Handle conversation selection
  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    
    // Mark as read
    if (conversation.unreadCount > 0) {
      setConversations(prev => prev.map(c => 
        c.id === conversation.id 
          ? { ...c, unreadCount: 0, lastMessage: { ...c.lastMessage, isRead: true } }
          : c
      ));
    }
    
    // Load messages for this conversation
    loadMessages(conversation.id);
    
    // On mobile, hide conversation list when selecting
    if (isMobile) {
      setShowConversationList(false);
    }
  };

  // Load messages for a conversation
  const loadMessages = async (conversationId) => {
    if (!user?.uid) {
      // Fallback to mock messages if no user
      const mockMessages = [
        {
          id: '1',
          content: 'Hi! I loved your last stream!',
          sender: conversationId === '1' ? 'user1' : 'user2',
          timestamp: new Date(Date.now() - 3600000),
          isRead: true
        },
        {
          id: '2',
          content: 'Thank you so much! Glad you enjoyed it 😊',
          sender: user?.uid || 'creator',
          timestamp: new Date(Date.now() - 3500000),
          isRead: true
        },
        {
          id: '3',
          content: selectedConversation?.lastMessage?.content || 'Hey!',
          sender: selectedConversation?.participant?.id || 'user1',
          timestamp: selectedConversation?.lastMessage?.timestamp || new Date(),
          isRead: selectedConversation?.lastMessage?.isRead
        }
      ];
      setMessages(mockMessages);
      return;
    }
    
    try {
      const token = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/conversations/${conversationId}/messages`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      } else {
        console.error('Failed to fetch messages');
        // Fallback to mock messages
        const mockMessages = [
          {
            id: '1',
            content: 'Start a conversation',
            sender: user?.uid || 'creator',
            timestamp: new Date(),
            isRead: true
          }
        ];
        setMessages(mockMessages);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      // Fallback to mock messages
      const mockMessages = [
        {
          id: '1',
          content: 'Start a conversation',
          sender: user?.uid || 'creator',
          timestamp: new Date(),
          isRead: true
        }
      ];
      setMessages(mockMessages);
    }
  };

  // Send message via API
  const sendMessage = async (content, type = 'text', attachmentUrl = null) => {
    if (!selectedConversation || !content.trim()) return;
    
    setSendingMessage(true);
    const tempId = Date.now().toString();
    
    // Optimistically add message to UI
    const optimisticMessage = {
      id: tempId,
      content,
      type,
      attachment_url: attachmentUrl,
      sender: user?.uid,
      sender_name: user?.name || user?.username,
      timestamp: new Date(),
      isRead: false,
      status: 'sending'
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/messages/send`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            conversation_id: selectedConversation.id,
            recipient_id: selectedConversation.participant.id,
            content,
            type,
            attachment_url: attachmentUrl,
            // Include token cost for creators sending to fans
            token_cost: isCreator ? 0 : messageRates[type]
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        // Update message with server response
        setMessages(prev => prev.map(msg => 
          msg.id === tempId ? { ...data.message, status: 'sent' } : msg
        ));
        
        // Update conversation last message
        updateConversationWithNewMessage(selectedConversation.id, data.message);
        
        // Send WebSocket notification
        if (websocket && websocket.readyState === WebSocket.OPEN) {
          websocket.send(JSON.stringify({
            type: 'message_sent',
            conversationId: selectedConversation.id,
            message: data.message
          }));
        }
        
        // Update token balance if tokens were charged
        if (data.tokens_charged && data.new_balance !== undefined) {
          // Update user's token balance in app state
          toast.success(`Message sent! ${data.tokens_charged} tokens deducted`);
        }
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Mark message as failed
      setMessages(prev => prev.map(msg => 
        msg.id === tempId ? { ...msg, status: 'failed' } : msg
      ));
      
      if (error.message?.includes('Insufficient tokens')) {
        toast.error('Insufficient tokens. Please purchase more tokens to continue messaging.');
      } else {
        toast.error(error.message || 'Failed to send message. Please try again.');
      }
    } finally {
      setSendingMessage(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (file, type = 'file') => {
    if (!file || !selectedConversation) return;
    
    const maxSize = type === 'image' ? 10 * 1024 * 1024 : 50 * 1024 * 1024; // 10MB for images, 50MB for files
    
    if (file.size > maxSize) {
      toast.error(`File size exceeds ${type === 'image' ? '10MB' : '50MB'} limit`);
      return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    formData.append('conversation_id', selectedConversation.id);
    
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/messages/upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        // Send message with attachment
        const messageType = type === 'image' ? 'image' : 'file';
        const messageContent = type === 'image' ? 'Sent an image' : `Sent a file: ${file.name}`;
        
        await sendMessage(messageContent, messageType, data.url);
      } else {
        throw new Error('Failed to upload file');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file. Please try again.');
    }
  };

  // Handle PPV file selection (creators only)
  const handlePPVFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedConversation) return;

    // Determine file type
    let fileType = 'file';
    if (file.type.startsWith('image/')) fileType = 'image';
    else if (file.type.startsWith('video/')) fileType = 'video';
    else if (file.type.startsWith('audio/')) fileType = 'audio';

    setPPVFile(file);
    setPPVFileType(fileType);
    setShowPPVModal(true);

    // Clear input
    event.target.value = null;
  };

  // Send PPV message
  const sendPPVMessage = async (ppvData) => {
    if (!selectedConversation || !ppvData.file) return;

    setSendingMessage(true);

    try {
      const formData = new FormData();
      formData.append('file', ppvData.file);
      formData.append('receiver_id', selectedConversation.participant.id);
      formData.append('conversation_id', selectedConversation.id);
      formData.append('price', ppvData.price);
      formData.append('description', ppvData.description || '');
      formData.append('is_exclusive', ppvData.isExclusive || false);
      formData.append('expires_in', ppvData.expiresIn || 'never');
      formData.append('message_text', `Sent locked ${ppvData.fileType}`);

      const token = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/ppv-messages/send`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success(`PPV ${ppvData.fileType} sent! (${ppvData.price} tokens)`);

        // Refresh messages to show the new PPV message
        await fetchMessages(selectedConversation.id);

        // Update conversation's last message
        setConversations(prev => prev.map(c =>
          c.id === selectedConversation.id
            ? {
                ...c,
                lastMessage: {
                  content: `Sent locked ${ppvData.fileType}`,
                  timestamp: new Date(),
                  isRead: true,
                  sender: user?.uid
                }
              }
            : c
        ));
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send PPV message');
      }
    } catch (error) {
      console.error('Error sending PPV message:', error);
      toast.error(error.message || 'Failed to send PPV message');
    } finally {
      setSendingMessage(false);
      setPPVFile(null);
      setPPVFileType(null);
    }
  };

  // Handle typing indicator
  const handleTyping = () => {
    if (!websocket || !selectedConversation) return;
    
    // Send typing start
    if (websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({
        type: 'typing_start',
        conversationId: selectedConversation.id,
        userId: user?.uid
      }));
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
          type: 'typing_stop',
          conversationId: selectedConversation.id,
          userId: user?.uid
        }));
      }
    }, 2000);
  };

  // Mark message as read
  const markMessageAsRead = async (messageId) => {
    try {
      const token = await getAuthToken();
      await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/messages/${messageId}/read`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  // Update conversation with new message
  const updateConversationWithNewMessage = (conversationId, message) => {
    setConversations(prev => prev.map(c => 
      c.id === conversationId
        ? {
            ...c,
            lastMessage: {
              content: message.content,
              timestamp: message.timestamp,
              isRead: message.sender === user?.uid,
              sender: message.sender
            },
            unreadCount: message.sender !== user?.uid ? (c.unreadCount || 0) + 1 : 0
          }
        : c
    ));
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      // Today - show time
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } else if (diffDays === 1) {
      // Yesterday
      return 'Yesterday';
    } else if (diffDays < 7) {
      // This week - show day name
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    } else {
      // Older - show date
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: diffDays > 365 ? 'numeric' : undefined
      });
    }
  };

  // Handle pin/unpin conversation
  const handlePinConversation = (conversationId, event) => {
    event?.stopPropagation();
    
    setConversations(prev => prev.map(c => 
      c.id === conversationId ? { ...c, isPinned: !c.isPinned } : c
    ));
    
    const conv = conversations.find(c => c.id === conversationId);
    // toast.success(conv?.isPinned ? 'Conversation unpinned' : 'Conversation pinned');
  };

  // Handle archive conversation
  const handleArchiveConversation = (conversationId, event) => {
    event?.stopPropagation();
    
    setConversations(prev => prev.map(c => 
      c.id === conversationId ? { ...c, isArchived: !c.isArchived } : c
    ));
    
    const conv = conversations.find(c => c.id === conversationId);
    // toast.success(conv?.isArchived ? 'Conversation unarchived' : 'Conversation archived');
    
    // If archiving selected conversation, clear selection
    if (selectedConversation?.id === conversationId) {
      setSelectedConversation(null);
    }
  };

  // Handle toggle VIP status
  const handleToggleVIP = (conversationId, event) => {
    event?.stopPropagation();
    
    setConversations(prev => prev.map(c => {
      if (c.id === conversationId) {
        const newVIPStatus = !c.participant.isVIP;
        // Update selected conversation if it's the one being modified
        if (selectedConversation?.id === conversationId) {
          setSelectedConversation({
            ...c,
            participant: { ...c.participant, isVIP: newVIPStatus }
          });
        }
        return {
          ...c,
          participant: { ...c.participant, isVIP: newVIPStatus }
        };
      }
      return c;
    }));
    
    const conv = conversations.find(c => c.id === conversationId);
    const isNowVIP = !conv?.participant.isVIP;
    toast.success(isNowVIP ? 'Added to VIPs ⭐' : 'Removed from VIPs');
  };

  // Handle bulk selection
  const handleSelectForBulk = (conversationId, event) => {
    event?.stopPropagation();
    
    const newSelected = new Set(selectedConversations);
    if (newSelected.has(conversationId)) {
      newSelected.delete(conversationId);
    } else {
      newSelected.add(conversationId);
    }
    setSelectedConversations(newSelected);
  };

  // Handle bulk actions
  const handleBulkAction = (action) => {
    const selectedIds = Array.from(selectedConversations);
    
    switch (action) {
      case 'read':
        setConversations(prev => prev.map(c => 
          selectedIds.includes(c.id) 
            ? { ...c, unreadCount: 0, lastMessage: { ...c.lastMessage, isRead: true } }
            : c
        ));
        // toast.success(`Marked ${selectedIds.length} conversations as read`);
        break;
        
      case 'archive':
        setConversations(prev => prev.map(c => 
          selectedIds.includes(c.id) ? { ...c, isArchived: true } : c
        ));
        // toast.success(`Archived ${selectedIds.length} conversations`);
        break;
        
      case 'delete':
        if (window.confirm(`Delete ${selectedIds.length} conversations? This cannot be undone.`)) {
          setConversations(prev => prev.filter(c => !selectedIds.includes(c.id)));
          // toast.success(`Deleted ${selectedIds.length} conversations`);
        }
        break;
    }
    
    // Clear selection and exit bulk mode
    setSelectedConversations(new Set());
    setBulkActionMode(false);
  };
  
  // Conversation item component
  const ConversationItem = ({ conversation }) => {
    const isSelected = selectedConversation?.id === conversation.id;
    const isBulkSelected = selectedConversations.has(conversation.id);
    
    return (
      <motion.div
        role="button"
        aria-label={`Conversation with ${conversation.participant.name}`}
        aria-selected={isSelected}
        tabIndex={0}
        onKeyPress={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            !bulkActionMode && handleSelectConversation(conversation);
          }
        }}
        whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
        onClick={() => !bulkActionMode && handleSelectConversation(conversation)}
        className={`
          group relative flex items-center p-4 cursor-pointer transition-all
          ${isSelected ? 'bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-600' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}
          ${isBulkSelected ? 'bg-blue-50' : ''}
        `}
      >
        {/* Bulk selection checkbox */}
        {bulkActionMode && (
          <div className="mr-3">
            <input
              type="checkbox"
              checked={isBulkSelected}
              onChange={(e) => handleSelectForBulk(conversation.id, e)}
              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        
        {/* Avatar */}
        <div className="relative flex-shrink-0 mr-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold">
            {conversation.participant.name.charAt(0)}
          </div>
          {conversation.participant.isOnline && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                {conversation.participant.name}
              </h3>
              {conversation.isPinned && (
                <MapPinIconSolid className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              )}
              {isCreator && conversation.participant.isVIP && (
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">
                  VIP
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatTimestamp(conversation.lastMessage.timestamp)}
            </span>
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
            {conversation.lastMessage.sender === user?.uid && 'You: '}
            {conversation.lastMessage.content}
          </p>
        </div>
        
        {/* Unread indicator */}
        {conversation.unreadCount > 0 && !bulkActionMode && (
          <div className="ml-2 flex-shrink-0">
            <span className="inline-flex items-center justify-center w-6 h-6 bg-purple-600 text-white text-xs font-semibold rounded-full">
              {conversation.unreadCount}
            </span>
          </div>
        )}
        
        {/* Actions */}
        {!bulkActionMode && (
          <div className="ml-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* VIP Toggle - Only for Creators */}
            {isCreator && (
              <button
                onClick={(e) => handleToggleVIP(conversation.id, e)}
                className={`p-1 rounded transition-colors ${
                  conversation.participant.isVIP
                    ? 'text-yellow-500 hover:bg-yellow-50'
                    : 'text-gray-400 hover:bg-gray-200'
                }`}
                title={conversation.participant.isVIP ? 'Remove from VIPs' : 'Add to VIPs'}
              >
                {conversation.participant.isVIP ? (
                  <StarIconSolid className="w-4 h-4" />
                ) : (
                  <StarIcon className="w-4 h-4" />
                )}
              </button>
            )}
            <button
              onClick={(e) => handlePinConversation(conversation.id, e)}
              className="p-1 hover:bg-gray-200 rounded"
              title={conversation.isPinned ? 'Unpin' : 'Pin'}
            >
              <MapPinIcon className={`w-4 h-4 ${conversation.isPinned ? 'text-purple-600' : 'text-gray-400'}`} />
            </button>
            <button
              onClick={(e) => handleArchiveConversation(conversation.id, e)}
              className="p-1 hover:bg-gray-200 rounded"
              title="Archive"
            >
              <ArchiveBoxIcon className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Conversation List Sidebar */}
      <AnimatePresence>
        {(!isMobile || showConversationList) && (
          <motion.div
            role="region"
            aria-label="Conversation list"
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className={`${
              isMobile ? 'absolute inset-y-0 left-0 z-40' : 'relative'
            } w-full md:w-96 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col`}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                {/* Search - full width on desktop */}
                <div className="flex-1 relative min-w-0">
                  <input
                    type="search"
                    placeholder="Search Messages"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-12 pl-10 pr-3 sm:pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                    aria-label="Search conversations"
                  />
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  {/* Mass Message Button - Only for Creators */}
                  {isCreator && !bulkActionMode && (
                    <button
                      onClick={() => {
                        setMassMessageFilterType('all');
                        setShowMassMessageModal(true);
                      }}
                      className="flex items-center justify-center px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-sm"
                      title="Broadcast message to all fans"
                    >
                      <UserGroupIcon className="w-5 h-5" />
                    </button>
                  )}

                  {bulkActionMode ? (
                    <>
                      <button
                        onClick={() => handleBulkAction('read')}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                        title="Mark as read"
                      >
                        <CheckIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleBulkAction('archive')}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                        title="Archive"
                      >
                        <ArchiveBoxIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleBulkAction('delete')}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => {
                          setBulkActionMode(false);
                          setSelectedConversations(new Set());
                        }}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                      >
                        <XMarkIcon className="w-5 h-5" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setBulkActionMode(true)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                      title="Select multiple"
                    >
                      <EllipsisHorizontalIcon className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Inbox Tabs */}
            <div className="flex overflow-x-auto border-b border-gray-200">
              {inboxTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'text-purple-600 border-b-2 border-purple-600'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
                      activeTab === tab.id
                        ? 'bg-purple-100 text-purple-600'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
            
            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto" role="list" aria-label="Conversations">
              {conversationsLoading ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mb-3"></div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Loading conversations...</p>
                </div>
              ) : getFilteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                  <InboxIcon className="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm">No conversations found</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {getFilteredConversations.map(conversation => (
                    <ConversationItem key={conversation.id} conversation={conversation} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Message Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {selectedConversation ? (
          <div className="flex flex-col h-full">
            {/* Chat Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {isMobile && (
                    <button
                      onClick={() => setShowConversationList(true)}
                      className="p-2 hover:bg-gray-100 rounded-lg md:hidden"
                    >
                      <ChevronLeftIcon className="w-5 h-5" />
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      if (isCreator) {
                        setSelectedFanId(selectedConversation.participant.id);
                        setSelectedFanData(selectedConversation.participant);
                        setShowFanProfile(true);
                      }
                    }}
                    className={`flex items-center gap-3 ${isCreator ? 'hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg p-2 -m-2 transition-colors' : ''}`}
                    disabled={!isCreator}
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold">
                        {selectedConversation.participant.name.charAt(0)}
                      </div>
                      {selectedConversation.participant.isOnline && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                      )}
                    </div>
                    
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {selectedConversation.participant.name}
                        </h3>
                        {selectedConversation.participant.isVIP && (
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">
                            VIP
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {selectedConversation.participant.isOnline 
                          ? 'Active now' 
                          : `Last seen ${formatTimestamp(selectedConversation.participant.lastSeen || new Date())}`
                        }
                      </p>
                      {isCreator && (
                        <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                          View spending & stats
                        </p>
                      )}
                    </div>
                  </button>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* VIP Toggle Button - Only for Creators */}
                  {isCreator && (
                    <button
                      onClick={() => handleToggleVIP(selectedConversation.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        selectedConversation.participant.isVIP
                          ? 'text-yellow-500 bg-yellow-50 hover:bg-yellow-100'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      title={selectedConversation.participant.isVIP ? 'Remove from VIPs' : 'Add to VIPs'}
                    >
                      {selectedConversation.participant.isVIP ? (
                        <StarIconSolid className="w-5 h-5" />
                      ) : (
                        <StarIcon className="w-5 h-5" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => onStartVoiceCall?.(selectedConversation.participant)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    <PhoneIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => onStartVideoCall?.(selectedConversation.participant)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    <VideoCameraIcon className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                    <EllipsisHorizontalIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0" role="log" aria-label="Messages" aria-live="polite">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                  <ChatBubbleLeftRightIcon className="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                <>
                  {messages.map(message => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender === user?.uid ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-xs lg:max-w-md ${
                        message.sender === user?.uid ? 'items-end' : 'items-start'
                      }`}>
                        <div className={`px-4 py-2 rounded-lg ${
                          message.sender === user?.uid
                            ? message.status === 'failed' 
                              ? 'bg-red-500 text-white'
                              : 'bg-purple-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                        }`}>
                          {message.attachment_url && message.type === 'image' && (
                            <img 
                              src={message.attachment_url} 
                              alt="Attached image" 
                              className="rounded mb-2 max-w-full cursor-pointer hover:opacity-90"
                              onClick={() => window.open(message.attachment_url, '_blank')}
                            />
                          )}
                          {message.attachment_url && message.type === 'file' && (
                            <a 
                              href={message.attachment_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 mb-2 underline hover:no-underline"
                            >
                              <PaperClipIcon className="w-4 h-4" />
                              <span className="text-sm">View attachment</span>
                            </a>
                          )}
                          <p className="text-sm">{message.content}</p>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <p className={`text-xs ${
                            message.sender === user?.uid ? 'text-gray-500' : 'text-gray-400'
                          }`}>
                            {formatTimestamp(message.timestamp)}
                          </p>
                          {message.sender === user?.uid && (
                            <>
                              {message.status === 'sending' && (
                                <span className="text-xs text-gray-400">Sending...</span>
                              )}
                              {message.status === 'sent' && message.isRead && (
                                <CheckIcon className="w-3 h-3 text-blue-500" />
                              )}
                              {message.status === 'failed' && (
                                <ExclamationCircleIcon className="w-3 h-3 text-red-500" />
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Typing Indicator */}
                  {typingUsers.size > 0 && (
                    <div className="flex justify-start">
                      <div className="bg-gray-200 dark:bg-gray-700 px-4 py-2 rounded-lg">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Message Input */}
            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex-shrink-0">
              {/* Creator's Message Rates Display */}
              {isCreator && (
                <div className="mb-2 flex items-center justify-between">
                  <button
                    onClick={() => setShowRates(!showRates)}
                    className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                  >
                    <CurrencyDollarIcon className="w-4 h-4" />
                    <span>Your Message Rates</span>
                    <ChevronLeftIcon className={`w-3 h-3 transition-transform ${showRates ? 'rotate-90' : '-rotate-90'}`} />
                  </button>
                  {showRates && (
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <ChatBubbleLeftRightIcon className="w-3 h-3 text-gray-500" />
                        <span className="text-gray-600 dark:text-gray-400">{messageRates.text} tokens</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <PhotoIcon className="w-3 h-3 text-gray-500" />
                        <span className="text-gray-600 dark:text-gray-400">{messageRates.image} tokens</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MicrophoneIcon className="w-3 h-3 text-gray-500" />
                        <span className="text-gray-600 dark:text-gray-400">{messageRates.audio} tokens</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FilmIcon className="w-3 h-3 text-gray-500" />
                        <span className="text-gray-600 dark:text-gray-400">{messageRates.video} tokens</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileUpload(file, 'file');
                      e.target.value = '';
                    }
                  }}
                />
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileUpload(file, 'image');
                      e.target.value = '';
                    }
                  }}
                />
                {/* PPV File Input (Creators Only) */}
                {isCreator && (
                  <input
                    ref={ppvFileInputRef}
                    type="file"
                    accept="image/*,video/*,audio/*"
                    className="hidden"
                    onChange={handlePPVFileSelect}
                  />
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  title="Attach file"
                  aria-label="Attach file"
                  disabled={sendingMessage}
                >
                  <PaperClipIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  title="Send image"
                  aria-label="Send image"
                  disabled={sendingMessage}
                >
                  <PhotoIcon className="w-5 h-5" />
                </button>

                {/* PPV Button (Creators Only) */}
                {isCreator && (
                  <button
                    onClick={() => ppvFileInputRef.current?.click()}
                    className="p-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 rounded-lg transition-all shadow-sm"
                    title="Send PPV content (Pay-Per-View)"
                    aria-label="Send PPV content"
                    disabled={sendingMessage}
                  >
                    <PlusIcon className="w-5 h-5" />
                  </button>
                )}
                
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (newMessage.trim() && !sendingMessage) {
                        sendMessage(newMessage.trim());
                      }
                    }
                  }}
                  placeholder={sendingMessage ? "Sending..." : "Type a message..."}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  disabled={sendingMessage}
                />
                
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <FaceSmileIcon className="w-5 h-5" />
                </button>
                
                <button
                  onClick={() => {
                    if (newMessage.trim() && !sendingMessage) {
                      sendMessage(newMessage.trim());
                    }
                  }}
                  className={`p-2 rounded-lg transition-colors ${
                    sendingMessage 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                  disabled={sendingMessage}
                >
                  {sendingMessage ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <PaperAirplaneIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* No conversation selected */
          <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="text-center">
              <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <InboxIcon className="w-10 h-10 text-gray-400 dark:text-gray-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                {conversations.length === 0 ? 'No conversations yet' : 'Select a conversation'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {conversations.length === 0
                  ? 'No conversations yet. Interact with others to start messaging.'
                  : 'Choose a conversation from the sidebar to start messaging'
                }
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Mass Message Modal */}
      {isCreator && (
        <MassMessageModal
          isOpen={showMassMessageModal}
          onClose={() => {
            setShowMassMessageModal(false);
            setMassMessageFilterType('all');
          }}
          totalFans={user?.follower_count || conversations.filter(c => !c.isArchived).length}
          filterType={massMessageFilterType}
        />
      )}

      {/* Fan Profile Modal */}
      {isCreator && (
        <FanProfileModal
          isOpen={showFanProfile}
          onClose={() => {
            setShowFanProfile(false);
            setSelectedFanId(null);
            setSelectedFanData(null);
          }}
          fanId={selectedFanId}
          fanData={selectedFanData}
          isCreatorView={true}
        />
      )}

      {/* PPV Pricing Modal (Creators Only) */}
      {isCreator && (
        <PPVPricingModal
          isOpen={showPPVModal}
          onClose={() => {
            setShowPPVModal(false);
            setPPVFile(null);
            setPPVFileType(null);
          }}
          onConfirm={sendPPVMessage}
          file={ppvFile}
          fileType={ppvFileType}
        />
      )}
    </div>
  );
};

export default EnhancedMessagesPage;