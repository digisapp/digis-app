import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PropTypes from 'prop-types';
import AC from 'agora-chat';
import { useTheme } from '../hooks/useTheme';
import { fetchUsernameById } from '../hooks/useUsername';
import { getAuthToken } from '../utils/auth-helpers';
import { AGORA_CHAT_CONFIG, CHAT_MESSAGE_TYPES, CHAT_ROOM_TYPES } from '../config/agoraChat';
import { 
  ChatBubbleLeftRightIcon, 
  ShieldCheckIcon, 
  EyeSlashIcon,
  SpeakerXMarkIcon,
  TrashIcon,
  FlagIcon,
  GiftIcon,
  PhotoIcon,
  PaperAirplaneIcon
} from '@heroicons/react/24/outline';
import Button from './ui/Button';
import Input from './ui/Input';
import Tooltip from './ui/Tooltip';
import toast from 'react-hot-toast';
import socketService from '../services/socketServiceWrapper';

const LiveChatEnhanced = ({
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
  const [isConnecting, setIsConnecting] = useState(false);
  const [moderationMode, setModerationMode] = useState(false);
  const [bannedUsers, setBannedUsers] = useState(new Set());
  const [mutedUsers, setMutedUsers] = useState(new Set());
  const [slowMode, setSlowMode] = useState(0);
  const [lastMessageTime, setLastMessageTime] = useState(0);
  const [chatFilters, setChatFilters] = useState({
    hideSpam: true,
    hideLinks: false,
    capsFilter: true,
    profanityFilter: true
  });
  const [userRoles, setUserRoles] = useState(new Map());
  const [userSubscriptions, setUserSubscriptions] = useState(new Map());
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [chatStats, setChatStats] = useState({
    messageCount: 0,
    activeUsers: 0,
    avgMessagesPerMinute: 0
  });
  const [usernames, setUsernames] = useState(new Map());
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef(null);
  const chatClientRef = useRef(null);
  const chatRoomRef = useRef(null);
  const typingTimerRef = useRef(null);

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
  }, [usernames]);

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

    if (chatFilters.hideLinks && message.msg && message.msg.includes('http')) {
      return true;
    }

    if (chatFilters.capsFilter && message.msg) {
      const capsRatio = message.msg.replace(/[^A-Z]/g, '').length / message.msg.length;
      if (capsRatio > 0.7 && message.msg.length > 10) {
        return true;
      }
    }

    return false;
  }, [bannedUsers, mutedUsers, chatFilters]);

  // Initialize Agora Chat SDK
  useEffect(() => {
    if (!channel || !user) return;

    const initChat = async () => {
      try {
        setIsConnecting(true);
        
        // Create Agora Chat client
        const conn = new AC.connection({
          appKey: AGORA_CHAT_CONFIG.appKey,
          isHttpDNS: AGORA_CHAT_CONFIG.isHttpDNS,
          delivery: AGORA_CHAT_CONFIG.delivery
        });
        
        chatClientRef.current = conn;

        // Get Agora Chat token from backend
        const authToken = await getAuthToken();
        const chatUserId = user.id || user.supabase_id || `user_${Date.now()}`;
        
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/agora/chat-token?userId=${chatUserId}`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        if (!response.ok) {
          console.error('Failed to get Chat token:', response.status);
          // Fallback to demo mode without token
          console.log('Using demo mode without token');
        }

        const tokenData = response.ok ? await response.json() : null;

        // Set up event listeners
        conn.addEventHandler('connection', {
          onConnected: () => {
            console.log('✅ Connected to Agora Chat');
            setIsConnected(true);
            setIsConnecting(false);
            joinChatRoom();
          },
          onDisconnected: () => {
            console.log('❌ Disconnected from Agora Chat');
            setIsConnected(false);
          },
          onError: (error) => {
            console.error('Agora Chat error:', error);
            setIsConnecting(false);
          }
        });

        // Set up message listener
        conn.addEventHandler('message', {
          onTextMessage: (message) => {
            handleIncomingMessage(message);
          },
          onImageMessage: (message) => {
            handleIncomingMessage(message);
          },
          onFileMessage: (message) => {
            handleIncomingMessage(message);
          },
          onCustomMessage: (message) => {
            handleCustomMessage(message);
          },
          onCmdMessage: (message) => {
            handleCommandMessage(message);
          }
        });

        // Set up presence listener
        conn.addEventHandler('presence', {
          onPresence: (message) => {
            handlePresenceUpdate(message);
          }
        });

        // Connect to Agora Chat
        if (tokenData && tokenData.token) {
          await conn.open({
            user: chatUserId,
            accessToken: tokenData.token
          });
        } else {
          // Demo mode - connect without token (if backend supports it)
          await conn.open({
            user: chatUserId,
            pwd: chatUserId // Using userId as password for demo
          });
        }

      } catch (error) {
        console.error('Chat initialization error:', error);
        toast.error('Failed to connect to chat');
        setIsConnecting(false);
      }
    };

    const joinChatRoom = async () => {
      try {
        // Join or create chat room
        const roomId = channel;
        const options = {
          roomId: roomId,
          message: 'Joined the stream'
        };

        const result = await chatClientRef.current.joinChatRoom(options);
        chatRoomRef.current = result.data;
        console.log('✅ Joined chat room:', roomId);

        // Get chat room details and members
        getChatRoomDetails(roomId);
        
      } catch (error) {
        console.error('Failed to join chat room:', error);
        // Try to create room if it doesn't exist
        if (isCreator) {
          createChatRoom();
        }
      }
    };

    const createChatRoom = async () => {
      try {
        const options = {
          name: `Stream: ${channel}`,
          description: 'Live stream chat room',
          maxusers: 5000,
          members: [],
          token: channel
        };

        const result = await chatClientRef.current.createChatRoom(options);
        chatRoomRef.current = result.data;
        console.log('✅ Created chat room:', result.data.id);
        
      } catch (error) {
        console.error('Failed to create chat room:', error);
      }
    };

    const getChatRoomDetails = async (roomId) => {
      try {
        const result = await chatClientRef.current.getChatRoomDetails({
          chatRoomId: roomId
        });
        
        if (result.data && result.data[0]) {
          const roomDetails = result.data[0];
          setOnlineUsers(new Set(roomDetails.affiliations_count || []));
          setChatStats(prev => ({
            ...prev,
            activeUsers: roomDetails.affiliations_count || 0
          }));
        }
      } catch (error) {
        console.error('Failed to get chat room details:', error);
      }
    };

    initChat();

    return () => {
      if (chatRoomRef.current && chatClientRef.current) {
        chatClientRef.current.leaveChatRoom({
          roomId: chatRoomRef.current
        }).catch(console.error);
      }
      if (chatClientRef.current) {
        chatClientRef.current.close();
      }
    };
  }, [channel, user, isCreator]);

  const handleIncomingMessage = useCallback(async (message) => {
    // Apply chat filters
    if (shouldFilterMessage(message, message.from)) {
      return;
    }

    const username = await fetchUsername(message.from);
    
    const formattedMessage = {
      id: message.id,
      type: 'chat',
      content: message.msg || message.url || '',
      timestamp: message.time,
      userId: message.from,
      userName: username,
      userRole: getUserRole(message.from),
      messageType: message.type,
      avatar: null
    };

    setMessages(prev => [...prev, formattedMessage]);
    
    // Update chat stats and emit for analytics
    setChatStats(prev => ({
      ...prev,
      messageCount: prev.messageCount + 1,
      lastActivity: Date.now()
    }));
    
    // Emit message event for real-time analytics
    socketService.emit('message-received', {
      channel,
      userId: message.from,
      timestamp: message.time
    });

    // Auto-scroll to bottom
    scrollToBottom();
    
  }, [shouldFilterMessage, fetchUsername]);

  const handleCustomMessage = useCallback((message) => {
    const customData = JSON.parse(message.customEvent || '{}');
    
    if (customData.type === 'gift') {
      // Handle gift message
      const giftMessage = {
        id: message.id,
        type: 'gift',
        content: `sent a ${customData.giftName}`,
        timestamp: message.time,
        userId: message.from,
        userName: customData.userName,
        giftValue: customData.value,
        giftIcon: customData.icon
      };
      setMessages(prev => [...prev, giftMessage]);
      
      if (onSendGift) {
        onSendGift(customData);
      }
      
      // Track gift for analytics
      socketService.emit('gift-sent', {
        channel,
        giftType: customData.giftName,
        value: customData.value,
        sender: message.from,
        timestamp: message.time
      });
    } else if (customData.type === 'tip') {
      // Handle tip message
      const tipMessage = {
        id: message.id,
        type: 'tip',
        content: `tipped ${customData.amount} tokens`,
        timestamp: message.time,
        userId: message.from,
        userName: customData.userName,
        tipAmount: customData.amount
      };
      setMessages(prev => [...prev, tipMessage]);
      
      if (onSendTip) {
        onSendTip(customData);
      }
      
      // Track tip for analytics
      socketService.emit('tip-sent', {
        channel,
        amount: customData.amount,
        sender: message.from,
        timestamp: message.time
      });
    }
  }, [onSendGift, onSendTip]);

  const handleCommandMessage = useCallback((message) => {
    const action = message.action;
    
    if (action === 'typing_start') {
      setTypingUsers(prev => new Set([...prev, message.from]));
    } else if (action === 'typing_stop') {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(message.from);
        return newSet;
      });
    }
  }, []);

  const handlePresenceUpdate = useCallback((message) => {
    // Handle user presence updates (online/offline status)
    console.log('Presence update:', message);
  }, []);

  const getUserRole = (userId) => {
    const currentUserId = user.id || user.supabase_id;
    if (userId === currentUserId && isCreator) return 'creator';
    if (userId === currentUserId && isHost) return 'host';
    if (userRoles.has(userId)) return userRoles.get(userId);
    return 'viewer';
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !chatClientRef.current || !isConnected) return;

    // Check slow mode
    if (slowMode > 0 && !isCreator && !isHost) {
      const timeSinceLastMessage = Date.now() - lastMessageTime;
      if (timeSinceLastMessage < slowMode * 1000) {
        toast.error(`Slow mode is active. Please wait ${slowMode} seconds between messages.`);
        return;
      }
    }

    try {
      const chatUserId = user.id || user.supabase_id || `user_${Date.now()}`;
      const username = await fetchUsername(chatUserId);
      
      // Create text message
      const option = {
        chatType: CHAT_ROOM_TYPES.CHAT_ROOM,
        type: CHAT_MESSAGE_TYPES.TEXT,
        to: chatRoomRef.current || channel,
        msg: newMessage.trim(),
        ext: {
          userName: username,
          userRole: getUserRole(chatUserId),
          avatar: user.photoURL || null
        }
      };

      const msg = AC.message.create(option);
      
      // Send message
      await chatClientRef.current.send(msg);
      
      // Emit message event for analytics tracking
      socketService.emit('message-sent', {
        channel,
        userId: chatUserId,
        messageLength: newMessage.trim().length,
        timestamp: Date.now()
      });
      
      // Add message to local state immediately
      const localMessage = {
        id: msg.id,
        type: 'chat',
        content: newMessage.trim(),
        timestamp: Date.now(),
        userId: chatUserId,
        userName: username,
        userRole: getUserRole(chatUserId),
        avatar: user.photoURL || null,
        isOwn: true
      };
      
      setMessages(prev => [...prev, localMessage]);
      setNewMessage('');
      setLastMessageTime(Date.now());
      scrollToBottom();

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const sendTypingIndicator = useCallback((isTyping) => {
    if (!chatClientRef.current || !isConnected || !chatRoomRef.current) return;
    
    try {
      const option = {
        chatType: CHAT_ROOM_TYPES.CHAT_ROOM,
        type: CHAT_MESSAGE_TYPES.CMD,
        to: chatRoomRef.current || channel,
        action: isTyping ? 'typing_start' : 'typing_stop'
      };
      
      const msg = AC.message.create(option);
      chatClientRef.current.send(msg);
      
    } catch (error) {
      console.error('Error sending typing indicator:', error);
    }
  }, [isConnected, channel]);

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    
    // Send typing indicator
    if (!isTyping) {
      setIsTyping(true);
      sendTypingIndicator(true);
    }
    
    // Clear existing timer
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    
    // Set new timer to stop typing indicator
    typingTimerRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTypingIndicator(false);
    }, 1000);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleModeration = async (action, targetUserId, messageId = null) => {
    if (!isCreator && !isHost) return;

    try {
      switch (action) {
        case 'ban':
          setBannedUsers(prev => new Set([...prev, targetUserId]));
          // Send ban command to server
          break;
        case 'mute':
          setMutedUsers(prev => new Set([...prev, targetUserId]));
          // Send mute command to server
          break;
        case 'delete':
          setMessages(prev => prev.filter(msg => msg.id !== messageId));
          // Send delete command to server
          break;
        case 'timeout':
          setMutedUsers(prev => new Set([...prev, targetUserId]));
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

      toast.success(`Moderation action: ${action}`);
      
    } catch (error) {
      console.error('Moderation action failed:', error);
      toast.error('Moderation action failed');
    }
  };

  const sendImage = async (file) => {
    if (!chatClientRef.current || !isConnected) return;

    try {
      const option = {
        chatType: CHAT_ROOM_TYPES.CHAT_ROOM,
        type: CHAT_MESSAGE_TYPES.IMAGE,
        to: chatRoomRef.current || channel,
        file: file,
        onFileUploadProgress: (progress) => {
          console.log('Upload progress:', progress);
        },
        onFileUploadComplete: () => {
          console.log('Upload complete');
        },
        onFileUploadError: (error) => {
          console.error('Upload error:', error);
          toast.error('Failed to upload image');
        }
      };

      const msg = AC.message.create(option);
      await chatClientRef.current.send(msg);
      
      toast.success('Image sent!');
      
    } catch (error) {
      console.error('Error sending image:', error);
      toast.error('Failed to send image');
    }
  };

  const renderMessage = (message) => {
    const isOwnMessage = message.isOwn || message.userId === (user.id || user.supabase_id);
    
    return (
      <motion.div
        key={message.id}
        initial={animations ? { opacity: 0, y: 10 } : {}}
        animate={animations ? { opacity: 1, y: 0 } : {}}
        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-3`}
      >
        <div className={`max-w-[70%] ${isOwnMessage ? 'order-2' : 'order-1'}`}>
          <div className={`rounded-lg px-4 py-2 ${
            isOwnMessage 
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white' 
              : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
          }`}>
            {!isOwnMessage && (
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-semibold text-sm">{message.userName}</span>
                {message.userRole === 'creator' && (
                  <span className="px-2 py-0.5 bg-yellow-500 text-black text-xs rounded-full font-bold">Creator</span>
                )}
                {message.userRole === 'host' && (
                  <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full font-bold">Host</span>
                )}
                {/* Ticket Holder VIP Badge */}
                {ticketHolders.includes(message.userId || message.from) && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="px-2 py-0.5 bg-gradient-to-r from-yellow-400 to-amber-500 text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-1"
                  >
                    🎫 VIP
                  </motion.span>
                )}
              </div>
            )}
            
            {message.type === 'gift' && (
              <div className="flex items-center gap-2">
                <GiftIcon className="w-5 h-5" />
                <span>{message.content}</span>
                {message.giftValue && (
                  <span className="font-bold">({message.giftValue} tokens)</span>
                )}
              </div>
            )}
            
            {message.type === 'tip' && (
              <div className="flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-yellow-400" />
                <span>{message.content}</span>
              </div>
            )}
            
            {message.type === 'chat' && (
              <p className="break-words">{message.content}</p>
            )}
            
            {message.messageType === 'img' && (
              <img 
                src={message.content} 
                alt="Shared image" 
                className="max-w-full rounded mt-2"
                onClick={() => window.open(message.content, '_blank')}
              />
            )}
          </div>
          
          {(isCreator || isHost) && !isOwnMessage && (
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => handleModeration('delete', message.userId, message.id)}
                className="text-xs text-gray-500 hover:text-red-500"
              >
                Delete
              </button>
              <button
                onClick={() => handleModeration('mute', message.userId)}
                className="text-xs text-gray-500 hover:text-orange-500"
              >
                Mute
              </button>
              <button
                onClick={() => handleModeration('ban', message.userId)}
                className="text-xs text-gray-500 hover:text-red-600"
              >
                Ban
              </button>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <ChatBubbleLeftRightIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <span className="font-semibold text-gray-800 dark:text-gray-200">
            Live Chat
          </span>
          {isConnected ? (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Connected
            </span>
          ) : isConnecting ? (
            <span className="flex items-center gap-1 text-xs text-yellow-600">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              Connecting...
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <div className="w-2 h-2 bg-gray-400 rounded-full" />
              Offline
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {onlineUsers.size} viewers
          </span>
          
          {(isCreator || isHost) && (
            <Tooltip content="Moderation Mode">
              <Button
                size="sm"
                variant={moderationMode ? 'primary' : 'ghost'}
                onClick={() => setModerationMode(!moderationMode)}
                icon={<ShieldCheckIcon className="w-4 h-4" />}
              />
            </Tooltip>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map(renderMessage)}
        
        {/* Typing Indicators */}
        {typingUsers.size > 0 && (
          <div className="text-sm text-gray-500 italic">
            {Array.from(typingUsers).slice(0, 3).join(', ')} 
            {typingUsers.size > 3 && ` and ${typingUsers.size - 3} others`} 
            {typingUsers.size === 1 ? ' is' : ' are'} typing...
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <input
            type="file"
            id="chat-image-upload"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                sendImage(file);
              }
            }}
          />
          
          <Tooltip content="Send Image">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => document.getElementById('chat-image-upload')?.click()}
              icon={<PhotoIcon className="w-5 h-5" />}
              disabled={!isConnected}
            />
          </Tooltip>
          
          <Input
            type="text"
            value={newMessage}
            onChange={handleTyping}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={isConnected ? "Type a message..." : "Connecting to chat..."}
            disabled={!isConnected}
            className="flex-1"
          />
          
          <Button
            size="sm"
            variant="primary"
            onClick={sendMessage}
            icon={<PaperAirplaneIcon className="w-5 h-5" />}
            disabled={!isConnected || !newMessage.trim()}
          >
            Send
          </Button>
        </div>
        
        {slowMode > 0 && !isCreator && !isHost && (
          <p className="text-xs text-gray-500 mt-2">
            Slow mode is on. You can send a message every {slowMode} seconds.
          </p>
        )}
      </div>
    </div>
  );
};

LiveChatEnhanced.propTypes = {
  user: PropTypes.object.isRequired,
  channel: PropTypes.string.isRequired,
  isCreator: PropTypes.bool,
  isHost: PropTypes.bool,
  onSendGift: PropTypes.func,
  onSendTip: PropTypes.func,
  className: PropTypes.string
};

export default memo(LiveChatEnhanced);