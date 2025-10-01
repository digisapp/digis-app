import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  XMarkIcon,
  UserCircleIcon,
  MinusIcon
} from '@heroicons/react/24/outline';
// Remove the useUsername import as it's not actually used
// import { useUsername } from '../hooks/useUsername';
import { getAuthToken } from '../utils/auth-helpers';

const InstantChatWidget = ({ user, onSendMessage, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeChats, setActiveChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const rtmClientRef = useRef(null);

  const handleDirectMessage = useCallback((message, peerId) => {
    try {
      const parsedMessage = JSON.parse(message.text);
      
      // Add message to appropriate chat
      setActiveChats(prev => {
        const existingChatIndex = prev.findIndex(chat => chat.userId === peerId);
        if (existingChatIndex >= 0) {
          const updatedChats = [...prev];
          updatedChats[existingChatIndex].messages.push({
            id: Date.now() + Math.random(),
            ...parsedMessage,
            timestamp: Date.now(),
            incoming: true
          });
          return updatedChats;
        } else {
          // Create new chat
          return [...prev, {
            userId: peerId,
            username: parsedMessage.senderUsername || 'Unknown User',
            messages: [{
              id: Date.now() + Math.random(),
              ...parsedMessage,
              timestamp: Date.now(),
              incoming: true
            }],
            unreadCount: 1
          }];
        }
      });

      // Auto-open widget if closed
      if (!isOpen) {
        setIsOpen(true);
      }

    } catch (error) {
      console.error('Error parsing direct message:', error);
    }
  }, [isOpen]);

  // Initialize Agora RTM for instant messaging
  useEffect(() => {
    if (!user) return;

    const initRTM = async () => {
      try {
        // Import Agora RTM SDK dynamically
        const AgoraRTM = window.AgoraRTM;
        if (!AgoraRTM) {
          console.error('Agora RTM SDK not loaded');
          return;
        }

        const rtmClient = AgoraRTM.createInstance(import.meta.env.VITE_AGORA_APP_ID);
        rtmClientRef.current = rtmClient;

        // Get RTM token from backend
        const authToken = await getAuthToken();
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/agora/rtm-token?uid=${user.id}`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to get RTM token');
        }

        const data = await response.json();

        // Login to RTM
        await rtmClient.login({ token: data.rtmToken, uid: user.id });
        setIsConnected(true);

        // Set up event listeners for direct messages
        rtmClient.on('MessageFromPeer', handleDirectMessage);

      } catch (error) {
        console.error('RTM initialization error:', error);
      }
    };

    initRTM();

    return () => {
      if (rtmClientRef.current) {
        rtmClientRef.current.logout();
      }
    };
  }, [user, handleDirectMessage]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || !rtmClientRef.current || !isConnected) return;

    try {
      // Calculate pricing based on message type
      const messageType = detectMessageType(newMessage);
      let cost = 0;

      // For now, treating all as text messages - this would be expanded based on message content
      if (messageType === 'text') cost = selectedChat.textMessagePrice || 1;
      else if (messageType === 'image') cost = selectedChat.imageMessagePrice || 3;
      else if (messageType === 'video') cost = selectedChat.videoMessagePrice || 5;
      else if (messageType === 'voice') cost = selectedChat.voiceMemoPrice || 2;

      // Check user balance
      const balanceResponse = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/tokens/balance`,
        {
          headers: {
            'Authorization': `Bearer ${await getAuthToken()}`
          }
        }
      );

      const balanceData = await balanceResponse.json();
      if (balanceData.balance < cost) {
        alert(`Insufficient tokens. You need ${cost} tokens to send this message.`);
        return;
      }

      const messageData = {
        type: messageType,
        content: newMessage.trim(),
        senderUsername: user.displayName || user.email?.split('@')[0],
        cost: cost
      };

      // Send message via RTM
      await rtmClientRef.current.sendMessageToPeer({
        text: JSON.stringify(messageData),
        messageType: 'TEXT'
      }, selectedChat.userId);

      // Deduct tokens from sender and add to creator
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({
          recipientId: selectedChat.userId,
          messageType,
          content: newMessage.trim(),
          cost
        })
      });

      // Add message to local chat
      setActiveChats(prev => {
        const updatedChats = [...prev];
        const chatIndex = updatedChats.findIndex(chat => chat.userId === selectedChat.userId);
        if (chatIndex >= 0) {
          updatedChats[chatIndex].messages.push({
            id: Date.now() + Math.random(),
            ...messageData,
            timestamp: Date.now(),
            incoming: false
          });
        }
        return updatedChats;
      });

      setNewMessage('');
      onSendMessage?.(messageData);

    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const detectMessageType = (content) => {
    // Simple detection - in reality this would be more sophisticated
    if (content.includes('http') && (content.includes('.jpg') || content.includes('.png'))) {
      return 'image';
    }
    if (content.includes('http') && content.includes('.mp4')) {
      return 'video';
    }
    return 'text';
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [selectedChat?.messages]);

  // eslint-disable-next-line no-unused-vars
  const startNewChat = async (creatorUsername) => {
    try {
      // Find creator by username
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/users/username/${creatorUsername}`,
        {
          headers: {
            'Authorization': `Bearer ${await getAuthToken()}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const newChat = {
          userId: data.user.supabase_id,
          username: creatorUsername,
          messages: [],
          unreadCount: 0,
          textMessagePrice: data.user.textMessagePrice || 1,
          imageMessagePrice: data.user.imageMessagePrice || 3,
          videoMessagePrice: data.user.videoMessagePrice || 5,
          voiceMemoPrice: data.user.voiceMemoPrice || 2
        };

        setActiveChats(prev => [...prev, newChat]);
        setSelectedChat(newChat);
        setIsOpen(true);
      }
    } catch (error) {
      console.error('Error starting new chat:', error);
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Chat Widget Toggle Button */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.05 }}
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-6 right-6 z-50 bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all ${className}`}
        >
          <ChatBubbleLeftRightIcon className="w-6 h-6" />
          {activeChats.reduce((sum, chat) => sum + chat.unreadCount, 0) > 0 && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {activeChats.reduce((sum, chat) => sum + chat.unreadCount, 0)}
            </div>
          )}
        </motion.button>
      )}

      {/* Chat Widget */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 100 }}
            className={`fixed bottom-6 right-6 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 ${
              isMinimized ? 'w-80 h-16' : 'w-96 h-[500px]'
            } transition-all duration-300 ${className}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-t-2xl">
              <div className="flex items-center gap-2">
                <ChatBubbleLeftRightIcon className="w-5 h-5" />
                <h3 className="font-semibold">
                  {selectedChat ? `@${selectedChat.username}` : 'Messages'}
                </h3>
                {isConnected && (
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1 hover:bg-white/20 rounded"
                >
                  <MinusIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-white/20 rounded"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Chat List / Messages */}
                <div className="flex-1 overflow-hidden">
                  {!selectedChat ? (
                    // Chat List
                    <div className="h-96 overflow-y-auto p-4">
                      {activeChats.length === 0 ? (
                        <div className="text-center py-12">
                          <ChatBubbleLeftRightIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-500">No active chats</p>
                          <p className="text-sm text-gray-400 mt-2">
                            Start messaging creators from their profiles
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {activeChats.map((chat, index) => (
                            <button
                              key={chat.userId}
                              onClick={() => setSelectedChat(chat)}
                              className="w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg flex items-center gap-3 transition-colors"
                            >
                              <UserCircleIcon className="w-10 h-10 text-gray-400" />
                              <div className="flex-1 text-left">
                                <div className="font-medium">@{chat.username}</div>
                                <div className="text-sm text-gray-500 truncate">
                                  {chat.messages[chat.messages.length - 1]?.content || 'No messages'}
                                </div>
                              </div>
                              {chat.unreadCount > 0 && (
                                <div className="bg-purple-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                  {chat.unreadCount}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    // Messages View
                    <div className="h-96 flex flex-col">
                      <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {selectedChat.messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${message.incoming ? 'justify-start' : 'justify-end'}`}
                          >
                            <div
                              className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                                message.incoming
                                  ? 'bg-gray-100 text-gray-900'
                                  : 'bg-purple-500 text-white'
                              }`}
                            >
                              {message.content}
                              {!message.incoming && message.cost && (
                                <div className="text-xs mt-1 opacity-75">
                                  Cost: {message.cost} tokens
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>

                      {/* Message Input */}
                      <div className="p-4 border-t border-gray-200">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                            placeholder="Type a message..."
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                          />
                          <button
                            onClick={sendMessage}
                            disabled={!newMessage.trim() || !isConnected}
                            className="bg-purple-500 text-white p-2 rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <PaperAirplaneIcon className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {/* Pricing Info */}
                        <div className="text-xs text-gray-500 mt-2 flex gap-4">
                          <span>📝 Text: ${selectedChat.textMessagePrice}</span>
                          <span>🖼️ Image: ${selectedChat.imageMessagePrice}</span>
                          <span>🎥 Video: ${selectedChat.videoMessagePrice}</span>
                          <span>🎤 Voice: ${selectedChat.voiceMemoPrice}</span>
                        </div>

                        {/* Back to Chat List */}
                        <button
                          onClick={() => setSelectedChat(null)}
                          className="text-purple-500 hover:text-purple-600 text-sm mt-2"
                        >
                          ← Back to chats
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default InstantChatWidget;