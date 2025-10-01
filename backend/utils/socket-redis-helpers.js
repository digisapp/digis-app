/**
 * Socket.io Redis configuration and helpers
 * Provides Redis-backed persistence for Socket.io
 */

const redis = require('redis');
const winston = require('winston');

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/socket-redis.log' })
  ]
});

let redisClient = null;
let isConnected = false;

/**
 * Connect to Redis
 */
const connectRedis = async () => {
  if (redisClient && isConnected) {
    return true;
  }

  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis reconnection limit reached');
            return new Error('Redis reconnection limit reached');
          }
          const delay = Math.min(retries * 100, 3000);
          logger.info(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
          return delay;
        }
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error', { error: err.message });
      isConnected = false;
    });

    redisClient.on('connect', () => {
      logger.info('Redis Client Connected');
      isConnected = true;
    });

    redisClient.on('ready', () => {
      logger.info('Redis Client Ready');
      isConnected = true;
    });

    redisClient.on('end', () => {
      logger.info('Redis Client Disconnected');
      isConnected = false;
    });

    await redisClient.connect();
    return true;
  } catch (error) {
    logger.error('Failed to connect to Redis', { error: error.message });
    isConnected = false;
    
    // Return false but don't throw - allow app to work without Redis
    return false;
  }
};

/**
 * Safe Redis operation wrapper
 */
const safeRedisOp = async (operation, fallback = null) => {
  if (!isConnected) {
    logger.warn('Redis not connected, using fallback');
    return fallback;
  }

  try {
    return await operation();
  } catch (error) {
    logger.error('Redis operation failed', { error: error.message });
    return fallback;
  }
};

/**
 * Socket Redis helper functions
 */
const socketRedisHelpers = {
  /**
   * Get stream viewers
   */
  getStreamViewers: async (streamId) => {
    return safeRedisOp(
      async () => {
        const viewers = await redisClient.sMembers(`stream:${streamId}:viewers`);
        return new Set(viewers);
      },
      new Set()
    );
  },

  /**
   * Set stream viewers
   */
  setStreamViewers: async (streamId, viewers) => {
    return safeRedisOp(async () => {
      const key = `stream:${streamId}:viewers`;
      await redisClient.del(key);
      
      if (viewers.size > 0) {
        await redisClient.sAdd(key, Array.from(viewers));
        await redisClient.expire(key, 3600); // 1 hour TTL
      }
      
      return true;
    }, false);
  },

  /**
   * Add viewer to stream
   */
  addStreamViewer: async (streamId, viewerId) => {
    return safeRedisOp(async () => {
      const key = `stream:${streamId}:viewers`;
      await redisClient.sAdd(key, viewerId);
      await redisClient.expire(key, 3600);
      return true;
    }, false);
  },

  /**
   * Remove viewer from stream
   */
  removeStreamViewer: async (streamId, viewerId) => {
    return safeRedisOp(async () => {
      await redisClient.sRem(`stream:${streamId}:viewers`, viewerId);
      return true;
    }, false);
  },

  /**
   * Set user presence
   */
  setUserPresence: async (userId, data) => {
    return safeRedisOp(async () => {
      const key = `presence:${userId}`;
      await redisClient.setEx(key, 300, JSON.stringify({
        ...data,
        timestamp: Date.now()
      })); // 5 min TTL
      return true;
    }, false);
  },

  /**
   * Get user presence
   */
  getUserPresence: async (userId) => {
    return safeRedisOp(
      async () => {
        const data = await redisClient.get(`presence:${userId}`);
        return data ? JSON.parse(data) : null;
      },
      null
    );
  },

  /**
   * Remove user presence
   */
  removeUserPresence: async (userId) => {
    return safeRedisOp(async () => {
      await redisClient.del(`presence:${userId}`);
      return true;
    }, false);
  },

  /**
   * Map socket ID to user ID
   */
  mapSocketToUser: async (socketId, userId) => {
    return safeRedisOp(async () => {
      await redisClient.setEx(`socket:${socketId}`, 3600, userId); // 1 hour TTL
      return true;
    }, false);
  },

  /**
   * Get user ID from socket ID
   */
  getUserFromSocket: async (socketId) => {
    return safeRedisOp(
      async () => {
        return await redisClient.get(`socket:${socketId}`);
      },
      null
    );
  },

  /**
   * Remove socket mapping
   */
  removeSocketMapping: async (socketId) => {
    return safeRedisOp(async () => {
      await redisClient.del(`socket:${socketId}`);
      return true;
    }, false);
  },

  /**
   * Add user socket
   */
  addUserSocket: async (userId, socketId) => {
    return safeRedisOp(async () => {
      const key = `user_sockets:${userId}`;
      await redisClient.sAdd(key, socketId);
      await redisClient.expire(key, 3600); // 1 hour TTL
      return true;
    }, false);
  },

  /**
   * Remove user socket
   */
  removeUserSocket: async (userId, socketId) => {
    return safeRedisOp(async () => {
      await redisClient.sRem(`user_sockets:${userId}`, socketId);
      return true;
    }, false);
  },

  /**
   * Get user sockets
   */
  getUserSockets: async (userId) => {
    return safeRedisOp(
      async () => {
        const sockets = await redisClient.sMembers(`user_sockets:${userId}`);
        return new Set(sockets);
      },
      new Set()
    );
  },

  /**
   * Remove stream
   */
  removeStream: async (streamId) => {
    return safeRedisOp(async () => {
      const keys = await redisClient.keys(`stream:${streamId}:*`);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      return true;
    }, false);
  },

  /**
   * Set typing indicator
   */
  setTypingIndicator: async (channelId, userId, isTyping) => {
    return safeRedisOp(async () => {
      const key = `typing:${channelId}`;
      
      if (isTyping) {
        await redisClient.sAdd(key, userId);
        await redisClient.expire(key, 10); // 10 seconds TTL
      } else {
        await redisClient.sRem(key, userId);
      }
      
      return true;
    }, false);
  },

  /**
   * Get typing users
   */
  getTypingUsers: async (channelId) => {
    return safeRedisOp(
      async () => {
        const users = await redisClient.sMembers(`typing:${channelId}`);
        return new Set(users);
      },
      new Set()
    );
  },

  /**
   * Store message temporarily (for delivery confirmation)
   */
  storeMessage: async (messageId, data, ttl = 300) => {
    return safeRedisOp(async () => {
      await redisClient.setEx(
        `message:${messageId}`,
        ttl,
        JSON.stringify(data)
      );
      return true;
    }, false);
  },

  /**
   * Get stored message
   */
  getMessage: async (messageId) => {
    return safeRedisOp(
      async () => {
        const data = await redisClient.get(`message:${messageId}`);
        return data ? JSON.parse(data) : null;
      },
      null
    );
  },

  /**
   * Delete stored message
   */
  deleteMessage: async (messageId) => {
    return safeRedisOp(async () => {
      await redisClient.del(`message:${messageId}`);
      return true;
    }, false);
  },

  /**
   * Increment stream metric
   */
  incrementStreamMetric: async (streamId, metric) => {
    return safeRedisOp(async () => {
      const key = `stream:${streamId}:metrics:${metric}`;
      await redisClient.incr(key);
      await redisClient.expire(key, 86400); // 24 hour TTL
      return true;
    }, false);
  },

  /**
   * Get stream metrics
   */
  getStreamMetrics: async (streamId) => {
    return safeRedisOp(
      async () => {
        const keys = await redisClient.keys(`stream:${streamId}:metrics:*`);
        const metrics = {};
        
        for (const key of keys) {
          const metric = key.split(':').pop();
          const value = await redisClient.get(key);
          metrics[metric] = parseInt(value) || 0;
        }
        
        return metrics;
      },
      {}
    );
  },

  /**
   * Set room data
   */
  setRoomData: async (roomId, data, ttl = 3600) => {
    return safeRedisOp(async () => {
      await redisClient.setEx(
        `room:${roomId}`,
        ttl,
        JSON.stringify(data)
      );
      return true;
    }, false);
  },

  /**
   * Get room data
   */
  getRoomData: async (roomId) => {
    return safeRedisOp(
      async () => {
        const data = await redisClient.get(`room:${roomId}`);
        return data ? JSON.parse(data) : null;
      },
      null
    );
  },

  /**
   * Clean up expired data
   */
  cleanup: async () => {
    return safeRedisOp(async () => {
      // This would be called periodically to clean up expired data
      // Redis handles expiration automatically, but this can be used
      // for additional cleanup logic if needed
      
      logger.info('Running Redis cleanup');
      return true;
    }, false);
  }
};

// Export
module.exports = {
  connectRedis,
  socketRedisHelpers,
  isConnected: () => isConnected,
  getClient: () => redisClient
};