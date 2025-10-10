const express = require('express');
const router = express.Router();

/**
 * EMERGENCY: Reset rate limits for debugging
 * This endpoint has NO rate limiting and NO auth
 * Use only for emergency debugging
 */
router.post('/emergency/reset-rate-limits', async (req, res) => {
  try {
    const { userId, ip } = req.body;

    console.log('🚨 EMERGENCY: Rate limit reset requested', {
      userId,
      ip,
      requestIp: req.ip,
      timestamp: new Date().toISOString()
    });

    // Try to clear Redis if available
    try {
      const redis = require('../utils/redis');
      if (redis && redis.default) {
        // Clear all rate limit keys for this user/IP
        const keys = await redis.default.keys('rl:*');
        console.log(`Found ${keys.length} rate limit keys in Redis`);

        let cleared = 0;
        for (const key of keys) {
          if (userId && key.includes(userId)) {
            await redis.default.del(key);
            cleared++;
          } else if (ip && key.includes(ip)) {
            await redis.default.del(key);
            cleared++;
          } else if (req.ip && key.includes(req.ip)) {
            await redis.default.del(key);
            cleared++;
          }
        }

        console.log(`✅ Cleared ${cleared} rate limit keys from Redis`);

        return res.json({
          success: true,
          message: 'Rate limits reset successfully',
          keysCleared: cleared,
          timestamp: new Date().toISOString()
        });
      }
    } catch (redisError) {
      console.error('Redis error:', redisError.message);
      // Continue even if Redis fails
    }

    // If no Redis, just return success (memory store will reset on restart)
    return res.json({
      success: true,
      message: 'Rate limits will reset automatically (using memory store)',
      note: 'Redis not configured - limits stored in memory',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Emergency reset error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * EMERGENCY: Check current rate limit status
 */
router.get('/emergency/rate-limit-status', async (req, res) => {
  try {
    console.log('🔍 Rate limit status check', {
      ip: req.ip,
      headers: req.headers,
      timestamp: new Date().toISOString()
    });

    const status = {
      timestamp: new Date().toISOString(),
      requestIp: req.ip,
      environment: process.env.NODE_ENV,
      redisConfigured: !!process.env.REDIS_URL,
      rateLimiting: 'DISABLED for auth endpoints in latest deployment'
    };

    // Try to get Redis info
    try {
      const redis = require('../utils/redis');
      if (redis && redis.default) {
        const keys = await redis.default.keys('rl:*');
        status.redisKeys = keys.length;
        status.redisConnected = true;
      } else {
        status.redisConnected = false;
        status.store = 'memory (in-process)';
      }
    } catch (redisError) {
      status.redisError = redisError.message;
      status.redisConnected = false;
    }

    return res.json(status);

  } catch (error) {
    console.error('❌ Status check error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
