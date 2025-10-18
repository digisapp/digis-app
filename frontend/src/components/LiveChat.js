import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PropTypes from 'prop-types';
import AgoraRTM from 'agora-rtm-sdk';
import { useTheme } from '../hooks/useTheme';
import { fetchUsernameById } from '../hooks/useUsername';
import { getAuthToken } from '../utils/auth-helpers';
import { 
  ChatBubbleLeftRightIcon, 
  ShieldCheckIcon, 
  EyeSlashIcon,
  SpeakerXMarkIcon,
  TrashIcon,
  FlagIcon,
  GiftIcon
} from '@heroicons/react/24/outline';
import Button from './ui/Button';
import Input from './ui/Input';
import Tooltip from './ui/Tooltip';

const LiveChat = ({ 
  user, 
  channel, 
  isCreator = false, 
  isHost = false,
  onSendGift,
  onSendTip,
  className = '' 
}) => {
  const { animations } = useTheme();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [moderationMode, setModerationMode] = useState(false);
  const [bannedUsers, setBannedUsers] = useState(new Set());
  const [mutedUsers, setMutedUsers] = useState(new Set());
  const [slowMode, setSlowMode] = useState(0);
  const [lastMessageTime, setLastMessageTime] = useState(0);
  // eslint-disable-next-line no-unused-vars
  const [chatFilters, setChatFilters] = useState({
    hideSpam: true,
    hideLinks: false,
    capsFilter: true,
    profanityFilter: true
  });
  // eslint-disable-next-line no-unused-vars
  const [userRoles, setUserRoles] = useState(new Map());
  const [userSubscriptions, setUserSubscriptions] = useState(new Map());
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [chatStats, setChatStats] = useState({
    messageCount: 0,
    activeUsers: 0,
    avgMessagesPerMinute: 0
  });
  const [usernames, setUsernames] = useState(new Map());

  const messagesEndRef = useRef(null);
  const rtmClientRef = useRef(null);
  const rtmChannelRef = useRef(null);

  const fetchUsername = useCallback(async (userId) => {
    if (usernames.has(userId)) {
      return usernames.get(userId);
    }

    try {
      const authToken = await getAuthToken();
      const username = await fetchUsernameById(userId, authToken);
      setUsernames(prev => new Map(prev.set(userId, username)));
      return username;
    } catch (error) {
      console.error('Error fetching username:', error);
      return `User${userId.slice(-4)}`;
    }
  }, [user, usernames]);


  const shouldFilterMessage = useCallback((message, senderId) => {
    // Check if user is banned
    if (bannedUsers.has(senderId)) {
      return true;
    }

    // Check if user is muted
    if (mutedUsers.has(senderId)) {
      return true;
    }

    // Apply chat filters based on settings
    if (chatFilters.hideSpam && message.type === 'spam') {
      return true;
    }

    if (chatFilters.hideLinks && message.content && message.content.includes('http')) {
      return true;
    }

    if (chatFilters.capsFilter && message.content) {
      const capsRatio = message.content.replace(/[^A-Z]/g, '').length / message.content.length;
      if (capsRatio > 0.7 && message.content.length > 10) {
        return true;
      }
    }

    return false;
  }, [bannedUsers, mutedUsers, chatFilters]);

  const fetchUserSubscription = useCallback(async (userId) => {
    try {
      const authToken = await getAuthToken();
      const response = await fetch(`/api/subscriptions/status/${userId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.subscribed) {
          setUserSubscriptions(prev => new Map(prev.set(userId, data)));
        }
      }
    } catch (error) {
      console.error('Error fetching user subscription:', error);
    }
  }, [user]);

  const handleChannelMessage = useCallback((message, memberId) => {
    try {
      const parsedMessage = JSON.parse(message.text);
      
      // Apply chat filters
      if (shouldFilterMessage(parsedMessage, memberId)) {
        return;
      }

      setMessages(prev => [...prev, {
        ...parsedMessage,
        id: Date.now() + Math.random(),
        timestamp: parsedMessage.timestamp || Date.now()
      }]);

      // Update chat stats
      setChatStats(prev => ({
        ...prev,
        messageCount: prev.messageCount + 1,
        lastActivity: Date.now()
      }));

    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }, [shouldFilterMessage]);

  const handleMemberJoinedUpdate = useCallback(async (memberId) => {
    setOnlineUsers(prev => new Set([...prev, memberId]));
    setChatStats(prev => ({
      ...prev,
      activeUsers: prev.activeUsers + 1
    }));

    // Fetch user subscription status and username
    await fetchUserSubscription(memberId);
    await fetchUsername(memberId);
  }, [fetchUserSubscription, fetchUsername]);

  const handleMemberLeftUpdate = useCallback((memberId) => {
    setOnlineUsers(prev => {
      const newSet = new Set(prev);
      newSet.delete(memberId);
      return newSet;
    });
    setChatStats(prev => ({
      ...prev,
      activeUsers: Math.max(0, prev.activeUsers - 1)
    }));
  }, []);

  // Initialize Agora RTM for chat
  useEffect(() => {
    if (!channel || !user) return;

    const initRTM = async () => {
      try {
        // Use imported Agora RTM SDK
        if (!AgoraRTM) {
          console.error('Agora RTM SDK not available');
          return;
        }

        const rtmClient = AgoraRTM.createInstance(import.meta.env.VITE_AGORA_APP_ID);
        rtmClientRef.current = rtmClient;

        // Get RTM token from backend
        const authToken = await getAuthToken();
        // Use user.id (supabase ID) or fallback to a string representation
        const rtmUserId = user.id || user.supabase_id || `user_${Date.now()}`;
        
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/agora/rtm-token?uid=${rtmUserId}`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        if (!response.ok) {
          console.error('Failed to get RTM token:', response.status, response.statusText);
          throw new Error('Failed to get RTM token');
        }

        const data = await response.json();

        // Login to RTM with string user ID
        await rtmClient.login({ token: data.rtmToken, uid: rtmUserId });
        setIsConnected(true);

        // Join channel
        const rtmChannel = rtmClient.createChannel(channel);
        rtmChannelRef.current = rtmChannel;
        await rtmChannel.join();

        // Set up event listeners
        rtmChannel.on('ChannelMessage', handleChannelMessage);
        rtmChannel.on('MemberJoined', handleMemberJoinedUpdate);
        rtmChannel.on('MemberLeft', handleMemberLeftUpdate);

        // Send join notification  
        const username = await fetchUsername(rtmUserId);
        const joinMessage = {
          type: 'system',
          content: `@${username} joined the chat`,
          timestamp: Date.now(),
          userId: rtmUserId,
          userName: username
        };

        await rtmChannel.sendMessage({
          text: JSON.stringify(joinMessage),
          messageType: 'TEXT'
        });

      } catch (error) {
        console.error('RTM initialization error:', error);
      }
    };

    initRTM();

    return () => {
      if (rtmChannelRef.current) {
        rtmChannelRef.current.leave();
      }
      if (rtmClientRef.current) {
        rtmClientRef.current.logout();
      }
    };
  }, [channel, user, handleChannelMessage, handleMemberJoinedUpdate, handleMemberLeftUpdate, fetchUsername]);


  const sendMessage = async () => {
    if (!newMessage.trim() || !rtmChannelRef.current || !isConnected) return;

    // Check slow mode
    if (slowMode > 0 && !isCreator && !isHost) {
      const timeSinceLastMessage = Date.now() - lastMessageTime;
      if (timeSinceLastMessage < slowMode * 1000) {
        alert(`Slow mode is active. Please wait ${slowMode} seconds between messages.`);
        return;
      }
    }

    try {
      const rtmUserId = user.id || user.supabase_id || `user_${Date.now()}`;
      const username = await fetchUsername(rtmUserId);
      const message = {
        type: 'chat',
        content: newMessage.trim(),
        timestamp: Date.now(),
        userId: rtmUserId,
        userName: username,
        userRole: getUserRole(rtmUserId),
        avatar: user.photoURL || null
      };

      await rtmChannelRef.current.sendMessage({
        text: JSON.stringify(message),
        messageType: 'TEXT'
      });

      setNewMessage('');
      setLastMessageTime(Date.now());

    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const getUserRole = (userId) => {
    const currentUserId = user.id || user.supabase_id;
    if (userId === currentUserId && isCreator) return 'creator';
    if (userId === currentUserId && isHost) return 'host';
    if (userRoles.has(userId)) return userRoles.get(userId);
    return 'viewer';
  };


  const handleModeration = async (action, targetUserId, messageId = null) => {
    if (!isCreator && !isHost) return;

    try {
      const rtmUserId = user.id || user.supabase_id || `user_${Date.now()}`;
      const moderationMessage = {
        type: 'moderation',
        action,
        targetUserId,
        messageId,
        moderatorId: rtmUserId,
        timestamp: Date.now()
      };

      switch (action) {
        case 'ban':
          setBannedUsers(prev => new Set([...prev, targetUserId]));
          break;
        case 'mute':
          setMutedUsers(prev => new Set([...prev, targetUserId]));
          break;
        case 'delete':
          setMessages(prev => prev.filter(msg => msg.id !== messageId));
          break;
        case 'timeout':
          setTimeout(() => {
            setMutedUsers(prev => {
              const newSet = new Set(prev);
              newSet.delete(targetUserId);
              return newSet;
            });
          }, 300000); // 5 minutes
          break;
        default:
          console.warn('Unknown moderation action:', action);
          break;
      }

      await rtmChannelRef.current.sendMessage({
        text: JSON.stringify(moderationMessage),
        messageType: 'TEXT'
      });

    } catch (error) {
      console.error('Moderation action failed:', error);
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
    if (userRole === 'creator') {
      return 'text-purple-500 font-bold'; // Purple for creators
    }
    if (userRole === 'host') {
      return 'text-blue-500 font-bold'; // Blue for host
    }
    
    // Check subscription status for fans
    const subscription = userSubscriptions.get(userId);
    if (subscription) {
      // All subscribers get the same styling - no tiers
      return 'text-purple-500 font-semibold'; // Purple for all subscribers
    }
    
    // Default color for regular users
    return 'text-gray-600 dark:text-gray-400 font-medium';
  };

  const MessageComponent = ({ message }) => {
    const isOwnMessage = message.userId === user.uid;
    const isSystemMessage = message.type === 'system';
    const isGiftMessage = message.type === 'gift';

    if (isSystemMessage) {
      return (
        <motion.div
          initial={animations ? { opacity: 0, y: 10 } : {}}
          animate={animations ? { opacity: 1, y: 0 } : {}}
          className="text-center text-xs text-neutral-500 dark:text-neutral-400 py-1"
        >
          {message.content}
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
              {message.userName}
            </span>
            <span className="text-sm">sent a gift!</span>
            <span className="text-lg">{message.giftEmoji}</span>
          </div>
          {message.message && (
            <p className="text-sm mt-1 text-neutral-600 dark:text-neutral-300">
              "{message.message}"
            </p>
          )}
        </motion.div>
      );
    }

    return (
      <motion.div
        initial={animations ? { opacity: 0, x: isOwnMessage ? 20 : -20 } : {}}
        animate={animations ? { opacity: 1, x: 0 } : {}}
        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-2 group`}
        role="listitem"
        aria-label={`Message from ${message.userName}: ${message.content}`}
      >
        <div className={`max-w-[80%] ${isOwnMessage ? 'order-2' : 'order-1'}`}>
          <div className="flex items-center gap-2 mb-1">
            {!isOwnMessage && (
              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-primary-400 to-secondary-400 flex items-center justify-center text-xs text-white font-semibold">
                {message.userName?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <span className={`text-sm ${getUsernameColor(message.userRole, message.userId)}`}>
              {message.userName}
            </span>
          </div>
          
          <div className={`
            px-3 py-2 rounded-lg text-sm
            ${isOwnMessage 
              ? 'bg-primary-500 text-white' 
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
            }
          `}>
            {message.content}
          </div>

          {/* Moderation controls */}
          {(isCreator || isHost) && !isOwnMessage && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1 mt-1">
              <Tooltip content="Delete message">
                <button
                  onClick={() => handleModeration('delete', message.userId, message.id)}
                  className="p-1 rounded text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"
                  aria-label="Delete message"
                  onKeyDown={(e) => e.key === 'Enter' && handleModeration('delete', message.userId, message.id)}
                >
                  <TrashIcon className="w-3 h-3" />
                </button>
              </Tooltip>
              
              <Tooltip content="Mute user">
                <button
                  onClick={() => handleModeration('mute', message.userId)}
                  className="p-1 rounded text-yellow-500 hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                  aria-label="Mute user"
                  onKeyDown={(e) => e.key === 'Enter' && handleModeration('mute', message.userId)}
                >
                  <SpeakerXMarkIcon className="w-3 h-3" />
                </button>
              </Tooltip>
              
              <Tooltip content="Ban user">
                <button
                  onClick={() => handleModeration('ban', message.userId)}
                  className="p-1 rounded text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"
                  aria-label="Ban user"
                  onKeyDown={(e) => e.key === 'Enter' && handleModeration('ban', message.userId)}
                >
                  <EyeSlashIcon className="w-3 h-3" />
                </button>
              </Tooltip>
              
              <Tooltip content="Report message">
                <button
                  onClick={() => handleModeration('report', message.userId, message.id)}
                  className="p-1 rounded text-orange-500 hover:bg-orange-100 dark:hover:bg-orange-900/30"
                  aria-label="Report message"
                  onKeyDown={(e) => e.key === 'Enter' && handleModeration('report', message.userId, message.id)}
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
            <span>{onlineUsers.size} online</span>
          </div>
        </div>

        {/* Color Legend & Moderation Controls */}
        <div className="flex items-center gap-3">
          {/* Color Legend Dropdown */}
          <Tooltip 
            content={
              <div className="text-xs space-y-1 p-1">
                <div className="text-gray-800 dark:text-white font-semibold mb-2">User Colors</div>
                <div className="flex items-center gap-2">
                  <span className="text-purple-500">●</span>
                  <span>Creator</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-500">●</span>
                  <span>Host</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-yellow-500">●</span>
                  <span>VIP Fan</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-500">●</span>
                  <span>Subscriber</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">●</span>
                  <span>Guest</span>
                </div>
              </div>
            }
            placement="bottom"
          >
            <button className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2 L12 12 L19.5 5.5" fill="currentColor" opacity="0.8" />
                <path d="M12 12 L19.5 5.5 L19.5 18.5" fill="currentColor" opacity="0.6" />
                <path d="M12 12 L19.5 18.5 L4.5 18.5" fill="currentColor" opacity="0.4" />
                <path d="M12 12 L4.5 18.5 L4.5 5.5" fill="currentColor" opacity="0.2" />
              </svg>
            </button>
          </Tooltip>

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
      </div>

      {/* Chat Stats */}
      {(isCreator || isHost) && (
        <div className="px-4 py-2 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex gap-4 text-xs text-neutral-600 dark:text-neutral-400">
            <span>Messages: {chatStats.messageCount}</span>
            <span>Active: {chatStats.activeUsers}</span>
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
                ? mutedUsers.has(user.uid) 
                  ? "You are muted"
                  : bannedUsers.has(user.uid)
                  ? "You are banned"
                  : "Type a message..."
                : "Connecting..."
            }
            disabled={!isConnected || mutedUsers.has(user.uid) || bannedUsers.has(user.uid)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            className="flex-1"
            size="sm"
          />
          
          <Button
            onClick={sendMessage}
            disabled={!newMessage.trim() || !isConnected || mutedUsers.has(user.uid) || bannedUsers.has(user.uid)}
            size="sm"
            className="px-4"
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

LiveChat.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    uid: PropTypes.string.isRequired,
    photoURL: PropTypes.string
  }).isRequired,
  channel: PropTypes.string.isRequired,
  isCreator: PropTypes.bool,
  isHost: PropTypes.bool,
  onSendGift: PropTypes.func,
  onSendTip: PropTypes.func,
  className: PropTypes.string
};

LiveChat.defaultProps = {
  isCreator: false,
  isHost: false,
  className: ''
};

export default memo(LiveChat);