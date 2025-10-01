/**
 * Token Version Management
 * For JWT revocation without storing sessions
 */

const { pool } = require('../utils/db');
const { redis, KEY_PREFIXES, TTL } = require('./redis');

/**
 * Get user's current token version
 * Checks Redis cache first, then database
 */
async function getTokenVersion(userId) {
  const cacheKey = `${KEY_PREFIXES.TOKEN_VERSION}${userId}`;

  try {
    // Check Redis cache first
    const cached = await redis.get(cacheKey);
    if (cached !== null) {
      return parseInt(cached);
    }

    // Fetch from database
    const result = await pool.query(
      'SELECT token_version FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return 0; // User doesn't exist
    }

    const version = result.rows[0].token_version || 0;

    // Cache for 1 hour
    await redis.set(cacheKey, version, { ex: TTL.LONG });

    return version;
  } catch (error) {
    console.error('Error getting token version:', error);
    // On error, return 0 (will invalidate token)
    return 0;
  }
}

/**
 * Increment user's token version (forces logout of all sessions)
 */
async function incrementTokenVersion(userId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Increment in database
    const result = await client.query(
      `UPDATE users
       SET token_version = COALESCE(token_version, 0) + 1,
           updated_at = NOW()
       WHERE id = $1
       RETURNING token_version`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const newVersion = result.rows[0].token_version;

    // Update Redis cache immediately
    const cacheKey = `${KEY_PREFIXES.TOKEN_VERSION}${userId}`;
    await redis.set(cacheKey, newVersion, { ex: TTL.LONG });

    await client.query('COMMIT');

    console.log(`Token version incremented for user ${userId} to ${newVersion}`);
    return newVersion;

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error incrementing token version:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Bulk increment token versions (e.g., force logout all users)
 */
async function incrementAllTokenVersions() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Increment all user token versions
    const result = await client.query(
      `UPDATE users
       SET token_version = COALESCE(token_version, 0) + 1,
           updated_at = NOW()
       RETURNING id, token_version`
    );

    // Clear all token version caches
    // Note: In production, you might want to use Redis SCAN instead
    for (const user of result.rows) {
      const cacheKey = `${KEY_PREFIXES.TOKEN_VERSION}${user.id}`;
      await redis.del(cacheKey);
    }

    await client.query('COMMIT');

    console.log(`Token versions incremented for ${result.rows.length} users`);
    return result.rows.length;

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error incrementing all token versions:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Verify token version from JWT payload
 * Returns true if token is still valid
 */
async function verifyTokenVersion(userId, tokenVersion) {
  const currentVersion = await getTokenVersion(userId);
  return tokenVersion === currentVersion;
}

/**
 * Clear token version cache for a user
 */
async function clearTokenVersionCache(userId) {
  const cacheKey = `${KEY_PREFIXES.TOKEN_VERSION}${userId}`;
  await redis.del(cacheKey);
}

module.exports = {
  getTokenVersion,
  incrementTokenVersion,
  incrementAllTokenVersions,
  verifyTokenVersion,
  clearTokenVersionCache
};