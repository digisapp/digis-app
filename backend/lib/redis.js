/**
 * Upstash Redis Client - Best Practices Implementation
 * Following serverless/edge patterns for Vercel deployment
 */

const { Redis } = require('@upstash/redis');

// Initialize Redis client with REST API
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Key prefixes for organization
const KEY_PREFIXES = {
  RATE_LIMIT: 'rl:',
  TOKEN_VERSION: 'tokver:',
  USER_CACHE: 'user:',
  CREATOR_CACHE: 'creator:',
  STRIPE_EVENT: 'stripe_evt:',
  LIVE_STREAM: 'live:',
  OTP: 'otp:',
  TEMP: 'tmp:'
};

// TTL constants (in seconds)
const TTL = {
  VERY_SHORT: 60,     // 1 minute
  SHORT: 300,         // 5 minutes
  MEDIUM: 1800,       // 30 minutes
  LONG: 3600,         // 1 hour
  DAY: 86400,         // 24 hours
};

/**
 * Health check
 */
async function ping() {
  try {
    await redis.ping();
    return true;
  } catch (error) {
    console.error('Redis ping failed:', error);
    return false;
  }
}

/**
 * Rate limiting with fixed window
 */
async function rateLimit({ key, limit, windowSec }) {
  const bucket = `${KEY_PREFIXES.RATE_LIMIT}${key}`;

  // Atomic increment
  const count = await redis.incr(bucket);

  // Set TTL on first hit
  if (count === 1) {
    await redis.expire(bucket, windowSec);
  }

  const remaining = Math.max(limit - count, 0);
  const ok = count <= limit;

  return {
    ok,
    remaining,
    count,
    retryAfter: windowSec
  };
}

/**
 * Token versioning for JWT revocation
 */
async function getTokenVersion(userId) {
  const key = `${KEY_PREFIXES.TOKEN_VERSION}${userId}`;

  // Try cache first
  const cached = await redis.get(key);
  if (cached !== null) return parseInt(cached);

  // In a real app, fetch from database here
  // For now, return 0 as default
  const version = 0;

  // Cache with 1 hour TTL
  await redis.set(key, version, { ex: TTL.LONG });

  return version;
}

/**
 * Increment token version (force logout)
 */
async function incrementTokenVersion(userId) {
  const key = `${KEY_PREFIXES.TOKEN_VERSION}${userId}`;

  // Get current version
  const current = await getTokenVersion(userId);
  const newVersion = current + 1;

  // Update cache immediately
  await redis.set(key, newVersion, { ex: TTL.LONG });

  // In a real app, also update database here

  return newVersion;
}

/**
 * Check Stripe webhook idempotency
 */
async function isStripeEventDuplicate(eventId) {
  const key = `${KEY_PREFIXES.STRIPE_EVENT}${eventId}`;

  // SET NX (only if not exists) with 24 hour TTL
  const result = await redis.set(key, '1', {
    nx: true,  // Only set if not exists
    ex: TTL.DAY
  });

  // Returns null if key already existed (duplicate)
  return result === null;
}

/**
 * User profile caching with smart TTL
 */
async function cacheUser(userId, userData) {
  const key = `${KEY_PREFIXES.USER_CACHE}${userId}`;

  // Add cache metadata
  const dataWithMeta = {
    ...userData,
    _cachedAt: Date.now(),
    _cacheVersion: userData.updated_at || Date.now()
  };

  // Cache for 5 minutes
  await redis.set(key, JSON.stringify(dataWithMeta), { ex: TTL.SHORT });
}

/**
 * Get cached user
 */
async function getCachedUser(userId) {
  const key = `${KEY_PREFIXES.USER_CACHE}${userId}`;
  const cached = await redis.get(key);

  if (!cached) return null;

  try {
    return JSON.parse(cached);
  } catch {
    return cached;
  }
}

/**
 * Invalidate user cache
 */
async function invalidateUserCache(userId) {
  const key = `${KEY_PREFIXES.USER_CACHE}${userId}`;
  await redis.del(key);

  // Also invalidate creator cache if applicable
  const creatorKey = `${KEY_PREFIXES.CREATOR_CACHE}${userId}`;
  await redis.del(creatorKey);
}

/**
 * Live stream tracking
 */
async function setLiveStream(streamId, data) {
  const key = `${KEY_PREFIXES.LIVE_STREAM}${streamId}`;

  // Store with 2 hour TTL (streams shouldn't last longer)
  await redis.set(key, JSON.stringify(data), { ex: TTL.LONG * 2 });
}

/**
 * Get all live streams (pattern matching)
 */
async function getAllLiveStreams() {
  // Note: KEYS command is not available in Upstash REST API
  // You should maintain a separate list/set for this
  const listKey = `${KEY_PREFIXES.LIVE_STREAM}active_list`;
  const streamIds = await redis.smembers(listKey);

  if (!streamIds || streamIds.length === 0) return [];

  const streams = [];
  for (const id of streamIds) {
    const data = await redis.get(`${KEY_PREFIXES.LIVE_STREAM}${id}`);
    if (data) {
      try {
        streams.push(JSON.parse(data));
      } catch {
        streams.push(data);
      }
    }
  }

  return streams;
}

/**
 * Add stream to active list
 */
async function addToLiveStreams(streamId) {
  const listKey = `${KEY_PREFIXES.LIVE_STREAM}active_list`;
  await redis.sadd(listKey, streamId);

  // Expire the list after 24 hours (cleanup)
  await redis.expire(listKey, TTL.DAY);
}

/**
 * Remove stream from active list
 */
async function removeFromLiveStreams(streamId) {
  const listKey = `${KEY_PREFIXES.LIVE_STREAM}active_list`;
  await redis.srem(listKey, streamId);

  // Also delete the stream data
  await redis.del(`${KEY_PREFIXES.LIVE_STREAM}${streamId}`);
}

/**
 * OTP storage with auto-expiry
 */
async function storeOTP(identifier, code, ttlSeconds = 300) {
  const key = `${KEY_PREFIXES.OTP}${identifier}`;
  await redis.set(key, code, { ex: ttlSeconds });
}

/**
 * Verify and consume OTP
 */
async function verifyOTP(identifier, code) {
  const key = `${KEY_PREFIXES.OTP}${identifier}`;
  const stored = await redis.get(key);

  // Convert both to strings for comparison (in case of type mismatch)
  if (stored && String(stored) === String(code)) {
    // Delete after successful verification
    await redis.del(key);
    return true;
  }

  return false;
}

/**
 * Pipeline operations for atomic multi-operations
 */
async function pipeline(operations) {
  const pipe = redis.pipeline();

  for (const op of operations) {
    pipe[op.method](...op.args);
  }

  return await pipe.exec();
}

module.exports = {
  redis,
  ping,
  rateLimit,
  getTokenVersion,
  incrementTokenVersion,
  isStripeEventDuplicate,
  cacheUser,
  getCachedUser,
  invalidateUserCache,
  setLiveStream,
  getAllLiveStreams,
  addToLiveStreams,
  removeFromLiveStreams,
  storeOTP,
  verifyOTP,
  pipeline,
  KEY_PREFIXES,
  TTL
};