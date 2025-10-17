/**
 * Ably Presence Service
 *
 * Provides real-time presence tracking using Ably's built-in Presence API.
 * Replaces Redis-based presence with automatic cleanup on disconnect.
 *
 * Benefits:
 * - Auto cleanup on disconnect (no manual TTL management)
 * - Real-time member list updates
 * - Zero Redis writes for presence
 * - Built-in conflict resolution
 */

/**
 * Get a stream channel from an Ably client
 */
export function getStreamChannel(ably, streamId) {
  if (!ably) {
    throw new Error('Ably client is required');
  }
  return ably.channels.get(`stream:${streamId}`);
}

/**
 * Join stream presence and get helpers for managing it
 *
 * @param {import('ably').Realtime} ably - Ably client instance
 * @param {string} streamId - Stream to join
 * @param {Object} user - User profile { id, username, avatar }
 * @returns {Promise<Object>} Presence helpers { leave, getMembers, subscribeMemberChanges, channel }
 */
export async function joinStreamPresence(ably, streamId, user) {
  if (!ably || !streamId || !user) {
    throw new Error('Missing required parameters: ably, streamId, or user');
  }

  const channel = getStreamChannel(ably, streamId);

  // Enter presence with minimal user profile
  await channel.presence.enter({
    userId: user.id,
    name: user.username || user.display_name,
    avatar: user.avatar || user.profile_pic_url,
  });

  console.log(`✅ Joined presence for stream:${streamId} as ${user.username}`);

  /**
   * Leave presence (auto-called on disconnect too)
   */
  const leave = async () => {
    try {
      await channel.presence.leave();
      console.log(`👋 Left presence for stream:${streamId}`);
    } catch (error) {
      console.warn('Error leaving presence:', error);
    }
  };

  /**
   * Get current members in the stream
   * @returns {Promise<Array>} List of presence members
   */
  const getMembers = async () => {
    try {
      const members = await channel.presence.get();
      return members.map(m => ({
        clientId: m.clientId,
        data: m.data
      }));
    } catch (error) {
      console.error('Error getting presence members:', error);
      return [];
    }
  };

  /**
   * Subscribe to presence changes (enter/leave/update)
   * @param {Function} callback - Called with (action, member)
   * @returns {Function} Unsubscribe function
   */
  const subscribeMemberChanges = (callback) => {
    const handler = (msg) => {
      callback(
        msg.action, // 'enter', 'leave', 'update'
        {
          clientId: msg.clientId,
          data: msg.data
        }
      );
    };

    channel.presence.subscribe(['enter', 'leave', 'update'], handler);

    // Return unsubscribe function
    return () => {
      channel.presence.unsubscribe(['enter', 'leave', 'update'], handler);
    };
  };

  return {
    leave,
    getMembers,
    subscribeMemberChanges,
    channel
  };
}

/**
 * Get presence count for a stream without joining
 * Useful for server-side or lightweight checks
 */
export async function getStreamPresenceCount(ably, streamId) {
  try {
    const channel = getStreamChannel(ably, streamId);
    const members = await channel.presence.get();
    return members.length;
  } catch (error) {
    console.error('Error getting presence count:', error);
    return 0;
  }
}
