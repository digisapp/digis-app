const rateLimit = require('express-rate-limit');
const { logger } = require('../utils/secureLogger');

/**
 * Create rate limiter with Redis store for distributed rate limiting
 * Falls back to memory store if Redis is not available
 */
const createRedisLimiter = (options) => {
  let store = undefined;

  try {
    const RedisStore = require('rate-limit-redis').default;
    const redis = require('../utils/redis');

    if (redis && redis.sendCommand) {
      store = new RedisStore({
        client: redis,
        prefix: 'rl:',
        sendCommand: (...args) => redis.sendCommand(args),
      });
      logger.info('Using Redis store for rate limiting');
    } else {
      logger.info('Redis client not properly configured, using memory store');
    }
  } catch (error) {
    logger.warn('Redis not available for rate limiting, using memory store', { error: error.message });
  }

  return rateLimit({
    store, // Will use default memory store if undefined
    ...options
  });
};

/**
 * Strict rate limiter for money operations (purchases, withdrawals)
 */
const moneyOperationsLimiter = createRedisLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many financial operations. Please wait before trying again.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID for rate limiting
    if (req.user?.supabase_id || req.user?.uid) {
      return req.user?.supabase_id || req.user?.uid;
    }
    // Use the built-in IP key generator for IPv6 support
    return req.ip;
  },
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded for financial operation', {
      userId: req.user?.supabase_id,
      path: req.path,
      ip: req.ip
    });
    res.status(429).json({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many financial operations. Please wait before trying again.',
      retryAfter: 60
    });
  }
});

/**
 * Token purchase specific limiter (stricter)
 */
const tokenPurchaseLimiter = createRedisLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // 5 purchases per 5 minutes
  skipSuccessfulRequests: false, // Count all requests
  message: {
    success: false,
    code: 'PURCHASE_RATE_LIMIT',
    message: 'Too many purchase attempts. Please wait 5 minutes.',
    retryAfter: 300
  }
});

/**
 * Withdrawal rate limiter (very strict)
 */
const withdrawalLimiter = createRedisLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 withdrawals per hour
  skipSuccessfulRequests: false,
  message: {
    success: false,
    code: 'WITHDRAWAL_RATE_LIMIT',
    message: 'Withdrawal limit reached. Try again in an hour.',
    retryAfter: 3600
  }
});

/**
 * Progressive rate limiter based on user trust level
 */
const progressiveRateLimiter = (trustLevels = {}) => {
  return async (req, res, next) => {
    const userId = req.user?.supabase_id || req.user?.uid;

    if (!userId) {
      // Strictest limits for unauthenticated users
      return moneyOperationsLimiter(req, res, next);
    }

    try {
      // Check user trust level (could be based on account age, verification status, etc.)
      const userTrustKey = `trust:${userId}`;
      const trustLevel = await redis.get(userTrustKey) || 'basic';

      const limits = {
        basic: { windowMs: 60000, max: 5 },
        verified: { windowMs: 60000, max: 15 },
        trusted: { windowMs: 60000, max: 30 },
        vip: { windowMs: 60000, max: 50 },
        ...trustLevels
      };

      const userLimit = limits[trustLevel] || limits.basic;

      const limiter = createRedisLimiter({
        windowMs: userLimit.windowMs,
        max: userLimit.max,
        keyGenerator: () => userId,
        message: {
          success: false,
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded (${trustLevel} tier)`,
          trustLevel,
          limit: userLimit.max
        }
      });

      return limiter(req, res, next);
    } catch (error) {
      logger.error('Progressive rate limiter error', { error: error.message });
      // Fall back to basic limiter on error
      return moneyOperationsLimiter(req, res, next);
    }
  };
};

/**
 * Burst protection for rapid-fire requests
 */
const burstProtection = createRedisLimiter({
  windowMs: 1000, // 1 second
  max: 2, // 2 requests per second max
  message: {
    success: false,
    code: 'BURST_LIMIT',
    message: 'Too many requests in a short period. Please slow down.',
    retryAfter: 1
  }
});

/**
 * Daily spending limit checker (not a rate limiter, but a spending guard)
 */
const dailySpendingLimit = (limitInCents = 50000) => {
  return async (req, res, next) => {
    const userId = req.user?.supabase_id || req.user?.uid;

    if (!userId) {
      return res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        message: 'Authentication required for financial operations'
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const spendingKey = `spending:${userId}:${today}`;

    try {
      // Get current spending
      const currentSpending = parseInt(await redis.get(spendingKey) || '0');
      const requestAmount = parseInt(req.body.amountInCents || 0);

      if (currentSpending + requestAmount > limitInCents) {
        logger.warn('Daily spending limit exceeded', {
          userId,
          currentSpending,
          requestAmount,
          limit: limitInCents
        });

        return res.status(429).json({
          success: false,
          code: 'DAILY_LIMIT_EXCEEDED',
          message: 'Daily spending limit reached',
          limit: limitInCents,
          spent: currentSpending,
          resetAt: new Date(new Date().setDate(new Date().getDate() + 1)).setHours(0, 0, 0, 0)
        });
      }

      // Update spending on successful request
      res.on('finish', async () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          await redis.incrby(spendingKey, requestAmount);
          await redis.expire(spendingKey, 86400); // Expire after 24 hours
        }
      });

      next();
    } catch (error) {
      logger.error('Daily spending limit check failed', { error: error.message });
      next(); // Continue on error (fail open for availability)
    }
  };
};

/**
 * Webhook rate limiter (for external services)
 */
const webhookRateLimiter = createRedisLimiter({
  windowMs: 1000, // 1 second
  max: 10, // 10 webhooks per second
  keyGenerator: (req) => {
    // Rate limit by source IP for webhooks
    return req.ip || req.connection.remoteAddress;
  },
  skip: (req) => {
    // Skip rate limiting for verified webhook sources
    const trustedIPs = process.env.TRUSTED_WEBHOOK_IPS?.split(',') || [];
    return trustedIPs.includes(req.ip);
  }
});

/**
 * Combine multiple rate limiters
 */
const combineRateLimiters = (...limiters) => {
  return async (req, res, next) => {
    let currentIndex = 0;

    const runNext = async () => {
      if (currentIndex >= limiters.length) {
        return next();
      }

      const limiter = limiters[currentIndex++];
      limiter(req, res, runNext);
    };

    await runNext();
  };
};

/**
 * Financial endpoint protection combining multiple strategies
 */
const financialEndpointProtection = combineRateLimiters(
  burstProtection,
  moneyOperationsLimiter
);

module.exports = {
  moneyOperationsLimiter,
  tokenPurchaseLimiter,
  withdrawalLimiter,
  progressiveRateLimiter,
  burstProtection,
  dailySpendingLimit,
  webhookRateLimiter,
  combineRateLimiters,
  financialEndpointProtection,
  createRedisLimiter
};