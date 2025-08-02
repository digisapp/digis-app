import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface User {
  uid: string;
  email: string;
  username?: string;
  displayName?: string;
  isCreator: boolean;
  isAdmin: boolean;
  profilePicUrl?: string;
  bio?: string;
}

interface AppState {
  // User & Auth
  user: User | null;
  authLoading: boolean;
  tokenBalance: number;
  
  // UI State
  currentView: string;
  viewingCreator: string | null;
  
  // Modals
  modals: {
    showAuth: boolean;
    showTokenPurchase: boolean;
    showCreatorStudio: boolean;
    showCreatorDiscovery: boolean;
    showPrivacySettings: boolean;
    showCreatorApplication: boolean;
    showGoLiveSetup: boolean;
    showTokenTipping: boolean;
    showAvailabilityCalendar: boolean;
    showFanEngagement: boolean;
  };
  
  // Session State
  channel: string;
  streamConfig: any | null;
  
  // Notifications
  notifications: Array<{
    id: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning';
    timestamp: number;
  }>;
}

interface AppActions {
  // User Actions
  setUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;
  updateTokenBalance: (balance: number) => void;
  incrementTokens: (amount: number) => void;
  
  // Navigation
  navigateToView: (view: string) => void;
  setViewingCreator: (username: string | null) => void;
  
  // Modal Actions
  openModal: (modalName: keyof AppState['modals']) => void;
  closeModal: (modalName: keyof AppState['modals']) => void;
  toggleModal: (modalName: keyof AppState['modals']) => void;
  
  // Session Actions
  setChannel: (channel: string) => void;
  setStreamConfig: (config: any) => void;
  
  // Notification Actions
  addNotification: (message: string, type: AppState['notifications'][0]['type']) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  
  // Utility Actions
  reset: () => void;
}

const initialState: AppState = {
  user: null,
  authLoading: true,
  tokenBalance: 0,
  currentView: 'explore',
  viewingCreator: null,
  modals: {
    showAuth: false,
    showTokenPurchase: false,
    showCreatorStudio: false,
    showCreatorDiscovery: false,
    showPrivacySettings: false,
    showCreatorApplication: false,
    showGoLiveSetup: false,
    showTokenTipping: false,
    showAvailabilityCalendar: false,
    showFanEngagement: false,
  },
  channel: '',
  streamConfig: null,
  notifications: [],
};

export const useAppStore = create<AppState & AppActions>()(
  devtools(
    persist(
      immer((set) => ({
        ...initialState,

        // User Actions
        setUser: (user) =>
          set((state) => {
            state.user = user;
          }),
          
        setAuthLoading: (loading) =>
          set((state) => {
            state.authLoading = loading;
          }),
          
        updateTokenBalance: (balance) =>
          set((state) => {
            state.tokenBalance = balance;
          }),
          
        incrementTokens: (amount) =>
          set((state) => {
            state.tokenBalance += amount;
          }),

        // Navigation
        navigateToView: (view) =>
          set((state) => {
            state.currentView = view;
          }),
          
        setViewingCreator: (username) =>
          set((state) => {
            state.viewingCreator = username;
          }),

        // Modal Actions
        openModal: (modalName) =>
          set((state) => {
            state.modals[modalName] = true;
          }),
          
        closeModal: (modalName) =>
          set((state) => {
            state.modals[modalName] = false;
          }),
          
        toggleModal: (modalName) =>
          set((state) => {
            state.modals[modalName] = !state.modals[modalName];
          }),

        // Session Actions
        setChannel: (channel) =>
          set((state) => {
            state.channel = channel;
          }),
          
        setStreamConfig: (config) =>
          set((state) => {
            state.streamConfig = config;
          }),

        // Notification Actions
        addNotification: (message, type) =>
          set((state) => {
            const notification = {
              id: Date.now().toString(),
              message,
              type,
              timestamp: Date.now(),
            };
            state.notifications.push(notification);
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
              useAppStore.getState().removeNotification(notification.id);
            }, 5000);
          }),
          
        removeNotification: (id) =>
          set((state) => {
            state.notifications = state.notifications.filter((n) => n.id !== id);
          }),
          
        clearNotifications: () =>
          set((state) => {
            state.notifications = [];
          }),

        // Utility Actions
        reset: () => set(() => initialState),
      })),
      {
        name: 'digis-app-store',
        partialize: (state) => ({
          user: state.user,
          tokenBalance: state.tokenBalance,
        }),
      }
    ),
    {
      name: 'DigisAppStore',
    }
  )
);

// Selectors
export const useUser = () => useAppStore((state) => state.user);
export const useIsCreator = () => useAppStore((state) => state.user?.isCreator ?? false);
export const useIsAdmin = () => useAppStore((state) => state.user?.isAdmin ?? false);
export const useTokenBalance = () => useAppStore((state) => state.tokenBalance);
export const useCurrentView = () => useAppStore((state) => state.currentView);
export const useModals = () => useAppStore((state) => state.modals);
export const useNotifications = () => useAppStore((state) => state.notifications);