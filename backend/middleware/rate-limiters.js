/**
 * Enhanced Rate Limiters with Redis Support
 * - Redis store in production for distributed rate limiting
 * - Memory store in development
 * - Named limiters for different endpoint types
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const { createClient } = require('redis');

let redisClient = null;

/**
 * Ensure Redis client is connected
 * Returns null if Redis is not available (fallback to memory store)
 */
async function ensureRedis() {
  if (redisClient) return redisClient;

  // Skip Redis in development or if not configured
  if (!process.env.REDIS_URL || process.env.NODE_ENV !== 'production') {
    console.log('📝 Rate limiting using memory store (development mode)');
    return null;
  }

  try {
    const client = createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (times) => Math.min(times * 50, 2000)
      }
    });

    client.on('error', (err) => {
      console.warn('⚠️ Redis rate limiter error:', err.message);
    });

    await client.connect();
    console.log('✅ Redis connected for rate limiting');
    redisClient = client;
    return redisClient;
  } catch (err) {
    console.warn('⚠️ Redis connection failed, using memory store:', err.message);
    return null;
  }
}

/**
 * Create a rate limiter with specified options
 */
async function createLimiter(options) {
  const client = await ensureRedis();

  const config = {
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false, // Disable X-RateLimit-* headers

    // Custom error handler
    handler: (req, res) => {
      const retryAfter = res.getHeader('Retry-After') || Math.ceil((options.windowMs || 60000) / 1000);

      res.status(429).json({
        success: false,
        code: 'RATE_LIMITED',
        message: options.message || 'Too many requests, please try again later',
        retryAfter,
        requestId: req.id || req.requestId
      });
    },

    // Key generator - prefer supabase_id for consistency
    keyGenerator: (req) => {
      return req.user?.supabase_id || req.user?.id || req.ip;
    },

    // Disable IPv6 validation warning
    validate: false,

    // Skip rate limiting for health checks and monitoring
    skip: (req) => {
      return req.path === '/health' ||
             req.path === '/api/health' ||
             req.path === '/api/monitoring/health' ||
             req.path === '/metrics';
    },

    // Merge with provided options
    ...options
  };

  // Use Redis store if available
  if (client) {
    config.store = new RedisStore({
      client,
      prefix: 'rl:', // Rate limit prefix in Redis
      sendCommand: (...args) => client.sendCommand(args)
    });
  }

  return rateLimit(config);
}

/**
 * Build all named rate limiters
 */
async function buildLimiters() {
  const limiters = {
    // Authentication endpoints (general)
    auth: await createLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: process.env.NODE_ENV === 'production' ? 500 : 10000, // Much higher limit (500 instead of 200)
      message: 'Too many authentication requests, please try again later',
      skipSuccessfulRequests: false,
      // Skip rate limiting in development or for critical auth endpoints
      skip: (req) => {
        // Always skip in development
        if (process.env.NODE_ENV !== 'production' || process.env.NODE_ENV === 'development') return true;
        // Skip for critical endpoints
        const skipPaths = ['/session', '/verify-role', '/sync-user', '/balance'];
        return skipPaths.some(path => req.path.includes(path) || req.url.includes(path));
      }
    }),

    // Login attempts (strict)
    login: await createLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // 10 login attempts per 15 minutes
      message: 'Too many login attempts. Please try again later.',
      skipSuccessfulRequests: true // Don't count successful logins
    }),

    // Registration (moderate)
    register: await createLimiter({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10, // 10 registration attempts per hour
      message: 'Too many registration attempts. Please try again later.'
    }),

    // Token verification (lenient - used frequently)
    verify: await createLimiter({
      windowMs: 60 * 1000, // 1 minute
      max: process.env.NODE_ENV === 'production' ? 30 : 1000, // Higher limit in dev
      message: 'Too many verification requests. Please slow down.'
    }),

    // Password reset (very strict)
    passwordReset: await createLimiter({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 5, // 5 attempts per hour
      message: 'Too many password reset attempts, please try again later'
    }),

    // Socket connection limiter
    socket: await createLimiter({
      windowMs: 60 * 1000, // 1 minute
      max: 10, // 10 socket connections per minute
      message: 'Too many socket connection attempts'
    }),

    // General API endpoints
    api: await createLimiter({
      windowMs: 60 * 1000, // 1 minute
      max: process.env.NODE_ENV === 'production' ? 300 : 10000, // Increased from 100 to 300
      message: 'Too many API requests, please slow down',
      skip: (req) => {
        // Skip in development
        if (process.env.NODE_ENV !== 'production' || process.env.NODE_ENV === 'development') return true;
        return false;
      }
    }),

    // Payment endpoints (strict)
    payment: await createLimiter({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 20, // 20 payment attempts per hour
      message: 'Too many payment attempts, please try again later',
      skipSuccessfulRequests: true // Don't count successful payments
    }),

    // Token purchase (medium)
    tokenPurchase: await createLimiter({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 10,
      message: 'Too many token purchase attempts'
    }),

    // Streaming/Agora endpoints
    streaming: await createLimiter({
      windowMs: 60 * 1000, // 1 minute
      max: 60,
      message: 'Streaming rate limit exceeded'
    }),

    // WebSocket connections
    websocket: await createLimiter({
      windowMs: 60 * 1000,
      max: 30,
      message: 'Too many WebSocket connection attempts'
    }),

    // File uploads
    upload: await createLimiter({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 50,
      message: 'Too many upload attempts'
    }),

    // Public endpoints (relaxed)
    public: await createLimiter({
      windowMs: 60 * 1000,
      max: 200,
      message: 'Too many requests'
    }),

    // Search endpoints
    search: await createLimiter({
      windowMs: 60 * 1000,
      max: 30,
      message: 'Too many search requests'
    }),

    // Analytics endpoints
    analytics: await createLimiter({
      windowMs: 60 * 1000,
      max: 50,
      message: 'Too many analytics requests'
    }),

    // IP-wide limiter (for DDoS protection on critical endpoints)
    ip: await createLimiter({
      windowMs: 60 * 1000, // 1 minute
      max: 600, // 600 requests per minute per IP
      keyGenerator: (req) => req.ip, // Always use IP, ignore user
      message: 'IP rate limit exceeded'
    })
  };

  // Add aliases for convenience
  limiters.uploads = limiters.upload; // Both "upload" and "uploads" work
  limiters.reset = limiters.passwordReset; // Alias for password reset

  // Log limiter configuration
  console.log('📊 Rate limiters configured:', Object.keys(limiters).join(', '));

  return limiters;
}

/**
 * Create a custom rate limiter on demand
 */
async function customLimiter(windowMs, max, message) {
  return createLimiter({ windowMs, max, message });
}

/**
 * IP-based rate limiter factory
 */
function createIPLimiter(options) {
  return createLimiter({
    ...options,
    keyGenerator: (req) => {
      // Use X-Forwarded-For in production (behind proxy)
      return req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    }
  });
}

/**
 * User-based rate limiter factory
 */
function createUserLimiter(options) {
  return createLimiter({
    ...options,
    keyGenerator: (req) => {
      // Use user ID if authenticated, fall back to IP
      return req.user?.supabase_id || req.user?.id || req.ip;
    },
    skip: (req) => {
      // Skip for admins
      return req.user?.is_super_admin || req.user?.role === 'admin';
    }
  });
}

module.exports = {
  buildLimiters,
  createLimiter,
  customLimiter,
  createIPLimiter,
  createUserLimiter,
  ensureRedis
};