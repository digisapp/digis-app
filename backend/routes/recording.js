const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');

// Agora Cloud Recording configuration
const AGORA_APP_ID = process.env.AGORA_APP_ID;
const AGORA_CUSTOMER_KEY = process.env.AGORA_CUSTOMER_KEY;
const AGORA_CUSTOMER_SECRET = process.env.AGORA_CUSTOMER_SECRET;
const AGORA_RECORDING_URL = 'https://api.agora.io/v1/apps';

// S3 or cloud storage configuration for recordings
const STORAGE_VENDOR = process.env.STORAGE_VENDOR || 'aws'; // 'aws', 'gcp', 'azure'
const STORAGE_REGION = process.env.STORAGE_REGION || 'us-east-1';
const STORAGE_BUCKET = process.env.STORAGE_BUCKET || 'digis-recordings';
const STORAGE_ACCESS_KEY = process.env.STORAGE_ACCESS_KEY;
const STORAGE_SECRET_KEY = process.env.STORAGE_SECRET_KEY;

// Generate Agora Cloud Recording credentials
const generateAuth = () => {
  const credentials = `${AGORA_CUSTOMER_KEY}:${AGORA_CUSTOMER_SECRET}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
};

// Start cloud recording
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const { channel, uid, token, mode = 'mix', recordingConfig = {} } = req.body;
    const resourceId = await acquireRecordingResource(channel, uid);
    
    if (!resourceId) {
      return res.status(500).json({ error: 'Failed to acquire recording resource' });
    }

    const sid = uuidv4();
    const startConfig = {
      cname: channel,
      uid: uid.toString(),
      clientRequest: {
        token,
        recordingConfig: {
          channelType: 1, // 0: Communication, 1: Live Broadcasting
          streamTypes: 2, // 0: Audio only, 1: Video only, 2: Audio and Video
          audioProfile: 1, // 0: Default, 1: Music Standard, 2: Music High Quality
          videoStreamType: 0, // 0: High stream, 1: Low stream
          maxIdleTime: 30,
          transcodingConfig: {
            width: 1280,
            height: 720,
            fps: 30,
            bitrate: 2260,
            ...recordingConfig.transcodingConfig
          }
        },
        recordingFileConfig: {
          avFileType: ["hls", "mp4"]
        },
        storageConfig: {
          vendor: STORAGE_VENDOR === 'aws' ? 1 : STORAGE_VENDOR === 'gcp' ? 2 : 3,
          region: STORAGE_REGION,
          bucket: STORAGE_BUCKET,
          accessKey: STORAGE_ACCESS_KEY,
          secretKey: STORAGE_SECRET_KEY,
          fileNamePrefix: [
            "recordings",
            channel,
            new Date().toISOString().split('T')[0]
          ]
        }
      }
    };

    const response = await axios.post(
      `${AGORA_RECORDING_URL}/${AGORA_APP_ID}/cloud_recording/resourceid/${resourceId}/mode/${mode}/start`,
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
        req.user.id,
        resourceId,
        response.data.sid,
        'recording',
        new Date(),
        JSON.stringify(startConfig.clientRequest.storageConfig)
      ]
    );

    res.json({
      success: true,
      recordingId: sid,
      resourceId,
      sid: response.data.sid
    });
  } catch (error) {
    console.error('Start recording error:', error.response?.data || error);
    res.status(500).json({ 
      error: 'Failed to start recording',
      details: error.response?.data || error.message
    });
  }
});

// Stop cloud recording
router.post('/stop', authenticateToken, async (req, res) => {
  try {
    const { recordingId, resourceId, sid } = req.body;

    const response = await axios.post(
      `${AGORA_RECORDING_URL}/${AGORA_APP_ID}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/stop`,
      {
        cname: req.body.channel,
        uid: req.body.uid.toString(),
        clientRequest: {}
      },
      {
        headers: {
          'Authorization': generateAuth(),
          'Content-Type': 'application/json'
        }
      }
    );

    // Update recording status
    await db.query(
      `UPDATE recordings 
       SET status = $1, stopped_at = $2, server_response = $3
       WHERE session_id = $4`,
      ['completed', new Date(), JSON.stringify(response.data), recordingId]
    );

    res.json({
      success: true,
      recordingUrl: response.data.serverResponse?.fileList?.[0]?.fileName
    });
  } catch (error) {
    console.error('Stop recording error:', error.response?.data || error);
    res.status(500).json({ 
      error: 'Failed to stop recording',
      details: error.response?.data || error.message
    });
  }
});

// Query recording status
router.get('/status/:recordingId', authenticateToken, async (req, res) => {
  try {
    const { recordingId } = req.params;
    
    const result = await db.query(
      'SELECT * FROM recordings WHERE session_id = $1 AND creator_id = $2',
      [recordingId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    const recording = result.rows[0];
    res.json({
      status: recording.status,
      startedAt: recording.started_at,
      stoppedAt: recording.stopped_at,
      fileUrl: recording.file_url,
      duration: recording.duration
    });
  } catch (error) {
    console.error('Query recording error:', error);
    res.status(500).json({ error: 'Failed to query recording status' });
  }
});

// Get all recordings for a creator
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        session_id, channel, status, started_at, stopped_at,
        duration, file_url, thumbnail_url, file_size
       FROM recordings 
       WHERE creator_id = $1 
       ORDER BY started_at DESC 
       LIMIT 50`,
      [req.user.id]
    );

    res.json({
      recordings: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('List recordings error:', error);
    res.status(500).json({ error: 'Failed to list recordings' });
  }
});

// Helper function to acquire recording resource
async function acquireRecordingResource(channel, uid) {
  try {
    const response = await axios.post(
      `${AGORA_RECORDING_URL}/${AGORA_APP_ID}/cloud_recording/acquire`,
      {
        cname: channel,
        uid: uid.toString(),
        clientRequest: {
          resourceExpiredHour: 24
        }
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
    console.error('Acquire resource error:', error.response?.data || error);
    return null;
  }
}

module.exports = router;