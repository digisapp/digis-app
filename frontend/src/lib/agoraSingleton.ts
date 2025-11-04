/**
 * Agora Singleton Client Manager
 *
 * Prevents UID_CONFLICT by ensuring only one client instance
 * exists per channel and properly leaves before rejoining.
 */

import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';

interface JoinState {
  channel: string;
  uid: number | null;
  isJoined: boolean;
}

let client: IAgoraRTCClient | null = null;
let currentState: JoinState = {
  channel: '',
  uid: null,
  isJoined: false
};
let isJoining = false;

/**
 * Get or create the singleton Agora client
 */
export function getClient(): IAgoraRTCClient {
  if (!client) {
    client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
    console.log('✅ Created new Agora client');
  }
  return client;
}

/**
 * Leave channel if currently joined
 */
export async function leaveIfJoined(): Promise<void> {
  if (!client || !currentState.isJoined) {
    console.log('ℹ️ No active Agora session to leave');
    return;
  }

  try {
    console.log(`🚪 Leaving channel: ${currentState.channel}`);
    await client.leave();
    console.log('✅ Left channel successfully');
  } catch (error) {
    console.warn('⚠️ Error leaving channel (non-fatal):', error);
  } finally {
    currentState = { channel: '', uid: null, isJoined: false };
  }
}

/**
 * Join as host with proper singleton management
 */
export async function hostJoin(params: {
  appId: string;
  channel: string;
  token: string;
  uid?: number;
}): Promise<{ client: IAgoraRTCClient; uid: number }> {
  const { appId, channel, token, uid } = params;

  // Prevent concurrent joins
  if (isJoining) {
    console.warn('⚠️ Join already in progress, waiting...');
    // Wait a bit and try again
    await new Promise(resolve => setTimeout(resolve, 500));
    if (isJoining) {
      throw new Error('Concurrent join attempt blocked');
    }
  }

  isJoining = true;

  try {
    // Always leave previous channel first to prevent ghosts
    await leaveIfJoined();

    const c = getClient();

    console.log('🎬 Joining channel as host:', {
      channel,
      uid: uid ?? 'auto-assigned',
      appId: appId.substring(0, 8) + '...'
    });

    // Join with provided UID or let Agora assign one
    const joinedUid = await c.join(appId, channel, token, uid ?? undefined);
    console.log('✅ Joined with UID:', joinedUid);

    // Set client role to host
    await c.setClientRole('host');
    console.log('✅ Set role to host');

    // Update state
    currentState = {
      channel,
      uid: Number(joinedUid),
      isJoined: true
    };

    return { client: c, uid: currentState.uid! };
  } finally {
    isJoining = false;
  }
}

/**
 * Join as audience with proper singleton management
 */
export async function audienceJoin(params: {
  appId: string;
  channel: string;
  token: string;
  uid?: number;
}): Promise<{ client: IAgoraRTCClient; uid: number }> {
  const { appId, channel, token, uid } = params;

  if (isJoining) {
    console.warn('⚠️ Join already in progress');
    throw new Error('Concurrent join attempt');
  }

  isJoining = true;

  try {
    await leaveIfJoined();

    const c = getClient();

    console.log('👥 Joining channel as audience:', { channel, uid: uid ?? 'auto' });

    const joinedUid = await c.join(appId, channel, token, uid ?? undefined);

    await c.setClientRole('audience');
    console.log('✅ Set role to audience');

    currentState = {
      channel,
      uid: Number(joinedUid),
      isJoined: true
    };

    return { client: c, uid: currentState.uid! };
  } finally {
    isJoining = false;
  }
}

/**
 * Setup auto-retry on disconnection
 */
export function setupConnectionMonitor(
  onDisconnect?: () => void,
  onReconnect?: () => void
): () => void {
  const c = getClient();

  const handler = async (curState: string, prevState: string, reason?: string) => {
    console.log(`🔌 Connection state changed: ${prevState} → ${curState}`, { reason });

    if (curState === 'DISCONNECTED' && currentState.isJoined) {
      console.warn('⚠️ Agora disconnected unexpectedly:', reason);
      onDisconnect?.();

      // Simple backoff retry once
      try {
        console.log('🔄 Attempting to rejoin after disconnect...');
        await new Promise(resolve => setTimeout(resolve, 1200));

        // Rejoin with same credentials (must be stored externally)
        // This is a placeholder - caller should handle rejoin with fresh token
        onReconnect?.();
      } catch (error) {
        console.error('❌ Auto-rejoin failed:', error);
      }
    }
  };

  c.on('connection-state-change', handler);

  // Return cleanup function
  return () => {
    c.off('connection-state-change', handler);
  };
}

/**
 * Get current join state (for debugging)
 */
export function getCurrentState(): JoinState {
  return { ...currentState };
}

/**
 * Cleanup everything (on app unmount)
 */
export async function cleanup(): Promise<void> {
  await leaveIfJoined();
  if (client) {
    client.removeAllListeners();
    client = null;
  }
  console.log('🧹 Agora singleton cleaned up');
}
