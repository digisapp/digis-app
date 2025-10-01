/**
 * Zustand v5 Store with Latest Patterns and Best Practices
 * Updated with 2024-2025 features and middleware patterns
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { shallow } from 'zustand/shallow';
import { createJSONStorage } from 'zustand/middleware';

// Custom middleware for logging in development
const logger = (config) => (set, get, api) =>
  config(
    (...args) => {
      if (import.meta.env.DEV) {
        console.log('  prev state', get());
        set(...args);
        console.log('  next state', get());
      } else {
        set(...args);
      }
    },
    get,
    api
  );

// Custom middleware for async actions with error handling
const asyncMiddleware = (config) => (set, get, api) => ({
  ...config(set, get, api),
  asyncAction: async (fn) => {
    set((state) => ({ ...state, loading: true, error: null }));
    try {
      const result = await fn();
      set((state) => ({ ...state, loading: false }));
      return result;
    } catch (error) {
      set((state) => ({ ...state, loading: false, error: error.message }));
      throw error;
    }
  },
});

// Slice pattern for user management
const createUserSlice = (set, get) => ({
  user: null,
  userLoading: false,
  userError: null,
  
  // Actions with Immer for cleaner mutations
  setUser: (user) =>
    set((state) => {
      state.user = user;
    }),
  
  updateUser: (updates) =>
    set((state) => {
      if (state.user) {
        Object.assign(state.user, updates);
      }
    }),
  
  // Async action with built-in error handling
  fetchUser: async () => {
    set((state) => {
      state.userLoading = true;
      state.userError = null;
    });
    
    try {
      const response = await fetch('/api/users/profile', {
        headers: { Authorization: `Bearer ${get().authToken}` },
      });
      
      if (!response.ok) throw new Error('Failed to fetch user');
      
      const user = await response.json();
      
      set((state) => {
        state.user = user;
        state.userLoading = false;
      });
      
      return user;
    } catch (error) {
      set((state) => {
        state.userError = error.message;
        state.userLoading = false;
      });
      throw error;
    }
  },
  
  clearUser: () =>
    set((state) => {
      state.user = null;
      state.userError = null;
    }),
});

// Slice pattern for analytics
const createAnalyticsSlice = (set, get) => ({
  analytics: {
    viewers: 0,
    revenue: 0,
    engagement: 0,
    messages: [],
  },
  analyticsHistory: [],
  
  // Transient update (doesn't trigger re-renders)
  updateAnalyticsTransient: (data) => {
    get().analytics = { ...get().analytics, ...data };
  },
  
  // Regular update (triggers re-renders)
  updateAnalytics: (data) =>
    set((state) => {
      state.analytics = { ...state.analytics, ...data };
      
      // Keep history with max 100 items
      state.analyticsHistory = [
        ...state.analyticsHistory.slice(-99),
        { ...data, timestamp: Date.now() },
      ];
    }),
  
  // Computed values using selectors
  getAverageViewers: () => {
    const history = get().analyticsHistory;
    if (history.length === 0) return 0;
    
    const sum = history.reduce((acc, item) => acc + (item.viewers || 0), 0);
    return Math.round(sum / history.length);
  },
  
  getTotalRevenue: () => {
    const history = get().analyticsHistory;
    return history.reduce((acc, item) => acc + (item.revenue || 0), 0);
  },
});

// Slice pattern for WebSocket management
const createSocketSlice = (set, get) => ({
  socket: null,
  socketConnected: false,
  socketReconnectAttempts: 0,
  
  initSocket: () => {
    const socket = new WebSocket(import.meta.env.VITE_WS_URL);
    
    socket.onopen = () => {
      set((state) => {
        state.socketConnected = true;
        state.socketReconnectAttempts = 0;
      });
    };
    
    socket.onclose = () => {
      set((state) => {
        state.socketConnected = false;
      });
      
      // Auto-reconnect with exponential backoff
      const attempts = get().socketReconnectAttempts;
      if (attempts < 5) {
        const delay = Math.min(1000 * Math.pow(2, attempts), 10000);
        setTimeout(() => {
          set((state) => {
            state.socketReconnectAttempts++;
          });
          get().initSocket();
        }, delay);
      }
    };
    
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // Route messages to appropriate handlers
      switch (data.type) {
        case 'analytics':
          get().updateAnalytics(data.payload);
          break;
        case 'user_update':
          get().updateUser(data.payload);
          break;
        default:
          console.log('Unknown socket message type:', data.type);
      }
    };
    
    set((state) => {
      state.socket = socket;
    });
  },
  
  sendSocketMessage: (type, payload) => {
    const socket = get().socket;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type, payload }));
    }
  },
  
  closeSocket: () => {
    const socket = get().socket;
    if (socket) {
      socket.close();
      set((state) => {
        state.socket = null;
        state.socketConnected = false;
      });
    }
  },
});

// Main store combining all slices with middleware
const useStore = create(
  logger(
    devtools(
      persist(
        subscribeWithSelector(
          immer((set, get) => ({
            // Combine all slices
            ...createUserSlice(set, get),
            ...createAnalyticsSlice(set, get),
            ...createSocketSlice(set, get),
            
            // Global state
            authToken: null,
            theme: 'dark',
            sidebarOpen: true,
            notifications: [],
            
            // Global actions
            setAuthToken: (token) =>
              set((state) => {
                state.authToken = token;
              }),
            
            setTheme: (theme) =>
              set((state) => {
                state.theme = theme;
              }),
            
            toggleSidebar: () =>
              set((state) => {
                state.sidebarOpen = !state.sidebarOpen;
              }),
            
            addNotification: (notification) =>
              set((state) => {
                state.notifications.push({
                  id: Date.now(),
                  timestamp: Date.now(),
                  ...notification,
                });
                
                // Auto-remove after 5 seconds
                setTimeout(() => {
                  get().removeNotification(notification.id || Date.now());
                }, 5000);
              }),
            
            removeNotification: (id) =>
              set((state) => {
                state.notifications = state.notifications.filter((n) => n.id !== id);
              }),
            
            // Reset entire store
            reset: () =>
              set((state) => {
                // Keep only essential data
                const { theme, authToken } = state;
                
                // Close socket before reset
                state.socket?.close();
                
                // Return initial state with preserved values
                return {
                  ...createUserSlice(set, get),
                  ...createAnalyticsSlice(set, get),
                  ...createSocketSlice(set, get),
                  authToken,
                  theme,
                  sidebarOpen: true,
                  notifications: [],
                };
              }),
          }))
        ),
        {
          name: 'digis-store-v5',
          storage: createJSONStorage(() => localStorage),
          partialize: (state) => ({
            // Only persist these fields
            authToken: state.authToken,
            theme: state.theme,
            sidebarOpen: state.sidebarOpen,
            user: state.user,
          }),
          version: 1,
          migrate: (persistedState, version) => {
            // Handle migrations between versions
            if (version === 0) {
              // Migration from v0 to v1
              persistedState.theme = persistedState.theme || 'dark';
            }
            return persistedState;
          },
        }
      ),
      {
        name: 'digis-store',
        serialize: { options: true },
      }
    )
  )
);

// Vanilla store for use outside React
export const store = useStore;

// Selectors with shallow comparison for performance
export const useUser = () => useStore((state) => state.user);
export const useAnalytics = () => useStore((state) => state.analytics, shallow);
export const useSocket = () => useStore((state) => ({
  connected: state.socketConnected,
  reconnectAttempts: state.socketReconnectAttempts,
}), shallow);

// Actions selector
export const useActions = () => useStore((state) => ({
  fetchUser: state.fetchUser,
  updateUser: state.updateUser,
  updateAnalytics: state.updateAnalytics,
  initSocket: state.initSocket,
  sendSocketMessage: state.sendSocketMessage,
  reset: state.reset,
}), shallow);

// Computed selectors
export const useComputedAnalytics = () => useStore((state) => ({
  averageViewers: state.getAverageViewers(),
  totalRevenue: state.getTotalRevenue(),
}));

// Subscribe to specific state changes outside React
export const subscribeToAnalytics = (callback) => {
  return useStore.subscribe(
    (state) => state.analytics,
    callback,
    {
      equalityFn: shallow,
      fireImmediately: true,
    }
  );
};

// Transient updates example (doesn't trigger re-renders)
export const updateAnalyticsWithoutRerender = (data) => {
  useStore.setState((state) => {
    state.analytics = { ...state.analytics, ...data };
  }, false, { type: 'analytics/transient' });
};

// TypeScript helpers
export type StoreState = ReturnType<typeof useStore.getState>;
export type StoreActions = {
  fetchUser: () => Promise<any>;
  updateUser: (updates: Partial<StoreState['user']>) => void;
  updateAnalytics: (data: Partial<StoreState['analytics']>) => void;
  initSocket: () => void;
  sendSocketMessage: (type: string, payload: any) => void;
  reset: () => void;
};

export default useStore;