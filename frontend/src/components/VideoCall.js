import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle, memo } from 'react';
import { loadAgoraRTC, createAgoraClient, createLocalTracks, cleanupAgoraResources, preloadAgoraSDKs } from '../utils/agoraLazyLoader';
import { joinAsHost, joinAsAudience, getClient, safeLeave } from '../lib/agoraClient';
import { supabase, getAuthToken } from '../utils/supabase-auth.js';
import { fetchWithRetry, fetchJSONWithRetry } from '../utils/fetchWithRetry.js';
import toast from 'react-hot-toast';
import VirtualGifts from './VirtualGifts';
import TipButton from './payments/TipButton';
import AdaptiveQualityController from '../utils/AdaptiveQualityController';
import ConnectionResilience from '../utils/ConnectionResilience';
import FallbackManager from '../utils/FallbackManager';
import ConnectionStatusPanel from './ConnectionStatusPanel';
import MultiVideoGrid from './MultiVideoGrid';
import BeautyFilters from './BeautyFilters';
import StreamQualityConfig from '../utils/StreamQualityConfig';
import StreamOverlayManager, { StreamOverlay } from './StreamOverlayManager';
import { UserGroupIcon, VideoCameraIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { fireBeacon } from '../utils/beacon';
import { analytics } from '../lib/analytics';
import socketService from '../services/socketServiceWrapper';

// Global singleton lock to prevent multiple VideoCall instances from initializing simultaneously
// This addresses the issue where multiple components mount (React StrictMode, routing bugs, etc.)
const globalAgoraLock = {
  activeChannel: null,
  activeUid: null,
  lockTime: null
};

const acquireGlobalLock = (channel, uid) => {
  const now = Date.now();

  // Check if there's an active lock for a DIFFERENT channel/uid
  if (globalAgoraLock.activeChannel &&
      (globalAgoraLock.activeChannel !== channel || globalAgoraLock.activeUid !== uid)) {
    console.warn('🚫 BLOCKED: Another VideoCall instance is active', {
      active: { channel: globalAgoraLock.activeChannel, uid: globalAgoraLock.activeUid },
      attempting: { channel, uid },
      lockAge: now - globalAgoraLock.lockTime
    });
    return false;
  }

  // If lock is for same channel/uid, it's the same component re-rendering - allow
  if (globalAgoraLock.activeChannel === channel && globalAgoraLock.activeUid === uid) {
    console.log('✅ Lock already held by this channel/uid - allowing');
    return true;
  }

  // Acquire new lock
  globalAgoraLock.activeChannel = channel;
  globalAgoraLock.activeUid = uid;
  globalAgoraLock.lockTime = now;
  console.log('🔒 Global lock acquired', { channel, uid });
  return true;
};

const releaseGlobalLock = (channel, uid) => {
  if (globalAgoraLock.activeChannel === channel && globalAgoraLock.activeUid === uid) {
    console.log('🔓 Global lock released', { channel, uid });
    globalAgoraLock.activeChannel = null;
    globalAgoraLock.activeUid = null;
    globalAgoraLock.lockTime = null;
  }
};

// Publish mutex to prevent double publish across renders/StrictMode
let publishMutex = false;

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
  onLocalTracksCreated,
  coHosts = [],
  hasAccess = true, // New prop for ticketed show access control
  initialOverlaySettings = null, // New prop for logo overlay
  callId = null, // New prop for server-authoritative billing
  creatorId = null // New prop for tips - ID of the creator being called
}, ref) => {
  const client = useRef(null);
  const localVideo = useRef(null);
  const localPreviewVideo = useRef(null);  // Separate ref for preview
  const remoteVideo = useRef(null);
  const intentionalLeaveRef = useRef(false); // Track intentional call end to skip guard prompts
  // Track what we've actually published (prevents double publish)
  const publishedRef = useRef({ audio: false, video: false });
  // Keep current local tracks so we can unpublish/close precisely
  const tracksRef = useRef({ mic: null, cam: null });
  const [token, setToken] = useState(initialToken);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(isHost ? !isVoiceOnly : (!isStreaming && !isVoiceOnly));
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
  const [overlaySettings, setOverlaySettings] = useState(initialOverlaySettings);
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
  const sdkInitialized = useRef(false);
  const callInitialized = useRef(false); // Prevent duplicate initialization
  const sessionEstablished = useRef(false); // Track if session successfully joined

  const callStartTime = useRef(null);
  const durationInterval = useRef(null);
  const tokenRefreshTimer = useRef(null);
  const costCalculationInterval = useRef(null);
  const heartbeatInterval = useRef(null);
  const balanceWarningShown = useRef(false); // Track if 80% warning shown
  const callIdRef = useRef(null); // Store call ID for heartbeat

  // Feature flag: Emergency disable for call leave guards (set VITE_CALL_GUARDS=false to disable)
  const GUARDS_ENABLED = import.meta.env.VITE_CALL_GUARDS !== 'false';

  // Fetch current token balance
  const fetchTokenBalance = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        console.warn('No auth token available for fetching balance');
        return;
      }
      
      const data = await fetchJSONWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/tokens/balance`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        3 // retries
      );
      
      onTokenUpdate?.(data.balance);
    } catch (error) {
      console.error('❌ Failed to fetch token balance:', error);
      // Only show toast for non-network errors
      if (!error.message.includes('Failed to fetch')) {
        toast.error('Failed to update balance');
      }
    }
  }, [onTokenUpdate]);

  // Token refresh function
  const refreshToken = useCallback(async () => {
    try {
      console.log('🔄 Refreshing Agora token...');
      const authToken = await getAuthToken();
      
      if (!authToken) {
        throw new Error('No auth token available');
      }
      
      const role = isHost || isStreaming ? 'host' : 'audience';
      
      const data = await fetchJSONWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/agora/token?channel=${channel}&uid=${uid}&role=${role}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        },
        3 // retries
      );
      
      const newToken = data.rtcToken || data.token;
      if (!newToken) {
        throw new Error('No token received from server');
      }
      
      if (client.current && isJoined) {
        await client.current.renewToken(newToken);
      }
      
      setToken(newToken);
      setTokenRefreshCount(prev => prev + 1);
      
      // Schedule next refresh (tokens typically expire in 1 hour, refresh every 50 minutes)
      tokenRefreshTimer.current = setTimeout(refreshToken, 50 * 60 * 1000);
      
      console.log('✅ Token refreshed successfully');
      
    } catch (error) {
      console.error('❌ Token refresh error:', error);
      toast.error('Failed to refresh connection. Please rejoin if disconnected.');
      
      // Clear any existing timer
      if (tokenRefreshTimer.current) {
        clearTimeout(tokenRefreshTimer.current);
        tokenRefreshTimer.current = null;
      }
      
      // Try to refresh again after a shorter delay on failure
      tokenRefreshTimer.current = setTimeout(refreshToken, 5 * 60 * 1000); // Retry in 5 minutes
      
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
      
      if (!token) {
        console.warn('No auth token available for cost calculation');
        return;
      }
      
      // Safely extract creator ID from channel name
      const channelParts = channel.split('-');
      if (channelParts.length < 2) {
        console.error('Invalid channel format:', channel);
        return;
      }
      
      const creatorId = channelParts[1];
      const creatorData = await fetchJSONWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/users/profile?uid=${creatorId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        3 // retries
      );
      
      const pricePerMin = creatorData.price_per_min || 5;
      const tokensPerMin = Math.ceil(pricePerMin / 0.05); // 0.05 per token

      // Update cost every second
      costCalculationInterval.current = setInterval(() => {
        const elapsedSeconds = durationRef.current || callDuration;
        const elapsedMinutes = Math.ceil(elapsedSeconds / 60);
        const cost = elapsedMinutes * tokensPerMin;
        setSessionCost(cost);

        // 80% balance warning
        if (!balanceWarningShown.current && tokenBalance > 0) {
          const percentUsed = cost / tokenBalance;
          if (percentUsed >= 0.8) {
            balanceWarningShown.current = true;
            const remainingTokens = Math.max(0, tokenBalance - cost);
            const remainingMinutes = Math.floor(remainingTokens / tokensPerMin);
            toast.warning(
              `⚠️ Low balance warning: You have approximately ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''} remaining (${remainingTokens} tokens). Please add tokens to continue.`,
              { duration: 8000, icon: '⚠️' }
            );
          }
        }

        // Trigger callback if provided
        if (onTokenDeduction && elapsedMinutes > 0 && elapsedSeconds % 60 === 0) {
          onTokenDeduction(tokensPerMin);
        }
      }, 1000);
    } catch (error) {
      console.error('❌ Failed to setup cost calculation:', error);
    }
  }, [channel, isHost, isStreaming, callDuration, onTokenDeduction]);

  // Start heartbeat to keep call alive and sync billing status
  const startHeartbeat = useCallback(async () => {
    if (isHost || isStreaming || !callIdRef.current) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      if (!authToken) {
        console.warn('No auth token for heartbeat');
        return;
      }

      console.log('💓 Starting heartbeat for call:', callIdRef.current);

      // Send heartbeat every 12 seconds
      heartbeatInterval.current = setInterval(async () => {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_BACKEND_URL}/calls/${callIdRef.current}/heartbeat`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (response.ok) {
            const data = await response.json();
            console.log('💓 Heartbeat sent:', {
              elapsedSeconds: data.billing?.elapsedSeconds,
              currentMinute: data.billing?.currentMinute,
              lastBilledMinute: data.billing?.lastBilledMinute,
              nextBillingIn: data.billing?.nextBillingIn
            });
          } else {
            console.error('❌ Heartbeat failed:', response.status);
          }
        } catch (error) {
          console.error('💥 Heartbeat error:', error);
        }
      }, 12000); // Every 12 seconds
    } catch (error) {
      console.error('❌ Failed to start heartbeat:', error);
    }
  }, [isHost, isStreaming]);

  // Setup event handlers with token expiration handling
  const setupEventHandlers = useCallback(() => {
    if (!client.current) return;

    client.current.on('user-published', async (user, mediaType) => {
      console.log('User published:', { uid: user.id, mediaType, hasAccess });
      
      // Skip video subscription if no access (ticketed show)
      if (!hasAccess && mediaType === 'video' && !isHost) {
        console.log('Skipping video subscription - no ticket access');
        return;
      }
      
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
      
      try {
        await refreshToken();
      } catch (error) {
        console.error('Token refresh failed during expiry:', error);
        setConnectionState('FAILED');
        toast.error('Session disconnected due to token issue. Please rejoin.');
        
        // Clean up and notify parent component
        cleanup();
        if (onTokenExpired) {
          onTokenExpired();
        }
      }
    });

    client.current.on('error', (error) => {
      console.error('Agora client error:', error);
      setConnectionState('FAILED');
      toast.error(`Connection error: ${error.message}`);
    });
  }, [refreshToken]);

  // Safe publish helper - only publishes tracks that haven't been published yet
  const safePublish = useCallback(async (client, { mic, cam }) => {
    const toPublish = [];
    if (mic && !publishedRef.current.audio) toPublish.push(mic);
    if (cam && !publishedRef.current.video) toPublish.push(cam);
    if (!toPublish.length) {
      console.log('⚠️ No tracks to publish (already published)');
      return;
    }

    // Verify client is actually joined before publishing
    if (!client.channelName) {
      throw new Error('Cannot publish: client is not joined to a channel');
    }

    console.log(`📡 Publishing ${toPublish.length} tracks to channel: ${client.channelName}`);
    await client.publish(toPublish);
    console.log('✅ Tracks published successfully');

    if (mic) publishedRef.current.audio = true;
    if (cam) publishedRef.current.video = true;
  }, []);

  // Unpublish and close existing video track helper
  const unpublishVideoIfAny = useCallback(async (client) => {
    try {
      const v = tracksRef.current.cam;
      if (v) {
        try { await client.unpublish([v]); } catch {}
        try { v.stop?.(); v.close?.(); } catch {}
        tracksRef.current.cam = null;
        publishedRef.current.video = false;
      }
    } catch (e) {
      console.warn('Could not unpublish/close existing video track', e);
    }
  }, []);

  // Get video encoder configuration based on quality setting
  const getVideoEncoderConfig = useCallback((quality) => {
    const configs = {
      '720p_60': {
        width: 1280,
        height: 720,
        frameRate: 60,
        bitrate: 3500,
        minBitrate: 3000,
        maxBitrate: 4000
      },
      '1080p_1': {
        width: 1920,
        height: 1080,
        frameRate: 30,
        bitrate: 2500,
        minBitrate: 2000,
        maxBitrate: 3000
      },
      '720p_1': '720p_1', // Use Agora preset (30fps)
      '480p': '480p_4',    // Use Agora preset
      '360p': '360p_7',    // Use Agora preset
      '180p': '180p_4'     // Use Agora preset
    };
    
    return configs[quality] || configs['720p_60'];
  }, []);

  // Create and publish tracks
  const createAndPublishTracks = useCallback(async () => {
    if (!sdkInitialized.current) {
      throw new Error('Agora RTC SDK not loaded');
    }

    try {
      console.log('Creating tracks for host...');
      
      // Determine video config - always default to 2K
      // The adaptive quality controller will handle downgrades if network is poor
      const videoConfig = StreamQualityConfig.getEncoderConfig(StreamQualityConfig.defaultQuality);
      console.log('🎥 Using video encoder config:', videoConfig);
      
      // For streaming hosts, ALWAYS create video track (unless voice only)
      const shouldCreateVideo = !isVoiceOnly;
      
      console.log('📹 Video track creation params:', {
        isHost,
        isStreaming,
        isVideoEnabled,
        isVoiceOnly,
        shouldCreateVideo
      });
      
      const tracks = await agoraLoader.createTracks(
        {
          enabled: true,  // Always enable audio
          encoderConfig: 'music_standard',
        },
        shouldCreateVideo ? {
          enabled: true,  // Always enable video if we're creating it
          encoderConfig: videoConfig,
          optimizationMode: 'motion',
        } : { enabled: false }  // Disable video for voice-only
      );

      setLocalTracks(tracks);
      
      // Ensure video is enabled and playing for hosts
      if (tracks.videoTrack && !isVoiceOnly) {
        // Enable the track
        await tracks.videoTrack.setEnabled(true);
        setIsVideoEnabled(true);
        console.log('✅ Video track enabled');
        
        // Try to play immediately if element is ready
        if (localVideo.current) {
          try {
            console.log('🎥 Attempting to play video track immediately');
            await tracks.videoTrack.play(localVideo.current);
            console.log('✅ Video track playing immediately');
          } catch (error) {
            console.warn('⚠️ Could not play immediately, will retry:', error.message);
          }
        }
      }
      
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
        
        // Play video on local video element with retry logic
        const playLocalVideo = async () => {
          if (localVideo.current) {
            try {
              console.log('🎥 Playing local video track on element');
              await tracks.videoTrack.play(localVideo.current);
              console.log('✅ Local video playing successfully');
            } catch (error) {
              console.error('❌ Error playing local video:', error);
            }
          } else {
            console.warn('⚠️ localVideo ref not ready, retrying...');
            setTimeout(playLocalVideo, 100);
          }
        };
        
        // Try to play immediately and with a delay
        playLocalVideo();
        setTimeout(playLocalVideo, 300);
      }

      if (tracksToPublish.length > 0) {
        await client.current.publish(tracksToPublish);
        console.log('Published tracks:', tracksToPublish.map(t => t.trackMediaType));
      }

    } catch (error) {
      console.error('Error creating/publishing tracks:', error);
      toast.error('Failed to setup media tracks');
    }
  }, [isAudioEnabled, isVideoEnabled, isVoiceOnly, isHost, isStreaming, getVideoEncoderConfig, onLocalTracksCreated]);

  // Initialize quality controller
  const initializeQualityController = useCallback(() => {
    if (!client.current || qualityController.current) return;

    try {
      console.log('🎛️ Initializing adaptive quality controller...');
      
      qualityController.current = new AdaptiveQualityController(client.current, {
        enableAdaptation: adaptiveQuality.enabled,
        userPreference: StreamQualityConfig.defaultAdaptiveMode, // Default to 720p@60fps
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
        uid: numericUid,
        hasAccess
      });

      // MINIMUM BALANCE CHECK (fans only) - Prevent starting call with insufficient tokens
      if (!isHost && !isStreaming) {
        // Get creator's rate to calculate minimum needed
        const { data: { session } } = await supabase.auth.getSession();
        const authToken = session?.access_token;

        if (authToken) {
          try {
            // Extract creator ID from channel
            const channelParts = channel.split('-');
            if (channelParts.length >= 2) {
              const creatorId = channelParts[1];
              const creatorData = await fetchJSONWithRetry(
                `${import.meta.env.VITE_BACKEND_URL}/users/profile?uid=${creatorId}`,
                {
                  headers: { Authorization: `Bearer ${authToken}` }
                },
                2
              );

              const pricePerMin = creatorData.price_per_min || 5;
              const tokensPerMin = Math.ceil(pricePerMin / 0.05);

              // Check if fan has at least 1 minute worth of tokens
              if (tokenBalance < tokensPerMin) {
                const needed = tokensPerMin - tokenBalance;
                toast.error(
                  `Insufficient tokens to start call. You need at least ${tokensPerMin} tokens (1 minute). You're short ${needed} tokens.`,
                  {
                    duration: 8000,
                    icon: '⚠️'
                  }
                );

                // Prevent joining
                throw new Error(`INSUFFICIENT_BALANCE: Need ${tokensPerMin} tokens, have ${tokenBalance}`);
              }

              console.log('✅ Balance check passed:', {
                tokensPerMin,
                currentBalance: tokenBalance,
                canAfford: `${Math.floor(tokenBalance / tokensPerMin)} minutes`
              });
            }
          } catch (balanceCheckError) {
            console.error('Balance check error:', balanceCheckError);
            // If it's our insufficient balance error, re-throw it
            if (balanceCheckError.message?.startsWith('INSUFFICIENT_BALANCE')) {
              throw balanceCheckError;
            }
            // Otherwise, warn but allow (network issues shouldn't block calls)
            console.warn('Skipping balance check due to error:', balanceCheckError.message);
          }
        }
      }

      // Check access for ticketed shows
      if (!hasAccess && !isHost) {
        // Join as audience without video subscription
        await client.current.setClientRole('audience');
        console.log('Set client role: audience (no video access)');
        setIsJoined(true);
        return numericUid; // Return early without subscribing to video
      }

      // Determine role based on host status or co-host status
      const isCoHost = coHosts.some(ch => ch.co_host_id === user?.supabase_id);
      const shouldBeHost = isHost || isCoHost;

      if (isStreaming) {
        await client.current.setClientRole(shouldBeHost ? 'host' : 'audience');
        console.log(`Set client role: ${shouldBeHost ? 'host' : 'audience'}`);
      }

      // EMERGENCY FIX: Force leave any stale connection first
      if (client.current.connectionState !== 'DISCONNECTED') {
        console.log('⚠️ Force leaving stale connection to prevent UID_CONFLICT...');
        try {
          await client.current.leave();
          await new Promise(resolve => setTimeout(resolve, 500));
          console.log('✅ Stale connection cleared');
        } catch (leaveErr) {
          console.warn('Leave error (non-fatal):', leaveErr);
        }
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
      sessionEstablished.current = true; // Mark session as established

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

        // Start heartbeat to keep call alive and get billing updates
        startHeartbeat();
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

      // Handle UID_CONFLICT specifically - the channel might have a stale connection
      if (error.code === 'UID_CONFLICT' || error.message?.includes('UID_CONFLICT')) {
        console.error('⚠️ UID_CONFLICT detected - attempting recovery...');
        toast.error('Connection conflict detected. Retrying...', { duration: 3000 });

        // Try to leave any existing connection
        if (client.current) {
          try {
            await client.current.leave();
            console.log('Left stale connection');
          } catch (leaveError) {
            console.warn('Error leaving during UID_CONFLICT recovery:', leaveError);
          }
        }

        // Wait a bit and reset initialization flag to allow retry
        setTimeout(() => {
          callInitialized.current = false;
          releaseGlobalLock(channel, uid);
          console.log('🔄 Ready for retry after UID_CONFLICT');
          toast.success('Ready to reconnect', { duration: 2000 });
        }, 2000);
      } else {
        toast.error(`Failed to join session: ${error.message}`);
      }
    }
  }, [channel, token, isStreaming, isHost, refreshToken, fetchTokenBalance, startCostCalculation, createAndPublishTracks, initializeQualityController, initializeConnectionResilience]);

  // Define cleanup function
  const cleanup = useCallback(async () => {
    console.log('🧹 VideoCall cleanup starting...', {
      sessionWasEstablished: sessionEstablished.current,
      isJoined,
      channel,
      uid,
      willCallOnSessionEnd: sessionEstablished.current && !!onSessionEnd,
      callStack: new Error().stack?.split('\n').slice(2, 6).join('\n') // Show where cleanup was called from
    });

    // Don't reset initialization flag here - let it be reset only on unmount
    // or explicit retry. This prevents infinite loops during error recovery.

    // Mark as intentional leave to skip guard prompts
    intentionalLeaveRef.current = true;

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

      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }

      // Clean up local tracks - unpublish first, then stop and close
      // Handle both tracksRef (new mutex system) and localTracks (state)
      try {
        const tracksToUnpublish = [];

        // Add from localTracks state
        if (localTracks.audioTrack) tracksToUnpublish.push(localTracks.audioTrack);
        if (localTracks.videoTrack) tracksToUnpublish.push(localTracks.videoTrack);
        if (localTracks.screenTrack) tracksToUnpublish.push(localTracks.screenTrack);

        // Add from tracksRef if different
        if (tracksRef.current.mic && !tracksToUnpublish.includes(tracksRef.current.mic)) {
          tracksToUnpublish.push(tracksRef.current.mic);
        }
        if (tracksRef.current.cam && !tracksToUnpublish.includes(tracksRef.current.cam)) {
          tracksToUnpublish.push(tracksRef.current.cam);
        }

        // Unpublish all tracks at once if client exists
        if (client.current && tracksToUnpublish.length > 0 && isJoined) {
          console.log('📡 Unpublishing local tracks...');
          await client.current.unpublish(tracksToUnpublish);
          console.log('✅ Local tracks unpublished');
        }
      } catch (unpublishError) {
        console.warn('Failed to unpublish tracks (non-fatal):', unpublishError);
      }

      // Stop and close tracks from state
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

      // Stop and close tracks from tracksRef
      if (tracksRef.current.mic) {
        tracksRef.current.mic.stop();
        tracksRef.current.mic.close();
      }
      if (tracksRef.current.cam) {
        tracksRef.current.cam.stop();
        tracksRef.current.cam.close();
      }

      // Reset refs
      tracksRef.current = { mic: null, cam: null };
      publishedRef.current = { audio: false, video: false };

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

      // Don't cleanup AgoraLoader - it's a singleton that should persist across component instances

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
      if (localPreviewVideo.current) {
        localPreviewVideo.current.pause();
        localPreviewVideo.current.srcObject = null;
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

      // Release global lock
      releaseGlobalLock(channel, uid);

      // Only call onSessionEnd if session was actually established
      // This prevents redirect when initialization fails (UID_CONFLICT, etc)
      if (sessionEstablished.current && onSessionEnd) {
        console.log('📞 Session ended - calling onSessionEnd callback');
        onSessionEnd();
      } else if (!sessionEstablished.current) {
        console.log('ℹ️ Cleanup called but session never established - skipping onSessionEnd');
      }

      // Reset session flag
      sessionEstablished.current = false;
      
    } catch (error) {
      console.error('❌ VideoCall cleanup error:', error);
    }
  }, [remoteUsers, localTracks, isJoined, onSessionEnd]);

  // Expose cleanup function to parent via ref
  useImperativeHandle(ref, () => ({
    cleanup
  }), [cleanup]);

  // Track if errors have been shown to prevent infinite loops
  const errorsShownRef = useRef(new Set());
  
  // Initialize video call
  useEffect(() => {
    console.log('🎯 VideoCall useEffect triggered:', {
      channel,
      hasToken: !!token,
      uid,
      isHost,
      isStreaming,
      isVoiceOnly,
      reason: 'One of the dependencies changed'
    });

    // Validate required parameters
    if (!channel || !token || !uid) {
      console.warn('VideoCall: Missing required params');
      const errorKey = 'missing-params';
      if (!errorsShownRef.current.has(errorKey)) {
        errorsShownRef.current.add(errorKey);
        toast.error('Missing required parameters for video call');
      }
      return;
    }
    
    // Validate channel format (alphanumeric with hyphens and underscores)
    if (!channel.match(/^[a-zA-Z0-9_-]+$/)) {
      console.error('Invalid channel format:', channel);
      const errorKey = 'invalid-channel';
      if (!errorsShownRef.current.has(errorKey)) {
        errorsShownRef.current.add(errorKey);
        toast.error('Invalid session ID format');
      }
      return;
    }
    
    // Validate UID (must be a positive integer)
    const numericUid = parseInt(uid, 10);
    if (isNaN(numericUid) || numericUid <= 0 || numericUid.toString() !== uid.toString()) {
      console.error('VideoCall: Invalid UID:', uid);
      const errorKey = 'invalid-uid';
      if (!errorsShownRef.current.has(errorKey)) {
        errorsShownRef.current.add(errorKey);
        toast.error('Invalid user ID format');
      }
      return;
    }
    
    // Validate token format (basic check)
    if (typeof token !== 'string' || token.length < 10) {
      console.error('Invalid token format');
      const errorKey = 'invalid-token';
      if (!errorsShownRef.current.has(errorKey)) {
        errorsShownRef.current.add(errorKey);
        toast.error('Invalid session token');
      }
      return;
    }
    
    // Prevent duplicate initialization - exit if already initialized
    if (callInitialized.current) {
      console.log('⚠️ Call already initialized, skipping...');
      return;
    }

    // Mark as initializing IMMEDIATELY to block duplicate calls
    callInitialized.current = true;
    console.log('🔒 Locking initialization...');

    // Acquire global lock to prevent multiple component instances from racing
    if (!acquireGlobalLock(channel, uid)) {
      console.error('🚫 BLOCKED: Global lock held by another VideoCall instance');
      toast.error('Another video session is already active');
      callInitialized.current = false; // Release component lock
      return;
    }

    // Clear errors when params change
    errorsShownRef.current.clear();

    const initializeCall = async () => {
      try {
        // Agora SDK is already loaded via npm package (no CDN loading needed)
        // Use singleton client - prevents UID_CONFLICT
        console.log('🎯 Using Agora singleton to join channel');

        const joinResult = isHost || isStreaming
          ? await joinAsHost({
              appId: import.meta.env.VITE_AGORA_APP_ID,
              channel,
              token,
              uid: numericUid // CRITICAL: Use backend's UID (UID-bound token)
            })
          : await joinAsAudience({
              appId: import.meta.env.VITE_AGORA_APP_ID,
              channel,
              token,
              uid: numericUid
            });

        // IMPORTANT: Use the client returned by joinAsHost/joinAsAudience
        // Don't call getClient() again - use the client from joinResult
        const agoraClient = joinResult.client;
        client.current = agoraClient;

        console.log(`✅ Joined with UID: ${joinResult.uid}`);

        // Verify we're actually joined by checking channel name
        // This should always pass since joinAsHost already verified it
        if (!agoraClient.channelName) {
          throw new Error('Join failed: channelName is null after joinAsHost');
        }

        console.log('✅ Verified joined to channel:', agoraClient.channelName);

        // Wait until actually connected before publishing
        if (agoraClient.connectionState !== 'CONNECTED') {
          console.log('⏳ Waiting for CONNECTED state...');
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Timeout waiting for CONNECTED state'));
            }, 10000);

            const handler = (state) => {
              console.log('🔌 Connection state changed to:', state);
              if (state === 'CONNECTED') {
                clearTimeout(timeout);
                agoraClient.off('connection-state-change', handler);
                resolve();
              }
            };
            agoraClient.on('connection-state-change', handler);
          });
        }

        console.log('✅ Connection state is CONNECTED, ready to publish');

        // If host/streaming, create and publish tracks with mutex protection
        if (isHost || isStreaming) {
          if (publishMutex) {
            console.log('⛔ publish in progress, skipping');
          } else {
            publishMutex = true;
            try {
              // If we somehow already have published tracks, just reuse them
              if (publishedRef.current.audio && publishedRef.current.video) {
                console.log('⚠️ Already published; reusing existing local tracks');
                setLocalTracks({
                  audioTrack: tracksRef.current.mic,
                  videoTrack: tracksRef.current.cam,
                  screenTrack: null
                });
              } else {
                // (Re)create only missing tracks
                const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;

                const videoConfig = {
                  encoderConfig: { width: 1280, height: 720, frameRate: 30, bitrate: 2000 },
                  facingMode: 'user',
                };

                if (!tracksRef.current.mic) {
                  console.log('🎤 Creating mic track…');
                  tracksRef.current.mic = await AgoraRTC.createMicrophoneAudioTrack({
                    encoderConfig: 'music_standard'
                  });
                }

                if (!tracksRef.current.cam && !isVoiceOnly) {
                  console.log('🎥 Creating camera track…');
                  tracksRef.current.cam = await AgoraRTC.createCameraVideoTrack(videoConfig);
                }

                // Try to publish; if Agora complains about multiple video tracks, heal automatically
                try {
                  console.log('📡 Publishing…');
                  await safePublish(agoraClient, {
                    mic: tracksRef.current.mic,
                    cam: tracksRef.current.cam
                  });
                  console.log('✅ Published');
                } catch (err) {
                  const msg = String(err?.message || err?.code || err);
                  if (msg.includes('CAN_NOT_PUBLISH_MULTIPLE_VIDEO_TRACKS')) {
                    console.warn('♻️ Recovering: unpublish old video, close, recreate, publish once');
                    await unpublishVideoIfAny(agoraClient);

                    const AgoraRTC2 = (await import('agora-rtc-sdk-ng')).default;
                    tracksRef.current.cam = await AgoraRTC2.createCameraVideoTrack(videoConfig);

                    await safePublish(agoraClient, {
                      mic: tracksRef.current.mic, // keep the same mic
                      cam: tracksRef.current.cam  // brand new cam
                    });
                    console.log('✅ Recovered and published single video track');
                  } else {
                    throw err;
                  }
                }

                // Store tracks in state
                setLocalTracks({
                  audioTrack: tracksRef.current.mic,
                  videoTrack: tracksRef.current.cam,
                  screenTrack: null
                });

                // Notify parent component if callback provided
                if (onLocalTracksCreated) {
                  onLocalTracksCreated({
                    audioTrack: tracksRef.current.mic,
                    videoTrack: tracksRef.current.cam
                  });
                }

                // Optional: play local video to a container
                const container = document.getElementById('local-player');
                tracksRef.current.cam?.play(container || undefined);
              }
            } catch (e) {
              console.error('❌ Failed to publish:', e);
              toast.error('Failed to start camera/microphone');
              // Do not crash the page; user can retry
            } finally {
              publishMutex = false;
            }
          }
        } // End of if (isHost || isStreaming)

        // Setup event handlers after join
        setupEventHandlers();

        // Mark as joined
        setIsJoined(true);
        setConnectionState('CONNECTED');
        sessionEstablished.current = true;

        // Start duration tracking
        callStartTime.current = Date.now();
        durationInterval.current = setInterval(() => {
          durationRef.current = Math.floor((Date.now() - callStartTime.current) / 1000);
          if (durationRef.current % 10 === 0) {
            setCallDuration(durationRef.current);
          }
        }, 1000);

        console.log('✅ VideoCall initialized successfully');
      } catch (error) {
        console.error('VideoCall initialization error:', error);
        setConnectionState('FAILED');
        setSdkLoadError(error.message);
        toast.error('Failed to initialize video call');
        // Reset flag on error so user can retry
        callInitialized.current = false;
        releaseGlobalLock(channel, uid);
      }
    };

    initializeCall();

    return cleanup;
  }, [channel, token, uid, isHost, isStreaming, isVoiceOnly]);

  // Reset initialization flag on unmount only
  useEffect(() => {
    return () => {
      console.log('🔓 Unlocking initialization on unmount');
      callInitialized.current = false;
      releaseGlobalLock(channel, uid);
    };
  }, [channel, uid]);

  // Cleanup tracks on unmount to prevent "already live" or duplicate track issues
  // Note: This runs ONLY on final unmount (empty deps array)
  useEffect(() => {
    return () => {
      console.log('🧹 Track cleanup on unmount triggered');
      // Don't use async IIFE - it won't be awaited anyway on unmount
      // Just synchronously stop and close tracks
      try {
        if (tracksRef.current.cam || tracksRef.current.mic) {
          console.log('🧹 Cleaning up tracksRef tracks');

          // Unpublish is async and won't complete on unmount, so skip it
          // Just stop and close synchronously
          if (tracksRef.current.cam) {
            try {
              tracksRef.current.cam.stop();
              tracksRef.current.cam.close();
            } catch (e) {
              console.warn('Failed to close cam:', e);
            }
          }

          if (tracksRef.current.mic) {
            try {
              tracksRef.current.mic.stop();
              tracksRef.current.mic.close();
            } catch (e) {
              console.warn('Failed to close mic:', e);
            }
          }

          tracksRef.current = { mic: null, cam: null };
          publishedRef.current = { audio: false, video: false };
          console.log('✅ TracksRef cleaned up on unmount');
        }
      } catch (e) {
        console.warn('Track cleanup failed', e);
      }
    };
  }, []);

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

  // Ensure local video is playing when track and element are ready
  useEffect(() => {
    const playLocalVideo = async () => {
      // Use direct camera access as fallback if no Agora track
      if (!localTracks.videoTrack && localVideo.current && isHost && !isVoiceOnly) {
        try {
          console.log('🎥 Using direct camera access as fallback...');
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720 },
            audio: false
          });
          // Re-check ref after async operation (component might have unmounted)
          if (!localVideo.current) {
            console.warn('⚠️ Video ref became null during getUserMedia - component unmounted');
            stream.getTracks().forEach(track => track.stop());
            return;
          }
          localVideo.current.srcObject = stream;
          await localVideo.current.play();
          console.log('✅ Direct camera stream playing');
          return;
        } catch (cameraError) {
          console.error('❌ Direct camera access failed:', cameraError);
        }
      }
      
      if (!localTracks.videoTrack) {
        return;
      }
      
      // Try to play Agora video track on main element
      if (localVideo.current) {
        try {
          await localTracks.videoTrack.play(localVideo.current);
          console.log('✅ Agora video track playing');
          
          // Fallback if video dimensions are 0
          setTimeout(async () => {
            if (localVideo.current && (localVideo.current.videoWidth === 0 || localVideo.current.videoHeight === 0)) {
              console.warn('⚠️ Video dimensions are 0, using fallback');
              try {
                const stream = await navigator.mediaDevices.getUserMedia({
                  video: { width: 1280, height: 720 },
                  audio: false
                });
                // Re-check ref after async operation
                if (!localVideo.current) {
                  console.warn('⚠️ Video ref became null during fallback getUserMedia');
                  stream.getTracks().forEach(track => track.stop());
                  return;
                }
                localVideo.current.srcObject = stream;
                await localVideo.current.play();
                console.log('✅ Fallback stream playing');
              } catch (err) {
                console.error('Fallback failed:', err);
              }
            }
          }, 1000);
        } catch (error) {
          console.error('❌ useEffect: Failed to play on main video:', error);
          // Retry after a delay
          setTimeout(() => playLocalVideo(), 500);
        }
      }
      
      // Also play on preview if it exists
      if (localPreviewVideo.current) {
        try {
          console.log('🎬 useEffect: Cloning video for preview');
          // Clone the track for preview (Agora tracks can only play on one element)
          const clonedTrack = localTracks.videoTrack.clone();
          await clonedTrack.play(localPreviewVideo.current);
          console.log('✅ useEffect: Video playing on preview element');
        } catch (error) {
          console.log('⚠️ Could not play on preview:', error.message);
        }
      }
    };
    
    playLocalVideo();
  }, [localTracks.videoTrack, isHost, isVoiceOnly]);

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

  // Set callIdRef when callId prop is provided
  useEffect(() => {
    if (callId) {
      callIdRef.current = callId;
      console.log('📞 Call ID set:', callId);
    }
  }, [callId]);

  // Set up Ably listener for insufficient funds event
  useEffect(() => {
    if (!channel || isHost || isStreaming) return;

    const handleInsufficientFunds = async (data) => {
      console.log('💸 Insufficient funds event received:', data);

      // Stop heartbeat immediately
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }

      // Show error to user
      toast.error(
        '❌ Call ended: Insufficient tokens. Your balance ran out during the call.',
        { duration: 10000 }
      );

      // Clean up and end call
      await cleanup();

      // Notify parent
      if (onSessionEnd) {
        onSessionEnd({
          reason: 'insufficient_funds',
          message: 'Call ended due to insufficient tokens'
        });
      }
    };

    // Subscribe to the call channel for insufficient_funds events
    // Channel format: call:{channel} where {channel} is the Agora channel name
    const channelName = `call:${channel}`;

    let unsubscribe = () => {};

    if (socketService.isConnected) {
      const ablyChannel = socketService.getChannel?.(channelName);
      if (ablyChannel) {
        ablyChannel.subscribe('call:insufficient_funds', handleInsufficientFunds);
        console.log(`📡 Subscribed to ${channelName} for insufficient_funds events`);

        unsubscribe = () => {
          ablyChannel.unsubscribe('call:insufficient_funds', handleInsufficientFunds);
          console.log(`📡 Unsubscribed from ${channelName}`);
        };
      }
    }

    return unsubscribe;
  }, [channel, isHost, isStreaming, onSessionEnd]);

  // Update resilience system when tracks change
  useEffect(() => {
    if (fallbackManager.current && localTracks) {
      fallbackManager.current.updateTracks(localTracks);
    }

    if (connectionResilience.current && localTracks) {
      connectionResilience.current.setOriginalTracks(localTracks.audioTrack, localTracks.videoTrack);
    }
  }, [localTracks]);

  // Prevent accidental tab close during active call
  useEffect(() => {
    if (!GUARDS_ENABLED || !isJoined) return; // Only guard when actively in a call

    const handleBeforeUnload = (e) => {
      // Track exit attempt for analytics (helps separate rage-quits from accidents)
      analytics.track?.('call_exit_attempt', {
        method: 'beforeunload',
        joined: !!isJoined,
        duration: callDuration
      });

      // Skip prompt if user clicked End Call button
      if (intentionalLeaveRef.current) return;

      e.preventDefault();
      e.returnValue = 'You have an active call.'; // Text ignored by modern browsers, but required for prompt
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isJoined, callDuration]);

  // Graceful teardown on tab close (pagehide) - for mobile Safari
  useEffect(() => {
    if (!GUARDS_ENABLED || !isJoined) return;

    const handlePageHide = (e) => {
      // If persisted, page is going into BFCache — still do minimal cleanup
      const persisted = e.persisted === true;

      try {
        // Best-effort analytics on unload using centralized beacon helper
        const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
        fireBeacon(`${backendUrl}/telemetry`, {
          event: 'call_end',
          reason: persisted ? 'pagehide_bfcache' : 'pagehide',
          duration: callDuration,
          ts: Date.now(),
          userAgent: navigator.userAgent,
          visibilityState: document.visibilityState,
          channel: channel || 'unknown',
        });
      } catch (err) {
        // Silently fail - page is closing anyway
        console.warn('Failed to send pagehide beacon:', err);
      }

      // Async cleanup (modern browsers support this)
      (async () => {
        try {
          console.log('🔄 pagehide: Starting Agora cleanup...');

          // Stop local tracks immediately
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

          // Leave Agora channel with timeout to prevent blocking
          if (client.current && isJoined) {
            const leavePromise = client.current.leave();
            await Promise.race([
              leavePromise,
              new Promise((resolve) => setTimeout(resolve, 1000))
            ]);
            console.log('✅ pagehide: Left Agora channel');
          }

          // Release global lock
          releaseGlobalLock(channel, uid);
        } catch (err) {
          console.warn('Failed pagehide cleanup:', err);
        }
      })();

    };

    const handlePageShow = (e) => {
      // If we returned from BFCache while a call was "ended", ensure UI state is sane
      if (e.persisted && !isJoined) {
        console.log('Returned from BFCache, call was ended');
        // Optional: show a toast or force a reconnect flow here
      }
    };

    window.addEventListener('pagehide', handlePageHide, { once: true });
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [isJoined, callDuration, localTracks]);

  // Block SPA navigation during active call
  useEffect(() => {
    if (!GUARDS_ENABLED || !isJoined) return;

    let lastPromptTs = 0;
    const allowlist = [/^\/call\/(video|voice)/]; // Don't prompt for in-call routes

    // Listen for React Router navigation events
    // This works by intercepting the popstate event (back/forward button)
    const handlePopState = () => {
      // Skip prompt if user clicked End Call button
      if (intentionalLeaveRef.current) return;

      // Prevent double prompts within 500ms (browser re-entrancy guard)
      const now = Date.now();
      if (now - lastPromptTs < 500) {
        window.history.pushState(null, '', window.location.pathname);
        return;
      }
      lastPromptTs = now;

      // Check if navigating to allowed in-call route
      const nextPath = window.location.pathname;
      const isAllowed = allowlist.some(rx => rx.test(nextPath));
      if (isAllowed) return;

      const shouldLeave = window.confirm(
        'Leave the call? You may be disconnected and charged for the session.'
      );

      if (!shouldLeave) {
        // User chose to stay - push state back to prevent navigation
        window.history.pushState(null, '', window.location.pathname);
      }
    };

    // Seed a history state so the first Back triggers popstate
    window.history.pushState(null, '', window.location.pathname);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isJoined]);

  // Auto-pause local video when tab is backgrounded (saves data + battery)
  useEffect(() => {
    if (!isJoined || !localTracks?.videoTrack) return;

    const handleVisibilityChange = async () => {
      try {
        if (document.hidden) {
          // Tab backgrounded - pause video to save bandwidth
          await localTracks.videoTrack.setEnabled(false);
          console.log('📹 Video paused (tab backgrounded)');
        } else {
          // Tab foregrounded - resume video if it was enabled before
          if (isVideoEnabled) {
            await localTracks.videoTrack.setEnabled(true);
            console.log('📹 Video resumed (tab foregrounded)');
          }
        }
      } catch (err) {
        console.warn('Failed to toggle video on visibility change:', err);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isJoined, localTracks?.videoTrack, isVideoEnabled]);

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
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/recording/start`, {
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
                width: 2560,
                height: 1440,
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
        
        // Update duration display - optimize by updating less frequently
        let recordingDurationValue = 0;
        recordingDurationInterval.current = setInterval(() => {
          recordingDurationValue = Math.floor((Date.now() - recordingStartTime.current) / 1000);
          // Only update state every 10 seconds to reduce re-renders
          if (recordingDurationValue % 10 === 0) {
            setRecordingDuration(recordingDurationValue);
          }
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
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/recording/stop`, {
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
      {useMultiVideoGrid || (isStreaming && (activeCoHosts.length > 0 || coHosts.length > 0)) ? (
        <div style={{ 
          height: isFullscreen ? '1440px' : (isHost && isStreaming ? '720px' : '600px'),
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
            creatorId={channel?.split('_')[1] || (isHost ? user?.id : null)}
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
              <div style={{ 
                position: 'relative',
                backgroundColor: '#111',
                borderRadius: '8px',
                overflow: 'hidden',
                width: '100%',
                height: isFullscreen ? '720px' : '480px',
                maxWidth: isFullscreen ? '1280px' : '854px',
                margin: '0 auto'
              }}>
                {/* Custom Stream Overlay */}
                <StreamOverlay settings={overlaySettings} />

                {/* Overlay Manager for Creators */}
                {isHost && (
                  <div className="absolute top-4 left-4 z-30">
                    <StreamOverlayManager
                      isCreator={isHost}
                      onOverlayChange={setOverlaySettings}
                      currentOverlay={overlaySettings}
                    />
                  </div>
                )}

                <video 
                  ref={localVideo}
                  id="local-video-stream"
                  autoPlay 
                  muted 
                  playsInline
                  style={{ 
                    width: '100%', 
                    height: '100%',
                    objectFit: 'cover',
                    backgroundColor: '#111',
                    display: 'block'
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
          {/* Hide this section during live streaming dashboard - only show in actual video calls */}
          {(isHost && isStreaming && false) && (
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
                  {isHost ? 'You' : 'Viewing'}
                </h5>
                <div style={{ 
                  position: 'relative',
                  backgroundColor: '#000',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}>
                  <video 
                    ref={localPreviewVideo} 
                    id="local-preview-video"
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
              aria-label={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
              aria-pressed={isAudioEnabled}
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
                aria-label={isVideoEnabled ? 'Stop camera' : 'Start camera'}
                aria-pressed={isVideoEnabled}
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
                aria-label="Open beauty filters"
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
                aria-label={isScreenSharing ? 'Stop screen sharing' : 'Start screen sharing'}
                aria-pressed={isScreenSharing}
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
              aria-label={isRecording ? 'Stop recording session' : 'Start recording session'}
              aria-pressed={isRecording}
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
                aria-label="Send virtual gift"
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

      {/* Tip Button - Show for fans calling creators */}
      {!isHost && creatorId && user?.id !== creatorId && !isStreaming && (
        <div style={{
          position: 'fixed',
          bottom: '100px',
          right: '20px',
          zIndex: 1000
        }}>
          <TipButton
            toCreatorId={creatorId}
            context={{
              callId: callId || channel,
              sessionId: channel,
              type: 'video_call'
            }}
            onTipped={(tip) => {
              toast.success(`Tip of ${tip.amountTokens} tokens sent!`, {
                icon: '💰'
              });
              if (onTokenUpdate) {
                onTokenUpdate(tip.new_balance);
              }
            }}
            className="shadow-2xl"
          />
        </div>
      )}

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