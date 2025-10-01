import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PropTypes from 'prop-types';
import { FiSend, FiSmile, FiReply, FiX, FiAlertCircle } from 'react-icons/fi';
import { BsReplyFill } from 'react-icons/bs';
import { format } from 'date-fns';
import useWebSocketWithRetry from '../hooks/useWebSocketWithRetry';
import { debounceRetry } from '../utils/retryUtils';
import '../styles/InstantMessagingChat.css';

/**
 * Enhanced InstantMessagingChat component with retry logic
 * Demonstrates how to integrate retry utilities for robust WebSocket communication
 */
const InstantMessagingChatWithRetry = ({ 
  channelId, 
  currentUser, 
  isCreator = false,
  websocketUrl,
  onFollowersUpdate 
}) => {
  // State management
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [followers, setFollowers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [isMessageAll, setIsMessageAll] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [sendError, setSendError] = useState(null);

  // Refs
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const typingTimeoutRef = useRef({});

  // WebSocket with retry logic
  const {
    isConnected,
    connectionState,
    reconnectCount,
    sendMessage: wsSendMessage,
    lastError
  } = useWebSocketWithRetry(websocketUrl || `${process.env.REACT_APP_WS_URL}/chat/${channelId}`, {
    reconnectAttempts: 5,
    reconnectDelay: 1000,
    heartbeatInterval: 30000,
    messageRetryOptions: {
      maxRetries: 3,
      initialDelay: 500,
      onRetry: (error, attempt) => {
        console.log(`Message send retry ${attempt}:`, error);
      }
    },
    onOpen: () => {
      console.log('Chat WebSocket connected');
      setConnectionStatus('connected');
      setSendError(null);
      
      // Join channel
      wsSendMessage({
        type: 'join_channel',
        channelId,
        userId: currentUser.id,
        isCreator
      });
    },
    onClose: () => {
      setConnectionStatus('disconnected');
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('error');
    },
    onMessage: handleWebSocketMessage,
    onReconnect: (attempt) => {
      setConnectionStatus('reconnecting');
      console.log(`Reconnecting... Attempt ${attempt}`);
    }
  });

  // Handle incoming WebSocket messages
  function handleWebSocketMessage(data) {
    switch (data.type) {
      case 'message':
        setMessages(prev => [...prev, {
          ...data.message,
          timestamp: new Date(data.message.timestamp)
        }]);
        break;

      case 'typing':
        handleTypingIndicator(data.userId, true);
        break;

      case 'stop_typing':
        handleTypingIndicator(data.userId, false);
        break;

      case 'follower_update':
        setFollowers(new Set(data.followers));
        if (onFollowersUpdate) {
          onFollowersUpdate(data.followers);
        }
        break;

      case 'message_sent':
        // Confirmation that message was sent successfully
        setSendError(null);
        break;

      case 'error':
        console.error('Chat error:', data.message);
        if (data.errorType === 'message_send_failed') {
          setSendError(data.message);
        }
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  }

  // Debounced typing indicator
  const sendTypingIndicator = useCallback(
    debounceRetry(() => {
      if (isConnected) {
        wsSendMessage({
          type: 'typing',
          channelId,
          userId: currentUser.id
        });
      }
    }, 300, { maxRetries: 1 }),
    [isConnected, channelId, currentUser.id, wsSendMessage]
  );

  // Handle typing indicators
  const handleTypingIndicator = (userId, isTyping) => {
    if (userId === currentUser.id) return;

    setTypingUsers(prev => {
      const newSet = new Set(prev);
      if (isTyping) {
        newSet.add(userId);
        
        // Clear existing timeout
        if (typingTimeoutRef.current[userId]) {
          clearTimeout(typingTimeoutRef.current[userId]);
        }
        
        // Set timeout to remove typing indicator
        typingTimeoutRef.current[userId] = setTimeout(() => {
          handleTypingIndicator(userId, false);
        }, 3000);
      } else {
        newSet.delete(userId);
        if (typingTimeoutRef.current[userId]) {
          clearTimeout(typingTimeoutRef.current[userId]);
          delete typingTimeoutRef.current[userId];
        }
      }
      return newSet;
    });
  };

  // Send message with retry
  const sendMessage = async () => {
    if (!newMessage.trim() || !isConnected) return;

    const message = {
      type: isMessageAll ? 'send_message_all' : 'send_message',
      channelId,
      content: newMessage.trim(),
      messageType: 'text',
      replyTo: replyTo?.messageId || null,
      isMessageAll,
      userId: currentUser.id,
      username: currentUser.username,
      timestamp: new Date().toISOString()
    };

    try {
      setSendError(null);
      await wsSendMessage(message);
      
      // Clear input on successful send
      setNewMessage('');
      setReplyTo(null);
      setShowEmojiPicker(false);
      setIsMessageAll(false);
      
      // Stop typing indicator
      wsSendMessage({
        type: 'stop_typing',
        channelId,
        userId: currentUser.id
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      setSendError('Failed to send message. Please try again.');
    }
  };

  // Send emoji reaction with retry
  const sendReaction = async (messageId, emoji) => {
    try {
      await wsSendMessage({
        type: 'add_reaction',
        channelId,
        messageId,
        emoji,
        userId: currentUser.id
      });
    } catch (error) {
      console.error('Failed to send reaction:', error);
    }
  };

  // Handle input changes
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (e.target.value.trim()) {
      sendTypingIndicator();
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Connection status indicator
  const renderConnectionStatus = () => {
    if (connectionStatus === 'connected' && !sendError) return null;

    const statusConfig = {
      connecting: { color: 'orange', text: 'Connecting...' },
      reconnecting: { color: 'orange', text: `Reconnecting... (${reconnectCount})` },
      disconnected: { color: 'red', text: 'Disconnected' },
      error: { color: 'red', text: 'Connection error' },
      connected: sendError ? { color: 'red', text: sendError } : null
    };

    const config = statusConfig[connectionStatus];
    if (!config) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="connection-status"
        style={{ backgroundColor: config.color }}
      >
        <FiAlertCircle /> {config.text}
      </motion.div>
    );
  };

  // Typing indicator display
  const renderTypingIndicator = () => {
    if (typingUsers.size === 0) return null;

    const typingArray = Array.from(typingUsers);
    const text = typingArray.length === 1
      ? `${typingArray[0]} is typing...`
      : `${typingArray.length} people are typing...`;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="typing-indicator"
      >
        <div className="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <span className="typing-text">{text}</span>
      </motion.div>
    );
  };

  return (
    <div className="instant-messaging-chat">
      <AnimatePresence>
        {renderConnectionStatus()}
      </AnimatePresence>

      <div className="messages-container">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.messageId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`message ${message.userId === currentUser.id ? 'own' : ''}`}
            >
              <div className="message-header">
                <span className="username">{message.username}</span>
                <span className="timestamp">
                  {format(message.timestamp, 'HH:mm')}
                </span>
              </div>
              
              {message.replyTo && (
                <div className="reply-reference">
                  <BsReplyFill />
                  <span>{message.replyTo.content}</span>
                </div>
              )}
              
              <div className="message-content">{message.content}</div>
              
              <div className="message-actions">
                <button 
                  onClick={() => setReplyTo(message)}
                  className="reply-button"
                  aria-label="Reply to message"
                >
                  <FiReply />
                </button>
                <button
                  onClick={() => sendReaction(message.messageId, '👍')}
                  className="reaction-button"
                  aria-label="Add reaction"
                >
                  <FiSmile />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        <AnimatePresence>
          {renderTypingIndicator()}
        </AnimatePresence>
        
        <div ref={messagesEndRef} />
      </div>

      {replyTo && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="reply-preview"
        >
          <div className="reply-content">
            <BsReplyFill />
            <span>Replying to: {replyTo.content}</span>
          </div>
          <button 
            onClick={() => setReplyTo(null)}
            className="cancel-reply"
            aria-label="Cancel reply"
          >
            <FiX />
          </button>
        </motion.div>
      )}

      <div className="message-input-container">
        <input
          ref={messageInputRef}
          type="text"
          value={newMessage}
          onChange={handleInputChange}
          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder={isConnected ? "Type a message..." : "Connecting..."}
          disabled={!isConnected}
          className="message-input"
          aria-label="Message input"
        />
        
        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="emoji-button"
          disabled={!isConnected}
          aria-label="Toggle emoji picker"
        >
          <FiSmile />
        </button>
        
        {isCreator && (
          <label className="message-all-toggle">
            <input
              type="checkbox"
              checked={isMessageAll}
              onChange={(e) => setIsMessageAll(e.target.checked)}
              disabled={!isConnected}
            />
            <span>Message All</span>
          </label>
        )}
        
        <button
          onClick={sendMessage}
          disabled={!isConnected || !newMessage.trim()}
          className="send-button"
          aria-label="Send message"
        >
          <FiSend />
        </button>
      </div>

      {showEmojiPicker && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="emoji-picker"
        >
          {/* Emoji picker implementation */}
        </motion.div>
      )}
    </div>
  );
};

InstantMessagingChatWithRetry.propTypes = {
  channelId: PropTypes.string.isRequired,
  currentUser: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired
  }).isRequired,
  isCreator: PropTypes.bool,
  websocketUrl: PropTypes.string,
  onFollowersUpdate: PropTypes.func
};

export default InstantMessagingChatWithRetry;