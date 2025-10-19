const jwt = require('jsonwebtoken');
const { supabase } = require('../utils/supabase-auth');

/**
 * Step-Up Re-Authentication Middleware (2025 Best Practice)
 *
 * Requires recent password confirmation for sensitive admin actions like:
 * - Promoting users to admin
 * - Deleting user accounts
 * - Modifying payment settings
 * - Accessing PII data
 *
 * After re-auth, user gets a short-lived "step-up token" (valid 5-10 min)
 */

const STEP_UP_TOKEN_VALIDITY = 5 * 60 * 1000; // 5 minutes
const STEP_UP_SECRET = process.env.STEP_UP_SECRET || 'change-me-in-production';

/**
 * Require step-up re-authentication
 * @param {Object} options - Configuration options
 * @param {number} options.maxAgeSeconds - Maximum age of re-auth in seconds (default: 300 = 5 min)
 */
function requireStepUp(options = {}) {
  const maxAgeSeconds = options.maxAgeSeconds || 300;
  const maxAge = maxAgeSeconds * 1000; // Convert to milliseconds

  return (req, res, next) => {
    try {
      // Get step-up token from header
      const stepUpToken = req.headers['x-step-up-token'];

      if (!stepUpToken) {
        return res.status(403).json({
          error: 'STEP_UP_REQUIRED',
          message: 'This action requires password confirmation. Please re-authenticate.',
          required_step_up: true
        });
      }

      // Verify step-up token
      try {
        const decoded = jwt.verify(stepUpToken, STEP_UP_SECRET);

        // Check if token is still valid
        const now = Date.now();
        const tokenAge = now - decoded.iat * 1000;

        if (tokenAge > maxAge) {
          return res.status(403).json({
            error: 'STEP_UP_EXPIRED',
            message: 'Your re-authentication has expired. Please confirm your password again.',
            required_step_up: true
          });
        }

        // Check if token belongs to current user
        const userId = req.user?.id || req.user?.supabase_id;
        if (decoded.sub !== userId) {
          return res.status(403).json({
            error: 'STEP_UP_INVALID',
            message: 'Invalid re-authentication token.',
            required_step_up: true
          });
        }

        // Store step-up info in request
        req.stepUp = {
          verified: true,
          timestamp: decoded.iat * 1000,
          age_ms: tokenAge
        };

        next();
      } catch (jwtError) {
        console.error('Step-up token verification failed:', jwtError);
        return res.status(403).json({
          error: 'STEP_UP_INVALID',
          message: 'Invalid re-authentication token.',
          required_step_up: true
        });
      }
    } catch (error) {
      console.error('Step-up re-auth error:', error);
      return res.status(500).json({
        error: 'STEP_UP_CHECK_FAILED',
        message: 'Failed to verify re-authentication'
      });
    }
  };
}

/**
 * Endpoint to perform step-up re-authentication
 * Frontend calls this with password to get a step-up token
 */
async function performStepUp(req, res) {
  try {
    const { password } = req.body;
    const userEmail = req.user?.email;
    const userId = req.user?.id || req.user?.supabase_id;

    if (!password) {
      return res.status(400).json({
        error: 'Password required'
      });
    }

    if (!userEmail) {
      return res.status(401).json({
        error: 'User email not found'
      });
    }

    // Verify password with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: password
    });

    if (error) {
      console.error('Step-up re-auth failed:', error);
      return res.status(401).json({
        error: 'INVALID_PASSWORD',
        message: 'Invalid password. Please try again.'
      });
    }

    if (!data.user) {
      return res.status(401).json({
        error: 'Authentication failed'
      });
    }

    // Generate step-up token (short-lived)
    const stepUpToken = jwt.sign(
      {
        sub: userId,
        email: userEmail,
        step_up: true
      },
      STEP_UP_SECRET,
      {
        expiresIn: '5m', // 5 minutes
        issuer: 'digis-admin'
      }
    );

    return res.json({
      success: true,
      step_up_token: stepUpToken,
      expires_in: STEP_UP_TOKEN_VALIDITY,
      expires_at: new Date(Date.now() + STEP_UP_TOKEN_VALIDITY).toISOString(),
      message: 'Re-authentication successful'
    });
  } catch (error) {
    console.error('Step-up re-auth error:', error);
    return res.status(500).json({
      error: 'Step-up authentication failed'
    });
  }
}

/**
 * Check if current request has valid step-up (for frontend to poll)
 */
function checkStepUpStatus(req, res) {
  try {
    const stepUpToken = req.headers['x-step-up-token'];

    if (!stepUpToken) {
      return res.json({
        step_up_valid: false,
        required_step_up: true
      });
    }

    try {
      const decoded = jwt.verify(stepUpToken, STEP_UP_SECRET);
      const now = Date.now();
      const tokenAge = now - decoded.iat * 1000;
      const timeRemaining = STEP_UP_TOKEN_VALIDITY - tokenAge;

      const userId = req.user?.id || req.user?.supabase_id;

      if (decoded.sub !== userId) {
        return res.json({
          step_up_valid: false,
          required_step_up: true
        });
      }

      return res.json({
        step_up_valid: timeRemaining > 0,
        time_remaining_ms: Math.max(0, timeRemaining),
        expires_at: new Date(decoded.iat * 1000 + STEP_UP_TOKEN_VALIDITY).toISOString()
      });
    } catch (jwtError) {
      return res.json({
        step_up_valid: false,
        required_step_up: true
      });
    }
  } catch (error) {
    console.error('Step-up status check error:', error);
    return res.status(500).json({
      error: 'Failed to check step-up status'
    });
  }
}

module.exports = {
  requireStepUp,
  performStepUp,
  checkStepUpStatus,
  STEP_UP_TOKEN_VALIDITY
};
