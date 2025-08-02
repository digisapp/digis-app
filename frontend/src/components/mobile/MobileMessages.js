import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMobileUI } from './MobileUIProvider';
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
  MicrophoneIcon
} from '@heroicons/react/24/solid';
import { CheckIcon as CheckOutlineIcon } from '@heroicons/react/24/outline';

const MobileMessages = ({ user, isCreator, onStartVideoCall, onStartVoiceCall, onSendTip }) => {
  const { triggerHaptic, openBottomSheet } = useMobileUI();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showActions, setShowActions] = useState(false);

  // Mock conversations
  useEffect(() => {
    const mockConversations = [
      {
        id: 1,
        user: {
          name: 'Alex Martinez',
          username: 'alexm',
          avatar: null,
          isOnline: true,
          isCreator: true
        },
        lastMessage: 'Hey! Are you available for a call?',
        timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 mins ago
        unread: 2,
        isTyping: false
      },
      {
        id: 2,
        user: {
          name: 'Sophia Chen',
          username: 'sophiac',
          avatar: null,
          isOnline: false,
          isCreator: true
        },
        lastMessage: 'Thanks for the session!',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        unread: 0,
        isTyping: false
      },
      {
        id: 3,
        user: {
          name: 'Emma Thompson',
          username: 'emmat',
          avatar: null,
          isOnline: true,
          isCreator: false
        },
        lastMessage: 'Looking forward to our next session 😊',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
        unread: 0,
        isTyping: false
      }
    ];
    setConversations(mockConversations);
  }, []);

  const formatTimestamp = (date) => {
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      // Today - show time
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const handleSendMessage = () => {
    if (message.trim()) {
      // Send message logic
      triggerHaptic('light');
      setMessage('');
    }
  };

  const ConversationList = () => (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Messages</h1>
          
          {/* Search Bar */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="search"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
            />
          </div>
        </div>
      </div>
      
      {/* Conversations */}
      <div className="pb-24">
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
              .filter(conv => 
                conv.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                conv.user.username.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((conversation) => (
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
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-lg">
                      {conversation.user.name.charAt(0)}
                    </div>
                    {conversation.user.isOnline && (
                      <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {conversation.user.name}
                        {conversation.user.isCreator && (
                          <span className="ml-1 text-purple-600">✓</span>
                        )}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(conversation.timestamp)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600 truncate">
                        {conversation.isTyping ? (
                          <span className="italic">typing...</span>
                        ) : (
                          conversation.lastMessage
                        )}
                      </p>
                      {conversation.unread > 0 && (
                        <span className="ml-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-full">
                          {conversation.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.button>
              ))}
          </div>
        )}
      </div>
    </div>
  );

  const ChatView = () => (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
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
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold">
                {selectedConversation.user.name.charAt(0)}
              </div>
              {selectedConversation.user.isOnline && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
              )}
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900">
                {selectedConversation.user.name}
              </h3>
              <p className="text-xs text-gray-500">
                {selectedConversation.user.isOnline ? 'Active now' : 'Offline'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => {
              onStartVoiceCall?.();
              triggerHaptic('medium');
            }}
            className="p-2 text-gray-600"
            whileTap={{ scale: 0.9 }}
          >
            <PhoneIcon className="w-5 h-5" />
          </motion.button>
          <motion.button
            onClick={() => {
              onStartVideoCall?.();
              triggerHaptic('medium');
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
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50">
        {/* Mock messages */}
        <div className="flex justify-start">
          <div className="max-w-[70%] bg-white rounded-2xl rounded-tl-sm px-4 py-2 shadow-sm">
            <p className="text-gray-900">Hey! Are you available for a call?</p>
            <p className="text-xs text-gray-500 mt-1">2:30 PM</p>
          </div>
        </div>
        
        <div className="flex justify-end">
          <div className="max-w-[70%] bg-purple-600 text-white rounded-2xl rounded-tr-sm px-4 py-2">
            <p>Sure! I'm free now. Let me know when you're ready.</p>
            <div className="flex items-center justify-end gap-1 mt-1">
              <p className="text-xs opacity-90">2:32 PM</p>
              <CheckIcon className="w-4 h-4" />
            </div>
          </div>
        </div>
        
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
      </div>
      
      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 pb-safe">
        <div className="flex items-end gap-2">
          <motion.button
            className="p-2 text-gray-600"
            whileTap={{ scale: 0.9 }}
          >
            <PlusIcon className="w-6 h-6" />
          </motion.button>
          
          <div className="flex-1 relative">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onFocus={() => setIsTyping(true)}
              onBlur={() => setIsTyping(false)}
              placeholder="Type a message..."
              className="w-full px-4 py-3 bg-gray-100 rounded-full text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500">
              <FaceSmileIcon className="w-5 h-5" />
            </button>
          </div>
          
          <motion.button
            onClick={handleSendMessage}
            className={`p-3 rounded-full transition-all ${
              message.trim() 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-200 text-gray-400'
            }`}
            whileTap={{ scale: 0.9 }}
            disabled={!message.trim()}
          >
            {message.trim() ? (
              <PaperAirplaneIcon className="w-5 h-5" />
            ) : (
              <MicrophoneIcon className="w-5 h-5" />
            )}
          </motion.button>
        </div>
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
                onSendTip?.(selectedConversation.user);
                setShowActions(false);
              }}
              className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Send Tip
            </button>
            <button className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 rounded-lg">
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

  return selectedConversation ? <ChatView /> : <ConversationList />;
};

export default MobileMessages;