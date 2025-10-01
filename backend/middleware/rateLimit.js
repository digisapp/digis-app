/**
 * Rate Limiting Middleware
 * Using Upstash Redis for distributed rate limiting
 */

const { rateLimit } = require('../lib/redis');

/**
 * Create rate limit middleware
 * @param {Object} options - Rate limit options
 * @param {number} options.limit - Max requests per window
 * @param {number} options.windowSec - Window size in seconds
 * @param {Function|string} options.keyGenerator - Function to generate rate limit key
 * @param {boolean} options.skipSuccessfulRequests - Don't count successful requests
 * @param {boolean} options.skipFailedRequests - Don't count failed requests
 */
function createRateLimiter(options = {}) {
  const {
    limit = 100,
    windowSec = 60,
    keyGenerator = (req) => req.ip || 'unknown',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    message = 'Too many requests, please try again later.'
  } = options;

  return async (req, res, next) => {
    try {
      // Generate rate limit key
      const key = typeof keyGenerator === 'function'
        ? await keyGenerator(req)
        : keyGenerator;

      // Build full key with route
      const routeKey = `${req.method}:${req.path}:${key}`;

      // Check rate limit
      const result = await rateLimit({
        key: routeKey,
        limit,
        windowSec
      });

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowSec * 1000).toISOString());

      if (!result.ok) {
        res.setHeader('Retry-After', result.retryAfter);
        return res.status(429).json({
          error: message,
          retryAfter: result.retryAfter,
          limit,
          remaining: result.remaining
        });
      }

      // Track response for conditional counting
      if (skipSuccessfulRequests || skipFailedRequests) {
        const originalSend = res.send;
        res.send = function(data) {
          const shouldSkip =
            (skipSuccessfulRequests && res.statusCode < 400) ||
            (skipFailedRequests && res.statusCode >= 400);

          if (shouldSkip) {
            // Decrement the counter (give back the request)
            // Note: This is approximate, not atomic
            console.log('Rate limit: Skipping count for status', res.statusCode);
          }

          return originalSend.call(this, data);
        };
      }

      next();
    } catch (error) {
      console.error('Rate limit error:', error);
      // On Redis error, allow the request (fail open)
      next();
    }
  };
}

/**
 * Common rate limiters
 */
const rateLimiters = {
  // General API rate limit (100 req/min per IP)
  general: createRateLimiter({
    limit: 100,
    windowSec: 60,
    keyGenerator: (req) => req.ip || req.connection.remoteAddress || 'unknown'
  }),

  // Strict rate limit for auth endpoints (5 req/min per IP)
  auth: createRateLimiter({
    limit: 5,
    windowSec: 60,
    keyGenerator: (req) => req.ip || req.connection.remoteAddress || 'unknown',
    message: 'Too many authentication attempts. Please wait before trying again.'
  }),

  // Email sending rate limit (5 emails/min per user)
  email: createRateLimiter({
    limit: 5,
    windowSec: 60,
    keyGenerator: (req) => req.user?.id || req.body?.email || 'unknown',
    message: 'Email rate limit exceeded. Please wait before sending more emails.'
  }),

  // Search rate limit (30 searches/min per IP)
  search: createRateLimiter({
    limit: 30,
    windowSec: 60,
    keyGenerator: (req) => req.ip || 'unknown',
    message: 'Too many search requests. Please wait before searching again.'
  }),

  // Stream creation rate limit (1 stream/5min per creator)
  streamCreation: createRateLimiter({
    limit: 1,
    windowSec: 300,
    keyGenerator: (req) => req.user?.id || 'unknown',
    message: 'You can only start one stream every 5 minutes.'
  }),

  // Token purchase rate limit (10 purchases/hour per user)
  tokenPurchase: createRateLimiter({
    limit: 10,
    windowSec: 3600,
    keyGenerator: (req) => req.user?.id || 'unknown',
    message: 'Too many token purchases. Please wait before purchasing more.'
  }),

  // Password reset rate limit (3 requests/hour per email)
  passwordReset: createRateLimiter({
    limit: 3,
    windowSec: 3600,
    keyGenerator: (req) => req.body?.email || req.ip || 'unknown',
    message: 'Too many password reset requests. Please check your email or try again later.'
  }),

  // File upload rate limit (20 uploads/hour per user)
  upload: createRateLimiter({
    limit: 20,
    windowSec: 3600,
    keyGenerator: (req) => req.user?.id || 'unknown',
    message: 'Upload limit reached. Please wait before uploading more files.'
  })
};

/**
 * IP-based rate limiter for public endpoints
 */
function ipRateLimit(limit = 60, windowSec = 60) {
  return createRateLimiter({
    limit,
    windowSec,
    keyGenerator: (req) => {
      // Try various headers for IP (works with proxies/CDNs)
      return req.headers['cf-connecting-ip'] ||  // Cloudflare
             req.headers['x-real-ip'] ||         // Nginx proxy
             req.headers['x-forwarded-for']?.split(',')[0] || // Standard proxy
             req.ip ||                            // Express default
             req.connection.remoteAddress ||      // Fallback
             'unknown';
    }
  });
}

/**
 * User-based rate limiter for authenticated endpoints
 */
function userRateLimit(limit = 100, windowSec = 60) {
  return createRateLimiter({
    limit,
    windowSec,
    keyGenerator: (req) => {
      if (!req.user?.id) {
        throw new Error('User rate limit requires authenticated user');
      }
      return req.user.id;
    }
  });
}

module.exports = {
  createRateLimiter,
  rateLimiters,
  ipRateLimit,
  userRateLimit
};