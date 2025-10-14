const { createClient } = require('@supabase/supabase-js');
const { logger } = require('../utils/secureLogger');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

/**
 * Optional authentication middleware for soft auth
 * Populates req.user if token exists, but doesn't fail if missing
 * Perfect for public endpoints that want to personalize if logged in
 *
 * Usage:
 *   router.get('/api/creators/:username', optionalAuth, (req, res) => {
 *     // req.user exists if logged in, undefined if not
 *     // personalize response accordingly
 *   });
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    // No token provided - continue as guest
    req.user = null;
    return next();
  }

  if (!supabase) {
    logger.warn('Optional auth: Supabase not configured');
    req.user = null;
    return next();
  }

  try {
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      // Invalid or expired token - continue as guest
      logger.debug('Optional auth: Invalid token', {
        error: error?.message,
        hasToken: !!token
      });
      req.user = null;
      return next();
    }

    // Token is valid - populate user
    req.user = {
      supabase_id: user.id,
      email: user.email,
      user_metadata: user.user_metadata
    };

    logger.debug('Optional auth: User authenticated', {
      userId: user.id
    });

    next();
  } catch (error) {
    // Unexpected error - log but continue as guest
    logger.error('Optional auth error:', {
      error: error.message,
      stack: error.stack
    });
    req.user = null;
    next();
  }
};

module.exports = { optionalAuth };
