/**
 * Supabase Realtime Adapter
 *
 * Drop-in replacement for Socket.io using Supabase Realtime channels.
 * This adapter provides a similar API to Socket.io for broadcasting events.
 *
 * Migration from Socket.io to serverless-compatible Supabase Realtime.
 */

const { createClient } = require('@supabase/supabase-js');
const { logger } = require('./secureLogger');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * Publish event to a Supabase Realtime channel
 *
 * @param {string} channel - Channel name (e.g., 'stream:123', 'user:456')
 * @param {string} event - Event type (e.g., 'viewer_count', 'message')
 * @param {object} payload - Event payload
 * @returns {Promise<void>}
 */
async function publishToChannel(channel, event, payload) {
  try {
    const channelRef = supabase.channel(channel);

    await channelRef.send({
      type: 'broadcast',
      event,
      payload: {
        ...payload,
        timestamp: new Date().toISOString(),
        server_time: Date.now()
      }
    });

    logger.info('Published to Supabase Realtime', {
      channel,
      event,
      payloadSize: JSON.stringify(payload).length
    });
  } catch (error) {
    logger.error('Failed to publish to Supabase Realtime', {
      channel,
      event,
      error: error.message
    });
    throw error;
  }
}

/**
 * Socket.io-compatible adapter for Supabase Realtime
 *
 * Provides `io.to(room).emit(event, data)` syntax
 */
class RealtimeAdapter {
  /**
   * Emit event to a specific room/channel
   *
   * @param {string} room - Room name (converts to Supabase channel)
   * @returns {Object} - Chainable emit interface
   */
  to(room) {
    return {
      emit: async (event, data) => {
        await publishToChannel(room, event, data);
      }
    };
  }

  /**
   * Broadcast event globally (not recommended, use specific channels)
   *
   * @param {string} event - Event type
   * @param {object} data - Event data
   */
  async emit(event, data) {
    logger.warn('Global emit called - consider using specific channels', { event });
    await publishToChannel('global', event, data);
  }

  /**
   * Emit to user-specific channel
   *
   * @param {string|number} userId - User ID
   * @param {string} event - Event type
   * @param {object} data - Event data
   */
  async emitToUser(userId, event, data) {
    await publishToChannel(`user:${userId}`, event, data);
  }

  /**
   * Emit to stream-specific channel
   *
   * @param {string|number} streamId - Stream ID
   * @param {string} event - Event type
   * @param {object} data - Event data
   */
  async emitToStream(streamId, event, data) {
    await publishToChannel(`stream:${streamId}`, event, data);
  }

  /**
   * Emit to stream chat channel
   *
   * @param {string|number} streamId - Stream ID
   * @param {object} message - Chat message
   */
  async emitStreamChat(streamId, message) {
    await publishToChannel(`stream:${streamId}:chat`, 'message', message);
  }

  /**
   * Emit stream reactions
   *
   * @param {string|number} streamId - Stream ID
   * @param {object} reaction - Reaction data
   */
  async emitStreamReaction(streamId, reaction) {
    await publishToChannel(`stream:${streamId}:reactions`, 'reaction', reaction);
  }

  /**
   * Emit stream poll events
   *
   * @param {string|number} streamId - Stream ID
   * @param {string} pollEvent - Poll event type ('created', 'updated', 'voted')
   * @param {object} pollData - Poll data
   */
  async emitStreamPoll(streamId, pollEvent, pollData) {
    await publishToChannel(`stream:${streamId}:polls`, pollEvent, pollData);
  }

  /**
   * Emit user presence update
   *
   * @param {string|number} userId - User ID
   * @param {string} status - Status ('online', 'offline', 'away')
   * @param {object} metadata - Additional presence data
   */
  async emitPresence(userId, status, metadata = {}) {
    await publishToChannel('presence:global', 'user_presence', {
      userId,
      status,
      ...metadata
    });
  }

  /**
   * Emit notification to user
   *
   * @param {string|number} userId - User ID
   * @param {object} notification - Notification data
   */
  async emitNotification(userId, notification) {
    await publishToChannel(`user:${userId}:notifications`, 'notification', notification);
  }

  /**
   * Emit challenge/achievement event
   *
   * @param {string|number} userId - User ID
   * @param {string} eventType - Event type ('completed', 'milestone', etc.)
   * @param {object} data - Challenge/achievement data
   */
  async emitChallenge(userId, eventType, data) {
    await publishToChannel(`user:${userId}:challenges`, eventType, data);
  }

  /**
   * Batch emit - send multiple events at once
   *
   * @param {Array<{channel: string, event: string, data: object}>} events
   */
  async batchEmit(events) {
    const promises = events.map(({ channel, event, data }) =>
      publishToChannel(channel, event, data).catch(err => {
        logger.error('Batch emit failed for event', { channel, event, error: err.message });
        return null;
      })
    );

    const results = await Promise.allSettled(promises);
    const failed = results.filter(r => r.status === 'rejected').length;

    if (failed > 0) {
      logger.warn(`Batch emit completed with ${failed}/${events.length} failures`);
    }

    return results;
  }
}

// Singleton instance
const realtimeAdapter = new RealtimeAdapter();

/**
 * Helper function to migrate existing Socket.io code
 *
 * Usage in existing code:
 *
 * OLD: io.to(`stream:${streamId}`).emit('viewer-count', data)
 * NEW: await emitToRoom(`stream:${streamId}`, 'viewer-count', data)
 *
 * @param {string} room - Room/channel name
 * @param {string} event - Event type
 * @param {object} data - Event data
 */
async function emitToRoom(room, event, data) {
  return realtimeAdapter.to(room).emit(event, data);
}

/**
 * Wrapper for user-specific events
 */
async function emitToUser(userId, event, data) {
  return realtimeAdapter.emitToUser(userId, event, data);
}

/**
 * Check if Supabase Realtime is properly configured
 */
function checkRealtimeConfig() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    logger.error('Supabase Realtime not configured - missing environment variables');
    return false;
  }
  return true;
}

// Export both the adapter and helper functions
module.exports = {
  realtimeAdapter,
  emitToRoom,
  emitToUser,
  emitToStream: (streamId, event, data) => realtimeAdapter.emitToStream(streamId, event, data),
  emitStreamChat: (streamId, message) => realtimeAdapter.emitStreamChat(streamId, message),
  emitStreamReaction: (streamId, reaction) => realtimeAdapter.emitStreamReaction(streamId, reaction),
  emitStreamPoll: (streamId, pollEvent, data) => realtimeAdapter.emitStreamPoll(streamId, pollEvent, data),
  emitPresence: (userId, status, metadata) => realtimeAdapter.emitPresence(userId, status, metadata),
  emitNotification: (userId, notification) => realtimeAdapter.emitNotification(userId, notification),
  emitChallenge: (userId, eventType, data) => realtimeAdapter.emitChallenge(userId, eventType, data),
  batchEmit: (events) => realtimeAdapter.batchEmit(events),
  checkRealtimeConfig,

  // Export Supabase client for direct channel operations if needed
  supabase
};
