// /src/contexts/MobileStreamContext.jsx
import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

/**
 * MobileStreamContext
 *
 * Shared streaming state to prevent concurrent sessions and provide
 * global visibility into active live streams.
 *
 * Features:
 * - Global lock to prevent duplicate streaming sessions
 * - Shared Agora client reference
 * - Active stream metadata (channel, uid, mode)
 * - Clean teardown on unmount
 */

const MobileStreamContext = createContext(null);

export function MobileStreamProvider({ children }) {
  const [isLive, setIsLive] = useState(false);
  const [channel, setChannel] = useState(null);
  const [uid, setUid] = useState(null);
  const [mode, setMode] = useState('live'); // 'live' or 'rtc'

  const clientRef = useRef(null);
  const localAudioRef = useRef(null);
  const localVideoRef = useRef(null);

  /**
   * Start a stream session
   * Returns false if a session is already active (global guard)
   */
  const startStream = useCallback(({ channel: ch, uid: u, mode: m = 'live', client, audioTrack, videoTrack }) => {
    // Global guard: prevent concurrent sessions
    if (window._streamActive) {
      console.warn('🚫 Stream already active - cannot start concurrent session');
      return false;
    }

    window._streamActive = true;
    setIsLive(true);
    setChannel(ch);
    setUid(u);
    setMode(m);

    clientRef.current = client || null;
    localAudioRef.current = audioTrack || null;
    localVideoRef.current = videoTrack || null;

    console.log('🔴 Stream started:', { channel: ch, uid: u, mode: m });
    return true;
  }, []);

  /**
   * End the current stream session
   * Clears global lock and resets all state
   */
  const endStream = useCallback(() => {
    setIsLive(false);
    setChannel(null);
    setUid(null);
    setMode('live');

    clientRef.current = null;
    localAudioRef.current = null;
    localVideoRef.current = null;

    // Clear global lock
    delete window._streamActive;

    console.log('⚪ Stream ended');
  }, []);

  /**
   * Check if user can start a new stream
   */
  const canStartStream = useCallback(() => {
    return !window._streamActive && !isLive;
  }, [isLive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (window._streamActive) {
        console.log('🧹 MobileStreamContext unmounted - clearing global lock');
        delete window._streamActive;
      }
    };
  }, []);

  const value = {
    // State
    isLive,
    channel,
    uid,
    mode,

    // Refs (for accessing Agora client/tracks if needed)
    clientRef,
    localAudioRef,
    localVideoRef,

    // Actions
    startStream,
    endStream,
    canStartStream
  };

  return (
    <MobileStreamContext.Provider value={value}>
      {children}
    </MobileStreamContext.Provider>
  );
}

/**
 * Hook to access mobile streaming context
 * Throws error if used outside provider
 */
export function useMobileStream() {
  const context = useContext(MobileStreamContext);
  if (!context) {
    throw new Error('useMobileStream must be used within MobileStreamProvider');
  }
  return context;
}

export default MobileStreamContext;
