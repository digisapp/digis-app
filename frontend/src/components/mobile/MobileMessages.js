import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  VideoCameraIcon,
  PhoneIcon,
  PaperAirplaneIcon,
  PhotoIcon,
  PlusIcon,
  CheckIcon,
  ChevronLeftIcon,
  EllipsisHorizontalIcon,
  FaceSmileIcon,
  MicrophoneIcon,
  UserGroupIcon,
  StarIcon,
  ArchiveBoxIcon,
  TrashIcon,
  CurrencyDollarIcon,
  PaperClipIcon,
  XCircleIcon
} from '@heroicons/react/24/solid';
import { CheckIcon as CheckOutlineIcon, StarIcon as StarIconOutline } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { getAuthToken } from '../../utils/supabase-auth';
import { fetchWithRetry } from '../../utils/fetchWithRetry';
import { triggerHaptic } from '../../utils/haptics';
import FanProfileModal from '../FanProfileModal';
import MobileCallRequest from './MobileCallRequest';
import SimpleBroadcastModal from './SimpleBroadcastModal';
import MessageComposeModal from '../MessageComposeModal';
import MassMessageModal from '../MassMessageModal';
import MessageTemplatesModal from '../MessageTemplatesModal';

const MobileMessages = ({ user, isCreator, onStartVideoCall, onStartVoiceCall, onSendTip, websocket, tokenBalance = 0 }) => {
  const openBottomSheet = () => {};
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [swipedConversation, setSwipedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [showBroadcastPage, setShowBroadcastPage] = useState(false);
  const [showFanProfile, setShowFanProfile] = useState(false);
  const [selectedFanId, setSelectedFanId] = useState(null);
  const [selectedFanData, setSelectedFanData] = useState(null);
  const [messageRates, setMessageRates] = useState({
    text: 1,
    image: 2,
    audio: 3,
    video: 5
  });
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [audioRecordTime, setAudioRecordTime] = useState(0);
  const audioRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioTimerRef = useRef(null);
  const [showCallRequest, setShowCallRequest] = useState(false);
  const [callRequestType, setCallRequestType] = useState('video');
  const [callRecipient, setCallRecipient] = useState(null);

  // New modal states
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [showMassMessageModal, setShowMassMessageModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [selectedCreatorForMessage, setSelectedCreatorForMessage] = useState(null);

  // Common emojis for quick access
  const quickEmojis = ['😊', '❤️', '👍', '🔥', '😂', '🎉', '💯', '✨'];

  // Lock body scroll when broadcast modal is open
  useEffect(() => {
    if (showBroadcastPage) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      // Add class for iOS to prevent rubber-band scrolling
      document.documentElement.classList.add('overflow-hidden', 'touch-none');

      return () => {
        document.body.style.overflow = prevOverflow;
        document.documentElement.classList.remove('overflow-hidden', 'touch-none');
      };
    }
  }, [showBroadcastPage]);

  // Fetch creator's message rates
  useEffect(() => {
    const fetchMessageRates = async () => {
      if (!isCreator || !user?.uid) return;
      
      try {
        const token = await getAuthToken();
        const response = await fetchWithRetry(
          `${import.meta.env.VITE_BACKEND_URL}/api/creators/rates`,
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

  
  // Swipe to delete/archive conversation
  const handleSwipeAction = useCallback((conversation, action) => {
    triggerHaptic('medium');
    
    if (action === 'delete') {
      setConversations(prev => prev.filter(c => c.id !== conversation.id));
      toast.success('Conversation deleted');
    } else if (action === 'archive') {
      setConversations(prev => prev.filter(c => c.id !== conversation.id));
      toast.success('Conversation archived');
    } else if (action === 'star') {
      setConversations(prev => prev.map(c => 
        c.id === conversation.id ? { ...c, starred: !c.starred } : c
      ));
      toast.success(conversation.starred ? 'Removed from favorites' : 'Added to favorites');
    }
    
    setSwipedConversation(null);
  }, [triggerHaptic]);
  
  // Start audio recording
  const startAudioRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        // Handle audio blob - send as message
        handleSendAudioMessage(blob);
        // Clean up stream after recording stops
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => track.stop());
          audioStreamRef.current = null;
        }
      };

      audioRecorderRef.current = mediaRecorder;
      audioStreamRef.current = stream;
      mediaRecorder.start();
      setRecordingAudio(true);
      setAudioRecordTime(0);

      // Start timer
      audioTimerRef.current = setInterval(() => {
        setAudioRecordTime(prev => prev + 1);
      }, 1000);

      triggerHaptic('medium');
    } catch (error) {
      console.error('Error starting audio recording:', error);
      toast.error('Unable to access microphone');
    }
  }, [triggerHaptic, handleSendAudioMessage]);
  
  // Stop audio recording
  const stopAudioRecording = useCallback(() => {
    if (audioRecorderRef.current) {
      audioRecorderRef.current.stop();
      audioRecorderRef.current = null;
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    if (audioTimerRef.current) {
      clearInterval(audioTimerRef.current);
      audioTimerRef.current = null;
    }

    setRecordingAudio(false);
    setAudioRecordTime(0);
    triggerHaptic('light');
  }, [triggerHaptic]);
  
  // Helper function to fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!user?.uid) {
      setConversations([]);
      return;
    }

    setLoading(true);
    setConversationsLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/api/conversations`,
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
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch conversations');
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setConversations([]);
    } finally {
      setLoading(false);
      setConversationsLoading(false);
    }
  }, [user]);

  // Handle sending audio message
  const handleSendAudioMessage = useCallback(async (audioBlob) => {
    if (!selectedConversation) return;

    setSendingMessage(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice-message.webm');
      formData.append('conversationId', selectedConversation.id);

      const token = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/messages/audio`,
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
        setMessages(prev => [...prev, data.message]);
        toast.success('Voice message sent');
      }
    } catch (error) {
      console.error('Error sending audio message:', error);
      toast.error('Failed to send voice message');
    } finally {
      setSendingMessage(false);
    }
  }, [selectedConversation]);

  // Cleanup audio recording on unmount
  useEffect(() => {
    return () => {
      // Clean up audio recording if component unmounts while recording
      if (audioRecorderRef.current) {
        audioRecorderRef.current.stop();
        audioRecorderRef.current = null;
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
      if (audioTimerRef.current) {
        clearInterval(audioTimerRef.current);
        audioTimerRef.current = null;
      }
    };
  }, []);

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Pull to refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    triggerHaptic('light');

    try {
      await fetchConversations();
    } catch (error) {
      console.error('Error refreshing conversations:', error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchConversations, triggerHaptic]);

  // Fetch messages for selected conversation
  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedConversation?.id || !user?.uid) return;
      
      setMessagesLoading(true);
      try {
        const token = await getAuthToken();
        const response = await fetchWithRetry(
          `${import.meta.env.VITE_BACKEND_URL}/api/messages/${selectedConversation.id}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages || []);
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
        setMessages([]);
      } finally {
        setMessagesLoading(false);
      }
    };

    fetchMessages();
  }, [selectedConversation, user]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // WebSocket message handler
  useEffect(() => {
    if (!websocket) return;

    const handleMessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'new_message' && selectedConversation?.id === data.conversationId) {
        setMessages(prev => [...prev, data.message]);
      }
      
      if (data.type === 'typing' && selectedConversation?.id === data.conversationId) {
        // Handle typing indicator
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 3000);
      }
    };

    websocket.addEventListener('message', handleMessage);
    return () => websocket.removeEventListener('message', handleMessage);
  }, [websocket, selectedConversation]);

  const formatTimestamp = (date) => {
    if (!date) return '';
    const now = new Date();
    const msgDate = new Date(date);
    const diff = now - msgDate;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      // Today - show time
      return msgDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return msgDate.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return msgDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedConversation || sendingMessage) return;
    
    setSendingMessage(true);
    const messageContent = message;
    setMessage('');
    
    // Optimistically add message to UI
    const tempMessage = {
      id: Date.now().toString(),
      content: messageContent,
      sender: user?.uid,
      sender_name: user?.name || user?.username,
      timestamp: new Date(),
      isRead: false,
      status: 'sending'
    };
    
    setMessages(prev => [...prev, tempMessage]);
    triggerHaptic('light');
    
    try {
      const token = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/api/messages/send`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            conversationId: selectedConversation.id,
            receiverId: selectedConversation.participant?.id || selectedConversation.user?.id,
            content: messageContent,
            messageType: 'text'
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Update message with actual ID and status
        setMessages(prev => prev.map(msg => 
          msg.id === tempMessage.id ? { ...data.message, status: 'sent' } : msg
        ));
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      // Mark message as failed
      setMessages(prev => prev.map(msg => 
        msg.id === tempMessage.id ? { ...msg, status: 'failed' } : msg
      ));
    } finally {
      setSendingMessage(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedConversation) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setSendingMessage(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('conversationId', selectedConversation.id);
    formData.append('receiverId', selectedConversation.participant?.id || selectedConversation.user?.id);
    formData.append('messageType', file.type.startsWith('image/') ? 'image' : 'file');

    try {
      const token = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/api/messages/upload`,
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
        setMessages(prev => [...prev, data.message]);
        toast.success('File sent successfully');
      } else {
        throw new Error('Failed to upload file');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
    } finally {
      setSendingMessage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const ConversationList = () => (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-purple-600 to-pink-600 text-white border-b border-purple-700">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            {/* Avatar and Username */}
            <div className="flex items-center gap-2 flex-1">
              {/* Search Bar with "Search Messages" placeholder */}
              <div className="relative flex-1 min-w-0">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
                <input
                  type="search"
                  placeholder="Search Messages"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 pl-10 pr-3 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg focus:ring-2 focus:ring-white/50 focus:border-white/50 focus:bg-white/20 text-sm text-white placeholder-white/70 transition-all"
                />
              </div>
            </div>

            {/* Show broadcast button for creators */}
            {isCreator ? (
              <button
                onClick={() => {
                  console.log('Broadcast button clicked, isCreator:', isCreator);
                  setShowBroadcastPage(true);
                  triggerHaptic('medium');
                }}
                className="p-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg active:scale-95 transition-transform shadow-lg"
                title="Broadcast message to all fans"
                aria-label="Broadcast message to all fans"
              >
                <UserGroupIcon className="w-5 h-5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {conversationsLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (

      /* Conversations */
      <div className="">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <PaperAirplaneIcon className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No messages yet</h3>
            <p className="text-gray-600 text-center">Start a conversation with a creator or fan</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {conversations
              .filter(conv => {
                const participant = conv.participant || conv.user;
                const name = participant?.name || participant?.username || '';
                return name.toLowerCase().includes(searchQuery.toLowerCase());
              })
              .map((conversation) => {
                const participant = conversation.participant || conversation.user;
                const lastMsg = conversation.lastMessage || {};
                return (
                  <motion.button
                    key={conversation.id}
                    onClick={() => {
                      setSelectedConversation(conversation);
                      triggerHaptic('light');
                    }}
                    className="w-full px-4 py-4 flex items-start gap-3 hover:bg-gray-50 transition-colors"
                    whileTap={{ scale: 0.98 }}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {participant?.avatar_url ? (
                        <img
                          src={participant.avatar_url}
                          alt={participant.name}
                          className="w-14 h-14 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-lg">
                          {(participant?.name || participant?.username || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      {participant?.isOnline && (
                        <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
                      )}
                      {participant?.isVIP && (
                        <div className="absolute -top-1 -right-1 text-yellow-500">
                          <StarIcon className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-gray-900 truncate flex items-center gap-1">
                          {participant?.name || participant?.username}
                          {participant?.isCreator && (
                            <span className="text-purple-600">✓</span>
                          )}
                        </h3>
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(lastMsg.timestamp || conversation.timestamp || new Date())}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-600 truncate">
                          {conversation.isTyping ? (
                            <span className="italic">typing...</span>
                          ) : (
                            lastMsg.content || 'No messages yet'
                          )}
                        </p>
                        {(conversation.unreadCount || conversation.unread || 0) > 0 && (
                          <span className="ml-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-full">
                            {conversation.unreadCount || conversation.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
          </div>
        )}
      </div>
      )}
    </div>
  );

  const ChatView = () => {
    const participant = selectedConversation?.participant || selectedConversation?.user;
    
    return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col pb-32">
      {/* Chat Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setSelectedConversation(null);
              triggerHaptic('light');
            }}
            className="p-2 -ml-2"
          >
            <ChevronLeftIcon className="w-6 h-6 text-gray-700" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              {participant?.avatar_url ? (
                <img 
                  src={participant.avatar_url} 
                  alt={participant.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold">
                  {(participant?.name || participant?.username || '?').charAt(0).toUpperCase()}
                </div>
              )}
              {participant?.isOnline && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
              )}
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center gap-1">
                {participant?.name || participant?.username}
                {participant?.isVIP && <StarIcon className="w-4 h-4 text-yellow-500" />}
              </h3>
              <p className="text-xs text-gray-500">
                {participant?.isOnline ? 'Active now' : 'Offline'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => {
              if (participant) {
                setCallRecipient(participant);
                setCallRequestType('voice');
                setShowCallRequest(true);
                triggerHaptic('medium');
              }
            }}
            className="p-2 text-gray-600"
            whileTap={{ scale: 0.9 }}
          >
            <PhoneIcon className="w-5 h-5" />
          </motion.button>
          <motion.button
            onClick={() => {
              if (participant) {
                setCallRecipient(participant);
                setCallRequestType('video');
                setShowCallRequest(true);
                triggerHaptic('medium');
              }
            }}
            className="p-2 text-gray-600"
            whileTap={{ scale: 0.9 }}
          >
            <VideoCameraIcon className="w-5 h-5" />
          </motion.button>
          <motion.button
            onClick={() => setShowActions(!showActions)}
            className="p-2 text-gray-600"
            whileTap={{ scale: 0.9 }}
          >
            <EllipsisHorizontalIcon className="w-5 h-5" />
          </motion.button>
        </div>
      </div>
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-36 space-y-4 bg-gray-50">
        {messagesLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-gray-500">No messages yet. Start a conversation!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isOwnMessage = msg.sender === user?.uid;
            const showTimestamp = index === 0 || 
              (new Date(messages[index - 1]?.timestamp) - new Date(msg.timestamp)) > 300000;
            
            return (
              <div key={msg.id}>
                {showTimestamp && (
                  <div className="flex justify-center my-4">
                    <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">
                      {formatTimestamp(new Date(msg.timestamp))}
                    </span>
                  </div>
                )}
                <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] ${
                    isOwnMessage 
                      ? 'bg-purple-600 text-white rounded-2xl rounded-tr-sm' 
                      : 'bg-white rounded-2xl rounded-tl-sm shadow-sm'
                  } px-4 py-2`}>
                    {msg.messageType === 'image' ? (
                      <img src={msg.content} alt="" className="rounded-lg max-w-full" />
                    ) : (
                      <p className={isOwnMessage ? 'text-white' : 'text-gray-900'}>
                        {msg.content}
                      </p>
                    )}
                    <div className={`flex items-center ${isOwnMessage ? 'justify-end' : 'justify-start'} gap-1 mt-1`}>
                      <p className={`text-xs ${isOwnMessage ? 'opacity-90' : 'text-gray-500'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString('en-US', { 
                          hour: 'numeric', 
                          minute: '2-digit',
                          hour12: true 
                        })}
                      </p>
                      {isOwnMessage && msg.status === 'sent' && (
                        <CheckIcon className="w-4 h-4" />
                      )}
                      {isOwnMessage && msg.isRead && (
                        <CheckIcon className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-safe">
        <div className="flex items-end gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            disabled={sendingMessage}
          >
            <PhotoIcon className="w-6 h-6" />
          </button>

          <div className="flex-1">
            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type a message..."
              className="w-full px-4 py-2 bg-gray-100 rounded-full text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={sendingMessage}
            />
          </div>

          <button
            onClick={handleSendMessage}
            disabled={!message.trim() || sendingMessage}
            className="p-2 bg-purple-600 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform"
          >
            {sendingMessage ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <PaperAirplaneIcon className="w-6 h-6" />
            )}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>
      
      {/* Quick Actions Menu */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute top-16 right-4 bg-white rounded-xl shadow-lg p-2 z-50"
          >
            <button
              onClick={() => {
                const participant = selectedConversation?.participant || selectedConversation?.user;
                if (participant) {
                  onSendTip?.(participant);
                  setShowActions(false);
                }
              }}
              className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Send Tip
            </button>
            <button 
              onClick={() => {
                const participant = selectedConversation?.participant || selectedConversation?.user;
                if (participant) {
                  setSelectedFanData(participant);
                  setSelectedFanId(participant.id);
                  setShowFanProfile(true);
                  setShowActions(false);
                }
              }}
              className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              View Profile
            </button>
            <button className="w-full px-4 py-2 text-left text-red-600 hover:bg-gray-100 rounded-lg">
              Block User
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
  };

  // Don't return early - let the modal render as an overlay
  // The early return was preventing the modal from appearing

  return (
    <>
      {selectedConversation ? <ChatView /> : <ConversationList />}

      {/* Simple Broadcast Modal */}
      <SimpleBroadcastModal
        isOpen={showBroadcastPage}
        onClose={() => {
          console.log('Closing broadcast modal');
          setShowBroadcastPage(false);
          triggerHaptic('light');
        }}
        user={user}
      />

      {showFanProfile && selectedFanData && (
        <FanProfileModal
          isOpen={showFanProfile}
          onClose={() => {
            setShowFanProfile(false);
            setSelectedFanId(null);
            setSelectedFanData(null);
          }}
          fanData={selectedFanData}
          isCreator={isCreator}
        />
      )}
      
      {/* Call Request Modal */}
      <MobileCallRequest
        isOpen={showCallRequest}
        onClose={() => {
          setShowCallRequest(false);
          setCallRecipient(null);
        }}
        recipient={callRecipient}
        callType={callRequestType}
        userTokenBalance={tokenBalance}
        onCallStart={(callData) => {
          // Handle accepted call
          if (callRequestType === 'video') {
            onStartVideoCall?.(callRecipient);
          } else {
            onStartVoiceCall?.(callRecipient);
          }
        }}
      />

      {/* Message Compose Modal */}
      {showComposeModal && selectedCreatorForMessage && (
        <MessageComposeModal
          isOpen={showComposeModal}
          onClose={() => {
            setShowComposeModal(false);
            setSelectedCreatorForMessage(null);
          }}
          creator={selectedCreatorForMessage}
          tokenCost={messageRates.text}
          tokenBalance={tokenBalance}
          onMessageSent={(data) => {
            // Refresh conversations after sending
            fetchConversations();
            toast.success('Message sent successfully!');
          }}
        />
      )}

      {/* Mass Message Modal (for creators) */}
      {isCreator && showMassMessageModal && (
        <MassMessageModal
          isOpen={showMassMessageModal}
          onClose={() => setShowMassMessageModal(false)}
          isCreator={isCreator}
        />
      )}

      {/* Message Templates Modal (for creators) */}
      {isCreator && showTemplatesModal && (
        <MessageTemplatesModal
          isOpen={showTemplatesModal}
          onClose={() => setShowTemplatesModal(false)}
          onSelectTemplate={(template) => {
            setMessage(template.content);
            setShowTemplatesModal(false);
            inputRef.current?.focus();
          }}
        />
      )}
    </>
  );
};

export default MobileMessages;