const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const { createClient } = require('redis');

const redis = process.env.REDIS_URL
  ? createClient({ url: process.env.REDIS_URL })
  : null;

if (redis) {
  redis.connect().catch(console.error);
}

/**
 * Standard API rate limiter
 * 120 requests per minute
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  ...(redis && {
    store: new RedisStore({
      client: redis,
      prefix: 'rl:api:',
    }),
  }),
  message: {
    error: 'Too many requests, please try again later.',
  },
});

/**
 * Financial endpoints rate limiter
 * Stricter limits: 10 requests per 15 minutes
 */
const financialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  ...(redis && {
    store: new RedisStore({
      client: redis,
      prefix: 'rl:financial:',
    }),
  }),
  message: {
    error: 'Too many payment requests. Please wait before trying again.',
  },
  skipSuccessfulRequests: false,
});

/**
 * Authentication endpoints rate limiter
 * Prevent brute force: 5 attempts per 15 minutes
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  ...(redis && {
    store: new RedisStore({
      client: redis,
      prefix: 'rl:auth:',
    }),
  }),
  message: {
    error: 'Too many login attempts. Please try again later.',
  },
  skipSuccessfulRequests: true, // Don't count successful logins
});

module.exports = {
  apiLimiter,
  financialLimiter,
  authLimiter,
};
