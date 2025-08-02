const express = require('express');
const { Pool } = require('pg');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Create collaboration request
router.post('/create', [
  body('collaboratorIds').isArray().notEmpty(),
  body('title').isLength({ min: 3, max: 100 }),
  body('description').optional().isLength({ max: 500 }),
  body('scheduledFor').optional().isISO8601(),
  body('revenueSharing').isObject(),
  body('sessionType').isIn(['video', 'voice', 'stream'])
], authenticateToken, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const creatorId = req.user.supabase_id;
    const { 
      collaboratorIds, 
      title, 
      description, 
      scheduledFor, 
      revenueSharing, 
      sessionType,
      isPublic = true,
      maxDuration,
      pricePerMinute
    } = req.body;

    // Verify user is a creator
    const creatorQuery = await pool.query(
      'SELECT is_creator, username FROM users WHERE supabase_id = $1',
      [creatorId]
    );

    if (creatorQuery.rows.length === 0 || !creatorQuery.rows[0].is_creator) {
      return res.status(403).json({ error: 'Creator access required' });
    }

    // Validate collaborators exist and are creators
    const collaboratorPlaceholders = collaboratorIds.map((_, i) => `$${i + 1}`).join(',');
    const collaboratorsQuery = await pool.query(`
      SELECT supabase_id, username, is_creator 
      FROM users 
      WHERE supabase_id IN (${collaboratorPlaceholders}) AND is_creator = true
    `, collaboratorIds);

    if (collaboratorsQuery.rows.length !== collaboratorIds.length) {
      return res.status(400).json({ error: 'One or more collaborators not found or not creators' });
    }

    // Validate revenue sharing percentages add up to 100%
    const totalPercentage = Object.values(revenueSharing).reduce((sum, pct) => sum + pct, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      return res.status(400).json({ error: 'Revenue sharing percentages must add up to 100%' });
    }

    // Ensure all collaborators are included in revenue sharing
    const allParticipants = [creatorId, ...collaboratorIds];
    for (const participant of allParticipants) {
      if (!(participant in revenueSharing)) {
        return res.status(400).json({ 
          error: `Missing revenue sharing percentage for participant: ${participant}` 
        });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create collaboration
      const collaborationQuery = await client.query(`
        INSERT INTO collaborations 
        (creator_id, title, description, session_type, scheduled_for, revenue_sharing, 
         is_public, max_duration_minutes, price_per_minute, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        RETURNING *
      `, [
        creatorId, 
        title, 
        description, 
        sessionType, 
        scheduledFor ? new Date(scheduledFor) : null,
        JSON.stringify(revenueSharing),
        isPublic,
        maxDuration,
        pricePerMinute,
        'pending'
      ]);

      const collaboration = collaborationQuery.rows[0];

      // Add collaborators
      for (const collaboratorId of collaboratorIds) {
        await client.query(`
          INSERT INTO collaboration_participants 
          (collaboration_id, user_id, role, status, revenue_percentage, invited_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
        `, [
          collaboration.id,
          collaboratorId,
          'collaborator',
          'invited',
          revenueSharing[collaboratorId]
        ]);

        // Send notification to collaborator
        await client.query(`
          INSERT INTO notifications 
          (recipient_id, type, title, content, data, created_at)
          VALUES ($1, 'collaboration_invite', 'Collaboration Invitation', 
                  $2, $3, NOW())
        `, [
          collaboratorId,
          `${creatorQuery.rows[0].username} invited you to collaborate on "${title}"`,
          JSON.stringify({
            collaborationId: collaboration.id,
            inviterId: creatorId,
            inviterName: creatorQuery.rows[0].username,
            title,
            sessionType,
            revenuePercentage: revenueSharing[collaboratorId]
          })
        ]);
      }

      // Add creator as host participant
      await client.query(`
        INSERT INTO collaboration_participants 
        (collaboration_id, user_id, role, status, revenue_percentage, invited_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
      `, [
        collaboration.id,
        creatorId,
        'host',
        'accepted',
        revenueSharing[creatorId]
      ]);

      await client.query('COMMIT');

      res.json({
        success: true,
        collaboration: {
          id: collaboration.id,
          title: collaboration.title,
          description: collaboration.description,
          sessionType: collaboration.session_type,
          scheduledFor: collaboration.scheduled_for,
          revenueSharing: JSON.parse(collaboration.revenue_sharing),
          status: collaboration.status,
          createdAt: collaboration.created_at,
          collaborators: collaboratorsQuery.rows.map(c => ({
            id: c.supabase_id,
            username: c.username,
            revenuePercentage: revenueSharing[c.supabase_id]
          }))
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Error creating collaboration:', error);
    res.status(500).json({ error: 'Failed to create collaboration' });
  }
});

// Respond to collaboration invitation
router.post('/:collaborationId/respond', [
  body('response').isIn(['accept', 'decline'])
], authenticateToken, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.supabase_id;
    const { collaborationId } = req.params;
    const { response } = req.body;

    // Get collaboration and participant details
    const participantQuery = await pool.query(`
      SELECT 
        cp.*,
        c.title as collaboration_title,
        c.creator_id,
        c.status as collaboration_status,
        host.username as host_username
      FROM collaboration_participants cp
      JOIN collaborations c ON cp.collaboration_id = c.id
      JOIN users host ON c.creator_id = host.id
      WHERE cp.collaboration_id = $1 AND cp.user_id = $2 AND cp.status = 'invited'
    `, [collaborationId, userId]);

    if (participantQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Collaboration invitation not found' });
    }

    const participant = participantQuery.rows[0];

    // Update participant status
    const newStatus = response === 'accept' ? 'accepted' : 'declined';
    await pool.query(`
      UPDATE collaboration_participants 
      SET status = $1, response_at = NOW()
      WHERE collaboration_id = $2 AND user_id = $3
    `, [newStatus, collaborationId, userId]);

    // Check if all participants have responded
    const allParticipantsQuery = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'accepted') as accepted,
        COUNT(*) FILTER (WHERE status = 'declined') as declined
      FROM collaboration_participants 
      WHERE collaboration_id = $1
    `, [collaborationId]);

    const stats = allParticipantsQuery.rows[0];
    let collaborationStatus = 'pending';

    if (parseInt(stats.declined) > 0) {
      collaborationStatus = 'cancelled';
    } else if (parseInt(stats.accepted) === parseInt(stats.total)) {
      collaborationStatus = 'confirmed';
    }

    // Update collaboration status if needed
    if (collaborationStatus !== 'pending') {
      await pool.query(`
        UPDATE collaborations 
        SET status = $1, confirmed_at = $2
        WHERE id = $3
      `, [
        collaborationStatus,
        collaborationStatus === 'confirmed' ? new Date() : null,
        collaborationId
      ]);

      // Notify host about status change
      await pool.query(`
        INSERT INTO notifications 
        (recipient_id, type, title, content, data, created_at)
        VALUES ($1, 'collaboration_status', 'Collaboration Update', 
                $2, $3, NOW())
      `, [
        participant.creator_id,
        collaborationStatus === 'confirmed' 
          ? `All collaborators accepted! "${participant.collaboration_title}" is ready to go.`
          : `Collaboration "${participant.collaboration_title}" was cancelled due to declined invitations.`,
        JSON.stringify({
          collaborationId,
          status: collaborationStatus,
          responderId: userId
        })
      ]);
    }

    res.json({
      success: true,
      message: `Collaboration invitation ${response}ed`,
      collaboration: {
        id: collaborationId,
        status: collaborationStatus,
        userResponse: newStatus
      }
    });

  } catch (error) {
    console.error('❌ Error responding to collaboration:', error);
    res.status(500).json({ error: 'Failed to respond to collaboration' });
  }
});

// Get user's collaborations
router.get('/my-collaborations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { status, role } = req.query;

    let query = `
      SELECT 
        c.*,
        cp.role as user_role,
        cp.status as user_status,
        cp.revenue_percentage,
        host.username as host_username,
        host.profile_pic_url as host_profile_pic,
        COUNT(cp_all.user_id) as total_participants,
        COUNT(cp_accepted.user_id) as accepted_participants,
        array_agg(
          json_build_object(
            'userId', u_collab.supabase_id,
            'username', u_collab.username,
            'profilePic', u_collab.profile_pic_url,
            'role', cp_all.role,
            'status', cp_all.status,
            'revenuePercentage', cp_all.revenue_percentage
          )
        ) as participants
      FROM collaborations c
      JOIN collaboration_participants cp ON c.id = cp.collaboration_id
      JOIN users host ON c.creator_id = host.id
      JOIN collaboration_participants cp_all ON c.id = cp_all.collaboration_id
      JOIN users u_collab ON cp_all.user_id = u_collab.supabase_id
      LEFT JOIN collaboration_participants cp_accepted ON c.id = cp_accepted.collaboration_id AND cp_accepted.status = 'accepted'
      WHERE cp.user_id = $1
    `;
    const params = [userId];
    let paramIndex = 2;

    if (status) {
      query += ` AND c.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (role) {
      query += ` AND cp.role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    query += `
      GROUP BY c.id, cp.role, cp.status, cp.revenue_percentage, host.username, host.profile_pic_url
      ORDER BY c.created_at DESC
    `;

    const collaborationsQuery = await pool.query(query, params);

    res.json({
      success: true,
      collaborations: collaborationsQuery.rows.map(collab => ({
        id: collab.id,
        title: collab.title,
        description: collab.description,
        sessionType: collab.session_type,
        status: collab.status,
        scheduledFor: collab.scheduled_for,
        isPublic: collab.is_public,
        maxDuration: collab.max_duration_minutes,
        pricePerMinute: parseFloat(collab.price_per_minute) || 0,
        revenueSharing: JSON.parse(collab.revenue_sharing),
        userRole: collab.user_role,
        userStatus: collab.user_status,
        userRevenuePercentage: parseFloat(collab.revenue_percentage),
        host: {
          username: collab.host_username,
          profilePic: collab.host_profile_pic
        },
        participants: collab.participants,
        totalParticipants: parseInt(collab.total_participants),
        acceptedParticipants: parseInt(collab.accepted_participants),
        createdAt: collab.created_at,
        confirmedAt: collab.confirmed_at
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching collaborations:', error);
    res.status(500).json({ error: 'Failed to fetch collaborations' });
  }
});

// Start collaboration session
router.post('/:collaborationId/start', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { collaborationId } = req.params;

    // Get collaboration details and verify permissions
    const collaborationQuery = await pool.query(`
      SELECT 
        c.*,
        cp.role as user_role
      FROM collaborations c
      JOIN collaboration_participants cp ON c.id = cp.collaboration_id
      WHERE c.id = $1 AND cp.user_id = $2 AND c.status = 'confirmed'
    `, [collaborationId, userId]);

    if (collaborationQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Collaboration not found or not confirmed' });
    }

    const collaboration = collaborationQuery.rows[0];

    // Only host can start the session
    if (collaboration.user_role !== 'host') {
      return res.status(403).json({ error: 'Only the host can start the collaboration session' });
    }

    // Get all accepted participants
    const participantsQuery = await pool.query(`
      SELECT cp.*, u.username, u.profile_pic_url
      FROM collaboration_participants cp
      JOIN users u ON cp.user_id = u.supabase_id
      WHERE cp.collaboration_id = $1 AND cp.status = 'accepted'
    `, [collaborationId]);

    const participants = participantsQuery.rows;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create session
      const sessionQuery = await client.query(`
        INSERT INTO sessions 
        (creator_id, type, collaboration_id, price_per_min, max_duration_minutes, 
         status, start_time, participants_data)
        VALUES ((SELECT id FROM users WHERE supabase_id = $1), $2, $3, $4, $5, $6, NOW(), $7)
        RETURNING *
      `, [
        collaboration.creator_id,
        collaboration.session_type,
        collaborationId,
        collaboration.price_per_minute,
        collaboration.max_duration_minutes,
        'active',
        JSON.stringify({ participants: participants.map(p => ({ userId: p.user_id, role: p.role })) })
      ]);

      const session = sessionQuery.rows[0];

      // Add session participants
      for (const participant of participants) {
        await client.query(`
          INSERT INTO session_participants 
          (session_id, user_id, role, revenue_percentage, joined_at)
          VALUES ($1, $2, $3, $4, NOW())
        `, [
          session.id,
          participant.user_id,
          participant.role,
          participant.revenue_percentage
        ]);
      }

      // Update collaboration status
      await client.query(`
        UPDATE collaborations 
        SET status = 'active', session_id = $1, started_at = NOW()
        WHERE id = $2
      `, [session.id, collaborationId]);

      // Notify all participants
      for (const participant of participants) {
        if (participant.user_id !== userId) {
          await client.query(`
            INSERT INTO notifications 
            (recipient_id, type, title, content, data, created_at)
            VALUES ($1, 'collaboration_started', 'Collaboration Started!', 
                    $2, $3, NOW())
          `, [
            participant.user_id,
            `The collaboration "${collaboration.title}" has started. Join now!`,
            JSON.stringify({
              collaborationId,
              sessionId: session.id,
              hostId: userId,
              sessionType: collaboration.session_type
            })
          ]);
        }
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        session: {
          id: session.id,
          collaborationId,
          sessionType: session.type,
          status: 'active',
          startTime: session.start_time,
          participants: participants.map(p => ({
            userId: p.user_id,
            username: p.username,
            profilePic: p.profile_pic_url,
            role: p.role,
            revenuePercentage: parseFloat(p.revenue_percentage)
          }))
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Error starting collaboration session:', error);
    res.status(500).json({ error: 'Failed to start collaboration session' });
  }
});

// End collaboration session
router.post('/:collaborationId/end', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { collaborationId } = req.params;

    // Get active collaboration session
    const sessionQuery = await pool.query(`
      SELECT 
        s.*,
        c.title as collaboration_title,
        c.revenue_sharing,
        cp.role as user_role
      FROM sessions s
      JOIN collaborations c ON s.collaboration_id = c.id
      JOIN collaboration_participants cp ON c.id = cp.collaboration_id
      WHERE c.id = $1 AND cp.user_id = $2 AND s.status = 'active'
    `, [collaborationId, userId]);

    if (sessionQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Active collaboration session not found' });
    }

    const session = sessionQuery.rows[0];

    // Only host can end the session
    if (session.user_role !== 'host') {
      return res.status(403).json({ error: 'Only the host can end the collaboration session' });
    }

    const endTime = new Date();
    const durationMinutes = Math.ceil((endTime - new Date(session.start_time)) / (1000 * 60));
    const totalRevenue = durationMinutes * (parseFloat(session.price_per_min) || 0);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update session
      await client.query(`
        UPDATE sessions 
        SET status = 'ended', end_time = $1, duration_minutes = $2, total_amount = $3
        WHERE id = $4
      `, [endTime, durationMinutes, totalRevenue, session.id]);

      // Distribute revenue to participants
      const revenueSharing = JSON.parse(session.revenue_sharing);
      const participantsQuery = await client.query(`
        SELECT user_id, revenue_percentage 
        FROM session_participants 
        WHERE session_id = $1
      `, [session.id]);

      for (const participant of participantsQuery.rows) {
        const participantRevenue = totalRevenue * (parseFloat(participant.revenue_percentage) / 100);
        const participantTokens = Math.floor(participantRevenue * 20); // $0.05 per token

        // Add earnings to participant
        await client.query(`
          INSERT INTO token_balances (user_id, balance)
          VALUES ($1, $2)
          ON CONFLICT (user_id) DO UPDATE SET balance = token_balances.balance + $2
        `, [participant.user_id, participantTokens]);

        // Record transaction
        await client.query(`
          INSERT INTO token_transactions 
          (user_id, type, tokens, amount_usd, status, session_id, collaboration_id, created_at)
          VALUES ($1, 'collaboration_earning', $2, $3, 'completed', $4, $5, NOW())
        `, [participant.user_id, participantTokens, participantRevenue, session.id, collaborationId]);

        // Update user earnings
        await client.query(`
          UPDATE users 
          SET total_earnings = total_earnings + $1, total_sessions = total_sessions + 1
          WHERE supabase_id = $2
        `, [participantRevenue, participant.user_id]);
      }

      // Update collaboration status
      await client.query(`
        UPDATE collaborations 
        SET status = 'completed', ended_at = $1, final_revenue = $2
        WHERE id = $3
      `, [endTime, totalRevenue, collaborationId]);

      // Notify all participants
      for (const participant of participantsQuery.rows) {
        const participantRevenue = totalRevenue * (parseFloat(participant.revenue_percentage) / 100);
        
        await client.query(`
          INSERT INTO notifications 
          (recipient_id, type, title, content, data, created_at)
          VALUES ($1, 'collaboration_ended', 'Collaboration Completed!', 
                  $2, $3, NOW())
        `, [
          participant.user_id,
          `Collaboration "${session.collaboration_title}" has ended. You earned $${participantRevenue.toFixed(2)}!`,
          JSON.stringify({
            collaborationId,
            sessionId: session.id,
            duration: durationMinutes,
            revenue: participantRevenue,
            totalRevenue
          })
        ]);
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        session: {
          id: session.id,
          status: 'ended',
          duration: durationMinutes,
          totalRevenue,
          endTime,
          revenueDistribution: participantsQuery.rows.map(p => ({
            userId: p.user_id,
            percentage: parseFloat(p.revenue_percentage),
            amount: totalRevenue * (parseFloat(p.revenue_percentage) / 100)
          }))
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Error ending collaboration session:', error);
    res.status(500).json({ error: 'Failed to end collaboration session' });
  }
});

// Get collaboration analytics
router.get('/:collaborationId/analytics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { collaborationId } = req.params;

    // Verify user is a participant
    const participantQuery = await pool.query(`
      SELECT role FROM collaboration_participants 
      WHERE collaboration_id = $1 AND user_id = $2
    `, [collaborationId, userId]);

    if (participantQuery.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get collaboration and session data
    const analyticsQuery = await pool.query(`
      SELECT 
        c.*,
        s.duration_minutes,
        s.total_amount,
        s.start_time as session_start,
        s.end_time as session_end,
        COUNT(sp.user_id) as participant_count,
        AVG(sp.revenue_percentage) as avg_revenue_share,
        json_agg(
          json_build_object(
            'userId', u.supabase_id,
            'username', u.username,
            'role', sp.role,
            'revenuePercentage', sp.revenue_percentage,
            'earnings', (s.total_amount * sp.revenue_percentage / 100)
          )
        ) as participant_earnings
      FROM collaborations c
      LEFT JOIN sessions s ON c.session_id = s.id
      LEFT JOIN session_participants sp ON s.id = sp.session_id
      LEFT JOIN users u ON sp.user_id = u.supabase_id
      WHERE c.id = $1
      GROUP BY c.id, s.duration_minutes, s.total_amount, s.start_time, s.end_time
    `, [collaborationId]);

    if (analyticsQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Collaboration not found' });
    }

    const analytics = analyticsQuery.rows[0];

    res.json({
      success: true,
      analytics: {
        collaboration: {
          id: analytics.id,
          title: analytics.title,
          status: analytics.status,
          sessionType: analytics.session_type,
          createdAt: analytics.created_at,
          startedAt: analytics.started_at,
          endedAt: analytics.ended_at
        },
        session: analytics.duration_minutes ? {
          duration: analytics.duration_minutes,
          totalRevenue: parseFloat(analytics.total_amount) || 0,
          startTime: analytics.session_start,
          endTime: analytics.session_end,
          revenuePerMinute: analytics.duration_minutes > 0 
            ? (parseFloat(analytics.total_amount) || 0) / analytics.duration_minutes 
            : 0
        } : null,
        participants: {
          count: parseInt(analytics.participant_count) || 0,
          avgRevenueShare: parseFloat(analytics.avg_revenue_share) || 0,
          earnings: analytics.participant_earnings || []
        },
        performance: {
          isSuccessful: analytics.status === 'completed',
          durationVsPlanned: analytics.max_duration_minutes && analytics.duration_minutes
            ? (analytics.duration_minutes / analytics.max_duration_minutes) * 100
            : null
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching collaboration analytics:', error);
    res.status(500).json({ error: 'Failed to fetch collaboration analytics' });
  }
});

// Cancel collaboration
router.post('/:collaborationId/cancel', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { collaborationId } = req.params;
    const { reason } = req.body;

    // Verify user is the host
    const collaborationQuery = await pool.query(`
      SELECT c.*, cp.role 
      FROM collaborations c
      JOIN collaboration_participants cp ON c.id = cp.collaboration_id
      WHERE c.id = $1 AND cp.user_id = $2 AND cp.role = 'host'
    `, [collaborationId, userId]);

    if (collaborationQuery.rows.length === 0) {
      return res.status(403).json({ error: 'Only the host can cancel the collaboration' });
    }

    const collaboration = collaborationQuery.rows[0];

    if (['active', 'completed', 'cancelled'].includes(collaboration.status)) {
      return res.status(400).json({ error: 'Cannot cancel collaboration in current status' });
    }

    // Update collaboration status
    await pool.query(`
      UPDATE collaborations 
      SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = $1
      WHERE id = $2
    `, [reason, collaborationId]);

    // Notify all participants
    const participantsQuery = await pool.query(`
      SELECT user_id FROM collaboration_participants 
      WHERE collaboration_id = $1 AND user_id != $2
    `, [collaborationId, userId]);

    for (const participant of participantsQuery.rows) {
      await pool.query(`
        INSERT INTO notifications 
        (recipient_id, type, title, content, data, created_at)
        VALUES ($1, 'collaboration_cancelled', 'Collaboration Cancelled', 
                $2, $3, NOW())
      `, [
        participant.user_id,
        `The collaboration "${collaboration.title}" has been cancelled.${reason ? ` Reason: ${reason}` : ''}`,
        JSON.stringify({
          collaborationId,
          reason,
          cancelledBy: userId
        })
      ]);
    }

    res.json({
      success: true,
      message: 'Collaboration cancelled successfully'
    });

  } catch (error) {
    console.error('❌ Error cancelling collaboration:', error);
    res.status(500).json({ error: 'Failed to cancel collaboration' });
  }
});

// Search for potential collaborators
router.get('/search-creators', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { query, limit = 20, offset = 0 } = req.query;

    let searchQuery = `
      SELECT 
        u.supabase_id,
        u.username,
        u.display_name,
        u.profile_pic_url,
        u.bio,
        u.total_earnings,
        u.total_sessions,
        u.creator_verified,
        COUNT(f.follower_id) as follower_count,
        AVG(sr.rating) as avg_rating,
        COUNT(DISTINCT c.id) as collaboration_count
      FROM users u
      LEFT JOIN followers f ON u.supabase_id = f.creator_id
      LEFT JOIN session_ratings sr ON u.id = sr.creator_id
      LEFT JOIN collaboration_participants cp ON u.supabase_id = cp.user_id
      LEFT JOIN collaborations c ON cp.collaboration_id = c.id AND c.status = 'completed'
      WHERE u.is_creator = true 
        AND u.supabase_id != $1
        AND u.is_active = true
    `;
    
    const params = [userId];
    let paramIndex = 2;

    if (query) {
      searchQuery += ` AND (u.username ILIKE $${paramIndex} OR u.display_name ILIKE $${paramIndex} OR u.bio ILIKE $${paramIndex})`;
      params.push(`%${query}%`);
      paramIndex++;
    }

    searchQuery += `
      GROUP BY u.supabase_id, u.username, u.display_name, u.profile_pic_url, u.bio, 
               u.total_earnings, u.total_sessions, u.creator_verified
      ORDER BY 
        u.creator_verified DESC,
        follower_count DESC,
        avg_rating DESC NULLS LAST,
        collaboration_count DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(parseInt(limit), parseInt(offset));

    const creatorsQuery = await pool.query(searchQuery, params);

    res.json({
      success: true,
      creators: creatorsQuery.rows.map(creator => ({
        id: creator.supabase_id,
        username: creator.username,
        displayName: creator.display_name,
        profilePic: creator.profile_pic_url,
        bio: creator.bio,
        totalEarnings: parseFloat(creator.total_earnings) || 0,
        totalSessions: parseInt(creator.total_sessions) || 0,
        isVerified: creator.creator_verified,
        followerCount: parseInt(creator.follower_count) || 0,
        avgRating: parseFloat(creator.avg_rating) || 0,
        collaborationCount: parseInt(creator.collaboration_count) || 0
      }))
    });

  } catch (error) {
    console.error('❌ Error searching creators:', error);
    res.status(500).json({ error: 'Failed to search creators' });
  }
});

module.exports = router;