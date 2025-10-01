import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PaperAirplaneIcon,
  FaceSmileIcon,
  XMarkIcon,
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  StarIcon,
  VideoCameraIcon,
  PhoneIcon,
  MegaphoneIcon
} from '@heroicons/react/24/outline';

const InstantMessagingChat = ({ 
  user, 
  isCreator = false, 
  channelId, 
  websocket,
  onStartVideoCall,
  onStartVoiceCall,
  onSendTip,
  showOnlineFollowers = false,
  compact = false
}) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [onlineFollowers, setOnlineFollowers] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [replyTo, setReplyTo] = useState(null);
  const [reactions, setReactions] = useState(new Map());
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'followers'
  const [showMessageAllConfirm, setShowMessageAllConfirm] = useState(false);
  const [isMessageAll, setIsMessageAll] = useState(false);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Popular emojis for quick access
  const quickEmojis = ['😊', '😂', '❤️', '👍', '🎉', '🔥', '💎', '⭐', '👏', '🙌', '💯', '✨'];
  
  // Reaction emojis
  const reactionEmojis = [
    { emoji: '❤️', name: 'love', color: 'text-red-500' },
    { emoji: '🔥', name: 'fire', color: 'text-orange-500' },
    { emoji: '👍', name: 'like', color: 'text-blue-500' },
    { emoji: '😂', name: 'laugh', color: 'text-yellow-500' },
    { emoji: '😮', name: 'wow', color: 'text-purple-500' },
    { emoji: '💎', name: 'gem', color: 'text-cyan-500' }
  ];

  const handleWebSocketMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'connection_confirmed':
          setIsConnected(true);
          break;
        case 'channel_joined':
          setIsConnected(true);
          break;
        case 'new_message':
          if (data.channelId === channelId) {
            addMessage(data);
          }
          break;
        case 'user_joined_channel':
          if (data.channelId === channelId) {
            updateOnlineUsers(data.userId, data.username, 'join');
          }
          break;
        case 'user_left_channel':
          if (data.channelId === channelId) {
            updateOnlineUsers(data.userId, data.username, 'leave');
          }
          break;
        case 'reaction_sent':
          if (data.channelId === channelId) {
            handleReactionReceived(data);
          }
          break;
        case 'user_typing':
          if (data.channelId === channelId && data.userId !== user.uid) {
            handleUserTyping(data.userId, data.username);
          }
          break;
        case 'user_stopped_typing':
          if (data.channelId === channelId) {
            handleUserStoppedTyping(data.userId);
          }
          break;
        case 'followers_online_update':
          if (showOnlineFollowers) {
            handleFollowersUpdate(data.followers);
          }
          break;
        case 'follower_status_changed':
          if (showOnlineFollowers) {
            handleFollowerStatusChange(data.followerId, data.status);
          }
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }, [channelId, user.uid, showOnlineFollowers]);

  const setupWebSocketListeners = useCallback(() => {
    if (!websocket) return;

    websocket.addEventListener('message', handleWebSocketMessage);
  }, [websocket, handleWebSocketMessage]);

  const joinChannel = useCallback(() => {
    if (!websocket || !channelId) return;
    
    websocket.send(JSON.stringify({
      type: 'join_channel',
      channelId,
      channelType: isCreator ? 'creator_chat' : 'fan_chat'
    }));
  }, [websocket, channelId, isCreator]);

  const leaveChannel = useCallback(() => {
    if (!websocket || !channelId) return;
    
    websocket.send(JSON.stringify({
      type: 'leave_channel',
      channelId
    }));
  }, [websocket, channelId]);

  const requestFollowersUpdate = useCallback(() => {
    if (websocket && showOnlineFollowers) {
      websocket.send(JSON.stringify({
        type: 'request_followers_update',
        userId: user?.uid
      }));
    }
  }, [websocket, showOnlineFollowers, user?.uid]);

  useEffect(() => {
    if (websocket && channelId) {
      setupWebSocketListeners();
      joinChannel();
      
      // Request followers update if enabled
      if (showOnlineFollowers) {
        setTimeout(() => requestFollowersUpdate(), 1000);
      }
    }

    return () => {
      if (websocket && channelId) {
        leaveChannel();
      }
    };
  }, [websocket, channelId, setupWebSocketListeners, joinChannel, leaveChannel, requestFollowersUpdate, showOnlineFollowers]);

  // Online followers will be fetched from the server via WebSocket

  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  const sendMessage = () => {
    if (!newMessage.trim() || !websocket || !isConnected) return;

    const message = {
      type: isMessageAll ? 'send_message_all' : 'send_message',
      channelId,
      content: newMessage.trim(),
      messageType: 'text',
      replyTo: replyTo?.messageId || null,
      isMessageAll: isMessageAll
    };

    websocket.send(JSON.stringify(message));
    setNewMessage('');
    setReplyTo(null);
    setShowEmojiPicker(false);
    setIsMessageAll(false);
  };

  const handleMessageAll = () => {
    setShowMessageAllConfirm(true);
  };

  const confirmMessageAll = () => {
    setIsMessageAll(true);
    setShowMessageAllConfirm(false);
    inputRef.current?.focus();
  };

  const sendReaction = (reaction, targetType = 'chat', targetId = null) => {
    if (!websocket || !isConnected) return;

    websocket.send(JSON.stringify({
      type: 'send_reaction',
      channelId,
      reaction,
      targetType,
      targetId
    }));
  };

  const addMessage = (messageData) => {
    setMessages(prev => [...prev, {
      ...messageData,
      id: messageData.messageId,
      timestamp: new Date(messageData.timestamp)
    }]);
  };

  const updateOnlineUsers = (userId, username, action) => {
    setOnlineUsers(prev => {
      const updated = new Set(prev);
      if (action === 'join') {
        updated.add({ userId, username });
      } else {
        updated.delete(Array.from(updated).find(u => u.userId === userId));
      }
      return Array.from(updated);
    });
  };

  const handleReactionReceived = (reactionData) => {
    // Add floating reaction animation
    const reactionElement = document.createElement('div');
    reactionElement.textContent = reactionData.reaction;
    reactionElement.className = 'fixed pointer-events-none text-4xl animate-pulse z-50';
    reactionElement.style.left = Math.random() * window.innerWidth + 'px';
    reactionElement.style.top = window.innerHeight - 100 + 'px';
    
    document.body.appendChild(reactionElement);
    
    // Animate and remove
    setTimeout(() => {
      reactionElement.style.transform = 'translateY(-200px)';
      reactionElement.style.opacity = '0';
      reactionElement.style.transition = 'all 2s ease-out';
    }, 100);
    
    setTimeout(() => {
      document.body.removeChild(reactionElement);
    }, 2100);

    // Update reactions count
    setReactions(prev => {
      const updated = new Map(prev);
      const key = reactionData.reaction;
      updated.set(key, (updated.get(key) || 0) + 1);
      return updated;
    });
  };

  const handleUserTyping = (userId, username) => {
    setTypingUsers(prev => new Set([...prev, username]));
    
    // Clear typing after 3 seconds
    setTimeout(() => {
      setTypingUsers(prev => {
        const updated = new Set(prev);
        updated.delete(username);
        return updated;
      });
    }, 3000);
  };

  const handleUserStoppedTyping = (userId) => {
    // Remove from typing users
    setTypingUsers(prev => {
      const updated = new Set(prev);
      // Note: We'd need to map userId to username to remove properly
      return updated;
    });
  };

  const handleFollowersUpdate = (followers) => {
    setOnlineFollowers(followers);
  };

  const handleFollowerStatusChange = (followerId, status) => {
    setOnlineFollowers(prev => prev.map(follower => 
      follower.id === followerId 
        ? { ...follower, status, lastSeen: new Date().toISOString() }
        : follower
    ));
  };


  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    
    // Send typing indicator
    if (!isTyping && websocket && isConnected) {
      setIsTyping(true);
      websocket.send(JSON.stringify({
        type: 'user_typing',
        channelId
      }));
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      if (websocket && isConnected) {
        websocket.send(JSON.stringify({
          type: 'user_stopped_typing',
          channelId
        }));
      }
      setIsTyping(false);
    }, 1000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    inputRef.current?.focus();
  };

  return (
    <motion.div 
      className="flex flex-col h-full bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Chat Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ChatBubbleLeftRightIcon className="w-6 h-6" />
            <div>
              <h3 className="font-bold text-lg">
                Messages
              </h3>
              <div className="flex items-center gap-2 text-sm text-white/80">
                <UserGroupIcon className="w-4 h-4" />
                <span>{onlineUsers.length} online</span>
                {isConnected ? (
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    Connected
                  </span>
                ) : (
                  <span className="text-red-300">Connecting...</span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {!isCreator && (
              <>
                <motion.button
                  onClick={() => onStartVideoCall?.()}
                  className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-all"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="Start Video Call"
                >
                  <VideoCameraIcon className="w-5 h-5" />
                </motion.button>
                <motion.button
                  onClick={() => onStartVoiceCall?.()}
                  className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-all"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="Start Voice Call"
                >
                  <PhoneIcon className="w-5 h-5" />
                </motion.button>
                <motion.button
                  onClick={() => onSendTip?.()}
                  className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-all"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="Send Tip"
                >
                  💰
                </motion.button>
              </>
            )}
          </div>
        </div>
        </div>

        {/* Tabs for Chat and Followers */}
        {showOnlineFollowers && (
          <div className="flex border-t border-white/20">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-all ${
                activeTab === 'chat'
                  ? 'bg-white/20 text-white border-b-2 border-white'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              💬 Chat ({messages.length})
            </button>
            <button
              onClick={() => setActiveTab('followers')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-all ${
                activeTab === 'followers'
                  ? 'bg-white/20 text-white border-b-2 border-white'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              👥 Followers ({onlineFollowers.filter(f => f.status === 'online').length})
            </button>
          </div>
        )}
      </div>

      {/* Live Reactions Display */}
      <AnimatePresence>
        {Array.from(reactions.entries()).map(([reaction, count]) => (
          <motion.div
            key={reaction}
            className="absolute top-20 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm z-10"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
          >
            {reaction} {count}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Quick Reaction Bar */}
      <div className="p-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 font-medium">Quick React:</span>
          {reactionEmojis.map((reaction) => (
            <motion.button
              key={reaction.name}
              onClick={() => sendReaction(reaction.emoji)}
              className={`text-2xl hover:scale-110 transition-transform ${reaction.color}`}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
              title={reaction.name}
            >
              {reaction.emoji}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'chat' || !showOnlineFollowers ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        <AnimatePresence>
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              className={`flex ${message.senderId === user.uid ? 'justify-end' : 'justify-start'}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <div className={`max-w-xs lg:max-w-md ${
                message.senderId === user.uid 
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-900'
              } rounded-2xl px-4 py-3 shadow-sm`}>
                
                {/* Reply indicator */}
                {message.replyTo && (
                  <div className="text-xs opacity-75 mb-2 border-l-2 border-white/30 pl-2">
                    Replying to message...
                  </div>
                )}

                {/* Sender info for others' messages */}
                {message.senderId !== user.uid && (
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-purple-600">
                      {message.senderUsername}
                    </span>
                    {message.senderIsCreator && (
                      <StarIcon className="w-4 h-4 text-yellow-500 fill-current" />
                    )}
                  </div>
                )}

                {/* Message content */}
                <p className="break-words">{message.content}</p>
                
                {/* Timestamp */}
                <div className={`text-xs mt-1 ${
                  message.senderId === user.uid ? 'text-white/70' : 'text-gray-500'
                }`}>
                  {formatTime(message.timestamp)}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicators */}
        {typingUsers.size > 0 && (
          <motion.div
            className="flex items-center gap-2 text-gray-500 text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            </div>
            <span>
              {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
            </span>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
        </div>
      ) : (
        /* Followers View */
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          <div className="text-sm text-gray-600 mb-4">
            Your followers ({onlineFollowers.length} total, {onlineFollowers.filter(f => f.status === 'online').length} online)
          </div>
          
          <AnimatePresence>
            {onlineFollowers.map((follower, index) => (
              <motion.div
                key={follower.id}
                className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl hover:border-purple-300 transition-all"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center text-white font-bold">
                      {follower.username[0]?.toUpperCase()}
                    </div>
                    {/* Status indicator */}
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                      follower.status === 'online' ? 'bg-green-500' : 
                      follower.status === 'away' ? 'bg-yellow-500' : 'bg-gray-400'
                    }`} />
                    {/* Live indicator */}
                    {follower.isLive && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      </div>
                    )}
                  </div>

                  {/* User info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{follower.username}</span>
                      {follower.isLive && (
                        <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full">
                          {follower.liveType === 'stream' ? '📡 Live' : 
                           follower.liveType === 'voice' ? '🎙️ Voice' : '📹 Video'}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {follower.status === 'online' ? 'Online now' : 
                       `Last seen ${formatTime(follower.lastSeen)}`}
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1">
                  {follower.status === 'online' && (
                    <>
                      <motion.button
                        onClick={() => {
                          // Start private message
                          console.log('Starting private message with', follower.username);
                        }}
                        className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        title="Send Message"
                      >
                        💬
                      </motion.button>
                      
                      {follower.isLive && (
                        <motion.button
                          onClick={() => {
                            // Join their live stream/call
                            console.log('Joining live stream of', follower.username);
                          }}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          title="Join Live Stream"
                        >
                          {follower.liveType === 'stream' ? '📡' : 
                           follower.liveType === 'voice' ? '🎙️' : '📹'}
                        </motion.button>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {onlineFollowers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <UserGroupIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-lg font-medium mb-1">No followers yet</p>
              <p className="text-sm">Share your creator profile to gain followers!</p>
            </div>
          )}
        </div>
      )}

      {/* Reply indicator */}
      {replyTo && (
        <div className="px-4 py-2 bg-blue-50 border-l-4 border-blue-500 flex items-center justify-between">
          <div className="text-sm">
            <span className="text-blue-600 font-medium">Replying to:</span>
            <span className="ml-2 text-gray-700">{replyTo.content.substring(0, 50)}...</span>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Emoji Picker */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            className="p-4 bg-white border-t border-gray-200"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="grid grid-cols-6 gap-2">
              {quickEmojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => addEmojiToMessage(emoji)}
                  className="text-2xl p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message Input - Only show in chat mode */}
      {(activeTab === 'chat' || !showOnlineFollowers) && (
        <div className="p-4 bg-gray-50 border-t border-gray-200">
        {/* Message All notification */}
        {isMessageAll && (
          <div className="mb-3 px-3 py-2 bg-purple-100 text-purple-800 rounded-lg text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MegaphoneIcon className="w-4 h-4" />
              Sending message to all fans
            </span>
            <button
              onClick={() => setIsMessageAll(false)}
              className="text-purple-600 hover:text-purple-800"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        )}
        
        <div className="flex items-end gap-3">
          {/* Emoji button */}
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <FaceSmileIcon className="w-6 h-6" />
          </button>

          {/* Message All button - Only show for creators */}
          {isCreator && !isMessageAll && (
            <button
              onClick={handleMessageAll}
              className="p-2 text-purple-600 hover:text-purple-700 transition-colors"
              title="Message all fans"
            >
              <MegaphoneIcon className="w-6 h-6" />
            </button>
          )}

          {/* Message input */}
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={isMessageAll ? 'Message all your fans...' : `Message ${isCreator ? 'your fans' : 'the creator'}...`}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              rows="1"
              disabled={!isConnected}
            />
          </div>

          {/* Send button */}
          <motion.button
            onClick={sendMessage}
            disabled={!newMessage.trim() || !isConnected}
            className="p-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            whileHover={{ scale: newMessage.trim() && isConnected ? 1.05 : 1 }}
            whileTap={{ scale: newMessage.trim() && isConnected ? 0.95 : 1 }}
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </motion.button>
        </div>
        </div>
      )}

      {/* Message All Confirmation Modal */}
      <AnimatePresence>
        {showMessageAllConfirm && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowMessageAllConfirm(false)}
          >
            <motion.div
              className="bg-white rounded-2xl p-6 max-w-md w-full"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <MegaphoneIcon className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Message All Fans</h3>
                  <p className="text-sm text-gray-600">Send a message to all your fans at once</p>
                </div>
              </div>

              <p className="text-gray-700 mb-6">
                This will send your message to all fans who have interacted with you. 
                Use this feature responsibly to share important updates or announcements.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowMessageAllConfirm(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmMessageAll}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors"
                >
                  Continue
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default InstantMessagingChat;