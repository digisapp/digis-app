const rateLimit = require('express-rate-limit');
const { getClientIp } = require('./adminAudit'); // Reuse IP extraction logic

/**
 * Admin Rate Limiter (2025 Best Practice)
 *
 * Stricter rate limits for admin endpoints to prevent:
 * - Brute force attacks
 * - Abuse of admin privileges
 * - Accidental mass operations
 */

// Get rate limit config from env
const ADMIN_RATE_LIMIT_WINDOW_MS = parseInt(process.env.ADMIN_RATE_LIMIT_WINDOW_MS || '60000', 10); // Default: 1 min
const ADMIN_RATE_LIMIT_MAX = parseInt(process.env.ADMIN_RATE_LIMIT_MAX || '60', 10); // Default: 60 req/min

/**
 * Standard admin rate limiter
 * Default: 60 requests per minute per IP+User combo
 * Configurable via env vars
 */
const adminRateLimiter = rateLimit({
  windowMs: ADMIN_RATE_LIMIT_WINDOW_MS,
  max: ADMIN_RATE_LIMIT_MAX,
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many admin requests. Please wait before trying again.',
    retry_after_seconds: Math.ceil(ADMIN_RATE_LIMIT_WINDOW_MS / 1000)
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers

  // Use both IP and user ID as key (prevent multiple accounts from same IP)
  keyGenerator: (req) => {
    const ip = getClientIp(req);
    const userId = req.user?.id || req.user?.supabase_id || 'anonymous';
    return `${ip}-${userId}`;
  },

  // Skip rate limiting for certain IPs (e.g., monitoring/health checks)
  skip: (req) => {
    // Skip health checks
    if (req.path === '/health' || req.path === '/api/health') {
      return true;
    }
    return false;
  },

  // Handler when rate limit is exceeded
  handler: (req, res) => {
    console.warn(`⚠️ Admin rate limit exceeded: ${getClientIp(req)} - User: ${req.user?.email || 'unknown'}`);

    res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many admin requests. Please slow down and try again later.',
      retry_after_seconds: 900
    });
  }
});

/**
 * Strict rate limiter for sensitive actions
 * 10 requests per 5 minutes per IP+User combo
 *
 * Use for:
 * - User promotion/demotion
 * - Account deletion
 * - Mass operations
 * - Payment/payout actions
 */
const sensitiveActionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit to 10 sensitive actions per 5 minutes
  message: {
    error: 'SENSITIVE_ACTION_RATE_LIMIT',
    message: 'Too many sensitive admin actions. Please wait before trying again.',
    retry_after_seconds: 300 // 5 minutes
  },
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req) => {
    const ip = getClientIp(req);
    const userId = req.user?.id || req.user?.supabase_id || 'anonymous';
    return `sensitive-${ip}-${userId}`;
  },

  handler: (req, res) => {
    console.error(`🚨 Sensitive action rate limit exceeded: ${getClientIp(req)} - User: ${req.user?.email || 'unknown'} - Action: ${req.method} ${req.path}`);

    // Alert security team
    // TODO: Send to Slack/PagerDuty/etc.

    res.status(429).json({
      error: 'SENSITIVE_ACTION_RATE_LIMIT',
      message: 'Too many sensitive actions performed. This has been logged for security review.',
      retry_after_seconds: 300
    });
  }
});

/**
 * Login rate limiter (for /admin/login endpoint)
 * 5 attempts per 15 minutes per IP
 */
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes
  message: {
    error: 'LOGIN_RATE_LIMIT',
    message: 'Too many login attempts. Please try again later.',
    retry_after_seconds: 900
  },
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req) => {
    return getClientIp(req); // Only IP-based for login attempts
  },

  handler: (req, res) => {
    const ip = getClientIp(req);
    console.error(`🚨 Admin login rate limit exceeded from IP: ${ip}`);

    // Alert security team about potential brute force
    // TODO: Send to security monitoring

    res.status(429).json({
      error: 'LOGIN_RATE_LIMIT',
      message: 'Too many login attempts from this IP address. Please try again in 15 minutes.',
      retry_after_seconds: 900
    });
  }
});

/**
 * Export rate limiter (for data export endpoints)
 * 3 exports per hour per user
 */
const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 exports per hour
  message: {
    error: 'EXPORT_RATE_LIMIT',
    message: 'Export limit reached. Please wait before requesting another export.',
    retry_after_seconds: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req) => {
    const userId = req.user?.id || req.user?.supabase_id || 'anonymous';
    return `export-${userId}`;
  },

  handler: (req, res) => {
    console.warn(`⚠️ Export rate limit exceeded: User: ${req.user?.email || 'unknown'}`);

    res.status(429).json({
      error: 'EXPORT_RATE_LIMIT',
      message: 'You have reached the maximum number of exports per hour. Please try again later.',
      retry_after_seconds: 3600
    });
  }
});

module.exports = {
  adminRateLimiter,
  sensitiveActionLimiter,
  adminLoginLimiter,
  exportLimiter
};
