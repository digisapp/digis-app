import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { subscribeWithSelector } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { shallow } from 'zustand/shallow';

// ============================
// SLICE CREATORS
// ============================

// Auth Slice - Global user state, token balance
const createAuthSlice = (set, get) => ({
  // State
  user: null,
  isCreator: localStorage.getItem('userIsCreator') === 'true' || false,
  isAdmin: localStorage.getItem('userIsAdmin') === 'true' || false,
  tokenBalance: 0,
  profile: null,
  
  // Actions
  setUser: (user) => set((state) => {
    state.user = user;
  }),
  
  setProfile: (profile) => set((state) => {
    console.log('🔍 Setting profile in store:', {
      email: profile?.email,
      is_creator: profile?.is_creator,
      role: profile?.role,
      creator_type: profile?.creator_type,
      full_profile: profile
    });
    state.profile = profile;
    
    // More robust creator detection - check multiple fields
    const isCreatorAccount = profile?.is_creator === true || 
                            profile?.creator_type !== null || 
                            profile?.role === 'creator';
    
    state.isCreator = isCreatorAccount;
    state.isAdmin = profile?.role === 'admin' || profile?.is_super_admin === true;
    
    // Store creator status in localStorage for mobile fallback
    if (profile) {
      localStorage.setItem('userIsCreator', isCreatorAccount ? 'true' : 'false');
      localStorage.setItem('userIsAdmin', (profile?.role === 'admin' || profile?.is_super_admin === true) ? 'true' : 'false');
      localStorage.setItem('userEmail', profile?.email || '');
      localStorage.setItem('userCreatorType', profile?.creator_type || '');
    }
    
    console.log('📱 Store state after setProfile - isCreator:', state.isCreator, 'isAdmin:', state.isAdmin, 'creator_type:', profile?.creator_type);
  }),
  
  setTokenBalance: (balance) => set((state) => {
    state.tokenBalance = balance;
  }),
  
  updateTokenBalance: (delta) => set((state) => {
    state.tokenBalance = Math.max(0, state.tokenBalance + delta);
  }),
  
  logout: () => set((state) => {
    state.user = null;
    state.profile = null;
    state.isCreator = false;
    state.isAdmin = false;
    state.tokenBalance = 0;
  }),
});

// Chat Slice - Real-time messages, typing, online users
const createChatSlice = (set, get) => ({
  // State
  messages: {}, // { channelId: Message[] }
  typingUsers: {}, // { channelId: { userId: timestamp } }
  onlineUsers: [], // Array of userIds (changed from Set for better serialization)
  activeChannel: null,
  unreadCounts: {}, // { channelId: number }
  
  // Actions
  addMessage: (channelId, message) => set((state) => {
    if (!state.messages[channelId]) {
      state.messages[channelId] = [];
    }
    state.messages[channelId].push({
      ...message,
      timestamp: message.timestamp || Date.now()
    });
    
    // Keep only last 500 messages per channel for performance
    if (state.messages[channelId].length > 500) {
      state.messages[channelId] = state.messages[channelId].slice(-500);
    }
  }),
  
  setMessages: (channelId, messages) => set((state) => {
    state.messages[channelId] = messages;
  }),
  
  clearMessages: (channelId) => set((state) => {
    if (channelId) {
      delete state.messages[channelId];
    } else {
      state.messages = {};
    }
  }),
  
  setTypingUser: (channelId, userId, isTyping) => set((state) => {
    if (!state.typingUsers[channelId]) {
      state.typingUsers[channelId] = {};
    }
    
    if (isTyping) {
      state.typingUsers[channelId][userId] = Date.now();
    } else {
      delete state.typingUsers[channelId][userId];
    }
  }),
  
  cleanupTypingUsers: () => set((state) => {
    const now = Date.now();
    const timeout = 3000; // 3 seconds
    
    Object.keys(state.typingUsers).forEach(channelId => {
      Object.entries(state.typingUsers[channelId]).forEach(([userId, timestamp]) => {
        if (now - timestamp > timeout) {
          delete state.typingUsers[channelId][userId];
        }
      });
    });
  }),
  
  setOnlineUser: (userId, isOnline) => set((state) => {
    if (isOnline) {
      if (!state.onlineUsers.includes(userId)) {
        state.onlineUsers.push(userId);
      }
    } else {
      state.onlineUsers = state.onlineUsers.filter(id => id !== userId);
    }
  }),
  
  setOnlineUsers: (userIds) => set((state) => {
    state.onlineUsers = Array.isArray(userIds) ? userIds : Array.from(userIds);
  }),
  
  setActiveChannel: (channelId) => set((state) => {
    state.activeChannel = channelId;
    // Clear unread count when channel becomes active
    if (channelId && state.unreadCounts[channelId]) {
      state.unreadCounts[channelId] = 0;
    }
  }),
  
  incrementUnread: (channelId) => set((state) => {
    // Don't increment if this is the active channel
    if (channelId !== state.activeChannel) {
      state.unreadCounts[channelId] = (state.unreadCounts[channelId] || 0) + 1;
    }
  }),
  
  clearUnread: (channelId) => set((state) => {
    if (channelId) {
      state.unreadCounts[channelId] = 0;
    } else {
      state.unreadCounts = {};
    }
  }),
});

// Notifications Slice - Real-time notifications, calls
const createNotificationSlice = (set, get) => ({
  // State
  notifications: [],
  incomingCall: null,
  streamAlerts: [],
  unreadNotifications: 0,
  
  // Actions
  addNotification: (notification) => set((state) => {
    const newNotification = {
      id: notification.id || Date.now().toString(),
      type: notification.type || 'info',
      title: notification.title,
      message: notification.message,
      timestamp: notification.timestamp || Date.now(),
      read: false,
      data: notification.data || {},
    };
    
    state.notifications.unshift(newNotification);
    state.unreadNotifications++;
    
    // Keep only last 100 notifications
    if (state.notifications.length > 100) {
      state.notifications = state.notifications.slice(0, 100);
    }
  }),
  
  removeNotification: (id) => set((state) => {
    const index = state.notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      if (!state.notifications[index].read) {
        state.unreadNotifications = Math.max(0, state.unreadNotifications - 1);
      }
      state.notifications.splice(index, 1);
    }
  }),
  
  markNotificationRead: (id) => set((state) => {
    const notification = state.notifications.find(n => n.id === id);
    if (notification && !notification.read) {
      notification.read = true;
      state.unreadNotifications = Math.max(0, state.unreadNotifications - 1);
    }
  }),
  
  markAllNotificationsRead: () => set((state) => {
    state.notifications.forEach(n => n.read = true);
    state.unreadNotifications = 0;
  }),
  
  clearNotifications: () => set((state) => {
    state.notifications = [];
    state.unreadNotifications = 0;
  }),
  
  setIncomingCall: (callData) => set((state) => {
    state.incomingCall = callData;
  }),
  
  clearIncomingCall: () => set((state) => {
    state.incomingCall = null;
  }),
  
  addStreamAlert: (alert) => set((state) => {
    const newAlert = {
      id: alert.id || Date.now().toString(),
      creatorId: alert.creatorId,
      creatorName: alert.creatorName,
      streamTitle: alert.streamTitle,
      timestamp: alert.timestamp || Date.now(),
      type: alert.type || 'live', // 'live', 'scheduled', 'ending'
    };
    
    state.streamAlerts.unshift(newAlert);
    
    // Auto-remove after 30 seconds
    setTimeout(() => {
      set((state) => {
        state.streamAlerts = state.streamAlerts.filter(a => a.id !== newAlert.id);
      });
    }, 30000);
    
    // Keep only last 10 alerts
    if (state.streamAlerts.length > 10) {
      state.streamAlerts = state.streamAlerts.slice(0, 10);
    }
  }),
  
  removeStreamAlert: (id) => set((state) => {
    state.streamAlerts = state.streamAlerts.filter(a => a.id !== id);
  }),
});

// Navigation Slice - Current view state for mobile navigation
const createNavigationSlice = (set, get) => ({
  // State
  currentView: 'explore',
  previousView: null,
  
  // Actions
  setCurrentView: (view) => set((state) => {
    console.log('📱 Store: Setting currentView from', state.currentView, 'to', view);
    state.previousView = state.currentView;
    state.currentView = view;
  }),
  
  goBack: () => set((state) => {
    if (state.previousView) {
      const temp = state.currentView;
      state.currentView = state.previousView;
      state.previousView = temp;
    }
  }),
});

// Stream Slice - Live streaming state
const createStreamSlice = (set, get) => ({
  // State
  isStreaming: false,
  isViewing: false,
  currentStream: null,
  viewerCount: 0,
  streamStats: {
    duration: 0,
    messages: 0,
    tips: 0,
    peakViewers: 0,
  },
  activeStreams: [], // List of active streams from creators
  
  // Actions
  startStream: (streamData) => set((state) => {
    state.isStreaming = true;
    state.currentStream = {
      id: streamData.id || Date.now().toString(),
      title: streamData.title,
      channelName: streamData.channelName,
      startedAt: Date.now(),
      ...streamData
    };
    state.viewerCount = 0;
    state.streamStats = {
      duration: 0,
      messages: 0,
      tips: 0,
      peakViewers: 0,
    };
  }),
  
  endStream: () => set((state) => {
    state.isStreaming = false;
    state.currentStream = null;
    state.viewerCount = 0;
  }),
  
  joinStream: (streamData) => set((state) => {
    state.isViewing = true;
    state.currentStream = streamData;
  }),
  
  leaveStream: () => set((state) => {
    state.isViewing = false;
    state.currentStream = null;
  }),
  
  setViewerCount: (count) => set((state) => {
    state.viewerCount = count;
    if (count > state.streamStats.peakViewers) {
      state.streamStats.peakViewers = count;
    }
  }),
  
  updateStreamStats: (stats) => set((state) => {
    Object.assign(state.streamStats, stats);
  }),
  
  incrementStreamStat: (stat, amount = 1) => set((state) => {
    if (state.streamStats[stat] !== undefined) {
      state.streamStats[stat] += amount;
    }
  }),
  
  setActiveStreams: (streams) => set((state) => {
    state.activeStreams = streams;
  }),
  
  addActiveStream: (stream) => set((state) => {
    const exists = state.activeStreams.find(s => s.id === stream.id);
    if (!exists) {
      state.activeStreams.push(stream);
    }
  }),
  
  removeActiveStream: (streamId) => set((state) => {
    state.activeStreams = state.activeStreams.filter(s => s.id !== streamId);
  }),
});

// ============================
// MAIN STORE
// ============================

const useHybridStore = create(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          // Combine all slices
          ...createAuthSlice(set, get),
          ...createChatSlice(set, get),
          ...createNotificationSlice(set, get),
          ...createNavigationSlice(set, get),
          ...createStreamSlice(set, get),
          
          // Global UI State (minimal, most UI state should be local)
          isLoading: false,
          error: null,
          
          // Global Actions
          setLoading: (isLoading) => set((state) => {
            state.isLoading = isLoading;
          }),
          
          setError: (error) => set((state) => {
            state.error = error;
          }),
          
          clearError: () => set((state) => {
            state.error = null;
          }),
          
          // Reset entire store
          resetStore: () => set((state) => {
            // Reset all slices to initial state
            Object.keys(state).forEach(key => {
              if (typeof state[key] === 'function') return;
              
              // Reset based on type
              if (Array.isArray(state[key])) {
                state[key] = [];
              } else if (typeof state[key] === 'object' && state[key] !== null) {
                state[key] = {};
              } else if (typeof state[key] === 'number') {
                state[key] = 0;
              } else if (typeof state[key] === 'boolean') {
                state[key] = false;
              } else {
                state[key] = null;
              }
            });
          }),
        }))
      ),
      {
        name: 'digis-hybrid-store',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          // Only persist auth and user preferences
          user: state.user,
          profile: state.profile,
          tokenBalance: state.tokenBalance,
          isCreator: state.isCreator,
          isAdmin: state.isAdmin,
        }),
        onRehydrateStorage: () => (state) => {
          // Ensure onlineUsers is always an array after rehydration
          if (state && !Array.isArray(state.onlineUsers)) {
            state.onlineUsers = [];
          }
        },
      }
    ),
    {
      name: 'DigisHybridStore',
    }
  )
);

// ============================
// PERFORMANCE OPTIMIZED SELECTORS
// ============================

// Auth selectors
export const useUser = () => useHybridStore((state) => state.user);
export const useProfile = () => useHybridStore((state) => state.profile);
export const useIsCreator = () => useHybridStore((state) => state.isCreator);
export const useIsAdmin = () => useHybridStore((state) => state.isAdmin);
export const useTokenBalance = () => useHybridStore((state) => state.tokenBalance);

// Chat selectors - using shallow equality for better performance
export const useChannelMessages = (channelId) => 
  useHybridStore((state) => state.messages[channelId] || [], shallow);

export const useTypingUsers = (channelId) => 
  useHybridStore((state) => Object.keys(state.typingUsers[channelId] || {}), shallow);

export const useIsUserOnline = (userId) => 
  useHybridStore((state) => state.onlineUsers.includes(userId));

export const useOnlineUsersCount = () => 
  useHybridStore((state) => state.onlineUsers.length);

export const useUnreadCount = (channelId) => 
  useHybridStore((state) => channelId ? state.unreadCounts[channelId] || 0 : 
    Object.values(state.unreadCounts).reduce((sum, count) => sum + count, 0));

// Notification selectors
export const useNotifications = () => 
  useHybridStore((state) => state.notifications);
export const useUnreadNotifications = () => 
  useHybridStore((state) => state.unreadNotifications);
export const useIncomingCall = () => 
  useHybridStore((state) => state.incomingCall);
export const useStreamAlerts = () => 
  useHybridStore((state) => state.streamAlerts);

// Navigation selectors
export const useCurrentView = () => 
  useHybridStore((state) => state.currentView);
export const usePreviousView = () => 
  useHybridStore((state) => state.previousView);

// Stream selectors
export const useIsStreaming = () => 
  useHybridStore((state) => state.isStreaming);
export const useCurrentStream = () => 
  useHybridStore((state) => state.currentStream);
export const useViewerCount = () => 
  useHybridStore((state) => state.viewerCount);
export const useStreamStats = () => 
  useHybridStore((state) => state.streamStats);
export const useActiveStreams = () => 
  useHybridStore((state) => state.activeStreams);

// Actions exports - using stable selectors
const authActionsSelector = (state) => ({
  setUser: state.setUser,
  setProfile: state.setProfile,
  setTokenBalance: state.setTokenBalance,
  updateTokenBalance: state.updateTokenBalance,
  logout: state.logout,
});

const chatActionsSelector = (state) => ({
  addMessage: state.addMessage,
  setMessages: state.setMessages,
  clearMessages: state.clearMessages,
  setTypingUser: state.setTypingUser,
  cleanupTypingUsers: state.cleanupTypingUsers,
  setOnlineUser: state.setOnlineUser,
  setOnlineUsers: state.setOnlineUsers,
  setActiveChannel: state.setActiveChannel,
  incrementUnread: state.incrementUnread,
  clearUnread: state.clearUnread,
});

const notificationActionsSelector = (state) => ({
  addNotification: state.addNotification,
  removeNotification: state.removeNotification,
  markNotificationRead: state.markNotificationRead,
  markAllNotificationsRead: state.markAllNotificationsRead,
  clearNotifications: state.clearNotifications,
  setIncomingCall: state.setIncomingCall,
  clearIncomingCall: state.clearIncomingCall,
  addStreamAlert: state.addStreamAlert,
  removeStreamAlert: state.removeStreamAlert,
});

const navigationActionsSelector = (state) => ({
  setCurrentView: state.setCurrentView,
  goBack: state.goBack,
});

const streamActionsSelector = (state) => ({
  startStream: state.startStream,
  endStream: state.endStream,
  joinStream: state.joinStream,
  leaveStream: state.leaveStream,
  setViewerCount: state.setViewerCount,
  updateStreamStats: state.updateStreamStats,
  incrementStreamStat: state.incrementStreamStat,
  setActiveStreams: state.setActiveStreams,
  addActiveStream: state.addActiveStream,
  removeActiveStream: state.removeActiveStream,
});

export const useAuthActions = () => useHybridStore(authActionsSelector, shallow);
export const useChatActions = () => useHybridStore(chatActionsSelector, shallow);
export const useNotificationActions = () => useHybridStore(notificationActionsSelector, shallow);
export const useNavigationActions = () => useHybridStore(navigationActionsSelector, shallow);
export const useStreamActions = () => useHybridStore(streamActionsSelector, shallow);

// Cleanup interval for typing users - DISABLED to prevent infinite loops
// TODO: Re-enable with proper cleanup and lifecycle management
// if (typeof window !== 'undefined') {
//   setInterval(() => {
//     useHybridStore.getState().cleanupTypingUsers();
//   }, 1000);
// }

export default useHybridStore;