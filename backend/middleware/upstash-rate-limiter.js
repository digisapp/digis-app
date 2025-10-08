/**
 * Upstash Rate Limiter for Serverless
 *
 * Replaces rate-limiter-flexible (which requires persistent connections)
 * with Upstash Ratelimit (serverless-compatible REST API)
 *
 * Migration guide:
 * - OLD: Uses ioredis/Redis with persistent connections
 * - NEW: Uses Upstash REST API (stateless, serverless-compatible)
 */

const { Ratelimit } = require('@upstash/ratelimit');
const { Redis } = require('@upstash/redis');
const { logger } = require('../utils/secureLogger');

// Initialize Upstash Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

/**
 * Create Upstash rate limiters for different endpoints
 */
const rateLimiters = {
  /**
   * Auth endpoints - strict limiting
   * 5 requests per 15 minutes per IP
   */
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '15 m'),
    analytics: true,
    prefix: 'ratelimit:auth',
  }),

  /**
   * Payment endpoints - very strict
   * 10 requests per minute per user
   */
  payment: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    analytics: true,
    prefix: 'ratelimit:payment',
  }),

  /**
   * Token purchase - strict
   * 20 requests per hour per user
   */
  tokenPurchase: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    analytics: true,
    prefix: 'ratelimit:token',
  }),

  /**
   * Streaming endpoints - moderate
   * 100 requests per minute per user
   */
  streaming: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    analytics: true,
    prefix: 'ratelimit:streaming',
  }),

  /**
   * Upload endpoints - moderate
   * 30 requests per hour per user
   */
  upload: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 h'),
    analytics: true,
    prefix: 'ratelimit:upload',
  }),

  /**
   * Analytics endpoints - lenient
   * 200 requests per minute per user
   */
  analytics: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(200, '1 m'),
    analytics: true,
    prefix: 'ratelimit:analytics',
  }),

  /**
   * General API endpoints - lenient
   * 300 requests per minute per user/IP
   */
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(300, '1 m'),
    analytics: true,
    prefix: 'ratelimit:api',
  }),

  /**
   * Public endpoints - very lenient
   * 1000 requests per minute per IP
   */
  public: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1000, '1 m'),
    analytics: true,
    prefix: 'ratelimit:public',
  }),
};

/**
 * Express middleware factory for rate limiting
 *
 * @param {string} limiterType - Type of rate limiter ('auth', 'payment', etc.)
 * @param {function} identifierFn - Function to extract identifier from request (default: IP)
 * @returns {function} Express middleware
 */
function createRateLimitMiddleware(limiterType = 'api', identifierFn = null) {
  const limiter = rateLimiters[limiterType];

  if (!limiter) {
    logger.error(`Invalid rate limiter type: ${limiterType}`);
    return (req, res, next) => next(); // Fallback: no limiting
  }

  return async (req, res, next) => {
    try {
      // Get identifier (user ID, IP, or custom)
      const identifier = identifierFn
        ? identifierFn(req)
        : req.user?.id || req.ip || 'anonymous';

      // Check rate limit
      const { success, limit, remaining, reset } = await limiter.limit(identifier);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', new Date(reset).toISOString());

      if (!success) {
        logger.warn('Rate limit exceeded', {
          limiterType,
          identifier,
          path: req.path,
          method: req.method,
        });

        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later',
            retryAfter: Math.ceil((reset - Date.now()) / 1000), // seconds
          },
        });
      }

      // Log if approaching limit
      if (remaining < limit * 0.1) {
        logger.info('Approaching rate limit', {
          limiterType,
          identifier,
          remaining,
          limit,
        });
      }

      next();
    } catch (error) {
      logger.error('Rate limiter error', {
        error: error.message,
        limiterType,
        path: req.path,
      });

      // On error, allow the request (fail open)
      next();
    }
  };
}

/**
 * Multi-tier rate limiting (combine IP + user)
 *
 * Example: Limit both per-IP and per-user
 */
function createMultiTierRateLimit(limiterType = 'api') {
  const limiter = rateLimiters[limiterType];

  return async (req, res, next) => {
    try {
      // Check IP-based limit first
      const ipLimit = await limiter.limit(`ip:${req.ip}`);

      if (!ipLimit.success) {
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests from this IP',
            retryAfter: Math.ceil((ipLimit.reset - Date.now()) / 1000),
          },
        });
      }

      // Check user-based limit if authenticated
      if (req.user?.id) {
        const userLimit = await limiter.limit(`user:${req.user.id}`);

        res.setHeader('X-RateLimit-Limit', userLimit.limit);
        res.setHeader('X-RateLimit-Remaining', userLimit.remaining);
        res.setHeader('X-RateLimit-Reset', new Date(userLimit.reset).toISOString());

        if (!userLimit.success) {
          return res.status(429).json({
            success: false,
            error: {
              code: 'USER_RATE_LIMIT_EXCEEDED',
              message: 'Too many requests for this account',
              retryAfter: Math.ceil((userLimit.reset - Date.now()) / 1000),
            },
          });
        }
      } else {
        res.setHeader('X-RateLimit-Limit', ipLimit.limit);
        res.setHeader('X-RateLimit-Remaining', ipLimit.remaining);
        res.setHeader('X-RateLimit-Reset', new Date(ipLimit.reset).toISOString());
      }

      next();
    } catch (error) {
      logger.error('Multi-tier rate limit error', { error: error.message });
      next(); // Fail open
    }
  };
}

/**
 * Check rate limit without consuming quota
 *
 * Useful for displaying "requests remaining" in UI
 */
async function checkRateLimit(limiterType, identifier) {
  try {
    const limiter = rateLimiters[limiterType];
    if (!limiter) return null;

    // Use Redis to peek at current state without consuming
    const key = `ratelimit:${limiterType}:${identifier}`;
    const count = await redis.get(key);

    return {
      identifier,
      used: count || 0,
      limit: limiter.limit,
      remaining: Math.max(0, limiter.limit - (count || 0)),
    };
  } catch (error) {
    logger.error('Check rate limit error', { error: error.message });
    return null;
  }
}

/**
 * Reset rate limit for a specific identifier
 *
 * Use with caution - typically for admin overrides
 */
async function resetRateLimit(limiterType, identifier) {
  try {
    const key = `ratelimit:${limiterType}:${identifier}`;
    await redis.del(key);

    logger.info('Rate limit reset', { limiterType, identifier });
    return true;
  } catch (error) {
    logger.error('Reset rate limit error', { error: error.message });
    return false;
  }
}

module.exports = {
  rateLimiters,
  createRateLimitMiddleware,
  createMultiTierRateLimit,
  checkRateLimit,
  resetRateLimit,

  // Export individual middlewares for convenience
  authRateLimit: createRateLimitMiddleware('auth'),
  paymentRateLimit: createRateLimitMiddleware('payment'),
  tokenPurchaseRateLimit: createRateLimitMiddleware('tokenPurchase'),
  streamingRateLimit: createRateLimitMiddleware('streaming'),
  uploadRateLimit: createRateLimitMiddleware('upload'),
  analyticsRateLimit: createRateLimitMiddleware('analytics'),
  apiRateLimit: createRateLimitMiddleware('api'),
  publicRateLimit: createRateLimitMiddleware('public'),
};
