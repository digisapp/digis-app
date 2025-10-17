const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Agora Cloud Recording configuration
const AGORA_APP_ID = process.env.AGORA_APP_ID;
const AGORA_CUSTOMER_KEY = process.env.AGORA_CUSTOMER_KEY;
const AGORA_CUSTOMER_SECRET = process.env.AGORA_CUSTOMER_SECRET;
const AGORA_RECORDING_URL = 'https://api.agora.io/v1/apps';

// Generate Agora Cloud Recording credentials
const generateAuth = () => {
  const credentials = `${AGORA_CUSTOMER_KEY}:${AGORA_CUSTOMER_SECRET}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
};

// Helper function to acquire recording resource
const acquireRecordingResource = async (channel, uid) => {
  try {
    const response = await axios.post(
      `${AGORA_RECORDING_URL}/${AGORA_APP_ID}/cloud_recording/acquire`,
      {
        cname: channel,
        uid: uid.toString(),
        clientRequest: {}
      },
      {
        headers: {
          'Authorization': generateAuth(),
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data.resourceId;
  } catch (error) {
    console.error('Error acquiring resource:', error.response?.data || error);
    return null;
  }
};

// Start cloud recording with Supabase Storage
router.post('/streams/:streamId/start-recording', authenticateToken, async (req, res) => {
  try {
    const { streamId } = req.params;
    const creatorId = req.user.supabase_id;
    
    // Get stream info
    const streamQuery = await db.query(
      'SELECT channel FROM streams WHERE id = $1 AND creator_id = $2',
      [streamId, creatorId]
    );
    
    if (streamQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Stream not found' });
    }
    
    const channel = streamQuery.rows[0].channel;
    const uid = `recording_${creatorId.substring(0, 8)}`;
    
    // Acquire resource from Agora
    const resourceId = await acquireRecordingResource(channel, uid);
    
    if (!resourceId) {
      return res.status(500).json({ error: 'Failed to acquire recording resource' });
    }
    
    const sid = uuidv4();
    
    // Start recording with 2K configuration
    const startConfig = {
      cname: channel,
      uid: uid.toString(),
      clientRequest: {
        token: req.body.token || '', // Recording token if required
        recordingConfig: {
          channelType: 1, // Live Broadcasting
          streamTypes: 2, // Audio + Video
          audioProfile: 1, // Music Standard
          videoStreamType: 0, // High-quality stream
          maxIdleTime: 30,
          transcodingConfig: {
            width: 2560,  // 2K resolution
            height: 1440,
            fps: 30,
            bitrate: 6000, // Increased for 2K quality
            mixedVideoLayout: 1
          }
        },
        recordingFileConfig: {
          avFileType: ["hls", "mp4"]
        },
        storageConfig: {
          vendor: 0, // 0 for Agora's built-in storage (we'll download and upload to Supabase)
          region: 0,
          bucket: "",
          accessKey: "",
          secretKey: "",
          fileNamePrefix: ["recordings", channel, new Date().toISOString().split('T')[0]]
        }
      }
    };
    
    const response = await axios.post(
      `${AGORA_RECORDING_URL}/${AGORA_APP_ID}/cloud_recording/resourceid/${resourceId}/mode/mix/start`,
      startConfig,
      {
        headers: {
          'Authorization': generateAuth(),
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Store recording info in database
    await db.query(
      `INSERT INTO recordings (
        session_id, channel, creator_id, resource_id, sid, 
        status, started_at, storage_config
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        sid,
        channel,
        creatorId,
        resourceId,
        response.data.sid,
        'recording',
        new Date(),
        JSON.stringify(startConfig.clientRequest.storageConfig)
      ]
    );
    
    // Update stream status
    await db.query(
      'UPDATE streams SET is_recording = true, recording_id = $1 WHERE id = $2',
      [sid, streamId]
    );
    
    res.json({ 
      success: true, 
      resourceId, 
      sid: response.data.sid,
      recordingId: sid 
    });
  } catch (error) {
    console.error('Error starting recording:', error.response?.data || error);
    res.status(500).json({ error: 'Failed to start recording' });
  }
});

// Stop recording and automatically save to Supabase Storage
router.post('/streams/:streamId/stop-recording', authenticateToken, async (req, res) => {
  try {
    const { streamId } = req.params;
    const { autoSave = true, title, tokenPrice = 10 } = req.body; // Auto-save by default
    const creatorId = req.user.supabase_id;
    
    // Get stream and recording info
    const streamQuery = await db.query(
      'SELECT channel, recording_id FROM streams WHERE id = $1 AND creator_id = $2',
      [streamId, creatorId]
    );
    
    if (streamQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Stream not found' });
    }
    
    const { channel, recording_id } = streamQuery.rows[0];
    
    // Get recording details
    const recordingQuery = await db.query(
      'SELECT resource_id, sid FROM recordings WHERE session_id = $1',
      [recording_id]
    );
    
    if (recordingQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Recording not found' });
    }
    
    const { resource_id: resourceId, sid } = recordingQuery.rows[0];
    const uid = `recording_${creatorId.substring(0, 8)}`;
    
    // Stop Agora recording
    const stopResponse = await axios.post(
      `${AGORA_RECORDING_URL}/${AGORA_APP_ID}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/stop`,
      {
        cname: channel,
        uid: uid.toString(),
        clientRequest: {}
      },
      {
        headers: {
          'Authorization': generateAuth(),
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Get file URL from Agora response
    const fileList = stopResponse.data.serverResponse?.fileList || [];
    
    if (fileList.length > 0) {
      // Download file from Agora's temporary storage
      const agoraFileUrl = fileList[0].fileName;
      const fileResponse = await fetch(agoraFileUrl);
      const fileBuffer = await fileResponse.buffer();
      
      // Upload to Supabase Storage
      const fileName = `${streamId}/${Date.now()}_1440p.mp4`;
      const { data, error } = await supabase.storage
        .from('stream-recordings')
        .upload(fileName, fileBuffer, {
          contentType: 'video/mp4',
          upsert: false
        });
      
      if (error) {
        console.error('Supabase upload error:', error);
        throw error;
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('stream-recordings')
        .getPublicUrl(fileName);
      
      const publicUrl = urlData.publicUrl;
      
      // Update recording in database
      await db.query(
        `UPDATE recordings 
         SET status = $1, stopped_at = $2, file_url = $3, duration = $4, file_size = $5
         WHERE session_id = $6`,
        [
          'completed',
          new Date(),
          publicUrl,
          fileList[0].duration || 0,
          fileList[0].fileSize || 0,
          recording_id
        ]
      );
      
      // Update stream status
      await db.query(
        'UPDATE streams SET is_recording = false WHERE id = $1',
        [streamId]
      );
      
      // Auto-save to stream_recordings for sale if requested
      if (autoSave) {
        const saveResult = await db.query(
          `INSERT INTO stream_recordings (
            stream_id, creator_id, title, description, file_url, thumbnail_url,
            resolution, duration, size, is_public, access_type, token_price, price
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *`,
          [
            streamId,
            creatorId,
            title || `Stream Recording ${new Date().toLocaleDateString()}`,
            `2K Recording from live stream on ${new Date().toLocaleDateString()}`,
            publicUrl,
            null, // Thumbnail will be generated later
            '1440p',
            fileList[0].duration || 0,
            fileList[0].fileSize || 0,
            true, // Always public for sale
            'paid', // Default to paid
            tokenPrice, // Default price from request
            tokenPrice * 0.05 // Convert tokens to USD
          ]
        );
        
        const savedRecording = saveResult.rows[0];
        
        // Emit socket event to notify creator
// Socket.io removed - using Ably
//         const io = require('../utils/socket').getIO();
// TODO: Replace with Ably publish
//         io.to(`user:${creatorId}`).emit('recording_auto_saved', {
          recordingId: savedRecording.id,
          title: savedRecording.title,
          fileUrl: savedRecording.file_url,
          tokenPrice: savedRecording.token_price
        });
        
        res.json({ 
          success: true,
          fileUrl: publicUrl,
          duration: fileList[0].duration,
          recordingId: savedRecording.id,
          autoSaved: true,
          tokenPrice: savedRecording.token_price
        });
      } else {
        res.json({ 
          success: true,
          fileUrl: publicUrl,
          duration: fileList[0].duration,
          recordingId: recording_id,
          autoSaved: false
        });
      }
    } else {
      throw new Error('No recording file available');
    }
  } catch (error) {
    console.error('Error stopping recording:', error.response?.data || error);
    res.status(500).json({ error: 'Failed to stop recording' });
  }
});

// Save recording to creator's content library
router.post('/streams/:streamId/save-recording', authenticateToken, async (req, res) => {
  try {
    const { streamId } = req.params;
    const { title, description, accessType, tokenPrice, thumbnailUrl } = req.body;
    const creatorId = req.user.supabase_id;
    
    // Get recording info
    const recordingQuery = await db.query(
      `SELECT r.* FROM recordings r 
       JOIN streams s ON s.recording_id = r.session_id
       WHERE s.id = $1 AND s.creator_id = $2 AND r.status = 'completed'`,
      [streamId, creatorId]
    );
    
    if (recordingQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Recording not found' });
    }
    
    const recording = recordingQuery.rows[0];
    
    // Save to stream_recordings table
    const saveResult = await db.query(
      `INSERT INTO stream_recordings (
        stream_id, creator_id, title, description, file_url, thumbnail_url,
        resolution, duration, size, is_public, access_type, token_price, price
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        streamId,
        creatorId,
        title || 'Live Stream Recording',
        description || '',
        recording.file_url,
        thumbnailUrl || null,
        '1440p', // 2K resolution
        recording.duration,
        recording.file_size,
        true, // Always public for sale
        accessType || 'paid', // Default to paid
        tokenPrice || 10, // Default price 10 tokens
        (tokenPrice || 10) * 0.05 // Convert tokens to USD
      ]
    );
    
    const savedRecording = saveResult.rows[0];
    
    // Emit socket event to notify creator
// Socket.io removed - using Ably
//     const io = require('../utils/socket').getIO();
// TODO: Replace with Ably publish
//     io.to(`user:${creatorId}`).emit('recording_saved', {
      recordingId: savedRecording.id,
      title: savedRecording.title,
      fileUrl: savedRecording.file_url
    });
    
    res.json({ 
      success: true,
      recording: savedRecording
    });
  } catch (error) {
    console.error('Error saving recording:', error);
    res.status(500).json({ error: 'Failed to save recording' });
  }
});

// Purchase a recording
router.post('/recordings/:recordingId/purchase', authenticateToken, async (req, res) => {
  const client = await db.connect();
  
  try {
    const { recordingId } = req.params;
    const userId = req.user.supabase_id;
    
    await client.query('BEGIN');
    
    // Get recording details
    const recordingResult = await client.query(
      'SELECT * FROM stream_recordings WHERE id = $1 AND access_type = $2',
      [recordingId, 'paid']
    );
    
    if (recordingResult.rows.length === 0) {
      throw new Error('Recording not found or not for sale');
    }
    
    const recording = recordingResult.rows[0];
    
    // Check if already purchased
    const purchaseCheck = await client.query(
      'SELECT id FROM recording_purchases WHERE user_id = $1 AND recording_id = $2',
      [userId, recordingId]
    );
    
    if (purchaseCheck.rows.length > 0) {
      throw new Error('Already purchased');
    }
    
    // Check user balance
    const balanceResult = await client.query(
      'SELECT token_balance FROM users WHERE supabase_id = $1 FOR UPDATE',
      [userId]
    );
    
    if (balanceResult.rows[0].token_balance < recording.token_price) {
      throw new Error('Insufficient tokens');
    }
    
    // Deduct tokens
    await client.query(
      'UPDATE users SET token_balance = token_balance - $1 WHERE supabase_id = $2',
      [recording.token_price, userId]
    );
    
    // Add to creator balance
    await client.query(
      'UPDATE users SET token_balance = token_balance + $1 WHERE supabase_id = $2',
      [recording.token_price, recording.creator_id]
    );
    
    // Record purchase
    await client.query(
      `INSERT INTO recording_purchases (user_id, recording_id, price, token_price)
       VALUES ($1, $2, $3, $4)`,
      [userId, recordingId, recording.price, recording.token_price]
    );
    
    // Update purchase count
    await client.query(
      'UPDATE stream_recordings SET purchase_count = purchase_count + 1 WHERE id = $1',
      [recordingId]
    );
    
    await client.query('COMMIT');
    
    // Emit socket events
// Socket.io removed - using Ably
//     const io = require('../utils/socket').getIO();
// TODO: Replace with Ably publish
//     io.to(`user:${userId}`).emit('recording_purchased', {
      recordingId,
      fileUrl: recording.file_url
    });
    
    res.json({ 
      success: true,
      fileUrl: recording.file_url,
      recording
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error purchasing recording:', error);
    res.status(500).json({ error: error.message || 'Failed to purchase recording' });
  } finally {
    client.release();
  }
});

// Get user's purchased recordings
router.get('/my-purchases', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT sr.*, rp.purchased_at
       FROM recording_purchases rp
       JOIN stream_recordings sr ON sr.id = rp.recording_id
       WHERE rp.user_id = $1
       ORDER BY rp.purchased_at DESC`,
      [req.user.supabase_id]
    );
    
    res.json({ 
      success: true,
      recordings: result.rows
    });
  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
});

// Get creator's recordings
router.get('/creator/:creatorId/recordings', async (req, res) => {
  try {
    const { creatorId } = req.params;
    
    const result = await db.query(
      `SELECT id, title, description, thumbnail_url, resolution, duration, 
              access_type, token_price, view_count, created_at
       FROM stream_recordings 
       WHERE creator_id = $1 AND is_public = true
       ORDER BY created_at DESC
       LIMIT 20`,
      [creatorId]
    );
    
    res.json({ 
      success: true,
      recordings: result.rows
    });
  } catch (error) {
    console.error('Error fetching creator recordings:', error);
    res.status(500).json({ error: 'Failed to fetch recordings' });
  }
});

module.exports = router;