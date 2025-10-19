const { pool } = require('../utils/db');
const { getUserId } = require('../utils/auth-helpers');

/**
 * Admin Audit Logging Middleware (2025 Best Practice)
 *
 * Automatically logs ALL admin actions with:
 * - Action performed
 * - IP address
 * - User agent
 * - Request details
 * - Timestamp
 *
 * This ensures comprehensive audit trail for compliance and security.
 */

/**
 * Automatic audit logger for admin routes
 * Usage: Add to any admin route AFTER requireAdmin middleware
 *
 * Example:
 *   router.put('/users/:id/role', authenticateToken, requireAdmin, auditLog('UPDATE_USER_ROLE'), async (req, res) => {
 *     // ... your route logic
 *   });
 */
const auditLog = (actionType) => {
  return async (req, res, next) => {
    // Store original res.json to intercept responses
    const originalJson = res.json.bind(res);

    // Capture start time for performance tracking
    const startTime = Date.now();

    // Override res.json to capture response and log after action completes
    res.json = function(data) {
      const duration = Date.now() - startTime;

      // Log to audit table asynchronously (don't block response)
      logAdminAction({
        adminId: getUserId(req),
        action: actionType,
        details: {
          method: req.method,
          path: req.path,
          params: req.params,
          query: req.query,
          body: sanitizeBody(req.body), // Remove sensitive fields
          response_status: res.statusCode,
          success: data?.success !== false,
          duration_ms: duration
        },
        ipAddress: getClientIp(req),
        userAgent: req.get('user-agent')
      }).catch(err => {
        // Log error but don't fail the request
        console.error('❌ Failed to write audit log:', err);
      });

      // Call original json method
      return originalJson(data);
    };

    next();
  };
};

/**
 * Write audit log to database
 */
async function logAdminAction({ adminId, action, details, ipAddress, userAgent }) {
  try {
    await pool.query(
      `INSERT INTO audit_logs
        (admin_id, action, details, ip_address, user_agent, timestamp)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        adminId,
        action,
        JSON.stringify(details),
        ipAddress,
        userAgent
      ]
    );
  } catch (error) {
    console.error('❌ Audit log insertion failed:', error);
    // Don't throw - we don't want audit failures to break admin operations
    // But log to external monitoring service (DataDog, Sentry, etc.)
  }
}

/**
 * Get client IP address (handles proxies and load balancers)
 */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         'unknown';
}

/**
 * Sanitize request body to remove sensitive information
 */
function sanitizeBody(body) {
  if (!body) return null;

  const sanitized = { ...body };

  // Remove sensitive fields
  const sensitiveFields = [
    'password',
    'token',
    'api_key',
    'secret',
    'credit_card',
    'ssn',
    'stripe_secret_key'
  ];

  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Query audit logs with filtering and pagination
 */
async function getAuditLogs({
  adminId = null,
  action = null,
  startDate = null,
  endDate = null,
  limit = 100,
  offset = 0
}) {
  let query = `
    SELECT
      al.*,
      u.username as admin_username,
      u.email as admin_email
    FROM audit_logs al
    LEFT JOIN users u ON al.admin_id = u.supabase_id
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 0;

  if (adminId) {
    paramCount++;
    query += ` AND al.admin_id = $${paramCount}`;
    params.push(adminId);
  }

  if (action) {
    paramCount++;
    query += ` AND al.action = $${paramCount}`;
    params.push(action);
  }

  if (startDate) {
    paramCount++;
    query += ` AND al.timestamp >= $${paramCount}`;
    params.push(startDate);
  }

  if (endDate) {
    paramCount++;
    query += ` AND al.timestamp <= $${paramCount}`;
    params.push(endDate);
  }

  query += ` ORDER BY al.timestamp DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
}

module.exports = {
  auditLog,
  logAdminAction,
  getAuditLogs,
  getClientIp
};
