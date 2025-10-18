const express = require('express');
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const { logger: sharedLogger } = require('../utils/secureLogger');
const router = express.Router();

// Use shared logger instead of creating a new one (serverless-friendly)
const logger = sharedLogger;

// Import creator overview routes (aggregated metrics endpoint)
const creatorsOverviewRoutes = require('./creators-overview');

// Mount creator overview routes (requires authentication)
// This provides /creators/overview endpoint with aggregated metrics
router.use('/', authenticateToken, creatorsOverviewRoutes);

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
        COALESCE(u.video_price, 150) as video_price,
        COALESCE(u.voice_price, 50) as voice_price,
        COALESCE(u.stream_price, 100) as stream_price,
        COALESCE(u.message_price, 50) as message_price,
        COALESCE(u.text_message_price, 50) as text_message_price,
        COALESCE(u.image_message_price, 100) as image_message_price,
        COALESCE(u.audio_message_price, 150) as audio_message_price,
        COALESCE(u.video_message_price, 200) as video_message_price,
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
               u.bio, u.video_price, u.voice_price, u.stream_price, u.message_price,
               u.text_message_price, u.image_message_price, u.audio_message_price, u.video_message_price,
               u.availability_status, u.last_seen_at
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
        COALESCE(u.video_price, 150) as video_price,
        COALESCE(u.voice_price, 50) as voice_price,
        COALESCE(u.message_price, 50) as message_price,
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
               u.bio, u.video_price, u.voice_price, u.message_price, u.availability_status, u.last_seen_at
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
      pricePerMin: type === 'video' ? parseFloat(row.video_price) || 150 : parseFloat(row.voice_price) || 50,
      messagePrice: parseFloat(row.message_price) || 50,
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
      'SELECT id, CAST(id AS text) as user_id, display_name, username, availability_status FROM users WHERE supabase_id = $1',
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
          creator_id, fan_id, type, status, start_time, created_at
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

// Get creator settings (rates, availability, etc.)
router.get('/:username/settings', authenticateToken, async (req, res) => {
  try {
    const { username } = req.params;
    
    // Get creator's supabase_id from username
    const userQuery = await pool.query(
      'SELECT supabase_id, is_creator FROM users WHERE username = $1',
      [username]
    );
    
    if (userQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Creator not found' });
    }
    
    if (!userQuery.rows[0].is_creator) {
      return res.status(400).json({ error: 'User is not a creator' });
    }
    
    const creatorId = userQuery.rows[0].supabase_id;
    
    // Get creator settings
    const settingsQuery = await pool.query(
      `SELECT 
        rates,
        subscription_enabled,
        tips_enabled,
        min_call_duration,
        max_call_duration,
        auto_accept_calls,
        availability_schedule
       FROM creator_settings 
       WHERE creator_id = $1`,
      [creatorId]
    );
    
    if (settingsQuery.rows.length === 0) {
      // Return default settings if none exist
      return res.json({
        rates: {
          videoCall: 5,
          voiceCall: 3,
          message: 1,
          picture: 10,
          video: 25
        },
        subscription_enabled: true,
        tips_enabled: true,
        min_call_duration: 60,
        max_call_duration: 3600,
        auto_accept_calls: false,
        availability_schedule: {}
      });
    }
    
    res.json(settingsQuery.rows[0]);
  } catch (error) {
    console.error('Error fetching creator settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Report a creator
router.post('/:creatorId/report', authenticateToken, async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { reason, description } = req.body;
    const userId = req.user.supabase_id;
    
    if (!reason) {
      return res.status(400).json({ error: 'Reason is required' });
    }
    
    // Check if creator exists
    const creatorQuery = await pool.query(
      'SELECT username FROM users WHERE supabase_id = $1',
      [creatorId]
    );
    
    if (creatorQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Creator not found' });
    }
    
    // Insert report
    await pool.query(
      `INSERT INTO content_moderation 
       (content_type, content_id, reported_by, creator_id, reason, description, status, created_at)
       VALUES ('creator_profile', $1, $2, $3, $4, $5, 'pending', NOW())`,
      [creatorId, userId, creatorId, reason, description || '']
    );
    
    res.json({ success: true, message: 'Report submitted successfully' });
  } catch (error) {
    console.error('Error submitting report:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// Update notification settings for a creator
router.post('/:creatorId/notifications', authenticateToken, async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { new_content, live_streams, messages, promotions } = req.body;
    const userId = req.user.supabase_id;
    
    // Upsert notification settings
    await pool.query(
      `INSERT INTO notification_settings 
       (user_id, creator_id, new_content, live_streams, messages, promotions, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id, creator_id) 
       DO UPDATE SET 
         new_content = EXCLUDED.new_content,
         live_streams = EXCLUDED.live_streams,
         messages = EXCLUDED.messages,
         promotions = EXCLUDED.promotions,
         updated_at = NOW()`,
      [
        userId, 
        creatorId, 
        new_content !== false, // Default to true
        live_streams !== false, // Default to true
        messages !== false, // Default to true
        promotions === true // Default to false
      ]
    );
    
    res.json({ success: true, message: 'Notification settings updated' });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({ error: 'Failed to update notification settings' });
  }
});

// Get notification settings for a creator
router.get('/:creatorId/notifications', authenticateToken, async (req, res) => {
  try {
    const { creatorId } = req.params;
    const userId = req.user.supabase_id;
    
    const settingsQuery = await pool.query(
      `SELECT new_content, live_streams, messages, promotions
       FROM notification_settings 
       WHERE user_id = $1 AND creator_id = $2`,
      [userId, creatorId]
    );
    
    if (settingsQuery.rows.length === 0) {
      // Return default settings
      return res.json({
        new_content: true,
        live_streams: true,
        messages: true,
        promotions: false
      });
    }
    
    res.json(settingsQuery.rows[0]);
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    res.status(500).json({ error: 'Failed to fetch notification settings' });
  }
});

// Get creator rates
router.get('/rates', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    
    // Get creator's rates from database with new defaults
    const query = `
      SELECT 
        COALESCE(video_price, 150) as "videoCall",
        COALESCE(voice_price, 50) as "voiceCall",
        COALESCE(text_message_price, 50) as "textMessage",
        COALESCE(image_message_price, 100) as "imageMessage",
        COALESCE(audio_message_price, 150) as "audioMessage",
        COALESCE(video_message_price, 200) as "videoMessage"
      FROM users 
      WHERE supabase_id = $1 AND is_creator = true
    `;
    
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Creator not found',
        rates: {
          videoCall: 150,
          voiceCall: 50,
          textMessage: 50,
          imageMessage: 100,
          audioMessage: 150,
          videoMessage: 200
        }
      });
    }
    
    res.json({
      success: true,
      rates: result.rows[0]
    });
    
  } catch (error) {
    logger.error('Error fetching creator rates:', error);
    res.status(500).json({ error: 'Failed to fetch rates' });
  }
});

// Update creator rates
router.post('/rates', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { rates } = req.body;
    
    if (!rates) {
      return res.status(400).json({ error: 'Rates are required' });
    }
    
    // Update creator's rates in database
    const query = `
      UPDATE users 
      SET 
        video_price = $2,
        voice_price = $3,
        text_message_price = $4,
        image_message_price = $5,
        audio_message_price = $6,
        video_message_price = $7,
        updated_at = NOW()
      WHERE supabase_id = $1 AND is_creator = true
      RETURNING 
        video_price as "videoCall",
        voice_price as "voiceCall",
        text_message_price as "textMessage",
        image_message_price as "imageMessage",
        audio_message_price as "audioMessage",
        video_message_price as "videoMessage"
    `;
    
    const result = await pool.query(query, [
      userId,
      rates.videoCall || 150,
      rates.voiceCall || 50,
      rates.textMessage || 50,
      rates.imageMessage || 100,
      rates.audioMessage || 150,
      rates.videoMessage || 200
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Creator not found' });
    }
    
    logger.info(`Creator ${userId} updated rates`, { rates: result.rows[0] });
    
    res.json({
      success: true,
      message: 'Rates updated successfully',
      rates: result.rows[0]
    });
    
  } catch (error) {
    logger.error('Error updating creator rates:', error);
    res.status(500).json({ error: 'Failed to update rates' });
  }
});

// Get fan notes
router.get('/fan-notes/:fanId', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;
    const { fanId } = req.params;
    
    // Get creator's notes about this fan
    const query = `
      SELECT notes, updated_at
      FROM creator_fan_notes
      WHERE creator_id = $1 AND fan_id = $2
    `;
    
    const result = await pool.query(query, [creatorId, fanId]);
    
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        notes: '',
        updatedAt: null
      });
    }
    
    res.json({
      success: true,
      notes: result.rows[0].notes,
      updatedAt: result.rows[0].updated_at
    });
    
  } catch (error) {
    logger.error('Error fetching fan notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Save/update fan notes
router.post('/fan-notes', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;
    const { fanId, notes } = req.body;
    
    if (!fanId) {
      return res.status(400).json({ error: 'Fan ID is required' });
    }
    
    // Upsert notes for this creator-fan pair
    const query = `
      INSERT INTO creator_fan_notes (creator_id, fan_id, notes, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (creator_id, fan_id)
      DO UPDATE SET 
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING notes, updated_at
    `;
    
    const result = await pool.query(query, [creatorId, fanId, notes || '']);
    
    logger.info(`Creator ${creatorId} updated notes for fan ${fanId}`);
    
    res.json({
      success: true,
      message: 'Notes saved successfully',
      notes: result.rows[0].notes,
      updatedAt: result.rows[0].updated_at
    });
    
  } catch (error) {
    logger.error('Error saving fan notes:', error);
    res.status(500).json({ error: 'Failed to save notes' });
  }
});

// Get fan spending stats with this creator
router.get('/fan-stats/:fanId', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;
    const { fanId } = req.params;
    
    // Get creator's database ID
    const creatorResult = await pool.query(
      'SELECT id FROM users WHERE supabase_id = $1',
      [creatorId]
    );
    
    if (!creatorResult.rows[0]) {
      return res.status(404).json({ error: 'Creator not found' });
    }
    
    const creatorDbId = creatorResult.rows[0].id;
    
    // Get fan's spending with this specific creator
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT s.id) as total_sessions,
        COALESCE(SUM(s.tokens_spent), 0) as total_tokens_spent,
        COALESCE(SUM(s.duration), 0) as total_minutes,
        COALESCE(AVG(s.tokens_spent), 0) as avg_tokens_per_session,
        MIN(s.created_at) as first_interaction,
        MAX(s.created_at) as last_interaction,
        COUNT(DISTINCT DATE_TRUNC('month', s.created_at)) as active_months
      FROM sessions s
      WHERE s.creator_id = $1 AND s.fan_id = $2
    `;
    
    const statsResult = await pool.query(statsQuery, [creatorDbId, fanId]);
    
    // Get message stats
    const messageQuery = `
      SELECT 
        COUNT(*) as total_messages,
        SUM(CASE WHEN message_type = 'text' THEN 1 ELSE 0 END) as text_messages,
        SUM(CASE WHEN message_type = 'image' THEN 1 ELSE 0 END) as image_messages,
        SUM(CASE WHEN message_type = 'audio' THEN 1 ELSE 0 END) as audio_messages,
        SUM(CASE WHEN message_type = 'video' THEN 1 ELSE 0 END) as video_messages
      FROM chat_messages
      WHERE sender_id = $2 AND receiver_id = $1
    `;
    
    const messageResult = await pool.query(messageQuery, [creatorId, fanId]);
    
    // Get tips stats
    const tipsQuery = `
      SELECT 
        COUNT(*) as total_tips,
        COALESCE(SUM(amount), 0) as total_tip_amount,
        COALESCE(MAX(amount), 0) as largest_tip
      FROM tips
      WHERE creator_id = $1 AND fan_id = $2
    `;
    
    const tipsResult = await pool.query(tipsQuery, [creatorDbId, fanId]);
    
    res.json({
      success: true,
      stats: {
        sessions: statsResult.rows[0],
        messages: messageResult.rows[0],
        tips: tipsResult.rows[0]
      }
    });
    
  } catch (error) {
    logger.error('Error fetching fan stats:', error);
    res.status(500).json({ error: 'Failed to fetch fan statistics' });
  }
});

// Get creator's followers
router.get('/followers', authenticateToken, async (req, res) => {
  try {
    const supabaseId = req.user.supabase_id || req.user.id;

    // First, get the user's database ID from their supabase_id
    const userResult = await pool.query(
      'SELECT id FROM users WHERE supabase_id = $1 OR id = $1',
      [supabaseId]
    );

    if (!userResult.rows || userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const creatorDbId = userResult.rows[0].id;

    // Get followers with user details
    // IMPORTANT: Exclude the creator from their own followers list
    // Note: follower_id uses supabase_id, creator_id uses database id
    const query = `
      SELECT
        u.id,
        u.supabase_id,
        u.username,
        u.display_name,
        u.profile_pic_url as avatar,
        u.is_creator as "isVerified",
        f.created_at as "followedAt"
      FROM followers f
      JOIN users u ON u.supabase_id = f.follower_id
      WHERE f.creator_id = $1
        AND f.follower_id != $2
      ORDER BY f.created_at DESC
    `;

    const result = await pool.query(query, [creatorDbId, supabaseId]);

    res.json({
      success: true,
      followers: result.rows
    });

  } catch (error) {
    logger.error('Error fetching followers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch followers',
      message: error.message
    });
  }
});

// Get creator's subscribers
router.get('/subscribers', authenticateToken, async (req, res) => {
  try {
    const supabaseId = req.user.supabase_id || req.user.id;

    // First, get the user's database ID from their supabase_id
    const userResult = await pool.query(
      'SELECT id FROM users WHERE supabase_id = $1 OR id = $1',
      [supabaseId]
    );

    if (!userResult.rows || userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const creatorDbId = userResult.rows[0].id;

    // Get active subscribers with tier info
    // IMPORTANT: Exclude the creator from their own subscribers list
    // Note: user_id uses supabase_id, creator_id uses database id
    const query = `
      SELECT
        u.id,
        u.supabase_id,
        u.username,
        u.display_name,
        u.profile_pic_url as avatar,
        u.is_creator as "isVerified",
        s.created_at as "subscribedAt",
        s.price as "monthlyRevenue"
      FROM subscriptions s
      JOIN users u ON u.supabase_id = s.user_id
      WHERE s.creator_id = $1
        AND s.user_id != $2
        AND s.status = 'active'
        AND (s.expires_at IS NULL OR s.expires_at > NOW())
      ORDER BY s.created_at DESC
    `;

    const result = await pool.query(query, [creatorDbId, supabaseId]);

    res.json({
      success: true,
      subscribers: result.rows
    });

  } catch (error) {
    logger.error('Error fetching subscribers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscribers',
      message: error.message
    });
  }
});

// Get creator stats (followers and subscribers count)
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const supabaseId = req.user.supabase_id || req.user.id;

    // First, get the user's database ID from their supabase_id
    const userResult = await pool.query(
      'SELECT id FROM users WHERE supabase_id = $1 OR id = $1',
      [supabaseId]
    );

    if (!userResult.rows || userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const creatorDbId = userResult.rows[0].id;

    // Get followers count (excluding self) - handle if table doesn't exist
    let followersCount = 0;
    try {
      const followersResult = await pool.query(
        'SELECT COUNT(*) as count FROM followers WHERE creator_id = $1 AND follower_id != $2',
        [creatorDbId, supabaseId]
      );
      followersCount = parseInt(followersResult.rows[0]?.count) || 0;
    } catch (error) {
      if (error.code !== '42P01') throw error; // Re-throw if not "table doesn't exist" error
      logger.warn('Followers table does not exist');
    }

    // Get active subscribers count (excluding self) - handle if table doesn't exist
    let subscribersCount = 0;
    try {
      const subscribersResult = await pool.query(
        `SELECT COUNT(*) as count
         FROM subscriptions
         WHERE creator_id = $1
           AND user_id != $2
           AND status = 'active'
           AND (expires_at IS NULL OR expires_at > NOW())`,
        [creatorDbId, supabaseId]
      );
      subscribersCount = parseInt(subscribersResult.rows[0]?.count) || 0;
    } catch (error) {
      if (error.code !== '42P01') throw error; // Re-throw if not "table doesn't exist" error
      logger.warn('Subscriptions table does not exist');
    }

    res.json({
      success: true,
      followersCount,
      subscribersCount
    });

  } catch (error) {
    logger.error('Error fetching creator stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch creator stats',
      message: error.message
    });
  }
});

module.exports = router;