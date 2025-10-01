/**
 * Context provider for Streaming state management
 * @module contexts/StreamContext
 */

import React, { createContext, useContext, useReducer, useCallback } from 'react';

// Initial state
const initialState = {
  // Stream info
  streamId: null,
  streamTitle: '',
  streamDescription: '',
  category: 'general',
  isLive: false,
  startTime: null,
  
  // Viewer info
  viewerCount: 0,
  viewers: [],
  peakViewers: 0,
  
  // Monetization
  totalTips: 0,
  totalGifts: 0,
  subscriptions: 0,
  
  // Features
  pollActive: false,
  currentPoll: null,
  chatEnabled: true,
  giftOverlayVisible: false,
  
  // Stream quality
  streamQuality: 'auto',
  isRecording: false,
  
  // Co-hosts
  coHosts: [],
  pendingCoHosts: [],
  
  // Moderation
  bannedUsers: [],
  mutedUsers: [],
  moderators: []
};

// Action types
const ActionTypes = {
  SET_STREAM_INFO: 'SET_STREAM_INFO',
  UPDATE_VIEWERS: 'UPDATE_VIEWERS',
  UPDATE_MONETIZATION: 'UPDATE_MONETIZATION',
  SET_POLL: 'SET_POLL',
  TOGGLE_FEATURE: 'TOGGLE_FEATURE',
  UPDATE_COHOSTS: 'UPDATE_COHOSTS',
  UPDATE_MODERATION: 'UPDATE_MODERATION',
  RESET_STATE: 'RESET_STATE'
};

// Reducer
const streamReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.SET_STREAM_INFO:
      return {
        ...state,
        ...action.payload
      };
      
    case ActionTypes.UPDATE_VIEWERS:
      return {
        ...state,
        viewerCount: action.payload.count || state.viewerCount,
        viewers: action.payload.viewers || state.viewers,
        peakViewers: Math.max(state.peakViewers, action.payload.count || state.viewerCount)
      };
      
    case ActionTypes.UPDATE_MONETIZATION:
      return {
        ...state,
        totalTips: state.totalTips + (action.payload.tips || 0),
        totalGifts: state.totalGifts + (action.payload.gifts || 0),
        subscriptions: action.payload.subscriptions || state.subscriptions
      };
      
    case ActionTypes.SET_POLL:
      return {
        ...state,
        pollActive: !!action.payload,
        currentPoll: action.payload
      };
      
    case ActionTypes.TOGGLE_FEATURE:
      return {
        ...state,
        [action.feature]: action.value !== undefined ? action.value : !state[action.feature]
      };
      
    case ActionTypes.UPDATE_COHOSTS:
      return {
        ...state,
        coHosts: action.payload.coHosts || state.coHosts,
        pendingCoHosts: action.payload.pendingCoHosts || state.pendingCoHosts
      };
      
    case ActionTypes.UPDATE_MODERATION:
      return {
        ...state,
        bannedUsers: action.payload.bannedUsers || state.bannedUsers,
        mutedUsers: action.payload.mutedUsers || state.mutedUsers,
        moderators: action.payload.moderators || state.moderators
      };
      
    case ActionTypes.RESET_STATE:
      return initialState;
      
    default:
      return state;
  }
};

// Create contexts
const StreamStateContext = createContext();
const StreamDispatchContext = createContext();

/**
 * Stream context provider
 */
export const StreamProvider = ({ children, initialValues = {} }) => {
  const [state, dispatch] = useReducer(
    streamReducer,
    { ...initialState, ...initialValues }
  );

  // Action creators
  const actions = {
    setStreamInfo: useCallback((payload) => {
      dispatch({ type: ActionTypes.SET_STREAM_INFO, payload });
    }, []),
    
    updateViewers: useCallback((payload) => {
      dispatch({ type: ActionTypes.UPDATE_VIEWERS, payload });
    }, []),
    
    updateMonetization: useCallback((payload) => {
      dispatch({ type: ActionTypes.UPDATE_MONETIZATION, payload });
    }, []),
    
    setPoll: useCallback((poll) => {
      dispatch({ type: ActionTypes.SET_POLL, payload: poll });
    }, []),
    
    toggleFeature: useCallback((feature, value) => {
      dispatch({ type: ActionTypes.TOGGLE_FEATURE, feature, value });
    }, []),
    
    updateCoHosts: useCallback((payload) => {
      dispatch({ type: ActionTypes.UPDATE_COHOSTS, payload });
    }, []),
    
    updateModeration: useCallback((payload) => {
      dispatch({ type: ActionTypes.UPDATE_MODERATION, payload });
    }, []),
    
    resetState: useCallback(() => {
      dispatch({ type: ActionTypes.RESET_STATE });
    }, [])
  };

  return (
    <StreamStateContext.Provider value={state}>
      <StreamDispatchContext.Provider value={actions}>
        {children}
      </StreamDispatchContext.Provider>
    </StreamStateContext.Provider>
  );
};

/**
 * Hook to use Stream state
 */
export const useStreamState = () => {
  const context = useContext(StreamStateContext);
  if (!context) {
    throw new Error('useStreamState must be used within StreamProvider');
  }
  return context;
};

/**
 * Hook to use Stream actions
 */
export const useStreamActions = () => {
  const context = useContext(StreamDispatchContext);
  if (!context) {
    throw new Error('useStreamActions must be used within StreamProvider');
  }
  return context;
};

/**
 * Combined hook for state and actions
 */
export const useStream = () => {
  const state = useStreamState();
  const actions = useStreamActions();
  return { ...state, ...actions };
};

export default StreamProvider;