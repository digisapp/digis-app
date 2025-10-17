import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import agoraLoader from '../../utils/AgoraLoader';
import toast from 'react-hot-toast';
import socketService from '../../utils/socket';
import { fetchJSON } from '../../utils/http';
import { getAuthToken } from '../../utils/auth-helpers';
import {
  VideoCameraIcon,
  MicrophoneIcon,
  XMarkIcon,
  UserGroupIcon,
  HeartIcon,
  ChatBubbleLeftIcon,
  GiftIcon,
  SparklesIcon,
  ArrowPathIcon,
  StopIcon,
  ChartBarIcon,
  CogIcon,
  TrophyIcon,
  ShareIcon,
  CheckCircleIcon,
  CloudArrowDownIcon,
  ComputerDesktopIcon,
  UserPlusIcon,
  ShoppingBagIcon,
  Bars3Icon,
  LockClosedIcon
} from '@heroicons/react/24/outline';
import {
  HeartIcon as HeartIconSolid,
  VideoCameraSlashIcon,
  SpeakerXMarkIcon
} from '@heroicons/react/24/solid';

const EnhancedMobileLiveStream = ({ user, onEnd, streamConfig = {}, channel, isCreator = false }) => {
  // Core streaming state
  const [isLive, setIsLive] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [localTracks, setLocalTracks] = useState({ video: null, audio: null });
  const [agoraRTC, setAgoraRTC] = useState(null);
  const [loading, setLoading] = useState(false);
  const [supportsScreenShare, setSupportsScreenShare] = useState(false);

  // UI state
  const [showMenu, setShowMenu] = useState(false);
  const [activePanel, setActivePanel] = useState(null); // 'chat', 'analytics', 'settings', 'gifts'
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showStreamEnded, setShowStreamEnded] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [connectionState, setConnectionState] = useState('DISCONNECTED'); // DISCONNECTED, CONNECTING, CONNECTED
  const [networkQuality, setNetworkQuality] = useState(0); // 0-5, lower is better

  // Stream data
  const [streamStats, setStreamStats] = useState({
    duration: 0,
    viewers: 0,
    peakViewers: 0,
    messages: 0,
    gifts: 0,
    tips: 0,
    revenue: 0,
    newFollowers: 0,
    engagement: 0
  });
  const [messages, setMessages] = useState([]);
  const [streamGoal, setStreamGoal] = useState({
    currentAmount: 0,
    level1: { amount: 5000, description: 'Level 1' },
    level2: { amount: 10000, description: 'Level 2' },
    level3: { amount: 25000, description: 'Level 3' },
    isVisible: true
  });

  const videoRef = useRef(null);
  const clientRef = useRef(null);
  const startTimeRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const tokenAbortRef = useRef(false);
  const clickedOnceRef = useRef(false);
  const renewTimerRef = useRef(null);
  const wakeLockRef = useRef(null);

  // Initialize Agora
  useEffect(() => {
    const initAgora = async () => {
      try {
        const AgoraRTC = await agoraLoader.loadRTC();
        setAgoraRTC(AgoraRTC);

        // Initialize camera immediately after Agora loads (iOS allows this in user-initiated modal)
        console.log('[EnhancedMobileLiveStream] Agora loaded, initializing camera...');
      } catch (error) {
        console.error('Failed to load Agora SDK:', error);
        toast.error('Failed to initialize streaming');
      }
    };
    initAgora();

    // Check for screen sharing support (iOS 17+ only)
    const checkScreenShare = () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        // iOS 17+ supports screen sharing
        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
        const iOSVersion = isIOS ? parseInt((navigator.userAgent.match(/OS (\d+)_/) || [])[1], 10) : 0;
        setSupportsScreenShare(!isIOS || iOSVersion >= 17);
      } else {
        setSupportsScreenShare(false);
      }
    };
    checkScreenShare();

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Initialize camera after Agora loads (iOS allows camera access in modals opened by user gesture)
  useEffect(() => {
    if (!agoraRTC || isLive) return;
    if (!videoRef.current) return;
    if (localTracks.video) return; // Already initialized

    const initPreview = async () => {
      try {
        console.log('[EnhancedMobileLiveStream] Initializing camera preview...');

        // Ensure video element is ready for iOS
        if (videoRef.current) {
          videoRef.current.muted = true;
          videoRef.current.playsInline = true;
          videoRef.current.autoplay = true;
        }

        await initializeCamera();

        // Ensure playback started
        if (localTracks.video && videoRef.current) {
          console.log('[EnhancedMobileLiveStream] Starting video playback...');
          await localTracks.video.play(videoRef.current, { fit: 'cover' });
          console.log('[EnhancedMobileLiveStream] Video playback started successfully');
        }
      } catch (e) {
        console.error('[EnhancedMobileLiveStream] Preview init failed:', e);
        toast.error('Camera preview failed. Please check permissions and try again.');
      }
    };

    initPreview();

    // Cleanup tracks on unmount
    return () => {
      console.log('[EnhancedMobileLiveStream] Cleaning up camera tracks...');
      if (localTracks.video) {
        localTracks.video.stop();
        localTracks.video.close();
      }
      if (localTracks.audio) {
        localTracks.audio.stop();
        localTracks.audio.close();
      }
    };
  }, [agoraRTC, isLive]);

  // Socket events for real-time updates
  useEffect(() => {
    if (!channel || !isLive) return;

    // Join stream room
    socketService.emit('join-stream', channel);

    // Viewer count updates
    socketService.on('viewer-count', (data) => {
      if (data.channel === channel) {
        setStreamStats(prev => ({
          ...prev,
          viewers: data.count,
          peakViewers: Math.max(prev.peakViewers, data.count)
        }));
      }
    });

    // Gift/tip tracking
    socketService.on('gift-received', (data) => {
      if (data.channel === channel) {
        setStreamStats(prev => ({
          ...prev,
          gifts: prev.gifts + (data.quantity || 1),
          revenue: prev.revenue + (data.totalValue || 0)
        }));
        if (streamGoal.isVisible) {
          setStreamGoal(prev => ({
            ...prev,
            currentAmount: prev.currentAmount + (data.totalValue || 0)
          }));
        }
      }
    });

    socketService.on('tip-received', (data) => {
      if (data.channel === channel) {
        setStreamStats(prev => ({
          ...prev,
          tips: prev.tips + (data.amount || 0),
          revenue: prev.revenue + (data.amount || 0)
        }));
        if (streamGoal.isVisible) {
          setStreamGoal(prev => ({
            ...prev,
            currentAmount: prev.currentAmount + (data.amount || 0)
          }));
        }
      }
    });

    // New messages
    socketService.on('message-sent', (data) => {
      if (data.channel === channel) {
        setStreamStats(prev => ({
          ...prev,
          messages: prev.messages + 1
        }));
        setMessages(prev => [...prev.slice(-20), data]); // Keep last 20 messages
      }
    });

    return () => {
      socketService.emit('leave-stream', channel);
      socketService.off('viewer-count');
      socketService.off('gift-received');
      socketService.off('tip-received');
      socketService.off('message-sent');
    };
  }, [channel, isLive, streamGoal.isVisible]);

  // Duration counter
  useEffect(() => {
    if (!isLive) return;

    startTimeRef.current = Date.now();
    durationIntervalRef.current = setInterval(() => {
      const seconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setStreamStats(prev => ({ ...prev, duration: seconds }));
    }, 1000);

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [isLive]);

  // Orientation reflow fix for iOS (prevents layout issues in portrait)
  useEffect(() => {
    const fixLayout = () => {
      document.body.style.transform = 'translateZ(0)';
      requestAnimationFrame(() => {
        document.body.style.transform = '';
      });
    };

    window.addEventListener('orientationchange', fixLayout);
    window.addEventListener('resize', fixLayout);

    return () => {
      window.removeEventListener('orientationchange', fixLayout);
      window.removeEventListener('resize', fixLayout);
    };
  }, []);

  // Backgrounding cleanup (iOS Safari)
  useEffect(() => {
    const onHide = () => {
      if (isLive) {
        console.log('[EnhancedMobileLiveStream] Page backgrounded - ending stream');
        handleEndStream();
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden && isLive) {
        console.log('[EnhancedMobileLiveStream] Page hidden - ending stream');
        onHide();
      }
    };

    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isLive]);

  // Before-unload guard (prevent accidental closes)
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (isLive) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isLive]);

  // Auto-hide controls after 3 seconds
  const resetControlsTimeout = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isLive) {
        setControlsVisible(false);
      }
    }, 3000);
  }, [isLive]);

  const initializeCamera = async () => {
    if (!agoraRTC) return;
    if (localTracks.video) return; // Already initialized

    try {
      const videoTrack = await agoraRTC.createCameraVideoTrack({
        encoderConfig: '480p_1',
        facingMode: 'user',
        optimizationMode: 'motion'
      });

      const audioTrack = await agoraRTC.createMicrophoneAudioTrack({
        encoderConfig: 'music_standard',
        AEC: true,
        ANS: true,
        AGC: true
      });

      if (videoRef.current && videoTrack) {
        videoTrack.play(videoRef.current);
      }

      setLocalTracks({ video: videoTrack, audio: audioTrack });
    } catch (error) {
      console.error('Failed to initialize camera:', error);
      toast.error('Camera initialization failed');
    }
  };

  const ensureCamera = async () => {
    if (localTracks.video || !agoraRTC) return;
    await initializeCamera();
  };

  // Token renewal logic
  const TOKEN_TTL_SEC = 55 * 60; // 55 minutes
  const scheduleRenew = useCallback((seconds = TOKEN_TTL_SEC - 300) => {
    if (renewTimerRef.current) {
      clearTimeout(renewTimerRef.current);
    }
    renewTimerRef.current = setTimeout(async () => {
      try {
        console.log('[agora] Renewing token...');
        const BASE = import.meta.env.VITE_BACKEND_URL;
        const auth = await getAuthToken();

        const { token } = await fetchJSON(`${BASE}/api/agora/refresh-token`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${auth}` },
          body: { channel }
        });

        await clientRef.current?.renewToken(token);
        console.log('[agora] Token renewed successfully');
        scheduleRenew(); // Schedule next renewal
      } catch (error) {
        console.warn('[agora] Token renew failed', error);
        // Retry sooner on failure
        scheduleRenew(60);
      }
    }, Math.max(30000, seconds * 1000));
  }, [channel]);

  // Request wake lock to keep screen on
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('[wake-lock] Screen wake lock active');
      }
    } catch (error) {
      console.log('[wake-lock] Not supported or failed:', error.message);
    }
  };

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('[wake-lock] Screen wake lock released');
      }
    } catch (error) {
      console.warn('[wake-lock] Release failed:', error);
    }
  };

  const handleStartStream = async () => {
    // Guard against multiple simultaneous clicks
    if (isLive || loading) {
      console.log('[handleStartStream] Already starting or live, ignoring click');
      return;
    }

    console.log('[handleStartStream] Starting stream process...');
    console.log('[handleStartStream] Initial tracks status:', {
      hasVideo: !!localTracks.video,
      hasAudio: !!localTracks.audio,
      agoraRTC: !!agoraRTC
    });

    setLoading(true);

    try {
      // Ensure preview tracks exist and are playing
      if (!localTracks.video || !localTracks.audio) {
        console.log('[handleStartStream] Tracks not ready, initializing camera...');
        await initializeCamera();

        // Ensure playback started
        if (localTracks.video && videoRef.current) {
          console.log('[handleStartStream] Starting video preview playback...');
          await localTracks.video.play(videoRef.current, { fit: 'cover' });
        }
      }

      // Final verification that tracks are ready
      if (!localTracks.video || !localTracks.audio) {
        const errorMsg = `Camera still not ready after initialization - Video: ${!!localTracks.video}, Audio: ${!!localTracks.audio}`;
        console.error('[handleStartStream]', errorMsg);
        toast.error('Camera not ready. Please allow camera and microphone permissions.');
        setLoading(false);
        return;
      }

      console.log('[handleStartStream] Tracks verified ready');

      if (!agoraRTC) throw new Error('Agora not initialized');

      // Create Agora client
      console.log('[handleStartStream] Creating Agora client...');
      const client = agoraRTC.createClient({ mode: 'live', codec: 'vp8' });
      clientRef.current = client;
      console.log('[handleStartStream] Agora client created');

      // Set up connection state listener
      client.on('connection-state-change', (cur, prev, reason) => {
        console.log('[agora] Connection state:', prev, '→', cur, 'reason:', reason);
        setConnectionState(cur);

        if (cur === 'CONNECTING') {
          toast('Reconnecting...', { icon: '🔄', duration: 2000 });
        } else if (cur === 'CONNECTED' && prev === 'CONNECTING') {
          toast.success('Connected!');
        } else if (cur === 'DISCONNECTED' && isLive) {
          toast.error('Connection lost. Please check your internet.');
        }
      });

      // Set up network quality listener
      client.on('network-quality', (stats) => {
        setNetworkQuality(stats.uplinkNetworkQuality);
        if (stats.uplinkNetworkQuality >= 4) {
          console.warn('[agora] Poor network quality:', stats.uplinkNetworkQuality);
        }
      });

      // Set up token renewal listener
      client.on('token-privilege-will-expire', async () => {
        console.log('[agora] Token privilege will expire, renewing...');
        try {
          const BASE = import.meta.env.VITE_BACKEND_URL;
          const auth = await getAuthToken();

          const { token } = await fetchJSON(`${BASE}/api/agora/refresh-token`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${auth}` },
            body: { channel }
          });

          await client.renewToken(token);
          console.log('[agora] Token renewed via privilege-will-expire');
        } catch (error) {
          console.warn('[agora] Token renewal via privilege-will-expire failed', error);
        }
      });

      // Enable dual stream for better bandwidth management
      try {
        await client.enableDualStream();
        console.log('[agora] Dual stream enabled');
      } catch (error) {
        console.log('[agora] Dual stream not supported:', error.message);
      }

      // Fetch RTC token from backend
      console.log('[handleStartStream] Fetching token from backend...');
      const BASE = import.meta.env.VITE_BACKEND_URL;
      const auth = await getAuthToken();
      console.log('[handleStartStream] Got auth token, backend URL:', BASE);

      const { token, appId, uid } = await fetchJSON(`${BASE}/api/agora/token`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth}` },
        body: { channelName: channel }
      });
      console.log('[handleStartStream] Token received, appId:', appId, 'uid:', uid);

      // Join channel
      console.log('[handleStartStream] Joining Agora channel:', channel);
      await client.join(appId, channel, token, uid || user?.id || null);
      console.log('[handleStartStream] Successfully joined channel');

      // Publish local tracks
      console.log('[handleStartStream] Publishing local tracks...');
      await client.publish([localTracks.audio, localTracks.video]);
      console.log('[handleStartStream] Tracks published successfully');

      // Request wake lock
      await requestWakeLock();

      // Schedule token renewal
      scheduleRenew();

      setIsLive(true);
      setConnectionState('CONNECTED');
      console.log('[handleStartStream] Stream started successfully!');
      toast.success('You are now live!');
    } catch (error) {
      console.error('[handleStartStream] Failed to start stream:', error);
      console.error('[handleStartStream] Error details:', {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack
      });

      // Agora-specific error codes
      const agoraErrors = {
        'INVALID_PARAMS': 'Invalid stream parameters',
        'NOT_SUPPORTED': 'Browser does not support streaming',
        'INVALID_OPERATION': 'Invalid operation - please refresh and try again',
        'OPERATION_ABORTED': 'Operation was cancelled',
        'WEB_SECURITY_RESTRICT': 'Security restrictions prevent streaming',
        'UNEXPECTED_ERROR': 'Unexpected streaming error',
        'TIMEOUT': 'Connection timeout - check your internet',
        'INVALID_APP_ID': 'Invalid Agora configuration',
        'INVALID_CHANNEL_NAME': 'Invalid channel name',
        'TOKEN_EXPIRED': 'Stream token expired',
        'INVALID_TOKEN': 'Invalid stream token',
        'UID_CONFLICT': 'User ID conflict - please try again',
      };

      // Determine user-friendly error message
      let userMessage = 'Failed to start stream';

      if (error.code && agoraErrors[error.code]) {
        userMessage = agoraErrors[error.code];
      } else if (error.message?.includes('token') || error.message?.includes('Token')) {
        userMessage = 'Authentication failed. Please try again.';
      } else if (error.message?.includes('camera') || error.message?.includes('track') || error.message?.includes('permission')) {
        userMessage = 'Camera or microphone error. Please check permissions.';
      } else if (error.message?.includes('network') || error.message?.includes('connection')) {
        userMessage = 'Network error. Please check your internet connection.';
      } else if (error.message) {
        userMessage = `Failed to start: ${error.message}`;
      }

      toast.error(userMessage);
    } finally {
      setLoading(false);
      console.log('[handleStartStream] Cleanup complete');
    }
  };

  const toggleVideo = async () => {
    if (localTracks.video) {
      const newState = !isVideoEnabled;
      await localTracks.video.setEnabled(newState);
      setIsVideoEnabled(newState);
      toast.success(newState ? 'Camera on' : 'Camera off');
      resetControlsTimeout(); // Keep controls visible after toggle
    }
  };

  const toggleAudio = async () => {
    if (localTracks.audio) {
      const newState = !isAudioEnabled;
      await localTracks.audio.setEnabled(newState);
      setIsAudioEnabled(newState);
      toast.success(newState ? 'Mic on' : 'Mic muted');
      resetControlsTimeout(); // Keep controls visible after toggle
    }
  };

  const switchCamera = async () => {
    if (!agoraRTC || !localTracks.video) return;

    try {
      const oldVideoTrack = localTracks.video;
      oldVideoTrack.stop();
      oldVideoTrack.close();

      const newVideoTrack = await agoraRTC.createCameraVideoTrack({
        encoderConfig: '480p_1',
        facingMode: isFrontCamera ? 'environment' : 'user',
        optimizationMode: 'motion'
      });

      if (videoRef.current) {
        newVideoTrack.play(videoRef.current);
      }

      // If live, replace the published track
      const client = clientRef.current;
      if (client && isLive) {
        try {
          await client.unpublish([oldVideoTrack]);
        } catch (err) {
          console.warn('Unpublish old track error:', err);
        }
        await client.publish([newVideoTrack]);
      }

      setLocalTracks(prev => ({ ...prev, video: newVideoTrack }));
      setIsFrontCamera(!isFrontCamera);
      resetControlsTimeout(); // Keep controls visible after flip
    } catch (error) {
      console.error('Failed to switch camera:', error);
      toast.error('Failed to switch camera');
    }
  };

  const handleEndStream = async () => {
    setShowEndConfirm(false);
    setLoading(true);

    try {
      // Clear renewal timer
      if (renewTimerRef.current) {
        clearTimeout(renewTimerRef.current);
        renewTimerRef.current = null;
      }

      // Release wake lock
      await releaseWakeLock();

      // Unpublish and leave Agora channel
      const client = clientRef.current;
      if (client) {
        try {
          await client.unpublish();
        } catch (err) {
          console.warn('Unpublish error:', err);
        }
        try {
          await client.leave();
        } catch (err) {
          console.warn('Leave error:', err);
        }
        clientRef.current = null;
      }

      // Stop and close local tracks
      if (localTracks.video) {
        localTracks.video.stop();
        localTracks.video.close();
      }
      if (localTracks.audio) {
        localTracks.audio.stop();
        localTracks.audio.close();
      }

      setIsLive(false);
      setConnectionState('DISCONNECTED');
      setShowStreamEnded(true);
    } catch (error) {
      console.error('Error ending stream:', error);
      toast.error('Error ending stream');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCurrentGoalLevel = () => {
    if (streamGoal.currentAmount >= streamGoal.level3.amount) return 3;
    if (streamGoal.currentAmount >= streamGoal.level2.amount) return 2;
    if (streamGoal.currentAmount >= streamGoal.level1.amount) return 1;
    return 0;
  };

  const getGoalProgress = () => {
    const level = getCurrentGoalLevel();
    if (level === 0) {
      return (streamGoal.currentAmount / streamGoal.level1.amount) * 100;
    } else if (level === 1) {
      return ((streamGoal.currentAmount - streamGoal.level1.amount) / (streamGoal.level2.amount - streamGoal.level1.amount)) * 100;
    } else if (level === 2) {
      return ((streamGoal.currentAmount - streamGoal.level2.amount) / (streamGoal.level3.amount - streamGoal.level2.amount)) * 100;
    }
    return 100;
  };

  // Render before going live
  if (!isLive) {
    return (
      <div
        className="fixed inset-0 z-[9999] flex flex-col bg-black"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          blockSize: '100dvh',
          WebkitOverflowScrolling: 'touch',
          overflowY: 'auto',
        }}
        data-golive-modal="true"
      >
        <div className="relative flex-1 w-full">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted
            style={{ transform: 'scaleX(-1)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />

          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center">
            <h2 className="text-white font-semibold text-lg">{streamConfig?.title || 'Live Stream'}</h2>
            <button onClick={onEnd} className="p-2 bg-black/40 rounded-full">
              <XMarkIcon className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Start button */}
          <div className="absolute bottom-20 left-0 right-0 px-6">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleStartStream}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl font-bold text-lg shadow-2xl disabled:opacity-50"
            >
              {loading ? 'Starting...' : '🔴 Go Live!'}
            </motion.button>
          </div>

          {/* Camera controls */}
          <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-center gap-4">
            <button onClick={toggleVideo} className={`p-4 rounded-full backdrop-blur-sm ${!isVideoEnabled ? 'bg-red-500' : 'bg-white/20'}`}>
              {isVideoEnabled ? <VideoCameraIcon className="w-6 h-6 text-white" /> : <VideoCameraSlashIcon className="w-6 h-6 text-white" />}
            </button>
            <button onClick={toggleAudio} className={`p-4 rounded-full backdrop-blur-sm ${!isAudioEnabled ? 'bg-red-500' : 'bg-white/20'}`}>
              {isAudioEnabled ? <MicrophoneIcon className="w-6 h-6 text-white" /> : <SpeakerXMarkIcon className="w-6 h-6 text-white" />}
            </button>
            <button onClick={switchCamera} className="p-4 rounded-full backdrop-blur-sm bg-white/20">
              <ArrowPathIcon className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main live stream view
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-black"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        blockSize: '100dvh',
        WebkitOverflowScrolling: 'touch',
        overflowY: 'auto',
      }}
      onClick={resetControlsTimeout}
      onTouchStart={resetControlsTimeout}
      data-golive-modal="true"
    >
      <div className="relative flex-1 w-full">
        {/* Video */}
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          playsInline
          muted
          style={{ transform: isFrontCamera ? 'scaleX(-1)' : 'none' }}
        />

        {/* Top Overlay - Always visible */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-full flex items-center gap-1 animate-pulse">
                <span className="w-2 h-2 bg-white rounded-full" />
                LIVE
              </span>
              <span className="text-white text-sm font-medium">{formatDuration(streamStats.duration)}</span>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => setShowMenu(true)} className="p-2 bg-black/40 rounded-full backdrop-blur-sm">
                <Bars3Icon className="w-5 h-5 text-white" />
              </button>
              <button onClick={() => setShowEndConfirm(true)} className="p-2 bg-red-600 rounded-full">
                <XMarkIcon className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 text-white text-sm">
            <div className="flex items-center gap-1">
              <UserGroupIcon className="w-4 h-4" />
              <span className="font-medium">{streamStats.viewers}</span>
            </div>
            <div className="flex items-center gap-1">
              <HeartIconSolid className="w-4 h-4 text-red-500" />
              <span className="font-medium">{streamStats.gifts + streamStats.tips}</span>
            </div>
            <div className="flex items-center gap-1">
              <ChatBubbleLeftIcon className="w-4 h-4" />
              <span className="font-medium">{streamStats.messages}</span>
            </div>
            {/* Network quality indicator */}
            {networkQuality > 0 && (
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${
                  networkQuality <= 2 ? 'bg-green-500' :
                  networkQuality === 3 ? 'bg-yellow-500' :
                  'bg-red-500'
                }`} />
              </div>
            )}
          </div>

          {/* Reconnecting pill */}
          <AnimatePresence>
            {connectionState === 'CONNECTING' && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="absolute top-4 left-4 px-3 py-1.5 bg-yellow-500/90 backdrop-blur-sm rounded-full flex items-center gap-2"
              >
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-white text-xs font-medium">Reconnecting...</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stream title */}
          <h3 className="text-white font-semibold mt-2 text-sm">{streamConfig?.title}</h3>

          {/* Stream Goal Progress */}
          {streamGoal.isVisible && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 bg-black/40 backdrop-blur-sm rounded-lg p-3"
            >
              <div className="flex items-center justify-between text-white text-xs mb-1">
                <span className="flex items-center gap-1">
                  <TrophyIcon className="w-3 h-3" />
                  Goal Level {getCurrentGoalLevel() + 1}
                </span>
                <span className="font-bold">{streamGoal.currentAmount} / {streamGoal[`level${getCurrentGoalLevel() + 1}`]?.amount || streamGoal.level3.amount}</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(getGoalProgress(), 100)}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-gradient-to-r from-green-500 via-blue-500 to-purple-500"
                />
              </div>
            </motion.div>
          )}
        </div>

        {/* Live messages overlay - bottom left */}
        <div className="absolute bottom-32 left-4 right-4 max-h-48 overflow-hidden">
          <AnimatePresence>
            {messages.slice(-3).map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="mb-2 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 max-w-xs"
              >
                <span className="text-purple-400 font-semibold text-sm">{msg.user}: </span>
                <span className="text-white text-sm">{msg.text}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Bottom Control Bar - Toggle visibility */}
        <AnimatePresence>
          {controlsVisible && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="absolute bottom-0 left-0 right-0 p-4 pb-[env(safe-area-inset-bottom)] bg-gradient-to-t from-black/90 to-transparent"
            >
              {/* Primary controls */}
              <div className="flex justify-center gap-3 mb-4">
                <button
                  onClick={switchCamera}
                  className="p-3 bg-white/20 rounded-full backdrop-blur-sm"
                  aria-label="Switch camera"
                >
                  <ArrowPathIcon className="w-6 h-6 text-white" />
                </button>

                <button
                  onClick={toggleVideo}
                  className={`p-3 rounded-full backdrop-blur-sm ${!isVideoEnabled ? 'bg-red-500' : 'bg-white/20'}`}
                  aria-label={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                >
                  {isVideoEnabled ? <VideoCameraIcon className="w-6 h-6 text-white" /> : <VideoCameraSlashIcon className="w-6 h-6 text-white" />}
                </button>

                <button
                  onClick={toggleAudio}
                  className={`p-3 rounded-full backdrop-blur-sm ${!isAudioEnabled ? 'bg-red-500' : 'bg-white/20'}`}
                  aria-label={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
                >
                  {isAudioEnabled ? <MicrophoneIcon className="w-6 h-6 text-white" /> : <SpeakerXMarkIcon className="w-6 h-6 text-white" />}
                </button>

                <button
                  onClick={() => setActivePanel('chat')}
                  className="p-3 bg-purple-600 rounded-full relative"
                  aria-label={`Open chat${streamStats.messages > 0 ? ` (${streamStats.messages} messages)` : ''}`}
                >
                  <ChatBubbleLeftIcon className="w-6 h-6 text-white" />
                  {streamStats.messages > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                      {streamStats.messages > 9 ? '9+' : streamStats.messages}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActivePanel('analytics')}
                  className="p-3 bg-blue-600 rounded-full"
                  aria-label="Open analytics"
                >
                  <ChartBarIcon className="w-6 h-6 text-white" />
                </button>
              </div>

              {/* Secondary actions */}
              {isCreator && (
                <div className="flex justify-center gap-2 flex-wrap">
                  <button
                    className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-white text-xs flex items-center gap-1"
                    aria-label="Invite co-host"
                  >
                    <UserPlusIcon className="w-4 h-4" />
                    Co-host
                  </button>
                  <button
                    className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-white text-xs flex items-center gap-1"
                    aria-label="Show products"
                  >
                    <ShoppingBagIcon className="w-4 h-4" />
                    Products
                  </button>
                  <button
                    className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-white text-xs flex items-center gap-1"
                    aria-label="Start private show"
                  >
                    <LockClosedIcon className="w-4 h-4" />
                    Private
                  </button>
                  {supportsScreenShare && (
                    <button
                      className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-white text-xs flex items-center gap-1"
                      aria-label="Share screen"
                    >
                      <ComputerDesktopIcon className="w-4 h-4" />
                      Screen
                    </button>
                  )}
                  <button
                    className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-white text-xs flex items-center gap-1"
                    aria-label="Share stream"
                  >
                    <ShareIcon className="w-4 h-4" />
                    Share
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Side panels */}
        <AnimatePresence>
          {activePanel && (
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-gray-900 shadow-2xl overflow-hidden"
              role="dialog"
              aria-modal="true"
              aria-label={activePanel === 'chat' ? 'Live chat' : activePanel === 'analytics' ? 'Stream analytics' : 'Settings'}
            >
              {/* Panel header */}
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 flex items-center justify-between">
                <h3 className="text-white font-bold text-lg">
                  {activePanel === 'chat' && 'Live Chat'}
                  {activePanel === 'analytics' && 'Analytics'}
                  {activePanel === 'settings' && 'Settings'}
                </h3>
                <button onClick={() => setActivePanel(null)} className="p-2 bg-white/20 rounded-full">
                  <XMarkIcon className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Panel content */}
              <div className="flex-1 overflow-y-auto p-4">
                {activePanel === 'analytics' && (
                  <div className="space-y-4">
                    <div className="bg-gray-800 rounded-lg p-4">
                      <div className="text-gray-400 text-xs mb-1">Total Viewers</div>
                      <div className="text-white text-3xl font-bold">{streamStats.viewers}</div>
                      <div className="text-gray-500 text-xs">Peak: {streamStats.peakViewers}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-800 rounded-lg p-4">
                        <div className="text-gray-400 text-xs mb-1">Gifts</div>
                        <div className="text-purple-400 text-2xl font-bold">{streamStats.gifts}</div>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-4">
                        <div className="text-gray-400 text-xs mb-1">Tips</div>
                        <div className="text-pink-400 text-2xl font-bold">{streamStats.tips}</div>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-4">
                        <div className="text-gray-400 text-xs mb-1">Messages</div>
                        <div className="text-blue-400 text-2xl font-bold">{streamStats.messages}</div>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-4">
                        <div className="text-gray-400 text-xs mb-1">Revenue</div>
                        <div className="text-green-400 text-2xl font-bold">{streamStats.revenue} tokens</div>
                        <div className="text-xs text-gray-500 mt-1">≈ ${(streamStats.revenue * 0.05).toFixed(2)}</div>
                      </div>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-4">
                      <div className="text-gray-400 text-xs mb-1">Engagement Rate</div>
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                          style={{ width: `${Math.min(streamStats.engagement, 100)}%` }}
                        />
                      </div>
                      <div className="text-white text-sm mt-1">{streamStats.engagement.toFixed(1)}%</div>
                    </div>
                  </div>
                )}

                {activePanel === 'chat' && (
                  <div className="space-y-2">
                    {messages.map((msg, i) => (
                      <div key={i} className="bg-gray-800 rounded-lg p-3">
                        <div className="text-purple-400 font-semibold text-sm">{msg.user}</div>
                        <div className="text-white text-sm">{msg.text}</div>
                      </div>
                    ))}
                    {messages.length === 0 && (
                      <div className="text-center text-gray-500 py-8">
                        No messages yet
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* End Stream Confirmation */}
        <AnimatePresence>
          {showEndConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 flex items-center justify-center p-6"
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm"
              >
                <h3 className="text-white text-xl font-bold mb-3">End Stream?</h3>
                <p className="text-gray-400 mb-6">Are you sure you want to end your live stream?</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowEndConfirm(false)}
                    className="flex-1 py-3 bg-gray-800 text-white rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEndStream}
                    className="flex-1 py-3 bg-red-600 text-white rounded-lg font-medium"
                  >
                    End Stream
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stream Ended Overlay */}
        <AnimatePresence>
          {showStreamEnded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/95 flex items-center justify-center p-6"
            >
              <motion.div
                initial={{ scale: 0.8, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                className="text-center w-full max-w-md"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring' }}
                  className="mb-6"
                >
                  <CheckCircleIcon className="w-24 h-24 text-green-500 mx-auto" />
                </motion.div>

                <h1 className="text-white text-3xl font-bold mb-4">Stream Ended</h1>

                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-2xl font-bold text-purple-400">{formatDuration(streamStats.duration)}</div>
                      <div className="text-xs text-gray-400">Duration</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-400">{streamStats.viewers}</div>
                      <div className="text-xs text-gray-400">Viewers</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-400">{streamStats.gifts + streamStats.tips}</div>
                      <div className="text-xs text-gray-400">Gifts & Tips</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-yellow-400">{streamStats.messages}</div>
                      <div className="text-xs text-gray-400">Messages</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {isCreator && (
                    <button className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                      <CloudArrowDownIcon className="w-5 h-5" />
                      Save Recording
                    </button>
                  )}
                  <button
                    onClick={onEnd}
                    className="w-full py-4 bg-white/20 text-white rounded-xl font-bold backdrop-blur-sm"
                  >
                    Return Home
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default EnhancedMobileLiveStream;
