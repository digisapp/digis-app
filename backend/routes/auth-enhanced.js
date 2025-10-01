/**
 * Enhanced Authentication Routes with JWT Refresh Tokens
 * - Short-lived access tokens (15 minutes)
 * - Long-lived refresh tokens (7 days)
 * - Secure token rotation
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const { supabaseAdmin } = require('../utils/supabase-admin');
const { sanitizeInput, sanitizers } = require('../middleware/sanitize');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
} = require('../config/jwt');

// Apply input sanitization to all auth routes
router.use(sanitizeInput({
  body: 'strict',
  customSanitizers: {
    email: sanitizers.email,
    username: sanitizers.username,
    password: (value) => value // Don't sanitize passwords
  }
}));

/**
 * Login with Supabase and get JWT tokens
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Authenticate with Supabase
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password
    });

    if (authError || !authData.user) {
      return res.status(401).json({
        error: authError?.message || 'Invalid credentials'
      });
    }

    const user = authData.user;

    // Get or create user in our database
    let dbUser = await pool.query(
      'SELECT * FROM users WHERE supabase_id = $1',
      [user.id]
    );

    if (dbUser.rows.length === 0) {
      // Create user in our database
      const username = user.user_metadata?.username || email.split('@')[0];
      const createResult = await pool.query(
        `INSERT INTO users (supabase_id, email, username, created_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING *`,
        [user.id, email, username]
      );
      dbUser = createResult;
    }

    const userData = dbUser.rows[0];

    // Generate tokens
    const accessToken = generateAccessToken(userData);
    const refreshToken = generateRefreshToken(userData);

    // Store refresh token in database (hashed)
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const tokenId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await pool.query(
      `INSERT INTO refresh_tokens
       (user_id, token_hash, token_id, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userData.supabase_id,
        tokenHash,
        tokenId,
        expiresAt,
        req.ip,
        req.headers['user-agent']
      ]
    );

    // Update last login
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE supabase_id = $1',
      [userData.supabase_id]
    );

    res.json({
      success: true,
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
      user: {
        id: userData.supabase_id,
        email: userData.email,
        username: userData.username,
        isCreator: userData.is_creator,
        profilePicUrl: userData.profile_pic_url
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      details: error.message
    });
  }
});

/**
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token is required'
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      return res.status(401).json({
        error: error.message
      });
    }

    // Check if refresh token exists in database (including revoked ones for reuse detection)
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const tokenResult = await pool.query(
      `SELECT * FROM refresh_tokens
       WHERE token_hash = $1
         AND user_id = $2`,
      [tokenHash, decoded.id]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid refresh token'
      });
    }

    const tokenRecord = tokenResult.rows[0];

    // CRITICAL: Detect refresh token reuse attack
    if (tokenRecord.is_revoked) {
      // This is a serious security event - a revoked token is being reused
      console.error('⚠️ SECURITY ALERT: Revoked refresh token reuse detected!', {
        userId: decoded.id,
        tokenId: tokenRecord.token_id,
        revokedAt: tokenRecord.revoked_at,
        reason: tokenRecord.revoked_reason
      });

      // Revoke ALL refresh tokens for this user immediately
      await pool.query(
        `UPDATE refresh_tokens
         SET is_revoked = TRUE,
             revoked_at = NOW(),
             revoked_reason = 'security_token_reuse_detected'
         WHERE user_id = $1 AND is_revoked = FALSE`,
        [decoded.id]
      );

      // Increment the user's refresh token version to invalidate all existing tokens
      await pool.query(
        `UPDATE users
         SET refresh_token_version = COALESCE(refresh_token_version, 0) + 1
         WHERE supabase_id = $1`,
        [decoded.id]
      );

      return res.status(401).json({
        error: 'Security alert: Token reuse detected. All sessions have been terminated.',
        code: 'TOKEN_REUSE_DETECTED',
        action: 'Please login again'
      });
    }

    // Check if token is expired
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return res.status(401).json({
        error: 'Refresh token has expired'
      });
    }

    // Get user data
    const userResult = await pool.query(
      'SELECT * FROM users WHERE supabase_id = $1',
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const userData = userResult.rows[0];

    // Generate new access token
    const newAccessToken = generateAccessToken(userData);

    // Always rotate refresh token for enhanced security (make it default)
    const rotateRefreshToken = process.env.ROTATE_REFRESH_TOKENS !== 'false'; // Default to true
    let newRefreshToken = refreshToken;

    if (rotateRefreshToken) {
      // Generate new refresh token
      newRefreshToken = generateRefreshToken(userData);

      // Revoke old refresh token
      await pool.query(
        `UPDATE refresh_tokens
         SET is_revoked = TRUE, revoked_at = NOW(), revoked_reason = 'token_rotation'
         WHERE token_hash = $1`,
        [tokenHash]
      );

      // Store new refresh token
      const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
      const newTokenId = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await pool.query(
        `INSERT INTO refresh_tokens
         (user_id, token_hash, token_id, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userData.supabase_id,
          newTokenHash,
          newTokenId,
          expiresAt,
          req.ip,
          req.headers['user-agent']
        ]
      );
    } else {
      // Update last used timestamp
      await pool.query(
        'UPDATE refresh_tokens SET last_used_at = NOW() WHERE token_hash = $1',
        [tokenHash]
      );
    }

    res.json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900 // 15 minutes in seconds
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      error: 'Token refresh failed',
      details: error.message
    });
  }
});

/**
 * Logout - revoke refresh tokens
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { refreshToken, logoutAll = false } = req.body;

    if (logoutAll) {
      // Revoke all refresh tokens for this user
      await pool.query(
        `UPDATE refresh_tokens
         SET is_revoked = TRUE, revoked_at = NOW(), revoked_reason = 'user_logout_all'
         WHERE user_id = $1 AND is_revoked = FALSE`,
        [userId]
      );
    } else if (refreshToken) {
      // Revoke specific refresh token
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await pool.query(
        `UPDATE refresh_tokens
         SET is_revoked = TRUE, revoked_at = NOW(), revoked_reason = 'user_logout'
         WHERE token_hash = $1 AND user_id = $2`,
        [tokenHash, userId]
      );
    }

    res.json({
      success: true,
      message: logoutAll ? 'Logged out from all devices' : 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      details: error.message
    });
  }
});

/**
 * Get active sessions (refresh tokens)
 */
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;

    const sessions = await pool.query(
      `SELECT
        id,
        created_at,
        last_used_at,
        ip_address,
        user_agent,
        expires_at
       FROM refresh_tokens
       WHERE user_id = $1
         AND is_revoked = FALSE
         AND expires_at > NOW()
       ORDER BY last_used_at DESC NULLS LAST, created_at DESC`,
      [userId]
    );

    // Parse user agents for better display
    const sessionsData = sessions.rows.map(session => ({
      id: session.id,
      createdAt: session.created_at,
      lastUsedAt: session.last_used_at,
      ipAddress: session.ip_address,
      device: parseUserAgent(session.user_agent),
      expiresAt: session.expires_at
    }));

    res.json({
      success: true,
      sessions: sessionsData
    });

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      error: 'Failed to get sessions',
      details: error.message
    });
  }
});

/**
 * Revoke a specific session
 */
router.delete('/sessions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { sessionId } = req.params;

    const result = await pool.query(
      `UPDATE refresh_tokens
       SET is_revoked = TRUE, revoked_at = NOW(), revoked_reason = 'user_revoked'
       WHERE id = $1 AND user_id = $2 AND is_revoked = FALSE
       RETURNING id`,
      [sessionId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Session not found or already revoked'
      });
    }

    res.json({
      success: true,
      message: 'Session revoked successfully'
    });

  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({
      error: 'Failed to revoke session',
      details: error.message
    });
  }
});

/**
 * Helper function to parse user agent
 */
function parseUserAgent(userAgent) {
  if (!userAgent) return 'Unknown Device';

  // Simple parsing - you might want to use a library like 'useragent'
  if (userAgent.includes('Mobile')) {
    if (userAgent.includes('Android')) return 'Android Mobile';
    if (userAgent.includes('iPhone')) return 'iPhone';
    return 'Mobile Device';
  }

  if (userAgent.includes('Chrome')) return 'Chrome Browser';
  if (userAgent.includes('Firefox')) return 'Firefox Browser';
  if (userAgent.includes('Safari')) return 'Safari Browser';
  if (userAgent.includes('Edge')) return 'Edge Browser';

  return 'Web Browser';
}

module.exports = router;