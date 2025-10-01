import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useAppStore = create(
  persist(
    (set, get) => ({
      // User state
      user: null,
      userProfile: null,
      isCreator: false,
      isAdmin: false,
      
      // Token state
      tokenBalance: 0,
      
      // UI state
      notifications: [],
      error: null,
      loading: false,
      
      // Streaming state
      coHostRequests: [],
      coHosts: [],
      streamId: null,
      
      // Private call state
      privateCallRequests: [],
      activePrivateCall: null,
      privateCallHistory: [],
      
      // Actions
      setUser: (userData) => set({ user: userData }),
      
      setUserProfile: (profile) => set({ 
        userProfile: profile,
        isCreator: profile?.is_creator || false,
        isAdmin: profile?.role === 'admin' || false
      }),
      
      updateTokenBalance: (balance) => set({ tokenBalance: balance }),
      
      addTokens: (amount) => set((state) => ({ 
        tokenBalance: state.tokenBalance + amount 
      })),
      
      subtractTokens: (amount) => set((state) => ({ 
        tokenBalance: Math.max(0, state.tokenBalance - amount) 
      })),
      
      addNotification: (notification) => set((state) => ({ 
        notifications: [...state.notifications, {
          id: Date.now(),
          timestamp: new Date(),
          ...notification
        }] 
      })),
      
      removeNotification: (id) => set((state) => ({ 
        notifications: state.notifications.filter(n => n.id !== id) 
      })),
      
      clearNotifications: () => set({ notifications: [] }),
      
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),
      
      setLoading: (loading) => set({ loading }),
      
      // Co-host actions
      setCoHostRequests: (requests) => set({ coHostRequests: requests }),
      
      addCoHostRequest: (request) => set((state) => ({
        coHostRequests: [...state.coHostRequests, request]
      })),
      
      removeCoHostRequest: (requestId) => set((state) => ({
        coHostRequests: state.coHostRequests.filter(r => r.id !== requestId)
      })),
      
      setCoHosts: (coHosts) => set({ coHosts }),
      
      addCoHost: (coHost) => set((state) => ({
        coHosts: [...state.coHosts, coHost]
      })),
      
      removeCoHost: (coHostId) => set((state) => ({
        coHosts: state.coHosts.filter(c => c.co_host_id !== coHostId)
      })),
      
      setStreamId: (streamId) => set({ streamId }),
      
      // Private call actions
      setPrivateCallRequests: (requests) => set({ privateCallRequests: requests }),
      
      addPrivateCallRequest: (request) => set((state) => ({
        privateCallRequests: [...state.privateCallRequests, {
          ...request,
          id: request.id || Date.now(),
          timestamp: new Date()
        }]
      })),
      
      removePrivateCallRequest: (requestId) => set((state) => ({
        privateCallRequests: state.privateCallRequests.filter(r => r.id !== requestId)
      })),
      
      setActivePrivateCall: (callSession) => set({ activePrivateCall: callSession }),
      
      endPrivateCall: () => set((state) => {
        if (state.activePrivateCall) {
          return {
            activePrivateCall: null,
            privateCallHistory: [...state.privateCallHistory, {
              ...state.activePrivateCall,
              endedAt: new Date()
            }]
          };
        }
        return state;
      }),
      
      updatePrivateCallTokens: (tokensUsed) => set((state) => {
        if (state.activePrivateCall) {
          return {
            activePrivateCall: {
              ...state.activePrivateCall,
              tokensUsed: (state.activePrivateCall.tokensUsed || 0) + tokensUsed,
              duration: state.activePrivateCall.duration + 1
            },
            tokenBalance: Math.max(0, state.tokenBalance - tokensUsed)
          };
        }
        return state;
      }),
      
      clearPrivateCallHistory: () => set({ privateCallHistory: [] }),
      
      // Reset all state
      reset: () => set({
        user: null,
        userProfile: null,
        isCreator: false,
        isAdmin: false,
        tokenBalance: 0,
        notifications: [],
        error: null,
        loading: false,
        coHostRequests: [],
        coHosts: [],
        streamId: null,
        privateCallRequests: [],
        activePrivateCall: null,
        privateCallHistory: []
      })
    }),
    {
      name: 'digis-app-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist specific parts of the state
        tokenBalance: state.tokenBalance,
        notifications: state.notifications
      })
    }
  )
);