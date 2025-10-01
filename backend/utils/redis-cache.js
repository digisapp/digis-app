/**
 * Redis caching utility with smart invalidation
 * @module utils/redis-cache
 */

const Redis = require('ioredis');
const crypto = require('crypto');

class RedisCache {
  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3
    });

    this.defaultTTL = 300; // 5 minutes
    this.isConnected = false;

    this.client.on('connect', () => {
      this.isConnected = true;
      console.log('✅ Redis connected');
    });

    this.client.on('error', (err) => {
      console.error('Redis error:', err);
      this.isConnected = false;
    });
  }

  /**
   * Generate cache key with namespace
   */
  generateKey(namespace, identifier) {
    const hash = crypto.createHash('md5').update(JSON.stringify(identifier)).digest('hex');
    return `digis:${namespace}:${hash}`;
  }

  /**
   * Get cached data with fallback
   */
  async get(key, fallbackFn = null) {
    try {
      if (!this.isConnected) {
        return fallbackFn ? await fallbackFn() : null;
      }

      const cached = await this.client.get(key);
      if (cached) {
        return JSON.parse(cached);
      }

      if (fallbackFn) {
        const data = await fallbackFn();
        await this.set(key, data);
        return data;
      }

      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return fallbackFn ? await fallbackFn() : null;
    }
  }

  /**
   * Set cache with TTL
   */
  async set(key, value, ttl = this.defaultTTL) {
    try {
      if (!this.isConnected) return false;
      
      await this.client.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern) {
    try {
      if (!this.isConnected) return;
      
      const keys = await this.client.keys(`digis:${pattern}:*`);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  /**
   * Cache middleware for Express routes
   */
  middleware(namespace, ttl = 300) {
    return async (req, res, next) => {
      // Skip caching for non-GET requests
      if (req.method !== 'GET') {
        return next();
      }

      const key = this.generateKey(namespace, {
        url: req.originalUrl,
        userId: req.user?.id
      });

      const cached = await this.get(key);
      if (cached) {
        return res.json(cached);
      }

      // Store original json method
      const originalJson = res.json.bind(res);
      
      // Override json method to cache response
      res.json = (data) => {
        this.set(key, data, ttl);
        return originalJson(data);
      };

      next();
    };
  }

  /**
   * Clear all cache
   */
  async flush() {
    try {
      if (!this.isConnected) return;
      await this.client.flushdb();
    } catch (error) {
      console.error('Cache flush error:', error);
    }
  }
}

// Singleton instance
const cache = new RedisCache();

// Cache strategies for different data types
const CacheStrategies = {
  // User profiles - cache for 10 minutes
  USER_PROFILE: {
    namespace: 'user',
    ttl: 600,
    invalidateOn: ['profile_update', 'avatar_change']
  },
  
  // Creator listings - cache for 5 minutes
  CREATOR_LIST: {
    namespace: 'creators',
    ttl: 300,
    invalidateOn: ['creator_signup', 'creator_update']
  },
  
  // Session data - cache for 2 minutes
  SESSION_DATA: {
    namespace: 'session',
    ttl: 120,
    invalidateOn: ['session_start', 'session_end']
  },
  
  // Token balances - cache for 30 seconds
  TOKEN_BALANCE: {
    namespace: 'tokens',
    ttl: 30,
    invalidateOn: ['token_purchase', 'token_spend']
  },
  
  // Analytics - cache for 15 minutes
  ANALYTICS: {
    namespace: 'analytics',
    ttl: 900,
    invalidateOn: ['manual_refresh']
  }
};

module.exports = {
  cache,
  CacheStrategies
};