// Supabase-only authentication middleware with v2 features
const { verifySupabaseToken, initializeSupabaseAdmin, observability, supabase } = require('../utils/supabase-admin-v2');
const { pool } = require('../utils/db');

// Initialize Supabase Admin with enhanced features
initializeSupabaseAdmin();

// Alias for backward compatibility
const authenticateToken = verifySupabaseToken;

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
    const result = await pool.query(
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
      const result = await pool.query(
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

    const result = await pool.query(
      `SELECT is_super_admin, role FROM users
       WHERE supabase_id = $1
          OR email = (SELECT email FROM auth.users WHERE id = $1::uuid LIMIT 1)`,
      [userId]
    );

    if (result.rows.length === 0 || (!result.rows[0].is_super_admin && result.rows[0].role !== 'admin')) {
      span.addEvent('access_denied');
      span.end();
      observability.trackMetric('auth_admin_denied', 1, 'count', {
        userId,
        path: req.path
      });
      return res.status(403).json({
        success: false,
        code: 'ADMIN_ONLY',
        message: 'Super admin access required'
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
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    // No auth header, continue without user
    req.user = null;
    return next();
  }

  const token = authHeader.replace('Bearer ', '');
  
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    // Verify with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
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
    console.error('Optional auth error:', error);
    req.user = null;
    next();
  }
};

module.exports = {
  authenticateToken,
  verifySupabaseToken,
  requireCreator,
  requireTokens,
  requireSuperAdmin,
  optionalAuth
};