import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChatBubbleLeftRightIcon,
  SparklesIcon,
  BellIcon,
  CurrencyDollarIcon,
  GiftIcon,
  HeartIcon,
  UserPlusIcon,
  StarIcon,
  TrophyIcon,
  BoltIcon,
  FireIcon
} from '@heroicons/react/24/outline';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';
import socketService from '../utils/socket';

const UnifiedStreamPanel = ({ 
  channel, 
  user, 
  creatorId, 
  isCreator = false,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState('all');
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const typingTimeoutRef = useRef(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Socket listeners
  useEffect(() => {
    if (!channel) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    // Join the stream channel
    socket.emit('join-stream', { channel, userId: user?.supabase_id });

    // Chat message listener
    socket.on('stream-message', (data) => {
      const newMessage = {
        id: Date.now() + Math.random(),
        type: 'chat',
        author: data.username,
        authorId: data.userId,
        content: data.message,
        timestamp: new Date(),
        isCreator: data.userId === creatorId,
        mentions: data.mentions || []
      };
      setMessages(prev => [...prev.slice(-100), newMessage]); // Keep last 100 messages
    });

    // Activity listeners
    socket.on('new-tip', (data) => {
      const tipMessage = {
        id: Date.now() + Math.random(),
        type: 'tip',
        author: data.senderName,
        amount: data.amount,
        message: data.message,
        timestamp: new Date(),
        highlighted: true
      };
      setMessages(prev => [...prev.slice(-100), tipMessage]);
    });

    socket.on('new-follower', (data) => {
      const followMessage = {
        id: Date.now() + Math.random(),
        type: 'follow',
        author: data.followerName,
        timestamp: new Date(),
        highlighted: true
      };
      setMessages(prev => [...prev.slice(-100), followMessage]);
    });

    socket.on('gift-sent', (data) => {
      const giftMessage = {
        id: Date.now() + Math.random(),
        type: 'gift',
        author: data.senderName,
        giftName: data.giftName,
        giftEmoji: data.giftEmoji,
        timestamp: new Date(),
        highlighted: true
      };
      setMessages(prev => [...prev.slice(-100), giftMessage]);
    });

    socket.on('user-joined', (data) => {
      const joinMessage = {
        id: Date.now() + Math.random(),
        type: 'join',
        author: data.username,
        timestamp: new Date()
      };
      setMessages(prev => [...prev.slice(-100), joinMessage]);
    });

    socket.on('typing', (data) => {
      if (data.userId !== user?.supabase_id) {
        setTypingUsers(prev => {
          const filtered = prev.filter(u => u.userId !== data.userId);
          return [...filtered, { userId: data.userId, username: data.username }];
        });
        
        // Remove after 3 seconds
        setTimeout(() => {
          setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
        }, 3000);
      }
    });

    return () => {
      socket.emit('leave-stream', { channel, userId: user?.supabase_id });
      socket.off('stream-message');
      socket.off('new-tip');
      socket.off('new-follower');
      socket.off('gift-sent');
      socket.off('user-joined');
      socket.off('typing');
    };
  }, [channel, user, creatorId]);

  // Handle typing indicator
  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      const socket = socketService.getSocket();
      socket?.emit('typing', { 
        channel, 
        userId: user?.supabase_id, 
        username: user?.username 
      });
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
  };

  // Send message
  const sendMessage = async () => {
    if (!inputValue.trim() || !user) return;

    const socket = socketService.getSocket();
    if (!socket) {
      toast.error('Not connected to chat');
      return;
    }

    // Extract mentions
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    while ((match = mentionRegex.exec(inputValue)) !== null) {
      mentions.push(match[1]);
    }

    // Emit message
    socket.emit('stream-message', {
      channel,
      userId: user.supabase_id,
      username: user.username || user.display_name,
      message: inputValue,
      mentions
    });

    // Add to local messages immediately
    const newMessage = {
      id: Date.now(),
      type: 'chat',
      author: user.username || user.display_name,
      authorId: user.supabase_id,
      content: inputValue,
      timestamp: new Date(),
      isCreator: isCreator,
      mentions
    };
    setMessages(prev => [...prev.slice(-100), newMessage]);

    setInputValue('');
    setIsTyping(false);
  };

  // Filter messages based on active tab
  const filteredMessages = messages.filter(msg => {
    if (activeTab === 'all') return true;
    if (activeTab === 'chat') return msg.type === 'chat' || msg.type === 'join';
    if (activeTab === 'tips') return msg.type === 'tip';
    if (activeTab === 'events') return ['follow', 'gift', 'tip', 'join'].includes(msg.type);
    return true;
  });

  // Render message based on type
  const renderMessage = (msg) => {
    switch (msg.type) {
      case 'chat':
        return (
          <div 
            key={msg.id}
            className={`flex items-start gap-2 px-3 py-2 hover:bg-gray-800/30 transition-colors ${
              msg.mentions?.includes(user?.username) ? 'bg-purple-900/20 border-l-2 border-purple-500' : ''
            }`}
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold text-white">
              {msg.author?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`font-semibold text-sm ${msg.isCreator ? 'text-purple-400' : 'text-gray-300'}`}>
                  {msg.author}
                </span>
                {msg.isCreator && (
                  <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">
                    Creator
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  {new Date(msg.timestamp).toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
              <p className="text-sm text-gray-200 break-words">{msg.content}</p>
            </div>
          </div>
        );

      case 'tip':
        return (
          <motion.div
            key={msg.id}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-2 my-2 p-3 bg-gradient-to-r from-yellow-900/40 to-orange-900/40 rounded-lg border border-yellow-500/30"
          >
            <div className="flex items-center gap-2">
              <CurrencyDollarIcon className="w-5 h-5 text-yellow-400" />
              <span className="font-semibold text-yellow-400">{msg.author}</span>
              <span className="text-white">tipped</span>
              <span className="font-bold text-yellow-400">{msg.amount} tokens</span>
            </div>
            {msg.message && (
              <p className="text-sm text-gray-300 mt-1 italic">"{msg.message}"</p>
            )}
          </motion.div>
        );

      case 'follow':
        return (
          <motion.div
            key={msg.id}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="mx-2 my-2 p-2 bg-gradient-to-r from-blue-900/40 to-purple-900/40 rounded-lg border border-blue-500/30"
          >
            <div className="flex items-center gap-2">
              <UserPlusIcon className="w-4 h-4 text-blue-400" />
              <span className="text-sm">
                <span className="font-semibold text-blue-400">{msg.author}</span>
                <span className="text-gray-300"> started following!</span>
              </span>
              <StarIcon className="w-4 h-4 text-yellow-400" />
            </div>
          </motion.div>
        );

      case 'gift':
        return (
          <motion.div
            key={msg.id}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-2 my-2 p-3 bg-gradient-to-r from-pink-900/40 to-purple-900/40 rounded-lg border border-pink-500/30"
          >
            <div className="flex items-center gap-2">
              <GiftIcon className="w-5 h-5 text-pink-400" />
              <span className="font-semibold text-pink-400">{msg.author}</span>
              <span className="text-white">sent</span>
              <span className="text-2xl">{msg.giftEmoji}</span>
              <span className="font-semibold text-pink-400">{msg.giftName}</span>
            </div>
          </motion.div>
        );

      case 'join':
        return (
          <div key={msg.id} className="px-3 py-1 text-xs text-gray-500 italic">
            {msg.author} joined the stream
          </div>
        );

      default:
        return null;
    }
  };

  const tabs = [
    { id: 'all', label: 'All', icon: SparklesIcon, count: messages.length },
    { id: 'chat', label: 'Chat', icon: ChatBubbleLeftRightIcon, count: messages.filter(m => m.type === 'chat').length },
    { id: 'tips', label: 'Tips', icon: CurrencyDollarIcon, count: messages.filter(m => m.type === 'tip').length },
    { id: 'events', label: 'Alerts', icon: BellIcon, count: messages.filter(m => ['follow', 'gift'].includes(m.type)).length }
  ];

  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-800 flex flex-col ${className}`}>
      {/* Header with tabs */}
      <div className="border-b border-gray-800">
        <div className="flex items-center gap-1 px-2 py-2 overflow-x-auto scrollbar-hide">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 text-xs font-medium transition-all flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count > 0 && activeTab !== tab.id && (
                  <span className="px-1 py-0.5 bg-gray-700 text-gray-300 rounded-full text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto min-h-0 max-h-[500px]">
        <AnimatePresence>
          {filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8 text-gray-500">
              <ChatBubbleLeftRightIcon className="w-12 h-12 mb-2" />
              <p className="text-sm">No {activeTab === 'all' ? 'activity' : activeTab} yet</p>
              <p className="text-xs mt-1">Be the first to say hello!</p>
            </div>
          ) : (
            <div className="py-2">
              {filteredMessages.map(renderMessage)}
              <div ref={messagesEndRef} />
            </div>
          )}
        </AnimatePresence>

        {/* Typing indicators */}
        {typingUsers.length > 0 && (
          <div className="px-3 py-2 text-xs text-gray-500 italic">
            {typingUsers.map(u => u.username).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-gray-800 p-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              handleTyping();
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type a message..."
            className="flex-1 bg-gray-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={sendMessage}
            disabled={!inputValue.trim()}
            className={`p-2 rounded-lg transition-all ${
              inputValue.trim()
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
        
        {/* Character count */}
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-gray-500">
            Press Enter to send • @mention users
          </p>
          <p className={`text-xs ${inputValue.length > 200 ? 'text-red-400' : 'text-gray-500'}`}>
            {inputValue.length}/250
          </p>
        </div>
      </div>
    </div>
  );
};

export default UnifiedStreamPanel;