const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db'); // Use shared pool
const { authenticateToken } = require('../middleware/auth');
const { getUserId } = require('../utils/auth-helpers');
const { buildSafeUpdate, ALLOWED_COLUMNS } = require('../utils/sql-builders');
const { sendCreatorApprovalEmail } = require('../services/emailService');

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
  try {
    // Get user ID consistently using helper
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' });
    }
    
    const userQuery = await pool.query(
      'SELECT role FROM users WHERE supabase_id = $1',
      [userId]
    );

    if (userQuery.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userQuery.rows[0];
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.isAdmin = true;
    next();
  } catch (error) {
    console.error('❌ Error checking /* admin removed */ status:', error);
    res.status(500).json({ error: 'Failed to verify /* admin removed */ status' });
  }
};

// Get all users for admin management
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
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
        u.creator_type,
        u.created_at,
        u.updated_at,
        COALESCE(tb.balance, 0) as token_balance,
        (SELECT COUNT(*) FROM followers WHERE creator_id::text = u.supabase_id::text) as follower_count
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
    console.error('Error fetching users for admin:', error);
    res.status(500).json({
      error: 'Failed to fetch users',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update user role (admin/creator status)
router.put('/users/:userId/role', authenticateToken, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { is_super_admin, is_creator, role, creator_type } = req.body;

  try {
    // Build safe update query using whitelisted columns
    const updates = {};

    // Only include fields that were provided
    if (is_super_admin !== undefined) {
      updates.is_super_admin = is_super_admin;
    }
    if (is_creator !== undefined) {
      updates.is_creator = is_creator;
    }
    if (role !== undefined) {
      updates.role = role;
    }
    if (creator_type !== undefined) {
      updates.creator_type = creator_type;
    }

    // Build safe query with SQL builder
    const { query, values } = buildSafeUpdate(
      'users',
      updates,
      ALLOWED_COLUMNS.users,
      { supabase_id: userId }
    );

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = result.rows[0];
    
    console.log('✅ User role updated by admin:', {
      adminId: req.user.supabase_id,
      userId: userId,
      updates: { is_super_admin, is_creator, role, creator_type }
    });

    res.json({
      success: true,
      message: `User ${updatedUser.email} updated successfully`,
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({
      error: 'Failed to update user',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get all pending creator applications
router.get('/creator-applications', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status = 'pending', limit = 50, offset = 0 } = req.query;

    const applicationsQuery = await pool.query(`
      SELECT 
        ca.*,
        u.username,
        u.email,
        u.profile_pic_url,
        u.created_at as user_created_at,
        u.total_spent,
        u.last_active
      FROM creator_applications ca
      LEFT JOIN users u ON ca.user_id::text = u.supabase_id::text
      WHERE ca.status = $1
      ORDER BY ca.created_at ASC
      LIMIT $2 OFFSET $3
    `, [status, limit, offset]);

    const applications = applicationsQuery.rows.map(app => ({
      id: app.id,
      userId: app.user_id,
      username: app.username,
      email: app.email,
      profilePic: app.profile_pic_url,
      bio: app.bio,
      specialties: app.specialties,
      experience: app.experience,
      socialMedia: app.social_media,
      pricing: app.pricing,
      availability: app.availability,
      status: app.status,
      submittedAt: app.created_at,
      reviewedAt: app.reviewed_at,
      reviewedBy: app.reviewed_by,
      reviewNotes: app.review_notes,
      userStats: {
        memberSince: app.user_created_at,
        totalSpent: parseFloat(app.total_spent) || 0,
        lastActive: app.last_active
      }
    }));

    // Get total count
    const countQuery = await pool.query(
      'SELECT COUNT(*) as total FROM creator_applications WHERE status = $1',
      [status]
    );

    res.json({
      success: true,
      applications,
      pagination: {
        total: parseInt(countQuery.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching creator applications:', error);
    res.status(500).json({ error: 'Failed to fetch creator applications' });
  }
});

// Get single creator application details
router.get('/creator-applications/:applicationId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { applicationId } = req.params;

    const appQuery = await pool.query(`
      SELECT 
        ca.*,
        u.username,
        u.email,
        u.profile_pic_url,
        u.created_at as user_created_at,
        u.total_spent,
        u.total_sessions,
        u.last_active,
        (SELECT COUNT(*) FROM payments WHERE user_supabase_id = u.supabase_id) as transaction_count,
        (SELECT COUNT(*) FROM sessions WHERE fan_id = (SELECT id FROM users WHERE supabase_id = u.supabase_id)) as session_count
      FROM creator_applications ca
      LEFT JOIN users u ON ca.user_id::text = u.supabase_id::text
      WHERE ca.id = $1
    `, [applicationId]);

    if (appQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const app = appQuery.rows[0];

    res.json({
      success: true,
      application: {
        id: app.id,
        userId: app.user_id,
        username: app.username,
        email: app.email,
        profilePic: app.profile_pic_url,
        bio: app.bio,
        specialties: app.specialties,
        experience: app.experience,
        socialMedia: app.social_media,
        pricing: app.pricing,
        availability: app.availability,
        status: app.status,
        submittedAt: app.created_at,
        reviewedAt: app.reviewed_at,
        reviewedBy: app.reviewed_by,
        reviewNotes: app.review_notes,
        userStats: {
          memberSince: app.user_created_at,
          totalSpent: parseFloat(app.total_spent) || 0,
          totalSessions: parseInt(app.total_sessions) || 0,
          transactionCount: parseInt(app.transaction_count) || 0,
          sessionCount: parseInt(app.session_count) || 0,
          lastActive: app.last_active
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching application details:', error);
    res.status(500).json({ error: 'Failed to fetch application details' });
  }
});

// Approve creator application
router.post('/creator-applications/:applicationId/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { reviewNotes = '' } = req.body;
    const adminId = req.user.supabase_id;

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get application details
      const appQuery = await client.query(
        'SELECT user_id, pricing FROM creator_applications WHERE id = $1 AND status = $2',
        [applicationId, 'pending']
      );

      if (appQuery.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Pending application not found' });
      }

      const { user_id: userId, pricing } = appQuery.rows[0];

      // Update user to creator status
      await client.query(`
        UPDATE users SET
          is_creator = true,
          role = 'creator',
          video_rate_cents = $1,
          voice_rate_cents = $2,
          stream_rate_cents = $3,
          message_price_cents = $4,
          updated_at = NOW()
        WHERE supabase_id = $5
      `, [
        (pricing.videoCall || 30) * 100,  // Convert dollars to cents
        (pricing.voiceCall || 20) * 100,
        (pricing.privateStream || 50) * 100,
        500,  // Default $5 for messages
        userId
      ]);

      // Update application status
      await client.query(`
        UPDATE creator_applications SET 
          status = 'approved',
          reviewed_at = NOW(),
          reviewed_by = $1,
          review_notes = $2
        WHERE id = $3
      `, [adminId, reviewNotes, applicationId]);

      // Create notification for user
      await client.query(`
        INSERT INTO notifications (recipient_id, type, title, content, created_at)
        VALUES ($1, 'creator_approved', 'Creator Application Approved!', 
                'Congratulations! Your creator application has been approved. You can now start streaming and earning on Digis!', NOW())
      `, [userId]);
      
      // Get user email and username for notification
      const userEmailQuery = await client.query(
        'SELECT email, username, display_name FROM users WHERE supabase_id = $1',
        [userId]
      );

      if (userEmailQuery.rows.length > 0) {
        const { email, username, display_name } = userEmailQuery.rows[0];

        // Send creator approval email (non-blocking)
        sendCreatorApprovalEmail(email, display_name || username || 'Creator').catch(emailError => {
          console.error('Failed to send creator approval email:', emailError.message);
        });
      }

      // Award creator welcome badge
      try {
        await client.query(`
          INSERT INTO achievements (user_id, type, title, description, points, metadata, created_at)
          VALUES ($1, 'milestone', 'Welcome Creator!', 'Successfully became a Digis creator', 200, 
                  json_build_object('applicationId', $2), NOW())
        `, [userId, applicationId]);
      } catch (badgeError) {
        console.log('Note: Could not award creator badge (achievements table may not exist yet)');
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Creator application approved successfully',
        userId
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Error approving creator application:', error);
    res.status(500).json({ error: 'Failed to approve creator application' });
  }
});

// Reject creator application
router.post('/creator-applications/:applicationId/reject', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { reviewNotes = '', reason = 'Application did not meet requirements' } = req.body;
    const adminId = req.user.supabase_id;

    // Get application details
    const appQuery = await pool.query(
      'SELECT user_id FROM creator_applications WHERE id = $1 AND status = $2',
      [applicationId, 'pending']
    );

    if (appQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Pending application not found' });
    }

    const { user_id: userId } = appQuery.rows[0];

    // Update application status
    await pool.query(`
      UPDATE creator_applications SET 
        status = 'rejected',
        reviewed_at = NOW(),
        reviewed_by = $1,
        review_notes = $2,
        rejection_reason = $3
      WHERE id = $4
    `, [adminId, reviewNotes, reason, applicationId]);

    // Create notification for user
    await pool.query(`
      INSERT INTO notifications (recipient_id, type, title, content, created_at)
      VALUES ($1, 'creator_rejected', 'Creator Application Update', 
              $2, NOW())
    `, [userId, `Your creator application has been reviewed. ${reason}${reviewNotes ? ` Additional notes: ${reviewNotes}` : ''} You can reapply after addressing the feedback.`]);

    res.json({
      success: true,
      message: 'Creator application rejected',
      userId
    });

  } catch (error) {
    console.error('❌ Error rejecting creator application:', error);
    res.status(500).json({ error: 'Failed to reject creator application' });
  }
});

// Get application statistics
router.get('/stats/creator-applications', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const statsQuery = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as this_week,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as this_month,
        AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at))/86400) FILTER (WHERE reviewed_at IS NOT NULL) as avg_review_time_days
      FROM creator_applications
    `);

    const stats = statsQuery.rows[0];

    // Get recent activity
    const recentQuery = await pool.query(`
      SELECT 
        ca.status,
        ca.created_at,
        ca.reviewed_at,
        u.username
      FROM creator_applications ca
      LEFT JOIN users u ON ca.user_id::text = u.supabase_id::text
      ORDER BY COALESCE(ca.reviewed_at, ca.created_at) DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      stats: {
        pending: parseInt(stats.pending_count) || 0,
        approved: parseInt(stats.approved_count) || 0,
        rejected: parseInt(stats.rejected_count) || 0,
        thisWeek: parseInt(stats.this_week) || 0,
        thisMonth: parseInt(stats.this_month) || 0,
        avgReviewTimeDays: parseFloat(stats.avg_review_time_days) || 0,
        total: (parseInt(stats.pending_count) || 0) + (parseInt(stats.approved_count) || 0) + (parseInt(stats.rejected_count) || 0)
      },
      recentActivity: recentQuery.rows.map(row => ({
        status: row.status,
        username: row.username,
        submittedAt: row.created_at,
        reviewedAt: row.reviewed_at
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching application stats:', error);
    res.status(500).json({ error: 'Failed to fetch application statistics' });
  }
});

// Bulk approve creators
router.post('/creator-applications/bulk-approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { applicationIds, reviewNotes = 'Bulk approved' } = req.body;
    const adminId = req.user.supabase_id;

    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      return res.status(400).json({ error: 'Application IDs array is required' });
    }

    const client = await pool.connect();
    const results = [];

    try {
      await client.query('BEGIN');

      for (const applicationId of applicationIds) {
        try {
          // Get application details
          const appQuery = await client.query(
            'SELECT user_id, pricing FROM creator_applications WHERE id = $1 AND status = $2',
            [applicationId, 'pending']
          );

          if (appQuery.rows.length === 0) {
            results.push({ applicationId, success: false, error: 'Application not found or not pending' });
            continue;
          }

          const { user_id: userId, pricing } = appQuery.rows[0];

          // Update user to creator status
          await client.query(`
            UPDATE users SET
              is_creator = true,
              role = 'creator',
              video_rate_cents = $1,
              voice_rate_cents = $2,
              stream_rate_cents = $3,
              message_price_cents = $4,
              updated_at = NOW()
            WHERE supabase_id = $5
          `, [
            (pricing.videoCall || 30) * 100,  // Convert dollars to cents
            (pricing.voiceCall || 20) * 100,
            (pricing.privateStream || 50) * 100,
            500,  // Default $5 for messages
            userId
          ]);

          // Update application status
          await client.query(`
            UPDATE creator_applications SET 
              status = 'approved',
              reviewed_at = NOW(),
              reviewed_by = $1,
              review_notes = $2
            WHERE id = $3
          `, [adminId, reviewNotes, applicationId]);

          // Create notification
          await client.query(`
            INSERT INTO notifications (recipient_id, type, title, content, created_at)
            VALUES ($1, 'creator_approved', 'Creator Application Approved!',
                    'Congratulations! Your creator application has been approved. You can now start streaming and earning on Digis!', NOW())
          `, [userId]);

          // Get user info and send approval email
          const userInfo = await client.query(
            'SELECT email, username, display_name FROM users WHERE supabase_id = $1',
            [userId]
          );

          if (userInfo.rows.length > 0) {
            const { email, username, display_name } = userInfo.rows[0];
            // Send creator approval email (non-blocking)
            sendCreatorApprovalEmail(email, display_name || username || 'Creator').catch(emailError => {
              console.error(`Failed to send approval email for ${email}:`, emailError.message);
            });
          }

          results.push({ applicationId, success: true, userId });

        } catch (error) {
          console.error(`Error processing application ${applicationId}:`, error);
          results.push({ applicationId, success: false, error: error.message });
        }
      }

      await client.query('COMMIT');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Bulk approval completed: ${successful} approved, ${failed} failed`,
      results,
      summary: { successful, failed, total: applicationIds.length }
    });

  } catch (error) {
    console.error('❌ Error bulk approving applications:', error);
    res.status(500).json({ error: 'Failed to bulk approve applications' });
  }
});

// Analytics Dashboard Route
router.get('/analytics/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Revenue data
    const revenueQuery = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        SUM(amount) as amount
      FROM payments
      WHERE created_at >= $1
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [weekAgo]);

    // Growth data
    const growthQuery = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as users
      FROM users
      WHERE created_at >= $1
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [monthAgo]);

    // Performance data
    const performanceQuery = await pool.query(`
      SELECT 
        u.username as creator,
        COUNT(DISTINCT s.id) as sessions,
        SUM(s.total_amount) as earnings
      FROM users u
      JOIN sessions s ON s.creator_id = u.id
      WHERE u.is_creator = true
        AND s.created_at >= $1
      GROUP BY u.id, u.username
      ORDER BY earnings DESC
      LIMIT 10
    `, [weekAgo]);

    // Conversion data
    const conversionQuery = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM creator_applications
      GROUP BY status
    `);

    res.json({
      revenue: revenueQuery.rows,
      growth: growthQuery.rows,
      performance: performanceQuery.rows,
      conversions: conversionQuery.rows
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Activity Feed Route
router.get('/activity-feed', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const activities = await pool.query(`
      (
        SELECT 
          'new_user' as type,
          CONCAT('New user registered: ', username) as message,
          created_at as timestamp
        FROM users
        ORDER BY created_at DESC
        LIMIT 10
      )
      UNION ALL
      (
        SELECT 
          'new_application' as type,
          CONCAT('New creator application from ', u.username) as message,
          ca.created_at as timestamp
        FROM creator_applications ca
        JOIN users u ON ca.user_id::text = u.supabase_id::text
        ORDER BY ca.created_at DESC
        LIMIT 10
      )
      UNION ALL
      (
        SELECT 
          'new_session' as type,
          CONCAT('Session started between fan and creator') as message,
          s.created_at as timestamp
        FROM sessions s
        WHERE s.created_at IS NOT NULL
        ORDER BY s.created_at DESC
        LIMIT 10
      )
      ORDER BY timestamp DESC
      LIMIT 50
    `);

    res.json({ activities: activities.rows });
  } catch (error) {
    console.error('Error fetching activity feed:', error);
    res.status(500).json({ error: 'Failed to fetch activity feed' });
  }
});

// Analytics Dashboard Route
router.get('/analytics/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get revenue data
    const revenueQuery = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        SUM(amount) as revenue,
        COUNT(*) as transactions
      FROM payments
      WHERE status = 'completed'
      AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    // Get user growth data
    const growthQuery = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as new_users,
        SUM(CASE WHEN is_creator THEN 1 ELSE 0 END) as new_creators
      FROM users
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    // Get platform metrics
    const metricsQuery = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE is_creator = true) as total_creators,
        (SELECT COUNT(*) FROM sessions WHERE created_at >= NOW() - INTERVAL '24 hours') as sessions_today,
        (SELECT SUM(amount) FROM payments WHERE created_at >= NOW() - INTERVAL '24 hours' AND status = 'completed') as revenue_today
    `);

    res.json({
      revenue: revenueQuery.rows,
      growth: growthQuery.rows,
      metrics: metricsQuery.rows[0],
      performance: [],
      conversions: []
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Audit Logs Route
router.get('/audit-logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const logs = await pool.query(`
      SELECT 
        al.*,
        u.username as admin_username
      FROM audit_logs al
      LEFT JOIN users u ON al.admin_id = u.supabase_id
      ORDER BY al.timestamp DESC
      LIMIT 100
    `);

    res.json({ logs: logs.rows });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Create Audit Log Entry
router.post('/audit-log', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { action, details, timestamp } = req.body;
    
    await pool.query(`
      INSERT INTO audit_logs (admin_id, action, details, timestamp)
      VALUES ($1, $2, $3, $4)
    `, [req.user.supabase_id, action, JSON.stringify(details), timestamp || new Date()]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error creating audit log:', error);
    res.status(500).json({ error: 'Failed to create audit log' });
  }
});

// Moderation Reports Route
router.get('/moderation/reports', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const reports = await pool.query(`
      SELECT 
        r.*,
        u.username as reporter_username,
        ru.username as reported_username
      FROM content_reports r
      LEFT JOIN users u ON r.reporter_id = u.supabase_id
      LEFT JOIN users ru ON r.reported_user_id = ru.supabase_id
      WHERE r.status = 'pending'
      ORDER BY r.created_at DESC
      LIMIT 50
    `);

    res.json({ reports: reports.rows });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Export Data Route
router.post('/export/:format', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { format } = req.params;
    const { type, filters, selection } = req.body;
    
    let query = '';
    let params = [];
    
    if (type === 'applications' || type === 'pending') {
      query = `
        SELECT 
          ca.*,
          u.username,
          u.email
        FROM creator_applications ca
        JOIN users u ON ca.user_id::text = u.supabase_id::text
        WHERE 1=1
      `;
      
      if (filters?.status && filters.status !== 'all') {
        query += ` AND ca.status = $${params.length + 1}`;
        params.push(filters.status);
      }
      
      if (selection?.length > 0) {
        query += ` AND ca.id = ANY($${params.length + 1})`;
        params.push(selection);
      }
    }
    
    const result = await pool.query(query, params);
    
    if (format === 'csv') {
      const csv = convertToCSV(result.rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="export-${Date.now()}.csv"`);
      res.send(csv);
    } else if (format === 'json') {
      res.json(result.rows);
    }
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Helper function to convert to CSV
function convertToCSV(data) {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(',');
  
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header];
      return typeof value === 'string' && value.includes(',') 
        ? `"${value}"` 
        : value;
    }).join(',');
  });
  
  return [csvHeaders, ...csvRows].join('\n');
}

module.exports = router;