// src/contexts/AppContext.js
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { supabase, subscribeToAuthChanges } from '../utils/supabase-auth.js';

const AppContext = createContext();

const initialState = {
  user: null,
  isCreator: false,
  creators: [],
  channel: '',
  token: '',
  chatToken: '',
  hasPaid: false,
  sessionUid: null,
  isStreaming: false,
  isVoiceOnly: false,
  error: null,
  loading: false,
  notifications: [],
  sessionHistory: [],
  connectionStatus: 'disconnected',
  userProfile: null,
  sessionStats: {
    totalSessions: 0,
    totalEarnings: 0,
    totalMinutes: 0,
    activeUsers: 0
  }
};

const appReducer = (state, action) => {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_CREATORS':
      return { ...state, creators: action.payload };
    case 'SET_CHANNEL':
      return { ...state, channel: action.payload };
    case 'SET_TOKENS':
      return { 
        ...state, 
        token: action.payload.token,
        chatToken: action.payload.chatToken 
      };
    case 'SET_PAYMENT_STATUS':
      return { ...state, hasPaid: action.payload };
    case 'SET_SESSION_UID':
      return { ...state, sessionUid: action.payload };
    case 'SET_STREAMING':
      return { ...state, isStreaming: action.payload };
    case 'SET_VOICE_ONLY':
      return { ...state, isVoiceOnly: action.payload };
    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.payload };
    case 'SET_USER_PROFILE':
      return { ...state, userProfile: action.payload, isCreator: action.payload?.is_creator || false };
    case 'ADD_NOTIFICATION':
      return { 
        ...state, 
        notifications: [...state.notifications, action.payload] 
      };
    case 'REMOVE_NOTIFICATION':
      return { 
        ...state, 
        notifications: state.notifications.filter(n => n.id !== action.payload) 
      };
    case 'SET_SESSION_HISTORY':
      return { ...state, sessionHistory: action.payload };
    case 'ADD_SESSION_HISTORY':
      return { 
        ...state, 
        sessionHistory: [action.payload, ...state.sessionHistory] 
      };
    case 'UPDATE_SESSION_STATS':
      return { 
        ...state, 
        sessionStats: { ...state.sessionStats, ...action.payload } 
      };
    case 'RESET_SESSION':
      return {
        ...state,
        channel: '',
        token: '',
        chatToken: '',
        sessionUid: null,
        isStreaming: false,
        isVoiceOnly: false,
        connectionStatus: 'authenticated'
      };
    case 'RESET_ALL':
      return {
        ...initialState,
        user: null,
        connectionStatus: 'disconnected'
      };
    default:
      return state;
  }
};

export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((event, session) => {
      const user = session?.user || null;
      dispatch({ type: 'SET_USER', payload: user });
      if (user) {
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'authenticated' });
      } else {
        dispatch({ type: 'RESET_ALL' });
      }
    });

    return unsubscribe;
  }, []);

  const addNotification = (message, type = 'info') => {
    const notification = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toISOString()
    };
    dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
    
    setTimeout(() => {
      dispatch({ type: 'REMOVE_NOTIFICATION', payload: notification.id });
    }, 5000);
  };

  const value = {
    state,
    dispatch,
    addNotification
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export { AppContext };