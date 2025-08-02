const express = require('express');
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const winston = require('winston');
const router = express.Router();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: '../logs/creators.log' }),
    new winston.transports.Console()
  ]
});

// Get all creators (public landing page)
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id,
        CAST(u.id AS text),
        u.supabase_id,
        u.username,
        u.display_name,
        u.profile_pic_url,
        u.bio,
        u.video_price,
        u.voice_price,
        u.stream_price,
        u.availability_status,
        u.last_seen_at,
        COALESCE(AVG(sr.rating), 0) as rating,
        COUNT(DISTINCT sr.id) as review_count,
        COUNT(DISTINCT s.id) as total_calls
      FROM users u
      LEFT JOIN session_ratings sr ON u.id = sr.creator_id
      LEFT JOIN sessions s ON u.id = s.creator_id
      WHERE u.is_creator = true 
        AND u.is_suspended = false
        AND u.profile_blocked = false
      GROUP BY u.id, CAST(u.id AS text), u.supabase_id, u.username, u.display_name, u.profile_pic_url, 
               u.bio, u.video_price, u.voice_price, u.stream_price, u.availability_status, u.last_seen_at
      ORDER BY 
        CASE WHEN u.availability_status = 'online' THEN 1 ELSE 2 END,
        rating DESC,
        total_calls DESC
      LIMIT 20
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      creators: result.rows
    });
  } catch (error) {
    logger.error('Error fetching creators:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch creators'
    });
  }
});

// Get available creators for calls
router.get('/available', async (req, res) => {
  try {
    const { type } = req.query; // 'video' or 'voice'
    
    const query = `
      SELECT 
        u.id,
        CAST(u.id AS text),
        u.username,
        u.display_name,
        u.profile_pic_url,
        u.bio,
        u.video_price,
        u.voice_price,
        u.availability_status,
        u.last_seen_at,
        COALESCE(AVG(sr.rating), 0) as rating,
        COUNT(DISTINCT sr.id) as review_count,
        COUNT(DISTINCT s.id) as total_calls
      FROM users u
      LEFT JOIN session_ratings sr ON u.id = sr.creator_id
      LEFT JOIN sessions s ON u.id = s.creator_id
      WHERE u.is_creator = true 
        AND u.is_suspended = false
        AND u.profile_blocked = false
        AND (u.availability_status = 'online' OR u.availability_status = 'busy')
      GROUP BY u.id, CAST(u.id AS text), u.username, u.display_name, u.profile_pic_url, 
               u.bio, u.video_price, u.voice_price, u.availability_status, u.last_seen_at
      ORDER BY 
        CASE WHEN u.availability_status = 'online' THEN 1 ELSE 2 END,
        rating DESC,
        total_calls DESC
      LIMIT 50
    `;
    
    const result = await pool.query(query);
    
    const creators = result.rows.map(row => ({
      id: row.id,
      supabaseUid: row.id,
      username: row.username,
      displayName: row.display_name || row.username,
      avatar: row.profile_pic_url,
      bio: row.bio || 'No bio available',
      category: 'general', // You could add a category field to users table
      rating: parseFloat(row.rating) || 0,
      reviewCount: parseInt(row.review_count) || 0,
      isOnline: row.availability_status === 'online',
      lastSeen: row.last_seen_at || new Date(),
      specialties: ['Consultation', 'Advice'], // You could add a specialties field
      pricePerMin: type === 'video' ? parseFloat(row.video_price) || 3 : parseFloat(row.voice_price) || 2,
      responseTime: '< 2 min', // Could be calculated from historical data
      totalCalls: parseInt(row.total_calls) || 0,
      availableFor: ['video', 'voice'] // Could be a field in users table
    }));
    
    res.json({ creators });
    logger.info(`Fetched ${creators.length} available creators for ${type} calls`);
    
  } catch (error) {
    logger.error('Error fetching available creators:', error);
    res.status(500).json({ error: 'Failed to fetch available creators' });
  }
});

// Send call request to another creator
router.post('/call-request', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const userId = req.user.supabase_id;
    const { targetCreatorId, callType, message } = req.body;
    
    // Get caller's database ID and info
    const callerResult = await client.query(
      'SELECT id, display_name, username FROM users WHERE supabase_id = $1',
      [userId]
    );
    
    if (!callerResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Caller not found' });
    }
    
    const caller = callerResult.rows[0];
    
    // Get target creator info
    const targetResult = await client.query(
      'SELECT id, CAST(id AS text) as user_id, display_name, username, availability_status FROM users WHERE id = $1',
      [targetCreatorId]
    );
    
    if (!targetResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Target creator not found' });
    }
    
    const target = targetResult.rows[0];
    
    // Check if target creator is available
    if (target.availability_status !== 'online') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Creator is not available for calls' });
    }
    
    // Create call request record
    const callRequestQuery = `
      INSERT INTO call_requests (
        caller_id, target_id, call_type, message, status, created_at
      )
      VALUES ($1, $2, $3, $4, 'pending', NOW())
      RETURNING id
    `;
    
    const callRequestResult = await client.query(callRequestQuery, [
      caller.id, target.id, callType, message
    ]);
    
    const callRequestId = callRequestResult.rows[0].id;
    
    // Create notification for target creator
    const notificationQuery = `
      INSERT INTO notifications (
        recipient_id, sender_id, type, title, message, 
        related_id, created_at, expires_at
      )
      VALUES ($1, $2, 'call_request', $3, $4, $5, NOW(), NOW() + INTERVAL '5 minutes')
      RETURNING id
    `;
    
    await client.query(notificationQuery, [
      target.id,
      caller.id,
      `${callType === 'video' ? 'Video' : 'Voice'} Call Request`,
      `${caller.display_name || caller.username} wants to start a ${callType} call with you`,
      callRequestId
    ]);
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      callId: callRequestId,
      message: 'Call request sent successfully'
    });
    
    logger.info(`Call request sent: ${caller.id} -> ${target.id} (${callType})`, { callRequestId });
    
    // Here you would typically send a real-time notification via WebSocket
    // For now, we'll just log it
    logger.info(`Real-time notification should be sent to creator ${target.id}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error sending call request:', error);
    res.status(500).json({ error: 'Failed to send call request' });
  } finally {
    client.release();
  }
});

// Get call requests for current user
router.get('/call-requests', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    
    // Get user's database ID
    const userResult = await pool.query(
      'SELECT id FROM users WHERE supabase_id = $1',
      [userId]
    );
    
    if (!userResult.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userDbId = userResult.rows[0].id;
    
    // Get pending call requests for this user
    const query = `
      SELECT 
        cr.*,
        caller.display_name as caller_name,
        caller.username as caller_username,
        caller.profile_pic_url as caller_avatar
      FROM call_requests cr
      JOIN users caller ON cr.caller_id = caller.id
      WHERE cr.target_id = $1 
        AND cr.status = 'pending'
        AND cr.created_at > NOW() - INTERVAL '10 minutes'
      ORDER BY cr.created_at DESC
    `;
    
    const result = await pool.query(query, [userDbId]);
    
    const callRequests = result.rows.map(row => ({
      id: row.id,
      callType: row.call_type,
      message: row.message,
      createdAt: row.created_at,
      caller: {
        name: row.caller_name || row.caller_username,
        username: row.caller_username,
        avatar: row.caller_avatar
      }
    }));
    
    res.json({ callRequests });
    logger.info(`Fetched ${callRequests.length} call requests for user ${userId}`);
    
  } catch (error) {
    logger.error('Error fetching call requests:', error);
    res.status(500).json({ error: 'Failed to fetch call requests' });
  }
});

// Respond to call request (accept/reject)
router.post('/call-request/:requestId/respond', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const userId = req.user.supabase_id;
    const { requestId } = req.params;
    const { response } = req.body; // 'accept' or 'reject'
    
    // Get user's database ID
    const userResult = await client.query(
      'SELECT id FROM users WHERE supabase_id = $1',
      [userId]
    );
    
    if (!userResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userDbId = userResult.rows[0].id;
    
    // Get call request details
    const requestResult = await client.query(
      'SELECT * FROM call_requests WHERE id = $1 AND target_id = $2 AND status = $3',
      [requestId, userDbId, 'pending']
    );
    
    if (!requestResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Call request not found or already processed' });
    }
    
    const callRequest = requestResult.rows[0];
    
    // Update call request status
    await client.query(
      'UPDATE call_requests SET status = $1, responded_at = NOW() WHERE id = $2',
      [response, requestId]
    );
    
    if (response === 'accept') {
      // Create a session record for the call
      const sessionQuery = `
        INSERT INTO sessions (
          creator_id, member_id, type, status, start_time, created_at
        )
        VALUES ($1, $2, $3, 'active', NOW(), NOW())
        RETURNING id
      `;
      
      const sessionResult = await client.query(sessionQuery, [
        userDbId, callRequest.caller_id, `${callRequest.call_type}_call`
      ]);
      
      const sessionId = sessionResult.rows[0].id;
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: 'Call request accepted',
        sessionId: sessionId
      });
      
      logger.info(`Call request accepted: ${requestId}, session: ${sessionId}`);
    } else {
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: 'Call request rejected'
      });
      
      logger.info(`Call request rejected: ${requestId}`);
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error responding to call request:', error);
    res.status(500).json({ error: 'Failed to respond to call request' });
  } finally {
    client.release();
  }
});

module.exports = router;