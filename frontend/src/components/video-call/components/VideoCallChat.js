/**
 * Video call chat component
 * @module components/VideoCallChat
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  XMarkIcon,
  FaceSmileIcon,
  PaperClipIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

/**
 * Chat panel for video calls
 */
const VideoCallChat = ({ channel, user, onClose, onSendMessage }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Common emojis for quick access
  const quickEmojis = ['👍', '❤️', '😂', '🎉', '👏', '🔥', '💯', '✨'];

  /**
   * Scroll to bottom of messages
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  /**
   * Send message
   */
  const sendMessage = () => {
    if (!inputMessage.trim()) return;

    const newMessage = {
      id: Date.now(),
      text: inputMessage,
      sender: user.name || 'You',
      senderId: user.id,
      timestamp: new Date(),
      type: 'text'
    };

    // Add to local messages
    setMessages(prev => [...prev, newMessage]);
    
    // Call parent handler if provided
    onSendMessage?.(newMessage);
    
    // Clear input
    setInputMessage('');
    inputRef.current?.focus();
  };

  /**
   * Add emoji to message
   */
  const addEmoji = (emoji) => {
    setInputMessage(prev => prev + emoji);
    setShowEmojis(false);
    inputRef.current?.focus();
  };

  /**
   * Format timestamp
   */
  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <motion.div
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      className="absolute right-0 top-20 bottom-24 w-80 bg-gray-900/95 backdrop-blur-xl border-l border-gray-700 flex flex-col"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-700 bg-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChatBubbleLeftRightIcon className="w-5 h-5 text-purple-400" />
            <h3 className="text-white font-semibold">Chat</h3>
            <span className="text-xs text-gray-400">
              ({messages.length} messages)
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-400 hover:text-white" />
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <ChatBubbleLeftRightIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No messages yet</p>
            <p className="text-gray-500 text-xs">Start the conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((message) => {
              const isOwnMessage = message.senderId === user.id;
              
              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] ${
                    isOwnMessage
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-700 text-gray-100'
                  } rounded-lg px-3 py-2`}>
                    {!isOwnMessage && (
                      <p className="text-xs opacity-70 mb-1">{message.sender}</p>
                    )}
                    <p className="text-sm break-words">{message.text}</p>
                    <p className={`text-xs mt-1 ${
                      isOwnMessage ? 'text-purple-200' : 'text-gray-400'
                    }`}>
                      {formatTime(message.timestamp)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}

        {/* Typing indicator */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-gray-400 text-sm"
          >
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
            </div>
            Someone is typing...
          </motion.div>
        )}
      </div>

      {/* Emoji picker */}
      <AnimatePresence>
        {showEmojis && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-20 right-4 bg-gray-800 rounded-lg p-3 shadow-xl border border-gray-700"
          >
            <div className="grid grid-cols-4 gap-2">
              {quickEmojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => addEmoji(emoji)}
                  className="text-2xl hover:bg-gray-700 rounded p-1 transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="p-4 border-t border-gray-700 bg-gray-800/50">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <div className="bg-gray-700 rounded-lg flex items-end">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Type a message..."
                className="flex-1 bg-transparent text-white px-3 py-2 focus:outline-none"
              />
              
              {/* Emoji button */}
              <button
                onClick={() => setShowEmojis(!showEmojis)}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <FaceSmileIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Send button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={sendMessage}
            disabled={!inputMessage.trim()}
            className={`p-2.5 rounded-lg transition-all ${
              inputMessage.trim()
                ? 'bg-purple-500 hover:bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Character count */}
        {inputMessage.length > 200 && (
          <p className={`text-xs mt-1 ${
            inputMessage.length > 250 ? 'text-red-400' : 'text-gray-400'
          }`}>
            {inputMessage.length}/250
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default VideoCallChat;