/**
 * Agora Call Helper
 *
 * Handles joining and managing Agora RTC calls (voice/video)
 * Reuses patterns from EnhancedMobileLiveStream for iOS compatibility
 *
 * Key features:
 * - User gesture-gated joining (iOS requirement)
 * - Automatic cleanup on page hide/visibility change
 * - Track state management
 * - Error handling
 * - Event callbacks
 */

import AgoraRTC from 'agora-rtc-sdk-ng';

let currentClient = null;
let currentTracks = { audio: null, video: null };

/**
 * Join an Agora call
 *
 * @param {Object} config - Call configuration
 * @param {string} config.appId - Agora app ID
 * @param {string} config.token - RTC token
 * @param {string} config.channel - Channel name
 * @param {number} config.uid - User's numeric UID
 * @param {string} config.callType - 'voice' or 'video'
 * @param {Function} config.onUserJoined - Called when remote user joins
 * @param {Function} config.onUserLeft - Called when remote user leaves
 * @param {Function} config.onError - Called on errors
 * @returns {Promise<Object>} { client, localTracks, remoteUsers }
 */
export async function joinAgoraCall(config) {
  const {
    appId,
    token,
    channel,
    uid,
    callType = 'voice',
    onUserJoined,
    onUserLeft,
    onError
  } = config;

  try {
    console.log('📞 Joining Agora call:', {
      channel,
      uid,
      callType,
      hasToken: !!token
    });

    // Create client if needed
    if (!currentClient) {
      currentClient = AgoraRTC.createClient({
        mode: 'rtc',
        codec: 'vp8'
      });

      // Set up event listeners
      currentClient.on('user-published', async (user, mediaType) => {
        console.log('👤 Remote user published:', user.uid, mediaType);

        try {
          await currentClient.subscribe(user, mediaType);
          console.log('✅ Subscribed to remote user:', user.uid, mediaType);

          // Play remote tracks
          if (mediaType === 'video') {
            const remoteVideoContainer = document.getElementById('remote-video');
            if (remoteVideoContainer) {
              user.videoTrack?.play(remoteVideoContainer);
            }
          }

          if (mediaType === 'audio') {
            user.audioTrack?.play();
          }

          onUserJoined?.(user, mediaType);
        } catch (error) {
          console.error('Error subscribing to remote user:', error);
          onError?.(error);
        }
      });

      currentClient.on('user-unpublished', (user, mediaType) => {
        console.log('👤 Remote user unpublished:', user.uid, mediaType);
      });

      currentClient.on('user-left', (user, reason) => {
        console.log('👤 Remote user left:', user.uid, reason);
        onUserLeft?.(user, reason);
      });

      currentClient.on('connection-state-change', (curState, prevState) => {
        console.log('🔌 Connection state changed:', prevState, '→', curState);
      });
    }

    // Join channel
    console.log('🔌 Joining channel...');
    await currentClient.join(appId, channel, token, uid);
    console.log('✅ Joined channel successfully');

    // Create and publish local tracks
    const localTracks = await createLocalTracks(callType);
    currentTracks = localTracks;

    if (localTracks.audio || localTracks.video) {
      const tracksToPublish = [];
      if (localTracks.audio) tracksToPublish.push(localTracks.audio);
      if (localTracks.video) tracksToPublish.push(localTracks.video);

      await currentClient.publish(tracksToPublish);
      console.log('✅ Published local tracks');
    }

    // Set up cleanup on page hide
    setupCleanupListeners();

    return {
      client: currentClient,
      localTracks,
      remoteUsers: currentClient.remoteUsers
    };
  } catch (error) {
    console.error('❌ Error joining Agora call:', error);
    onError?.(error);
    throw error;
  }
}

/**
 * Create local audio/video tracks
 * Must be called after user gesture on iOS
 *
 * @param {string} callType - 'voice' or 'video'
 * @returns {Promise<Object>} { audio, video }
 */
async function createLocalTracks(callType) {
  const tracks = { audio: null, video: null };

  try {
    // Always create audio track
    console.log('🎤 Creating audio track...');
    tracks.audio = await AgoraRTC.createMicrophoneAudioTrack({
      encoderConfig: 'high_quality_stereo'
    });
    console.log('✅ Audio track created');

    // Create video track only for video calls
    if (callType === 'video') {
      console.log('📹 Creating video track...');
      tracks.video = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: '720p_3'
      });
      console.log('✅ Video track created');

      // Play local video
      const localVideoContainer = document.getElementById('local-video');
      if (localVideoContainer) {
        tracks.video.play(localVideoContainer);
      }
    }
  } catch (error) {
    console.error('❌ Error creating tracks:', error);

    // If we're on iOS and got permission denied, show helpful message
    if (error.code === 'PERMISSION_DENIED') {
      throw new Error(
        'Microphone/camera permission denied. Please enable in your device settings.'
      );
    }

    throw error;
  }

  return tracks;
}

/**
 * Leave the current call and clean up
 */
export async function leaveAgoraCall() {
  console.log('📴 Leaving Agora call...');

  try {
    // Close and unpublish tracks
    if (currentTracks.audio) {
      currentTracks.audio.close();
      currentTracks.audio = null;
    }

    if (currentTracks.video) {
      currentTracks.video.close();
      currentTracks.video = null;
    }

    // Leave channel
    if (currentClient) {
      await currentClient.leave();
      console.log('✅ Left Agora channel');
    }
  } catch (error) {
    console.error('Error leaving call:', error);
  } finally {
    currentClient = null;
    currentTracks = { audio: null, video: null };
  }
}

/**
 * Toggle mute state of audio track
 *
 * @param {boolean} muted - True to mute, false to unmute
 */
export function toggleMute(muted) {
  if (currentTracks.audio) {
    currentTracks.audio.setMuted(muted);
    console.log(`🎤 Audio ${muted ? 'muted' : 'unmuted'}`);
  }
}

/**
 * Toggle video track enabled state
 *
 * @param {boolean} enabled - True to enable, false to disable
 */
export function toggleVideo(enabled) {
  if (currentTracks.video) {
    currentTracks.video.setEnabled(enabled);
    console.log(`📹 Video ${enabled ? 'enabled' : 'disabled'}`);
  }
}

/**
 * Switch camera (front/back) - mobile only
 */
export async function switchCamera() {
  if (currentTracks.video) {
    await currentTracks.video.switchCamera();
    console.log('📹 Switched camera');
  }
}

/**
 * Set up cleanup listeners for page hide/visibility change
 * Critical for iOS to clean up media tracks when app backgrounds
 */
function setupCleanupListeners() {
  const cleanup = () => {
    console.log('📱 Page hiding/backgrounding, cleaning up call...');
    leaveAgoraCall();
  };

  // iOS Safari
  window.addEventListener('pagehide', cleanup, { once: true });

  // Other browsers
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      cleanup();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

/**
 * Get current call state
 *
 * @returns {Object|null} { client, tracks, remoteUsers } or null if not in call
 */
export function getCurrentCallState() {
  if (!currentClient) return null;

  return {
    client: currentClient,
    tracks: currentTracks,
    remoteUsers: currentClient.remoteUsers,
    connectionState: currentClient.connectionState
  };
}

/**
 * Check if currently in a call
 *
 * @returns {boolean}
 */
export function isInCall() {
  return currentClient !== null && currentClient.connectionState === 'CONNECTED';
}
