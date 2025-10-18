import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  VideoCameraIcon,
  MicrophoneIcon,
  CameraIcon,
  PhoneXMarkIcon,
  ChatBubbleLeftRightIcon,
  GiftIcon,
  SparklesIcon,
  HeartIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  VideoCameraSlashIcon,
  SignalIcon,
  SignalSlashIcon
} from '@heroicons/react/24/outline';
import {
  MicrophoneIcon as MicrophoneIconSolid,
  VideoCameraSlashIcon as VideoCameraSlashIconSolid
} from '@heroicons/react/24/solid';
import { useAgoraSession } from '../../hooks/useAgoraSession';
import { fetchJSON } from '../../utils/http';
import { getAuthToken } from '../../utils/auth-helpers';
import TipButton from '../payments/TipButton';
import LiveTipsOverlay from '../overlays/LiveTipsOverlay';

const MobileVideoStream = ({
  creator,
  user,
  token,
  channel,
  onEnd,
  sessionType = 'call_2way', // 'broadcast_public', 'broadcast_private', 'call_2way'
  isPrivate = false,
  streamId = null // Stream ID for context (optional)
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [showEffects, setShowEffects] = useState(false);
  const [reactions, setReactions] = useState([]);
  const [error, setError] = useState(null);
  const [billingState, setBillingState] = useState('active'); // ✅ MOVED: Must be with other useState hooks

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const videoContainerRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const mountedRef = useRef(true);

  // Determine role based on user type and session type
  const getUserRole = useCallback(() => {
    if (sessionType === 'call_2way') return 'host'; // Both are hosts in 2-way calls
    if (sessionType.includes('broadcast')) {
      return user?.id === creator?.id ? 'host' : 'audience';
    }
    return 'host';
  }, [sessionType, user?.id, creator?.id]);
  
  const role = getUserRole();

  // Token provider function with validation
  const tokenProvider = useCallback(async () => {
    try {
      const BASE = import.meta.env.VITE_BACKEND_URL;
      const auth = await getAuthToken();

      const data = await fetchJSON(`${BASE}/agora/refresh-token`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth}` },
        body: {
          channel,
          uid: user.id,
          role: getUserRole(),
          mode: sessionType === 'call_2way' ? 'rtc' : 'live'
        }
      });

      // Validate token response
      if (!data || typeof data.token !== 'string') {
        if (mountedRef.current) {
          setError({ type: 'TOKEN_REFRESH_FAILED' });
        }
        throw new Error('Invalid token payload');
      }

      return data.token;
    } catch (error) {
      console.error('Token provider error:', error);
      if (mountedRef.current) {
        setError({ type: 'TOKEN_REFRESH_FAILED', error });
      }
      // Fallback to provided token
      return token;
    }
  }, [channel, user.id, getUserRole, sessionType, token]);

  // Paywall gate for private broadcasts with explicit failure
  const paywallGate = useCallback(async () => {
    if (!isPrivate) return true;

    try {
      const BASE = import.meta.env.VITE_BACKEND_URL;
      const auth = await getAuthToken();

      const data = await fetchJSON(`${BASE}/streams/validate-access`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth}` },
        body: { channel, creatorId: creator.id }
      });

      if (!data.hasAccess && mountedRef.current) {
        setError({ type: 'PAYWALL_BLOCKED' });
      }
      return data.hasAccess;
    } catch (error) {
      console.error('Paywall validation error:', error);
      if (mountedRef.current) {
        setError({ type: 'PAYWALL_BLOCKED', error });
      }
      return false;
    }
  }, [isPrivate, channel, creator.id]);

  // Billing state management (state declared above with other useState hooks)
  const handleBillingStateChange = useCallback((state) => {
    setBillingState(state);
    console.log(`💰 Billing state changed to: ${state}`);
    
    // You can integrate with your billing system here
    // For example, pause/resume/stop token deduction
    if (window.billingManager) {
      if (state === 'pause') {
        window.billingManager.pauseBilling();
      } else if (state === 'resume') {
        window.billingManager.resumeBilling();
      } else if (state === 'stop') {
        window.billingManager.stopBilling();
      }
    }
  }, []);

  // Initialize Agora session using the hook
  const {
    joined,
    publishing,
    connState,
    quality,
    remoteUsers,
    localAudioEnabled,
    localVideoEnabled,
    stats,
    start,
    end,
    playLocal,
    playRemote,
    toggleAudio,
    toggleVideo,
    flipCamera
  } = useAgoraSession({
    appId: import.meta.env.VITE_AGORA_APP_ID,
    channel,
    uid: user.id,
    sessionType,
    role: getUserRole(),
    tokenProvider,
    paywallGate: isPrivate ? paywallGate : undefined,
    isMobile: true,
    onError: (error) => {
      console.error('Agora session error:', error);
      setError(error);
    },
    onStateChange: (state) => {
      console.log('Connection state changed:', state);
    },
    onBillingStateChange: handleBillingStateChange
  });

  // Start session on mount with cleanup
  useEffect(() => {
    mountedRef.current = true;
    
    if (!window.isSecureContext) {
      setError({ type: 'INSECURE_CONTEXT', message: 'HTTPS required for camera/microphone access' });
      return;
    }

    start().catch(err => {
      console.error('Failed to start session:', err);
      if (mountedRef.current) {
        setError({ type: 'START_FAILED', error: err });
      }
    });

    // Update call duration
    durationIntervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        setCallDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);

    return () => {
      mountedRef.current = false;
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      end();
    };
  }, [start, end]);

  // Play local video when available
  useEffect(() => {
    if (joined && publishing) {
      playLocal(localVideoRef.current);
    }
  }, [joined, publishing, playLocal]);

  // Play remote video when available
  useEffect(() => {
    const remoteUids = Object.keys(remoteUsers);
    if (remoteUids.length > 0) {
      // For 2-way calls or broadcasts, play the first remote user
      const firstRemoteUid = remoteUids[0];
      playRemote(firstRemoteUid, remoteVideoRef.current);
    }
  }, [remoteUsers, playRemote]);

  // Handle toggle video
  const handleToggleVideo = useCallback(async () => {
    const newState = await toggleVideo();
    // State is managed by the hook, no need to update local state
  }, [toggleVideo]);

  // Handle toggle audio  
  const handleToggleAudio = useCallback(async () => {
    const newState = await toggleAudio();
    // State is managed by the hook, no need to update local state
  }, [toggleAudio]);

  // Handle camera flip (mobile only)
  const handleFlipCamera = useCallback(async () => {
    await flipCamera();
  }, [flipCamera]);

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoContainerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Send reaction
  const sendReaction = (type) => {
    const newReaction = {
      id: Date.now(),
      type,
      x: Math.random() * 80 + 10,
      y: Math.random() * 80 + 10
    };
    setReactions([...reactions, newReaction]);
    
    // Remove reaction after animation
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== newReaction.id));
    }, 3000);
  };

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // End call with confirmation
  const handleEndCall = useCallback(async () => {
    const shouldEnd = window.confirm('Are you sure you want to end the stream?');
    if (shouldEnd) {
      await end();
      onEnd?.();
    }
  }, [end, onEnd]);

  // Connection quality indicator (fixed mapping)
  const getQualityColor = () => {
    switch (quality) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-green-400';
      case 'fair': return 'bg-yellow-500';
      case 'poor': return 'bg-orange-500';
      case 'very poor': return 'bg-red-500';
      case 'down': return 'bg-red-600';
      default: return 'bg-gray-500';
    }
  };

  // Get quality label for display
  const getQualityLabel = () => {
    if (quality === 'very poor') return 'Very Poor';
    return quality.charAt(0).toUpperCase() + quality.slice(1);
  };

  return (
    <div ref={videoContainerRef} className="mobile-video-container">
      {/* Remote Video (Full Screen) */}
      <div ref={remoteVideoRef} className="mobile-video-remote" />

      {/* Local Video (Picture-in-Picture) */}
      <motion.div
        ref={localVideoRef}
        className="mobile-video-local"
        drag
        dragConstraints={videoContainerRef}
        dragElastic={0.1}
        whileDrag={{ scale: 0.9 }}
      />

      {/* Live Tips Overlay - powered by Ably */}
      {channel && (
        <LiveTipsOverlay channel={channel} />
      )}

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 mobile-safe-top">
        <div className="mobile-glass-card px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={creator.profile_pic_url || '/api/placeholder/40/40'} 
              alt={creator.username}
              className="w-10 h-10 rounded-full border-2 border-white"
            />
            <div>
              <h3 className="font-semibold text-white">{creator.username}</h3>
              <div className="flex items-center gap-2 text-xs text-white/80">
                <span className={`w-2 h-2 rounded-full ${getQualityColor()}`} />
                <span>{formatDuration(callDuration)}</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-full bg-white/20 backdrop-blur-sm"
          >
            {isFullscreen ? (
              <ArrowsPointingInIcon className="w-5 h-5 text-white" />
            ) : (
              <ArrowsPointingOutIcon className="w-5 h-5 text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Reactions */}
      <AnimatePresence>
        {reactions.map((reaction) => (
          <motion.div
            key={reaction.id}
            className="absolute text-4xl"
            initial={{ 
              opacity: 0, 
              scale: 0,
              x: `${reaction.x}%`,
              y: `${reaction.y}%`
            }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              y: `${reaction.y - 30}%`
            }}
            exit={{ 
              opacity: 0,
              scale: 2,
              y: `${reaction.y - 60}%`
            }}
            transition={{ duration: 2, ease: "easeOut" }}
          >
            {reaction.type}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 mobile-safe-bottom">
        {/* Quick Reactions */}
        <div className="flex justify-center gap-2 mb-4">
          {['❤️', '👏', '🔥', '😍', '🎉'].map((emoji) => (
            <motion.button
              key={emoji}
              whileTap={{ scale: 0.8 }}
              onClick={() => sendReaction(emoji)}
              className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-2xl"
            >
              {emoji}
            </motion.button>
          ))}
        </div>

        {/* Main Controls */}
        <div className="mobile-video-controls">
          {/* Camera Toggle */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleToggleVideo}
            className={`mobile-video-control-btn ${!localVideoEnabled ? 'bg-red-500/50' : ''}`}
          >
            {localVideoEnabled ? (
              <VideoCameraIcon className="w-6 h-6 text-white" />
            ) : (
              <VideoCameraSlashIcon className="w-6 h-6 text-white" />
            )}
          </motion.button>

          {/* Microphone Toggle */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleToggleAudio}
            className={`mobile-video-control-btn ${!localAudioEnabled ? 'bg-red-500/50' : ''}`}
          >
            {localAudioEnabled ? (
              <MicrophoneIcon className="w-6 h-6 text-white" />
            ) : (
              <div className="relative">
                <MicrophoneIcon className="w-6 h-6 text-white" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-full h-0.5 bg-white rotate-45 transform origin-center"></div>
                </div>
              </div>
            )}
          </motion.button>

          {/* Flip Camera (for mobile) */}
          {publishing && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleFlipCamera}
              className="mobile-video-control-btn"
            >
              <CameraIcon className="w-6 h-6 text-white" />
            </motion.button>
          )}

          {/* End Call */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleEndCall}
            className="mobile-video-control-btn end-call"
          >
            <PhoneXMarkIcon className="w-6 h-6 text-white" />
          </motion.button>

          {/* Chat */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowChat(!showChat)}
            className="mobile-video-control-btn"
          >
            <ChatBubbleLeftRightIcon className="w-6 h-6 text-white" />
          </motion.button>

          {/* Effects */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowEffects(!showEffects)}
            className="mobile-video-control-btn"
          >
            <SparklesIcon className="w-6 h-6 text-white" />
          </motion.button>

          {/* Tip Button - Only show for audience or in 2-way calls */}
          {creator && creator.id !== user?.id && (
            <TipButton
              toCreatorId={creator.id}
              context={{
                streamId,
                callId: null,
                channel,
                type: sessionType
              }}
              onTipped={(data) => {
                console.log('Tip sent:', data);
                // Optional: Show success toast
              }}
              className="mobile-video-control-btn !bg-gradient-to-r !from-pink-500 !to-purple-500"
            />
          )}
        </div>

        {/* Token Counter & Stats */}
        <div className="mt-4 text-center space-y-2">
          {/* Only show token counter for 2-way calls */}
          {sessionType === 'call_2way' && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-sm rounded-full">
              <img src="/digis-coin.png" alt="Token" className="w-5 h-5" />
              <span className="text-white font-medium">
                {billingState === 'pause' && '⏸ Billing paused'}
                {billingState === 'stop' && '⏹ Billing stopped'}
                {billingState === 'active' && `${Math.floor(callDuration / 60) * creator.price_per_min} tokens spent`}
                {billingState === 'resume' && `${Math.floor(callDuration / 60) * creator.price_per_min} tokens spent`}
              </span>
            </div>
          )}
          
          {/* Connection Stats */}
          {stats.bitrate > 0 && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-black/30 backdrop-blur-sm rounded-full text-xs text-white/80">
              <SignalIcon className="w-4 h-4" />
              <span>{Math.round(stats.bitrate / 1000)} kbps</span>
              {stats.latency > 0 && <span>• {stats.latency}ms</span>}
            </div>
          )}
        </div>
      </div>

      {/* Chat Overlay */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="absolute top-0 right-0 bottom-0 w-80 bg-black/80 backdrop-blur-md p-4"
          >
            {/* Chat implementation */}
            <div className="text-white">Chat coming soon...</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Effects Panel */}
      <AnimatePresence>
        {showEffects && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="absolute bottom-20 left-0 right-0 bg-black/80 backdrop-blur-md p-4"
          >
            <div className="grid grid-cols-4 gap-4">
              {['Blur', 'Beauty', 'Vintage', 'B&W'].map((effect) => (
                <button
                  key={effect}
                  className="p-4 bg-white/20 rounded-lg text-white text-sm"
                >
                  {effect}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-20 left-4 right-4 bg-red-500/90 backdrop-blur-md rounded-lg p-4"
          >
            <div className="flex items-start gap-3">
              <SignalSlashIcon className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-white font-medium">Connection Error</p>
                <p className="text-white/80 text-sm mt-1">
                  {error.type === 'INSECURE_CONTEXT' && 'HTTPS is required for camera/microphone access'}
                  {error.type === 'PAYWALL_BLOCKED' && 'Access denied. Please purchase access to this stream.'}
                  {error.type === 'START_FAILED' && 'Failed to start the stream. Please try again.'}
                  {error.type === 'TOKEN_REFRESH_FAILED' && 'Authentication expired. Please refresh the page.'}
                  {!['INSECURE_CONTEXT', 'PAYWALL_BLOCKED', 'START_FAILED', 'TOKEN_REFRESH_FAILED'].includes(error.type) && 
                    'An error occurred. Please check your connection and try again.'}
                </p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>
            {/* Retry button for recoverable errors */}
            {['START_FAILED', 'TOKEN_REFRESH_FAILED'].includes(error?.type) && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => {
                    setError(null);
                    start().catch(err => {
                      console.error('Retry failed:', err);
                      if (mountedRef.current) {
                        setError({ type: 'START_FAILED', error: err });
                      }
                    });
                  }}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium transition-colors"
                >
                  Retry
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      <AnimatePresence>
        {!joined && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center"
          >
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white text-lg font-medium">Connecting...</p>
              <p className="text-white/60 text-sm mt-1">
                {sessionType === 'broadcast_private' && role === 'audience' && 'Verifying access...'}
                {sessionType === 'broadcast_public' && role === 'audience' && 'Joining broadcast...'}
                {sessionType === 'call_2way' && 'Starting video call...'}
                {role === 'host' && 'Initializing stream...'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MobileVideoStream;