import useStore from '../stores/useStore';
import { useCallback, useMemo } from 'react';

// Hook wrapper for AppContext functionality
export const useApp = () => {
  // Use individual selectors for each property to avoid recreation issues
  const user = useStore((state) => state.user);
  const isCreator = useStore((state) => state.isCreator);
  const creators = useStore((state) => state.creators);
  const channel = useStore((state) => state.channel);
  const token = useStore((state) => state.token);
  const chatToken = useStore((state) => state.chatToken);
  const hasPaid = useStore((state) => state.hasPaid);
  const sessionUid = useStore((state) => state.sessionUid);
  const isStreaming = useStore((state) => state.isStreaming);
  const isVoiceOnly = useStore((state) => state.isVoiceOnly);
  const error = useStore((state) => state.error);
  const loading = useStore((state) => state.loading);
  const notifications = useStore((state) => state.notifications);
  const sessionHistory = useStore((state) => state.sessionHistory);
  const connectionStatus = useStore((state) => state.connectionStatus);
  const userProfile = useStore((state) => state.userProfile);
  const sessionStats = useStore((state) => state.sessionStats);
  const tokenBalance = useStore((state) => state.tokenBalance);
  const isAdmin = useStore((state) => state.isAdmin);

  // Combine all state into a single object
  const state = useMemo(() => ({
    user,
    isCreator,
    creators,
    channel,
    token,
    chatToken,
    hasPaid,
    sessionUid,
    isStreaming,
    isVoiceOnly,
    error,
    loading,
    notifications,
    sessionHistory,
    connectionStatus,
    userProfile,
    sessionStats,
    tokenBalance,
    isAdmin
  }), [
    user,
    isCreator,
    creators,
    channel,
    token,
    chatToken,
    hasPaid,
    sessionUid,
    isStreaming,
    isVoiceOnly,
    error,
    loading,
    notifications,
    sessionHistory,
    connectionStatus,
    userProfile,
    sessionStats,
    tokenBalance,
    isAdmin
  ]);

  const dispatch = useCallback((action) => {
    const store = useStore.getState();
    
    switch (action.type) {
      case 'SET_USER':
        store.setUser(action.payload);
        break;
      case 'SET_LOADING':
        store.setLoading(action.payload);
        break;
      case 'SET_ERROR':
        store.setError(action.payload);
        break;
      case 'SET_CREATORS':
        store.setCreators(action.payload);
        break;
      case 'SET_CHANNEL':
        store.setChannel(action.payload);
        break;
      case 'SET_TOKENS':
        store.setTokens(action.payload);
        break;
      case 'SET_PAYMENT_STATUS':
        store.setPaymentStatus(action.payload);
        break;
      case 'SET_SESSION_UID':
        store.setSessionUid(action.payload);
        break;
      case 'SET_STREAMING':
        store.setStreaming(action.payload);
        break;
      case 'SET_VOICE_ONLY':
        store.setVoiceOnly(action.payload);
        break;
      case 'SET_CONNECTION_STATUS':
        store.setConnectionStatus(action.payload);
        break;
      case 'SET_USER_PROFILE':
        store.setUserProfile(action.payload);
        break;
      case 'ADD_NOTIFICATION':
        store.addNotification(action.payload.message, action.payload.type);
        break;
      case 'REMOVE_NOTIFICATION':
        store.removeNotification(action.payload);
        break;
      case 'SET_SESSION_HISTORY':
        store.setSessionHistory(action.payload);
        break;
      case 'ADD_SESSION_HISTORY':
        store.addSessionHistory(action.payload);
        break;
      case 'UPDATE_SESSION_STATS':
        store.updateSessionStats(action.payload);
        break;
      case 'RESET_SESSION':
        store.resetSession();
        break;
      case 'RESET_ALL':
        store.resetAll();
        break;
      default:
        console.warn(`Unknown action type: ${action.type}`);
    }
  }, []);

  const addNotification = useCallback((message, type) => {
    useStore.getState().addNotification(message, type);
  }, []);

  return {
    state,
    dispatch,
    addNotification
  };
};