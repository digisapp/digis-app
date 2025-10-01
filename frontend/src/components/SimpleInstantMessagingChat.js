import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PaperAirplaneIcon,
  FaceSmileIcon,
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const SimpleInstantMessagingChat = ({ 
  user, 
  chatId,
  recipient,
  onClose
}) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const quickEmojis = ['😊', '😂', '❤️', '👍', '🎉', '🔥', '💎', '⭐'];

  // Mock messages for demonstration
  useEffect(() => {
    if (chatId && recipient) {
      const mockMessages = [
        {
          id: '1',
          content: 'Hey! How\'s your day going?',
          sender_id: recipient.id,
          sender_name: recipient.name,
          created_at: new Date(Date.now() - 1800000).toISOString(),
          is_own: false
        },
        {
          id: '2',
          content: 'It\'s going great! Thanks for asking 😊',
          sender_id: user?.uid || 'current_user',
          sender_name: 'You',
          created_at: new Date(Date.now() - 1500000).toISOString(),
          is_own: true
        },
        {
          id: '3',
          content: 'I loved your last stream! When\'s the next one?',
          sender_id: recipient.id,
          sender_name: recipient.name,
          created_at: new Date(Date.now() - 900000).toISOString(),
          is_own: false
        },
        {
          id: '4',
          content: 'Thank you so much! I\'m planning to go live tomorrow evening 🎉',
          sender_id: user?.uid || 'current_user',
          sender_name: 'You',
          created_at: new Date(Date.now() - 600000).toISOString(),
          is_own: true
        }
      ];
      
      setMessages(mockMessages);
    }
  }, [chatId, recipient, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = () => {
    if (!newMessage.trim()) return;

    const message = {
      id: Date.now().toString(),
      content: newMessage.trim(),
      sender_id: user?.uid || 'current_user',
      sender_name: 'You',
      created_at: new Date().toISOString(),
      is_own: true
    };

    setMessages(prev => [...prev, message]);
    setNewMessage('');
    setShowEmojiPicker(false);
    
    // Simulate typing indicator for the other user
    setTimeout(() => {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        
        // Add a response from the other user
        const response = {
          id: (Date.now() + 1).toString(),
          content: getRandomResponse(),
          sender_id: recipient?.id || 'other_user',
          sender_name: recipient?.name || 'Other User',
          created_at: new Date().toISOString(),
          is_own: false
        };
        
        setMessages(prev => [...prev, response]);
      }, 2000);
    }, 500);
  };

  const getRandomResponse = () => {
    const responses = [
      "That sounds awesome! 🎉",
      "I can't wait! ⭐",
      "Thanks for sharing that with me!",
      "You're the best! ❤️",
      "Looking forward to it! 😊",
      "That's really interesting!",
      "Cool! Let me know how it goes 👍"
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const addEmojiToMessage = (emoji) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  if (!recipient) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <ChatBubbleLeftRightIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-medium mb-2">No chat selected</h3>
          <p>Select a conversation to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      className="flex flex-col h-full bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Chat Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold">
              {recipient.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <h3 className="font-bold text-lg">{recipient.name}</h3>
              <p className="text-sm text-white/80">🟢 Online</p>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          )}
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
              <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-sm ${
                message.is_own
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}>
                {!message.is_own && (
                  <div className="text-xs font-medium text-purple-600 mb-1">
                    {message.sender_name}
                  </div>
                )}
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

        {/* Typing indicator */}
        {isTyping && (
          <motion.div
            className="flex justify-start"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="bg-gray-100 px-4 py-3 rounded-2xl">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </motion.div>
        )}

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
                  className="text-2xl p-2 hover:bg-gray-200 rounded-lg transition-colors"
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
              placeholder={`Message ${recipient.name}...`}
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
    </motion.div>
  );
};

export default SimpleInstantMessagingChat;