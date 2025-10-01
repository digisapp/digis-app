import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';

/**
 * Unified Agora hook for all session types
 * 
 * @param {Object} config
 * @param {string} config.appId - Agora App ID
 * @param {string} config.channel - Channel name
 * @param {string|number} config.uid - User ID
 * @param {'broadcast_public'|'broadcast_private'|'call_2way'} config.sessionType - Session type
 * @param {'host'|'audience'} config.role - User role (ignored for call_2way)
 * @param {Function} config.tokenProvider - Async function that returns fresh token
 * @param {Function} config.paywallGate - Async function for private broadcast validation
 * @param {Object} config.previewTracks - Optional preview tracks to reuse
 * @param {Function} config.onError - Error callback
 * @param {Function} config.onStateChange - Connection state change callback
 * @param {Function} config.onBillingStateChange - Billing state callback for pause/resume
 * @param {boolean} config.isMobile - Whether this is a mobile device
 */
export function useAgoraSession({
  appId,
  channel,
  uid,
  sessionType,
  role,
  tokenProvider,
  paywallGate,
  previewTracks,
  onError,
  onStateChange,
  onBillingStateChange,
  isMobile = false
}) {
  const clientRef = useRef(null);
  const audioTrackRef = useRef(null);
  const videoTrackRef = useRef(null);
  const tokenRefreshTimerRef = useRef(null);

  const [joined, setJoined] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [connState, setConnState] = useState('DISCONNECTED');
  const [quality, setQuality] = useState('unknown');
  const [remoteUsers, setRemoteUsers] = useState({});
  const [localAudioEnabled, setLocalAudioEnabled] = useState(true);
  const [localVideoEnabled, setLocalVideoEnabled] = useState(true);
  const [stats, setStats] = useState({ bitrate: 0, packetLoss: 0, latency: 0 });

  const isSafari = useMemo(
    () => /^((?!chrome|android).)*safari/i.test(navigator.userAgent),
    []
  );

  // Map Agora quality scale (1-6) to labels
  const qualityLabel = useCallback((q) => {
    switch (q) {
      case 1: return 'excellent';
      case 2: return 'good';
      case 3: return 'fair';
      case 4: return 'poor';
      case 5: return 'very poor';
      case 6: return 'down';
      default: return 'unknown';
    }
  }, []);

  const isBroadcast = sessionType === 'broadcast_public' || sessionType === 'broadcast_private';
  const isPrivateBroadcast = sessionType === 'broadcast_private';
  const is2WayCall = sessionType === 'call_2way';
  const audienceOnly = isBroadcast && role === 'audience';

  // Ensure client exists with correct mode
  const ensureClient = useCallback(() => {
    if (!clientRef.current) {
      const mode = isBroadcast ? 'live' : 'rtc';
      const codec = isSafari ? 'h264' : 'vp8';
      
      console.log(`🎥 Creating Agora client - Mode: ${mode}, Codec: ${codec}`);
      clientRef.current = AgoraRTC.createClient({ mode, codec });
    }
    return clientRef.current;
  }, [isBroadcast, isSafari]);

  // Play local video preview
  const playLocal = useCallback((videoEl) => {
    if (videoTrackRef.current && videoEl) {
      videoTrackRef.current.play(videoEl);
    }
  }, []);

  // Play remote user video
  const playRemote = useCallback((remoteUid, videoEl) => {
    const ru = remoteUsers[remoteUid];
    if (ru?.videoTrack && videoEl) {
      ru.videoTrack.play(videoEl);
    }
  }, [remoteUsers]);

  // Toggle local audio
  const toggleAudio = useCallback(async () => {
    if (!audioTrackRef.current) return false;
    const newState = !localAudioEnabled;
    await audioTrackRef.current.setEnabled(newState);
    setLocalAudioEnabled(newState);
    return newState;
  }, [localAudioEnabled]);

  // Toggle local video
  const toggleVideo = useCallback(async () => {
    if (!videoTrackRef.current) return false;
    const newState = !localVideoEnabled;
    await videoTrackRef.current.setEnabled(newState);
    setLocalVideoEnabled(newState);
    return newState;
  }, [localVideoEnabled]);

  // Switch camera (mobile)
  const flipCamera = useCallback(async () => {
    if (!videoTrackRef.current) return;
    
    try {
      const cameras = await AgoraRTC.getCameras();
      if (cameras.length <= 1) return;
      
      const currentLabel = videoTrackRef.current.getTrackLabel?.();
      const currentIndex = cameras.findIndex(cam => cam.label === currentLabel);
      const nextIndex = (currentIndex + 1) % cameras.length;
      const nextCamera = cameras[nextIndex];
      
      if (nextCamera?.deviceId) {
        await videoTrackRef.current.setDevice(nextCamera.deviceId);
        console.log(`📷 Switched to camera: ${nextCamera.label}`);
      }
    } catch (error) {
      console.error('Failed to flip camera:', error);
      onError?.({ type: 'CAMERA_SWITCH_FAILED', error });
    }
  }, [onError]);

  // Clean up and leave session
  const hardCleanup = useCallback(async () => {
    console.log('🧹 Performing hard cleanup...');
    
    // Clear token refresh timer
    if (tokenRefreshTimerRef.current) {
      clearTimeout(tokenRefreshTimerRef.current);
      tokenRefreshTimerRef.current = null;
    }

    try {
      clientRef.current?.removeAllListeners?.();
    } catch (e) {
      console.warn('Failed to remove listeners:', e);
    }

    try {
      if (clientRef.current) {
        // Unpublish tracks before leaving
        const tracks = [audioTrackRef.current, videoTrackRef.current].filter(Boolean);
        if (tracks.length > 0) {
          await clientRef.current.unpublish(tracks);
        }
        await clientRef.current.leave();
      }
    } catch (e) {
      console.warn('Failed to leave channel:', e);
    }

    // Stop and close tracks
    try {
      audioTrackRef.current?.stop();
      audioTrackRef.current?.close();
    } catch (e) {
      console.warn('Failed to close audio track:', e);
    }

    try {
      videoTrackRef.current?.stop();
      videoTrackRef.current?.close();
    } catch (e) {
      console.warn('Failed to close video track:', e);
    }

    // Reset all state
    clientRef.current = null;
    audioTrackRef.current = null;
    videoTrackRef.current = null;
    setRemoteUsers({});
    setJoined(false);
    setPublishing(false);
    setConnState('DISCONNECTED');
    setQuality('unknown');
    setStats({ bitrate: 0, packetLoss: 0, latency: 0 });
  }, []);

  // Schedule token refresh
  const scheduleTokenRefresh = useCallback((expiresInSeconds = 3600) => {
    // Clear existing timer
    if (tokenRefreshTimerRef.current) {
      clearTimeout(tokenRefreshTimerRef.current);
    }

    // Refresh 60 seconds before expiry
    const refreshTime = Math.max((expiresInSeconds - 60) * 1000, 10000);
    
    tokenRefreshTimerRef.current = setTimeout(async () => {
      try {
        console.log('🔄 Refreshing token...');
        const newToken = await tokenProvider();
        await clientRef.current?.renewToken(newToken);
        console.log('✅ Token refreshed successfully');
        
        // Schedule next refresh
        scheduleTokenRefresh(expiresInSeconds);
      } catch (error) {
        console.error('Failed to refresh token:', error);
        onError?.({ type: 'TOKEN_REFRESH_FAILED', error });
      }
    }, refreshTime);
  }, [tokenProvider, onError]);

  // Start session
  const start = useCallback(async () => {
    try {
      console.log(`🚀 Starting ${sessionType} session as ${role}`);
      const client = ensureClient();

      // Private broadcast paywall check for audience
      if (isPrivateBroadcast && role === 'audience' && paywallGate) {
        console.log('🔒 Checking paywall access...');
        const hasAccess = await paywallGate();
        if (!hasAccess) {
          throw new Error('PAYWALL_BLOCKED');
        }
      }

      // Set client role for broadcast mode
      if (isBroadcast) {
        await client.setClientRole(role === 'host' ? 'host' : 'audience');
        console.log(`📡 Client role set to: ${role}`);
      }

      // Setup event handlers
      client.on('connection-state-change', (currentState, previousState, reason) => {
        console.log(`🔌 Connection state: ${previousState} → ${currentState} (${reason})`);
        setConnState(currentState);
        onStateChange?.({ current: currentState, previous: previousState, reason });
        
        // Handle billing state based on connection
        if (onBillingStateChange) {
          if (currentState === 'RECONNECTING') {
            // Pause billing during reconnection
            onBillingStateChange('pause');
          } else if (currentState === 'CONNECTED' && previousState === 'RECONNECTING') {
            // Resume billing after successful reconnection
            onBillingStateChange('resume');
          } else if (currentState === 'DISCONNECTED' || currentState === 'FAILED') {
            // Stop billing on terminal failure
            onBillingStateChange('stop');
          }
        }
      });

      client.on('network-quality', (stats) => {
        const q = (isBroadcast && role === 'host') || is2WayCall
          ? stats.uplinkNetworkQuality
          : stats.downlinkNetworkQuality;
        setQuality(qualityLabel(q));
      });

      client.on('user-published', async (user, mediaType) => {
        // IMPORTANT: Always use user.uid (not user.id) for Agora SDK compatibility
        const remoteUid = user.uid;
        console.log(`📥 User ${remoteUid} published ${mediaType}`);
        
        await client.subscribe(user, mediaType);
        
        setRemoteUsers(prev => {
          const existing = prev[remoteUid] || {};
          
          if (mediaType === 'video') {
            const videoTrack = user.videoTrack;
            if (videoTrack) {
              existing.videoTrack = videoTrack;
            }
          }
          
          if (mediaType === 'audio') {
            const audioTrack = user.audioTrack;
            if (audioTrack) {
              existing.audioTrack = audioTrack;
              audioTrack.play(); // Auto-play remote audio
            }
          }
          
          return { ...prev, [remoteUid]: existing };
        });
      });

      client.on('user-unpublished', (user, mediaType) => {
        // IMPORTANT: Always use user.uid (not user.id) for Agora SDK compatibility
        const remoteUid = user.uid;
        console.log(`📤 User ${remoteUid} unpublished ${mediaType}`);
        
        setRemoteUsers(prev => {
          const existing = { ...(prev[remoteUid] || {}) };
          
          if (mediaType === 'video') delete existing.videoTrack;
          if (mediaType === 'audio') delete existing.audioTrack;
          
          const next = { ...prev, [remoteUid]: existing };
          if (!existing.videoTrack && !existing.audioTrack) {
            delete next[remoteUid];
          }
          
          return next;
        });
      });

      client.on('user-left', (user) => {
        // IMPORTANT: Always use user.uid (not user.id) for Agora SDK compatibility
        const remoteUid = user.uid;
        console.log(`👋 User ${remoteUid} left`);
        setRemoteUsers(prev => {
          const next = { ...prev };
          delete next[remoteUid];
          return next;
        });
      });

      // Token lifecycle events
      client.on('token-privilege-will-expire', async () => {
        console.log('⚠️ Token will expire soon, refreshing...');
        try {
          const newToken = await tokenProvider();
          await client.renewToken(newToken);
          console.log('✅ Token renewed successfully');
        } catch (error) {
          console.error('Failed to renew token:', error);
          onError?.({ type: 'TOKEN_RENEWAL_FAILED', error });
        }
      });

      client.on('token-privilege-did-expire', async () => {
        console.log('❌ Token expired, attempting recovery...');
        try {
          const newToken = await tokenProvider();
          await client.renewToken(newToken);
        } catch (error) {
          console.error('Token recovery failed, restarting session...', error);
          await hardCleanup();
          await start(); // Attempt full restart
        }
      });

      // Get fresh token and join
      const token = await tokenProvider();
      await client.join(appId, channel, token || null, uid);
      setJoined(true);
      console.log(`✅ Joined channel: ${channel}`);

      // Schedule token refresh (default 1 hour)
      scheduleTokenRefresh(3600);

      // Publish tracks if not audience-only
      if (!audienceOnly) {
        console.log('📹 Setting up local tracks...');
        
        let audioTrack, videoTrack;
        
        // Reuse preview tracks if available
        if (previewTracks?.audioMediaTrack && previewTracks?.videoMediaTrack) {
          console.log('🔄 Reusing preview tracks');
          audioTrack = await AgoraRTC.createCustomAudioTrack({
            mediaStreamTrack: previewTracks.audioMediaTrack
          });
          videoTrack = await AgoraRTC.createCustomVideoTrack({
            mediaStreamTrack: previewTracks.videoMediaTrack
          });
        } else {
          console.log('🆕 Creating new tracks');
          
          // Audio configuration
          const audioConfig = {
            AEC: true,  // Acoustic Echo Cancellation
            ANS: true,  // Automatic Noise Suppression
            AGC: true   // Automatic Gain Control
          };
          
          // Video configuration - optimized for mobile/network variance
          let videoConfig;
          if (isMobile) {
            // Mobile: Conservative settings for battery and heat management
            videoConfig = isBroadcast
              ? { encoderConfig: '720p_1' } // 720p@15fps for mobile broadcast
              : { encoderConfig: '480p_2' }; // 480p@30fps for mobile calls
          } else {
            // Desktop: Higher quality but still reasonable
            videoConfig = isBroadcast
              ? { encoderConfig: '720p_3' } // 720p@30fps for desktop broadcast
              : { encoderConfig: '720p_2' }; // 720p@30fps for desktop calls
          }
          
          [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
            audioConfig,
            videoConfig
          );
        }

        audioTrackRef.current = audioTrack;
        videoTrackRef.current = videoTrack;

        // Enable dual stream for broadcasts (adaptive bitrate)
        if (isBroadcast) {
          await client.enableDualStream();
          console.log('📶 Dual stream enabled for adaptive quality');
        }

        // Publish tracks
        await client.publish([audioTrack, videoTrack]);
        setPublishing(true);
        console.log('✅ Local tracks published');
      }

      // Collect stats periodically
      const statsInterval = setInterval(async () => {
        if (client && joined) {
          const rtcStats = client.getRTCStats();
          setStats({
            bitrate: rtcStats.SendBitrate || rtcStats.RecvBitrate || 0,
            packetLoss: rtcStats.SendPacketLossRate || rtcStats.RecvPacketLossRate || 0,
            latency: rtcStats.RTT || 0
          });
        }
      }, 2000);

      // Store interval ID for cleanup
      client._statsInterval = statsInterval;

    } catch (error) {
      console.error('Failed to start session:', error);
      onError?.({ type: 'START_FAILED', error });
      throw error;
    }
  }, [
    sessionType, role, appId, channel, uid, tokenProvider, paywallGate,
    ensureClient, isBroadcast, isPrivateBroadcast, is2WayCall, audienceOnly,
    qualityLabel, previewTracks, hardCleanup, scheduleTokenRefresh,
    onError, onStateChange, joined
  ]);

  // End session
  const end = useCallback(async () => {
    console.log('🛑 Ending session...');
    
    // Clear stats interval
    if (clientRef.current?._statsInterval) {
      clearInterval(clientRef.current._statsInterval);
    }
    
    await hardCleanup();
    console.log('✅ Session ended');
  }, [hardCleanup]);

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      hardCleanup();
    };
  }, [hardCleanup]);

  return {
    // State
    joined,
    publishing,
    connState,
    quality,
    remoteUsers,
    localAudioEnabled,
    localVideoEnabled,
    stats,

    // Actions
    start,
    end,
    playLocal,
    playRemote,
    toggleAudio,
    toggleVideo,
    flipCamera,

    // Refs (for advanced usage)
    audioTrack: audioTrackRef.current,
    videoTrack: videoTrackRef.current,
    client: clientRef.current
  };
}

export default useAgoraSession;