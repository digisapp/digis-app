/**
 * CORS Configuration for Production Vercel Deployment
 *
 * Properly handles:
 * - Production domains
 * - Vercel preview deployments (with regex)
 * - Development environments
 *
 * ⚠️ CRITICAL: Wildcard strings like 'https://app-*.vercel.app' DO NOT WORK in CORS!
 * You MUST use:
 *   - Regex patterns (e.g., /^https:\/\/app-[a-z0-9-]+\.vercel\.app$/)
 *   - Dynamic origin function with string matching
 * Simple wildcards will silently fail and block all requests!
 */

const { logger } = require('../utils/secureLogger');

/**
 * Production domains (update with your actual domains)
 */
const PRODUCTION_DOMAINS = [
  'https://digis.cc',
  'https://www.digis.cc',
  'https://digis.app',
  'https://www.digis.app',
];

/**
 * Development domains (only allowed in NODE_ENV=development)
 */
const DEVELOPMENT_DOMAINS = [
  'http://localhost:3000',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  'http://localhost:3005',
  'http://localhost:3006',
  'http://localhost:3007',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:3003',
  'http://127.0.0.1:3004',
  'http://127.0.0.1:3005',
  'http://127.0.0.1:3006',
  'http://127.0.0.1:3007',
];

/**
 * Vercel preview URL patterns (regex)
 *
 * Matches:
 * - https://digis-app-*.vercel.app
 * - https://digis-frontend-*.vercel.app
 * - https://frontend-*.vercel.app
 * - https://your-app-git-branch-name.vercel.app
 */
const VERCEL_PREVIEW_PATTERNS = [
  /^https:\/\/digis-app-[a-z0-9-]+\.vercel\.app$/,
  /^https:\/\/digis-frontend-[a-z0-9-]+\.vercel\.app$/,
  /^https:\/\/frontend-[a-z0-9-]+\.vercel\.app$/,
  /^https:\/\/digis-app-git-[a-z0-9-]+\.vercel\.app$/,
];

/**
 * Check if origin matches Vercel preview URL pattern
 *
 * @param {string} origin - Origin to check
 * @returns {boolean}
 */
function isVercelPreview(origin) {
  return VERCEL_PREVIEW_PATTERNS.some(pattern => pattern.test(origin));
}

/**
 * CORS origin checker function
 *
 * @param {string} origin - Request origin
 * @param {function} callback - CORS callback(error, allow)
 */
function corsOriginChecker(origin, callback) {
  // Allow requests with no origin (mobile apps, Postman, curl, etc.)
  if (!origin) {
    logger.info('CORS: Request with no origin (allowed)');
    return callback(null, true);
  }

  // Production domains
  if (PRODUCTION_DOMAINS.includes(origin)) {
    logger.info('CORS: Production domain allowed', { origin });
    return callback(null, true);
  }

  // Vercel preview deployments
  if (isVercelPreview(origin)) {
    logger.info('CORS: Vercel preview deployment allowed', { origin });
    return callback(null, true);
  }

  // Current Vercel deployment (from environment variable)
  if (process.env.VERCEL_URL && origin === `https://${process.env.VERCEL_URL}`) {
    logger.info('CORS: Current Vercel deployment allowed', { origin });
    return callback(null, true);
  }

  // Development environments (only in dev mode)
  if (process.env.NODE_ENV === 'development' && DEVELOPMENT_DOMAINS.includes(origin)) {
    logger.info('CORS: Development domain allowed', { origin });
    return callback(null, true);
  }

  // Block all other origins
  logger.warn('CORS: Origin blocked', { origin, env: process.env.NODE_ENV });
  callback(new Error('Not allowed by CORS'));
}

/**
 * Complete CORS options object for Express cors middleware
 */
const corsOptions = {
  origin: corsOriginChecker,
  credentials: true, // Allow cookies and authentication headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Request-ID',
    'X-API-Version',
    'Cache-Control',
    'Pragma',
    'If-Modified-Since',
    'Range',
    'apikey',              // Supabase client
    'x-client-info',       // Supabase client
    'Prefer',              // Supabase client
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Request-ID',
    'Content-Range',
    'Range',
  ],
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  maxAge: 86400, // 24 hours - how long to cache preflight requests
};

/**
 * Preflight request handler
 *
 * Express CORS middleware handles this automatically, but this is
 * useful for debugging or custom implementations.
 */
function handlePreflight(req, res) {
  const origin = req.headers.origin;

  if (corsOriginChecker(origin, (err, allowed) => allowed)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', corsOptions.methods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(', '));
    res.setHeader('Access-Control-Max-Age', corsOptions.maxAge);
    res.status(200).end();
  } else {
    res.status(403).json({
      success: false,
      error: {
        code: 'CORS_ERROR',
        message: 'Origin not allowed',
      },
    });
  }
}

/**
 * Utility: Add custom domain to allowed origins (runtime)
 *
 * Useful for multi-tenant apps or custom domains
 */
function addAllowedOrigin(origin) {
  if (!PRODUCTION_DOMAINS.includes(origin)) {
    PRODUCTION_DOMAINS.push(origin);
    logger.info('CORS: Custom origin added', { origin });
  }
}

/**
 * Utility: Check if origin is allowed (without callback)
 *
 * Useful for WebSocket upgrade requests or custom logic
 */
function isOriginAllowed(origin) {
  if (!origin) return true;
  if (PRODUCTION_DOMAINS.includes(origin)) return true;
  if (isVercelPreview(origin)) return true;
  if (process.env.VERCEL_URL && origin === `https://${process.env.VERCEL_URL}`) return true;
  if (process.env.NODE_ENV === 'development' && DEVELOPMENT_DOMAINS.includes(origin)) return true;
  return false;
}

module.exports = {
  corsOptions,
  corsOriginChecker,
  handlePreflight,
  addAllowedOrigin,
  isOriginAllowed,
  isVercelPreview,
};
