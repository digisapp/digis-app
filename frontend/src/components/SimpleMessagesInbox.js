import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PaperAirplaneIcon,
  FaceSmileIcon,
  XMarkIcon,
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { useApp } from '../contexts/AppContext';

const SimpleMessagesInbox = ({ searchQuery, onChatSelect }) => {
  const { state } = useApp();
  const { user } = state;
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef(null);

  // Mock conversations for demonstration
  useEffect(() => {
    const mockConversations = [
      {
        id: '1',
        other_user_name: 'Sarah Creator',
        other_user_avatar: null,
        last_message: 'Thanks for the session! Looking forward to our next chat 😊',
        last_message_time: new Date(Date.now() - 300000).toISOString(), // 5 mins ago
        unread_count: 2,
        is_online: true,
        other_user_id: 'creator_1'
      },
      {
        id: '2',
        other_user_name: 'Alex Fan',
        other_user_avatar: null,
        last_message: 'When will you be going live next?',
        last_message_time: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        unread_count: 0,
        is_online: false,
        other_user_id: 'fan_1'
      },
      {
        id: '3',
        other_user_name: 'Maya Artist',
        other_user_avatar: null,
        last_message: 'Your content is amazing! Keep it up 🎨',
        last_message_time: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
        unread_count: 1,
        is_online: true,
        other_user_id: 'creator_2'
      }
    ];
    
    setConversations(mockConversations);
  }, []);

  // Mock messages for selected conversation
  useEffect(() => {
    if (selectedConversation) {
      const mockMessages = [
        {
          id: '1',
          content: 'Hey! How are you doing?',
          sender_id: selectedConversation.other_user_id,
          created_at: new Date(Date.now() - 1800000).toISOString(), // 30 mins ago
          is_own: false,
          sender_name: selectedConversation.other_user_name
        },
        {
          id: '2',
          content: 'I\'m doing great! Thanks for asking. How about you?',
          sender_id: user?.uid || 'current_user',
          created_at: new Date(Date.now() - 1500000).toISOString(), // 25 mins ago
          is_own: true,
          sender_name: 'You'
        },
        {
          id: '3',
          content: selectedConversation.last_message,
          sender_id: selectedConversation.other_user_id,
          created_at: selectedConversation.last_message_time,
          is_own: false,
          sender_name: selectedConversation.other_user_name
        }
      ];
      
      setMessages(mockMessages);
      
      // Mark as read
      setConversations(prev => prev.map(conv => 
        conv.id === selectedConversation.id 
          ? { ...conv, unread_count: 0 }
          : conv
      ));
    }
  }, [selectedConversation, user]);

  const quickEmojis = ['😊', '😂', '❤️', '👍', '🎉', '🔥', '💎', '⭐', '👏', '🙌'];

  const sendMessage = () => {
    if (!newMessage.trim() || !selectedConversation) return;

    const message = {
      id: Date.now().toString(),
      content: newMessage.trim(),
      sender_id: user?.uid || 'current_user',
      created_at: new Date().toISOString(),
      is_own: true,
      sender_name: 'You'
    };

    setMessages(prev => [...prev, message]);
    
    // Update conversation with new last message
    setConversations(prev => prev.map(conv => 
      conv.id === selectedConversation.id 
        ? { 
            ...conv, 
            last_message: newMessage.trim(),
            last_message_time: new Date().toISOString()
          }
        : conv
    ));

    setNewMessage('');
    setShowEmojiPicker(false);
    scrollToBottom();
  };

  const handleConversationClick = (conversation) => {
    setSelectedConversation(conversation);
    onChatSelect?.(conversation);
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const formatTime = (timestamp) => {
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

  const addEmojiToMessage = (emoji) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const filteredConversations = conversations.filter(conv =>
    conv.other_user_name?.toLowerCase().includes((searchQuery || '').toLowerCase()) ||
    conv.last_message?.toLowerCase().includes((searchQuery || '').toLowerCase())
  );

  return (
    <div className="flex h-full bg-white rounded-xl overflow-hidden border border-gray-200">
      {/* Conversations Sidebar */}
      <div className="w-1/3 border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <ChatBubbleLeftRightIcon className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-900">Messages</h2>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              Loading conversations...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <ChatBubbleLeftRightIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-lg font-medium mb-1">No conversations</p>
              <p className="text-sm">Start chatting with creators!</p>
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => handleConversationClick(conversation)}
                className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${
                  selectedConversation?.id === conversation.id
                    ? 'bg-purple-50 border-purple-200'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center text-white font-bold">
                      {conversation.other_user_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    {conversation.is_online && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium text-gray-900 truncate">
                        {conversation.other_user_name}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {formatTime(conversation.last_message_time)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 truncate">
                      {conversation.last_message}
                    </p>
                  </div>

                  {/* Unread badge */}
                  {conversation.unread_count > 0 && (
                    <div className="w-5 h-5 bg-purple-600 text-white text-xs rounded-full flex items-center justify-center">
                      {conversation.unread_count}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center text-white font-bold">
                  {selectedConversation.other_user_name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">
                    {selectedConversation.other_user_name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {selectedConversation.is_online ? '🟢 Online' : '⚫ Offline'}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    className={`flex ${message.is_own ? 'justify-end' : 'justify-start'}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                      message.is_own
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      <p className="break-words">{message.content}</p>
                      <div className={`text-xs mt-1 ${
                        message.is_own ? 'text-white/70' : 'text-gray-500'
                      }`}>
                        {formatTime(message.created_at)}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* Emoji Picker */}
            <AnimatePresence>
              {showEmojiPicker && (
                <motion.div
                  className="p-3 bg-gray-50 border-t border-gray-200"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="flex flex-wrap gap-2">
                    {quickEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => addEmojiToMessage(emoji)}
                        className="text-2xl p-1 hover:bg-gray-200 rounded transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-end gap-3">
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <FaceSmileIcon className="w-6 h-6" />
                </button>

                <div className="flex-1">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                </div>

                <motion.button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="p-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  whileHover={{ scale: newMessage.trim() ? 1.05 : 1 }}
                  whileTap={{ scale: newMessage.trim() ? 0.95 : 1 }}
                >
                  <PaperAirplaneIcon className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <ChatBubbleLeftRightIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-xl font-medium mb-2">Select a conversation</h3>
              <p>Choose a conversation from the sidebar to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleMessagesInbox;