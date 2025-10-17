/**
 * Ably Realtime Adapter for Backend
 *
 * Serverless-compatible real-time messaging adapter using Ably.
 * Provides Socket.io-compatible API for broadcasting events.
 *
 * Used for call requests, messages, balance updates, notifications, etc.
 */

const Ably = require('ably');
const { logger } = require('./secureLogger');

// Initialize Ably REST client with API key
let ablyClient = null;

function getAblyClient() {
  if (!ablyClient) {
    const apiKey = process.env.ABLY_API_KEY;

    if (!apiKey) {
      logger.error('ABLY_API_KEY not configured');
      throw new Error('Ably not configured');
    }

    ablyClient = new Ably.Rest(apiKey);
    logger.info('Ably REST client initialized');
  }

  return ablyClient;
}

/**
 * Publish event to an Ably channel
 *
 * @param {string} channelName - Channel name (e.g., 'stream:123', 'user:456')
 * @param {string} event - Event type (e.g., 'call:request', 'message:new')
 * @param {object} payload - Event payload
 * @returns {Promise<void>}
 */
async function publishToChannel(channelName, event, payload) {
  try {
    const client = getAblyClient();
    const channel = client.channels.get(channelName);

    await channel.publish(event, {
      ...payload,
      timestamp: new Date().toISOString(),
      serverTime: Date.now()
    });

    logger.info('Published to Ably channel', {
      channel: channelName,
      event,
      payloadSize: JSON.stringify(payload).length
    });
  } catch (error) {
    logger.error('Failed to publish to Ably', {
      channel: channelName,
      event,
      error: error.message
    });
    throw error;
  }
}

/**
 * Ably adapter with Socket.io-compatible API
 */
class AblyAdapter {
  /**
   * Emit event to a specific room/channel
   * Socket.io compatibility: io.to(room).emit(event, data)
   *
   * @param {string} room - Room name (maps to Ably channel)
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
   * @param {string|number} userId - User ID (Supabase ID)
   * @param {string} event - Event type (e.g., 'call:request', 'balance:update')
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
   * Emit stream chat message
   *
   * @param {string|number} streamId - Stream ID
   * @param {object} message - Chat message
   */
  async emitStreamChat(streamId, message) {
    await publishToChannel(`stream:${streamId}`, 'message:new', message);
  }

  /**
   * Emit stream reactions
   *
   * @param {string|number} streamId - Stream ID
   * @param {object} reaction - Reaction data
   */
  async emitStreamReaction(streamId, reaction) {
    await publishToChannel(`stream:${streamId}`, 'reaction:new', reaction);
  }

  /**
   * Emit notification to user
   *
   * @param {string|number} userId - User ID
   * @param {object} notification - Notification data
   */
  async emitNotification(userId, notification) {
    await publishToChannel(`user:${userId}`, 'notification:new', notification);
  }

  /**
   * Emit balance update to user
   *
   * @param {string|number} userId - User ID
   * @param {number} balance - New balance
   */
  async emitBalanceUpdate(userId, balance) {
    await publishToChannel(`user:${userId}`, 'balance:update', { balance });
  }

  /**
   * Emit call request to creator
   *
   * @param {string|number} creatorId - Creator's user ID
   * @param {object} callData - Call request data
   */
  async emitCallRequest(creatorId, callData) {
    await publishToChannel(`user:${creatorId}`, 'call:request', callData);
  }

  /**
   * Emit call accepted to fan
   *
   * @param {string|number} fanId - Fan's user ID
   * @param {object} callData - Call accepted data
   */
  async emitCallAccepted(fanId, callData) {
    await publishToChannel(`user:${fanId}`, 'call:accepted', callData);
  }

  /**
   * Emit call rejected to fan
   *
   * @param {string|number} fanId - Fan's user ID
   * @param {object} callData - Call rejected data
   */
  async emitCallRejected(fanId, callData) {
    await publishToChannel(`user:${fanId}`, 'call:rejected', callData);
  }

  /**
   * Emit call cancelled
   *
   * @param {string|number} userId - User ID to notify
   * @param {object} callData - Call cancelled data
   */
  async emitCallCancelled(userId, callData) {
    await publishToChannel(`user:${userId}`, 'call:cancelled', callData);
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
const ablyAdapter = new AblyAdapter();

/**
 * Helper function to migrate existing Socket.io code
 *
 * Usage:
 * OLD: io.to(`user:${userId}`).emit('call-request', data)
 * NEW: await emitToRoom(`user:${userId}`, 'call:request', data)
 *
 * @param {string} room - Room/channel name
 * @param {string} event - Event type
 * @param {object} data - Event data
 */
async function emitToRoom(room, event, data) {
  return ablyAdapter.to(room).emit(event, data);
}

/**
 * Wrapper for user-specific events
 */
async function emitToUser(userId, event, data) {
  return ablyAdapter.emitToUser(userId, event, data);
}

/**
 * Check if Ably is properly configured
 */
function checkAblyConfig() {
  if (!process.env.ABLY_API_KEY) {
    logger.error('Ably not configured - missing ABLY_API_KEY');
    return false;
  }
  return true;
}

// Export adapter and helper functions
module.exports = {
  ablyAdapter,
  emitToRoom,
  emitToUser,
  emitToStream: (streamId, event, data) => ablyAdapter.emitToStream(streamId, event, data),
  emitStreamChat: (streamId, message) => ablyAdapter.emitStreamChat(streamId, message),
  emitStreamReaction: (streamId, reaction) => ablyAdapter.emitStreamReaction(streamId, reaction),
  emitNotification: (userId, notification) => ablyAdapter.emitNotification(userId, notification),
  emitBalanceUpdate: (userId, balance) => ablyAdapter.emitBalanceUpdate(userId, balance),
  emitCallRequest: (creatorId, callData) => ablyAdapter.emitCallRequest(creatorId, callData),
  emitCallAccepted: (fanId, callData) => ablyAdapter.emitCallAccepted(fanId, callData),
  emitCallRejected: (fanId, callData) => ablyAdapter.emitCallRejected(fanId, callData),
  emitCallCancelled: (userId, callData) => ablyAdapter.emitCallCancelled(userId, callData),
  batchEmit: (events) => ablyAdapter.batchEmit(events),
  checkAblyConfig,
  publishToChannel
};
