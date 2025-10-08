/**
 * Upstash Redis Cache Utility (Serverless)
 *
 * Uses Upstash Redis for serverless caching only.
 * NO LONGER used for job queues (that's Inngest now).
 *
 * Use cases:
 * - Creator profile caching
 * - Analytics data caching
 * - Feature flags
 * - Session data
 * - Temporary locks
 * - Rate limiting
 */

const { Redis } = require('@upstash/redis');

// Initialize Upstash Redis client
const redis = process.env.UPSTASH_REDIS_REST_URL
  ? Redis.fromEnv()
  : null;

/**
 * Get cached value
 */
async function get(key) {
  if (!redis) {
    console.warn('Upstash Redis not configured, cache miss');
    return null;
  }

  try {
    return await redis.get(key);
  } catch (error) {
    console.error('Upstash Redis GET error:', error);
    return null;
  }
}

/**
 * Set cached value with TTL
 */
async function set(key, value, ttlSeconds = 3600) {
  if (!redis) {
    console.warn('Upstash Redis not configured, skipping cache');
    return false;
  }

  try {
    await redis.set(key, value, { ex: ttlSeconds });
    return true;
  } catch (error) {
    console.error('Upstash Redis SET error:', error);
    return false;
  }
}

/**
 * Delete cached value
 */
async function del(key) {
  if (!redis) return false;

  try {
    await redis.del(key);
    return true;
  } catch (error) {
    console.error('Upstash Redis DEL error:', error);
    return false;
  }
}

/**
 * Get or compute (cache-aside pattern)
 */
async function getOrCompute(key, computeFn, ttlSeconds = 3600) {
  // Try cache first
  const cached = await get(key);
  if (cached !== null) {
    return cached;
  }

  // Compute value
  const value = await computeFn();

  // Store in cache
  await set(key, value, ttlSeconds);

  return value;
}

/**
 * Cache creator profile
 */
async function cacheCreatorProfile(creatorId, profile, ttlSeconds = 300) {
  return set(`creator:${creatorId}:profile`, JSON.stringify(profile), ttlSeconds);
}

/**
 * Get cached creator profile
 */
async function getCachedCreatorProfile(creatorId) {
  const cached = await get(`creator:${creatorId}:profile`);
  return cached ? JSON.parse(cached) : null;
}

/**
 * Invalidate creator profile cache
 */
async function invalidateCreatorProfile(creatorId) {
  return del(`creator:${creatorId}:profile`);
}

/**
 * Cache analytics data
 */
async function cacheAnalytics(key, data, ttlSeconds = 1800) {
  return set(`analytics:${key}`, JSON.stringify(data), ttlSeconds);
}

/**
 * Get cached analytics
 */
async function getCachedAnalytics(key) {
  const cached = await get(`analytics:${key}`);
  return cached ? JSON.parse(cached) : null;
}

/**
 * Distributed lock (for preventing duplicate operations)
 *
 * Example: Prevent duplicate payout processing
 */
async function acquireLock(lockKey, ttlSeconds = 60) {
  if (!redis) return false;

  try {
    const result = await redis.set(lockKey, '1', {
      ex: ttlSeconds,
      nx: true, // Only set if key doesn't exist
    });

    return result === 'OK';
  } catch (error) {
    console.error('Failed to acquire lock:', error);
    return false;
  }
}

/**
 * Release lock
 */
async function releaseLock(lockKey) {
  return del(lockKey);
}

/**
 * Increment counter (e.g., API rate limiting)
 */
async function increment(key, ttlSeconds = 60) {
  if (!redis) return 0;

  try {
    const count = await redis.incr(key);

    // Set expiry on first increment
    if (count === 1) {
      await redis.expire(key, ttlSeconds);
    }

    return count;
  } catch (error) {
    console.error('Upstash Redis INCR error:', error);
    return 0;
  }
}

/**
 * Store online users (presence)
 */
async function setUserOnline(userId, ttlSeconds = 300) {
  return set(`presence:${userId}`, Date.now(), ttlSeconds);
}

/**
 * Check if user is online
 */
async function isUserOnline(userId) {
  const timestamp = await get(`presence:${userId}`);
  return timestamp !== null;
}

/**
 * Feature flags
 */
async function getFeatureFlag(flagName) {
  const value = await get(`feature:${flagName}`);
  return value === 'true' || value === true;
}

async function setFeatureFlag(flagName, enabled) {
  return set(`feature:${flagName}`, enabled ? 'true' : 'false', 86400); // 24 hours
}

module.exports = {
  redis,
  get,
  set,
  del,
  getOrCompute,
  cacheCreatorProfile,
  getCachedCreatorProfile,
  invalidateCreatorProfile,
  cacheAnalytics,
  getCachedAnalytics,
  acquireLock,
  releaseLock,
  increment,
  setUserOnline,
  isUserOnline,
  getFeatureFlag,
  setFeatureFlag,
};
