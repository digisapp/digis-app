const express = require('express');
// Supabase removed - using Supabase
const { Pool } = require('pg');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware to check if user is /* admin removed */
const requireAdmin = async (req, res, next) => {
  try {
    const userQuery = await pool.query(
      'SELECT is_super_admin, role FROM users WHERE supabase_id = $1',
      [req.user.supabase_id]
    );

    if (userQuery.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userQuery.rows[0];
    if (!user.is_super_admin && user.role !== '/* admin removed */') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.isAdmin = true;
    next();
  } catch (error) {
    console.error('❌ Error checking /* admin removed */ status:', error);
    res.status(500).json({ error: 'Failed to verify /* admin removed */ status' });
  }
};

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
        u.last_sign_in_at
      FROM creator_applications ca
      JOIN users u ON ca.user_id = u.supabase_id
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
        lastActive: app.last_sign_in_at
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
        u.last_sign_in_at,
        (SELECT COUNT(*) FROM token_transactions WHERE supabase_user_id = u.supabase_id) as transaction_count,
        (SELECT COUNT(*) FROM sessions WHERE member_id = (SELECT id FROM users WHERE supabase_id = u.supabase_id)) as session_count
      FROM creator_applications ca
      JOIN users u ON ca.user_id = u.supabase_id
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
          lastActive: app.last_sign_in_at
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
          price_per_min = $1,
          video_price = $2,
          voice_price = $3,
          stream_price = $4,
          updated_at = NOW()
        WHERE supabase_id = $5
      `, [
        pricing.videoCall || 30,
        pricing.videoCall || 30,
        pricing.voiceCall || 20,
        pricing.privateStream || 50,
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
      
      // Get user email for notification
      const userEmailQuery = await client.query(
        'SELECT email, display_name FROM users WHERE supabase_id = $1',
        [userId]
      );
      
      if (userEmailQuery.rows.length > 0) {
        const { email, display_name } = userEmailQuery.rows[0];
        
        // Send email notification
        try {
          console.log(`📧 Sending creator approval email to ${email}`);
          
          // TODO: Integrate with email service (SendGrid, AWS SES, etc)
          // Example structure for email service integration:
          /*
          await emailService.send({
            to: email,
            subject: 'Welcome to Digis Creator Program!',
            template: 'creator-approved',
            data: {
              name: display_name,
              loginUrl: `${process.env.FRONTEND_URL}/login`
            }
          });
          */
          
        } catch (emailError) {
          console.error('Failed to send approval email:', emailError);
        }
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
      JOIN users u ON ca.user_id = u.supabase_id
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
              price_per_min = $1,
              video_price = $2,
              voice_price = $3,
              stream_price = $4,
              updated_at = NOW()
            WHERE supabase_id = $5
          `, [
            pricing.videoCall || 30,
            pricing.videoCall || 30,
            pricing.voiceCall || 20,
            pricing.privateStream || 50,
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

module.exports = router;