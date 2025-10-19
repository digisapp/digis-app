/**
 * Admin Session Freshness Middleware (2025 Best Practice)
 *
 * Enforces shorter session timeout for admin users (30 minutes).
 * Regular users get 24 hours, admins get 30 minutes for security.
 */

// Get timeout from env or default to 30 minutes
const ADMIN_SESSION_MINUTES = parseInt(process.env.ADMIN_SESSION_MINUTES || '30', 10);
const ADMIN_SESSION_TIMEOUT = ADMIN_SESSION_MINUTES * 60 * 1000; // Convert to milliseconds
const REGULAR_SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if admin session is still fresh
 */
function adminSessionFreshness(req, res, next) {
  try {
    // Emergency bypass (logs the bypass)
    if (process.env.ADMIN_SECURITY_ENFORCED === 'false') {
      console.warn('⚠️ ADMIN SECURITY BYPASSED - EMERGENCY MODE');
      // Still log to audit
      console.error({
        event: 'ADMIN_SECURITY_BYPASS',
        admin: req.user?.email,
        ip: req.headers['x-forwarded-for'] || req.ip,
        timestamp: new Date().toISOString()
      });
      return next();
    }

    const role = req.user?.app_metadata?.role;

    // Only enforce stricter timeout for admins
    if (role !== 'admin') {
      return next();
    }

    // Get last activity from various possible sources
    const lastActiveAt =
      req.user?.last_sign_in_at ||
      req.user?.updated_at ||
      req.user?.created_at;

    if (!lastActiveAt) {
      console.warn('⚠️ No last_active_at timestamp found for admin user');
      return next(); // Allow through but log warning
    }

    const lastActiveTimestamp = new Date(lastActiveAt).getTime();
    const now = Date.now();
    const timeSinceActive = now - lastActiveTimestamp;

    if (timeSinceActive > ADMIN_SESSION_TIMEOUT) {
      console.log(`🔒 Admin session expired: ${timeSinceActive}ms since last activity (limit: ${ADMIN_SESSION_TIMEOUT}ms)`);

      return res.status(401).json({
        error: 'ADMIN_SESSION_EXPIRED',
        message: 'Your admin session has expired due to inactivity. Please log in again.',
        session_expired_at: new Date(lastActiveTimestamp + ADMIN_SESSION_TIMEOUT).toISOString(),
        redirect: '/admin/login'
      });
    }

    // Session is fresh - continue
    next();
  } catch (error) {
    console.error('Admin session freshness check error:', error);
    return res.status(500).json({
      error: 'SESSION_CHECK_FAILED',
      message: 'Failed to verify session freshness'
    });
  }
}

/**
 * Touch admin session activity (updates last_active timestamp)
 * Call this on successful admin requests to extend the session
 */
async function touchAdminSession(req, res, next) {
  const role = req.user?.app_metadata?.role;

  if (role === 'admin') {
    // Store in request context for logging
    req.adminSessionTouched = true;

    // In production, you'd update last_active_at in your session store
    // For Supabase, this is handled automatically on token refresh
  }

  next();
}

/**
 * Get session status for frontend
 */
function getSessionStatus(req, res) {
  try {
    const role = req.user?.app_metadata?.role;
    const lastActiveAt =
      req.user?.last_sign_in_at ||
      req.user?.updated_at ||
      req.user?.created_at;

    const lastActiveTimestamp = new Date(lastActiveAt).getTime();
    const now = Date.now();
    const timeSinceActive = now - lastActiveTimestamp;

    const timeout = role === 'admin' ? ADMIN_SESSION_TIMEOUT : REGULAR_SESSION_TIMEOUT;
    const timeRemaining = timeout - timeSinceActive;

    return res.json({
      success: true,
      session: {
        role: role,
        timeout_ms: timeout,
        time_since_active_ms: timeSinceActive,
        time_remaining_ms: Math.max(0, timeRemaining),
        expires_at: new Date(lastActiveTimestamp + timeout).toISOString(),
        is_expired: timeRemaining <= 0
      }
    });
  } catch (error) {
    console.error('Error getting session status:', error);
    return res.status(500).json({
      error: 'Failed to get session status'
    });
  }
}

module.exports = {
  adminSessionFreshness,
  touchAdminSession,
  getSessionStatus,
  ADMIN_SESSION_TIMEOUT,
  REGULAR_SESSION_TIMEOUT
};
