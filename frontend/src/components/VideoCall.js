import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import agoraLoader from '../utils/AgoraLoader';
import { supabase, getAuthToken } from '../utils/supabase-auth.js';
import toast from 'react-hot-toast';
import VirtualGifts from './VirtualGifts';
import AdaptiveQualityController from '../utils/AdaptiveQualityController';
import ConnectionResilience from '../utils/ConnectionResilience';
import FallbackManager from '../utils/FallbackManager';
import ConnectionStatusPanel from './ConnectionStatusPanel';
import MultiVideoGrid from './MultiVideoGrid';
import BeautyFilters from './BeautyFilters';
import StreamQualityConfig from '../utils/StreamQualityConfig';
import { UserGroupIcon, VideoCameraIcon, SparklesIcon } from '@heroicons/react/24/outline';

const VideoCall = forwardRef(({ 
  channel, 
  token: initialToken, 
  uid, 
  isHost, 
  isStreaming = false, 
  isVoiceOnly = false,
  onTokenExpired,
  onSessionEnd,
  onTokenDeduction,
  user,
  tokenBalance = 0,
  onTokenUpdate,
  activeCoHosts = [],
  useMultiVideoGrid = false,
  onLocalTracksCreated
}, ref) => {
  const client = useRef(null);
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const [token, setToken] = useState(initialToken);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(!isStreaming && !isVoiceOnly);
  const [isJoined, setIsJoined] = useState(false);
  const [localTracks, setLocalTracks] = useState({ audioTrack: null, videoTrack: null, screenTrack: null });
  const [connectionState, setConnectionState] = useState('DISCONNECTED');
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [networkQuality, setNetworkQuality] = useState({ uplink: 0, downlink: 0 });
  const [callDuration, setCallDuration] = useState(0);
  const durationRef = useRef(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tokenRefreshCount, setTokenRefreshCount] = useState(0);
  const [sessionCost, setSessionCost] = useState(0);
  const [showGifts, setShowGifts] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [videoQuality, setVideoQuality] = useState(StreamQualityConfig.defaultQuality);
  const [viewerQuality, setViewerQuality] = useState('auto');
  const [dualStreamEnabled, setDualStreamEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const [beautyMode, setBeautyMode] = useState(false);
  const [virtualBackground, setVirtualBackground] = useState('none');
  const [showBeautyFilters, setShowBeautyFilters] = useState(false);
  const [beautySettings, setBeautySettings] = useState({});
  const [audioSettings, setAudioSettings] = useState({
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true
  });
  const [bandwidthLimit, setBandwidthLimit] = useState('unlimited');
  const [layoutMode, setLayoutMode] = useState('grid'); // 'grid', 'speaker', 'gallery'
  const [showQualityPanel, setShowQualityPanel] = useState(false);
  
  // Quality adaptation state
  const qualityController = useRef(null);
  const [adaptiveQuality, setAdaptiveQuality] = useState({
    enabled: true,
    userPreference: StreamQualityConfig.defaultAdaptiveMode, // 'auto', 'ultra', 'high', 'medium', 'low'
    currentProfile: null,
    networkQuality: 'good'
  });
  
  // Connection resilience state
  const connectionResilience = useRef(null);
  const fallbackManager = useRef(null);
  const [showConnectionStatus, setShowConnectionStatus] = useState(false);
  const [resilienceStatus, setResilienceStatus] = useState({
    connectionHealth: 'unknown',
    fallbackActive: false,
    currentMode: 'FULL_VIDEO',
    reconnectAttempts: 0
  });
  
  // SDK Loading state
  const [sdkLoading, setSdkLoading] = useState(false);
  const [sdkLoadError, setSdkLoadError] = useState(null);
  const [agoraRTC, setAgoraRTC] = useState(null);

  const callStartTime = useRef(null);
  const durationInterval = useRef(null);
  const tokenRefreshTimer = useRef(null);
  const costCalculationInterval = useRef(null);

  // Fetch current token balance
  const fetchTokenBalance = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tokens/balance`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        onTokenUpdate?.(data.balance);
      }
    } catch (error) {
      console.error('❌ Failed to fetch token balance:', error);
    }
  }, [onTokenUpdate]);

  // Token refresh function
  const refreshToken = useCallback(async () => {
    try {
      console.log('🔄 Refreshing Agora token...');
      const authToken = await getAuthToken();
      const role = isHost || isStreaming ? 'host' : 'audience';
      
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/agora/token?channel=${channel}&uid=${uid}&role=${role}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();
      const newToken = data.rtcToken || data.token;
      
      if (client.current && isJoined) {
        await client.current.renewToken(newToken);
      }
      
      setToken(newToken);
      setTokenRefreshCount(prev => prev + 1);
      
      // Schedule next refresh (tokens expire in 2 hours, refresh every 1.5 hours)
      tokenRefreshTimer.current = setTimeout(refreshToken, 90 * 60 * 1000);
      
      console.log('✅ Token refreshed successfully');
      // toast.success('Connection refreshed');
      
    } catch (error) {
      console.error('❌ Token refresh error:', error);
      toast.error('Failed to refresh connection');
      
      if (onTokenExpired) {
        onTokenExpired();
      }
    }
  }, [channel, uid, isHost, isStreaming, isJoined, onTokenExpired]);

  // Real-time cost calculation for fans
  const startCostCalculation = useCallback(async () => {
    if (isHost || isStreaming) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      // Get creator's rate
      const creatorId = channel.split('-')[1]; // Extract from channel name
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/users/profile?uid=${creatorId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const creatorData = await response.json();
        const pricePerMin = creatorData.price_per_min || 5;
        const tokensPerMin = Math.ceil(pricePerMin / 0.05); // 0.05 per token

        // Update cost every second
        costCalculationInterval.current = setInterval(() => {
          const elapsedSeconds = durationRef.current || callDuration;
          const elapsedMinutes = Math.ceil(elapsedSeconds / 60);
          const cost = elapsedMinutes * tokensPerMin;
          setSessionCost(cost);

          // Trigger callback if provided
          if (onTokenDeduction && elapsedMinutes > 0 && elapsedSeconds % 60 === 0) {
            onTokenDeduction(tokensPerMin);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('❌ Failed to setup cost calculation:', error);
    }
  }, [channel, isHost, isStreaming, callDuration, onTokenDeduction]);

  // Setup event handlers with token expiration handling
  const setupEventHandlers = useCallback(() => {
    if (!client.current) return;

    client.current.on('user-published', async (user, mediaType) => {
      console.log('User published:', { uid: user.id, mediaType });
      try {
        await client.current.subscribe(user, mediaType);
        console.log('Subscribed to user:', user.id);
        
        setRemoteUsers(prevUsers => {
          const existingUser = prevUsers.find(u => u.id === user.id);
          if (existingUser) {
            return prevUsers.map(u => 
              u.id === user.id 
                ? { ...u, [mediaType]: user[mediaType === 'video' ? 'videoTrack' : 'audioTrack'] }
                : u
            );
          } else {
            return [...prevUsers, { 
              uid: user.id, 
              [mediaType]: user[mediaType === 'video' ? 'videoTrack' : 'audioTrack']
            }];
          }
        });
        
        // Play video in the specific remote user's video element
        if (mediaType === 'video') {
          setTimeout(() => {
            const videoElement = document.getElementById(`remote-video-${user.id}`);
            if (videoElement && user.videoTrack) {
              user.videoTrack.play(videoElement);
            } else if (remoteVideo.current) {
              // Fallback to single remote video element
              user.videoTrack.play(remoteVideo.current);
            }
          }, 100); // Small delay to ensure DOM is updated
        }
        if (mediaType === 'audio') {
          user.audioTrack.play();
        }
        
        // Configure stream fallback for viewers
        if (!isHost && client.current) {
          try {
            // Enable automatic stream fallback based on network conditions
            await client.current.setStreamFallbackOption(user.id, 2); // 2 = AUTO mode
            console.log(`✅ Enabled auto stream fallback for user ${user.id}`);
          } catch (error) {
            console.warn('Failed to set stream fallback:', error);
          }
        }
      } catch (error) {
        console.error('Subscription error:', error);
      }
    });

    client.current.on('user-unpublished', (user, mediaType) => {
      console.log('User unpublished:', { uid: user.id, mediaType });
      
      setRemoteUsers(prevUsers => {
        return prevUsers.map(u => 
          u.id === user.id 
            ? { ...u, [mediaType]: null }
            : u
        ).filter(u => u.video || u.audio);
      });
      
      if (mediaType === 'video' && remoteVideo.current) {
        remoteVideo.current.srcObject = null;
      }
    });

    client.current.on('connection-state-change', (curState, revState) => {
      console.log('Connection state changed:', { from: revState, to: curState });
      setConnectionState(curState);
      
      if (curState === 'DISCONNECTED' || curState === 'FAILED') {
        toast.error('Connection lost. Attempting to reconnect...');
      }
    });

    client.current.on('user-left', (user) => {
      console.log('User left:', user.id);
      setRemoteUsers(prevUsers => prevUsers.filter(u => u.id !== user.id));
      if (remoteVideo.current) {
        remoteVideo.current.srcObject = null;
      }
    });

    client.current.on('network-quality', (stats) => {
      setNetworkQuality({ 
        uplink: stats.uplinkNetworkQuality, 
        downlink: stats.downlinkNetworkQuality 
      });
    });

    // Token expiration handlers
    client.current.on('token-privilege-will-expire', async () => {
      console.log('⚠️ Agora token will expire in 30 seconds');
      toast('Token expiring soon, refreshing...', { icon: '⚠️' });
      await refreshToken();
    });

    client.current.on('token-privilege-expired', async () => {
      console.log('❌ Agora token expired');
      toast.error('Token expired, attempting to refresh...');
      await refreshToken();
    });

    client.current.on('error', (error) => {
      console.error('Agora client error:', error);
      setConnectionState('FAILED');
      toast.error(`Connection error: ${error.message}`);
    });
  }, [refreshToken]);

  // Get video encoder configuration based on quality setting
  const getVideoEncoderConfig = useCallback((quality) => {
    const configs = {
      '2k_1': {
        width: 2560,
        height: 1440,
        frameRate: 30,
        bitrate: 4000,
        minBitrate: 3000,
        maxBitrate: 6000
      },
      '1080p_1': {
        width: 1920,
        height: 1080,
        frameRate: 30,
        bitrate: 2000,
        minBitrate: 1500,
        maxBitrate: 3000
      },
      '720p_1': '720p_1', // Use Agora preset
      '480p': '480p_4',    // Use Agora preset
      '360p': '360p_7',    // Use Agora preset
      '180p': '180p_4'     // Use Agora preset
    };
    
    return configs[quality] || '720p_1';
  }, []);

  // Create and publish tracks
  const createAndPublishTracks = useCallback(async () => {
    if (!agoraRTC) {
      throw new Error('Agora RTC SDK not loaded');
    }

    try {
      console.log('Creating tracks for host...');
      
      // Determine video config - always default to 2K
      // The adaptive quality controller will handle downgrades if network is poor
      const videoConfig = StreamQualityConfig.getEncoderConfig(StreamQualityConfig.defaultQuality);
      console.log('🎥 Using video encoder config:', videoConfig);
      
      const tracks = await agoraLoader.createTracks(
        {
          enabled: isAudioEnabled,
          encoderConfig: 'music_standard',
        },
        {
          enabled: isVideoEnabled && !isVoiceOnly,
          encoderConfig: videoConfig,
          optimizationMode: 'motion',
        }
      );

      setLocalTracks(tracks);
      
      // Notify parent component about track creation
      if (onLocalTracksCreated && typeof onLocalTracksCreated === 'function') {
        onLocalTracksCreated(tracks);
      }

      // Configure video encoder for 2K by default
      if (tracks.videoTrack && typeof videoConfig === 'object') {
        await tracks.videoTrack.setVideoEncoderConfiguration(videoConfig);
        console.log('✅ Applied 2K video encoder configuration:', videoConfig);
        
        // Also update the video quality state to reflect 2K
        setVideoQuality(StreamQualityConfig.defaultQuality);
      }

      // Enable dual stream mode for host
      if (isHost && isStreaming && tracks.videoTrack) {
        try {
          await client.current.enableDualStream();
          setDualStreamEnabled(true);
          console.log('✅ Dual stream mode enabled');
        } catch (error) {
          console.warn('Failed to enable dual stream:', error);
        }
      }

      const tracksToPublish = [];
      if (tracks.audioTrack) tracksToPublish.push(tracks.audioTrack);
      if (tracks.videoTrack) {
        tracksToPublish.push(tracks.videoTrack);
        if (localVideo.current) {
          tracks.videoTrack.play(localVideo.current);
        }
      }

      if (tracksToPublish.length > 0) {
        await client.current.publish(tracksToPublish);
        console.log('Published tracks:', tracksToPublish.map(t => t.trackMediaType));
      }

    } catch (error) {
      console.error('Error creating/publishing tracks:', error);
      toast.error('Failed to setup media tracks');
    }
  }, [agoraRTC, isAudioEnabled, isVideoEnabled, isVoiceOnly, isHost, isStreaming, getVideoEncoderConfig, onLocalTracksCreated]);

  // Initialize quality controller
  const initializeQualityController = useCallback(() => {
    if (!client.current || qualityController.current) return;

    try {
      console.log('🎛️ Initializing adaptive quality controller...');
      
      qualityController.current = new AdaptiveQualityController(client.current, {
        enableAdaptation: adaptiveQuality.enabled,
        userPreference: StreamQualityConfig.defaultAdaptiveMode, // Default to ultra (1080p)
        deviceType: detectDeviceType(),
        smoothTransitions: true
      });

      // Setup quality controller event listeners
      qualityController.current.on('quality-adapted', (data) => {
        console.log(`🔄 Quality adapted: ${data.fromProfile} → ${data.toProfile}`);
        setAdaptiveQuality(prev => ({
          ...prev,
          currentProfile: data.toProfile,
          networkQuality: data.networkQuality
        }));
        
        // toast.success(`Quality adjusted to ${data.toProfile}`, {
        //   duration: 2000,
        //   position: 'top-right'
        // });
      });

      qualityController.current.on('network-quality-change', (data) => {
        setNetworkQuality({
          uplink: data.metrics.uplinkQuality || 0,
          downlink: data.metrics.downlinkQuality || 0,
          rtt: data.metrics.rtt || 0,
          packetLoss: data.metrics.packetLoss || 0
        });
        
        setAdaptiveQuality(prev => ({
          ...prev,
          networkQuality: data.qualityLevel
        }));
      });

      qualityController.current.on('adaptation-failed', (data) => {
        console.warn('Quality adaptation failed:', data.error);
        toast.error('Quality adjustment failed', { duration: 3000 });
      });

      // Start quality controller with current tracks
      qualityController.current.start(localTracks.videoTrack, localTracks.audioTrack);
      
    } catch (error) {
      console.error('Failed to initialize quality controller:', error);
    }
  }, [adaptiveQuality.enabled, adaptiveQuality.userPreference, localTracks]);

  // Detect device type for quality optimization
  const detectDeviceType = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /mobile|android|iphone|ipad|tablet/.test(userAgent);
    const isTablet = /tablet|ipad/.test(userAgent);
    
    if (isMobile && !isTablet) return 'mobile';
    if (isTablet) return 'tablet';
    
    const memory = navigator.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    
    if (memory <= 2 || cores <= 2) return 'low-end-desktop';
    if (memory >= 8 && cores >= 8) return 'high-end-desktop';
    
    return 'desktop';
  };

  // Initialize connection resilience
  const initializeConnectionResilience = useCallback(async () => {
    if (!client.current) return;

    try {
      console.log('🛡️ Initializing connection resilience...');
      
      // Initialize connection resilience manager
      connectionResilience.current = new ConnectionResilience(client.current, {
        maxReconnectAttempts: 5,
        baseReconnectDelay: 2000,
        maxReconnectDelay: 30000,
        fallbackEnabled: true,
        enableAudioFallback: true,
        enableChatFallback: true
      });

      // Initialize fallback manager
      fallbackManager.current = new FallbackManager({
        enableVideoFallback: true,
        enableAudioFallback: true,
        enableChatFallback: true
      });

      // Setup connection resilience event listeners
      connectionResilience.current.on('connection-lost', (data) => {
        console.warn('💥 Connection lost:', data.reason);
        setResilienceStatus(prev => ({
          ...prev,
          connectionHealth: 'poor',
          reconnectAttempts: prev.reconnectAttempts + 1
        }));
        
        toast.error('Connection lost, attempting to reconnect...');
      });

      connectionResilience.current.on('connection-established', () => {
        console.log('✅ Connection established');
        setResilienceStatus(prev => ({
          ...prev,
          connectionHealth: 'good',
          reconnectAttempts: 0
        }));
        
        // toast.success('Connection restored');
      });

      connectionResilience.current.on('fallback-activated', (data) => {
        console.log('🔀 Fallback activated:', data.mode);
        setResilienceStatus(prev => ({
          ...prev,
          fallbackActive: true,
          currentMode: data.mode
        }));
        
        toast.warning(`Switched to ${data.mode.replace('_', ' ').toLowerCase()} mode`);
      });

      connectionResilience.current.on('reconnection-exhausted', () => {
        console.error('🚫 All reconnection attempts exhausted');
        toast.error('Unable to reconnect. Please check your connection.');
        
        // Trigger fallback
        if (fallbackManager.current) {
          fallbackManager.current.triggerFallback('RECONNECTION_EXHAUSTED');
        }
      });

      // Setup fallback manager event listeners
      fallbackManager.current.on('fallback-completed', (data) => {
        console.log('✅ Fallback completed:', data.mode);
        setResilienceStatus(prev => ({
          ...prev,
          currentMode: data.mode,
          fallbackActive: false
        }));
      });

      // Start monitoring
      connectionResilience.current.start();
      
    } catch (error) {
      console.error('Failed to initialize connection resilience:', error);
    }
  }, []);

  // Stop screen sharing
  const stopScreenShare = useCallback(async () => {
    try {
      console.log('🖥️ Stopping screen sharing...');

      if (localTracks.screenTrack) {
        await client.current.unpublish(localTracks.screenTrack);
        localTracks.screenTrack.stop();
        localTracks.screenTrack.close();
      }

      // Restart camera if enabled
      if (isVideoEnabled && !isVoiceOnly) {
        const tracks = await agoraLoader.createTracks(
          { enabled: false },
          {
            enabled: true,
            encoderConfig: videoQuality,
            optimizationMode: 'motion',
          }
        );
        const videoTrack = tracks.videoTrack;

        await client.current.publish(videoTrack);
        setLocalTracks(prev => ({ ...prev, videoTrack, screenTrack: null }));

        if (localVideo.current) {
          videoTrack.play(localVideo.current);
        }
      } else {
        setLocalTracks(prev => ({ ...prev, screenTrack: null }));
      }

      setIsScreenSharing(false);
      // toast.success('Screen sharing stopped');

    } catch (error) {
      console.error('Stop screen sharing error:', error);
      toast.error('Failed to stop screen sharing');
    }
  }, [localTracks, isVideoEnabled, isVoiceOnly, videoQuality]);

  // Join channel with enhanced error handling
  const joinChannel = useCallback(async (numericUid) => {
    try {
      console.log('Joining channel:', {
        appId: import.meta.env.VITE_AGORA_APP_ID,
        channel,
        token,
        uid: numericUid
      });

      if (isStreaming) {
        await client.current.setClientRole(isHost ? 'host' : 'audience');
      }

      const assignedUid = await client.current.join(
        import.meta.env.VITE_AGORA_APP_ID,
        channel,
        token,
        numericUid
      );

      console.log('Successfully joined channel with UID:', assignedUid);
      setIsJoined(true);
      setConnectionState('CONNECTED');
      
      callStartTime.current = Date.now();
      durationInterval.current = setInterval(() => {
        durationRef.current = Math.floor((Date.now() - callStartTime.current) / 1000);
        // Only update state every 10 seconds to reduce re-renders
        if (durationRef.current % 10 === 0) {
          setCallDuration(durationRef.current);
        }
      }, 1000);

      // Schedule token refresh
      tokenRefreshTimer.current = setTimeout(refreshToken, 90 * 60 * 1000);

      if (isHost) {
        await createAndPublishTracks();
      }

      // Start cost calculation for fans
      if (!isHost) {
        await fetchTokenBalance();
        startCostCalculation();
      }

      // Initialize quality controller after connection
      initializeQualityController();
      
      // Initialize connection resilience
      await initializeConnectionResilience();

      // toast.success('Connected to session');

    } catch (error) {
      console.error('Join error:', error);
      setIsJoined(false);
      setConnectionState('FAILED');
      toast.error(`Failed to join session: ${error.message}`);
    }
  }, [channel, token, isStreaming, isHost, refreshToken, fetchTokenBalance, startCostCalculation, createAndPublishTracks, initializeQualityController, initializeConnectionResilience]);

  // Define cleanup function
  const cleanup = useCallback(async () => {
    console.log('🧹 VideoCall cleanup starting...');
    
    try {
      // Clear timers
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }
      
      if (tokenRefreshTimer.current) {
        clearTimeout(tokenRefreshTimer.current);
        tokenRefreshTimer.current = null;
      }

      if (costCalculationInterval.current) {
        clearInterval(costCalculationInterval.current);
        costCalculationInterval.current = null;
      }

      // Clean up local tracks
      if (localTracks.audioTrack) {
        localTracks.audioTrack.stop();
        localTracks.audioTrack.close();
      }
      if (localTracks.videoTrack) {
        localTracks.videoTrack.stop();
        localTracks.videoTrack.close();
      }
      if (localTracks.screenTrack) {
        localTracks.screenTrack.stop();
        localTracks.screenTrack.close();
      }

      // Clear recording interval
      if (window.recordingInterval) {
        clearInterval(window.recordingInterval);
        window.recordingInterval = null;
      }

      // Clean up quality controller
      if (qualityController.current) {
        qualityController.current.stop();
        qualityController.current = null;
      }

      // Clean up connection resilience
      if (connectionResilience.current) {
        connectionResilience.current.destroy();
        connectionResilience.current = null;
      }

      // Clean up fallback manager
      if (fallbackManager.current) {
        fallbackManager.current.destroy();
        fallbackManager.current = null;
      }

      // Clean up Agora loader if needed
      agoraLoader.cleanup();

      // Clean up remote users with better error handling
      const cleanupPromises = remoteUsers.map(async (user) => {
        try {
          // Check if tracks exist and are not already closed
          if (user.audioTrack && !user.audioTrack.isPlaying === false) {
            if (client.current && user.hasAudio) {
              await client.current.unsubscribe(user, 'audio');
            }
            user.audioTrack.stop();
            user.audioTrack.close();
          }
          
          if (user.videoTrack && !user.videoTrack.isPlaying === false) {
            if (client.current && user.hasVideo) {
              await client.current.unsubscribe(user, 'video');
            }
            user.videoTrack.stop();
            user.videoTrack.close();
          }
        } catch (error) {
          console.warn(`Failed to clean up tracks for user ${user.id}:`, error);
          // Continue cleanup even if one user fails
        }
      });
      
      // Wait for all cleanup operations with timeout
      try {
        await Promise.race([
          Promise.all(cleanupPromises),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Cleanup timeout')), 5000))
        ]);
      } catch (error) {
        console.warn('Remote user cleanup timed out or failed:', error);
      }

      // Clear video elements
      if (localVideo.current) {
        localVideo.current.pause();
        localVideo.current.srcObject = null;
      }
      if (remoteVideo.current) {
        remoteVideo.current.pause();
        remoteVideo.current.srcObject = null;
      }

      // Leave channel and clean up client
      if (client.current) {
        client.current.removeAllListeners();
        if (isJoined) {
          await client.current.leave();
        }
        client.current = null;
      }

      // Reset states
      setIsJoined(false);
      setLocalTracks({ audioTrack: null, videoTrack: null });
      setConnectionState('DISCONNECTED');
      setRemoteUsers([]);
      setCallDuration(0);
      durationRef.current = 0;
      setNetworkQuality({ uplink: 0, downlink: 0 });
      setIsFullscreen(false);
      setSessionCost(0);

      console.log('✅ VideoCall cleanup completed');
      
      if (onSessionEnd) {
        onSessionEnd();
      }
      
    } catch (error) {
      console.error('❌ VideoCall cleanup error:', error);
    }
  }, [remoteUsers, localTracks, isJoined, onSessionEnd]);

  // Expose cleanup function to parent via ref
  useImperativeHandle(ref, () => ({
    cleanup
  }), [cleanup]);

  // Initialize video call
  useEffect(() => {
    console.log('VideoCall initializing:', { channel, token, uid, isHost, isStreaming, isVoiceOnly });
    
    if (!channel || !token || !uid) {
      console.warn('VideoCall: Missing required params');
      return;
    }

    const numericUid = parseInt(uid, 10);
    if (isNaN(numericUid)) {
      console.error('VideoCall: Invalid UID:', uid);
      return;
    }

    const initializeCall = async () => {
      try {
        // Load Agora SDK if not already loaded
        if (!agoraRTC) {
          setSdkLoading(true);
          setSdkLoadError(null);
          
          try {
            const loadedAgoraRTC = await agoraLoader.loadRTC();
            setAgoraRTC(loadedAgoraRTC);
            console.log('✅ Agora RTC SDK loaded successfully');
          } catch (error) {
            console.error('❌ Failed to load Agora SDK:', error);
            setSdkLoadError(error.message);
            toast.error('Failed to load video SDK');
            return;
          } finally {
            setSdkLoading(false);
          }
        }

        client.current = agoraLoader.createClient({ 
          mode: isStreaming ? 'live' : 'rtc', 
          codec: 'vp8' 
        });

        console.log('VideoCall client created with mode:', isStreaming ? 'live' : 'rtc');
        setupEventHandlers();
        await joinChannel(numericUid);
      } catch (error) {
        console.error('VideoCall initialization error:', error);
        setConnectionState('FAILED');
        setSdkLoadError(error.message);
        toast.error('Failed to initialize video call');
      }
    };

    initializeCall();

    return cleanup;
  }, [channel, token, uid, isHost, isStreaming, isVoiceOnly, agoraRTC, setupEventHandlers, joinChannel, cleanup]);

  // Update token when it changes
  useEffect(() => {
    setToken(initialToken);
  }, [initialToken]);

  // Update quality controller when tracks change
  const updateQualityControllerTracks = useCallback(() => {
    if (qualityController.current) {
      qualityController.current.updateVideoTrack(localTracks.videoTrack);
      qualityController.current.updateAudioTrack(localTracks.audioTrack);
    }
  }, [localTracks]);

  useEffect(() => {
    updateQualityControllerTracks();
  }, [localTracks, updateQualityControllerTracks]);

  // Handle remote video rendering when users change
  useEffect(() => {
    remoteUsers.forEach(user => {
      if (user.video && user.id) {
        const videoElement = document.getElementById(`remote-video-${user.id}`);
        if (videoElement && user.video) {
          user.video.play(videoElement);
        }
      }
    });
  }, [remoteUsers]);

  // Update resilience system when tracks change
  useEffect(() => {
    if (fallbackManager.current && localTracks) {
      fallbackManager.current.updateTracks(localTracks);
    }
    
    if (connectionResilience.current && localTracks) {
      connectionResilience.current.setOriginalTracks(localTracks.audioTrack, localTracks.videoTrack);
    }
  }, [localTracks]);

  // Toggle audio
  const toggleAudio = useCallback(async () => {
    if (!isHost || !isJoined) return;

    try {
      if (localTracks.audioTrack) {
        await localTracks.audioTrack.setEnabled(!isAudioEnabled);
        setIsAudioEnabled(!isAudioEnabled);
        // toast.success(isAudioEnabled ? 'Microphone muted' : 'Microphone unmuted');
      }
    } catch (error) {
      console.error('Audio toggle error:', error);
      toast.error('Failed to toggle microphone');
    }
  }, [isHost, isJoined, localTracks.audioTrack, isAudioEnabled]);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (!isHost || !isJoined || isVoiceOnly) return;

    try {
      if (localTracks.videoTrack) {
        await localTracks.videoTrack.setEnabled(!isVideoEnabled);
        setIsVideoEnabled(!isVideoEnabled);
        // toast.success(isVideoEnabled ? 'Camera turned off' : 'Camera turned on');
      }
    } catch (error) {
      console.error('Video toggle error:', error);
      toast.error('Failed to toggle camera');
    }
  }, [isHost, isJoined, isVoiceOnly, localTracks.videoTrack, isVideoEnabled]);

  // Toggle screen sharing
  const toggleScreenShare = useCallback(async () => {
    if (!isHost || !isJoined) return;

    try {
      if (!isScreenSharing) {
        console.log('🖥️ Starting screen sharing...');
        
        // Create screen track
        const screenTrack = await agoraLoader.createScreenTrack({
          encoderConfig: videoQuality,
          optimizationMode: 'detail'
        });

        // Stop current video track if any
        if (localTracks.videoTrack) {
          await client.current.unpublish(localTracks.videoTrack);
          localTracks.videoTrack.stop();
          localTracks.videoTrack.close();
        }

        // Publish screen track
        await client.current.publish(screenTrack);
        
        // Update local tracks
        setLocalTracks(prev => ({ ...prev, videoTrack: null, screenTrack }));
        setIsScreenSharing(true);
        
        if (localVideo.current) {
          screenTrack.play(localVideo.current);
        }

        // toast.success('Screen sharing started');

        // Handle screen share end (when user clicks "Stop sharing" in browser)
        screenTrack.on('track-ended', async () => {
          console.log('🖥️ Screen sharing ended by browser');
          await stopScreenShare();
        });

      } else {
        await stopScreenShare();
      }
    } catch (error) {
      console.error('Screen sharing error:', error);
      toast.error('Failed to toggle screen sharing');
      setIsScreenSharing(false);
    }
  }, [isHost, isJoined, isScreenSharing, localTracks, videoQuality, stopScreenShare]);

  // Change video quality
  const changeVideoQuality = useCallback(async (quality) => {
    if (!isHost || !isJoined) return;

    try {
      console.log(`📹 Changing video quality to: ${quality}`);
      
      const config = getVideoEncoderConfig(quality);
      
      if (localTracks.videoTrack) {
        // Use custom config for 2K, otherwise use preset
        if (typeof config === 'object') {
          await localTracks.videoTrack.setVideoEncoderConfiguration(config);
        } else {
          await localTracks.videoTrack.setEncoderConfiguration(config);
        }
        setVideoQuality(quality);
        // toast.success(`Video quality changed to ${quality.replace('_1', '').toUpperCase()}`);
      } else if (localTracks.screenTrack) {
        if (typeof config === 'object') {
          await localTracks.screenTrack.setVideoEncoderConfiguration(config);
        } else {
          await localTracks.screenTrack.setEncoderConfiguration(config);
        }
        setVideoQuality(quality);
        // toast.success(`Screen sharing quality changed to ${quality.replace('_1', '').toUpperCase()}`);
      }
    } catch (error) {
      console.error('Video quality change error:', error);
      toast.error('Failed to change video quality');
    }
  }, [isHost, isJoined, localTracks, getVideoEncoderConfig]);

  // Cloud recording state
  const [recordingInfo, setRecordingInfo] = useState(null);
  const recordingStartTime = useRef(null);
  const recordingDurationInterval = useRef(null);

  // Start cloud recording (for creators)
  const toggleRecording = useCallback(async () => {
    if (!isHost) {
      toast.error('Only hosts can record sessions');
      return;
    }

    try {
      if (!isRecording) {
        console.log('🔴 Starting cloud recording...');
        
        // Get Supabase token for API auth
        const authToken = await getAuthToken();
        
        // Start cloud recording via API
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/recording/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            channel,
            uid,
            token,
            mode: 'mix',
            recordingConfig: {
              transcodingConfig: {
                width: 1280,
                height: 720,
                fps: 30,
                bitrate: 2260,
                videoCodecProfile: 100
              }
            }
          })
        });

        if (!response.ok) {
          throw new Error('Failed to start cloud recording');
        }

        const data = await response.json();
        setRecordingInfo(data);
        setIsRecording(true);
        recordingStartTime.current = Date.now();
        
        // Update duration display
        recordingDurationInterval.current = setInterval(() => {
          setRecordingDuration(Math.floor((Date.now() - recordingStartTime.current) / 1000));
        }, 1000);
        
        // toast.success('Recording started');
        
      } else {
        console.log('⏹️ Stopping cloud recording...');
        
        // Stop the duration timer
        if (recordingDurationInterval.current) {
          clearInterval(recordingDurationInterval.current);
          recordingDurationInterval.current = null;
        }
        
        // Stop cloud recording via API
        const authToken = await getAuthToken();
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/recording/stop`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            recordingId: recordingInfo.recordingId,
            resourceId: recordingInfo.resourceId,
            sid: recordingInfo.sid,
            channel,
            uid
          })
        });

        if (!response.ok) {
          throw new Error('Failed to stop cloud recording');
        }

        const data = await response.json();
        
        setIsRecording(false);
        setRecordingDuration(0);
        setRecordingInfo(null);
        recordingStartTime.current = null;
        
        // toast.success('Recording saved to cloud storage');
        
        // Show recording URL if available
        if (data.recordingUrl) {
          // toast.success(`Recording available at: ${data.recordingUrl}`, {
          //   duration: 10000
          // });
        }
      }
    } catch (error) {
      console.error('Recording toggle error:', error);
      toast.error('Failed to toggle recording');
    }
  }, [isHost, isRecording, channel, uid, token, recordingInfo]);

  // Toggle beauty mode
  const toggleBeautyMode = useCallback(async () => {
    if (!isHost || !localTracks.videoTrack) return;

    try {
      if (!beautyMode) {
        // Enable beauty filter
        await localTracks.videoTrack.setBeautyEffect(true, {
          lighteningContrastLevel: 1,
          lighteningLevel: 0.7,
          smoothnessLevel: 0.5,
          rednessLevel: 0.1
        });
        setBeautyMode(true);
        // toast.success('Beauty mode enabled');
      } else {
        await localTracks.videoTrack.setBeautyEffect(false);
        setBeautyMode(false);
        // toast.success('Beauty mode disabled');
      }
    } catch (error) {
      console.error('Beauty mode error:', error);
      toast.error('Beauty mode not supported on this device');
    }
  }, [isHost, localTracks.videoTrack, beautyMode]);

  // Apply virtual background
  const applyVirtualBackground = useCallback(async (backgroundType) => {
    if (!isHost || !localTracks.videoTrack) return;

    try {
      if (backgroundType === 'none') {
        await localTracks.videoTrack.setBackgroundBlurring(false);
        setVirtualBackground('none');
        // toast.success('Virtual background removed');
      } else if (backgroundType === 'blur') {
        await localTracks.videoTrack.setBackgroundBlurring(true, 2);
        setVirtualBackground('blur');
        // toast.success('Background blur applied');
      } else if (backgroundType === 'image') {
        // For custom background images
        const image = new Image();
        image.src = '/backgrounds/office.jpg'; // You'd have background images
        await localTracks.videoTrack.setBackgroundImage(image);
        setVirtualBackground('image');
        // toast.success('Virtual background applied');
      }
    } catch (error) {
      console.error('Virtual background error:', error);
      toast.error('Virtual background not supported');
    }
  }, [isHost, localTracks.videoTrack]);

  // Update audio settings
  const updateAudioSettings = useCallback(async (newSettings) => {
    if (!isHost || !localTracks.audioTrack) return;

    try {
      // Apply audio processing settings
      await localTracks.audioTrack.setAudioProfile({
        noiseSuppression: newSettings.noiseSuppression,
        echoCancellation: newSettings.echoCancellation,
        autoGainControl: newSettings.autoGainControl
      });
      
      setAudioSettings(newSettings);
      // toast.success('Audio settings updated');
    } catch (error) {
      console.error('Audio settings error:', error);
      toast.error('Failed to update audio settings');
    }
  }, [isHost, localTracks.audioTrack]);

  // Apply bandwidth limit
  const applyBandwidthLimit = useCallback(async (limit) => {
    if (!isHost || !client.current) return;

    try {
      let config = {};
      
      switch (limit) {
        case 'low':
          config = { 
            videoDownstreamBandwidth: 400, // 400 kbps
            videoUpstreamBandwidth: 400,
            audioDownstreamBandwidth: 64,
            audioUpstreamBandwidth: 64
          };
          break;
        case 'medium':
          config = { 
            videoDownstreamBandwidth: 1000, // 1 Mbps
            videoUpstreamBandwidth: 1000,
            audioDownstreamBandwidth: 128,
            audioUpstreamBandwidth: 128
          };
          break;
        case 'high':
          config = { 
            videoDownstreamBandwidth: 2000, // 2 Mbps
            videoUpstreamBandwidth: 2000,
            audioDownstreamBandwidth: 192,
            audioUpstreamBandwidth: 192
          };
          break;
        default:
          config = null; // Unlimited
      }

      if (config) {
        await client.current.setLowStreamParameter(config);
        setBandwidthLimit(limit);
        // toast.success(`Bandwidth limit set to ${limit}`);
      } else {
        setBandwidthLimit('unlimited');
        // toast.success('Bandwidth limit removed');
      }
    } catch (error) {
      console.error('Bandwidth limit error:', error);
      toast.error('Failed to apply bandwidth limit');
    }
  }, [isHost]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!isFullscreen) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen toggle error:', error);
      toast.error('Failed to toggle fullscreen');
    }
  }, [isFullscreen]);

  // Format call duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get status colors (currently unused)
  // const getStatusColor = () => {
  //   switch (connectionState) {
  //     case 'CONNECTED': return '#28a745';
  //     case 'CONNECTING': return '#ffc107';
  //     case 'DISCONNECTED': return '#6c757d';
  //     case 'FAILED': return '#dc3545';
  //     default: return '#6c757d';
  //   }
  // };

  // const getNetworkQualityColor = (quality) => {
  //   if (quality >= 4) return '#28a745';
  //   if (quality >= 2) return '#ffc107';
  //   return '#dc3545';
  // };

  // Show loading state while SDK loads
  if (sdkLoading) {
    return (
      <div style={{
        border: '1px solid #dee2e6',
        borderRadius: '12px',
        padding: '40px',
        backgroundColor: '#fff',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '24px', marginBottom: '20px' }}>📦</div>
        <div style={{ fontSize: '18px', color: '#333', marginBottom: '10px' }}>
          Loading Video SDK...
        </div>
        <div style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
          Please wait while we prepare the video calling experience
        </div>
        <div style={{
          width: '100%',
          height: '4px',
          backgroundColor: '#f0f0f0',
          borderRadius: '2px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: '30%',
            height: '100%',
            backgroundColor: '#007bff',
            borderRadius: '2px',
            animation: 'loading-progress 2s ease-in-out infinite'
          }}></div>
        </div>
        <style>{`
          @keyframes loading-progress {
            0% { width: 20%; }
            50% { width: 80%; }
            100% { width: 20%; }
          }
        `}</style>
      </div>
    );
  }

  // Show error state if SDK loading failed
  if (sdkLoadError) {
    return (
      <div style={{
        border: '1px solid #f5c6cb',
        borderRadius: '12px',
        padding: '40px',
        backgroundColor: '#f8d7da',
        color: '#721c24',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '24px', marginBottom: '20px' }}>⚠️</div>
        <div style={{ fontSize: '18px', marginBottom: '10px' }}>
          Failed to Load Video SDK
        </div>
        <div style={{ fontSize: '14px', marginBottom: '20px' }}>
          {sdkLoadError}
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 20px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ 
      border: '1px solid #dee2e6',
      borderRadius: '12px',
      padding: '20px',
      backgroundColor: '#fff',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      position: 'relative',
      ...(isFullscreen && {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        borderRadius: 0,
        padding: '40px'
      })
    }}>
      {/* Header - Only show for non-streaming calls */}
      {!isStreaming && (
        <div style={{ 
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h4 style={{ margin: '0', color: '#333', fontSize: '18px' }}>
            🎥 {isVoiceOnly ? 'Voice Call' : 'Video Call'} - {isHost ? 'Host' : 'Audience'}
          </h4>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={toggleFullscreen}
              style={{ 
                padding: '8px 12px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {isFullscreen ? '🗗 Exit Fullscreen' : '🗖 Fullscreen'}
            </button>
            <button
              onClick={cleanup}
              style={{
                padding: '8px 12px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              🛑 End Call
            </button>
          </div>
        </div>
      )}

      {/* Status Bar - Hidden for streaming, aesthetic for regular calls */}
      {!isStreaming && connectionState === 'CONNECTED' && (
        <div style={{ 
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: '20px',
          padding: '16px',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          fontSize: '14px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ 
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)',
                animation: 'pulse 2s infinite'
              }}></div>
              <span style={{ color: '#10b981', fontWeight: '500' }}>Connected</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserGroupIcon style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
              <span style={{ fontWeight: '500' }}>{remoteUsers.length + 1} in call</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <VideoCameraIcon style={{ width: '20px', height: '20px', color: '#3b82f6' }} />
              <span style={{ fontWeight: '500' }}>{videoQuality.replace('_', ' ')}</span>
            </div>
          {isScreenSharing && <div style={{ color: '#ff6b35' }}>🖥️ Sharing</div>}
          {isRecording && (
            <div style={{ color: '#dc3545', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                backgroundColor: '#dc3545',
                animation: 'blink 1s infinite'
              }}></div>
              REC {formatDuration(recordingDuration)}
            </div>
          )}
          {tokenRefreshCount > 0 && (
            <div>🔄 Refreshed: {tokenRefreshCount}</div>
          )}
          {!isHost && tokenBalance !== undefined && tokenBalance !== null && (
            <div style={{ color: '#007bff' }}>
              💎 {tokenBalance.toLocaleString()} tokens
            </div>
          )}
          {beautyMode && <div style={{ color: '#ff69b4' }}>✨ Beauty</div>}
          {virtualBackground !== 'none' && <div style={{ color: '#4285f4' }}>🖼️ Background</div>}
          {bandwidthLimit !== 'unlimited' && <div style={{ color: '#ff9500' }}>📊 {bandwidthLimit.toUpperCase()} BW</div>}
          {resilienceStatus.fallbackActive && (
            <div style={{ color: '#ff6b35' }}>
              🔀 {resilienceStatus.currentMode.replace('_', ' ').toLowerCase()}
            </div>
          )}
          {resilienceStatus.reconnectAttempts > 0 && (
            <div style={{ color: '#ffc107' }}>
              🔄 Reconnects: {resilienceStatus.reconnectAttempts}
            </div>
          )}
          {adaptiveQuality.currentProfile && adaptiveQuality.currentProfile !== 'auto' && (
            <div style={{ color: '#17a2b8' }}>
              🎛️ {adaptiveQuality.currentProfile}
            </div>
          )}
          </div>
        </div>
      )}

      {/* Video Display - Multi-grid for co-hosting, regular grid otherwise */}
      {useMultiVideoGrid || (isStreaming && activeCoHosts.length > 0) ? (
        <div style={{ 
          height: isFullscreen ? '720px' : (isHost && isStreaming ? '480px' : '400px'),
          marginBottom: '20px'
        }}>
          <MultiVideoGrid
            localUser={{
              uid: 'local',
              name: user?.displayName || 'You',
              type: isHost ? 'host' : 'audience',
              hasVideo: isVideoEnabled && !isVoiceOnly,
              hasAudio: isAudioEnabled
            }}
            remoteUsers={remoteUsers.map(ru => ({
              ...ru,
              type: activeCoHosts.some(ch => ch.userId === ru.id) ? 'cohost' : 'viewer',
              name: activeCoHosts.find(ch => ch.userId === ru.id)?.name || `User ${ru.id}`
            }))}
            localTracks={localTracks}
            isStreaming={isStreaming}
            maxVisibleUsers={isStreaming ? 6 : 4}
          />
        </div>
      ) : (
        <div style={{ 
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          marginBottom: '20px'
        }}>
          {/* Host/Local Video - Full Width */}
          {(isHost && isStreaming) && (
            <div style={{ position: 'relative', width: '100%' }}>
              <h5 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>
                {isScreenSharing ? '🖥️ You (Sharing Screen)' : '📹 You (Host)'}
              </h5>
              <div style={{ 
                position: 'relative',
                backgroundColor: '#000',
                borderRadius: '8px',
                overflow: 'hidden',
                width: '100%',
                maxWidth: isFullscreen ? '1280px' : '854px',
                margin: '0 auto',
                aspectRatio: '16/9'
              }}>
                <video 
                  ref={localVideo} 
                  autoPlay 
                  muted 
                  playsInline
                  style={{ 
                    width: '100%', 
                    height: isFullscreen ? '720px' : '480px',
                    objectFit: 'contain',
                    maxWidth: isFullscreen ? '1280px' : '854px',
                    margin: '0 auto',
                    backgroundColor: '#000'
                  }} 
                />
                {(!isVideoEnabled || isVoiceOnly) && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    color: '#fff',
                    fontSize: '18px'
                  }}>
                    {isVoiceOnly ? '🎙️ Voice Only' : '📹 Video Off'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Viewer Quality Selector - For non-hosts */}
          {!isHost && isStreaming && (
            <div style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              zIndex: 10,
              backgroundColor: 'rgba(0,0,0,0.7)',
              borderRadius: '8px',
              padding: '8px',
              backdropFilter: 'blur(10px)'
            }}>
              <select
                value={viewerQuality}
                onChange={async (e) => {
                  const newQuality = e.target.value;
                  setViewerQuality(newQuality);
                  
                  // Apply quality setting to remote streams
                  if (client.current && remoteUsers.length > 0) {
                    for (const user of remoteUsers) {
                      try {
                        if (newQuality === 'auto') {
                          // Enable automatic fallback
                          await client.current.setStreamFallbackOption(user.id, 2); // AUTO mode
                        } else {
                          // Disable auto fallback and set specific quality
                          await client.current.setStreamFallbackOption(user.id, 0); // Disable fallback
                          
                          // Set stream type based on quality
                          const streamType = ['360p', '180p'].includes(newQuality) ? 1 : 0; // 1 = low stream, 0 = high stream
                          await client.current.setRemoteVideoStreamType(user.id, streamType);
                        }
                      } catch (error) {
                        console.error('Failed to set stream quality:', error);
                      }
                    }
                    // toast.success(`Quality set to ${newQuality}`);
                  }
                }}
                style={{
                  backgroundColor: 'transparent',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value="auto">Auto Quality</option>
                <option value="2k_1">2K (2560x1440)</option>
                <option value="1080p_1">1080p HD</option>
                <option value="720p_1">720p HD</option>
                <option value="480p">480p</option>
                <option value="360p">360p</option>
                <option value="180p">180p</option>
              </select>
              
              {/* Network Quality Indicator */}
              <div style={{
                marginTop: '8px',
                fontSize: '12px',
                color: networkQuality.downlink >= 4 ? '#10b981' : 
                       networkQuality.downlink >= 2 ? '#f59e0b' : '#ef4444',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: networkQuality.downlink >= 4 ? '#10b981' : 
                                   networkQuality.downlink >= 2 ? '#f59e0b' : '#ef4444',
                  animation: 'pulse 2s infinite'
                }}></div>
                Network: {networkQuality.downlink >= 4 ? 'Excellent' : 
                         networkQuality.downlink >= 2 ? 'Good' : 'Poor'}
              </div>
            </div>
          )}

          {/* Join Requests Section - For fans/creators wanting to join */}
          {(isHost && isStreaming) && (
            <div style={{ 
              position: 'relative',
              backgroundColor: '#f8f9fa',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '20px',
              border: '2px dashed #dee2e6'
            }}>
              <h5 style={{ 
                margin: '0 0 15px 0', 
                fontSize: '16px', 
                color: '#333',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '20px' }}>🎥</span>
                Join Requests
                {remoteUsers.length === 0 && (
                  <span style={{ 
                    backgroundColor: '#ffc107',
                    color: '#333',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'normal'
                  }}>
                    Waiting for participants
                  </span>
                )}
              </h5>
              
              {remoteUsers.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#666'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '10px' }}>👥</div>
                  <p style={{ marginBottom: '5px', fontWeight: '500' }}>No one has requested to join yet</p>
                  <p style={{ fontSize: '14px', color: '#999' }}>
                    Fans and creators can request to join your stream
                  </p>
                </div>
              ) : (
                <div style={{ 
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: '15px'
                }}>
                  {remoteUsers.map((user, index) => (
                    <div key={user.id || index} style={{ 
                      position: 'relative',
                      backgroundColor: '#fff',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}>
                      <video 
                        id={`remote-video-${user.id}`}
                        autoPlay 
                        playsInline
                        style={{ 
                          width: '100%', 
                          height: '200px',
                          objectFit: 'cover',
                          backgroundColor: '#000'
                        }} 
                      />
                      <div style={{
                        padding: '10px',
                        backgroundColor: '#fff',
                        borderTop: '1px solid #eee'
                      }}>
                        <div style={{ 
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span style={{ 
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#333'
                          }}>
                            {user.name || `User ${user.id}`}
                          </span>
                          <span style={{
                            fontSize: '12px',
                            color: '#666',
                            backgroundColor: '#f0f0f0',
                            padding: '2px 8px',
                            borderRadius: '12px'
                          }}>
                            {user.type === 'cohost' ? '🌟 Co-host' : '👤 Viewer'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Remote Videos for non-streaming */}
          {!isStreaming && remoteUsers.length > 0 && (
            <div style={{ position: 'relative' }}>
              <h5 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>
                👥 Remote Users ({remoteUsers.length})
              </h5>
              <div style={{ 
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '10px'
              }}>
                <div style={{ 
                  position: 'relative',
                  backgroundColor: '#000',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}>
                  <video 
                    ref={remoteVideo} 
                    autoPlay 
                    playsInline
                    style={{ 
                      width: '100%', 
                      height: '200px',
                      objectFit: 'cover'
                    }} 
                  />
                </div>
              </div>
            </div>
          )}

          {/* Non-streaming layout - Side by side */}
          {(!isHost || !isStreaming) && (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: isFullscreen ? '1fr 300px' : 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '20px'
            }}>
              {/* Local Video */}
              <div style={{ position: 'relative' }}>
                <h5 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>
                  {isHost ? '📹 You (Host)' : '👁️ You (Audience)'}
                </h5>
                <div style={{ 
                  position: 'relative',
                  backgroundColor: '#000',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}>
                  <video 
                    ref={localVideo} 
                    autoPlay 
                    muted 
                    playsInline
                    style={{ 
                      width: '100%', 
                      height: isFullscreen ? '400px' : '250px',
                      objectFit: 'cover'
                    }} 
                  />
                  {(!isVideoEnabled || isVoiceOnly) && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(0,0,0,0.8)',
                      color: '#fff',
                      fontSize: '18px'
                    }}>
                      {isVoiceOnly ? '🎙️ Voice Only' : '📹 Video Off'}
                    </div>
                  )}
                </div>
              </div>

              {/* Remote Video */}
              <div style={{ position: 'relative' }}>
                <h5 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>
                  👥 Remote Users ({remoteUsers.length})
                </h5>
                <div style={{ 
                  position: 'relative',
                  backgroundColor: '#000',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}>
                  <video 
                    ref={remoteVideo} 
                    autoPlay 
                    playsInline
                    style={{ 
                      width: '100%', 
                      height: isFullscreen ? '400px' : '250px',
                      objectFit: 'cover'
                    }} 
                  />
                  {remoteUsers.length === 0 && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(0,0,0,0.8)',
                      color: '#fff',
                      fontSize: '16px',
                      textAlign: 'center'
                    }}>
                      <div>
                        <div style={{ fontSize: '32px', marginBottom: '10px' }}>👥</div>
                        <div>Waiting for others to join...</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Session Info - Hidden for creators during streaming */}
      {!isStreaming && (
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '10px',
          marginBottom: '20px',
          fontSize: '12px',
          color: '#666'
        }}>
          <div><strong>Channel:</strong> {channel}</div>
          <div><strong>UID:</strong> {uid}</div>
          <div><strong>Mode:</strong> {isStreaming ? 'Live Streaming' : 'RTC'}</div>
          <div><strong>Type:</strong> {isVoiceOnly ? 'Voice Only' : 'Video Call'}</div>
        </div>
      )}

      {/* Controls */}
      {isHost && isJoined && (
        <div>
          {/* Main Controls */}
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            flexWrap: 'wrap',
            justifyContent: 'center',
            marginBottom: '15px'
          }}>
            <button 
              onClick={toggleAudio}
              style={{
                padding: '12px 20px',
                backgroundColor: isAudioEnabled ? '#28a745' : '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isAudioEnabled ? '🔊 Mute' : '🔇 Unmute'}
            </button>
            
            {!isVoiceOnly && (
              <button 
                onClick={toggleVideo}
                style={{
                  padding: '12px 20px',
                  backgroundColor: isVideoEnabled ? '#28a745' : '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isVideoEnabled ? '📹 Stop Video' : '📷 Start Video'}
              </button>
            )}

            {/* Beauty Filters Button */}
            {!isVoiceOnly && isVideoEnabled && (
              <button 
                onClick={() => setShowBeautyFilters(true)}
                style={{
                  padding: '12px 20px',
                  backgroundColor: '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                ✨ Beauty Filters
              </button>
            )}

            {!isVoiceOnly && (
              <button 
                onClick={toggleScreenShare}
                style={{
                  padding: '12px 20px',
                  backgroundColor: isScreenSharing ? '#ff6b35' : '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isScreenSharing ? '🖥️ Stop Sharing' : '🖥️ Share Screen'}
              </button>
            )}

            <button 
              onClick={toggleRecording}
              style={{
                padding: '12px 20px',
                backgroundColor: isRecording ? '#dc3545' : '#6f42c1',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isRecording ? '⏹️ Stop Recording' : '🔴 Record'}
            </button>

            {/* Gift Button - Available to all participants */}
            {isJoined && remoteUsers.length > 0 && (
              <button 
                onClick={() => setShowGifts(true)}
                className="btn btn-warning hover-glow"
                style={{
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                🎁 Send Gift
              </button>
            )}
          </div>

          {/* Quality Controls */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '8px',
            flexWrap: 'wrap',
            marginBottom: '10px'
          }}>
            <span style={{ 
              fontSize: '12px', 
              color: '#666',
              alignSelf: 'center',
              marginRight: '8px'
            }}>
              Quality:
            </span>
            {['360p', '480p', '720p_1', '1080p_1', '2k_1'].map(quality => (
              <button
                key={quality}
                onClick={() => changeVideoQuality(quality)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: videoQuality === quality ? '#007bff' : '#f8f9fa',
                  color: videoQuality === quality ? 'white' : '#333',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                {quality.replace('_1', '')}
              </button>
            ))}
          </div>

          {/* Advanced Controls Toggle */}
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <button
              onClick={() => setShowAdvancedControls(!showAdvancedControls)}
              style={{
                padding: '8px 16px',
                backgroundColor: showAdvancedControls ? '#6f42c1' : '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                marginRight: '8px'
              }}
            >
              {showAdvancedControls ? '🔽 Hide Advanced' : '🔼 Show Advanced'}
            </button>
            
            <button
              onClick={() => setShowQualityPanel(!showQualityPanel)}
              style={{
                padding: '8px 16px',
                backgroundColor: showQualityPanel ? '#17a2b8' : '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                marginRight: '8px'
              }}
            >
              {showQualityPanel ? '📊 Hide Quality' : '📊 Quality Panel'}
            </button>
            
            <button
              onClick={() => setShowConnectionStatus(!showConnectionStatus)}
              style={{
                padding: '8px 16px',
                backgroundColor: showConnectionStatus ? '#28a745' : '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              {showConnectionStatus ? '🛡️ Hide Status' : '🛡️ Connection Status'}
            </button>
          </div>

          {/* Advanced Controls Panel */}
          {showAdvancedControls && (
            <div style={{
              backgroundColor: '#f8f9fa',
              border: '1px solid #e1e5e9',
              borderRadius: '12px',
              padding: '20px',
              marginTop: '15px'
            }}>
              <h5 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#333' }}>
                🔧 Advanced Settings
              </h5>

              {/* Video Effects */}
              {!isVoiceOnly && (
                <div style={{ marginBottom: '20px' }}>
                  <h6 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>
                    ✨ Video Effects
                  </h6>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      onClick={toggleBeautyMode}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: beautyMode ? '#ff69b4' : '#e9ecef',
                        color: beautyMode ? 'white' : '#333',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      ✨ Beauty Mode
                    </button>
                    
                    <button
                      onClick={() => applyVirtualBackground('none')}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: virtualBackground === 'none' ? '#007bff' : '#e9ecef',
                        color: virtualBackground === 'none' ? 'white' : '#333',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      🚫 No Background
                    </button>
                    
                    <button
                      onClick={() => applyVirtualBackground('blur')}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: virtualBackground === 'blur' ? '#007bff' : '#e9ecef',
                        color: virtualBackground === 'blur' ? 'white' : '#333',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      🌀 Blur Background
                    </button>
                    
                    <button
                      onClick={() => applyVirtualBackground('image')}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: virtualBackground === 'image' ? '#007bff' : '#e9ecef',
                        color: virtualBackground === 'image' ? 'white' : '#333',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      🖼️ Virtual Background
                    </button>
                  </div>
                </div>
              )}

              {/* Audio Settings */}
              <div style={{ marginBottom: '20px' }}>
                <h6 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>
                  🎤 Audio Enhancement
                </h6>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <input 
                      type="checkbox"
                      checked={audioSettings.noiseSuppression}
                      onChange={(e) => updateAudioSettings({
                        ...audioSettings,
                        noiseSuppression: e.target.checked
                      })}
                    />
                    🔇 Noise Suppression
                  </label>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <input 
                      type="checkbox"
                      checked={audioSettings.echoCancellation}
                      onChange={(e) => updateAudioSettings({
                        ...audioSettings,
                        echoCancellation: e.target.checked
                      })}
                    />
                    🔊 Echo Cancellation
                  </label>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <input 
                      type="checkbox"
                      checked={audioSettings.autoGainControl}
                      onChange={(e) => updateAudioSettings({
                        ...audioSettings,
                        autoGainControl: e.target.checked
                      })}
                    />
                    📊 Auto Gain Control
                  </label>
                </div>
              </div>

              {/* Bandwidth Controls */}
              <div style={{ marginBottom: '20px' }}>
                <h6 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>
                  📊 Bandwidth Management
                </h6>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['unlimited', 'high', 'medium', 'low'].map(limit => (
                    <button
                      key={limit}
                      onClick={() => applyBandwidthLimit(limit)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: bandwidthLimit === limit ? '#007bff' : '#e9ecef',
                        color: bandwidthLimit === limit ? 'white' : '#333',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px'
                      }}
                    >
                      {limit.charAt(0).toUpperCase() + limit.slice(1)}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: '#666', marginTop: '5px' }}>
                  Current: {bandwidthLimit} bandwidth
                </div>
              </div>

              {/* Layout Controls */}
              <div>
                <h6 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>
                  📱 Layout Options
                </h6>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['grid', 'speaker', 'gallery'].map(layout => (
                    <button
                      key={layout}
                      onClick={() => setLayoutMode(layout)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: layoutMode === layout ? '#007bff' : '#e9ecef',
                        color: layoutMode === layout ? 'white' : '#333',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px'
                      }}
                    >
                      {layout === 'grid' ? '📱 Grid' : 
                       layout === 'speaker' ? '🗣️ Speaker' : '🖼️ Gallery'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Virtual Gifts Modal */}
      {showGifts && (
        <div className="modal-overlay" onClick={() => setShowGifts(false)}>
          <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-2xl font-bold text-miami-cyan mb-4 flex items-center gap-2">
                🎁 Send a Gift
              </h2>
              <VirtualGifts
                user={user}
                channel={channel}
                tokenBalance={tokenBalance}
                onGiftSent={(gift) => {
                  // toast.success(`Sent ${gift.name} gift! 🎉`);
                  if (onTokenUpdate) onTokenUpdate();
                  setShowGifts(false);
                }}
              />
            </div>
            <button
              onClick={() => setShowGifts(false)}
              className="modal-close"
              aria-label="Close gifts"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {connectionState === 'FAILED' && (
        <div style={{ 
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          borderRadius: '8px',
          border: '1px solid #f5c6cb',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>⚠️</div>
          <div>Connection failed. Please check your network and try again.</div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      )}


      {/* Connection Status Panel */}
      <ConnectionStatusPanel
        connectionResilience={connectionResilience.current}
        fallbackManager={fallbackManager.current}
        isVisible={showConnectionStatus}
        onToggle={() => setShowConnectionStatus(!showConnectionStatus)}
        className="fixed bottom-4 right-4 max-w-sm z-50"
      />

      {/* Beauty Filters Modal */}
      <BeautyFilters
        isOpen={showBeautyFilters}
        onClose={() => setShowBeautyFilters(false)}
        onApplyFilters={(settings) => {
          setBeautySettings(settings);
          // Apply settings to local video track
          if (localTracks.videoTrack) {
            // This will be handled by the BeautyFilters component
          }
        }}
        currentSettings={beautySettings}
        localVideoTrack={localTracks.videoTrack}
      />

      {/* CSS for animations */}
      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
});

export default VideoCall;