const express = require('express');
const crypto = require('crypto');
const { RtcTokenBuilder, RtcRole } = require('agora-token');
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../utils/db');
const { logger } = require('../utils/secureLogger');
const router = express.Router();

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Agora route working',
    timestamp: new Date().toISOString(),
    environment: {
      hasAppId: !!process.env.AGORA_APP_ID,
      hasAppCertificate: !!process.env.AGORA_APP_CERTIFICATE
    }
  });
});

// Generate Agora tokens (RTC + Chat)
router.get('/token', authenticateToken, (req, res) => {
  const { channel, uid, role } = req.query;
  const appID = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;
  const expireTime = 7200; // 2 hours

  logger.info('Processing Agora token request', {
    channel,
    uid,
    role,
    userId: req.user.supabase_id
  });

  // Validation
  if (!channel || !uid || !role) {
    logger.error('❌ Missing required parameters:', { channel, uid, role });
    return res.status(400).json({ 
      error: 'Missing required parameters (channel, uid, role)',
      required: ['channel', 'uid', 'role'],
      received: { channel, uid, role },
      timestamp: new Date().toISOString()
    });
  }

  if (!appID || !appCertificate) {
    logger.error('❌ Environment configuration error:', {
      hasAppId: !!appID,
      hasAppCertificate: !!appCertificate
    });
    return res.status(500).json({
      error: 'Server misconfiguration: Invalid or missing Agora credentials',
      timestamp: new Date().toISOString()
    });
  }

  // Validate UID
  const numericUid = parseInt(uid);
  if (isNaN(numericUid) || numericUid <= 0) {
    logger.error('❌ Invalid UID:', uid);
    return res.status(400).json({
      error: 'UID must be a positive number',
      received: uid,
      timestamp: new Date().toISOString()
    });
  }

  // Validate role
  if (!['host', 'audience'].includes(role)) {
    logger.error('❌ Invalid role:', role);
    return res.status(400).json({
      error: 'Role must be either "host" or "audience"',
      received: role,
      timestamp: new Date().toISOString()
    });
  }

  // Validate channel name
  if (channel.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(channel)) {
    logger.error('❌ Invalid channel name:', channel);
    return res.status(400).json({
      error: 'Channel name must be alphanumeric, under 64 characters',
      received: channel,
      timestamp: new Date().toISOString()
    });
  }

  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expireTime;

  try {
    // Determine RTC role
    const rtcRole = role === 'host' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    
    logger.info('🔄 Generating RTC token:', {
      appID,
      channel,
      uid: numericUid,
      role: rtcRole,
      expireTime: privilegeExpiredTs
    });

    // Generate RTC token
    const rtcToken = RtcTokenBuilder.buildTokenWithUid(
      appID,
      appCertificate,
      channel,
      numericUid,
      rtcRole,
      privilegeExpiredTs
    );

    if (!rtcToken) {
      throw new Error('Failed to generate RTC token');
    }

    logger.info('✅ RTC token generated successfully, length:', rtcToken.length);

    // Generate Chat token using HMAC-SHA256
    const chatTokenData = {
      appId: appID,
      uid: numericUid,
      channel: channel,
      role: role,
      timestamp: currentTimestamp,
      expire: privilegeExpiredTs
    };

    const chatTokenString = JSON.stringify(chatTokenData);
    const chatToken = crypto
      .createHmac('sha256', appCertificate)
      .update(chatTokenString)
      .digest('base64');

    logger.info('✅ Chat token generated successfully');

    // Generate custom token for additional security
    const customTokenData = {
      appId: appID,
      channel: channel,
      uid: numericUid,
      role: role,
      timestamp: currentTimestamp,
      expire: privilegeExpiredTs
    };

    const signature = crypto
      .createHmac('sha256', appCertificate)
      .update(JSON.stringify(customTokenData))
      .digest('hex');

    const customToken = Buffer.from(JSON.stringify({
      ...customTokenData,
      signature: signature
    })).toString('base64');

    logger.info('✅ Custom token generated successfully');

    // Success response
    const response = {
      success: true,
      rtcToken: rtcToken,
      chatToken: chatToken,
      token: customToken, // Fallback token
      channel: channel,
      uid: numericUid,
      role: role,
      expiresAt: privilegeExpiredTs,
      expiresIn: expireTime,
      timestamp: new Date().toISOString(),
      appId: appID
    };

    logger.info('✅ Token generation successful:', {
      channel,
      uid: numericUid,
      role,
      expiresAt: new Date(privilegeExpiredTs * 1000).toISOString()
    });

    res.json(response);

  } catch (error) {
    logger.error('❌ Token generation error:', {
      message: error.message,
      stack: error.stack,
      query: req.query,
      user: req.user.supabase_id,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      error: 'Internal server error during token generation',
      details: error.message,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  }
});

// Validate token endpoint
router.post('/validate', authenticateToken, (req, res) => {
  const { token, type } = req.body;

  if (!token || !type) {
    return res.status(400).json({
      error: 'Missing token or type',
      timestamp: new Date().toISOString()
    });
  }

  try {
    if (type === 'custom') {
      // Validate custom token
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      const { signature, ...tokenData } = decoded;
      
      const expectedSignature = crypto
        .createHmac('sha256', process.env.AGORA_APP_CERTIFICATE)
        .update(JSON.stringify(tokenData))
        .digest('hex');

      if (signature !== expectedSignature) {
        throw new Error('Invalid token signature');
      }

      if (tokenData.expire < Math.floor(Date.now() / 1000)) {
        throw new Error('Token has expired');
      }

      res.json({
        valid: true,
        data: tokenData,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        error: 'Unsupported token type',
        supportedTypes: ['custom'],
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('❌ Token validation error:', error);
    res.status(400).json({
      valid: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Store chat message
router.post('/chat/message', authenticateToken, async (req, res) => {
  const { channel, message, type = 'text', fileUrl } = req.body;

  if (!channel || !message) {
    return res.status(400).json({
      error: 'Missing required fields: channel, message',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO chat_messages (channel, sender_id, message, type, file_url, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW()) 
       RETURNING *`,
      [channel, req.user.supabase_id, message, type, fileUrl]
    );

    res.json({
      success: true,
      message: {
        id: result.rows[0].id,
        channel: result.rows[0].channel,
        senderId: result.rows[0].sender_id,
        text: result.rows[0].message,
        type: result.rows[0].type,
        fileUrl: result.rows[0].file_url,
        timestamp: result.rows[0].created_at,
        isOwn: true
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Chat message save error:', error);
    res.status(500).json({
      error: 'Failed to save chat message',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Retrieve chat messages
router.get('/chat/messages/:channel', authenticateToken, async (req, res) => {
  const { channel } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  try {
    const result = await pool.query(
      `SELECT cm.*, u.is_creator 
       FROM chat_messages cm 
       LEFT JOIN users u ON cm.sender_id::text = u.id::text 
       WHERE cm.channel = $1 
       ORDER BY cm.created_at ASC 
       LIMIT $2 OFFSET $3`,
      [channel, limit, offset]
    );

    res.json({
      success: true,
      messages: result.rows.map(row => ({
        id: row.id,
        senderId: row.sender_id,
        text: row.message,
        type: row.type,
        fileUrl: row.file_url,
        timestamp: row.created_at,
        isOwn: row.sender_id === req.user.supabase_id,
        ext: {
          isCreator: row.is_creator || false,
          sender: row.sender_id
        }
      })),
      total: result.rows.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Chat messages fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch chat messages',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Delete chat message
router.delete('/chat/message/:messageId', authenticateToken, async (req, res) => {
  const { messageId } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM chat_messages WHERE id = $1 AND sender_id = $2 RETURNING *',
      [messageId, req.user.supabase_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Message not found or unauthorized',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Message deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Chat message delete error:', error);
    res.status(500).json({
      error: 'Failed to delete message',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get channel info
router.get('/channel/:channelName', authenticateToken, (req, res) => {
  const { channelName } = req.params;
  
  logger.info('🔄 Getting channel info:', {
    channel: channelName,
    user: req.user.supabase_id,
    timestamp: new Date().toISOString()
  });

  // This would typically query a database for channel information
  // For now, return mock data
  res.json({
    channel: channelName,
    active: true,
    participants: 0,
    createdAt: new Date().toISOString(),
    type: 'rtc',
    settings: {
      maxParticipants: 100,
      allowRecording: true,
      allowScreenShare: true
    }
  });
});

// Generate Agora RTM token for real-time messaging
router.get('/rtm-token', authenticateToken, (req, res) => {
  const { uid } = req.query;
  const appID = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;
  const userId = uid || req.user.supabase_id;
  const expireTime = 24 * 60 * 60; // 24 hours for RTM tokens

  logger.info('🔄 Processing Agora RTM token request:', {
    userId,
    requestedUid: uid,
    timestamp: new Date().toISOString()
  });

  if (!appID || !appCertificate) {
    logger.error('❌ Environment configuration error for RTM token');
    return res.status(500).json({ 
      error: 'Server configuration error',
      timestamp: new Date().toISOString()
    });
  }

  if (!userId) {
    return res.status(400).json({
      error: 'User ID is required',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expireTime;

    // Generate RTM token using HMAC-SHA256
    const rtmTokenData = {
      appId: appID,
      userId: userId,
      timestamp: currentTimestamp,
      expire: privilegeExpiredTs,
      type: 'rtm'
    };

    const rtmTokenString = JSON.stringify(rtmTokenData);
    const rtmToken = crypto
      .createHmac('sha256', appCertificate)
      .update(rtmTokenString)
      .digest('base64');

    logger.info('✅ RTM token generated successfully for user:', userId);

    res.json({
      success: true,
      rtmToken: rtmToken,
      userId: userId,
      expiresAt: new Date(privilegeExpiredTs * 1000).toISOString(),
      expiresIn: expireTime,
      timestamp: new Date().toISOString(),
      appId: appID
    });

  } catch (error) {
    logger.error('❌ RTM token generation error:', error);
    res.status(500).json({
      error: 'Failed to generate RTM token',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Generate Agora Chat token specifically for messaging
router.get('/chat/token', authenticateToken, (req, res) => {
  const appID = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;
  const userId = req.user.supabase_id;
  const expireTime = 24 * 60 * 60; // 24 hours for chat tokens

  logger.info('🔄 Processing Agora Chat token request:', {
    userId,
    timestamp: new Date().toISOString()
  });

  if (!appID || !appCertificate) {
    logger.error('❌ Environment configuration error for chat token');
    return res.status(500).json({ 
      error: 'Server configuration error',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expireTime;

    // Generate Chat token using HMAC-SHA256
    const chatTokenData = {
      appId: appID,
      userId: userId,
      timestamp: currentTimestamp,
      expire: privilegeExpiredTs
    };

    const chatTokenString = JSON.stringify(chatTokenData);
    const chatToken = crypto
      .createHmac('sha256', appCertificate)
      .update(chatTokenString)
      .digest('base64');

    logger.info('✅ Chat token generated successfully for user:', userId);

    res.json({
      success: true,
      chatToken: chatToken,
      userId: userId,
      expiresAt: new Date(privilegeExpiredTs * 1000).toISOString(),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ Chat token generation error:', error);
    res.status(500).json({
      error: 'Failed to generate chat token',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;