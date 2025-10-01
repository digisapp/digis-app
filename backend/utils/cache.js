const redis = require('redis');
const { logger } = require('./secureLogger');

// Create Redis client
const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    connectTimeout: 10000,
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Redis: Max reconnection attempts reached');
        return new Error('Max reconnection attempts reached');
      }
      const delay = Math.min(retries * 50, 500);
      logger.info(`Redis: Reconnecting in ${delay}ms (attempt ${retries})`);
      return delay;
    }
  }
});

// Error handling
client.on('error', (err) => {
  logger.error('Redis Client Error:', err);
});

client.on('connect', () => {
  logger.info('Redis: Connected successfully');
});

client.on('ready', () => {
  logger.info('Redis: Ready to accept commands');
});

client.on('reconnecting', () => {
  logger.warn('Redis: Reconnecting...');
});

// Connect to Redis
(async () => {
  try {
    await client.connect();
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
  }
})();

// Cache utilities
const cache = {
  // Get value from cache
  get: async (key) => {
    try {
      const value = await client.get(key);
      if (value) {
        logger.debug('Cache hit:', { key }); // Changed to debug to reduce noise
        return JSON.parse(value);
      }
      logger.debug('Cache miss:', { key }); // Changed to debug to reduce noise
      return null;
    } catch (error) {
      logger.error('Cache get error:', { key, error: error.message });
      return null;
    }
  },

  // Set value in cache with TTL
  set: async (key, value, ttl = 3600) => {
    try {
      const serialized = JSON.stringify(value);
      await client.setEx(key, ttl, serialized);
      logger.debug('Cache set:', { key, ttl }); // Changed to debug to reduce noise
      return true;
    } catch (error) {
      logger.error('Cache set error:', { key, error: error.message });
      return false;
    }
  },

  // Delete value from cache
  del: async (key) => {
    try {
      await client.del(key);
      logger.info('Cache delete:', { key });
      return true;
    } catch (error) {
      logger.error('Cache delete error:', { key, error: error.message });
      return false;
    }
  },

  // Delete multiple keys by pattern using SCAN (Redis-safe)
  delPattern: async (pattern) => {
    try {
      let cursor = 0;
      let deletedCount = 0;
      const batchSize = 500;
      let batch = [];

      // Use SCAN instead of KEYS to avoid blocking Redis
      do {
        const result = await client.scan(cursor, {
          MATCH: pattern,
          COUNT: batchSize
        });

        cursor = result.cursor;
        const keys = result.keys;

        if (keys && keys.length > 0) {
          batch.push(...keys);

          // Delete in batches
          if (batch.length >= batchSize) {
            await client.del(batch);
            deletedCount += batch.length;
            batch = [];
          }
        }
      } while (cursor !== 0);

      // Delete remaining keys
      if (batch.length > 0) {
        await client.del(batch);
        deletedCount += batch.length;
      }

      if (deletedCount > 0) {
        logger.info('Cache pattern delete (SCAN):', { pattern, deletedCount });
      }
      return true;
    } catch (error) {
      logger.error('Cache pattern delete error:', { pattern, error: error.message });
      return false;
    }
  },

  // Check if key exists
  exists: async (key) => {
    try {
      const exists = await client.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error('Cache exists error:', { key, error: error.message });
      return false;
    }
  },

  // Get remaining TTL
  ttl: async (key) => {
    try {
      const ttl = await client.ttl(key);
      return ttl;
    } catch (error) {
      logger.error('Cache TTL error:', { key, error: error.message });
      return -1;
    }
  },

  // Cache wrapper for functions
  wrap: (fn, keyGenerator, ttl = 3600) => {
    return async (...args) => {
      const key = typeof keyGenerator === 'function' ? keyGenerator(...args) : keyGenerator;
      
      // Try cache first
      const cached = await cache.get(key);
      if (cached !== null) {
        return cached;
      }
      
      // Execute function
      const result = await fn(...args);
      
      // Cache result if not null/undefined
      if (result !== null && result !== undefined) {
        await cache.set(key, result, ttl);
      }
      
      return result;
    };
  },

  // Batch operations
  mget: async (keys) => {
    try {
      const values = await client.mGet(keys);
      return values.map(v => v ? JSON.parse(v) : null);
    } catch (error) {
      logger.error('Cache mget error:', { keys, error: error.message });
      return keys.map(() => null);
    }
  },

  mset: async (keyValues, ttl = 3600) => {
    try {
      const pipeline = client.multi();
      Object.entries(keyValues).forEach(([key, value]) => {
        pipeline.setEx(key, ttl, JSON.stringify(value));
      });
      await pipeline.exec();
      logger.info('Cache mset:', { count: Object.keys(keyValues).length, ttl });
      return true;
    } catch (error) {
      logger.error('Cache mset error:', { error: error.message });
      return false;
    }
  },

  // Increment/decrement operations
  incr: async (key, amount = 1) => {
    try {
      const result = await client.incrBy(key, amount);
      return result;
    } catch (error) {
      logger.error('Cache incr error:', { key, error: error.message });
      return null;
    }
  },

  decr: async (key, amount = 1) => {
    try {
      const result = await client.decrBy(key, amount);
      return result;
    } catch (error) {
      logger.error('Cache decr error:', { key, error: error.message });
      return null;
    }
  }
};

// Cache key generators
// Cache key generators - use supabase_id consistently
const cacheKeys = {
  user: (supabaseId) => `user:${supabaseId}`,
  userProfile: (supabaseId) => `user:profile:${supabaseId}`,
  userTokens: (supabaseId) => `user:tokens:${supabaseId}`,
  creatorProfile: (supabaseId) => `creator:profile:${supabaseId}`,
  creatorStats: (supabaseId) => `creator:stats:${supabaseId}`,
  session: (sessionId) => `session:${sessionId}`,
  agoraToken: (channel, uid, role) => `agora:token:${channel}:${uid}:${role}`,
  tokenBalance: (supabaseId) => `tokens:balance:${supabaseId}`,
  payments: (supabaseId) => `payments:${supabaseId}`,
  messages: (conversationId) => `messages:${conversationId}`,
  onlineUsers: () => 'online:users',
  creatorList: (category) => `creators:list:${category || 'all'}`,
  searchResults: (query) => `search:${query}`
};

// TTL constants (in seconds)
const TTL = {
  SHORT: 300,      // 5 minutes
  MEDIUM: 1800,    // 30 minutes
  LONG: 3600,      // 1 hour
  VERY_LONG: 86400 // 24 hours
};

// Export cache utilities
module.exports = {
  cache,
  cacheKeys,
  TTL,
  client
};