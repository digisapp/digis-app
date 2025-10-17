/**
 * Ably Publish Utility
 *
 * Lightweight helper for publishing events to Ably channels.
 * DRY wrapper around Ably REST client.
 */

const Ably = require('ably');

if (!process.env.ABLY_API_KEY) {
  console.warn('[ably-publish] ABLY_API_KEY is missing – publishes will no-op.');
}

const client = process.env.ABLY_API_KEY ? new Ably.Rest(process.env.ABLY_API_KEY) : null;

/**
 * Publish an event to an Ably channel
 *
 * @param {string} channelName - Channel name (e.g., 'user:123', 'stream:abc')
 * @param {string} event - Event type (e.g., 'call:request', 'tip:new')
 * @param {object} payload - Event payload
 * @returns {Promise<void>}
 */
async function publish(channelName, event, payload) {
  if (!client) {
    console.warn(`[ably-publish] Cannot publish ${event} to ${channelName} - client not initialized`);
    return;
  }

  try {
    const channel = client.channels.get(channelName);
    await channel.publish(event, {
      ...payload,
      timestamp: payload.timestamp || new Date().toISOString(),
      serverTime: Date.now()
    });

    console.log(`[ably-publish] ✓ Published ${event} to ${channelName}`);
  } catch (error) {
    console.error(`[ably-publish] ✗ Failed to publish ${event} to ${channelName}:`, error.message);
    throw error;
  }
}

/**
 * Batch publish multiple events
 *
 * @param {Array<{channel: string, event: string, payload: object}>} events
 * @returns {Promise<Array>}
 */
async function batchPublish(events) {
  if (!client) {
    console.warn('[ably-publish] Cannot batch publish - client not initialized');
    return [];
  }

  const promises = events.map(({ channel, event, payload }) =>
    publish(channel, event, payload).catch(err => {
      console.error(`[ably-publish] Batch publish failed for ${event} on ${channel}:`, err.message);
      return null;
    })
  );

  const results = await Promise.allSettled(promises);
  const failed = results.filter(r => r.status === 'rejected').length;

  if (failed > 0) {
    console.warn(`[ably-publish] Batch completed with ${failed}/${events.length} failures`);
  }

  return results;
}

module.exports = { publish, batchPublish };
