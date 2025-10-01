const { Redis } = require('@upstash/redis');
require('dotenv').config();

// Initialize Upstash Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Cache key prefixes
const CACHE_PREFIXES = {
  USER: 'user:',
  SESSION: 'session:',
  TOKEN: 'token:',
  CREATOR: 'creator:',
  STREAM: 'stream:',
  RATE_LIMIT: 'rate:',
  EMAIL: 'email:',
  OTP: 'otp:',
  TEMP: 'temp:'
};

// Cache TTL values (in seconds)
const TTL = {
  SHORT: 300,      // 5 minutes
  MEDIUM: 1800,    // 30 minutes
  LONG: 3600,      // 1 hour
  DAY: 86400,      // 24 hours
  WEEK: 604800     // 7 days
};

// Helper functions
const cache = {
  // Set a value with optional TTL
  async set(key, value, ttl = TTL.MEDIUM) {
    try {
      const data = typeof value === 'string' ? value : JSON.stringify(value);
      if (ttl) {
        await redis.setex(key, ttl, data);
      } else {
        await redis.set(key, data);
      }
      return true;
    } catch (error) {
      console.error('Redis SET error:', error);
      return false;
    }
  },

  // Get a value
  async get(key) {
    try {
      const data = await redis.get(key);
      if (!data) return null;

      // Try to parse as JSON, otherwise return as string
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    } catch (error) {
      console.error('Redis GET error:', error);
      return null;
    }
  },

  // Delete a key
  async del(key) {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      console.error('Redis DEL error:', error);
      return false;
    }
  },

  // Check if key exists
  async exists(key) {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis EXISTS error:', error);
      return false;
    }
  },

  // Set key expiration
  async expire(key, seconds) {
    try {
      await redis.expire(key, seconds);
      return true;
    } catch (error) {
      console.error('Redis EXPIRE error:', error);
      return false;
    }
  },

  // Increment a counter
  async incr(key) {
    try {
      return await redis.incr(key);
    } catch (error) {
      console.error('Redis INCR error:', error);
      return null;
    }
  },

  // Get multiple keys at once
  async mget(keys) {
    try {
      const results = await redis.mget(...keys);
      return results.map(data => {
        if (!data) return null;
        try {
          return JSON.parse(data);
        } catch {
          return data;
        }
      });
    } catch (error) {
      console.error('Redis MGET error:', error);
      return keys.map(() => null);
    }
  },

  // Delete keys by pattern
  async delPattern(pattern) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      return keys.length;
    } catch (error) {
      console.error('Redis DEL pattern error:', error);
      return 0;
    }
  }
};

// Session management
const sessions = {
  // Store session data
  async store(sessionId, data, ttl = TTL.DAY) {
    const key = `${CACHE_PREFIXES.SESSION}${sessionId}`;
    return await cache.set(key, data, ttl);
  },

  // Retrieve session data
  async get(sessionId) {
    const key = `${CACHE_PREFIXES.SESSION}${sessionId}`;
    return await cache.get(key);
  },

  // Delete session
  async destroy(sessionId) {
    const key = `${CACHE_PREFIXES.SESSION}${sessionId}`;
    return await cache.del(key);
  },

  // Refresh session TTL
  async refresh(sessionId, ttl = TTL.DAY) {
    const key = `${CACHE_PREFIXES.SESSION}${sessionId}`;
    return await cache.expire(key, ttl);
  }
};

// User cache
const users = {
  // Cache user data
  async cache(userId, userData, ttl = TTL.LONG) {
    const key = `${CACHE_PREFIXES.USER}${userId}`;
    return await cache.set(key, userData, ttl);
  },

  // Get cached user
  async get(userId) {
    const key = `${CACHE_PREFIXES.USER}${userId}`;
    return await cache.get(key);
  },

  // Invalidate user cache
  async invalidate(userId) {
    const key = `${CACHE_PREFIXES.USER}${userId}`;
    return await cache.del(key);
  }
};

// Creator cache
const creators = {
  // Cache creator profile
  async cache(creatorId, data, ttl = TTL.MEDIUM) {
    const key = `${CACHE_PREFIXES.CREATOR}${creatorId}`;
    return await cache.set(key, data, ttl);
  },

  // Get cached creator
  async get(creatorId) {
    const key = `${CACHE_PREFIXES.CREATOR}${creatorId}`;
    return await cache.get(key);
  },

  // Cache creator list
  async cacheList(data, ttl = TTL.SHORT) {
    const key = `${CACHE_PREFIXES.CREATOR}list`;
    return await cache.set(key, data, ttl);
  },

  // Get cached creator list
  async getList() {
    const key = `${CACHE_PREFIXES.CREATOR}list`;
    return await cache.get(key);
  },

  // Invalidate creator cache
  async invalidate(creatorId) {
    const key = `${CACHE_PREFIXES.CREATOR}${creatorId}`;
    await cache.del(key);
    // Also invalidate the list
    await cache.del(`${CACHE_PREFIXES.CREATOR}list`);
    return true;
  }
};

// Stream cache for active streams
const streams = {
  // Cache active stream
  async setActive(streamId, data, ttl = TTL.LONG) {
    const key = `${CACHE_PREFIXES.STREAM}active:${streamId}`;
    return await cache.set(key, data, ttl);
  },

  // Get active stream
  async getActive(streamId) {
    const key = `${CACHE_PREFIXES.STREAM}active:${streamId}`;
    return await cache.get(key);
  },

  // Remove active stream
  async removeActive(streamId) {
    const key = `${CACHE_PREFIXES.STREAM}active:${streamId}`;
    return await cache.del(key);
  },

  // Get all active streams
  async getAllActive() {
    try {
      const keys = await redis.keys(`${CACHE_PREFIXES.STREAM}active:*`);
      if (keys.length === 0) return [];

      const streams = await cache.mget(keys);
      return streams.filter(s => s !== null);
    } catch (error) {
      console.error('Error getting active streams:', error);
      return [];
    }
  }
};

// Rate limiting
const rateLimiter = {
  // Check rate limit
  async check(identifier, limit = 10, window = 60) {
    const key = `${CACHE_PREFIXES.RATE_LIMIT}${identifier}`;

    try {
      const current = await redis.incr(key);

      if (current === 1) {
        await redis.expire(key, window);
      }

      return {
        allowed: current <= limit,
        remaining: Math.max(0, limit - current),
        reset: window
      };
    } catch (error) {
      console.error('Rate limiter error:', error);
      return { allowed: true, remaining: limit, reset: window };
    }
  },

  // Reset rate limit
  async reset(identifier) {
    const key = `${CACHE_PREFIXES.RATE_LIMIT}${identifier}`;
    return await cache.del(key);
  }
};

// OTP/verification codes
const otp = {
  // Store OTP
  async store(identifier, code, ttl = TTL.SHORT) {
    const key = `${CACHE_PREFIXES.OTP}${identifier}`;
    return await cache.set(key, code, ttl);
  },

  // Verify OTP
  async verify(identifier, code) {
    const key = `${CACHE_PREFIXES.OTP}${identifier}`;
    const stored = await cache.get(key);

    if (stored === code) {
      await cache.del(key); // Delete after successful verification
      return true;
    }
    return false;
  },

  // Get OTP (for testing)
  async get(identifier) {
    const key = `${CACHE_PREFIXES.OTP}${identifier}`;
    return await cache.get(key);
  }
};

// Test connection
async function testConnection() {
  try {
    await redis.ping();
    console.log('✅ Upstash Redis connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Upstash Redis connection failed:', error);
    return false;
  }
}

module.exports = {
  redis,
  cache,
  sessions,
  users,
  creators,
  streams,
  rateLimiter,
  otp,
  testConnection,
  CACHE_PREFIXES,
  TTL
};