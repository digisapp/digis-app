import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  FaceSmileIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import AgoraChat from 'agora-chat';
import toast from 'react-hot-toast';
import DOMPurify from 'dompurify';
import { supabase } from '../utils/supabase';

const RealMessagesInbox = ({ user }) => {
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);

  const chatClient = useRef(null);
  const messagesEndRef = useRef(null);

  // Initialize Agora Chat
  const initializeChat = useCallback(async () => {
    if (!user || chatClient.current) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseToken = session?.access_token;
      
      // Get Agora Chat token from backend
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/agora/chat/token`, {
        headers: {
          Authorization: `Bearer ${supabaseToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get chat token');
      }

      const { chatToken } = await response.json();

      // Initialize Agora Chat client
      chatClient.current = new AgoraChat.connection({
        appkey: import.meta.env.VITE_AGORA_APP_ID,
      });

      // Login to Agora Chat
      await chatClient.current.open({
        user: user.uid,
        accessToken: chatToken,
      });

      setIsConnected(true);
      
      // Set up event listeners
      chatClient.current.addEventHandler('connection', {
        onConnected: () => {
          console.log('✅ Agora Chat connected');
          setIsConnected(true);
        },
        onDisconnected: () => {
          console.log('❌ Agora Chat disconnected');
          setIsConnected(false);
        },
      });

      chatClient.current.addEventHandler('message', {
        onTextMessage: (message) => {
          console.log('📨 New message received:', message);
          handleNewMessage(message);
        },
      });

      // Load conversations
      await loadConversations();

    } catch (error) {
      console.error('❌ Agora Chat initialization error:', error);
      toast.error('Failed to connect to chat system');
    }
  }, [user]);

  // Load conversation list
  const loadConversations = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseToken = session?.access_token;
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/chat/conversations`, {
        headers: {
          Authorization: `Bearer ${supabaseToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
        
        // Calculate total unread count
        const totalUnread = data.conversations?.reduce((sum, conv) => sum + (conv.unread_count || 0), 0) || 0;
        setUnreadCount(totalUnread);
      }
    } catch (error) {
      console.error('❌ Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load messages for a conversation
  const loadMessages = useCallback(async (conversationId) => {
    if (!user || !conversationId) return;

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseToken = session?.access_token;
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/chat/conversations/${conversationId}/messages`, {
        headers: {
          Authorization: `Bearer ${supabaseToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        
        // Mark conversation as read
        await markConversationAsRead(conversationId);
      }
    } catch (error) {
      console.error('❌ Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Send message
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedConversation || !chatClient.current) return;

    try {
      const messageText = newMessage.trim();
      setNewMessage('');

      // Send via Agora Chat
      const message = AgoraChat.message.create({
        type: 'txt',
        to: selectedConversation.other_user_id,
        msg: messageText,
        chatType: 'singleChat',
      });

      await chatClient.current.send(message);

      // Add to local messages immediately for instant feedback
      const newMsg = {
        id: Date.now(),
        content: messageText,
        sender_id: user.uid,
        created_at: new Date().toISOString(),
        is_own: true,
      };

      setMessages(prev => [...prev, newMsg]);
      scrollToBottom();

      // Update backend
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseToken = session?.access_token;
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/chat/conversations/${selectedConversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseToken}`,
        },
        body: JSON.stringify({
          content: messageText,
          type: 'text',
        }),
      });

    } catch (error) {
      console.error('❌ Failed to send message:', error);
      toast.error('Failed to send message');
    }
  }, [newMessage, selectedConversation, user]);

  // Handle new incoming message
  const handleNewMessage = useCallback((message) => {
    if (selectedConversation && message.from === selectedConversation.other_user_id) {
      const newMsg = {
        id: message.id,
        content: message.msg,
        sender_id: message.from,
        created_at: new Date().toISOString(),
        is_own: false,
      };
      setMessages(prev => [...prev, newMsg]);
      scrollToBottom();
    }
    
    // Refresh conversations to update unread counts
    loadConversations();
  }, [selectedConversation, loadConversations]);

  // Mark conversation as read
  const markConversationAsRead = useCallback(async (conversationId) => {
    if (!user) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseToken = session?.access_token;
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/chat/conversations/${conversationId}/read`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseToken}`,
        },
      });
      
      // Update local unread count
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, unread_count: 0 }
          : conv
      ));
      
      // Recalculate total unread count
      const totalUnread = conversations.reduce((sum, conv) => 
        sum + (conv.id === conversationId ? 0 : conv.unread_count || 0), 0
      );
      setUnreadCount(totalUnread);
      
    } catch (error) {
      console.error('❌ Failed to mark conversation as read:', error);
    }
  }, [user, conversations]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Format message time
  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString();
    }
  };

  // Filter conversations based on search
  const filteredConversations = conversations.filter(conv =>
    conv.other_user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.last_message?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Initialize chat when component mounts
  useEffect(() => {
    if (user && isInboxOpen) {
      initializeChat();
    }
  }, [user, isInboxOpen, initializeChat]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle conversation selection
  const handleConversationClick = (conversation) => {
    setSelectedConversation(conversation);
    loadMessages(conversation.id);
    // Hide sidebar on mobile when selecting a conversation
    if (window.innerWidth < 640) {
      setShowSidebar(false);
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Messages Button */}
      <motion.button
        onClick={() => setIsInboxOpen(true)}
        className="relative px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium text-sm hover:from-purple-700 hover:to-blue-700 transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-xl"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <ChatBubbleLeftRightIcon className="w-5 h-5" />
        <span className="hidden sm:inline">Messages</span>
        {unreadCount > 0 && (
          <motion.span
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full text-xs w-6 h-6 flex items-center justify-center font-bold"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.span>
        )}
      </motion.button>

      {/* Messages Modal */}
      <AnimatePresence>
        {isInboxOpen && (
          <motion.div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsInboxOpen(false)}
          >
            <motion.div 
              className="bg-white rounded-xl sm:rounded-2xl w-full max-w-5xl h-[95vh] sm:h-[85vh] max-h-[800px] flex overflow-hidden shadow-2xl mx-auto my-auto relative"
              initial={{ opacity: 0, scale: 0.9, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 50 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
            >
            {/* Conversations Sidebar */}
            <div className={`${
              showSidebar ? 'block' : 'hidden'
            } sm:block w-full sm:w-80 md:w-96 sm:border-r border-gray-200 flex flex-col bg-gray-50 ${
              showSidebar ? 'absolute sm:relative z-10 h-full' : ''
            }`}>
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <ChatBubbleLeftRightIcon className="w-6 h-6" />
                    <h2 className="text-xl font-bold">Messages</h2>
                  </div>
                  <motion.button
                    onClick={() => setIsInboxOpen(false)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </motion.button>
                </div>
                
                {/* Search */}
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/60" />
                  <input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50"
                  />
                </div>
              </div>

              {/* Conversations List */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading conversations...</p>
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="p-8 text-center text-gray-600">
                    <ChatBubbleLeftRightIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium mb-2">No conversations yet</p>
                    <p className="text-sm text-gray-500">Start chatting with creators!</p>
                  </div>
                ) : (
                  <div className="space-y-1 p-2">
                    {filteredConversations.map((conversation) => (
                      <motion.div
                        key={conversation.id}
                        onClick={() => handleConversationClick(conversation)}
                        className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${
                          selectedConversation?.id === conversation.id 
                            ? 'bg-purple-100 border-l-4 border-purple-500' 
                            : 'hover:bg-gray-100'
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          <div className="relative">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center text-white font-bold">
                              {conversation.other_user_avatar ? (
                                <img 
                                  src={conversation.other_user_avatar} 
                                  alt={conversation.other_user_name}
                                  className="w-full h-full rounded-full object-cover"
                                />
                              ) : (
                                conversation.other_user_name?.[0]?.toUpperCase() || '?'
                              )}
                            </div>
                            {conversation.is_online && (
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-gray-900 truncate">
                                {conversation.other_user_name || 'Unknown User'}
                              </h3>
                              <span className="text-xs text-gray-500">
                                {formatMessageTime(conversation.last_message_time)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 truncate mt-1">
                              {conversation.last_message || 'No messages yet'}
                            </p>
                          </div>

                          {/* Unread badge */}
                          {conversation.unread_count > 0 && (
                            <motion.span
                              className="bg-red-500 text-white rounded-full text-xs min-w-[20px] h-5 flex items-center justify-center font-bold"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            >
                              {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                            </motion.span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col">
              {selectedConversation ? (
                <>
                  {/* Chat Header */}
                  <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 sm:p-6 border-b">
                    <div className="flex items-center gap-4">
                      {/* Back button for mobile */}
                      <motion.button
                        onClick={() => {
                          setShowSidebar(true);
                          setSelectedConversation(null);
                        }}
                        className="sm:hidden p-2 hover:bg-white/20 rounded-lg transition-colors"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        ←
                      </motion.button>
                      <div className="relative">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center font-bold">
                          {selectedConversation.other_user_avatar ? (
                            <img 
                              src={selectedConversation.other_user_avatar} 
                              alt={selectedConversation.other_user_name}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            selectedConversation.other_user_name?.[0]?.toUpperCase() || '?'
                          )}
                        </div>
                        {selectedConversation.is_online && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white"></div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">
                          {selectedConversation.other_user_name}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-white/80">
                          <div className={`w-2 h-2 rounded-full ${selectedConversation.is_online ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                          <span>{selectedConversation.is_online ? 'Online' : 'Offline'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 bg-gray-50">
                    <AnimatePresence>
                      {messages.map((message, index) => (
                        <motion.div
                          key={message.id}
                          className={`flex ${message.is_own ? 'justify-end' : 'justify-start'}`}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                        >
                          <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-sm ${
                            message.is_own 
                              ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' 
                              : 'bg-white text-gray-900 border border-gray-200'
                          }`}>
                            <div className="break-words">{message.content}</div>
                            <div className={`text-xs mt-2 ${
                              message.is_own ? 'text-white/70' : 'text-gray-500'
                            }`}>
                              {formatMessageTime(message.created_at)}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="p-3 sm:p-6 bg-white border-t border-gray-200">
                    <div className="flex items-end gap-3">
                      {/* Emoji button */}
                      <motion.button
                        className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <FaceSmileIcon className="w-6 h-6" />
                      </motion.button>

                      {/* Message input */}
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Type a message..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              sendMessage();
                            }
                          }}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                        />
                      </div>

                      {/* Send button */}
                      <motion.button
                        onClick={sendMessage}
                        disabled={!newMessage.trim()}
                        className={`p-3 rounded-2xl font-medium transition-all ${
                          newMessage.trim() 
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700' 
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                        whileHover={{ scale: newMessage.trim() ? 1.05 : 1 }}
                        whileTap={{ scale: newMessage.trim() ? 0.95 : 1 }}
                      >
                        <PaperAirplaneIcon className="w-5 h-5" />
                      </motion.button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col bg-gray-50">
                  {/* Mobile header when no conversation selected */}
                  <div className="sm:hidden bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4">
                    <div className="flex items-center gap-3">
                      <motion.button
                        onClick={() => setShowSidebar(true)}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        ☰
                      </motion.button>
                      <h2 className="text-lg font-semibold">Messages</h2>
                    </div>
                  </div>
                  
                  <div className="flex-1 flex items-center justify-center flex-col text-gray-500 p-8">
                    <ChatBubbleLeftRightIcon className="w-20 h-20 mb-6 text-gray-300" />
                    <h3 className="text-xl font-semibold mb-2 text-gray-700">Select a conversation</h3>
                    <p className="text-gray-500 text-center">Choose a conversation from the sidebar to start messaging</p>
                    <motion.button
                      onClick={() => setShowSidebar(true)}
                      className="sm:hidden mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      View Conversations
                    </motion.button>
                  </div>
                </div>
              )}
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default RealMessagesInbox;