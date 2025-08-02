import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import {
  StarIcon as StarIconSolid,
  MapPinIcon as MapPinIconSolid
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

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
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Inbox tabs configuration
  const inboxTabs = [
    { id: 'all', label: 'All', icon: InboxIcon, count: 0 },
    { id: 'unread', label: 'Unread', icon: EnvelopeIcon, count: 0 },
    { id: 'vips', label: 'VIPs', icon: StarIcon, count: 0 },
    { id: 'requests', label: 'Requests', icon: UserGroupIcon, count: 0 },
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

  useEffect(() => {
    // Initialize with mock data
    setConversations(mockConversations);
    updateTabCounts(mockConversations);
  }, []);

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
      vips: convs.filter(c => !c.isArchived && c.participant.isVIP).length,
      requests: convs.filter(c => !c.isArchived && c.isRequest).length,
      archived: convs.filter(c => c.isArchived).length
    };
    
    // Update inboxTabs counts
    inboxTabs.forEach(tab => {
      tab.count = counts[tab.id] || 0;
    });
  };

  // Filter conversations based on active tab and search
  const getFilteredConversations = () => {
    let filtered = [...conversations];
    
    // Apply tab filter
    switch (activeTab) {
      case 'unread':
        filtered = filtered.filter(c => !c.isArchived && c.unreadCount > 0);
        break;
      case 'vips':
        filtered = filtered.filter(c => !c.isArchived && c.participant.isVIP);
        break;
      case 'requests':
        filtered = filtered.filter(c => !c.isArchived && c.isRequest);
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
  };

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
  const loadMessages = (conversationId) => {
    // Mock messages - in production, fetch from API
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

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return timestamp.toLocaleDateString();
  };

  // Conversation item component
  const ConversationItem = ({ conversation }) => {
    const isSelected = selectedConversation?.id === conversation.id;
    const isBulkSelected = selectedConversations.has(conversation.id);
    
    return (
      <motion.div
        whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
        onClick={() => !bulkActionMode && handleSelectConversation(conversation)}
        className={`
          relative flex items-center p-4 cursor-pointer transition-all
          ${isSelected ? 'bg-purple-50 border-l-4 border-purple-600' : 'hover:bg-gray-50'}
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
              <h3 className="font-semibold text-gray-900 truncate">
                {conversation.participant.name}
              </h3>
              {conversation.isPinned && (
                <MapPinIconSolid className="w-4 h-4 text-gray-400" />
              )}
              {conversation.participant.isVIP && (
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">
                  VIP
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500">
              {formatTimestamp(conversation.lastMessage.timestamp)}
            </span>
          </div>
          
          <p className="text-sm text-gray-600 truncate">
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
    <div className="flex h-screen bg-gray-50">
      {/* Conversation List Sidebar */}
      <AnimatePresence>
        {(!isMobile || showConversationList) && (
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className={`${
              isMobile ? 'absolute inset-y-0 left-0 z-40' : 'relative'
            } w-full md:w-96 bg-white border-r border-gray-200 flex flex-col`}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Messages</h2>
                <div className="flex items-center gap-2">
                  {bulkActionMode ? (
                    <>
                      <button
                        onClick={() => handleBulkAction('read')}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="Mark as read"
                      >
                        <CheckIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleBulkAction('archive')}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
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
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        <XMarkIcon className="w-5 h-5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setBulkActionMode(true)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="Select multiple"
                      >
                        <EllipsisHorizontalIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        <FunnelIcon className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              {/* Search */}
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
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
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
                      activeTab === tab.id
                        ? 'bg-purple-100 text-purple-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
            
            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto">
              {getFilteredConversations().length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <InboxIcon className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="text-sm">No conversations found</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {getFilteredConversations().map(conversation => (
                    <ConversationItem key={conversation.id} conversation={conversation} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Message Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
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
                  
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold">
                        {selectedConversation.participant.name.charAt(0)}
                      </div>
                      {selectedConversation.participant.isOnline && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                      )}
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {selectedConversation.participant.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {selectedConversation.participant.isOnline 
                          ? 'Active now' 
                          : `Last seen ${formatTimestamp(selectedConversation.participant.lastSeen || new Date())}`
                        }
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
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
                  <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                    <EllipsisHorizontalIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {messages.map(message => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === user?.uid ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.sender === user?.uid
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 text-gray-900'
                  }`}>
                    <p className="text-sm">{message.content}</p>
                    <p className={`text-xs mt-1 ${
                      message.sender === user?.uid ? 'text-purple-200' : 'text-gray-500'
                    }`}>
                      {formatTimestamp(message.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                  <PaperClipIcon className="w-5 h-5" />
                </button>
                <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                  <PhotoIcon className="w-5 h-5" />
                </button>
                
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      // Send message logic
                      if (newMessage.trim()) {
                        const message = {
                          id: Date.now().toString(),
                          content: newMessage,
                          sender: user?.uid || 'creator',
                          timestamp: new Date(),
                          isRead: false
                        };
                        setMessages(prev => [...prev, message]);
                        setNewMessage('');
                        
                        // Update conversation's last message
                        setConversations(prev => prev.map(c => 
                          c.id === selectedConversation.id
                            ? {
                                ...c,
                                lastMessage: {
                                  content: newMessage,
                                  timestamp: new Date(),
                                  isRead: true,
                                  sender: user?.uid || 'creator'
                                }
                              }
                            : c
                        ));
                      }
                    }
                  }}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <FaceSmileIcon className="w-5 h-5" />
                </button>
                
                <button
                  onClick={() => {
                    if (newMessage.trim()) {
                      const message = {
                        id: Date.now().toString(),
                        content: newMessage,
                        sender: user?.uid || 'creator',
                        timestamp: new Date(),
                        isRead: false
                      };
                      setMessages(prev => [...prev, message]);
                      setNewMessage('');
                    }
                  }}
                  className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <PaperAirplaneIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* No conversation selected */
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <InboxIcon className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">Select a conversation</h3>
              <p className="text-sm text-gray-500">Choose a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedMessagesPage;