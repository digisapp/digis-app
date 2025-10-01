/**
 * Lazy loader for Agora SDK
 * Only loads the SDK when actually needed for video/voice calls
 */

let agoraRTCPromise = null;
let agoraRTMPromise = null;
let agoraChatPromise = null;

/**
 * Load Agora RTC SDK for video/voice calls
 */
export const loadAgoraRTC = async () => {
  if (!agoraRTCPromise) {
    agoraRTCPromise = import('agora-rtc-sdk-ng').then(module => {
      const AgoraRTC = module.default;

      // Configure Agora RTC
      AgoraRTC.setLogLevel(process.env.NODE_ENV === 'production' ? 2 : 0);

      // Enable optimization for Chrome
      if (navigator.userAgent.indexOf('Chrome') !== -1) {
        AgoraRTC.enableLogUpload();
      }

      return AgoraRTC;
    }).catch(error => {
      console.error('Failed to load Agora RTC SDK:', error);
      agoraRTCPromise = null; // Reset on error to allow retry
      throw error;
    });
  }

  return agoraRTCPromise;
};

/**
 * Load Agora RTM SDK for real-time messaging
 */
export const loadAgoraRTM = async () => {
  if (!agoraRTMPromise) {
    agoraRTMPromise = import('agora-rtm-sdk').then(module => {
      const AgoraRTM = module.default;
      return AgoraRTM;
    }).catch(error => {
      console.error('Failed to load Agora RTM SDK:', error);
      agoraRTMPromise = null; // Reset on error to allow retry
      throw error;
    });
  }

  return agoraRTMPromise;
};

/**
 * Load Agora Chat SDK
 */
export const loadAgoraChat = async () => {
  if (!agoraChatPromise) {
    agoraChatPromise = import('agora-chat').then(module => {
      const AgoraChat = module.default || module;
      return AgoraChat;
    }).catch(error => {
      console.error('Failed to load Agora Chat SDK:', error);
      agoraChatPromise = null; // Reset on error to allow retry
      throw error;
    });
  }

  return agoraChatPromise;
};

/**
 * Preload Agora SDKs in the background (for better UX)
 * Call this when user shows intent to join a call (e.g., hovering over call button)
 */
export const preloadAgoraSDKs = () => {
  // Use requestIdleCallback for non-blocking preload
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      loadAgoraRTC().catch(() => {
        console.log('Agora RTC preload failed, will retry when needed');
      });
    }, { timeout: 5000 });
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => {
      loadAgoraRTC().catch(() => {
        console.log('Agora RTC preload failed, will retry when needed');
      });
    }, 2000);
  }
};

/**
 * Create Agora client with lazy loading
 */
export const createAgoraClient = async (mode = 'rtc', codec = 'vp8') => {
  const AgoraRTC = await loadAgoraRTC();

  const client = AgoraRTC.createClient({
    mode,
    codec,
    role: mode === 'live' ? 'host' : undefined
  });

  // Set up client optimization
  if (mode === 'live') {
    client.setLowStreamParameter({
      width: 320,
      height: 180,
      framerate: 15,
      bitrate: 140
    });
  }

  return client;
};

/**
 * Create local tracks with lazy loading
 */
export const createLocalTracks = async (audioEnabled = true, videoEnabled = true) => {
  const AgoraRTC = await loadAgoraRTC();

  const tracks = [];

  try {
    if (audioEnabled && videoEnabled) {
      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
        {
          AEC: true, // Acoustic Echo Cancellation
          AGC: true, // Automatic Gain Control
          ANS: true, // Automatic Noise Suppression
        },
        {
          encoderConfig: {
            width: 640,
            height: 480,
            frameRate: 30,
            bitrateMin: 400,
            bitrateMax: 1000,
          },
          optimizationMode: 'balanced' // 'detail' for screen share, 'motion' for sports
        }
      );
      tracks.push(audioTrack, videoTrack);
    } else if (audioEnabled) {
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        AEC: true,
        AGC: true,
        ANS: true,
      });
      tracks.push(audioTrack);
    } else if (videoEnabled) {
      const videoTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: {
          width: 640,
          height: 480,
          frameRate: 30,
          bitrateMin: 400,
          bitrateMax: 1000,
        },
        optimizationMode: 'balanced'
      });
      tracks.push(videoTrack);
    }
  } catch (error) {
    console.error('Failed to create local tracks:', error);
    throw error;
  }

  return tracks;
};

/**
 * Clean up Agora resources
 */
export const cleanupAgoraResources = (client, localTracks) => {
  // Close local tracks
  if (localTracks && localTracks.length > 0) {
    localTracks.forEach(track => {
      if (track) {
        track.stop();
        track.close();
      }
    });
  }

  // Leave and remove client
  if (client) {
    client.leave().catch(err => {
      console.warn('Error leaving Agora channel:', err);
    });
  }
};

/**
 * Check if Agora is already loaded
 */
export const isAgoraLoaded = () => {
  return {
    rtc: agoraRTCPromise !== null,
    rtm: agoraRTMPromise !== null,
    chat: agoraChatPromise !== null
  };
};

/**
 * Get network quality indicator
 */
export const getNetworkQuality = (quality) => {
  const qualityMap = {
    0: { label: 'Unknown', color: 'gray' },
    1: { label: 'Excellent', color: 'green' },
    2: { label: 'Good', color: 'green' },
    3: { label: 'Fair', color: 'yellow' },
    4: { label: 'Poor', color: 'orange' },
    5: { label: 'Bad', color: 'red' },
    6: { label: 'Terrible', color: 'red' }
  };

  return qualityMap[quality] || qualityMap[0];
};

export default {
  loadAgoraRTC,
  loadAgoraRTM,
  loadAgoraChat,
  preloadAgoraSDKs,
  createAgoraClient,
  createLocalTracks,
  cleanupAgoraResources,
  isAgoraLoaded,
  getNetworkQuality
};