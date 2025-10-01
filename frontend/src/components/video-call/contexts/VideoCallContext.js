/**
 * Context provider for VideoCall state management
 * @module contexts/VideoCallContext
 */

import React, { createContext, useContext, useReducer, useCallback } from 'react';

// Initial state
const initialState = {
  // Connection state
  isJoined: false,
  connectionState: 'DISCONNECTED',
  networkQuality: { uplink: 0, downlink: 0 },
  
  // Media state
  isAudioEnabled: true,
  isVideoEnabled: true,
  isScreenSharing: false,
  
  // UI state
  showChat: false,
  showGifts: false,
  showEffects: false,
  showSettings: false,
  isFullscreen: false,
  
  // Call info
  callDuration: 0,
  sessionCost: 0,
  participants: [],
  
  // Recording
  isRecording: false,
  recordingUrl: null,
  
  // Quality
  videoQuality: 'auto',
  audioQuality: 'high'
};

// Action types
const ActionTypes = {
  SET_CONNECTION_STATE: 'SET_CONNECTION_STATE',
  SET_MEDIA_STATE: 'SET_MEDIA_STATE',
  TOGGLE_UI_PANEL: 'TOGGLE_UI_PANEL',
  UPDATE_CALL_INFO: 'UPDATE_CALL_INFO',
  SET_RECORDING_STATE: 'SET_RECORDING_STATE',
  SET_QUALITY: 'SET_QUALITY',
  RESET_STATE: 'RESET_STATE'
};

// Reducer
const videoCallReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.SET_CONNECTION_STATE:
      return {
        ...state,
        ...action.payload
      };
      
    case ActionTypes.SET_MEDIA_STATE:
      return {
        ...state,
        ...action.payload
      };
      
    case ActionTypes.TOGGLE_UI_PANEL:
      return {
        ...state,
        [action.panel]: action.value !== undefined ? action.value : !state[action.panel]
      };
      
    case ActionTypes.UPDATE_CALL_INFO:
      return {
        ...state,
        ...action.payload
      };
      
    case ActionTypes.SET_RECORDING_STATE:
      return {
        ...state,
        isRecording: action.payload.isRecording,
        recordingUrl: action.payload.recordingUrl || state.recordingUrl
      };
      
    case ActionTypes.SET_QUALITY:
      return {
        ...state,
        videoQuality: action.payload.videoQuality || state.videoQuality,
        audioQuality: action.payload.audioQuality || state.audioQuality
      };
      
    case ActionTypes.RESET_STATE:
      return initialState;
      
    default:
      return state;
  }
};

// Create contexts
const VideoCallStateContext = createContext();
const VideoCallDispatchContext = createContext();

/**
 * VideoCall context provider
 */
export const VideoCallProvider = ({ children, initialValues = {} }) => {
  const [state, dispatch] = useReducer(
    videoCallReducer,
    { ...initialState, ...initialValues }
  );

  // Action creators
  const actions = {
    setConnectionState: useCallback((payload) => {
      dispatch({ type: ActionTypes.SET_CONNECTION_STATE, payload });
    }, []),
    
    setMediaState: useCallback((payload) => {
      dispatch({ type: ActionTypes.SET_MEDIA_STATE, payload });
    }, []),
    
    toggleUIPanel: useCallback((panel, value) => {
      dispatch({ type: ActionTypes.TOGGLE_UI_PANEL, panel, value });
    }, []),
    
    updateCallInfo: useCallback((payload) => {
      dispatch({ type: ActionTypes.UPDATE_CALL_INFO, payload });
    }, []),
    
    setRecordingState: useCallback((payload) => {
      dispatch({ type: ActionTypes.SET_RECORDING_STATE, payload });
    }, []),
    
    setQuality: useCallback((payload) => {
      dispatch({ type: ActionTypes.SET_QUALITY, payload });
    }, []),
    
    resetState: useCallback(() => {
      dispatch({ type: ActionTypes.RESET_STATE });
    }, [])
  };

  return (
    <VideoCallStateContext.Provider value={state}>
      <VideoCallDispatchContext.Provider value={actions}>
        {children}
      </VideoCallDispatchContext.Provider>
    </VideoCallStateContext.Provider>
  );
};

/**
 * Hook to use VideoCall state
 */
export const useVideoCallState = () => {
  const context = useContext(VideoCallStateContext);
  if (!context) {
    throw new Error('useVideoCallState must be used within VideoCallProvider');
  }
  return context;
};

/**
 * Hook to use VideoCall actions
 */
export const useVideoCallActions = () => {
  const context = useContext(VideoCallDispatchContext);
  if (!context) {
    throw new Error('useVideoCallActions must be used within VideoCallProvider');
  }
  return context;
};

/**
 * Combined hook for state and actions
 */
export const useVideoCall = () => {
  const state = useVideoCallState();
  const actions = useVideoCallActions();
  return { ...state, ...actions };
};

export default VideoCallProvider;