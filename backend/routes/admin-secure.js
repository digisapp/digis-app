/**
 * Admin Routes with 2025 Security Best Practices
 *
 * This file demonstrates how to wire up all security middlewares.
 * Replace your existing admin.js with this approach.
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const { getUserId } = require('../utils/auth-helpers');

// ============================================================================
// IMPORT ALL SECURITY MIDDLEWARES
// ============================================================================
const { auditLog } = require('../middleware/adminAudit');
const { requireMFA, getMFAStatus } = require('../middleware/requireMFA');
const { adminSessionFreshness, getSessionStatus } = require('../middleware/adminSessionFreshness');
const { requireStepUp, performStepUp, checkStepUpStatus } = require('../middleware/stepUpReauth');
const {
  adminRateLimiter,
  sensitiveActionLimiter,
  adminLoginLimiter,
  exportLimiter
} = require('../middleware/adminRateLimit');
const { ipAllowlist, getAllowlistStatus } = require('../middleware/ipAllowlist');

// ============================================================================
// ADMIN ROLE CHECK (from app_metadata)
// ============================================================================
const requireAdmin = (req, res, next) => {
  const role = req.user?.app_metadata?.role;

  if (role !== 'admin') {
    return res.status(403).json({
      error: 'ADMIN_ACCESS_REQUIRED',
      message: 'You must be an administrator to access this resource'
    });
  }

  req.isAdmin = true;
  next();
};

// ============================================================================
// MIDDLEWARE CHAIN FOR ALL ADMIN ROUTES
// ============================================================================
// Apply these to ALL /admin/* routes
router.use(
  authenticateToken,         // 1. Verify JWT token
  requireAdmin,              // 2. Check admin role from app_metadata
  requireMFA,                // 3. Enforce MFA enrollment
  adminSessionFreshness,     // 4. Check 30-min session timeout
  adminRateLimiter,          // 5. Rate limit admin requests
  ipAllowlist                // 6. Optional IP allowlist
);

// ============================================================================
// PUBLIC ENDPOINTS (before middleware chain)
// ============================================================================

// Health check (no auth required)
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'admin-api' });
});

// ============================================================================
// SESSION & AUTH STATUS ENDPOINTS
// ============================================================================

// Get current session status
router.get('/session/status', getSessionStatus);

// Get MFA status
router.get('/mfa/status', getMFAStatus);

// Perform step-up re-authentication
router.post('/stepup/reauth', performStepUp);

// Check step-up status
router.get('/stepup/status', checkStepUpStatus);

// Get IP allowlist status
router.get('/allowlist/status', getAllowlistStatus);

// ============================================================================
// STANDARD ADMIN ROUTES (with automatic audit logging)
// ============================================================================

// Get all users
router.get('/users',
  auditLog('ADMIN_VIEW_USERS'),
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          u.id,
          u.supabase_id,
          u.email,
          u.username,
          u.display_name,
          u.is_creator,
          u.is_super_admin,
          u.role,
          u.created_at,
          COALESCE(tb.balance, 0) as token_balance
        FROM users u
        LEFT JOIN token_balances tb ON u.supabase_id::text = tb.user_id::text
        ORDER BY u.created_at DESC
        LIMIT 500
      `);

      res.json({
        success: true,
        users: result.rows,
        total: result.rows.length
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({
        error: 'Failed to fetch users',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Get creator applications
router.get('/creator-applications',
  auditLog('ADMIN_VIEW_APPLICATIONS'),
  async (req, res) => {
    try {
      const { status = 'pending' } = req.query;

      const result = await pool.query(`
        SELECT
          ca.*,
          u.email,
          u.username,
          u.display_name
        FROM creator_applications ca
        LEFT JOIN users u ON ca.user_id = u.supabase_id
        WHERE ca.status = $1
        ORDER BY ca.created_at DESC
        LIMIT 100
      `, [status]);

      res.json({
        success: true,
        applications: result.rows,
        total: result.rows.length
      });
    } catch (error) {
      console.error('Error fetching applications:', error);
      res.status(500).json({ error: 'Failed to fetch applications' });
    }
  }
);

// Approve creator application
router.put('/creator-applications/:applicationId/approve',
  auditLog('ADMIN_APPROVE_CREATOR'),
  async (req, res) => {
    const { applicationId } = req.params;

    try {
      // Get application details
      const app = await pool.query(
        'SELECT * FROM creator_applications WHERE id = $1',
        [applicationId]
      );

      if (app.rows.length === 0) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const application = app.rows[0];

      // Update application status
      await pool.query(
        'UPDATE creator_applications SET status = $1, reviewed_at = NOW(), reviewed_by = $2 WHERE id = $3',
        ['approved', getUserId(req), applicationId]
      );

      // Promote user to creator
      await pool.query(
        'UPDATE users SET is_creator = true, role = $1 WHERE supabase_id = $2',
        ['creator', application.user_id]
      );

      res.json({
        success: true,
        message: 'Creator application approved'
      });
    } catch (error) {
      console.error('Error approving application:', error);
      res.status(500).json({ error: 'Failed to approve application' });
    }
  }
);

// ============================================================================
// SENSITIVE ACTIONS (require step-up re-auth + extra rate limiting)
// ============================================================================

// Update user role (SENSITIVE)
router.put('/users/:userId/role',
  sensitiveActionLimiter,
  requireStepUp(5 * 60 * 1000), // Require re-auth within last 5 minutes
  auditLog('ADMIN_UPDATE_USER_ROLE'),
  async (req, res) => {
    const { userId } = req.params;
    const { role, is_creator, is_super_admin } = req.body;

    try {
      const updates = [];
      const values = [];
      let paramCount = 0;

      if (role !== undefined) {
        paramCount++;
        updates.push(`role = $${paramCount}`);
        values.push(role);
      }

      if (is_creator !== undefined) {
        paramCount++;
        updates.push(`is_creator = $${paramCount}`);
        values.push(is_creator);
      }

      if (is_super_admin !== undefined) {
        paramCount++;
        updates.push(`is_super_admin = $${paramCount}`);
        values.push(is_super_admin);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }

      paramCount++;
      values.push(userId);

      await pool.query(
        `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE supabase_id = $${paramCount}`,
        values
      );

      res.json({
        success: true,
        message: 'User role updated successfully'
      });
    } catch (error) {
      console.error('Error updating user role:', error);
      res.status(500).json({ error: 'Failed to update user role' });
    }
  }
);

// Delete user account (SENSITIVE)
router.delete('/users/:userId',
  sensitiveActionLimiter,
  requireStepUp(5 * 60 * 1000),
  auditLog('ADMIN_DELETE_USER'),
  async (req, res) => {
    const { userId } = req.params;

    try {
      // Soft delete by default (can be hard delete with ?permanent=true)
      const permanent = req.query.permanent === 'true';

      if (permanent) {
        await pool.query('DELETE FROM users WHERE supabase_id = $1', [userId]);
      } else {
        await pool.query(
          'UPDATE users SET deleted_at = NOW(), updated_at = NOW() WHERE supabase_id = $1',
          [userId]
        );
      }

      res.json({
        success: true,
        message: permanent ? 'User permanently deleted' : 'User account deactivated'
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }
);

// Grant tokens (SENSITIVE)
router.post('/users/:userId/grant-tokens',
  sensitiveActionLimiter,
  requireStepUp(5 * 60 * 1000),
  auditLog('ADMIN_GRANT_TOKENS'),
  async (req, res) => {
    const { userId } = req.params;
    const { amount, reason } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid token amount' });
    }

    try {
      // Update token balance
      await pool.query(`
        INSERT INTO token_balances (user_id, balance)
        VALUES ($1, $2)
        ON CONFLICT (user_id)
        DO UPDATE SET balance = token_balances.balance + $2
      `, [userId, amount]);

      // Log transaction
      await pool.query(`
        INSERT INTO transactions (user_id, type, amount, description, created_at)
        VALUES ($1, 'admin_grant', $2, $3, NOW())
      `, [userId, amount, reason || 'Admin token grant']);

      res.json({
        success: true,
        message: `Granted ${amount} tokens to user`
      });
    } catch (error) {
      console.error('Error granting tokens:', error);
      res.status(500).json({ error: 'Failed to grant tokens' });
    }
  }
);

// ============================================================================
// DATA EXPORT ROUTES (with export rate limiter)
// ============================================================================

// Export user data
router.get('/export/users',
  exportLimiter,
  auditLog('ADMIN_EXPORT_USERS'),
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          u.id,
          u.email,
          u.username,
          u.display_name,
          u.is_creator,
          u.role,
          u.created_at,
          COALESCE(tb.balance, 0) as token_balance
        FROM users u
        LEFT JOIN token_balances tb ON u.supabase_id::text = tb.user_id::text
        ORDER BY u.created_at DESC
      `);

      res.json({
        success: true,
        data: result.rows,
        total: result.rows.length,
        exported_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error exporting users:', error);
      res.status(500).json({ error: 'Failed to export users' });
    }
  }
);

// Export audit logs
router.get('/export/audit-logs',
  exportLimiter,
  auditLog('ADMIN_EXPORT_AUDIT_LOGS'),
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          al.*,
          u.email as admin_email,
          u.username as admin_username
        FROM audit_logs al
        LEFT JOIN users u ON al.admin_id = u.supabase_id
        ORDER BY al.timestamp DESC
        LIMIT 10000
      `);

      res.json({
        success: true,
        data: result.rows,
        total: result.rows.length,
        exported_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error exporting audit logs:', error);
      res.status(500).json({ error: 'Failed to export audit logs' });
    }
  }
);

// ============================================================================
// AUDIT LOG VIEWING
// ============================================================================

// Get audit logs (read-only)
router.get('/audit-logs',
  auditLog('ADMIN_VIEW_AUDIT_LOGS'),
  async (req, res) => {
    try {
      const { limit = 100, offset = 0 } = req.query;

      const result = await pool.query(`
        SELECT
          al.*,
          u.username as admin_username,
          u.email as admin_email
        FROM audit_logs al
        LEFT JOIN users u ON al.admin_id = u.supabase_id
        ORDER BY al.timestamp DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]);

      res.json({
        success: true,
        logs: result.rows,
        total: result.rows.length
      });
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  }
);

// ============================================================================
// STATISTICS & DASHBOARD
// ============================================================================

// Get admin dashboard stats
router.get('/stats',
  auditLog('ADMIN_VIEW_STATS'),
  async (req, res) => {
    try {
      const stats = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM users) as total_users,
          (SELECT COUNT(*) FROM users WHERE is_creator = true) as total_creators,
          (SELECT COUNT(*) FROM users WHERE role = 'fan') as total_fans,
          (SELECT COUNT(*) FROM creator_applications WHERE status = 'pending') as pending_applications,
          (SELECT COALESCE(SUM(balance), 0) FROM token_balances) as total_tokens_in_circulation,
          (SELECT COUNT(*) FROM sessions WHERE created_at > NOW() - INTERVAL '24 hours') as sessions_last_24h
      `);

      res.json({
        success: true,
        stats: stats.rows[0]
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  }
);

module.exports = router;
