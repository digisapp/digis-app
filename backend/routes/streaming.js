const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
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

        // Add tokens to creator (70% after platform fee)
        const creatorEarnings = Math.floor(tokenCost * 0.7);
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
      JOIN users u ON rc.creator_id = u.id
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
      JOIN users u ON rc.creator_id = u.id
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
      JOIN users u ON rc.creator_id = u.id
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

module.exports = router;