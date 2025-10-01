const cors = require('cors');
const { logger } = require('../utils/secureLogger');

/**
 * Enhanced CORS middleware with strict origin validation
 * and environment-based configuration
 */

// Parse allowed origins from environment
function getAllowedOrigins() {
  const origins = new Set();

  // Add production domains
  origins.add('https://digis.app');
  origins.add('https://www.digis.app');

  // Add Vercel preview URLs
  if (process.env.VERCEL_URL) {
    origins.add(`https://${process.env.VERCEL_URL}`);
  }

  // Add custom allowed origins from environment
  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS
      .split(',')
      .map(origin => origin.trim())
      .filter(origin => origin.startsWith('http'))
      .forEach(origin => origins.add(origin));
  }

  // Add frontend URL
  if (process.env.FRONTEND_URL) {
    origins.add(process.env.FRONTEND_URL);
  }

  // Add development origins ONLY in development
  if (process.env.NODE_ENV === 'development') {
    [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:3002',
      'http://127.0.0.1:3003'
    ].forEach(origin => origins.add(origin));
  }

  return Array.from(origins);
}

// Enhanced CORS configuration
function createCorsOptions() {
  const allowedOrigins = getAllowedOrigins();
  const isDevelopment = process.env.NODE_ENV === 'development';

  logger.info('CORS configuration loaded', {
    allowedOrigins: isDevelopment ? allowedOrigins : '[REDACTED IN PRODUCTION]',
    environment: process.env.NODE_ENV
  });

  return {
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      // But log them for security monitoring
      if (!origin) {
        logger.debug('Request with no origin header', {
          userAgent: callback.req?.headers?.['user-agent'],
          ip: callback.req?.ip
        });
        return callback(null, true);
      }

      // Check if origin is allowed
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // Log rejected origin attempts
        logger.warn('CORS rejection', {
          rejectedOrigin: origin,
          ip: callback.req?.ip,
          userAgent: callback.req?.headers?.['user-agent'],
          path: callback.req?.path
        });

        // In production, deny unknown origins by default
        if (process.env.NODE_ENV === 'production') {
          callback(new Error(`Origin ${origin} not allowed by CORS policy`));
        } else {
          // In development, warn but allow (for easier testing)
          logger.warn('Allowing unknown origin in development mode', { origin });
          callback(null, true);
        }
      }
    },

    credentials: true,

    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Request-ID',
      'X-API-Version'
    ],

    exposedHeaders: [
      'X-Request-ID',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset'
    ],

    maxAge: 86400, // Cache preflight for 24 hours

    optionsSuccessStatus: 200
  };
}

// Middleware factory
function enhancedCors() {
  const corsOptions = createCorsOptions();
  return cors(corsOptions);
}

// Export middleware and utilities
module.exports = {
  enhancedCors,
  getAllowedOrigins,
  createCorsOptions
};