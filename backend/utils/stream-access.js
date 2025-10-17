/**
 * Stream Access Validation Utilities
 *
 * Validates whether a user can join/access a specific stream
 * Used by Ably token auth to prevent unauthorized stream access
 */

const { pool } = require('./db');

/**
 * Check if a user can access a stream
 *
 * Access rules:
 * 1. Public/free streams: anyone can join
 * 2. Creator's own stream: always allowed
 * 3. Follower-only streams: must be following creator
 * 4. Ticketed streams: must have purchased ticket
 * 5. Private streams: creator only
 *
 * @param {string} userId - User's supabase_id (null for anonymous)
 * @param {string} streamId - Stream ID to check access for
 * @returns {Promise<{allowed: boolean, reason?: string}>}
 */
async function canUserJoinStream(userId, streamId) {
  try {
    // Validate inputs
    if (!streamId) {
      return { allowed: false, reason: 'MISSING_STREAM_ID' };
    }

    // Get stream details
    const streamResult = await pool.query(
      `SELECT
        s.id,
        s.creator_id,
        s.is_free,
        s.is_private,
        s.follower_only,
        s.ticket_price,
        s.status
       FROM streams s
       WHERE s.id = $1 OR s.channel = $1`,
      [streamId]
    );

    if (streamResult.rows.length === 0) {
      return { allowed: false, reason: 'STREAM_NOT_FOUND' };
    }

    const stream = streamResult.rows[0];

    // Rule 1: Free/public streams - anyone can join
    if (stream.is_free && !stream.is_private && !stream.follower_only) {
      return { allowed: true };
    }

    // Anonymous users can only access free public streams
    if (!userId) {
      return { allowed: false, reason: 'AUTH_REQUIRED' };
    }

    // Rule 2: Creator's own stream - always allowed
    if (stream.creator_id === userId) {
      return { allowed: true };
    }

    // Rule 3: Private streams - creator only
    if (stream.is_private) {
      return { allowed: false, reason: 'STREAM_PRIVATE' };
    }

    // Rule 4: Follower-only streams
    if (stream.follower_only) {
      const followResult = await pool.query(
        `SELECT 1 FROM follows
         WHERE follower_id = $1 AND followed_id = $2 AND is_active = true
         LIMIT 1`,
        [userId, stream.creator_id]
      );

      if (followResult.rows.length === 0) {
        return { allowed: false, reason: 'FOLLOWERS_ONLY' };
      }
    }

    // Rule 5: Ticketed streams (paid access)
    if (stream.ticket_price && stream.ticket_price > 0) {
      const ticketResult = await pool.query(
        `SELECT 1 FROM stream_tickets
         WHERE user_id = $1 AND stream_id = $2 AND is_valid = true
         LIMIT 1`,
        [userId, stream.id]
      );

      if (ticketResult.rows.length === 0) {
        return { allowed: false, reason: 'TICKET_REQUIRED' };
      }
    }

    // Default: allow access
    return { allowed: true };

  } catch (error) {
    console.error('Stream access check error:', error);

    // Fail-closed for security: deny access on error
    // (Prefer false negatives over false positives)
    return { allowed: false, reason: 'ACCESS_CHECK_FAILED' };
  }
}

/**
 * Batch check access for multiple streams
 * Useful for filtering stream lists
 */
async function filterAccessibleStreams(userId, streamIds) {
  const results = await Promise.all(
    streamIds.map(streamId => canUserJoinStream(userId, streamId))
  );

  return streamIds.filter((_, index) => results[index].allowed);
}

/**
 * Get user's access level for a stream
 * Returns: 'creator' | 'moderator' | 'subscriber' | 'follower' | 'viewer' | null
 */
async function getUserStreamRole(userId, streamId) {
  if (!userId || !streamId) return null;

  try {
    const result = await pool.query(
      `SELECT
        CASE
          WHEN s.creator_id = $1 THEN 'creator'
          WHEN EXISTS(
            SELECT 1 FROM stream_moderators
            WHERE stream_id = s.id AND user_id = $1 AND is_active = true
          ) THEN 'moderator'
          WHEN EXISTS(
            SELECT 1 FROM subscriptions
            WHERE subscriber_id = $1 AND creator_id = s.creator_id AND status = 'active'
          ) THEN 'subscriber'
          WHEN EXISTS(
            SELECT 1 FROM follows
            WHERE follower_id = $1 AND followed_id = s.creator_id AND is_active = true
          ) THEN 'follower'
          ELSE 'viewer'
        END as role
       FROM streams s
       WHERE s.id = $2 OR s.channel = $2`,
      [userId, streamId]
    );

    return result.rows[0]?.role || null;
  } catch (error) {
    console.error('Get stream role error:', error);
    return null;
  }
}

module.exports = {
  canUserJoinStream,
  filterAccessibleStreams,
  getUserStreamRole
};
