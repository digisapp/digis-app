/**
 * Stream chat component with hybrid state management
 * @module components/StreamChat
 */

import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PaperAirplaneIcon,
  GiftIcon,
  CurrencyDollarIcon,
  FaceSmileIcon,
  ShieldCheckIcon,
  BoltIcon
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import GifterUsername from '../../GifterUsername';
import { 
  useChannelMessages, 
  useTypingUsers, 
  useOnlineUsersCount,
  useChatActions,
  useUser,
  useIsCreator as useIsCreatorGlobal
} from '../../../stores/useHybridStore';

/**
 * Chat component for live streams with hybrid state management
 * Uses Zustand for messages/online users, useState for UI state
 */
const StreamChat = memo(({
  streamId,
  user: propUser, // Can be passed as prop or use global
  isCreator: propIsCreator, // Can be passed as prop or use global
  onTip,
  onGift
}) => {
  // Global state from Zustand
  const globalUser = useUser();
  const globalIsCreator = useIsCreatorGlobal();
  const messages = useChannelMessages(streamId);
  const typingUsers = useTypingUsers(streamId);
  const onlineCount = useOnlineUsersCount();
  const { 
    addMessage, 
    setTypingUser, 
    setActiveChannel,
    clearUnread 
  } = useChatActions();
  
  // Use prop values if provided, otherwise use global state
  const user = propUser || globalUser;
  const isCreator = propIsCreator !== undefined ? propIsCreator : globalIsCreator;
  
  // Local UI state with useState
  const [inputMessage, setInputMessage] = useState('');
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmount, setTipAmount] = useState('');
  const [chatMode, setChatMode] = useState('all'); // all, subscribers, vip
  const [isSlowMode, setIsSlowMode] = useState(false);
  const [lastMessageTime, setLastMessageTime] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Quick tip amounts
  const quickTips = [10, 25, 50, 100, 500];

  /**
   * Set active channel on mount
   */
  useEffect(() => {
    if (streamId) {
      setActiveChannel(streamId);
      clearUnread(streamId);
    }
    
    return () => {
      // Clear typing status when unmounting
      if (user?.id) {
        setTypingUser(streamId, user.id, false);
      }
    };
  }, [streamId, setActiveChannel, clearUnread, setTypingUser, user?.id]);

  /**
   * Scroll to bottom
   */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  /**
   * Handle typing indicator
   */
  const handleTyping = useCallback(() => {
    if (!user?.id || !streamId) return;
    
    // Set typing status
    if (!isTyping) {
      setIsTyping(true);
      setTypingUser(streamId, user.id, true);
    }
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout to clear typing status
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      setTypingUser(streamId, user.id, false);
    }, 2000);
  }, [user, streamId, isTyping, setTypingUser]);

  /**
   * Send message - Now uses Zustand store
   */
  const sendMessage = useCallback(() => {
    if (!inputMessage.trim() || !user) return;

    // Check slow mode
    if (isSlowMode && !isCreator) {
      const timeSinceLastMessage = Date.now() - lastMessageTime;
      if (timeSinceLastMessage < 5000) {
        toast.error(`Slow mode: Wait ${Math.ceil((5000 - timeSinceLastMessage) / 1000)}s`);
        return;
      }
    }

    const newMessage = {
      id: Date.now().toString(),
      text: inputMessage,
      sender: user.name || user.email,
      senderId: user.id,
      timestamp: Date.now(),
      type: 'message',
      isCreator: isCreator,
      isSubscriber: user.isSubscriber || false,
      isVIP: user.isVIP || false,
      isModerator: user.isModerator || false
    };

    // Add message to Zustand store
    addMessage(streamId, newMessage);
    
    // Clear local input state
    setInputMessage('');
    setLastMessageTime(Date.now());
    
    // Clear typing status
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setIsTyping(false);
    setTypingUser(streamId, user.id, false);
  }, [inputMessage, user, streamId, isCreator, isSlowMode, lastMessageTime, addMessage, setTypingUser]);

  /**
   * Send tip - Uses Zustand for message, useState for modal/input
   */
  const sendTip = useCallback(async () => {
    const amount = parseInt(tipAmount);
    if (!amount || amount <= 0 || !user) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      await onTip?.(amount, inputMessage);
      
      // Add tip message to Zustand store
      const tipMessage = {
        id: Date.now().toString(),
        text: `tipped ${amount} tokens${inputMessage ? `: ${inputMessage}` : ''}`,
        sender: user.name || user.email,
        senderId: user.id,
        timestamp: Date.now(),
        type: 'tip',
        amount
      };
      
      addMessage(streamId, tipMessage);
      
      // Clear local UI state
      setShowTipModal(false);
      setTipAmount('');
      setInputMessage('');
      
      toast.success(`Tipped ${amount} tokens!`);
    } catch (error) {
      console.error('Tip error:', error);
      toast.error('Failed to send tip');
    }
  }, [tipAmount, inputMessage, user, streamId, onTip, addMessage]);

  /**
   * Format message based on type
   */
  const MessageBubble = ({ message }) => {
    const getBadges = () => {
      const badges = [];
      
      if (message.isCreator) {
        badges.push(
          <span key="creator" className="px-2 py-0.5 bg-purple-500 text-white text-xs rounded-full">
            Creator
          </span>
        );
      }
      if (message.isModerator) {
        badges.push(
          <ShieldCheckIcon key="mod" className="w-4 h-4 text-green-400" />
        );
      }
      if (message.isVIP) {
        badges.push(
          <StarIcon key="vip" className="w-4 h-4 text-yellow-400" />
        );
      }
      if (message.isSubscriber) {
        badges.push(
          <BoltIcon key="sub" className="w-4 h-4 text-blue-400" />
        );
      }
      
      return badges;
    };

    if (message.type === 'tip') {
      return (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-lg p-3 mb-2"
        >
          <div className="flex items-center gap-2">
            <CurrencyDollarIcon className="w-5 h-5 text-yellow-400" />
            <GifterUsername 
              user={{ username: message.sender, ...message.userData }} 
              className="font-semibold"
            />
            <span className="text-white">{message.text}</span>
          </div>
        </motion.div>
      );
    }

    if (message.type === 'gift') {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg p-3 mb-2"
        >
          <div className="flex items-center gap-2">
            <GiftIcon className="w-5 h-5 text-purple-400" />
            <GifterUsername 
              user={{ username: message.sender, ...message.userData }} 
              className="font-semibold"
            />
            <span className="text-white">sent {message.giftName}</span>
            <span className="text-2xl">{message.giftEmoji}</span>
          </div>
        </motion.div>
      );
    }

    return (
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <GifterUsername 
            user={{ username: message.sender, ...message.userData }} 
            className={`font-semibold ${message.isCreator ? 'text-purple-400' : ''}`}
          />
          {getBadges()}
        </div>
        <p className="text-white text-sm">{message.text}</p>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-white font-semibold">Stream Chat</h3>
            <p className="text-xs text-gray-400">{onlineCount} users online</p>
          </div>
          {isCreator && (
            <button
              onClick={() => setIsSlowMode(!isSlowMode)}
              className={`px-2 py-1 text-xs rounded ${
                isSlowMode ? 'bg-yellow-500 text-white' : 'bg-gray-700 text-gray-300'
              }`}
            >
              Slow Mode
            </button>
          )}
        </div>
        
        {/* Chat filters */}
        <div className="flex gap-1">
          {['all', 'subscribers', 'vip'].map((mode) => (
            <button
              key={mode}
              onClick={() => setChatMode(mode)}
              className={`px-3 py-1 text-xs rounded-lg capitalize ${
                chatMode === mode
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-700 text-gray-400'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No messages yet</p>
            <p className="text-sm">Be the first to chat!</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-700">
          <p className="text-xs text-gray-400 italic">
            {typingUsers.length === 1 
              ? `${typingUsers[0]} is typing...`
              : `${typingUsers.slice(0, 2).join(', ')}${typingUsers.length > 2 ? ` and ${typingUsers.length - 2} others` : ''} are typing...`
            }
          </p>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t border-gray-700">
        {/* Quick actions */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setShowTipModal(true)}
            className="flex-1 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg text-sm font-semibold hover:shadow-lg transition-all"
          >
            <CurrencyDollarIcon className="w-4 h-4 inline mr-1" />
            Tip
          </button>
          <button
            onClick={() => toast.info('Gift feature coming soon!')}
            className="flex-1 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm font-semibold hover:shadow-lg transition-all"
          >
            <GiftIcon className="w-4 h-4 inline mr-1" />
            Gift
          </button>
        </div>

        {/* Message input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => {
              setInputMessage(e.target.value);
              handleTyping();
            }}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim()}
            className={`p-2 rounded-lg ${
              inputMessage.trim()
                ? 'bg-purple-500 hover:bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-500'
            }`}
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tip Modal */}
      <AnimatePresence>
        {showTipModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-gray-800 rounded-xl p-6 w-full max-w-sm"
            >
              <h3 className="text-white font-semibold text-lg mb-4">Send a Tip</h3>
              
              {/* Quick amounts */}
              <div className="grid grid-cols-5 gap-2 mb-4">
                {quickTips.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setTipAmount(amount.toString())}
                    className="py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
                  >
                    {amount}
                  </button>
                ))}
              </div>
              
              {/* Custom amount */}
              <input
                type="number"
                value={tipAmount}
                onChange={(e) => setTipAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg mb-3"
              />
              
              {/* Message */}
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Add a message (optional)"
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg mb-4"
              />
              
              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowTipModal(false)}
                  className="flex-1 py-2 bg-gray-700 text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={sendTip}
                  className="flex-1 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg font-semibold"
                >
                  Send Tip
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

StreamChat.displayName = 'StreamChat';

export default StreamChat;