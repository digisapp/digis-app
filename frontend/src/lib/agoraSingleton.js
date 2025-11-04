/**
 * Agora RTC Singleton
 *
 * Prevents multiple VideoCall component instances from creating
 * duplicate Agora clients that join the same channel with the same UID.
 *
 * This is the definitive fix for UID_CONFLICT errors caused by:
 * - React StrictMode double-rendering
 * - Route transitions creating duplicate components
 * - Hot module reload during development
 * - Modal overlays not cleaning up properly
 */

import AgoraRTC from 'agora-rtc-sdk-ng';

/**
 * Global singleton state - shared across ALL component instances
 */
const agoraBag = {
  client: null,
  uid: null,
  channel: null,
  tracks: {
    audio: null,
    video: null,
    screen: null
  }
};

/**
 * Get the singleton Agora client (creates if needed)
 */
export function getAgoraClient() {
  if (!agoraBag.client) {
    console.log('🎬 Creating singleton Agora client');
    agoraBag.client = AgoraRTC.createClient({
      mode: 'live',
      codec: 'vp8'
    });
  }
  return agoraBag.client;
}

/**
 * Get current Agora session state
 */
export function getAgoraState() {
  return agoraBag;
}

/**
 * Update Agora session state
 */
export function setAgoraState(updates) {
  Object.assign(agoraBag, updates);
  console.log('📊 Agora state updated:', agoraBag);
}

/**
 * Leave current channel and clean up (idempotent)
 */
export async function ensureLeft() {
  console.log('🚪 Ensuring Agora client left channel...');

  if (agoraBag.client) {
    try {
      // Stop and close all tracks
      if (agoraBag.tracks.audio) {
        agoraBag.tracks.audio.stop();
        agoraBag.tracks.audio.close();
      }
      if (agoraBag.tracks.video) {
        agoraBag.tracks.video.stop();
        agoraBag.tracks.video.close();
      }
      if (agoraBag.tracks.screen) {
        agoraBag.tracks.screen.stop();
        agoraBag.tracks.screen.close();
      }

      // Leave channel
      await agoraBag.client.leave();
      console.log('✅ Left Agora channel');
    } catch (error) {
      console.warn('⚠️ Error leaving channel (may already be disconnected):', error.message);
    }
  }

  // Reset state
  setAgoraState({
    uid: null,
    channel: null,
    tracks: { audio: null, video: null, screen: null }
  });
}

/**
 * Check if already in a channel
 */
export function isInChannel(channelName) {
  return agoraBag.channel === channelName && agoraBag.client !== null;
}

/**
 * Get singleton instance for debugging
 */
if (typeof window !== 'undefined') {
  window.__agoraSingleton = agoraBag;
}

export default {
  getAgoraClient,
  getAgoraState,
  setAgoraState,
  ensureLeft,
  isInChannel
};
