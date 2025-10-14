// /src/hooks/useMobileAgora.js
import { useEffect, useRef, useState, useCallback } from 'react';
import toast from 'react-hot-toast';

// If you already preload via your agoraLoader, this import will be cached.
import AgoraRTC from 'agora-rtc-sdk-ng';

/**
 * useMobileAgora
 * Safe mobile wrapper around Agora (one client, one join).
 *
 * Features:
 * - Explicit mic/cam permission flow
 * - Single-client/track guards (no duplicate init)
 * - Robust teardown (stop → close → unpublish → leave → remove listeners)
 * - Remote user state + helpful errors
 */
export default function useMobileAgora({
  appId,
  mode = 'live',          // 'rtc' or 'live'
  codec = 'vp8',          // 'vp8' is broadly compatible on mobile
  initialVideo = true,
  initialAudio = true
} = {}) {
  const clientRef = useRef(null);
  const joinedRef = useRef(false);
  const localAudioRef = useRef(null);
  const localVideoRef = useRef(null);
  const unmountedRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const lastChannelRef = useRef(null);
  const lastTokenRef = useRef(null);
  const wakeLockRef = useRef(null);

  const [isInitializing, setIsInitializing] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [error, setError] = useState(null);
  const [connectionState, setConnectionState] = useState('DISCONNECTED');

  // --- helpers --------------------------------------------------------------

  const resetError = useCallback(() => setError(null), []);

  // Wake lock management (battery saving)
  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('🔒 Wake lock acquired');
      } catch (err) {
        console.warn('Wake lock request failed:', err);
      }
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('🔓 Wake lock released');
      } catch (err) {
        console.warn('Wake lock release failed:', err);
      }
    }
  }, []);
  const setErr = useCallback((e) => {
    console.error('[Agora] Error:', e);
    setError(e instanceof Error ? e.message : String(e));
  }, []);

  const ensureClient = useCallback(() => {
    if (!clientRef.current) {
      clientRef.current = AgoraRTC.createClient({ mode, codec });
    }
    return clientRef.current;
  }, [mode, codec]);

  // --- permissions (prompt *before* creating tracks) ------------------------

  const requestPermissions = useCallback(async () => {
    try {
      // ask for both when possible — iOS shows a single combined prompt
      await navigator.mediaDevices.getUserMedia({
        audio: initialAudio,
        video: initialVideo ? { facingMode: 'user' } : false
      });
      return true;
    } catch (e) {
      setErr(new Error('Microphone/Camera permission denied'));
      return false;
    }
  }, [initialAudio, initialVideo, setErr]);

  // --- tracks ---------------------------------------------------------------

  const createLocalTracks = useCallback(async () => {
    try {
      const [micTrack, camTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
        initialAudio ? {} : { microphoneId: undefined, encoderConfig: undefined },
        initialVideo
          ? {
              encoderConfig: {
                width: 720,
                height: 1280,
                frameRate: 30,
                bitrateMin: 600,
                bitrateMax: 1200
              },
              optimizationMode: 'detail', // better face clarity
              facingMode: 'user'
            }
          : { cameraId: undefined, encoderConfig: undefined }
      );

      localAudioRef.current = initialAudio ? micTrack : null;
      localVideoRef.current = initialVideo ? camTrack : null;
    } catch (e) {
      setErr(new Error('Failed to create local tracks'));
      throw e;
    }
  }, [initialAudio, initialVideo, setErr]);

  const closeLocalTracks = useCallback(async () => {
    try {
      if (localAudioRef.current) {
        localAudioRef.current.stop();
        localAudioRef.current.close();
        localAudioRef.current = null;
      }
      if (localVideoRef.current) {
        localVideoRef.current.stop();
        localVideoRef.current.close();
        localVideoRef.current = null;
      }
    } catch (e) {
      // swallow
    }
  }, []);

  // --- reconnection logic ---------------------------------------------------

  const MAX_RECONNECT_ATTEMPTS = 3;
  const RECONNECT_DELAY_MS = 2000;

  const attemptReconnect = useCallback(async () => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error('❌ Max reconnection attempts reached');
      setError('Connection lost. Please rejoin the stream.');
      setConnectionState('FAILED');
      return;
    }

    if (!lastChannelRef.current) {
      console.warn('⚠️ No channel to reconnect to');
      return;
    }

    reconnectAttemptsRef.current += 1;
    console.log(`🔄 Reconnection attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}`);
    setConnectionState('RECONNECTING');

    try {
      // Try to rejoin with saved credentials
      const client = ensureClient();
      const assignedUid = await client.join(
        appId,
        lastChannelRef.current,
        lastTokenRef.current || null,
        null
      );

      // Republish tracks
      const pubTracks = [];
      if (localAudioRef.current) pubTracks.push(localAudioRef.current);
      if (localVideoRef.current) pubTracks.push(localVideoRef.current);
      if (pubTracks.length) await client.publish(pubTracks);

      // Success!
      reconnectAttemptsRef.current = 0;
      setConnectionState('CONNECTED');
      if (!unmountedRef.current) {
        setIsJoined(true);
        setError(null);
      }
      console.log('✅ Reconnection successful');

      return assignedUid;
    } catch (e) {
      console.error('❌ Reconnection failed:', e);
      // Schedule next attempt
      reconnectTimerRef.current = setTimeout(() => {
        attemptReconnect();
      }, RECONNECT_DELAY_MS);
    }
  }, [appId, ensureClient]);

  // --- remote user management ----------------------------------------------

  const attachClientListeners = useCallback((client) => {
    const handleUserPublished = async (user, mediaType) => {
      try {
        await client.subscribe(user, mediaType);
        setRemoteUsers(Array.from(client.remoteUsers));
        if (mediaType === 'video' && user.videoTrack) {
          // autoplay policies on mobile sometimes block — play on next user gesture if needed
          user.videoTrack.play(`remote-video-${user.uid}`, { fit: 'cover' });
        }
        if (mediaType === 'audio' && user.audioTrack) {
          user.audioTrack.play();
        }
      } catch (e) {
        setErr(new Error('Failed subscribing to remote user'));
      }
    };

    const handleUserUnpublished = () => {
      setRemoteUsers(Array.from(client.remoteUsers));
    };
    const handleUserJoined = () => setRemoteUsers(Array.from(client.remoteUsers));
    const handleUserLeft = () => setRemoteUsers(Array.from(client.remoteUsers));

    // Connection state monitoring for auto-reconnect
    const handleConnectionStateChange = (curState, revState, reason) => {
      console.log('📡 Connection state:', curState, 'reason:', reason);
      setConnectionState(curState);

      if (curState === 'DISCONNECTED' && reason === 'NETWORK_ERROR') {
        console.log('🔄 Network error detected - attempting reconnect');
        // Clear any existing timer
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
        }
        // Attempt reconnect after delay
        reconnectTimerRef.current = setTimeout(() => {
          attemptReconnect();
        }, RECONNECT_DELAY_MS);
      } else if (curState === 'CONNECTED') {
        // Reset attempts on successful connection
        reconnectAttemptsRef.current = 0;
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
      }
    };

    client.on('user-published', handleUserPublished);
    client.on('user-unpublished', handleUserUnpublished);
    client.on('user-joined', handleUserJoined);
    client.on('user-left', handleUserLeft);
    client.on('connection-state-change', handleConnectionStateChange);

    // return an unclogger
    return () => {
      client.off('user-published', handleUserPublished);
      client.off('user-unpublished', handleUserUnpublished);
      client.off('user-joined', handleUserJoined);
      client.off('user-left', handleUserLeft);
      client.off('connection-state-change', handleConnectionStateChange);
    };
  }, [setErr]);

  // --- public API -----------------------------------------------------------

  const init = useCallback(async () => {
    if (isInitializing || joinedRef.current) return;
    setIsInitializing(true);
    resetError();

    try {
      const ok = await requestPermissions();
      if (!ok) {
        setIsInitializing(false);
        return;
      }

      ensureClient(); // create client early
      await createLocalTracks();
    } catch (e) {
      // error already set by helpers
    } finally {
      setIsInitializing(false);
    }
  }, [isInitializing, requestPermissions, ensureClient, createLocalTracks, resetError]);

  const join = useCallback(
    async ({ channel, token = null, uid = null }) => {
      if (!appId) {
        setErr(new Error('Missing Agora appId'));
        return;
      }
      if (joinedRef.current) return; // guard

      // Lock early to prevent race condition on fast double-taps
      joinedRef.current = true;
      resetError();

      // Store credentials for reconnection
      lastChannelRef.current = channel;
      lastTokenRef.current = token;

      const client = ensureClient();

      // LIVE mode requires a role; use "host" for broadcasters on mobile
      if (client._options?.mode === 'live' && client.setClientRole) {
        try { await client.setClientRole('host'); } catch (_) {}
      }

      try {
        // join first
        const assignedUid = await client.join(appId, channel, token || null, uid || null);

        // publish tracks only if created
        const pubTracks = [];
        if (localAudioRef.current) pubTracks.push(localAudioRef.current);
        if (localVideoRef.current) pubTracks.push(localVideoRef.current);
        if (pubTracks.length) await client.publish(pubTracks);

        const detach = attachClientListeners(client);
        client.__detachHandlers = detach;

        if (!unmountedRef.current) {
          setIsJoined(true);
          setConnectionState('CONNECTED');
          reconnectAttemptsRef.current = 0; // Reset on successful join
        }

        return assignedUid;
      } catch (e) {
        setErr(new Error('Failed to join the channel'));
        // Release lock on failure
        joinedRef.current = false;
        // ensure partial resources are closed
        await closeLocalTracks();
        try { await client.leave(); } catch (_) {}
      }
    },
    [appId, ensureClient, attachClientListeners, closeLocalTracks, resetError, setErr]
  );

  const leave = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;

    // Clear any pending reconnection attempts
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
    lastChannelRef.current = null;
    lastTokenRef.current = null;

    try {
      // unpublish first
      const pubTracks = [];
      if (localAudioRef.current) pubTracks.push(localAudioRef.current);
      if (localVideoRef.current) pubTracks.push(localVideoRef.current);
      if (pubTracks.length) await client.unpublish(pubTracks);
    } catch (_) {}

    await closeLocalTracks();

    try { client.__detachHandlers?.(); } catch (_) {}
    try { await client.leave(); } catch (_) {}

    joinedRef.current = false;
    if (!unmountedRef.current) {
      setIsJoined(false);
      setRemoteUsers([]);
      setConnectionState('DISCONNECTED');
    }
  }, [closeLocalTracks]);

  const toggleCamera = useCallback(async () => {
    if (!localVideoRef.current) return;
    const enabled = localVideoRef.current.enabled;
    await localVideoRef.current.setEnabled(!enabled);
    return !enabled;
  }, []);

  const toggleMic = useCallback(async () => {
    if (!localAudioRef.current) return;
    const enabled = localAudioRef.current.enabled;
    await localAudioRef.current.setEnabled(!enabled);
    return !enabled;
  }, []);

  // Flip camera (front ↔ back) without rebuilding tracks
  const flipCamera = useCallback(async () => {
    if (!localVideoRef.current) return false;
    try {
      const devices = await AgoraRTC.getCameras();
      if (!devices?.length) return false;

      // Pick the other camera
      const currentLabel = localVideoRef.current.getTrackLabel?.() || '';
      const next = devices.find(d => !currentLabel.includes(d.label)) || devices[0];
      await localVideoRef.current.setDevice(next.deviceId);
      console.log('📷 Flipped camera to:', next.label);
      return true;
    } catch (e) {
      console.error('Failed to flip camera:', e);
      return false;
    }
  }, []);

  // Play local video into a DOM element
  const playLocal = useCallback((el) => {
    if (localVideoRef.current && el) {
      localVideoRef.current.play(el, { fit: 'cover' });
      return true;
    }
    return false;
  }, []);

  // Play remote user video into a DOM element
  const playRemote = useCallback((uid, el) => {
    const client = clientRef.current;
    if (!client || !el) return false;
    const remote = client.remoteUsers?.find?.(u => u.uid === uid);
    if (remote?.videoTrack) {
      remote.videoTrack.play(el, { fit: 'cover' });
      return true;
    }
    return false;
  }, []);

  // Wake lock: Request when joined, release when left (battery optimization)
  useEffect(() => {
    if (isJoined) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
  }, [isJoined, requestWakeLock, releaseWakeLock]);

  // cleanup on unmount + visibility change
  useEffect(() => {
    const onHide = () => {
      if (document.hidden && joinedRef.current) {
        console.log('📱 Page backgrounded - leaving stream');
        leave();
        // Notify user why stream ended
        toast('Stream ended when app was backgrounded', {
          icon: '📱',
          duration: 4000
        });
      }
    };
    document.addEventListener('visibilitychange', onHide);

    return () => {
      unmountedRef.current = true;
      // Clear any pending reconnection attempts
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      // Release wake lock on unmount
      releaseWakeLock();
      // run full leave pipeline
      leave();
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [leave, releaseWakeLock]);

  return {
    // state
    isInitializing,
    isJoined,
    remoteUsers,
    error,
    connectionState,

    // local tracks (refs)
    localAudioTrack: localAudioRef,
    localVideoTrack: localVideoRef,

    // actions
    init,
    join,
    leave,
    toggleCamera,
    toggleMic,
    flipCamera,
    playLocal,
    playRemote,
    resetError,
    attemptReconnect
  };
}
