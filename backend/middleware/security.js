/**
 * Security Middleware for Production
 */

const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'https://digis.app'
];

const securityHeaders = helmet({
  contentSecurityPolicy: false
});

const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
});

const baseRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true
});

const authRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20
});

const paymentRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10
});

/**
 * Apply comprehensive security middleware to Express app
 * This is called from api/index.js
 */
function applySecurity(app) {
  // CRITICAL: Trust proxy - must be first for Vercel
  app.set('trust proxy', 1);

  // Apply Helmet security headers
  app.use(securityHeaders);

  console.log('✅ Security middleware applied (trust proxy, helmet)');
}

module.exports = {
  applySecurity,
  securityHeaders,
  corsMiddleware,
  baseRateLimiter,
  authRateLimiter,
  paymentRateLimiter
};
