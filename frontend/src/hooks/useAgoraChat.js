import { useState, useEffect, useRef, useCallback } from 'react';
import AgoraChat from '../utils/AgoraChat';
import { supabase } from '../utils/supabase-auth.js';
import toast from 'react-hot-toast';

// Singleton instance
let chatInstance = null;

export const useAgoraChat = (options = {}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState(new Map());
  const [typingUsers, setTypingUsers] = useState([]);
  const [presence, setPresence] = useState(new Map());
  const [unreadCount, setUnreadCount] = useState(0);
  
  const chatRef = useRef(null);
  const handlersRef = useRef({});
  const typingTimerRef = useRef(null);

  // Initialize or get existing instance
  useEffect(() => {
    const initChat = async () => {
      if (!chatInstance) {
        // Get Agora Chat app key from environment
        const appKey = process.env.REACT_APP_AGORA_CHAT_APP_KEY;
        if (!appKey) {
          console.error('Agora Chat App Key not configured');
          return;
        }

        chatInstance = new AgoraChat(appKey, {
          delivery: true,
          read: true,
          ...options
        });

        await chatInstance.initialize();
      }

      chatRef.current = chatInstance;
      setupEventListeners();

      // Auto-login if user is authenticated
      const user = supabase.auth.user();
      if (user && !chatInstance.isConnected) {
        // You would typically get an Agora Chat token from your backend
        // For now, we'll use password-based login
        await login(user.id, 'default_password');
      }
    };

    initChat();

    return () => {
      cleanupEventListeners();
    };
  }, []);

  const setupEventListeners = () => {
    if (!chatRef.current) return;

    // Connection events
    handlersRef.current.connected = () => {
      setIsConnected(true);
      loadConversations();
    };

    handlersRef.current.disconnected = () => {
      setIsConnected(false);
    };

    // Message events
    handlersRef.current.messageReceived = (data) => {
      setMessages(prev => {
        const newMessages = new Map(prev);
        const conversationId = data.conversation;
        const convMessages = newMessages.get(conversationId) || [];
        newMessages.set(conversationId, [...convMessages, data.message]);
        return newMessages;
      });
      
      updateUnreadCount();
    };

    // Typing status
    handlersRef.current.typingStatusChanged = (data) => {
      if (data.typing) {
        setTypingUsers(prev => [...new Set([...prev, data.user])]);
      } else {
        setTypingUsers(prev => prev.filter(u => u !== data.user));
      }
    };

    // Read receipts
    handlersRef.current.readReceiptReceived = (receipt) => {
      setMessages(prev => {
        const newMessages = new Map(prev);
        // Update message read status
        for (const [convId, msgs] of newMessages.entries()) {
          const updatedMsgs = msgs.map(msg => {
            if (msg.id === receipt.id) {
              return { ...msg, isRead: true };
            }
            return msg;
          });
          newMessages.set(convId, updatedMsgs);
        }
        return newMessages;
      });
    };

    // Delivery receipts
    handlersRef.current.deliveryReceiptReceived = (receipt) => {
      setMessages(prev => {
        const newMessages = new Map(prev);
        // Update message delivery status
        for (const [convId, msgs] of newMessages.entries()) {
          const updatedMsgs = msgs.map(msg => {
            if (msg.id === receipt.id) {
              return { ...msg, isDelivered: true };
            }
            return msg;
          });
          newMessages.set(convId, updatedMsgs);
        }
        return newMessages;
      });
    };

    // Message recalled
    handlersRef.current.messageRecalled = (message) => {
      setMessages(prev => {
        const newMessages = new Map(prev);
        for (const [convId, msgs] of newMessages.entries()) {
          const filteredMsgs = msgs.filter(msg => msg.id !== message.mid);
          newMessages.set(convId, filteredMsgs);
        }
        return newMessages;
      });
    };

    // Presence updates
    handlersRef.current.presenceUpdated = (event) => {
      setPresence(prev => {
        const newPresence = new Map(prev);
        newPresence.set(event.userId, {
          status: event.status,
          description: event.description
        });
        return newPresence;
      });
    };

    // Register all handlers
    Object.entries(handlersRef.current).forEach(([event, handler]) => {
      chatRef.current.on(event, handler);
    });
  };

  const cleanupEventListeners = () => {
    if (!chatRef.current) return;

    Object.entries(handlersRef.current).forEach(([event, handler]) => {
      chatRef.current.off(event, handler);
    });
  };

  // Public methods
  const login = useCallback(async (username, password) => {
    if (!chatRef.current) return false;
    
    const success = await chatRef.current.login(username, password);
    if (success) {
      setIsConnected(true);
      await loadConversations();
    }
    return success;
  }, []);

  const loginWithToken = useCallback(async (username, token) => {
    if (!chatRef.current) return false;
    
    const success = await chatRef.current.loginWithToken(username, token);
    if (success) {
      setIsConnected(true);
      await loadConversations();
    }
    return success;
  }, []);

  const logout = useCallback(async () => {
    if (!chatRef.current) return false;
    
    const success = await chatRef.current.logout();
    if (success) {
      setIsConnected(false);
      setConversations([]);
      setMessages(new Map());
      setTypingUsers([]);
      setPresence(new Map());
    }
    return success;
  }, []);

  const loadConversations = useCallback(async () => {
    if (!chatRef.current) return;
    
    const convs = await chatRef.current.loadConversations();
    setConversations(convs);
    updateUnreadCount();
    
    // Load recent messages for each conversation
    for (const conv of convs) {
      await loadMessages(conv.conversationId, conv.type);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId, chatType = 'singleChat', options = {}) => {
    if (!chatRef.current) return [];
    
    const result = await chatRef.current.getMessageHistory(conversationId, chatType, options);
    
    setMessages(prev => {
      const newMessages = new Map(prev);
      newMessages.set(conversationId, result.messages);
      return newMessages;
    });
    
    return result;
  }, []);

  const sendTextMessage = useCallback(async (to, text, chatType = 'singleChat', options = {}) => {
    if (!chatRef.current) return null;
    
    const message = await chatRef.current.sendTextMessage(to, text, chatType, options);
    
    // Add to local messages
    setMessages(prev => {
      const newMessages = new Map(prev);
      const conversationId = chatType === 'singleChat' ? to : to;
      const convMessages = newMessages.get(conversationId) || [];
      newMessages.set(conversationId, [...convMessages, message]);
      return newMessages;
    });
    
    return message;
  }, []);

  const sendImageMessage = useCallback(async (to, file, chatType = 'singleChat', options = {}) => {
    if (!chatRef.current) return null;
    
    return await chatRef.current.sendImageMessage(to, file, chatType, options);
  }, []);

  const sendAudioMessage = useCallback(async (to, file, length, chatType = 'singleChat', options = {}) => {
    if (!chatRef.current) return null;
    
    return await chatRef.current.sendAudioMessage(to, file, length, chatType, options);
  }, []);

  const sendVideoMessage = useCallback(async (to, file, length, chatType = 'singleChat', options = {}) => {
    if (!chatRef.current) return null;
    
    return await chatRef.current.sendVideoMessage(to, file, length, chatType, options);
  }, []);

  const sendFileMessage = useCallback(async (to, file, chatType = 'singleChat', options = {}) => {
    if (!chatRef.current) return null;
    
    return await chatRef.current.sendFileMessage(to, file, chatType, options);
  }, []);

  const sendLocationMessage = useCallback(async (to, latitude, longitude, address, chatType = 'singleChat', options = {}) => {
    if (!chatRef.current) return null;
    
    return await chatRef.current.sendLocationMessage(to, latitude, longitude, address, chatType, options);
  }, []);

  const sendCustomMessage = useCallback(async (to, customEvent, customExts, chatType = 'singleChat', options = {}) => {
    if (!chatRef.current) return null;
    
    return await chatRef.current.sendCustomMessage(to, customEvent, customExts, chatType, options);
  }, []);

  const startTyping = useCallback(async (to) => {
    if (!chatRef.current) return;
    
    // Clear existing timer
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    
    // Send typing start
    await chatRef.current.sendTypingCommand(to, 'start');
    
    // Auto-stop after 5 seconds
    typingTimerRef.current = setTimeout(() => {
      stopTyping(to);
    }, 5000);
  }, []);

  const stopTyping = useCallback(async (to) => {
    if (!chatRef.current) return;
    
    // Clear timer
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    
    // Send typing stop
    await chatRef.current.sendTypingCommand(to, 'stop');
  }, []);

  const recallMessage = useCallback(async (messageId) => {
    if (!chatRef.current) return false;
    
    return await chatRef.current.recallMessage(messageId);
  }, []);

  const deleteMessage = useCallback(async (messageId) => {
    if (!chatRef.current) return false;
    
    const success = await chatRef.current.deleteMessage(messageId);
    
    if (success) {
      // Remove from local messages
      setMessages(prev => {
        const newMessages = new Map(prev);
        for (const [convId, msgs] of newMessages.entries()) {
          const filteredMsgs = msgs.filter(msg => msg.id !== messageId);
          newMessages.set(convId, filteredMsgs);
        }
        return newMessages;
      });
    }
    
    return success;
  }, []);

  const markAsRead = useCallback(async (message) => {
    if (!chatRef.current) return false;
    
    const success = await chatRef.current.sendReadReceipt(message);
    
    if (success) {
      // Update unread count
      updateUnreadCount();
    }
    
    return success;
  }, []);

  const translateMessage = useCallback(async (message, targetLanguages) => {
    if (!chatRef.current) return null;
    
    return await chatRef.current.translateMessage(message, targetLanguages);
  }, []);

  const updatePresenceStatus = useCallback(async (description) => {
    if (!chatRef.current) return false;
    
    return await chatRef.current.publishPresence(description);
  }, []);

  const subscribeToPresence = useCallback(async (userIds) => {
    if (!chatRef.current) return false;
    
    return await chatRef.current.subscribePresence(userIds);
  }, []);

  const createGroup = useCallback(async (groupName, description, members = [], options = {}) => {
    if (!chatRef.current) return null;
    
    return await chatRef.current.createGroup(groupName, description, members, options);
  }, []);

  const joinGroup = useCallback(async (groupId) => {
    if (!chatRef.current) return false;
    
    return await chatRef.current.joinGroup(groupId);
  }, []);

  const leaveGroup = useCallback(async (groupId) => {
    if (!chatRef.current) return false;
    
    return await chatRef.current.leaveGroup(groupId);
  }, []);

  // Helper methods
  const updateUnreadCount = useCallback(() => {
    if (!chatRef.current) return;
    
    let total = 0;
    for (const conv of chatRef.current.conversations.values()) {
      total += conv.unreadCount || 0;
    }
    setUnreadCount(total);
  }, []);

  const getConversationMessages = useCallback((conversationId) => {
    return messages.get(conversationId) || [];
  }, [messages]);

  const getPresenceStatus = useCallback((userId) => {
    return presence.get(userId) || { status: 'offline' };
  }, [presence]);

  const isUserTyping = useCallback((userId) => {
    return typingUsers.includes(userId);
  }, [typingUsers]);

  return {
    // Connection state
    isConnected,
    
    // Data
    conversations,
    messages,
    typingUsers,
    presence,
    unreadCount,
    
    // Authentication
    login,
    loginWithToken,
    logout,
    
    // Conversations
    loadConversations,
    loadMessages,
    
    // Messaging
    sendTextMessage,
    sendImageMessage,
    sendAudioMessage,
    sendVideoMessage,
    sendFileMessage,
    sendLocationMessage,
    sendCustomMessage,
    
    // Typing indicators
    startTyping,
    stopTyping,
    
    // Message management
    recallMessage,
    deleteMessage,
    markAsRead,
    translateMessage,
    
    // Presence
    updatePresenceStatus,
    subscribeToPresence,
    
    // Groups
    createGroup,
    joinGroup,
    leaveGroup,
    
    // Helpers
    getConversationMessages,
    getPresenceStatus,
    isUserTyping,
    
    // Instance reference
    chat: chatRef.current
  };
};

// Export singleton getter
export const getChatInstance = () => chatInstance;