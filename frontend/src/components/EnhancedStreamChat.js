import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PaperAirplaneIcon,
  FaceSmileIcon,
  GiftIcon,
  CurrencyDollarIcon,
  AtSymbolIcon,
  ShieldCheckIcon,
  ClockIcon,
  TrashIcon,
  NoSymbolIcon,
  ExclamationTriangleIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { HeartIcon, SparklesIcon } from '@heroicons/react/24/solid';
import Button from './ui/Button';
import Tooltip from './ui/Tooltip';
import TypingIndicator from './ui/TypingIndicator';
import { useTyping } from '../hooks/useSocket';

const EnhancedStreamChat = ({
  user,
  channel,
  isCreator,
  onMessageSent,
  className = ''
}) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [showEmotes, setShowEmotes] = useState(false);
  const [slowMode, setSlowMode] = useState(false);
  const [slowModeDelay, setSlowModeDelay] = useState(5);
  const [subscribers, setSubscribers] = useState(new Set());
  const [vipUsers, setVipUsers] = useState(new Set(['VIPUser1']));
  const [moderators, setModerators] = useState(new Set(['mod_user_1']));
  const [bannedUsers, setBannedUsers] = useState(new Set());
  const [showUserMenu, setShowUserMenu] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [lastMessageTime, setLastMessageTime] = useState(0);
  const [emoteOnlyMode, setEmoteOnlyMode] = useState(false);
  const [activePoll, setActivePoll] = useState(null);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);
  
  // Use typing hook
  const { typingUsers, startTyping, stopTyping } = useTyping(channel);

  // Custom emotes
  const customEmotes = [
    { code: ':digis:', url: '💎' },
    { code: ':hype:', url: '🚀' },
    { code: ':love:', url: '❤️' },
    { code: ':fire:', url: '🔥' },
    { code: ':100:', url: '💯' },
    { code: ':pog:', url: '😮' },
    { code: ':kekw:', url: '😂' },
    { code: ':monkas:', url: '😰' },
    { code: ':ez:', url: '😎' },
    { code: ':gg:', url: '🎮' }
  ];

  // Standard emojis
  const standardEmojis = [
    '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎',
    '👍', '👎', '👏', '🙌', '🤝', '🙏', '✌️', '🤟', '🤘',
    '🎉', '🎊', '🎈', '🎁', '🎯', '🎮', '🎸', '🎤', '🎧'
  ];

  // Mock messages for demo
  useEffect(() => {
    const mockMessages = [
      { id: 1, user: 'StreamFan123', message: 'First! 🎉', timestamp: Date.now() - 60000, userColor: '#10b981' }, // subscriber
      { id: 2, user: 'ModeratorJoe', message: 'Welcome everyone!', timestamp: Date.now() - 50000, userColor: '#3b82f6' }, // moderator
      { id: 3, user: 'ViewerX', message: 'This stream is :fire:', timestamp: Date.now() - 40000, userColor: '#9ca3af' }, // regular
      { id: 4, user: 'SubGirl', message: 'Love the content! :love:', timestamp: Date.now() - 30000, userColor: '#eab308' } // VIP
    ];
    setMessages(mockMessages);
    setSubscribers(new Set(['StreamFan123', 'SubGirl']));
  }, []);

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

  const parseEmotes = (text) => {
    let parsed = text;
    customEmotes.forEach(emote => {
      parsed = parsed.replace(new RegExp(emote.code, 'g'), emote.url);
    });
    return parsed;
  };

  const handleSendMessage = useCallback(() => {
    if (!inputValue.trim()) return;

    // Check slow mode
    if (slowMode && !isCreator && !moderators.has(user?.displayName)) {
      const timeSinceLastMessage = Date.now() - lastMessageTime;
      if (timeSinceLastMessage < slowModeDelay * 1000) {
        const remaining = Math.ceil((slowModeDelay * 1000 - timeSinceLastMessage) / 1000);
        alert(`Slow mode is enabled. Wait ${remaining} seconds.`);
        return;
      }
    }

    const newMessage = {
      id: Date.now(),
      user: user?.displayName || 'Anonymous',
      message: parseEmotes(inputValue),
      timestamp: Date.now(),
      userColor: getUsernameColor(user?.displayName),
      replyTo: replyingTo
    };

    setMessages(prev => [...prev, newMessage]);
    setInputValue('');
    setReplyingTo(null);
    setLastMessageTime(Date.now());
    onMessageSent?.(newMessage);
  }, [inputValue, user, isCreator, moderators, slowMode, slowModeDelay, lastMessageTime, replyingTo, onMessageSent]);

  const getUsernameColor = (username) => {
    if (username === user?.displayName && isCreator) return '#a855f7'; // Purple for creator/host
    if (moderators.has(username)) return '#3b82f6'; // Blue for moderators
    if (subscribers.has(username)) return '#10b981'; // Emerald for subscribers
    // Could add VIP check here: return '#eab308'; // Gold for VIP
    return '#9ca3af'; // Gray for regular users
  };

  const handleModAction = (action, targetUser) => {
    switch (action) {
      case 'timeout':
        // Implement 10 min timeout
        console.log('Timeout user:', targetUser);
        break;
      case 'ban':
        setBannedUsers(prev => new Set([...prev, targetUser]));
        setMessages(prev => prev.filter(msg => msg.user !== targetUser));
        break;
      case 'delete':
        setMessages(prev => prev.filter(msg => msg.user !== targetUser));
        break;
      case 'mod':
        setModerators(prev => new Set([...prev, targetUser]));
        break;
    }
    setShowUserMenu(null);
  };


  return (
    <div className={`flex flex-col h-full bg-gradient-to-b from-gray-900/95 to-gray-950/95 backdrop-blur-xl rounded-2xl border border-purple-500/20 shadow-2xl shadow-purple-500/10 ${className}`}>
      {/* Chat Header */}
      <div className="relative flex items-center justify-between p-4 border-b border-purple-500/20 overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-purple-600/10 animate-gradient-x" />
        
        <div className="relative flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl">
            <SparklesIcon className="w-5 h-5 text-purple-400" />
          </div>
          <h3 className="font-bold text-lg text-white">Chat</h3>
        </div>
        <div className="relative flex items-center gap-2">
          {/* Color Legend */}
          <Tooltip 
            content={
              <div className="text-xs space-y-1 p-1">
                <div className="text-white font-semibold mb-2">User Colors</div>
                <div className="flex items-center gap-2">
                  <span style={{ color: '#a855f7' }}>●</span>
                  <span className="text-white">Creator</span>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ color: '#3b82f6' }}>●</span>
                  <span className="text-white">Moderator</span>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ color: '#eab308' }}>●</span>
                  <span className="text-white">VIP</span>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ color: '#10b981' }}>●</span>
                  <span className="text-white">Subscriber</span>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ color: '#9ca3af' }}>●</span>
                  <span className="text-white">Viewer</span>
                </div>
              </div>
            }
            position="bottom-left"
            delay={100}
            maxWidth="250px"
          >
            <button className="p-1.5 text-gray-400 hover:text-white transition-colors">
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
          </Tooltip>
          
          {isCreator && (
            <>
              <Tooltip content={slowMode ? 'Disable slow mode' : 'Enable slow mode'}>
                <button
                  onClick={() => setSlowMode(!slowMode)}
                  className={`p-1.5 rounded transition-colors ${
                    slowMode ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'
                  }`}
                >
                  <ClockIcon className="w-4 h-4" />
                </button>
              </Tooltip>
              
              <Tooltip content={emoteOnlyMode ? 'Disable emote-only mode' : 'Enable emote-only mode'}>
                <button
                  onClick={() => setEmoteOnlyMode(!emoteOnlyMode)}
                  className={`p-1.5 rounded transition-colors ${
                    emoteOnlyMode ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'
                  }`}
                >
                  <FaceSmileIcon className="w-4 h-4" />
                </button>
              </Tooltip>
            </>
          )}
        </div>
      </div>

      {/* Messages Container */}
      <div 
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-0.5 scrollbar-thin scrollbar-thumb-purple-600/50 scrollbar-track-gray-800/50"
      >
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, x: -20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ type: "spring", duration: 0.3 }}
            className={`group relative hover:bg-gradient-to-r hover:from-purple-500/10 hover:to-transparent rounded-lg px-3 py-2 -mx-1 transition-all duration-200 ${
              vipUsers.has(msg.user) ? 'bg-gradient-to-r from-yellow-500/10 to-transparent border-l-2 border-yellow-500' : ''
            } ${
              msg.id === pinnedMessage?.id ? 'bg-purple-600/20 border border-purple-500/30' : ''
            }`}
          >
            {/* Reply Reference */}
            {msg.replyTo && (
              <div className="text-xs text-purple-400/70 mb-1 pl-3 border-l-2 border-purple-500/30 italic">
                ↳ @{msg.replyTo.user}
              </div>
            )}

            <div className="flex items-start gap-2">
              {/* Username with badges */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* User badges */}
                  {msg.user === user?.displayName && isCreator && (
                    <div className="p-1 bg-gradient-to-br from-purple-500 to-pink-500 rounded-md" title="Stream Host">
                      <StarIcon className="w-3 h-3 text-white" />
                    </div>
                  )}
                  {moderators.has(msg.user) && (
                    <div className="p-1 bg-blue-500 rounded-md" title="Moderator">
                      <ShieldCheckIcon className="w-3 h-3 text-white" />
                    </div>
                  )}
                  {subscribers.has(msg.user) && !moderators.has(msg.user) && msg.user !== user?.displayName && (
                    <div className="p-1 bg-gradient-to-br from-green-500 to-emerald-500 rounded-md" title="Subscriber">
                      <HeartIcon className="w-3 h-3 text-white" />
                    </div>
                  )}
                  
                  <button
                    onClick={() => setReplyingTo(msg)}
                    className="font-bold text-sm hover:underline transition-all duration-200 hover:brightness-110"
                    style={{ color: msg.userColor || getUsernameColor(msg.user) }}
                  >
                    {msg.user}
                  </button>
                  <span className="text-gray-500">:</span>
                </div>

                {/* Message with enhanced styling */}
                <span className="text-gray-200 text-sm break-words flex-1 leading-relaxed">
                  {msg.message}
                </span>
              </div>

              {/* Mod Actions */}
              {(isCreator || moderators.has(user?.displayName)) && msg.user !== user?.displayName && (
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                  <Tooltip content="Delete message">
                    <button
                      onClick={() => setMessages(prev => prev.filter(m => m.id !== msg.id))}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <TrashIcon className="w-3 h-3" />
                    </button>
                  </Tooltip>
                  <Tooltip content="User actions">
                    <button
                      onClick={() => setShowUserMenu(msg.id)}
                      className="p-1 text-gray-400 hover:text-white transition-colors"
                    >
                      <ShieldCheckIcon className="w-3 h-3" />
                    </button>
                  </Tooltip>

                  {/* User Actions Menu */}
                  {showUserMenu === msg.id && (
                    <div className="absolute right-0 top-full mt-1 bg-gray-700 rounded-lg shadow-xl p-1 z-10 min-w-[150px]">
                      <button
                        onClick={() => handleModAction('timeout', msg.user)}
                        className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-600 rounded flex items-center gap-2"
                      >
                        <ClockIcon className="w-4 h-4" />
                        Timeout (10m)
                      </button>
                      <button
                        onClick={() => handleModAction('ban', msg.user)}
                        className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-600 rounded flex items-center gap-2"
                      >
                        <NoSymbolIcon className="w-4 h-4" />
                        Ban User
                      </button>
                      {!moderators.has(msg.user) && (
                        <button
                          onClick={() => handleModAction('mod', msg.user)}
                          className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-600 rounded flex items-center gap-2"
                        >
                          <ShieldCheckIcon className="w-4 h-4" />
                          Make Moderator
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        ))}
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

      {/* Reply Indicator */}
      {replyingTo && (
        <div className="px-3 py-2 bg-gray-700/50 border-t border-gray-700 flex items-center justify-between">
          <span className="text-sm text-gray-400">
            Replying to <span className="text-white font-semibold">@{replyingTo.user}</span>
          </span>
          <button
            onClick={() => setReplyingTo(null)}
            className="text-gray-400 hover:text-white"
          >
            ×
          </button>
        </div>
      )}

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
              users={Array.from(typingUsers).map(userId => {
                // In a real app, you'd fetch username from user data
                return userId === user?.uid ? 'You' : `User ${userId.slice(0, 6)}`;
              })}
              className="py-2"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="p-4 border-t border-purple-500/20 bg-gradient-to-r from-gray-900/50 to-gray-950/50">
        {/* Character Limit Indicator */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-500">
            {slowMode && (
              <span className="flex items-center gap-1 text-yellow-500">
                <ClockIcon className="w-3 h-3" />
                Slow mode: {slowModeDelay}s
              </span>
            )}
          </div>
          <div className={`text-xs transition-colors ${
            inputValue.length > 400 ? 'text-red-400' : 'text-gray-500'
          }`}>
            {inputValue.length}/500
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => {
                if (e.target.value.length <= 500) {
                  setInputValue(e.target.value);
                  if (e.target.value.length > 0) {
                    startTyping();
                  } else {
                    stopTyping();
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                  stopTyping();
                }
              }}
              onBlur={() => stopTyping()}
              placeholder={slowMode ? `Slow mode active...` : "Type your message..."}
              className="w-full bg-gradient-to-r from-gray-800/50 to-gray-900/50 text-white px-4 py-3 pr-12 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-gray-800/70 transition-all duration-200 placeholder:text-gray-500"
            />
            
            {/* Emote Picker */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowEmotes(!showEmotes);
                }}
                title="Emotes"
                className={`p-1.5 transition-colors ${showEmotes ? 'text-purple-400' : 'text-gray-400 hover:text-white'}`}
              >
                <FaceSmileIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Emote Panel */}
            <AnimatePresence>
              {showEmotes && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.9 }}
                  transition={{ type: "spring", duration: 0.3 }}
                  className="absolute bottom-full mb-2 right-0 bg-gradient-to-b from-gray-800 to-gray-900 rounded-xl shadow-2xl p-4 w-80 border border-purple-500/20 backdrop-blur-xl z-50"
                >
                  <div className="text-xs text-gray-400 font-semibold mb-2">CUSTOM EMOTES</div>
                  <div className="grid grid-cols-5 gap-2 mb-3">
                    {customEmotes.map((emote) => (
                      <button
                        key={emote.code}
                        onClick={() => {
                          setInputValue(prev => prev + ' ' + emote.code + ' ');
                          setShowEmotes(false);
                          inputRef.current?.focus();
                        }}
                        className="p-2 hover:bg-gray-600 rounded text-xl"
                      >
                        {emote.url}
                      </button>
                    ))}
                  </div>
                  
                  <div className="text-xs text-gray-400 font-semibold mb-2">EMOJIS</div>
                  <div className="grid grid-cols-9 gap-1">
                    {standardEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          setInputValue(prev => prev + emoji);
                          inputRef.current?.focus();
                        }}
                        className="p-1 hover:bg-gray-600 rounded text-lg"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action Buttons - Only show for viewers, not for creator */}
          {!isCreator && (
            <>
              <Tooltip content="Send gift">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative p-3 bg-gradient-to-br from-pink-500/20 to-purple-500/20 hover:from-pink-500/30 hover:to-purple-500/30 text-pink-400 hover:text-pink-300 rounded-xl transition-all duration-200 group overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-purple-500 opacity-0 group-hover:opacity-20 transition-opacity" />
                  <GiftIcon className="w-5 h-5 relative z-10" />
                </motion.button>
              </Tooltip>

              <Tooltip content="Send tip">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative p-3 bg-gradient-to-br from-green-500/20 to-emerald-500/20 hover:from-green-500/30 hover:to-emerald-500/30 text-green-400 hover:text-green-300 rounded-xl transition-all duration-200 group overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 opacity-0 group-hover:opacity-20 transition-opacity" />
                  <CurrencyDollarIcon className="w-5 h-5 relative z-10" />
                </motion.button>
              </Tooltip>
            </>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSendMessage}
            disabled={!inputValue.trim()}
            className="relative p-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-xl transition-all duration-200 shadow-lg shadow-purple-500/25 disabled:shadow-none overflow-hidden group"
          >
            <motion.div
              className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"
              initial={false}
              animate={{ x: [-100, 100] }}
              transition={{ duration: 0.5 }}
            />
            <PaperAirplaneIcon className="w-5 h-5 relative z-10 transform rotate-12" />
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default EnhancedStreamChat;