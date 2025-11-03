// Supabase-only authentication middleware with v2 features
const { verifySupabaseToken, initializeSupabaseAdmin, observability, supabase } = require('../utils/supabase-admin-v2');
const { pool } = require('../utils/db');
const { withPgAndJwt } = require('./pg-with-jwt');

// Initialize Supabase Admin with enhanced features
initializeSupabaseAdmin();

// Alias for backward compatibility
const authenticateToken = verifySupabaseToken;

/**
 * Database helper - use req.pg if available (RLS-aware), otherwise fall back to pool
 * This allows routes that chained requirePgContext to work under RLS,
 * while routes without it can still query (but won't have auth.uid() context)
 */
const db = (req) => req?.pg || pool;

/**
 * Middleware to require PostgreSQL connection with RLS context
 * Only use on routes that actually query Postgres with RLS policies
 * Must be chained AFTER verifySupabaseToken
 */
const requirePgContext = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      code: 'AUTH_REQUIRED',
      message: 'Authentication required'
    });
  }
  return withPgAndJwt(req, res, next);
};

// Helper to get user ID consistently
const getUserId = (req) => {
  return req.user?.supabase_id || req.user?.uid || req.user?.sub;
};

// Middleware to check if user is a creator
const requireCreator = async (req, res, next) => {
  const span = observability.createSpan('auth_check_creator', {
    userId: getUserId(req),
    path: req.path
  });

  try {
    const userId = getUserId(req);
    if (!userId) {
      span.addEvent('missing_user');
      span.end();
      return res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        message: 'Authentication required'
      });
    }

    // Query with both supabase_id (new) and email fallback for compatibility
    // Use db(req) to support both RLS and non-RLS contexts
    const result = await db(req).query(
      `SELECT is_creator, role FROM users
       WHERE supabase_id = $1
          OR email = (SELECT email FROM auth.users WHERE id = $1::uuid LIMIT 1)`,
      [userId]
    );

    if (result.rows.length === 0 || (!result.rows[0].is_creator && result.rows[0].role !== 'creator' && result.rows[0].role !== 'admin')) {
      span.addEvent('access_denied', { reason: 'not_creator' });
      span.end();
      
      observability.trackMetric('auth_creator_denied', 1, 'count', {
        userId,
        path: req.path
      });
      
      return res.status(403).json({
        success: false,
        code: 'CREATOR_ONLY',
        message: 'Creator access required'
      });
    }

    span.addEvent('access_granted');
    span.end();
    next();
  } catch (error) {
    span.addEvent('error', { message: error.message });
    span.end();
    
    observability.logEvent('error', 'Creator check failed', {
      error: error.message,
      userId: req.user?.supabase_id || req.user?.uid
    });
    
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Failed to verify creator status'
    });
  }
};

// Middleware to check if user has sufficient tokens
const requireTokens = (minimumTokens) => {
  return async (req, res, next) => {
    const span = observability.createSpan('auth_check_tokens', {
      userId: getUserId(req),
      required: minimumTokens,
      path: req.path
    });

    try {
      const userId = getUserId(req);
      if (!userId) {
        span.addEvent('missing_user');
        span.end();
        return res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        message: 'Authentication required'
      });
      }

      // Query token balance - use token_balances table as single source of truth
      // Use db(req) to support both RLS and non-RLS contexts
      const result = await db(req).query(
        `SELECT balance FROM token_balances WHERE user_id = $1`,
        [userId]
      );

      const balance = Number(result.rows[0]?.balance || 0);

      if (balance < minimumTokens) {
        span.addEvent('insufficient_tokens', { balance, required: minimumTokens });
        span.end();
        return res.status(402).json({
          success: false,
          code: 'INSUFFICIENT_TOKENS',
          message: 'Insufficient token balance',
          required: minimumTokens,
          current: balance
        });
      }

      req.tokenBalance = balance;
      span.addEvent('tokens_verified', { balance });
      span.end();
      next();
    } catch (error) {
      span.addEvent('error', { message: error.message });
      span.end();
      observability.logEvent('error', 'Token balance check error', { error: error.message });
      return res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to verify token balance'
      });
    }
  };
};

// Middleware to check if user is a super admin
const requireSuperAdmin = async (req, res, next) => {
  const span = observability.createSpan('auth_check_super_admin', {
    userId: getUserId(req),
    path: req.path
  });

  try {
    const userId = getUserId(req);
    if (!userId) {
      span.addEvent('missing_user');
      span.end();
      return res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        message: 'Authentication required'
      });
    }

    // Use db(req) to support both RLS and non-RLS contexts
    const result = await db(req).query(
      `SELECT role FROM users
       WHERE supabase_id = $1
          OR email = (SELECT email FROM auth.users WHERE id = $1::uuid LIMIT 1)`,
      [userId]
    );

    if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
      span.addEvent('access_denied');
      span.end();
      observability.trackMetric('auth_admin_denied', 1, 'count', {
        userId,
        path: req.path
      });
      return res.status(403).json({
        success: false,
        code: 'ADMIN_ONLY',
        message: 'Admin access required'
      });
    }

    span.addEvent('access_granted');
    span.end();
    next();
  } catch (error) {
    span.addEvent('error', { message: error.message });
    span.end();
    observability.logEvent('error', 'Super admin check error', { error: error.message });
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Failed to verify super admin status'
    });
  }
};

// Optional authentication middleware (for public routes that may have logged-in users)
const optionalAuth = async (req, res, next) => {
  // Skip OPTIONS preflights immediately
  if (req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers.authorization;

  // Early bailout if no auth header or invalid format
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.slice(7); // Remove 'Bearer '

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    // Timeout to prevent Supabase outages from holding up public pages
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500); // 2.5s budget

    // Verify with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token, {
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (error || !user) {
      req.user = null;
      return next();
    }

    // Get full user profile
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('supabase_id', user.id)
      .single();

    req.user = {
      uid: user.id,
      supabase_id: user.id,
      email: user.email,
      ...profile
    };

    next();
  } catch (error) {
    // Never fail the request for optional auth
    if (error.name !== 'AbortError') {
      console.error('Optional auth error:', error);
    }
    req.user = null;
    next();
  }
};

module.exports = {
  authenticateToken,
  verifySupabaseToken,
  requirePgContext,
  requireCreator,
  requireTokens,
  requireSuperAdmin,
  optionalAuth
};