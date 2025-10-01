const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const { logger } = require('../utils/secureLogger');

/**
 * Enhanced rate limiting with per-route configurations
 * and stricter limits for sensitive endpoints
 */

// Redis client for distributed rate limiting
let redisClient = null;
try {
  if (process.env.REDIS_URL) {
    const Redis = require('ioredis');
    redisClient = new Redis(process.env.REDIS_URL, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1
    });
    logger.info('Rate limiter using Redis store');
  }
} catch (error) {
  logger.warn('Redis not available for rate limiting, using memory store', { error: error.message });
}

/**
 * Create rate limiter with specific configuration
 */
function createRateLimiter(options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes default
    max = 100, // 100 requests default
    message = 'Too many requests, please try again later.',
    keyGenerator = (req) => req.ip || 'unknown',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    standardHeaders = true,
    legacyHeaders = false,
    ...customOptions
  } = options;

  const store = redisClient
    ? new RedisStore({
        client: redisClient,
        prefix: 'rl:',
        sendCommand: (...args) => redisClient.call(...args)
      })
    : undefined; // Falls back to memory store

  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders,
    legacyHeaders,
    keyGenerator,
    skipSuccessfulRequests,
    skipFailedRequests,
    store,
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userId: req.user?.supabase_id,
        requestId: req.requestId
      });

      res.status(429).json({
        success: false,
        code: 'RATE_LIMITED',
        message,
        retryAfter: res.getHeader('Retry-After'),
        requestId: req.requestId
      });
    },
    ...customOptions
  });
}

/**
 * Per-route rate limiters with specific configurations
 */
const rateLimiters = {
  // Strictest: Authentication endpoints
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many authentication attempts. Please wait 15 minutes.',
    skipSuccessfulRequests: true // Only count failed attempts
  }),

  // Strict: Login/Register
  login: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many login attempts. Please try again later.',
    skipSuccessfulRequests: true
  }),

  // Strict: Password reset
  passwordReset: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: 'Too many password reset requests. Please wait 1 hour.'
  }),

  // Strict: Payment endpoints
  payments: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: 'Too many payment requests. Please wait before trying again.'
  }),

  // Strict: Token purchase
  tokenPurchase: createRateLimiter({
    windowMs: 60 * 1000,
    max: 5,
    message: 'Too many token purchase attempts. Please wait a moment.'
  }),

  // Moderate: Stripe webhooks
  webhooks: createRateLimiter({
    windowMs: 1000, // 1 second
    max: 50,
    message: 'Webhook rate limit exceeded.',
    keyGenerator: (req) => req.headers['stripe-signature'] || req.ip
  }),

  // Moderate: User data updates
  userUpdate: createRateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 30,
    message: 'Too many profile updates. Please wait.'
  }),

  // Moderate: Content creation
  contentCreation: createRateLimiter({
    windowMs: 60 * 1000,
    max: 20,
    message: 'Too many uploads. Please wait before uploading more.'
  }),

  // Moderate: Messaging
  messaging: createRateLimiter({
    windowMs: 60 * 1000,
    max: 60,
    message: 'Too many messages. Please slow down.'
  }),

  // Lenient: Streaming/Video calls
  streaming: createRateLimiter({
    windowMs: 60 * 1000,
    max: 100,
    message: 'Too many streaming requests.',
    keyGenerator: (req) => req.user?.supabase_id || req.ip
  }),

  // Lenient: General API
  general: createRateLimiter({
    windowMs: 60 * 1000,
    max: 200,
    message: 'Too many requests. Please try again shortly.'
  }),

  // Very lenient: Read-only endpoints
  readonly: createRateLimiter({
    windowMs: 60 * 1000,
    max: 500,
    message: 'Too many requests.'
  }),

  // Custom: Per-user rate limiting for authenticated requests
  perUser: createRateLimiter({
    windowMs: 60 * 1000,
    max: 100,
    keyGenerator: (req) => req.user?.supabase_id || req.ip,
    skip: (req) => !req.user // Skip if not authenticated
  }),

  // Aggressive: Admin actions
  admin: createRateLimiter({
    windowMs: 60 * 1000,
    max: 30,
    message: 'Admin rate limit exceeded.',
    keyGenerator: (req) => `admin:${req.user?.supabase_id || req.ip}`
  })
};

/**
 * Middleware to apply appropriate rate limiter based on route
 */
function applyRateLimiting(req, res, next) {
  const path = req.path.toLowerCase();
  const method = req.method;

  // Skip OPTIONS requests
  if (method === 'OPTIONS') {
    return next();
  }

  // Determine which rate limiter to use
  let limiter = rateLimiters.general; // Default

  // Auth endpoints
  if (path.includes('/auth/login') || path.includes('/auth/signin')) {
    limiter = rateLimiters.login;
  } else if (path.includes('/auth/register') || path.includes('/auth/signup')) {
    limiter = rateLimiters.auth;
  } else if (path.includes('/auth/reset') || path.includes('/auth/forgot')) {
    limiter = rateLimiters.passwordReset;
  } else if (path.includes('/auth')) {
    limiter = rateLimiters.auth;
  }

  // Payment endpoints
  else if (path.includes('/payments') || path.includes('/stripe')) {
    limiter = rateLimiters.payments;
  } else if (path.includes('/tokens/purchase')) {
    limiter = rateLimiters.tokenPurchase;
  } else if (path.includes('/webhooks')) {
    limiter = rateLimiters.webhooks;
  }

  // User/Content endpoints
  else if (path.includes('/users') && method !== 'GET') {
    limiter = rateLimiters.userUpdate;
  } else if (path.includes('/upload') || path.includes('/content')) {
    limiter = rateLimiters.contentCreation;
  } else if (path.includes('/messages') || path.includes('/chat')) {
    limiter = rateLimiters.messaging;
  }

  // Streaming/Video
  else if (path.includes('/stream') || path.includes('/agora') || path.includes('/video')) {
    limiter = rateLimiters.streaming;
  }

  // Admin
  else if (path.includes('/admin')) {
    limiter = rateLimiters.admin;
  }

  // Read-only
  else if (method === 'GET') {
    limiter = rateLimiters.readonly;
  }

  // Apply the selected limiter
  limiter(req, res, next);
}

/**
 * Create custom rate limiter for specific needs
 */
function customRateLimiter(routePattern, options) {
  return (req, res, next) => {
    if (req.path.match(routePattern)) {
      const limiter = createRateLimiter(options);
      return limiter(req, res, next);
    }
    next();
  };
}

/**
 * IP-based rate limiter for DDoS protection
 */
const ddosProtection = createRateLimiter({
  windowMs: 1000, // 1 second
  max: 100, // 100 requests per second per IP
  message: 'Request rate too high. Please wait.',
  standardHeaders: false, // Don't add headers for DDoS protection
  legacyHeaders: false
});

module.exports = {
  createRateLimiter,
  rateLimiters,
  applyRateLimiting,
  customRateLimiter,
  ddosProtection
};