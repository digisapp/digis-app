import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PropTypes from 'prop-types';
import {
  PaperAirplaneIcon,
  GiftIcon,
  CurrencyDollarIcon,
  AtSymbolIcon,
  ShieldCheckIcon,
  TrashIcon,
  NoSymbolIcon,
  ExclamationTriangleIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { HeartIcon, SparklesIcon } from '@heroicons/react/24/solid';
import Button from './ui/Button';
import Tooltip from './ui/Tooltip';
import TypingIndicator from './ui/TypingIndicator';
import DualBadgeDisplay from './DualBadgeDisplay';
import MentionAutocomplete from './MentionAutocomplete';
import { useTyping } from '../hooks/useSocket';
import { getAuthToken } from '../utils/auth-helpers';
import socketService from '../utils/socket';
import { 
  parseMentions, 
  getCurrentMention, 
  replaceMention, 
  extractMentions,
  isUserMentioned 
} from '../utils/mentionUtils';

const EnhancedStreamChat = ({
  user,
  channel,
  creatorId,
  isCreator,
  onMessageSent,
  onGiftSent,
  onTipSent,
  className = ''
}) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [subscribers, setSubscribers] = useState(new Set());
  const [vipUsers, setVipUsers] = useState(new Set(['VIPUser1']));
  const [moderators, setModerators] = useState(new Set(['mod_user_1']));
  const [bannedUsers, setBannedUsers] = useState(new Set());
  const [showUserMenu, setShowUserMenu] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [lastMessageTime, setLastMessageTime] = useState(0);
  const [activePoll, setActivePoll] = useState(null);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ bottom: 0, left: 0 });
  const [cursorPosition, setCursorPosition] = useState(0);
  
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);
  
  // Use typing hook
  const { typingUsers, startTyping, stopTyping } = useTyping(channel);

  // Load chat history and setup real-time listeners
  useEffect(() => {
    if (!channel) return;
    
    const loadChatHistory = async () => {
      try {
        const authToken = await getAuthToken();
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/stream-chat/history/${channel}?limit=50`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          const formattedMessages = data.messages.map(msg => ({
            id: msg.id,
            user: msg.display_name,
            message: msg.message,
            timestamp: new Date(msg.created_at).getTime(),
            userColor: msg.is_creator ? '#a855f7' : '#9ca3af',
            userId: msg.user_id
          }));
          setMessages(formattedMessages);
        }
      } catch (error) {
        console.error('Error loading chat history:', error);
      }
    };
    
    loadChatHistory();
    
    // Socket listeners
    socketService.emit('join-stream', { channel });
    
    socketService.on('chat-message', (data) => {
      setMessages(prev => [...prev, data]);
    });
    
    socketService.on('message-deleted', (data) => {
      setMessages(prev => prev.filter(msg => msg.id !== data.messageId));
    });
    
    socketService.on('message-pinned', (data) => {
      setPinnedMessage(data.message);
    });
    
    socketService.on('message-unpinned', () => {
      setPinnedMessage(null);
    });
    
    socketService.on('user-moderated', (data) => {
      if (data.action === 'ban') {
        setBannedUsers(prev => new Set([...prev, data.userId]));
      }
    });
    
    return () => {
      socketService.emit('leave-stream', { channel });
      socketService.off('chat-message');
      socketService.off('message-deleted');
      socketService.off('message-pinned');
      socketService.off('message-unpinned');
      socketService.off('user-moderated');
    };
  }, [channel]);

  // Auto scroll to bottom
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Handle scroll to detect if user scrolled up
  const handleScroll = useCallback(() => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScroll(isAtBottom);
    }
  }, []);

  // Send message handler
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim()) return;

    // Extract mentions from the message
    const mentions = extractMentions(inputValue);

    try {
      const authToken = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/stream-chat/message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({
            channel,
            message: inputValue,
            replyTo: replyingTo?.id,
            mentions: mentions
          })
        }
      );
      
      if (response.ok) {
        setInputValue('');
        setReplyingTo(null);
        setLastMessageTime(Date.now());
        
        if (onMessageSent) {
          onMessageSent({ message: inputValue });
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }, [inputValue, channel, replyingTo, onMessageSent]);

  // Get user role and color
  const getUserRole = (username) => {
    if (username === user?.displayName && isCreator) return { role: 'Creator', color: '#a855f7' };
    if (moderators.has(username)) return { role: 'Mod', color: '#3b82f6' };
    if (vipUsers.has(username)) return { role: 'VIP', color: '#eab308' };
    if (subscribers.has(username)) return { role: 'Sub', color: '#10b981' };
    return { role: '', color: '#9ca3af' };
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };
  
  // Pin message handler
  const handlePinMessage = useCallback(async (message) => {
    if (!isCreator) return;
    
    try {
      const authToken = await getAuthToken();
      await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/stream-chat/pin`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            channel,
            messageId: message.id,
            action: pinnedMessage?.id === message.id ? 'unpin' : 'pin'
          })
        }
      );
    } catch (error) {
      console.error('Error pinning message:', error);
    }
  }, [isCreator, channel, pinnedMessage]);
  
  // Ban/timeout user handler
  const handleBanUser = useCallback(async (userId, action = 'ban', duration = null) => {
    if (!isCreator) return;
    
    try {
      const authToken = await getAuthToken();
      await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/stream-chat/moderate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            channel,
            targetUserId: userId,
            action,
            duration
          })
        }
      );
    } catch (error) {
      console.error('Error moderating user:', error);
    }
  }, [isCreator, channel]);
  
  // Delete message handler
  const handleDeleteMessage = useCallback(async (messageId) => {
    try {
      const authToken = await getAuthToken();
      await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/stream-chat/message/${messageId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  }, []);

  // Handle input change for mention detection
  const handleInputChange = useCallback((e) => {
    const newValue = e.target.value;
    const newCursorPos = e.target.selectionStart;
    
    if (newValue.length <= 500) {
      setInputValue(newValue);
      setCursorPosition(newCursorPos);
      
      // Check for @ mention
      const mention = getCurrentMention(newValue, newCursorPos);
      
      if (mention) {
        setMentionSearch(mention.partialUsername);
        setShowMentionDropdown(true);
        
        // Calculate dropdown position
        if (inputRef.current) {
          const inputRect = inputRef.current.getBoundingClientRect();
          setMentionPosition({
            bottom: 50, // Position above input
            left: 0
          });
        }
      } else {
        setShowMentionDropdown(false);
        setMentionSearch('');
      }
      
      // Handle typing indicator
      if (newValue.length > 0) {
        startTyping();
      } else {
        stopTyping();
      }
    }
  }, [startTyping, stopTyping]);

  // Handle mention selection
  const handleMentionSelect = useCallback((user) => {
    const mention = getCurrentMention(inputValue, cursorPosition);
    
    if (mention) {
      const newText = replaceMention(
        inputValue,
        mention.startIndex,
        mention.endIndex,
        user.username
      );
      setInputValue(newText);
      
      // Set cursor position after the mention
      setTimeout(() => {
        if (inputRef.current) {
          const newCursorPos = mention.startIndex + user.username.length + 2; // +2 for @ and space
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
          inputRef.current.focus();
        }
      }, 0);
    }
    
    setShowMentionDropdown(false);
    setMentionSearch('');
  }, [inputValue, cursorPosition]);

  return (
    <div className={`flex flex-col h-full bg-gradient-to-b from-gray-900 to-gray-950 rounded-2xl overflow-hidden shadow-2xl border border-purple-500/20 ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-sm border-b border-purple-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HeartIcon className="w-5 h-5 text-pink-500 animate-pulse" />
            <h3 className="text-white font-bold text-lg tracking-wide">Stream Chat</h3>
            <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">
              {messages.length} messages
            </span>
          </div>
          
          {/* User Role Legend - Simple hover display */}
          <div className="relative group">
            <button 
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              aria-label="User role colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <defs>
                  <linearGradient id="colorWheel" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="25%" stopColor="#3b82f6" />
                    <stop offset="50%" stopColor="#eab308" />
                    <stop offset="75%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#9ca3af" />
                  </linearGradient>
                </defs>
                <circle cx="12" cy="12" r="10" stroke="url(#colorWheel)" strokeWidth="2" />
                <circle cx="12" cy="6" r="2" fill="#a855f7" />
                <circle cx="18" cy="9" r="2" fill="#3b82f6" />
                <circle cx="18" cy="15" r="2" fill="#eab308" />
                <circle cx="12" cy="18" r="2" fill="#10b981" />
                <circle cx="6" cy="15" r="2" fill="#9ca3af" />
              </svg>
            </button>
            
            {/* Tooltip on hover */}
            <div className="absolute top-full mt-2 right-0 bg-gray-800 rounded-lg shadow-xl p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 min-w-[180px] pointer-events-none">
              <div className="text-xs font-semibold text-gray-400 mb-2">USER ROLES</div>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-purple-500">●</span>
                  <span className="text-gray-200">Creator</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-500">●</span>
                  <span className="text-gray-200">Moderator</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-yellow-500">●</span>
                  <span className="text-gray-200">VIP</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-500">●</span>
                  <span className="text-gray-200">Subscriber</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">●</span>
                  <span className="text-gray-200">Viewer</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div 
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-0.5 scrollbar-thin scrollbar-thumb-purple-600/50 scrollbar-track-gray-800/50"
      >
        {messages.map((msg) => {
          const { role, color } = getUserRole(msg.user);
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, x: -20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="group relative hover:bg-gradient-to-r hover:from-purple-500/10 hover:to-transparent rounded-lg px-3 py-2 -mx-1 transition-all duration-200"
            >
              <div className="flex items-start gap-2">
                <span className="text-xs text-gray-500 mt-1">{formatTime(msg.timestamp)}</span>
                <div className="flex-1">
                  <div className="inline-flex items-center gap-2">
                    <span className="font-semibold" style={{ color }}>
                      {msg.user}
                      {role && (
                        <span className="ml-1 text-xs opacity-75">
                          [{role}]
                        </span>
                      )}
                    </span>
                    {/* Display dual badges for non-creator users */}
                    {msg.userId && msg.userId !== creatorId && creatorId && (
                      <DualBadgeDisplay
                        userId={msg.userId}
                        creatorId={creatorId}
                        size="small"
                        showTooltip={true}
                      />
                    )}
                  </div>
                  <span className="text-gray-300 ml-2">
                    {parseMentions(msg.message, user?.username || user?.displayName)}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Auto-scroll indicator */}
      <AnimatePresence>
        {!autoScroll && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={() => {
              setAutoScroll(true);
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="absolute bottom-20 right-4 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-full text-sm shadow-lg"
          >
            New messages ↓
          </motion.button>
        )}
      </AnimatePresence>

      {/* Typing Indicator */}
      <AnimatePresence>
        {typingUsers.size > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 overflow-hidden"
          >
            <TypingIndicator 
              users={Array.from(typingUsers).map(userId => `User ${userId.slice(0, 6)}`)}
              className="py-2"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="p-4 border-t border-purple-500/20 bg-gradient-to-r from-gray-900/50 to-gray-950/50 relative">
        {/* Mention Autocomplete Dropdown */}
        {showMentionDropdown && (
          <MentionAutocomplete
            searchTerm={mentionSearch}
            onSelect={handleMentionSelect}
            onClose={() => {
              setShowMentionDropdown(false);
              setMentionSearch('');
            }}
            position={mentionPosition}
            channelId={channel}
          />
        )}
        
        <div className="flex items-center justify-end mb-2">
          <div className={`text-xs transition-colors ${
            inputValue.length > 400 ? 'text-red-400' : 'text-gray-500'
          }`}>
            {inputValue.length}/500
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (showMentionDropdown) {
                // Let MentionAutocomplete handle arrow keys and enter
                if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab'].includes(e.key)) {
                  return;
                }
              }
              
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
                stopTyping();
                setShowMentionDropdown(false);
              }
              
              if (e.key === 'Escape') {
                setShowMentionDropdown(false);
              }
            }}
            onBlur={() => {
              stopTyping();
              // Delay closing dropdown to allow click on mention
              setTimeout(() => setShowMentionDropdown(false), 200);
            }}
            placeholder="Type your message... Use @ to mention someone"
            className="flex-1 bg-gradient-to-r from-gray-800/50 to-gray-900/50 text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-gray-800/70 transition-all duration-200 placeholder:text-gray-500"
          />

          {/* Action Buttons - Only show for viewers */}
          {!isCreator && (
            <>
              <Tooltip content="Send gift">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onGiftSent && onGiftSent({ value: 100, giftName: 'Heart' })}
                  className="p-3 bg-gradient-to-br from-pink-500/20 to-purple-500/20 hover:from-pink-500/30 hover:to-purple-500/30 text-pink-400 hover:text-pink-300 rounded-xl transition-all"
                >
                  <GiftIcon className="w-5 h-5" />
                </motion.button>
              </Tooltip>

              <Tooltip content="Send tip">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onTipSent && onTipSent({ amount: 50 })}
                  className="p-3 bg-gradient-to-br from-green-500/20 to-emerald-500/20 hover:from-green-500/30 hover:to-emerald-500/30 text-green-400 hover:text-green-300 rounded-xl transition-all"
                >
                  <CurrencyDollarIcon className="w-5 h-5" />
                </motion.button>
              </Tooltip>
            </>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSendMessage}
            disabled={!inputValue.trim()}
            className="p-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-xl transition-all shadow-lg shadow-purple-500/25 disabled:shadow-none"
          >
            <PaperAirplaneIcon className="w-5 h-5 transform rotate-12" />
          </motion.button>
        </div>
      </div>
    </div>
  );
};

EnhancedStreamChat.propTypes = {
  user: PropTypes.shape({
    uid: PropTypes.string,
    displayName: PropTypes.string
  }),
  channel: PropTypes.string.isRequired,
  creatorId: PropTypes.string,
  isCreator: PropTypes.bool,
  onMessageSent: PropTypes.func,
  onGiftSent: PropTypes.func,
  onTipSent: PropTypes.func,
  className: PropTypes.string
};

export default memo(EnhancedStreamChat);