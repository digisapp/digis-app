const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const streamActivityMonitor = require('../utils/stream-activity-monitor');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: '../logs/streaming.log' }),
    new winston.transports.Console()
  ]
});

// Public endpoint - Get live streams (no auth required)
router.get('/public/streams/live', async (req, res) => {
  try {
    const query = `
      SELECT 
        s.id,
        s.creator_id,
        u.email as creator_name,
        u.username as creator_username,
        u.profile_pic_url as creator_avatar,
        u.display_name,
        u.is_verified,
        s.title,
        s.description,
        s.category,
        s.thumbnail_url as thumbnail,
        s.viewer_count,
        s.started_at,
        s.status,
        s.is_free,
        s.tags,
        u.language,
        COUNT(DISTINCT sl.id) as likes,
        COUNT(DISTINCT st.id) as tips
      FROM streams s
      JOIN users u ON s.creator_id = u.supabase_id
      LEFT JOIN stream_likes sl ON s.id = sl.stream_id
      LEFT JOIN stream_tips st ON s.id = st.stream_id
      WHERE s.status = 'live'
      GROUP BY s.id, u.supabase_id, u.email, u.username, u.profile_pic_url, u.display_name, u.is_verified, u.language, 
               s.title, s.description, s.category, s.thumbnail_url, s.viewer_count, 
               s.started_at, s.status, s.is_free, s.tags
      ORDER BY s.viewer_count DESC, s.started_at DESC
      LIMIT 50
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      streams: result.rows.map(stream => ({
        ...stream,
        is_live: true
      }))
    });
  } catch (error) {
    console.error('Error fetching live streams:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch live streams',
      streams: []
    });
  }
});

// Public endpoint - Get upcoming streams
router.get('/public/streams/upcoming', async (req, res) => {
  try {
    const query = `
      SELECT 
        s.id,
        s.creator_id,
        u.email as creator_name,
        u.username as creator_username,
        s.title,
        s.description,
        s.scheduled_time,
        s.category,
        s.expected_duration,
        s.tags
      FROM scheduled_streams s
      JOIN users u ON s.creator_id = u.supabase_id
      WHERE s.scheduled_time > NOW()
        AND s.is_cancelled = false
      ORDER BY s.scheduled_time ASC
      LIMIT 20
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      streams: result.rows
    });
  } catch (error) {
    console.error('Error fetching upcoming streams:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch upcoming streams',
      streams: []
    });
  }
});

// Public endpoint - Get stream replays
router.get('/public/streams/replays', async (req, res) => {
  try {
    const query = `
      SELECT 
        sr.id,
        sr.creator_id,
        u.email as creator_name,
        u.username as creator_username,
        sr.title,
        sr.category,
        sr.created_at as recorded_date,
        sr.duration,
        sr.view_count,
        sr.like_count,
        sr.language
      FROM stream_recordings sr
      JOIN users u ON sr.creator_id = u.supabase_id
      WHERE sr.is_private = false
        AND sr.status = 'completed'
      ORDER BY sr.created_at DESC
      LIMIT 20
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      replays: result.rows
    });
  } catch (error) {
    console.error('Error fetching replays:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch replays',
      replays: []
    });
  }
});

// Get active streams (authenticated - for app use)
router.get('/active', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.supabase_id;
    
    const query = `
      SELECT 
        s.*,
        u.email as creator_name,
        u.username,
        u.profile_pic_url,
        COUNT(DISTINCT sv.id) as viewer_count,
        ${userId ? `
          CASE WHEN EXISTS (
            SELECT 1 FROM stream_viewers 
            WHERE stream_id = s.id AND user_id = $1
          ) THEN true ELSE false END as is_viewing
        ` : 'false as is_viewing'}
      FROM streams s
      JOIN users u ON s.creator_id = u.supabase_id
      LEFT JOIN stream_viewers sv ON s.id = sv.stream_id
      WHERE s.status = 'live'
      GROUP BY s.id, u.supabase_id, u.email, u.username, u.profile_pic_url, u.display_name, u.is_verified, u.language, 
               s.title, s.description, s.category, s.thumbnail_url, s.viewer_count, 
               s.started_at, s.status, s.is_free, s.tags
      ORDER BY viewer_count DESC
    `;
    
    const result = await pool.query(userId ? query : query.replace('$1', 'NULL'), userId ? [userId] : []);
    
    res.json({
      success: true,
      streams: result.rows
    });
  } catch (error) {
    console.error('Error fetching active streams:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active streams'
    });
  }
});

// Start stream recording
router.post('/start-recording', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;
    const { sessionId, streamTitle, streamDescription, isPrivate, recordingSettings } = req.body;

    // Verify user is a creator and owns the session
    const sessionQuery = await pool.query(`
      SELECT s.*, u.is_creator 
      FROM sessions s
      JOIN users u ON s.creator_id = u.id
      WHERE s.id = $1 AND u.id::text = $2 AND u.is_creator = true
    `, [sessionId, creatorId]);

    if (sessionQuery.rows.length === 0) {
      return res.status(403).json({ error: 'Session not found or access denied' });
    }

    const session = sessionQuery.rows[0];

    // Create stream recording record
    const recordingQuery = await pool.query(`
      INSERT INTO stream_recordings 
      (session_id, creator_id, title, description, is_private, recording_settings, status, started_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `, [
      sessionId,
      creatorId,
      streamTitle || `Stream Recording - ${new Date().toISOString()}`,
      streamDescription,
      isPrivate || false,
      JSON.stringify(recordingSettings || {}),
      'recording'
    ]);

    const recording = recordingQuery.rows[0];

    // In a real implementation, this would integrate with:
    // - Agora Cloud Recording API
    // - AWS S3 for storage
    // - FFmpeg for processing
    // For now, we'll simulate the recording process

    const mockRecordingConfig = {
      recordingId: `rec_${Date.now()}`,
      resourceId: `res_${Math.random().toString(36).substr(2, 9)}`,
      sid: `sid_${Math.random().toString(36).substr(2, 9)}`,
      storageConfig: {
        vendor: 1, // AWS S3
        region: 'us-east-1',
        bucket: 'digis-recordings',
        accessKey: process.env.AWS_ACCESS_KEY,
        secretKey: process.env.AWS_SECRET_KEY
      }
    };

    // Update recording with external service details
    await pool.query(`
      UPDATE stream_recordings 
      SET external_recording_id = $1, recording_config = $2
      WHERE id = $3
    `, [
      mockRecordingConfig.recordingId,
      JSON.stringify(mockRecordingConfig),
      recording.id
    ]);

    res.json({
      success: true,
      recording: {
        id: recording.id,
        recordingId: mockRecordingConfig.recordingId,
        status: 'recording',
        startedAt: recording.started_at,
        title: recording.title
      }
    });

  } catch (error) {
    console.error('❌ Error starting stream recording:', error);
    res.status(500).json({ error: 'Failed to start recording' });
  }
});

// Stop stream recording
router.post('/stop-recording/:recordingId', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;
    const { recordingId } = req.params;

    // Get recording details
    const recordingQuery = await pool.query(`
      SELECT * FROM stream_recordings 
      WHERE id = $1 AND creator_id = $2 AND status = 'recording'
    `, [recordingId, creatorId]);

    if (recordingQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Active recording not found' });
    }

    const recording = recordingQuery.rows[0];

    // Calculate duration
    const startTime = new Date(recording.started_at);
    const endTime = new Date();
    const durationSeconds = Math.floor((endTime - startTime) / 1000);

    // Simulate stopping external recording service
    const processingResult = {
      fileUrl: `https://recordings.digis.com/${recording.external_recording_id}.mp4`,
      thumbnailUrl: `https://recordings.digis.com/${recording.external_recording_id}_thumb.jpg`,
      fileSize: Math.floor(durationSeconds * 1024 * 1024 * 0.5), // Simulate file size
      resolution: '1920x1080',
      format: 'mp4'
    };

    // Update recording as completed
    const updatedRecording = await pool.query(`
      UPDATE stream_recordings 
      SET status = 'processing', 
          ended_at = NOW(),
          duration_seconds = $1,
          file_url = $2,
          thumbnail_url = $3,
          file_size = $4,
          processing_result = $5
      WHERE id = $6
      RETURNING *
    `, [
      durationSeconds,
      processingResult.fileUrl,
      processingResult.thumbnailUrl,
      processingResult.fileSize,
      JSON.stringify(processingResult),
      recordingId
    ]);

    // Simulate processing completion after a delay
    setTimeout(async () => {
      try {
        await pool.query(`
          UPDATE stream_recordings 
          SET status = 'completed', processed_at = NOW()
          WHERE id = $1
        `, [recordingId]);

        // Create notification for creator
        await pool.query(`
          INSERT INTO notifications (recipient_id, type, title, content, data, created_at)
          VALUES ($1, 'recording_ready', 'Recording Ready!', 
                  'Your stream recording has been processed and is ready to view.', 
                  $2, NOW())
        `, [
          creatorId,
          JSON.stringify({ recordingId, title: recording.title })
        ]);
      } catch (error) {
        console.error('Error finalizing recording:', error);
      }
    }, 5000); // 5 second delay to simulate processing

    res.json({
      success: true,
      recording: {
        id: updatedRecording.rows[0].id,
        status: 'processing',
        duration: durationSeconds,
        fileUrl: processingResult.fileUrl,
        thumbnailUrl: processingResult.thumbnailUrl
      }
    });

  } catch (error) {
    console.error('❌ Error stopping stream recording:', error);
    res.status(500).json({ error: 'Failed to stop recording' });
  }
});

// Get creator's recordings
router.get('/my-recordings', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;
    const { status, limit = 20, offset = 0 } = req.query;

    let query = `
      SELECT 
        sr.*,
        s.type as session_type,
        COUNT(rv.id) as view_count,
        SUM(CASE WHEN rv.created_at >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END) as recent_views
      FROM stream_recordings sr
      LEFT JOIN sessions s ON sr.session_id = s.id
      LEFT JOIN recording_views rv ON sr.id = rv.recording_id
      WHERE sr.creator_id = $1
    `;
    const params = [creatorId];
    let paramIndex = 2;

    if (status) {
      query += ` AND sr.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` 
      GROUP BY sr.id, s.type
      ORDER BY sr.created_at DESC 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(parseInt(limit), parseInt(offset));

    const recordingsQuery = await pool.query(query, params);

    // Get total count
    const countQuery = await pool.query(`
      SELECT COUNT(*) as total 
      FROM stream_recordings 
      WHERE creator_id = $1 ${status ? 'AND status = $2' : ''}
    `, status ? [creatorId, status] : [creatorId]);

    res.json({
      success: true,
      recordings: recordingsQuery.rows.map(rec => ({
        id: rec.id,
        title: rec.title,
        description: rec.description,
        status: rec.status,
        isPrivate: rec.is_private,
        sessionType: rec.session_type,
        duration: rec.duration_seconds,
        fileUrl: rec.file_url,
        thumbnailUrl: rec.thumbnail_url,
        fileSize: rec.file_size,
        viewCount: parseInt(rec.view_count) || 0,
        recentViews: parseInt(rec.recent_views) || 0,
        startedAt: rec.started_at,
        endedAt: rec.ended_at,
        processedAt: rec.processed_at,
        createdAt: rec.created_at
      })),
      pagination: {
        total: parseInt(countQuery.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching recordings:', error);
    res.status(500).json({ error: 'Failed to fetch recordings' });
  }
});

// Get recording details
router.get('/recording/:recordingId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { recordingId } = req.params;

    const recordingQuery = await pool.query(`
      SELECT 
        sr.*,
        u.username as creator_username,
        u.profile_pic_url as creator_profile_pic,
        s.type as session_type,
        s.price_per_min
      FROM stream_recordings sr
      JOIN users u ON sr.creator_id = u.id
      LEFT JOIN sessions s ON sr.session_id = s.id
      WHERE sr.id = $1
    `, [recordingId]);

    if (recordingQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    const recording = recordingQuery.rows[0];

    // Check access permissions
    const isCreator = recording.creator_id === userId;
    const isPrivate = recording.is_private;

    if (isPrivate && !isCreator) {
      // Check if user has subscription or special access
      const accessQuery = await pool.query(`
        SELECT 1 FROM creator_subscriptions 
        WHERE subscriber_id = $1 AND creator_id = $2 AND status = 'active'
        UNION
        SELECT 1 FROM recording_purchases 
        WHERE user_id = $1 AND recording_id = $2
      `, [userId, recordingId]);

      if (accessQuery.rows.length === 0) {
        return res.status(403).json({ 
          error: 'Access denied',
          requiresSubscription: true,
          creatorId: recording.creator_id
        });
      }
    }

    // Record view if not creator
    if (!isCreator) {
      await pool.query(`
        INSERT INTO recording_views (recording_id, viewer_id, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (recording_id, viewer_id) DO NOTHING
      `, [recordingId, userId]);
    }

    // Get view statistics
    const statsQuery = await pool.query(`
      SELECT 
        COUNT(DISTINCT viewer_id) as unique_viewers,
        COUNT(*) as total_views,
        AVG(watch_duration) as avg_watch_time
      FROM recording_views 
      WHERE recording_id = $1
    `, [recordingId]);

    const stats = statsQuery.rows[0];

    res.json({
      success: true,
      recording: {
        id: recording.id,
        title: recording.title,
        description: recording.description,
        creatorId: recording.creator_id,
        creatorUsername: recording.creator_username,
        creatorProfilePic: recording.creator_profile_pic,
        sessionType: recording.session_type,
        duration: recording.duration_seconds,
        fileUrl: recording.file_url,
        thumbnailUrl: recording.thumbnail_url,
        fileSize: recording.file_size,
        isPrivate: recording.is_private,
        status: recording.status,
        startedAt: recording.started_at,
        endedAt: recording.ended_at,
        processedAt: recording.processed_at,
        stats: {
          uniqueViewers: parseInt(stats.unique_viewers) || 0,
          totalViews: parseInt(stats.total_views) || 0,
          avgWatchTime: parseFloat(stats.avg_watch_time) || 0
        },
        hasAccess: true
      }
    });

  } catch (error) {
    console.error('❌ Error fetching recording details:', error);
    res.status(500).json({ error: 'Failed to fetch recording details' });
  }
});

// Purchase recording access
router.post('/purchase-recording/:recordingId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { recordingId } = req.params;
    const { paymentMethod = 'tokens' } = req.body;

    // Get recording and pricing details
    const recordingQuery = await pool.query(`
      SELECT sr.*, u.username as creator_username
      FROM stream_recordings sr
      JOIN users u ON sr.creator_id = u.id
      WHERE sr.id = $1 AND sr.is_private = true AND sr.status = 'completed'
    `, [recordingId]);

    if (recordingQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Recording not available for purchase' });
    }

    const recording = recordingQuery.rows[0];
    
    // Calculate price based on duration (e.g., $0.10 per minute)
    const pricePerMinute = 0.10;
    const durationMinutes = Math.ceil(recording.duration_seconds / 60);
    const totalPrice = durationMinutes * pricePerMinute;
    const tokenCost = Math.ceil(totalPrice * 20); // $0.05 per token

    // Check if already purchased
    const existingPurchase = await pool.query(`
      SELECT id FROM recording_purchases 
      WHERE user_id = $1 AND recording_id = $2
    `, [userId, recordingId]);

    if (existingPurchase.rows.length > 0) {
      return res.status(400).json({ error: 'Recording already purchased' });
    }

    if (paymentMethod === 'tokens') {
      // Check user token balance
      const userQuery = await pool.query(`
        SELECT tb.balance 
        FROM token_balances tb
        WHERE tb.user_id = $1
      `, [userId]);

      if (userQuery.rows.length === 0 || userQuery.rows[0].balance < tokenCost) {
        return res.status(400).json({ 
          error: 'Insufficient token balance',
          required: tokenCost,
          available: userQuery.rows[0]?.balance || 0
        });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Deduct tokens from user
        await client.query(`
          UPDATE token_balances 
          SET balance = balance - $1 
          WHERE user_id = $2
        `, [tokenCost, userId]);

        // Add tokens to creator (100% - no platform fee)
        const creatorEarnings = tokenCost;
        await client.query(`
          INSERT INTO token_balances (user_id, balance)
          VALUES ($1, $2)
          ON CONFLICT (user_id) DO UPDATE SET balance = token_balances.balance + $2
        `, [recording.creator_id, creatorEarnings]);

        // Record purchase
        const purchaseQuery = await client.query(`
          INSERT INTO recording_purchases 
          (user_id, recording_id, price_paid, payment_method, created_at)
          VALUES ($1, $2, $3, $4, NOW())
          RETURNING *
        `, [userId, recordingId, totalPrice, paymentMethod]);

        // Record transaction
        await client.query(`
          INSERT INTO token_transactions 
          (user_id, type, tokens, amount_usd, status, created_at)
          VALUES ($1, 'recording_purchase', $2, $3, 'completed', NOW())
        `, [userId, -tokenCost, -totalPrice]);

        await client.query('COMMIT');

        res.json({
          success: true,
          message: 'Recording purchased successfully',
          purchase: {
            id: purchaseQuery.rows[0].id,
            recordingId,
            pricePaid: totalPrice,
            tokensCost: tokenCost,
            purchasedAt: purchaseQuery.rows[0].created_at
          }
        });

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

  } catch (error) {
    console.error('❌ Error purchasing recording:', error);
    res.status(500).json({ error: 'Failed to purchase recording' });
  }
});

// Update recording details
router.put('/recording/:recordingId', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;
    const { recordingId } = req.params;
    const { title, description, isPrivate } = req.body;

    const updateQuery = await pool.query(`
      UPDATE stream_recordings 
      SET title = $1, description = $2, is_private = $3, updated_at = NOW()
      WHERE id = $4 AND creator_id = $5
      RETURNING *
    `, [title, description, isPrivate, recordingId, creatorId]);

    if (updateQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Recording not found or access denied' });
    }

    res.json({
      success: true,
      message: 'Recording updated successfully',
      recording: {
        id: updateQuery.rows[0].id,
        title: updateQuery.rows[0].title,
        description: updateQuery.rows[0].description,
        isPrivate: updateQuery.rows[0].is_private,
        updatedAt: updateQuery.rows[0].updated_at
      }
    });

  } catch (error) {
    console.error('❌ Error updating recording:', error);
    res.status(500).json({ error: 'Failed to update recording' });
  }
});

// Delete recording
router.delete('/recording/:recordingId', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;
    const { recordingId } = req.params;

    // Verify ownership and get recording details
    const recordingQuery = await pool.query(`
      SELECT * FROM stream_recordings 
      WHERE id = $1 AND creator_id = $2
    `, [recordingId, creatorId]);

    if (recordingQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Recording not found or access denied' });
    }

    const recording = recordingQuery.rows[0];

    // In production, you would also delete the actual file from storage
    // await deleteFromS3(recording.file_url);

    // Delete recording and related data
    await pool.query('DELETE FROM stream_recordings WHERE id = $1', [recordingId]);

    res.json({
      success: true,
      message: 'Recording deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting recording:', error);
    res.status(500).json({ error: 'Failed to delete recording' });
  }
});

// Create clip from recording
router.post('/create-clip', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { recordingId, startTime, endTime, title, description, isPublic } = req.body;

    if (!recordingId || startTime === undefined || endTime === undefined) {
      return res.status(400).json({ error: 'Recording ID, start time, and end time are required' });
    }

    // Validate clip duration (max 60 seconds for free users, 300 for premium)
    const clipDuration = endTime - startTime;
    if (clipDuration <= 0 || clipDuration > 300) {
      return res.status(400).json({ error: 'Clip duration must be between 1-300 seconds' });
    }

    // Get recording details and check access
    const recordingQuery = await pool.query(`
      SELECT 
        sr.*,
        u.username as creator_username,
        CASE 
          WHEN sr.creator_id = $1 THEN true
          WHEN sr.is_private = false THEN true
          WHEN EXISTS (SELECT 1 FROM creator_subscriptions cs WHERE cs.subscriber_id = $1 AND cs.creator_id = sr.creator_id AND cs.status = 'active') THEN true
          WHEN EXISTS (SELECT 1 FROM recording_purchases rp WHERE rp.user_id = $1 AND rp.recording_id = sr.id) THEN true
          ELSE false
        END as has_access
      FROM stream_recordings sr
      JOIN users u ON sr.creator_id = u.id
      WHERE sr.id = $2 AND sr.status = 'completed'
    `, [userId, recordingId]);

    if (recordingQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Recording not found or not available' });
    }

    const recording = recordingQuery.rows[0];

    if (!recording.has_access) {
      return res.status(403).json({ error: 'Access denied to this recording' });
    }

    // Validate clip times against recording duration
    if (endTime > recording.duration_seconds) {
      return res.status(400).json({ error: 'Clip end time exceeds recording duration' });
    }

    // Create clip record
    const clipQuery = await pool.query(`
      INSERT INTO recording_clips 
      (recording_id, creator_id, created_by, title, description, start_time, end_time, 
       duration_seconds, is_public, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      recordingId,
      recording.creator_id,
      userId,
      title || `Clip from ${recording.title}`,
      description || '',
      startTime,
      endTime,
      clipDuration,
      isPublic !== false, // Default to public
      'processing'
    ]);

    const clip = clipQuery.rows[0];

    // Simulate clip processing (in production, this would use FFmpeg or similar)
    const clipProcessingResult = {
      clipUrl: `https://clips.digis.com/clip_${clip.id}.mp4`,
      thumbnailUrl: `https://clips.digis.com/clip_${clip.id}_thumb.jpg`,
      fileSize: Math.floor(clipDuration * 1024 * 512), // Estimate
      format: 'mp4',
      resolution: '1920x1080'
    };

    // Update clip with processing result after delay
    setTimeout(async () => {
      try {
        await pool.query(`
          UPDATE recording_clips 
          SET status = 'completed', 
              clip_url = $1, 
              thumbnail_url = $2, 
              file_size = $3,
              processing_result = $4,
              completed_at = NOW()
          WHERE id = $5
        `, [
          clipProcessingResult.clipUrl,
          clipProcessingResult.thumbnailUrl,
          clipProcessingResult.fileSize,
          JSON.stringify(clipProcessingResult),
          clip.id
        ]);

        // Notify creator if clip was created by someone else
        if (userId !== recording.creator_id) {
          await pool.query(`
            INSERT INTO notifications (recipient_id, type, title, content, data, created_at)
            VALUES ($1, 'clip_created', 'New Clip Created', 
                    $2, $3, NOW())
          `, [
            recording.creator_id,
            `A clip was created from your recording "${recording.title}"`,
            JSON.stringify({ clipId: clip.id, createdBy: userId, title: clip.title })
          ]);
        }
      } catch (error) {
        console.error('Error finalizing clip:', error);
        await pool.query('UPDATE recording_clips SET status = \'failed\' WHERE id = $1', [clip.id]);
      }
    }, 3000); // 3 second processing delay

    res.json({
      success: true,
      clip: {
        id: clip.id,
        title: clip.title,
        description: clip.description,
        startTime: clip.start_time,
        endTime: clip.end_time,
        duration: clip.duration_seconds,
        status: 'processing',
        isPublic: clip.is_public,
        createdAt: clip.created_at
      }
    });

  } catch (error) {
    console.error('❌ Error creating clip:', error);
    res.status(500).json({ error: 'Failed to create clip' });
  }
});

// Get user's clips
router.get('/my-clips', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { limit = 20, offset = 0, status } = req.query;

    let query = `
      SELECT 
        rc.*,
        sr.title as recording_title,
        u.username as creator_username,
        COUNT(cv.id) as view_count,
        COUNT(cl.id) as like_count
      FROM recording_clips rc
      JOIN stream_recordings sr ON rc.recording_id = sr.id
      JOIN users u ON rc.creator_id = u.supabase_id
      LEFT JOIN clip_views cv ON rc.id = cv.clip_id
      LEFT JOIN clip_likes cl ON rc.id = cl.clip_id
      WHERE rc.created_by = $1
    `;
    const params = [userId];
    let paramIndex = 2;

    if (status) {
      query += ` AND rc.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += `
      GROUP BY rc.id, sr.title, u.username
      ORDER BY rc.created_at DESC 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(parseInt(limit), parseInt(offset));

    const clipsQuery = await pool.query(query, params);

    res.json({
      success: true,
      clips: clipsQuery.rows.map(clip => ({
        id: clip.id,
        title: clip.title,
        description: clip.description,
        recordingTitle: clip.recording_title,
        creatorUsername: clip.creator_username,
        startTime: clip.start_time,
        endTime: clip.end_time,
        duration: clip.duration_seconds,
        clipUrl: clip.clip_url,
        thumbnailUrl: clip.thumbnail_url,
        fileSize: clip.file_size,
        status: clip.status,
        isPublic: clip.is_public,
        viewCount: parseInt(clip.view_count) || 0,
        likeCount: parseInt(clip.like_count) || 0,
        createdAt: clip.created_at,
        completedAt: clip.completed_at
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching clips:', error);
    res.status(500).json({ error: 'Failed to fetch clips' });
  }
});

// Get public clips (discovery)
router.get('/clips/discover', authenticateToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0, creatorId, sortBy = 'recent' } = req.query;

    let query = `
      SELECT 
        rc.*,
        sr.title as recording_title,
        u.username as creator_username,
        u.profile_pic_url as creator_profile_pic,
        COUNT(cv.id) as view_count,
        COUNT(cl.id) as like_count,
        MAX(cv.created_at) as last_viewed
      FROM recording_clips rc
      JOIN stream_recordings sr ON rc.recording_id = sr.id
      JOIN users u ON rc.creator_id = u.supabase_id
      LEFT JOIN clip_views cv ON rc.id = cv.clip_id
      LEFT JOIN clip_likes cl ON rc.id = cl.clip_id
      WHERE rc.is_public = true AND rc.status = 'completed'
    `;
    const params = [];
    let paramIndex = 1;

    if (creatorId) {
      query += ` AND rc.creator_id = $${paramIndex}`;
      params.push(creatorId);
      paramIndex++;
    }

    query += ' GROUP BY rc.id, sr.title, u.username, u.profile_pic_url';

    // Apply sorting
    switch (sortBy) {
      case 'popular':
        query += ' ORDER BY view_count DESC, like_count DESC';
        break;
      case 'trending':
        query += ' ORDER BY (view_count + like_count * 2) DESC, rc.created_at DESC';
        break;
      default:
        query += ' ORDER BY rc.created_at DESC';
    }

    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const clipsQuery = await pool.query(query, params);

    res.json({
      success: true,
      clips: clipsQuery.rows.map(clip => ({
        id: clip.id,
        title: clip.title,
        description: clip.description,
        recordingTitle: clip.recording_title,
        creatorId: clip.creator_id,
        creatorUsername: clip.creator_username,
        creatorProfilePic: clip.creator_profile_pic,
        duration: clip.duration_seconds,
        clipUrl: clip.clip_url,
        thumbnailUrl: clip.thumbnail_url,
        viewCount: parseInt(clip.view_count) || 0,
        likeCount: parseInt(clip.like_count) || 0,
        createdAt: clip.created_at
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching public clips:', error);
    res.status(500).json({ error: 'Failed to fetch clips' });
  }
});

// Get clip details
router.get('/clip/:clipId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { clipId } = req.params;

    const clipQuery = await pool.query(`
      SELECT 
        rc.*,
        sr.title as recording_title,
        u.username as creator_username,
        u.profile_pic_url as creator_profile_pic,
        creator_u.username as created_by_username,
        COUNT(cv.id) as view_count,
        COUNT(cl.id) as like_count,
        EXISTS(SELECT 1 FROM clip_likes WHERE clip_id = rc.id AND user_id = $1) as user_liked
      FROM recording_clips rc
      JOIN stream_recordings sr ON rc.recording_id = sr.id
      JOIN users u ON rc.creator_id = u.supabase_id
      JOIN users creator_u ON rc.created_by::text = creator_u.id::text
      LEFT JOIN clip_views cv ON rc.id = cv.clip_id
      LEFT JOIN clip_likes cl ON rc.id = cl.clip_id
      WHERE rc.id = $2 AND (rc.is_public = true OR rc.created_by = $1 OR rc.creator_id = $1)
      GROUP BY rc.id, sr.title, u.username, u.profile_pic_url, creator_u.username
    `, [userId, clipId]);

    if (clipQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Clip not found or access denied' });
    }

    const clip = clipQuery.rows[0];

    // Record view if not the creator
    if (userId !== clip.created_by && userId !== clip.creator_id) {
      await pool.query(`
        INSERT INTO clip_views (clip_id, viewer_id, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (clip_id, viewer_id) DO NOTHING
      `, [clipId, userId]);
    }

    res.json({
      success: true,
      clip: {
        id: clip.id,
        title: clip.title,
        description: clip.description,
        recordingTitle: clip.recording_title,
        creatorId: clip.creator_id,
        creatorUsername: clip.creator_username,
        creatorProfilePic: clip.creator_profile_pic,
        createdBy: clip.created_by,
        createdByUsername: clip.created_by_username,
        startTime: clip.start_time,
        endTime: clip.end_time,
        duration: clip.duration_seconds,
        clipUrl: clip.clip_url,
        thumbnailUrl: clip.thumbnail_url,
        fileSize: clip.file_size,
        status: clip.status,
        isPublic: clip.is_public,
        viewCount: parseInt(clip.view_count) || 0,
        likeCount: parseInt(clip.like_count) || 0,
        userLiked: clip.user_liked,
        createdAt: clip.created_at,
        completedAt: clip.completed_at
      }
    });

  } catch (error) {
    console.error('❌ Error fetching clip details:', error);
    res.status(500).json({ error: 'Failed to fetch clip details' });
  }
});

// Like/unlike clip
router.post('/clip/:clipId/like', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { clipId } = req.params;

    // Check if already liked
    const existingLike = await pool.query(`
      SELECT id FROM clip_likes 
      WHERE clip_id = $1 AND user_id = $2
    `, [clipId, userId]);

    if (existingLike.rows.length > 0) {
      // Unlike
      await pool.query('DELETE FROM clip_likes WHERE clip_id = $1 AND user_id = $2', [clipId, userId]);
      
      res.json({
        success: true,
        action: 'unliked',
        message: 'Clip unliked'
      });
    } else {
      // Like
      await pool.query(`
        INSERT INTO clip_likes (clip_id, user_id, created_at)
        VALUES ($1, $2, NOW())
      `, [clipId, userId]);

      res.json({
        success: true,
        action: 'liked',
        message: 'Clip liked'
      });
    }

  } catch (error) {
    console.error('❌ Error toggling clip like:', error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// Delete clip
router.delete('/clip/:clipId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { clipId } = req.params;

    // Verify ownership (creator or clip creator can delete)
    const clipQuery = await pool.query(`
      SELECT * FROM recording_clips 
      WHERE id = $1 AND (created_by = $2 OR creator_id = $2)
    `, [clipId, userId]);

    if (clipQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Clip not found or access denied' });
    }

    // Delete clip and related data
    await pool.query('DELETE FROM recording_clips WHERE id = $1', [clipId]);

    res.json({
      success: true,
      message: 'Clip deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting clip:', error);
    res.status(500).json({ error: 'Failed to delete clip' });
  }
});

// Private Stream Endpoints

// Get creator's private stream settings
router.get('/private-settings/:creatorId', authenticateToken, async (req, res) => {
  try {
    const { creatorId } = req.params;
    
    const query = `
      SELECT 
        private_stream_rate,
        private_stream_min_time,
        private_stream_auto_accept,
        private_stream_enabled
      FROM creator_settings
      WHERE creator_id = $1
    `;
    
    const result = await pool.query(query, [creatorId]);
    
    if (result.rows.length === 0) {
      // Return default settings if none exist
      return res.json({
        success: true,
        settings: {
          privateStreamRate: 100,
          privateStreamMinTime: 5,
          privateStreamAutoAccept: 'manual',
          privateStreamEnabled: true
        }
      });
    }
    
    const settings = result.rows[0];
    res.json({
      success: true,
      settings: {
        privateStreamRate: settings.private_stream_rate || 100,
        privateStreamMinTime: settings.private_stream_min_time || 5,
        privateStreamAutoAccept: settings.private_stream_auto_accept || 'manual',
        privateStreamEnabled: settings.private_stream_enabled !== false
      }
    });
    
  } catch (error) {
    logger.error('Error fetching private stream settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Request a private stream
router.post('/private-request', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const fanId = req.user.supabase_id;
    const { creatorId, streamId, minimumMinutes } = req.body;
    
    // Get creator settings - using default values for now
    const settings = {
      private_stream_rate: 100,
      private_stream_min_time: 5,
      private_stream_enabled: true,
      private_stream_auto_accept: 'manual'
    };
    
    const actualMinTime = Math.max(minimumMinutes, settings.private_stream_min_time);
    const totalCost = settings.private_stream_rate * actualMinTime;
    
    // Check fan's token balance
    const userResult = await client.query(
      'SELECT id FROM users WHERE supabase_id = $1',
      [fanId]
    );
    
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    
    const fanDbId = userResult.rows[0].id;
    const balanceResult = await client.query(
      'SELECT balance FROM token_balances WHERE user_id = $1',
      [fanDbId]
    );
    
    if (balanceResult.rows.length === 0 || balanceResult.rows[0].balance < totalCost) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Insufficient token balance',
        required: totalCost,
        current: balanceResult.rows[0]?.balance || 0
      });
    }
    
    // Get fan's username
    const fanInfoResult = await client.query(
      'SELECT username FROM users WHERE supabase_id = $1',
      [fanId]
    );
    const fanUsername = fanInfoResult.rows[0]?.username || 'Anonymous';
    
    // Create private stream request in-memory for now
    const request = {
      id: Date.now().toString(),
      fan_id: fanId,
      creator_id: creatorId,
      stream_id: streamId,
      minimum_minutes: actualMinTime,
      rate_per_minute: settings.private_stream_rate,
      total_cost: totalCost,
      status: 'pending',
      created_at: new Date()
    };
    
    // Send notification to creator
    await client.query(`
      INSERT INTO notifications (
        user_id, type, title, message, data, created_at
      ) VALUES ($1, 'private_stream_request', $2, $3, $4, NOW())
    `, [
      creatorId,
      'New Private Stream Request!',
      `${fanUsername} wants a private stream session (${actualMinTime} min for ${totalCost} tokens)`,
      JSON.stringify({ requestId: request.id, fanId, streamId })
    ]);
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      request: {
        id: request.id,
        status: request.status,
        minimumMinutes: actualMinTime,
        totalCost,
        fanName: fanUsername,
        requestTime: request.created_at
      }
    });
    
    logger.info(`Private stream request created: ${request.id}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating private stream request:', error);
    res.status(500).json({ error: 'Failed to create request' });
  } finally {
    client.release();
  }
});

// Accept a private stream request
router.post('/private-accept', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const creatorId = req.user.supabase_id;
    const { requestId, streamId } = req.body;
    
    // For demo purposes, we'll process the acceptance without a full request table
    // In production, this would validate against the private_stream_requests table
    
    res.json({
      success: true,
      session: {
        id: Date.now().toString(),
        streamId,
        minimumMinutes: 5,
        startTime: new Date()
      }
    });
    
    await client.query('COMMIT');
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error accepting private stream request:', error);
    res.status(500).json({ error: 'Failed to accept request' });
  } finally {
    client.release();
  }
});

// Get pending private stream requests for a creator
router.get('/private-requests', authenticateToken, async (req, res) => {
  try {
    // For demo purposes, return empty array
    // In production, this would query the private_stream_requests table
    res.json({
      success: true,
      requests: []
    });
    
  } catch (error) {
    logger.error('Error fetching private stream requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Get streams by creator
router.get('/creator/:creatorId', authenticateToken, async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { status = 'all', limit = 20, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        s.stream_id,
        s.title,
        s.description,
        s.status,
        s.thumbnail_url,
        s.viewer_count,
        s.started_at,
        s.ended_at,
        s.is_private,
        s.token_rate,
        s.scheduled_for,
        u.username as creator_username,
        u.profile_pic_url as creator_avatar,
        COUNT(DISTINCT sv.user_id) as unique_viewers,
        COALESCE(SUM(st.amount), 0) as total_tips
      FROM streams s
      JOIN users u ON s.creator_id = u.supabase_id
      LEFT JOIN stream_viewers sv ON s.stream_id = sv.stream_id
      LEFT JOIN tips st ON st.stream_id = s.stream_id
      WHERE s.creator_id = $1
    `;
    
    const params = [creatorId];
    let paramIndex = 2;
    
    // Filter by status
    if (status !== 'all') {
      query += ` AND s.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    query += `
      GROUP BY s.stream_id, u.username, u.profile_pic_url
      ORDER BY 
        CASE WHEN s.status = 'live' THEN 0 ELSE 1 END,
        s.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    params.push(parseInt(limit), parseInt(offset));
    
    const streamsQuery = await pool.query(query, params);
    
    // Get count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM streams s
      WHERE s.creator_id = $1
    `;
    
    const countParams = [creatorId];
    
    if (status !== 'all') {
      countQuery += ` AND s.status = $2`;
      countParams.push(status);
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);
    
    res.json({
      success: true,
      streams: streamsQuery.rows.map(stream => ({
        id: stream.stream_id,
        title: stream.title,
        description: stream.description,
        status: stream.status,
        isLive: stream.status === 'live',
        thumbnail: stream.thumbnail_url || `https://source.unsplash.com/600x400/?streaming,${stream.stream_id}`,
        viewers: stream.status === 'live' ? stream.viewer_count : stream.unique_viewers,
        startedAt: stream.started_at,
        endedAt: stream.ended_at,
        isPrivate: stream.is_private,
        tokenRate: stream.token_rate,
        scheduledFor: stream.scheduled_for,
        creatorUsername: stream.creator_username,
        creatorAvatar: stream.creator_avatar,
        totalTips: parseFloat(stream.total_tips || 0)
      })),
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total
      }
    });
    
  } catch (error) {
    console.error('Error fetching creator streams:', error);
    res.status(500).json({ error: 'Failed to fetch streams' });
  }
});

// Get stream analytics data
router.get('/:streamId/analytics', authenticateToken, async (req, res) => {
  try {
    const { streamId } = req.params;
    const { timeRange = '24h' } = req.query;
    const userId = req.user.supabase_id;
    
    // Map time ranges to PostgreSQL intervals
    const intervalMap = {
      '1h': '1 hour',
      '24h': '24 hours', 
      '7d': '7 days',
      '30d': '30 days',
      '90d': '90 days'
    };
    
    const interval = intervalMap[timeRange] || '24 hours';
    
    // Verify user has access to stream analytics (creator only)
    const streamOwnerCheck = await pool.query(`
      SELECT creator_id FROM streams WHERE id = $1
    `, [streamId]);
    
    if (streamOwnerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Stream not found' });
    }
    
    if (streamOwnerCheck.rows[0].creator_id !== userId) {
      return res.status(403).json({ error: 'Access denied - creator only' });
    }
    
    // Get comprehensive stream analytics
    const analytics = await pool.query(
      `WITH current_stats AS (
        SELECT 
          MAX(viewer_count) as peak_viewers,
          COALESCE(AVG(viewer_count), 0) as avg_viewers,
          MAX(message_count) as total_messages,
          COUNT(CASE WHEN type = 'gift' THEN 1 END) as total_gifts,
          COUNT(CASE WHEN type = 'follow' THEN 1 END) as new_followers,
          COALESCE(SUM(CASE WHEN type = 'tip' THEN CAST(metadata->>'amount' AS DECIMAL) ELSE 0 END), 0) as total_tips,
          COALESCE(AVG(CASE WHEN type = 'snapshot' THEN 
            EXTRACT(EPOCH FROM (timestamp - LAG(timestamp) OVER (ORDER BY timestamp)))
            ELSE NULL END), 0) as avg_watch_time
        FROM stream_analytics
        WHERE stream_id = $1 
          AND timestamp >= NOW() - INTERVAL '${interval}'
      ),
      viewer_history AS (
        SELECT 
          timestamp,
          viewer_count as count
        FROM stream_analytics
        WHERE stream_id = $1 
          AND timestamp >= NOW() - INTERVAL '${interval}'
          AND type = 'snapshot'
        ORDER BY timestamp
      ),
      engagement_history AS (
        SELECT 
          DATE_TRUNC('hour', timestamp) as hour,
          COUNT(CASE WHEN type = 'message' THEN 1 END) as messages,
          COUNT(CASE WHEN type = 'reaction' THEN 1 END) as reactions,
          COUNT(CASE WHEN type = 'gift' THEN 1 END) as gifts,
          COUNT(CASE WHEN type = 'follow' THEN 1 END) as follows
        FROM stream_analytics
        WHERE stream_id = $1 
          AND timestamp >= NOW() - INTERVAL '${interval}'
        GROUP BY hour
        ORDER BY hour
      ),
      revenue_history AS (
        SELECT 
          DATE_TRUNC('hour', timestamp) as hour,
          COALESCE(SUM(CASE WHEN type = 'tip' THEN CAST(metadata->>'amount' AS DECIMAL) ELSE 0 END), 0) as tips,
          COALESCE(SUM(CASE WHEN type = 'gift' THEN CAST(metadata->>'cost' AS DECIMAL) ELSE 0 END), 0) as gifts,
          COALESCE(SUM(CASE WHEN type = 'subscription' THEN CAST(metadata->>'amount' AS DECIMAL) ELSE 0 END), 0) as subscriptions
        FROM stream_analytics
        WHERE stream_id = $1 
          AND timestamp >= NOW() - INTERVAL '${interval}'
        GROUP BY hour
        ORDER BY hour
      ),
      performance_data AS (
        SELECT 
          COALESCE(AVG(CAST(metadata->>'connection_quality' AS DECIMAL)), 85) as connection_quality,
          COALESCE(AVG(CAST(metadata->>'buffer_ratio' AS DECIMAL)), 2) as buffer_ratio,
          COALESCE(AVG(CAST(metadata->>'bitrate' AS DECIMAL)), 1500) as average_bitrate
        FROM stream_analytics
        WHERE stream_id = $1 
          AND timestamp >= NOW() - INTERVAL '${interval}'
          AND metadata ? 'connection_quality'
      )
      SELECT 
        json_build_object(
          'currentViewers', COALESCE((SELECT viewer_count FROM stream_analytics WHERE stream_id = $1 AND type = 'snapshot' ORDER BY timestamp DESC LIMIT 1), 0),
          'peakViewers', cs.peak_viewers,
          'averageWatchTime', cs.avg_watch_time,
          'totalMessages', cs.total_messages,
          'totalTips', cs.total_tips,
          'revenue', cs.total_tips,
          'engagement', ROUND((cs.total_messages + cs.total_gifts * 2 + cs.new_followers * 3) / GREATEST(cs.peak_viewers, 1) * 100, 2)
        ) as realTimeData,
        json_build_object(
          'viewers', COALESCE(json_agg(DISTINCT jsonb_build_object('timestamp', vh.timestamp, 'count', vh.count) ORDER BY jsonb_build_object('timestamp', vh.timestamp, 'count', vh.count)), '[]'::json),
          'engagement', COALESCE(json_agg(DISTINCT jsonb_build_object('timestamp', eh.hour, 'messages', eh.messages, 'reactions', eh.reactions, 'gifts', eh.gifts, 'follows', eh.follows) ORDER BY jsonb_build_object('timestamp', eh.hour, 'messages', eh.messages, 'reactions', eh.reactions, 'gifts', eh.gifts, 'follows', eh.follows)), '[]'::json),
          'revenue', COALESCE(json_agg(DISTINCT jsonb_build_object('timestamp', rh.hour, 'tips', rh.tips, 'gifts', rh.gifts, 'subscriptions', rh.subscriptions) ORDER BY jsonb_build_object('timestamp', rh.hour, 'tips', rh.tips, 'gifts', rh.gifts, 'subscriptions', rh.subscriptions)), '[]'::json),
          'messages', COALESCE(json_agg(DISTINCT jsonb_build_object('timestamp', eh.hour, 'count', eh.messages) ORDER BY jsonb_build_object('timestamp', eh.hour, 'count', eh.messages)), '[]'::json),
          'tips', COALESCE(json_agg(DISTINCT jsonb_build_object('timestamp', rh.hour, 'amount', rh.tips) ORDER BY jsonb_build_object('timestamp', rh.hour, 'amount', rh.tips)), '[]'::json)
        ) as historicalData,
        json_build_object(
          'countries', '[]'::json,
          'ageGroups', '[]'::json,
          'devices', '[]'::json
        ) as demographics,
        json_build_object(
          'connectionQuality', pd.connection_quality,
          'bufferRatio', pd.buffer_ratio,
          'averageBitrate', pd.average_bitrate
        ) as performance
      FROM current_stats cs
      CROSS JOIN performance_data pd
      LEFT JOIN viewer_history vh ON true
      LEFT JOIN engagement_history eh ON true  
      LEFT JOIN revenue_history rh ON true
      GROUP BY cs.peak_viewers, cs.avg_viewers, cs.total_messages, cs.total_gifts, cs.new_followers, cs.total_tips, cs.avg_watch_time, pd.connection_quality, pd.buffer_ratio, pd.average_bitrate`,
      [streamId]
    );
    
    if (analytics.rows.length === 0) {
      return res.json({
        realTimeData: {
          currentViewers: 0,
          peakViewers: 0,
          averageWatchTime: 0,
          totalMessages: 0,
          totalTips: 0,
          revenue: 0,
          engagement: 0
        },
        historicalData: {
          viewers: [],
          engagement: [],
          revenue: [],
          messages: [],
          tips: []
        },
        demographics: {
          countries: [],
          ageGroups: [],
          devices: []
        },
        performance: {
          connectionQuality: 0,
          bufferRatio: 0,
          averageBitrate: 0
        }
      });
    }
    
    res.json(analytics.rows[0]);
  } catch (error) {
    logger.error('Error fetching stream analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get global analytics (for admin/creator dashboard)
router.get('/analytics/global', authenticateToken, async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query;
    const userId = req.user.supabase_id;
    
    // Check if user is a creator or admin
    const userCheck = await pool.query(`
      SELECT is_creator, role FROM users WHERE supabase_id = $1
    `, [userId]);
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userCheck.rows[0];
    if (!user.is_creator && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied - creator or admin only' });
    }
    
    // Map time ranges to PostgreSQL intervals
    const intervalMap = {
      '1h': '1 hour', 
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days',
      '90d': '90 days'
    };
    
    const interval = intervalMap[timeRange] || '24 hours';
    
    // For creators, show only their analytics; for admins, show global
    const creatorFilter = user.role === 'admin' ? '' : 'AND sa.creator_id = $2';
    const queryParams = user.role === 'admin' ? [] : [userId];
    
    const analytics = await pool.query(
      `WITH global_stats AS (
        SELECT 
          COUNT(DISTINCT sa.stream_id) as total_streams,
          COALESCE(SUM(sa.viewer_count), 0) as total_viewers,
          COALESCE(AVG(sa.viewer_count), 0) as avg_viewers,
          COUNT(CASE WHEN sa.type = 'message' THEN 1 END) as total_messages,
          COUNT(CASE WHEN sa.type = 'gift' THEN 1 END) as total_gifts,
          COUNT(CASE WHEN sa.type = 'follow' THEN 1 END) as new_followers,
          COALESCE(SUM(CASE WHEN sa.type = 'tip' THEN CAST(sa.metadata->>'amount' AS DECIMAL) ELSE 0 END), 0) as total_revenue
        FROM stream_analytics sa
        WHERE sa.timestamp >= NOW() - INTERVAL '${interval}' ${creatorFilter}
      ),
      hourly_data AS (
        SELECT 
          DATE_TRUNC('hour', sa.timestamp) as hour,
          COUNT(DISTINCT sa.stream_id) as streams,
          COALESCE(AVG(sa.viewer_count), 0) as avg_viewers,
          COUNT(CASE WHEN sa.type = 'message' THEN 1 END) as messages,
          COUNT(CASE WHEN sa.type = 'reaction' THEN 1 END) as reactions,
          COUNT(CASE WHEN sa.type = 'gift' THEN 1 END) as gifts,
          COALESCE(SUM(CASE WHEN sa.type = 'tip' THEN CAST(sa.metadata->>'amount' AS DECIMAL) ELSE 0 END), 0) as revenue
        FROM stream_analytics sa
        WHERE sa.timestamp >= NOW() - INTERVAL '${interval}' ${creatorFilter}
        GROUP BY hour
        ORDER BY hour
      )
      SELECT 
        json_build_object(
          'currentViewers', gs.total_viewers,
          'peakViewers', gs.total_viewers,
          'averageWatchTime', 0,
          'totalMessages', gs.total_messages,
          'totalTips', gs.total_revenue,
          'revenue', gs.total_revenue,
          'engagement', ROUND((gs.total_messages + gs.total_gifts * 2 + gs.new_followers * 3) / GREATEST(gs.total_viewers, 1) * 100, 2)
        ) as realTimeData,
        json_build_object(
          'viewers', COALESCE(json_agg(jsonb_build_object('timestamp', hd.hour, 'count', hd.avg_viewers) ORDER BY hd.hour), '[]'::json),
          'engagement', COALESCE(json_agg(jsonb_build_object('timestamp', hd.hour, 'messages', hd.messages, 'reactions', hd.reactions, 'gifts', hd.gifts) ORDER BY hd.hour), '[]'::json),
          'revenue', COALESCE(json_agg(jsonb_build_object('timestamp', hd.hour, 'amount', hd.revenue) ORDER BY hd.hour), '[]'::json),
          'messages', COALESCE(json_agg(jsonb_build_object('timestamp', hd.hour, 'count', hd.messages) ORDER BY hd.hour), '[]'::json),
          'tips', COALESCE(json_agg(jsonb_build_object('timestamp', hd.hour, 'amount', hd.revenue) ORDER BY hd.hour), '[]'::json)
        ) as historicalData,
        json_build_object(
          'countries', '[]'::json,
          'ageGroups', '[]'::json,
          'devices', '[]'::json
        ) as demographics,
        json_build_object(
          'connectionQuality', 85,
          'bufferRatio', 2,
          'averageBitrate', 1500
        ) as performance
      FROM global_stats gs
      LEFT JOIN hourly_data hd ON true
      GROUP BY gs.total_streams, gs.total_viewers, gs.avg_viewers, gs.total_messages, gs.total_gifts, gs.new_followers, gs.total_revenue`,
      queryParams
    );
    
    if (analytics.rows.length === 0) {
      return res.json({
        realTimeData: {
          currentViewers: 0,
          peakViewers: 0,
          averageWatchTime: 0,
          totalMessages: 0,
          totalTips: 0,
          revenue: 0,
          engagement: 0
        },
        historicalData: {
          viewers: [],
          engagement: [],
          revenue: [],
          messages: [],
          tips: []
        },
        demographics: {
          countries: [],
          ageGroups: [],
          devices: []
        },
        performance: {
          connectionQuality: 0,
          bufferRatio: 0,
          averageBitrate: 0
        }
      });
    }
    
    res.json(analytics.rows[0]);
  } catch (error) {
    logger.error('Error fetching global analytics:', error);
    res.status(500).json({ error: 'Failed to fetch global analytics' });
  }
});

// Get stream milestones
router.get('/:streamId/milestones', authenticateToken, async (req, res) => {
  try {
    const { streamId } = req.params;
    
    const milestones = await pool.query(
      `SELECT 
        milestone_type as type,
        count,
        label,
        icon,
        color,
        achieved_at
       FROM stream_milestones
       WHERE stream_id = $1 AND creator_id = $2
       ORDER BY achieved_at DESC`,
      [streamId, req.user.supabase_id]
    );
    
    res.json(milestones.rows);
  } catch (error) {
    logger.error('Error fetching milestones:', error);
    res.status(500).json({ error: 'Failed to fetch milestones' });
  }
});

// Get stream participants
router.get('/:streamId/participants', authenticateToken, async (req, res) => {
  try {
    const { streamId } = req.params;
    
    const participants = await pool.query(
      `SELECT 
        u.supabase_id as uid,
        u.display_name as name,
        u.profile_pic_url as avatar,
        p.role,
        p.joined_at as join_time,
        p.is_active
       FROM stream_participants p
       JOIN users u ON p.user_id = u.supabase_id
       WHERE p.stream_id = $1 AND p.is_active = true
       ORDER BY p.joined_at`,
      [streamId]
    );
    
    res.json(participants.rows);
  } catch (error) {
    logger.error('Error fetching participants:', error);
    res.status(500).json({ error: 'Failed to fetch participants' });
  }
});

// Get stream alerts
router.get('/:streamId/alerts', authenticateToken, async (req, res) => {
  try {
    const { streamId } = req.params;
    
    const alerts = await pool.query(
      `SELECT 
        id,
        alert_type as type,
        message,
        metadata,
        created_at as timestamp
       FROM stream_alerts
       WHERE stream_id = $1 AND creator_id = $2 AND displayed = false
       ORDER BY created_at DESC
       LIMIT 10`,
      [streamId, req.user.supabase_id]
    );
    
    // Map alert types to icons and colors
    const alertsWithIcons = alerts.rows.map(alert => ({
      ...alert,
      icon: alert.type === 'new_follower' ? 'UserGroupIcon' :
            alert.type === 'donation' ? 'FireIcon' :
            alert.type === 'subscription' ? 'StarIcon' :
            alert.type === 'raid' ? 'BoltIcon' :
            alert.type === 'milestone' ? 'TrophyIcon' : 'BellIcon',
      color: alert.type === 'new_follower' ? 'purple' :
             alert.type === 'donation' ? 'green' :
             alert.type === 'subscription' ? 'blue' :
             alert.type === 'raid' ? 'orange' :
             alert.type === 'milestone' ? 'yellow' : 'gray'
    }));
    
    res.json(alertsWithIcons);
  } catch (error) {
    logger.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Create/update stream goals
router.post('/goals', authenticateToken, async (req, res) => {
  try {
    const { streamId, currentLevel, level1, level2, level3, goalAmount, description } = req.body;
    
    const result = await pool.query(
      `INSERT INTO stream_goals 
       (stream_id, creator_id, current_level, level1, level2, level3, goal_amount, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (stream_id) DO UPDATE SET
         current_level = EXCLUDED.current_level,
         level1 = EXCLUDED.level1,
         level2 = EXCLUDED.level2,
         level3 = EXCLUDED.level3,
         goal_amount = EXCLUDED.goal_amount,
         description = EXCLUDED.description,
         updated_at = NOW()
       RETURNING *`,
      [
        streamId,
        req.user.supabase_id,
        currentLevel,
        JSON.stringify(level1),
        JSON.stringify(level2),
        JSON.stringify(level3),
        goalAmount,
        description
      ]
    );
    
    res.json({ success: true, goal: result.rows[0] });
  } catch (error) {
    logger.error('Error saving stream goals:', error);
    res.status(500).json({ error: 'Failed to save goals' });
  }
});

// Start a raid
router.post('/raid', authenticateToken, async (req, res) => {
  try {
    const { streamId, target } = req.body;
    
    // Get target creator
    const targetCreator = await pool.query(
      'SELECT supabase_id FROM users WHERE username = $1 AND is_creator = true',
      [target]
    );
    
    if (targetCreator.rows.length === 0) {
      return res.status(404).json({ error: 'Target creator not found' });
    }
    
    // Get current viewer count
    const viewerCount = await pool.query(
      `SELECT viewer_count 
       FROM stream_analytics 
       WHERE stream_id = $1 AND type = 'snapshot'
       ORDER BY timestamp DESC
       LIMIT 1`,
      [streamId]
    );
    
    // Create raid record
    await pool.query(
      `INSERT INTO stream_raids 
       (stream_id, creator_id, target_channel, target_creator_id, viewer_count)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        streamId,
        req.user.supabase_id,
        target,
        targetCreator.rows[0].supabase_id,
        viewerCount.rows[0]?.viewer_count || 0
      ]
    );
    
    // TODO: Emit socket event for raid
    
    res.json({ success: true, message: `Raiding ${target}!` });
  } catch (error) {
    logger.error('Error starting raid:', error);
    res.status(500).json({ error: 'Failed to start raid' });
  }
});

// Co-Host Feature Endpoints

// Request to co-host a stream
router.post('/co-host-request', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { streamId } = req.body;
    const requesterId = req.user.supabase_id;
    
    // Verify stream exists and get creator
    const streamQuery = await client.query(
      'SELECT creator_id, status FROM streams WHERE stream_id = $1',
      [streamId]
    );
    
    if (streamQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Stream not found' });
    }
    
    const stream = streamQuery.rows[0];
    
    if (stream.status !== 'live') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Stream is not live' });
    }
    
    // Verify requester is a creator
    const requesterQuery = await client.query(
      'SELECT is_creator, username, profile_pic_url FROM users WHERE supabase_id = $1',
      [requesterId]
    );
    
    if (!requesterQuery.rows[0]?.is_creator) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only verified creators can request to co-host' });
    }
    
    const requester = requesterQuery.rows[0];
    
    // Check for existing request
    const existingRequest = await client.query(
      `SELECT id FROM co_host_requests 
       WHERE stream_id = $1 AND requester_id = $2 
       AND status IN ('pending', 'accepted')`,
      [streamId, requesterId]
    );
    
    if (existingRequest.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Co-host request already exists' });
    }
    
    // Create co-host request
    const requestResult = await client.query(
      `INSERT INTO co_host_requests 
       (stream_id, requester_id, creator_id, status, created_at)
       VALUES ($1, $2, $3, 'pending', NOW())
       RETURNING id`,
      [streamId, requesterId, stream.creator_id]
    );
    
    // Send notification to stream creator
    await client.query(
      `INSERT INTO notifications 
       (recipient_id, type, title, content, data, created_at)
       VALUES ($1, 'co_host_request', $2, $3, $4, NOW())`,
      [
        stream.creator_id,
        'Co-Host Request',
        `${requester.username} wants to co-host your stream`,
        JSON.stringify({
          requestId: requestResult.rows[0].id,
          requesterId,
          requesterName: requester.username,
          requesterAvatar: requester.profile_pic_url,
          streamId
        })
      ]
    );
    
    await client.query('COMMIT');
    
    // Emit socket event to creator
    const io = require('../utils/socket').getIO();
    io.to(`user:${stream.creator_id}`).emit('co_host_request', {
      requestId: requestResult.rows[0].id,
      requesterId,
      requesterName: requester.username,
      requesterAvatar: requester.profile_pic_url,
      streamId
    });
    
    res.json({
      success: true,
      message: 'Co-host request sent successfully',
      requestId: requestResult.rows[0].id
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error sending co-host request:', error);
    res.status(500).json({ error: 'Failed to send co-host request' });
  } finally {
    client.release();
  }
});

// Accept co-host request
router.post('/co-host-accept', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { requestId } = req.body;
    const creatorId = req.user.supabase_id;
    
    // Verify and update request
    const requestQuery = await client.query(
      `UPDATE co_host_requests 
       SET status = 'accepted', responded_at = NOW()
       WHERE id = $1 AND creator_id = $2 AND status = 'pending'
       RETURNING *`,
      [requestId, creatorId]
    );
    
    if (requestQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Request not found or already processed' });
    }
    
    const request = requestQuery.rows[0];
    
    // Check if there are already 4 co-hosts (limit)
    const coHostCount = await client.query(
      `SELECT COUNT(*) FROM stream_co_hosts 
       WHERE stream_id = $1 AND is_active = true`,
      [request.stream_id]
    );
    
    if (parseInt(coHostCount.rows[0].count) >= 4) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Maximum co-hosts limit reached (4)' });
    }
    
    // Add to active co-hosts
    await client.query(
      `INSERT INTO stream_co_hosts 
       (stream_id, co_host_id, creator_id, joined_at, is_active)
       VALUES ($1, $2, $3, NOW(), true)
       ON CONFLICT (stream_id, co_host_id) 
       DO UPDATE SET is_active = true, joined_at = NOW()`,
      [request.stream_id, request.requester_id, creatorId]
    );
    
    // Get co-host details
    const coHostQuery = await client.query(
      'SELECT username, profile_pic_url FROM users WHERE supabase_id = $1',
      [request.requester_id]
    );
    
    const coHost = coHostQuery.rows[0];
    
    // Send notification to requester
    await client.query(
      `INSERT INTO notifications 
       (recipient_id, type, title, content, data, created_at)
       VALUES ($1, 'co_host_accepted', $2, $3, $4, NOW())`,
      [
        request.requester_id,
        'Co-Host Request Accepted',
        'Your co-host request has been accepted!',
        JSON.stringify({ streamId: request.stream_id })
      ]
    );
    
    await client.query('COMMIT');
    
    // Emit socket events
    const io = require('../utils/socket').getIO();
    
    // Notify requester
    io.to(`user:${request.requester_id}`).emit('co_host_accepted', {
      streamId: request.stream_id,
      message: 'Your co-host request has been accepted!'
    });
    
    // Broadcast to all stream viewers
    io.to(`stream:${request.stream_id}`).emit('co_host_joined', {
      coHostId: request.requester_id,
      coHostName: coHost.username,
      coHostAvatar: coHost.profile_pic_url
    });
    
    res.json({
      success: true,
      message: 'Co-host request accepted',
      coHost: {
        id: request.requester_id,
        username: coHost.username,
        avatar: coHost.profile_pic_url
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error accepting co-host request:', error);
    res.status(500).json({ error: 'Failed to accept co-host request' });
  } finally {
    client.release();
  }
});

// Reject co-host request
router.post('/co-host-reject', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.body;
    const creatorId = req.user.supabase_id;
    
    const result = await pool.query(
      `UPDATE co_host_requests 
       SET status = 'rejected', responded_at = NOW()
       WHERE id = $1 AND creator_id = $2 AND status = 'pending'
       RETURNING requester_id, stream_id`,
      [requestId, creatorId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found or already processed' });
    }
    
    const request = result.rows[0];
    
    // Send notification to requester
    await pool.query(
      `INSERT INTO notifications 
       (recipient_id, type, title, content, data, created_at)
       VALUES ($1, 'co_host_rejected', $2, $3, $4, NOW())`,
      [
        request.requester_id,
        'Co-Host Request Declined',
        'Your co-host request has been declined',
        JSON.stringify({ streamId: request.stream_id })
      ]
    );
    
    // Emit socket event
    const io = require('../utils/socket').getIO();
    io.to(`user:${request.requester_id}`).emit('co_host_rejected', {
      streamId: request.stream_id
    });
    
    res.json({
      success: true,
      message: 'Co-host request rejected'
    });
    
  } catch (error) {
    logger.error('Error rejecting co-host request:', error);
    res.status(500).json({ error: 'Failed to reject co-host request' });
  }
});

// Remove co-host from stream
router.post('/co-host-remove', authenticateToken, async (req, res) => {
  try {
    const { coHostId, streamId } = req.body;
    const creatorId = req.user.supabase_id;
    
    const result = await pool.query(
      `UPDATE stream_co_hosts 
       SET is_active = false, left_at = NOW()
       WHERE stream_id = $1 AND co_host_id = $2 AND creator_id = $3 AND is_active = true
       RETURNING *`,
      [streamId, coHostId, creatorId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Co-host not found or already removed' });
    }
    
    // Send notification to removed co-host
    await pool.query(
      `INSERT INTO notifications 
       (recipient_id, type, title, content, data, created_at)
       VALUES ($1, 'co_host_removed', $2, $3, $4, NOW())`,
      [
        coHostId,
        'Removed from Co-Host',
        'You have been removed as a co-host',
        JSON.stringify({ streamId })
      ]
    );
    
    // Emit socket events
    const io = require('../utils/socket').getIO();
    
    // Notify removed co-host
    io.to(`user:${coHostId}`).emit('co_host_removed', {
      streamId,
      message: 'You have been removed as a co-host'
    });
    
    // Broadcast to stream viewers
    io.to(`stream:${streamId}`).emit('co_host_left', {
      coHostId
    });
    
    res.json({
      success: true,
      message: 'Co-host removed successfully'
    });
    
  } catch (error) {
    logger.error('Error removing co-host:', error);
    res.status(500).json({ error: 'Failed to remove co-host' });
  }
});

// Get all co-hosts for current user's active streams
router.get('/co-hosts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    
    // Get co-hosts for all active streams where user is creator
    const coHosts = await pool.query(
      `SELECT 
        sch.stream_id,
        sch.co_host_id,
        u.username,
        u.profile_pic_url,
        u.display_name,
        sch.joined_at,
        sch.is_active
       FROM stream_co_hosts sch
       JOIN users u ON sch.co_host_id = u.supabase_id
       JOIN streams s ON sch.stream_id = s.id
       WHERE sch.creator_id = $1 AND sch.is_active = true AND s.status = 'live'
       ORDER BY sch.joined_at DESC`,
      [userId]
    );

    res.json({
      coHosts: coHosts.rows
    });
  } catch (error) {
    logger.error('Error fetching co-hosts:', error);
    res.status(500).json({ error: 'Failed to fetch co-hosts' });
  }
});

// Get stream co-hosts
router.get('/co-hosts/:streamId', authenticateToken, async (req, res) => {
  try {
    const { streamId } = req.params;
    
    const coHosts = await pool.query(
      `SELECT 
        sch.co_host_id,
        sch.joined_at,
        u.username as display_name,
        u.profile_pic_url as avatar,
        u.is_creator
       FROM stream_co_hosts sch
       JOIN users u ON sch.co_host_id = u.supabase_id
       WHERE sch.stream_id = $1 AND sch.is_active = true
       ORDER BY sch.joined_at`,
      [streamId]
    );
    
    res.json({
      success: true,
      coHosts: coHosts.rows
    });
    
  } catch (error) {
    logger.error('Error fetching co-hosts:', error);
    res.status(500).json({ error: 'Failed to fetch co-hosts' });
  }
});

// Get pending co-host requests for creator
router.get('/co-host-requests', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;
    
    const requests = await pool.query(
      `SELECT 
        chr.id,
        chr.stream_id,
        chr.requester_id,
        chr.created_at,
        u.username as requester_name,
        u.profile_pic_url as requester_avatar,
        s.title as stream_title
       FROM co_host_requests chr
       JOIN users u ON chr.requester_id = u.supabase_id
       LEFT JOIN streams s ON chr.stream_id = s.stream_id
       WHERE chr.creator_id = $1 AND chr.status = 'pending'
       ORDER BY chr.created_at DESC`,
      [creatorId]
    );
    
    res.json({
      success: true,
      requests: requests.rows
    });
    
  } catch (error) {
    logger.error('Error fetching co-host requests:', error);
    res.status(500).json({ error: 'Failed to fetch co-host requests' });
  }
});

// Private Call Feature Endpoints

// Request a private call during stream
router.post('/private-call-request', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { streamId, estimatedDuration = 10 } = req.body;
    const fanId = req.user.supabase_id;
    
    // Get stream and creator info
    const streamQuery = await client.query(
      `SELECT 
        s.creator_id,
        s.status,
        u.price_per_min as creator_price,
        u.username as creator_name
       FROM streams s
       JOIN users u ON s.creator_id = u.supabase_id
       WHERE s.stream_id = $1`,
      [streamId]
    );
    
    if (streamQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Stream not found' });
    }
    
    const stream = streamQuery.rows[0];
    
    if (stream.status !== 'live') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Stream is not live' });
    }
    
    if (fanId === stream.creator_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot request private call with yourself' });
    }
    
    // Check for existing pending request
    const existingRequest = await client.query(
      `SELECT id FROM private_call_requests 
       WHERE fan_id = $1 AND creator_id = $2 AND status = 'pending'`,
      [fanId, stream.creator_id]
    );
    
    if (existingRequest.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You already have a pending request' });
    }
    
    // Get fan's token balance
    const fanQuery = await client.query(
      `SELECT 
        u.username,
        u.profile_pic_url,
        tb.balance as token_balance
       FROM users u
       LEFT JOIN token_balances tb ON u.supabase_id = tb.user_id::uuid
       WHERE u.supabase_id = $1`,
      [fanId]
    );
    
    if (fanQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    
    const fan = fanQuery.rows[0];
    const pricePerMinute = stream.creator_price || 10;
    const minimumMinutes = 5;
    const tokenHoldAmount = Math.ceil(pricePerMinute * minimumMinutes / 0.05); // 0.05 USD per token
    
    // Check if fan has enough tokens
    if (!fan.token_balance || fan.token_balance < tokenHoldAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Insufficient tokens',
        required: tokenHoldAmount,
        current: fan.token_balance || 0,
        pricePerMinute,
        minimumMinutes
      });
    }
    
    // Create private call request
    const requestResult = await client.query(
      `INSERT INTO private_call_requests 
       (stream_id, fan_id, creator_id, price_per_minute, minimum_minutes, 
        estimated_duration, token_hold_amount, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW() + INTERVAL '2 minutes')
       RETURNING id`,
      [streamId, fanId, stream.creator_id, pricePerMinute, minimumMinutes, 
       estimatedDuration, tokenHoldAmount]
    );
    
    // Send notification to creator
    await client.query(
      `INSERT INTO notifications 
       (recipient_id, type, title, content, data, created_at)
       VALUES ($1, 'private_call_request', $2, $3, $4, NOW())`,
      [
        stream.creator_id,
        'Private Call Request',
        `${fan.username} wants a private call for ${pricePerMinute}/min`,
        JSON.stringify({
          requestId: requestResult.rows[0].id,
          fanId,
          fanName: fan.username,
          fanAvatar: fan.profile_pic_url,
          pricePerMinute,
          minimumMinutes,
          streamId
        })
      ]
    );
    
    await client.query('COMMIT');
    
    // Emit socket event to creator
    const io = require('../utils/socket').getIO();
    io.to(`user:${stream.creator_id}`).emit('private_call_request', {
      requestId: requestResult.rows[0].id,
      fanId,
      fanName: fan.username,
      fanAvatar: fan.profile_pic_url,
      pricePerMinute,
      minimumMinutes,
      streamId
    });
    
    res.json({
      success: true,
      message: 'Private call request sent',
      requestId: requestResult.rows[0].id,
      pricePerMinute,
      minimumMinutes,
      tokenHoldAmount,
      expiresIn: 120 // seconds
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating private call request:', error);
    res.status(500).json({ error: 'Failed to create private call request' });
  } finally {
    client.release();
  }
});

// Accept private call request
router.post('/private-call-accept', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { requestId } = req.body;
    const creatorId = req.user.supabase_id;
    
    // Get and validate request
    const requestQuery = await client.query(
      `SELECT * FROM private_call_requests 
       WHERE id = $1 AND creator_id = $2 AND status = 'pending'
       AND expires_at > NOW()`,
      [requestId, creatorId]
    );
    
    if (requestQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Request not found or expired' });
    }
    
    const request = requestQuery.rows[0];
    
    // Check fan still has sufficient tokens
    const fanBalanceQuery = await client.query(
      `SELECT balance FROM token_balances WHERE user_id::uuid = $1`,
      [request.fan_id]
    );
    
    if (!fanBalanceQuery.rows[0] || fanBalanceQuery.rows[0].balance < request.token_hold_amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Fan has insufficient tokens' });
    }
    
    // Update request status
    await client.query(
      `UPDATE private_call_requests 
       SET status = 'accepted', responded_at = NOW()
       WHERE id = $1`,
      [requestId]
    );
    
    // Create private call session
    const channelName = `private-${creatorId}-${request.fan_id}-${Date.now()}`;
    const sessionResult = await client.query(
      `INSERT INTO private_call_sessions 
       (request_id, creator_id, fan_id, channel_name, price_per_minute, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING id`,
      [requestId, creatorId, request.fan_id, channelName, request.price_per_minute]
    );
    
    const sessionId = sessionResult.rows[0].id;
    
    // Create session record
    await client.query(
      `INSERT INTO sessions 
       (creator_supabase_id, user_supabase_id, type, status, is_private_call, 
        private_call_session_id, price_per_min, start_time)
       VALUES ($1, $2, 'video', 'active', true, $3, $4, NOW())`,
      [creatorId, request.fan_id, sessionId, request.price_per_minute]
    );
    
    // End the current stream
    await client.query(
      `UPDATE streams 
       SET status = 'ended', ended_at = NOW()
       WHERE stream_id = $1 AND creator_id = $2`,
      [request.stream_id, creatorId]
    );
    
    // Generate Agora tokens for private call
    const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;
    const privilegeExpireTime = 3600; // 1 hour
    
    const creatorToken = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      0, // Use 0 for dynamic UID
      RtcRole.PUBLISHER,
      privilegeExpireTime
    );
    
    const fanToken = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      0,
      RtcRole.PUBLISHER, // Both can publish in private call
      privilegeExpireTime
    );
    
    // Send notification to fan
    await client.query(
      `INSERT INTO notifications 
       (recipient_id, type, title, content, data, created_at)
       VALUES ($1, 'private_call_accepted', $2, $3, $4, NOW())`,
      [
        request.fan_id,
        'Private Call Starting',
        'Your private call request has been accepted!',
        JSON.stringify({
          sessionId,
          channel: channelName,
          token: fanToken
        })
      ]
    );
    
    await client.query('COMMIT');
    
    // Emit socket events
    const io = require('../utils/socket').getIO();
    
    // Notify fan
    io.to(`user:${request.fan_id}`).emit('private_call_accepted', {
      sessionId,
      channel: channelName,
      token: fanToken,
      creatorId,
      pricePerMinute: request.price_per_minute
    });
    
    // Notify all stream viewers that stream is ending
    io.to(`stream:${request.stream_id}`).emit('stream_ending', {
      reason: 'private_call',
      message: 'Stream ending for private call'
    });
    
    res.json({
      success: true,
      message: 'Private call accepted',
      sessionId,
      channel: channelName,
      token: creatorToken
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error accepting private call:', error);
    res.status(500).json({ error: 'Failed to accept private call' });
  } finally {
    client.release();
  }
});

// Reject private call request
router.post('/private-call-reject', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.body;
    const creatorId = req.user.supabase_id;
    
    const result = await pool.query(
      `UPDATE private_call_requests 
       SET status = 'rejected', responded_at = NOW()
       WHERE id = $1 AND creator_id = $2 AND status = 'pending'
       RETURNING fan_id, stream_id`,
      [requestId, creatorId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found or already processed' });
    }
    
    const request = result.rows[0];
    
    // Send notification to fan
    await pool.query(
      `INSERT INTO notifications 
       (recipient_id, type, title, content, data, created_at)
       VALUES ($1, 'private_call_rejected', $2, $3, $4, NOW())`,
      [
        request.fan_id,
        'Private Call Request Declined',
        'Your private call request has been declined',
        JSON.stringify({ streamId: request.stream_id })
      ]
    );
    
    // Emit socket event
    const io = require('../utils/socket').getIO();
    io.to(`user:${request.fan_id}`).emit('private_call_rejected', {
      streamId: request.stream_id
    });
    
    res.json({
      success: true,
      message: 'Private call request rejected'
    });
    
  } catch (error) {
    logger.error('Error rejecting private call:', error);
    res.status(500).json({ error: 'Failed to reject private call' });
  }
});

// Get pending private call requests for creator
router.get('/private-call-requests', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;
    const { streamId } = req.query;
    
    let query = `
      SELECT 
        pcr.*,
        u.username as fan_name,
        u.profile_pic_url as fan_avatar,
        tb.balance as fan_token_balance
      FROM private_call_requests pcr
      JOIN users u ON pcr.fan_id = u.supabase_id
      LEFT JOIN token_balances tb ON u.supabase_id = tb.user_id::uuid
      WHERE pcr.creator_id = $1 
        AND pcr.status = 'pending'
        AND pcr.expires_at > NOW()
    `;
    
    const params = [creatorId];
    
    if (streamId) {
      query += ' AND pcr.stream_id = $2';
      params.push(streamId);
    }
    
    query += ' ORDER BY pcr.created_at DESC';
    
    const requests = await pool.query(query, params);
    
    res.json({
      success: true,
      requests: requests.rows.map(req => ({
        id: req.id,
        streamId: req.stream_id,
        fanId: req.fan_id,
        fanName: req.fan_name,
        fanAvatar: req.fan_avatar,
        fanTokenBalance: req.fan_token_balance || 0,
        pricePerMinute: req.price_per_minute,
        minimumMinutes: req.minimum_minutes,
        estimatedDuration: req.estimated_duration,
        tokenHoldAmount: req.token_hold_amount,
        expiresAt: req.expires_at,
        createdAt: req.created_at
      }))
    });
    
  } catch (error) {
    logger.error('Error fetching private call requests:', error);
    res.status(500).json({ error: 'Failed to fetch private call requests' });
  }
});

// End private call session
router.post('/private-call-end', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { sessionId, reason = 'user_ended' } = req.body;
    const userId = req.user.supabase_id;
    
    // Get session details
    const sessionQuery = await client.query(
      `SELECT * FROM private_call_sessions 
       WHERE id = $1 AND status = 'active'
       AND (creator_id = $2 OR fan_id = $2)`,
      [sessionId, userId]
    );
    
    if (sessionQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Active session not found' });
    }
    
    const session = sessionQuery.rows[0];
    const endTime = new Date();
    const durationSeconds = Math.floor((endTime - new Date(session.start_time)) / 1000);
    const durationMinutes = Math.ceil(durationSeconds / 60);
    const totalCost = durationMinutes * session.price_per_minute;
    const tokensCharged = Math.ceil(totalCost / 0.05); // 0.05 USD per token
    
    // Update session
    await client.query(
      `UPDATE private_call_sessions 
       SET status = 'ended', 
           end_time = NOW(),
           duration_seconds = $1,
           total_cost = $2,
           tokens_charged = $3,
           end_reason = $4
       WHERE id = $5`,
      [durationSeconds, totalCost, tokensCharged, reason, sessionId]
    );
    
    // Deduct tokens from fan
    await client.query(
      `UPDATE token_balances 
       SET balance = balance - $1
       WHERE user_id::uuid = $2`,
      [tokensCharged, session.fan_id]
    );
    
    // Add tokens to creator (90% after 10% platform fee)
    const creatorTokens = Math.floor(tokensCharged * 0.9);
    await client.query(
      `INSERT INTO token_balances (user_id, balance)
       VALUES ($1::uuid, $2)
       ON CONFLICT (user_id) 
       DO UPDATE SET balance = token_balances.balance + $2`,
      [session.creator_id, creatorTokens]
    );
    
    // Record transactions
    await client.query(
      `INSERT INTO token_transactions 
       (user_id, type, tokens, amount_usd, session_id, status, created_at)
       VALUES 
       ($1, 'private_call_payment', $2, $3, $4, 'completed', NOW()),
       ($5, 'private_call_earnings', $6, $7, $4, 'completed', NOW())`,
      [
        session.fan_id, -tokensCharged, -totalCost, sessionId,
        session.creator_id, creatorTokens, creatorTokens * 0.05
      ]
    );
    
    // Update main session record
    await client.query(
      `UPDATE sessions 
       SET status = 'completed',
           end_time = NOW(),
           duration_minutes = $1,
           total_amount = $2
       WHERE private_call_session_id = $3`,
      [durationMinutes, totalCost, sessionId]
    );
    
    await client.query('COMMIT');
    
    // Notify both parties
    const io = require('../utils/socket').getIO();
    const endData = {
      sessionId,
      duration: durationSeconds,
      totalCost,
      tokensCharged,
      reason
    };
    
    io.to(`user:${session.creator_id}`).emit('private_call_ended', endData);
    io.to(`user:${session.fan_id}`).emit('private_call_ended', endData);
    
    res.json({
      success: true,
      message: 'Private call ended',
      duration: durationSeconds,
      totalCost,
      tokensCharged
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error ending private call:', error);
    res.status(500).json({ error: 'Failed to end private call' });
  } finally {
    client.release();
  }
});

// Stream activity tracking endpoints
router.post('/activity/:streamId', authenticateToken, async (req, res) => {
  try {
    const { streamId } = req.params;
    const { activityType, details } = req.body;
    const userId = req.user.supabase_id;

    // Log the activity
    await streamActivityMonitor.logActivity(streamId, activityType, userId, details);

    res.json({ success: true });
  } catch (error) {
    logger.error('Error logging stream activity:', error);
    res.status(500).json({ error: 'Failed to log activity' });
  }
});

// Creator heartbeat to keep stream alive
router.post('/heartbeat/:streamId', authenticateToken, async (req, res) => {
  try {
    const { streamId } = req.params;
    const creatorId = req.user.supabase_id;

    // Verify creator owns the stream
    const { rows } = await pool.query(
      'SELECT id FROM streams WHERE id = $1 AND creator_id = $2',
      [streamId, creatorId]
    );

    if (rows.length === 0) {
      return res.status(403).json({ error: 'Stream not found or access denied' });
    }

    await streamActivityMonitor.creatorHeartbeat(streamId, creatorId);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error processing heartbeat:', error);
    res.status(500).json({ error: 'Failed to process heartbeat' });
  }
});

// Update stream auto-end settings
router.put('/settings/:streamId', authenticateToken, async (req, res) => {
  try {
    const { streamId } = req.params;
    const { autoEndEnabled, autoEndMinutes } = req.body;
    const creatorId = req.user.supabase_id;

    // Update stream settings
    const { rows } = await pool.query(`
      UPDATE streams 
      SET 
        auto_end_enabled = COALESCE($1, auto_end_enabled),
        auto_end_minutes = COALESCE($2, auto_end_minutes)
      WHERE id = $3 AND creator_id = $4
      RETURNING *
    `, [autoEndEnabled, autoEndMinutes, streamId, creatorId]);

    if (rows.length === 0) {
      return res.status(403).json({ error: 'Stream not found or access denied' });
    }

    res.json({ success: true, stream: rows[0] });
  } catch (error) {
    logger.error('Error updating stream settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Get stream activity stats
router.get('/activity-stats/:streamId', authenticateToken, async (req, res) => {
  try {
    const { streamId } = req.params;
    const stats = await streamActivityMonitor.getStreamActivityStats(streamId);
    
    res.json({ success: true, stats });
  } catch (error) {
    logger.error('Error getting activity stats:', error);
    res.status(500).json({ error: 'Failed to get activity stats' });
  }
});

module.exports = router;