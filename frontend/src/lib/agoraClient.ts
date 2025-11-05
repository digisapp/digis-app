/**
 * Agora Client Singleton - Prevents UID_CONFLICT
 *
 * This ensures only ONE client exists across the entire app,
 * preventing multiple clients from joining with the same UID.
 */

import AgoraRTC from "agora-rtc-sdk-ng";

type AgoraClient = ReturnType<typeof AgoraRTC.createClient>;

let _client: AgoraClient | null = null;
let _channel = "";
let _uid: number | null = null;
let _joining = false;

/**
 * Get or create the singleton Agora client
 */
export function getClient(): AgoraClient {
  if (!_client) {
    _client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });

    // Debug logging for connection state changes
    _client.on("connection-state-change", (cur, prev, reason) => {
      console.log(`[Agora] state: ${prev} → ${cur}`, reason ? `reason: ${reason}` : '');
    });

    console.log('✅ Agora client singleton created');
  }
  return _client;
}

/**
 * Get current join state (for debugging)
 */
export function getJoinState() {
  return { channel: _channel, uid: _uid, joining: _joining };
}

/**
 * Safely leave the current channel
 */
export async function safeLeave() {
  const c = getClient();
  try {
    if (_channel) {
      console.log(`🚪 Leaving channel: ${_channel}`);
      await c.leave();
      console.log('✅ Left channel successfully');
    }
  } catch (error) {
    console.warn('Leave error (non-fatal):', error);
  }
  _channel = "";
  _uid = null;
}

/**
 * Join as host with proper singleton management
 *
 * @param opts.appId - Agora App ID
 * @param opts.channel - Channel name
 * @param opts.token - RTC token
 * @param opts.uid - UID (required if token is UID-bound, omit if token is UID-agnostic)
 */
export async function joinAsHost(opts: {
  appId: string;
  channel: string;
  token: string;
  uid?: number | null;
}) {
  // Debounce concurrent joins
  if (_joining) {
    console.log('⚠️ Join already in progress, skipping duplicate call');
    return { uid: _uid };
  }

  _joining = true;

  const c = getClient();

  try {
    // Always leave first to clear ghost connections
    await safeLeave();

    // Tiny delay lets Agora release the old session
    await new Promise(resolve => setTimeout(resolve, 250));

    console.log('🎬 Joining as host:', {
      channel: opts.channel,
      uid: opts.uid ?? 'auto-assigned',
      appId: opts.appId.substring(0, 8) + '...'
    });

    // Join with UID or let Agora assign one
    const assigned = await c.join(
      opts.appId,
      opts.channel,
      opts.token || null,
      opts.uid ?? undefined // undefined = Agora assigns UID (for UID-agnostic tokens)
    );

    // Set client role to host and verify it took effect
    await c.setClientRole("host");
    console.log('✅ Set client role to host');

    // Verify the role was actually set
    // @ts-ignore - _role is internal but we need to verify
    if (c._role !== "host") {
      console.warn('⚠️ Role mismatch detected, retrying setClientRole...');
      await c.setClientRole("host");
      // Small delay to ensure role change propagates
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    _channel = opts.channel;
    _uid = Number(assigned);

    console.log(`✅ Successfully joined as host with UID: ${_uid}`);

    // Small delay to ensure SDK state is fully updated
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify join succeeded by checking channelName
    if (!c.channelName) {
      console.error('❌ Join verification failed: channelName is null');
      throw new Error('Join failed: channelName not set after join');
    }

    console.log(`✅ Join verified: channelName = ${c.channelName}`);

    return { client: c, uid: _uid };
  } finally {
    _joining = false;
  }
}

/**
 * Join as audience with proper singleton management
 */
export async function joinAsAudience(opts: {
  appId: string;
  channel: string;
  token: string;
  uid?: number | null;
}) {
  if (_joining) {
    console.log('⚠️ Join already in progress');
    return { uid: _uid };
  }

  _joining = true;

  const c = getClient();

  try {
    await safeLeave();
    await new Promise(resolve => setTimeout(resolve, 250));

    console.log('👥 Joining as audience:', opts.channel);

    const assigned = await c.join(
      opts.appId,
      opts.channel,
      opts.token || null,
      opts.uid ?? undefined
    );

    await c.setClientRole("audience");

    _channel = opts.channel;
    _uid = Number(assigned);

    console.log(`✅ Joined as audience with UID: ${_uid}`);

    // Small delay to ensure SDK state is fully updated
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify join succeeded
    if (!c.channelName) {
      console.error('❌ Join verification failed: channelName is null');
      throw new Error('Join failed: channelName not set after join');
    }

    console.log(`✅ Join verified: channelName = ${c.channelName}`);

    return { client: c, uid: _uid };
  } finally {
    _joining = false;
  }
}

/**
 * Cleanup everything (call on app unmount)
 */
export async function cleanup() {
  await safeLeave();
  if (_client) {
    _client.removeAllListeners();
    _client = null;
  }
  console.log('🧹 Agora singleton cleaned up');
}
