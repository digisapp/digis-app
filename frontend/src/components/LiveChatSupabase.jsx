// components/LiveChatSupabase.jsx
// Live Stream Chat using Supabase Realtime (replaces Agora Chat)
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PropTypes from 'prop-types';
import { useTheme } from '../hooks/useTheme';
import { getAuthToken } from '../utils/auth-helpers';
import { supabase } from '../utils/supabase-client-v2';
import {
  ChatBubbleLeftRightIcon,
  ShieldCheckIcon,
  EyeSlashIcon,
  SpeakerXMarkIcon,
  TrashIcon,
  FlagIcon,
  GiftIcon,
  PaperAirplaneIcon
} from '@heroicons/react/24/outline';
import Button from './ui/Button';
import Input from './ui/Input';
import Tooltip from './ui/Tooltip';
import toast from 'react-hot-toast';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const LiveChatSupabase = ({
  user,
  channel,
  isCreator = false,
  isHost = false,
  onSendGift,
  onSendTip,
  ticketHolders = [], // Array of user IDs with tickets
  className = ''
}) => {
  const { animations } = useTheme();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [moderationMode, setModerationMode] = useState(false);
  const [slowMode, setSlowMode] = useState(0);
  const [lastMessageTime, setLastMessageTime] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [chatStats, setChatStats] = useState({
    messageCount: 0,
    activeUsers: 0
  });

  const messagesEndRef = useRef(null);
  const channelRef = useRef(null);
  const authTokenRef = useRef(null);

  // Fetch chat history
  const fetchHistory = useCallback(async () => {
    // Validate channel before making request
    if (!channel || channel === 'undefined') {
      console.debug('ℹ️ LiveChatSupabase: No valid channel, skipping history fetch');
      return;
    }

    try {
      const authToken = await getAuthToken();
      authTokenRef.current = authToken;

      const response = await fetch(
        `${BACKEND_URL}/stream-chat/history/${channel}?limit=100`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.messages) {
          setMessages(data.messages);
        }
      }
    } catch (error) {
      console.error('Error fetching chat history:', error);
    }
  }, [channel]);

  // Initialize Supabase Realtime subscription
  useEffect(() => {
    if (!channel || !user) return;

    const initChat = async () => {
      try {
        // Fetch initial history
        await fetchHistory();

        // Subscribe to new messages
        const streamChannel = supabase
          .channel(`stream-chat:${channel}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'stream_chat_messages',
              filter: `stream_id=eq.${channel}`
            },
            (payload) => {
              console.log('New stream chat message:', payload);

              // Format message for display
              const newMsg = {
                id: payload.new.id,
                user: payload.new.user?.display_name || payload.new.user?.username || 'Unknown',
                message: payload.new.message,
                timestamp: payload.new.created_at,
                userId: payload.new.user_id,
                user_role: payload.new.user_role,
                userColor: payload.new.user?.is_creator ? '#a855f7' : '#9ca3af',
                type: 'chat'
              };

              setMessages(prev => [...prev, newMsg]);
              setChatStats(prev => ({
                ...prev,
                messageCount: prev.messageCount + 1
              }));
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'stream_chat_messages',
              filter: `stream_id=eq.${channel}`
            },
            (payload) => {
              // Handle message updates (e.g., deletions)
              if (payload.new.is_deleted) {
                setMessages(prev => prev.filter(msg => msg.id !== payload.new.id));
              }
            }
          )
          .subscribe((status) => {
            console.log('Stream chat subscription status:', status);
            if (status === 'SUBSCRIBED') {
              setIsConnected(true);
            }
          });

        channelRef.current = streamChannel;

      } catch (error) {
        console.error('Error initializing stream chat:', error);
        toast.error('Failed to connect to chat');
      }
    };

    initChat();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [channel, user, fetchHistory]);

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !isConnected) return;

    // Check slow mode
    if (slowMode > 0 && !isCreator && !isHost) {
      const timeSinceLastMessage = Date.now() - lastMessageTime;
      if (timeSinceLastMessage < slowMode * 1000) {
        toast.error(`Slow mode active. Wait ${slowMode}s between messages.`);
        return;
      }
    }

    try {
      const authToken = await getAuthToken();

      const response = await fetch(`${BACKEND_URL}/stream-chat/message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel,
          message: newMessage.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          toast.error(data.error || 'You are banned or muted');
        } else {
          throw new Error(data.error || 'Failed to send message');
        }
        return;
      }

      setNewMessage('');
      setLastMessageTime(Date.now());

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  // Handle moderation actions
  const handleModeration = async (action, targetUserId, messageId = null) => {
    if (!isCreator && !isHost) return;

    try {
      const authToken = await getAuthToken();

      if (action === 'delete' && messageId) {
        // Delete message
        const response = await fetch(
          `${BACKEND_URL}/stream-chat/message/${messageId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.ok) {
          setMessages(prev => prev.filter(msg => msg.id !== messageId));
          toast.success('Message deleted');
        }
      } else {
        // Ban/mute/timeout
        const response = await fetch(`${BACKEND_URL}/stream-chat/moderate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            channel,
            targetUserId,
            action,
            duration: action === 'timeout' ? 5 : null, // 5 minutes for timeout
            reason: `Moderated during stream`
          })
        });

        if (response.ok) {
          toast.success(`User ${action}ed successfully`);
        } else {
          throw new Error('Moderation failed');
        }
      }

    } catch (error) {
      console.error('Moderation action failed:', error);
      toast.error('Failed to moderate user');
    }
  };

  const toggleSlowMode = () => {
    const modes = [0, 5, 10, 30, 60];
    const currentIndex = modes.indexOf(slowMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setSlowMode(nextMode);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getUsernameColor = (userRole, userId) => {
    // Check if user has special role first
    if (userRole === 'creator' || userRole === 'host') {
      return 'text-purple-500 font-bold';
    }

    // Check if user has VIP ticket
    if (ticketHolders.includes(userId)) {
      return 'text-yellow-500 font-semibold';
    }

    // Check if subscriber
    if (userRole === 'subscriber') {
      return 'text-purple-400 font-semibold';
    }

    // Default color for regular users
    return 'text-gray-600 dark:text-gray-400 font-medium';
  };

  const getUserBadge = (userRole, userId) => {
    if (userRole === 'host') return '👑';
    if (userRole === 'creator') return '⭐';
    if (ticketHolders.includes(userId)) return '🎫';
    if (userRole === 'subscriber') return '💎';
    return null;
  };

  const MessageComponent = ({ message }) => {
    const isOwnMessage = message.userId === user?.id || message.userId === user?.supabase_id;
    const isSystemMessage = message.type === 'system';
    const isGiftMessage = message.type === 'gift';

    if (isSystemMessage) {
      return (
        <motion.div
          initial={animations ? { opacity: 0, y: 10 } : {}}
          animate={animations ? { opacity: 1, y: 0 } : {}}
          className="text-center text-xs text-neutral-500 dark:text-neutral-400 py-1"
        >
          {message.message || message.content}
        </motion.div>
      );
    }

    if (isGiftMessage) {
      return (
        <motion.div
          initial={animations ? { opacity: 0, scale: 0.8 } : {}}
          animate={animations ? { opacity: 1, scale: 1 } : {}}
          className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-300/30 rounded-lg p-3 my-2"
        >
          <div className="flex items-center gap-2">
            <GiftIcon className="w-5 h-5 text-purple-500" />
            <span className="font-semibold text-purple-600 dark:text-purple-400">
              {message.user}
            </span>
            <span className="text-sm">sent a gift!</span>
          </div>
          {message.message && (
            <p className="text-sm mt-1 text-neutral-600 dark:text-neutral-300">
              "{message.message}"
            </p>
          )}
        </motion.div>
      );
    }

    const badge = getUserBadge(message.user_role, message.userId);

    return (
      <motion.div
        initial={animations ? { opacity: 0, x: isOwnMessage ? 20 : -20 } : {}}
        animate={animations ? { opacity: 1, x: 0 } : {}}
        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-2 group`}
        role="listitem"
        aria-label={`Message from ${message.user}: ${message.message}`}
      >
        <div className={`max-w-[80%] ${isOwnMessage ? 'order-2' : 'order-1'}`}>
          <div className="flex items-center gap-2 mb-1">
            {!isOwnMessage && (
              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-primary-400 to-secondary-400 flex items-center justify-center text-xs text-white font-semibold">
                {message.user?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <span className={`text-sm ${getUsernameColor(message.user_role, message.userId)}`}>
              {badge && <span className="mr-1">{badge}</span>}
              {message.user}
            </span>
          </div>

          <div className={`
            px-3 py-2 rounded-lg text-sm
            ${isOwnMessage
              ? 'bg-primary-500 text-white'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
            }
          `}>
            {message.message || message.content}
          </div>

          {/* Moderation controls */}
          {(isCreator || isHost) && !isOwnMessage && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1 mt-1">
              <Tooltip content="Delete message">
                <button
                  onClick={() => handleModeration('delete', message.userId, message.id)}
                  className="p-1 rounded text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"
                  aria-label="Delete message"
                >
                  <TrashIcon className="w-3 h-3" />
                </button>
              </Tooltip>

              <Tooltip content="Mute user">
                <button
                  onClick={() => handleModeration('mute', message.userId)}
                  className="p-1 rounded text-yellow-500 hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                  aria-label="Mute user"
                >
                  <SpeakerXMarkIcon className="w-3 h-3" />
                </button>
              </Tooltip>

              <Tooltip content="Ban user">
                <button
                  onClick={() => handleModeration('ban', message.userId)}
                  className="p-1 rounded text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"
                  aria-label="Ban user"
                >
                  <EyeSlashIcon className="w-3 h-3" />
                </button>
              </Tooltip>

              <Tooltip content="Timeout (5 min)">
                <button
                  onClick={() => handleModeration('timeout', message.userId)}
                  className="p-1 rounded text-orange-500 hover:bg-orange-100 dark:hover:bg-orange-900/30"
                  aria-label="Timeout user"
                >
                  <FlagIcon className="w-3 h-3" />
                </button>
              </Tooltip>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl ${className}`}>
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <ChatBubbleLeftRightIcon className="w-5 h-5 text-primary-500" />
          <h3 className="font-semibold text-lg">Live Chat</h3>
          <div className="flex items-center gap-1 text-xs text-neutral-500">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span>{isConnected ? 'Connected' : 'Connecting...'}</span>
          </div>
        </div>

        {/* Moderation Controls */}
        {(isCreator || isHost) && (
          <div className="flex items-center gap-2">
            <Tooltip content={`Slow mode: ${slowMode}s`}>
              <Button
                size="xs"
                variant={slowMode > 0 ? 'primary' : 'ghost'}
                onClick={toggleSlowMode}
              >
                {slowMode > 0 ? `${slowMode}s` : 'Slow'}
              </Button>
            </Tooltip>

            <Tooltip content="Moderation settings">
              <Button
                size="xs"
                variant={moderationMode ? 'primary' : 'ghost'}
                onClick={() => setModerationMode(!moderationMode)}
                icon={<ShieldCheckIcon className="w-4 h-4" />}
              />
            </Tooltip>
          </div>
        )}
      </div>

      {/* Chat Stats */}
      {(isCreator || isHost) && (
        <div className="px-4 py-2 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex gap-4 text-xs text-neutral-600 dark:text-neutral-400">
            <span>Messages: {chatStats.messageCount}</span>
            {slowMode > 0 && <span className="text-yellow-600">Slow Mode: {slowMode}s</span>}
          </div>
        </div>
      )}

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0" role="log" aria-live="polite" aria-label="Chat messages">
        <AnimatePresence>
          {messages.map((message) => (
            <MessageComponent key={message.id} message={message} />
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={
              isConnected
                ? "Type a message..."
                : "Connecting..."
            }
            disabled={!isConnected}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            className="flex-1"
            size="sm"
          />

          <Button
            onClick={sendMessage}
            disabled={!newMessage.trim() || !isConnected}
            size="sm"
            className="px-4"
            icon={<PaperAirplaneIcon className="w-4 h-4" />}
          >
            Send
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mt-2">
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setNewMessage(prev => prev + '❤️')}
            className="text-xs"
            aria-label="Add heart emoji"
          >
            ❤️
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setNewMessage(prev => prev + '👍')}
            className="text-xs"
            aria-label="Add thumbs up emoji"
          >
            👍
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setNewMessage(prev => prev + '🔥')}
            className="text-xs"
            aria-label="Add fire emoji"
          >
            🔥
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setNewMessage(prev => prev + '💯')}
            className="text-xs"
            aria-label="Add 100 emoji"
          >
            💯
          </Button>
        </div>
      </div>
    </div>
  );
};

LiveChatSupabase.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string,
    supabase_id: PropTypes.string,
    displayName: PropTypes.string,
    email: PropTypes.string
  }).isRequired,
  channel: PropTypes.string.isRequired,
  isCreator: PropTypes.bool,
  isHost: PropTypes.bool,
  onSendGift: PropTypes.func,
  onSendTip: PropTypes.func,
  ticketHolders: PropTypes.arrayOf(PropTypes.string),
  className: PropTypes.string
};

LiveChatSupabase.defaultProps = {
  isCreator: false,
  isHost: false,
  ticketHolders: [],
  className: ''
};

export default memo(LiveChatSupabase);
