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
router.get('/token', authenticateToken, async (req, res) => {
  const { channel, uid, role, mode = 'rtc', isPrivate = 'false' } = req.query;
  const appID = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;
  const expireTime = 7200; // 2 hours

  logger.info('Processing Agora token request', {
    channel,
    uid,
    role,
    mode,
    isPrivate,
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

  // Server-side validation for private/ticketed streams
  if (isPrivate === 'true' && role === 'audience') {
    try {
      // Check if user has access to this private stream
      const accessCheck = await pool.query(
        `SELECT 1 FROM stream_access 
         WHERE channel = $1 AND user_id = $2 AND expires_at > NOW()
         UNION
         SELECT 1 FROM ticketed_shows_purchases 
         WHERE show_id IN (SELECT id FROM ticketed_shows WHERE channel = $1) 
         AND fan_id = $2`,
        [channel, req.user.supabase_id]
      );

      if (accessCheck.rows.length === 0) {
        logger.warn('❌ User lacks access to private stream:', {
          channel,
          userId: req.user.supabase_id
        });
        return res.status(403).json({
          error: 'Access denied to private stream',
          message: 'Please purchase access to view this stream',
          timestamp: new Date().toISOString()
        });
      }

      logger.info('✅ User authorized for private stream', {
        channel,
        userId: req.user.supabase_id
      });
    } catch (error) {
      logger.error('❌ Error checking stream access:', error);
      return res.status(500).json({
        error: 'Failed to verify stream access',
        timestamp: new Date().toISOString()
      });
    }
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

// Refresh token endpoint for existing sessions
router.post('/refresh-token', authenticateToken, (req, res) => {
  const { channel, uid, role, mode = 'rtc' } = req.body;
  const appID = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;
  const expireTime = 7200; // 2 hours

  logger.info('Processing Agora token refresh request', {
    channel,
    uid,
    role,
    mode,
    userId: req.user.supabase_id
  });

  // Validation
  if (!channel || !uid) {
    logger.error('❌ Missing required parameters for refresh:', { channel, uid });
    return res.status(400).json({ 
      error: 'Missing required parameters (channel, uid)',
      timestamp: new Date().toISOString()
    });
  }

  if (!appID || !appCertificate) {
    logger.error('❌ Environment configuration error');
    return res.status(500).json({
      error: 'Server misconfiguration: Invalid or missing Agora credentials',
      timestamp: new Date().toISOString()
    });
  }

  // Validate UID
  const numericUid = parseInt(uid);
  if (isNaN(numericUid) || numericUid <= 0) {
    logger.error('❌ Invalid UID for refresh:', uid);
    return res.status(400).json({
      error: 'UID must be a positive number',
      received: uid,
      timestamp: new Date().toISOString()
    });
  }

  // Determine role based on mode if not provided
  let finalRole = role;
  if (!finalRole && mode === 'rtc') {
    finalRole = 'host'; // Default to host for RTC mode
  } else if (!finalRole && mode === 'live') {
    // For live mode, we need to know the role
    logger.error('❌ Role required for live mode');
    return res.status(400).json({
      error: 'Role is required for live mode',
      timestamp: new Date().toISOString()
    });
  }

  // Validate role
  if (finalRole && !['host', 'audience'].includes(finalRole)) {
    logger.error('❌ Invalid role for refresh:', finalRole);
    return res.status(400).json({
      error: 'Role must be either "host" or "audience"',
      received: finalRole,
      timestamp: new Date().toISOString()
    });
  }

  try {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expireTime;
    const channelName = String(channel);
    
    // Generate new RTC token
    const rtcRole = finalRole === 'host' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    const rtcToken = RtcTokenBuilder.buildTokenWithUid(
      appID,
      appCertificate,
      channelName,
      numericUid,
      rtcRole,
      privilegeExpiredTs,
      privilegeExpiredTs
    );

    // Generate custom token for additional features
    const customToken = {
      channel: channelName,
      uid: numericUid,
      role: finalRole,
      mode: mode,
      expire: privilegeExpiredTs,
      issued: currentTimestamp,
      refreshed: true
    };

    const signature = crypto
      .createHmac('sha256', appCertificate)
      .update(JSON.stringify(customToken))
      .digest('hex');

    const signedCustomToken = Buffer.from(
      JSON.stringify({ ...customToken, signature })
    ).toString('base64');

    logger.info('✅ Token refreshed successfully', {
      channel: channelName,
      uid: numericUid,
      role: finalRole,
      mode: mode,
      expiresIn: expireTime
    });

    res.json({
      token: rtcToken,
      customToken: signedCustomToken,
      expiresIn: expireTime,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Token refresh generation error:', error);
    res.status(500).json({
      error: 'Failed to refresh token',
      details: error.message,
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
router.get('/chat-token', authenticateToken, async (req, res) => {
  const { userId } = req.query;
  const chatUserId = userId || req.user.supabase_id;
  const expireTime = 24 * 60 * 60; // 24 hours for chat tokens
  
  // Agora Chat App credentials
  const chatAppKey = process.env.AGORA_CHAT_APP_KEY || '411305034#1504278';
  const chatOrgName = process.env.AGORA_CHAT_ORG_NAME || '411305034';
  const chatAppName = process.env.AGORA_CHAT_APP_NAME || '1504278';
  const chatRestApi = process.env.AGORA_CHAT_REST_API || 'a41.chat.agora.io';
  const chatAppToken = process.env.AGORA_CHAT_APP_TOKEN || '007eJxTYHD4vUPaxWz9x8/JvzsN1kxQ8n1gVRIa3/hSNvPaOY1EC08FBlMz0xTT5LSURIOUJBNTC4vEFIM0sxRLg5Q0U1MTI5PUeUorMxoCGRnSpixjZWRgZWBkYGIA8RkYAL03Hkg=';

  logger.info('🔄 Processing Agora Chat token request:', {
    userId: chatUserId,
    appKey: chatAppKey,
    timestamp: new Date().toISOString()
  });

  try {
    // Generate Agora Chat user token using REST API
    // First, we need to register the user if they don't exist
    const registerUrl = `https://${chatRestApi}/${chatOrgName}/${chatAppName}/users`;
    
    // Try to register the user (will fail if user already exists, which is fine)
    try {
      const registerResponse = await fetch(registerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${chatAppToken}`
        },
        body: JSON.stringify({
          username: chatUserId,
          password: chatUserId // Using userId as password for simplicity
        })
      });
      
      if (registerResponse.ok) {
        logger.info('✅ User registered in Agora Chat:', chatUserId);
      }
    } catch (registerError) {
      // User might already exist, which is fine
      logger.info('User registration skipped (may already exist):', chatUserId);
    }
    
    // Now generate the user token
    const tokenUrl = `https://${chatRestApi}/${chatOrgName}/${chatAppName}/token`;
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${chatClientSecret}`
      },
      body: JSON.stringify({
        grant_type: 'password',
        username: chatUserId,
        password: chatUserId,
        ttl: expireTime
      })
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      logger.error('Failed to get Agora Chat token:', errorText);
      
      // Fallback to a simple token for testing
      const simpleToken = Buffer.from(JSON.stringify({
        appKey: chatAppKey,
        userId: chatUserId,
        timestamp: Math.floor(Date.now() / 1000),
        expire: Math.floor(Date.now() / 1000) + expireTime
      })).toString('base64');
      
      return res.json({
        success: true,
        token: simpleToken,
        userId: chatUserId,
        appKey: chatAppKey,
        mode: 'fallback',
        timestamp: new Date().toISOString()
      });
    }
    
    const tokenData = await tokenResponse.json();
    
    logger.info('✅ Chat token generated for user:', chatUserId);

    res.json({
      success: true,
      token: tokenData.access_token,
      userId: chatUserId,
      appKey: chatAppKey,
      expiresIn: tokenData.expires_in,
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

// Token renewal endpoint for co-host role changes
router.post('/renew-token', authenticateToken, async (req, res) => {
  const { channel, uid, newRole } = req.body;
  const appID = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;
  const expireTime = 7200; // 2 hours

  logger.info('🔄 Processing token renewal for role change:', {
    channel,
    uid,
    oldRole: req.body.oldRole || 'unknown',
    newRole,
    userId: req.user.supabase_id
  });

  // Validation
  if (!channel || !uid || !newRole) {
    logger.error('❌ Missing required parameters for token renewal');
    return res.status(400).json({ 
      error: 'Missing required parameters (channel, uid, newRole)',
      timestamp: new Date().toISOString()
    });
  }

  if (!appID || !appCertificate) {
    logger.error('❌ Agora credentials not configured');
    return res.status(500).json({
      error: 'Server misconfiguration',
      timestamp: new Date().toISOString()
    });
  }

  // Validate role transition
  const validTransitions = {
    'audience': ['host', 'cohost'],
    'host': ['audience', 'cohost'],
    'cohost': ['audience', 'host']
  };

  const oldRole = req.body.oldRole || 'audience';
  if (!validTransitions[oldRole]?.includes(newRole)) {
    logger.error('❌ Invalid role transition:', { oldRole, newRole });
    return res.status(400).json({
      error: 'Invalid role transition',
      oldRole,
      newRole,
      allowedTransitions: validTransitions[oldRole],
      timestamp: new Date().toISOString()
    });
  }

  const numericUid = parseInt(uid);
  if (isNaN(numericUid) || numericUid <= 0) {
    logger.error('❌ Invalid UID for renewal:', uid);
    return res.status(400).json({
      error: 'UID must be a positive number',
      timestamp: new Date().toISOString()
    });
  }

  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expireTime;

  try {
    // Generate new RTC token with appropriate role
    // For co-hosts and hosts, use PUBLISHER role
    // For audience, use SUBSCRIBER role
    const rtcRole = (newRole === 'host' || newRole === 'cohost') 
      ? RtcRole.PUBLISHER 
      : RtcRole.SUBSCRIBER;
    
    logger.info('🔄 Generating renewed RTC token:', {
      channel,
      uid: numericUid,
      rtcRole,
      newRole
    });

    const rtcToken = RtcTokenBuilder.buildTokenWithUid(
      appID,
      appCertificate,
      channel,
      numericUid,
      rtcRole,
      privilegeExpiredTs
    );

    if (!rtcToken) {
      throw new Error('Failed to generate renewed RTC token');
    }

    // Also generate a new chat token with updated role
    const chatTokenData = {
      appId: appID,
      uid: numericUid,
      channel: channel,
      role: newRole,
      timestamp: currentTimestamp,
      expire: privilegeExpiredTs
    };

    const chatTokenString = JSON.stringify(chatTokenData);
    const chatToken = crypto
      .createHmac('sha256', appCertificate)
      .update(chatTokenString)
      .digest('base64');

    logger.info('✅ Tokens renewed successfully for role change:', {
      userId: req.user.supabase_id,
      uid: numericUid,
      oldRole,
      newRole,
      rtcRole
    });

    res.json({
      success: true,
      rtcToken,
      chatToken,
      role: newRole,
      rtcRole: rtcRole === RtcRole.PUBLISHER ? 'PUBLISHER' : 'SUBSCRIBER',
      expiresAt: new Date(privilegeExpiredTs * 1000).toISOString(),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ Token renewal error:', error);
    res.status(500).json({
      error: 'Failed to renew tokens',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Co-host invitation token generation
router.post('/cohost-token', authenticateToken, async (req, res) => {
  const { channel, targetUserId } = req.body;
  const appID = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;
  const expireTime = 7200; // 2 hours

  logger.info('🎭 Generating co-host invitation token:', {
    channel,
    targetUserId,
    invitedBy: req.user.supabase_id
  });

  if (!channel || !targetUserId) {
    return res.status(400).json({ 
      error: 'Missing required parameters (channel, targetUserId)',
      timestamp: new Date().toISOString()
    });
  }

  if (!appID || !appCertificate) {
    return res.status(500).json({
      error: 'Server misconfiguration',
      timestamp: new Date().toISOString()
    });
  }

  try {
    // Generate a unique UID for the co-host
    const cohostUid = Math.floor(Math.random() * 100000) + 10000;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expireTime;

    // Generate token with PUBLISHER role for co-host
    const rtcToken = RtcTokenBuilder.buildTokenWithUid(
      appID,
      appCertificate,
      channel,
      cohostUid,
      RtcRole.PUBLISHER, // Co-hosts always get PUBLISHER role
      privilegeExpiredTs
    );

    // Generate chat token for co-host
    const chatTokenData = {
      appId: appID,
      uid: cohostUid,
      channel: channel,
      role: 'cohost',
      timestamp: currentTimestamp,
      expire: privilegeExpiredTs
    };

    const chatTokenString = JSON.stringify(chatTokenData);
    const chatToken = crypto
      .createHmac('sha256', appCertificate)
      .update(chatTokenString)
      .digest('base64');

    logger.info('✅ Co-host tokens generated successfully:', {
      targetUserId,
      cohostUid,
      channel
    });

    res.json({
      success: true,
      rtcToken,
      chatToken,
      uid: cohostUid,
      role: 'cohost',
      channel,
      expiresAt: new Date(privilegeExpiredTs * 1000).toISOString(),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ Co-host token generation error:', error);
    res.status(500).json({
      error: 'Failed to generate co-host tokens',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;