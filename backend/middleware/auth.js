// Supabase-only authentication middleware
const { verifySupabaseToken, initializeSupabaseAdmin } = require('../utils/supabase-admin');
const { pool } = require('../utils/db');

// Initialize Supabase Admin
initializeSupabaseAdmin();

// Export the Supabase token verification as default
const authenticateToken = verifySupabaseToken;

// Middleware to check if user is a creator
const requireCreator = async (req, res, next) => {
  try {
    const userId = req.user.supabase_id || req.user.uid;
    
    const result = await pool.query(
      'SELECT is_creator FROM users WHERE id::text = $1',
      [userId]
    );

    if (result.rows.length === 0 || !result.rows[0].is_creator) {
      return res.status(403).json({
        success: false,
        error: 'Creator access required'
      });
    }

    next();
  } catch (error) {
    console.error('Creator check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify creator status'
    });
  }
};

// Middleware to check if user has sufficient tokens
const requireTokens = (minimumTokens) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.supabase_id || req.user.uid;
      
      const result = await pool.query(
        'SELECT balance FROM token_balances WHERE user_id = (SELECT id FROM users WHERE id::text = $1 LIMIT 1)',
        [userId]
      );

      const balance = result.rows[0]?.balance || 0;

      if (balance < minimumTokens) {
        return res.status(402).json({
          success: false,
          error: 'Insufficient token balance',
          required: minimumTokens,
          current: balance
        });
      }

      req.tokenBalance = balance;
      next();
    } catch (error) {
      console.error('Token balance check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to verify token balance'
      });
    }
  };
};

// Middleware to check if user is a super admin
const requireSuperAdmin = async (req, res, next) => {
  try {
    const userId = req.user.supabase_id || req.user.uid;
    
    const result = await pool.query(
      'SELECT false as is_super_admin FROM users WHERE id::text = $1',
      [userId]
    );

    if (result.rows.length === 0 || !result.rows[0].is_super_admin) {
      return res.status(403).json({
        success: false,
        error: 'Super admin access required'
      });
    }

    next();
  } catch (error) {
    console.error('Super admin check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify super admin status'
    });
  }
};

module.exports = {
  authenticateToken,
  verifySupabaseToken,
  requireCreator,
  requireTokens,
  requireSuperAdmin
};