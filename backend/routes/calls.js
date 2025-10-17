const express = require('express');
const { RtcTokenBuilder, RtcRole } = require('agora-token');
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../utils/db');
const { logger } = require('../utils/secureLogger');
const { generateStableAgoraUid } = require('../utils/agoraUid');
const { requireFeature } = require('../utils/featureFlags');
const { emitCallRequest, emitCallAccepted, emitCallRejected } = require('../utils/ably-adapter');
const router = express.Router();

// Call cooldown: prevent spam calling (1 call per 60 seconds to same fan)
const callCooldowns = new Map(); // creator_fan pair -> last call timestamp

function checkCallCooldown(creatorId, fanId) {
  const key = `${creatorId}:${fanId}`;
  const lastCall = callCooldowns.get(key);
  const now = Date.now();
  const cooldownMs = 60000; // 60 seconds

  if (lastCall && (now - lastCall) < cooldownMs) {
    const remaining = Math.ceil((cooldownMs - (now - lastCall)) / 1000);
    return {
      allowed: false,
      remaining
    };
  }

  callCooldowns.set(key, now);

  // Cleanup old entries (older than 5 minutes)
  if (callCooldowns.size > 1000) {
    for (const [k, v] of callCooldowns.entries()) {
      if (now - v > 300000) callCooldowns.delete(k);
    }
  }

  return { allowed: true };
}

// POST /api/calls/init - Initialize a pay-per-minute call (Pro Monetization)
router.post('/init', authenticateToken, async (req, res) => {
  try {
    const fanId = req.user.supabase_id;
    const { creatorId, rate_tokens_per_min } = req.body;

    // Validation
    if (!creatorId || !rate_tokens_per_min || rate_tokens_per_min <= 0) {
      return res.status(400).json({ error: 'INVALID_REQUEST', message: 'Creator ID and rate required' });
    }

    // Verify creator exists and is a creator
    const creatorCheck = await pool.query(
      'SELECT is_creator, username FROM users WHERE supabase_id = $1',
      [creatorId]
    );

    if (creatorCheck.rows.length === 0) {
      return res.status(404).json({ error: 'CREATOR_NOT_FOUND' });
    }

    if (!creatorCheck.rows[0].is_creator) {
      return res.status(400).json({ error: 'NOT_A_CREATOR' });
    }

    // Check fan's balance (require at least 30 seconds worth)
    const fanWallet = await pool.query(
      'SELECT balance FROM wallets WHERE user_id = $1',
      [fanId]
    );

    const balance = fanWallet.rows[0]?.balance || 0;
    const minRequired = Math.ceil(rate_tokens_per_min / 2); // 30 seconds worth

    if (balance < minRequired) {
      return res.status(400).json({
        error: 'INSUFFICIENT_TOKENS',
        message: `Need at least ${minRequired} tokens to start call`,
        required: minRequired,
        current: balance
      });
    }

    // Generate unique channel using nanoid
    const { nanoid } = require('nanoid');
    const channel = `call_${nanoid(12)}`;

    // Create call record in new calls table
    const callResult = await pool.query(
      `INSERT INTO calls (
        creator_id, fan_id, channel, rate_tokens_per_min, status
      ) VALUES ($1, $2, $3, $4, 'active') RETURNING *`,
      [creatorId, fanId, channel, rate_tokens_per_min]
    );

    const call = callResult.rows[0];

    logger.info('Pro call initialized:', {
      callId: call.id,
      creatorId,
      fanId,
      channel,
      rate: rate_tokens_per_min
    });

    res.json({
      success: true,
      callId: call.id,
      channel: call.channel,
      rate: rate_tokens_per_min,
      started_at: call.started_at
    });

  } catch (error) {
    logger.error('Error initializing pro call:', error);
    res.status(500).json({ error: 'CALL_INIT_FAILED', message: error.message });
  }
});

// POST /api/calls/initiate - Creator initiates a call to a fan
router.post('/initiate', requireFeature('CALLS'), authenticateToken, async (req, res) => {
  const { fanId, callType, message } = req.body;
  const creatorId = req.user.supabase_id;

  if (!fanId || !callType) {
    return res.status(400).json({
      error: 'Missing required fields: fanId, callType',
      timestamp: new Date().toISOString()
    });
  }

  if (!['voice', 'video'].includes(callType)) {
    return res.status(400).json({
      error: 'Invalid call type. Must be "voice" or "video"',
      timestamp: new Date().toISOString()
    });
  }

  try {
    // Check if requester is a creator
    const creatorCheck = await pool.query(
      'SELECT is_creator FROM users WHERE firebase_uid = $1',
      [creatorId]
    );

    if (!creatorCheck.rows[0]?.is_creator) {
      return res.status(403).json({
        ok: false,
        code: 'NOT_CREATOR',
        error: 'Only creators can initiate calls',
        timestamp: new Date().toISOString()
      });
    }

    // Check call cooldown
    const cooldown = checkCallCooldown(creatorId, fanId);
    if (!cooldown.allowed) {
      return res.status(429).json({
        ok: false,
        code: 'CALL_COOLDOWN',
        error: 'Please wait before calling this fan again',
        retryAfter: cooldown.remaining,
        timestamp: new Date().toISOString()
      });
    }

    // Check if fan exists and get their call settings
    const fanCheck = await pool.query(
      'SELECT firebase_uid, fan_allow_calls FROM users WHERE firebase_uid = $1',
      [fanId]
    );

    if (fanCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Fan not found',
        timestamp: new Date().toISOString()
      });
    }

    // Check if fan has blocked this creator
    const blockCheck = await pool.query(
      'SELECT 1 FROM creator_blocked_users WHERE creator_id = $1 AND blocked_user_id = $2',
      [creatorId, fanId]
    );

    if (blockCheck.rows.length > 0) {
      return res.status(403).json({
        ok: false,
        code: 'FAN_BLOCKED',
        error: 'Unable to call this fan',
        timestamp: new Date().toISOString()
      });
    }

    // Check permissions using database function
    const permissionCheck = await pool.query(
      'SELECT can_creator_call_fan($1, $2) as can_call',
      [creatorId, fanId]
    );

    if (!permissionCheck.rows[0].can_call) {
      return res.status(403).json({
        ok: false,
        code: 'CALL_NOT_ALLOWED',
        error: 'This fan does not allow calls from you',
        message: 'The fan may only accept calls from creators they follow or have interacted with',
        reason: 'POLICY',
        timestamp: new Date().toISOString()
      });
    }

    // Get creator's rate per minute
    const rateResult = await pool.query(
      'SELECT price_per_min FROM users WHERE firebase_uid = $1',
      [creatorId]
    );
    const ratePerMinute = rateResult.rows[0]?.price_per_min || 1.00;

    // Generate unique channel name
    const channel = `call_${creatorId.substring(0, 8)}_${fanId.substring(0, 8)}_${Date.now()}`;

    // Generate stable Agora UIDs
    const creatorUid = generateStableAgoraUid(creatorId);
    const fanUid = generateStableAgoraUid(fanId);

    // Create call record
    const callResult = await pool.query(
      `INSERT INTO calls (
        creator_id, fan_id, call_type, channel,
        agora_channel, creator_uid, fan_uid,
        rate_per_minute, state
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ringing')
      RETURNING id, created_at`,
      [creatorId, fanId, callType, channel, channel, creatorUid, fanUid, ratePerMinute]
    );

    const callId = callResult.rows[0].id;

    // Create call invitation
    await pool.query(
      `INSERT INTO call_invitations (
        call_id, creator_id, fan_id, call_type, state, message
      )
      VALUES ($1, $2, $3, $4, 'pending', $5)`,
      [callId, creatorId, fanId, callType, message]
    );

    logger.info('Call initiated:', {
      callId,
      creatorId,
      fanId,
      callType,
      channel
    });

    // Send real-time notification to fan via Ably
    try {
      // Get creator details for the notification
      const creatorDetails = await pool.query(
        'SELECT display_name, username, profile_pic_url FROM users WHERE firebase_uid = $1',
        [creatorId]
      );

      const creator = creatorDetails.rows[0];

      // Emit to fan's personal channel using Ably
      await emitCallRequest(fanId, {
        callId,
        creatorId,
        requestId: callId, // For backward compatibility
        type: callType,
        fanId,
        fanName: creator.display_name || creator.username,
        rate: ratePerMinute,
        creatorName: creator.display_name || creator.username,
        avatar: creator.profile_pic_url,
        callType,
        expiresAt: new Date(Date.now() + 120000).toISOString(), // 2 minutes
        channel,
        message: message || `${creator.display_name || creator.username} is calling you`
      });

      logger.info('Call invitation sent to fan via Ably', { fanId, callId });
    } catch (ablyError) {
      logger.error('Error sending Ably notification:', ablyError);
      // Continue anyway - fan can still see invitation in their pending calls
    }

    res.json({
      success: true,
      callId,
      channel,
      state: 'ringing',
      message: 'Call invitation sent to fan'
    });
  } catch (error) {
    logger.error('Error initiating call:', error);
    res.status(500).json({
      error: 'Failed to initiate call',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/calls/:callId/accept - Fan accepts a call
router.post('/:callId/accept', requireFeature('CALLS'), authenticateToken, async (req, res) => {
  const { callId } = req.params;
  const fanId = req.user.supabase_id;

  const appID = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;
  const expireTime = 7200; // 2 hours

  if (!appID || !appCertificate) {
    return res.status(500).json({
      error: 'Server misconfiguration: Agora credentials missing',
      timestamp: new Date().toISOString()
    });
  }

  try {
    // Get call details
    const callResult = await pool.query(
      `SELECT
        id, creator_id, fan_id, call_type, channel,
        agora_channel, creator_uid, fan_uid, rate_per_minute, state
      FROM calls
      WHERE id = $1 AND fan_id = $2`,
      [callId, fanId]
    );

    if (callResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Call not found or unauthorized',
        timestamp: new Date().toISOString()
      });
    }

    const call = callResult.rows[0];

    if (call.state !== 'ringing') {
      return res.status(400).json({
        error: 'Call is not in ringing state',
        currentState: call.state,
        timestamp: new Date().toISOString()
      });
    }

    // Generate Agora tokens for both participants
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expireTime;

    // Creator token (PUBLISHER)
    const creatorToken = RtcTokenBuilder.buildTokenWithUid(
      appID,
      appCertificate,
      call.agora_channel,
      call.creator_uid,
      RtcRole.PUBLISHER,
      privilegeExpiredTs
    );

    // Fan token (PUBLISHER - both can speak)
    const fanToken = RtcTokenBuilder.buildTokenWithUid(
      appID,
      appCertificate,
      call.agora_channel,
      call.fan_uid,
      RtcRole.PUBLISHER,
      privilegeExpiredTs
    );

    // Update call state and tokens
    await pool.query(
      `UPDATE calls
       SET state = 'connected',
           connected_at = NOW(),
           creator_token = $1,
           fan_token = $2,
           agora_app_id = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [creatorToken, fanToken, appID, callId]
    );

    // Update invitation state
    await pool.query(
      `UPDATE call_invitations
       SET state = 'accepted',
           responded_at = NOW()
       WHERE call_id = $1`,
      [callId]
    );

    logger.info('Call accepted:', {
      callId,
      creatorId: call.creator_id,
      fanId,
      callType: call.call_type
    });

    // Send real-time notification to creator via Ably
    try {
      await emitCallAccepted(call.creator_id, {
        callId,
        type: call.call_type,
        roomId: call.agora_channel,
        creatorId: call.creator_id,
        state: 'accepted',
        fanId,
        channel: call.agora_channel
      });

      logger.info('Call accepted notification sent to creator via Ably', {
        creatorId: call.creator_id,
        callId
      });
    } catch (ablyError) {
      logger.error('Error sending call accepted notification:', ablyError);
    }

    res.json({
      success: true,
      callId,
      channel: call.agora_channel,
      appId: appID,
      token: fanToken,
      uid: call.fan_uid,
      creatorUid: call.creator_uid,
      callType: call.call_type,
      ratePerMinute: call.rate_per_minute,
      expiresIn: expireTime
    });
  } catch (error) {
    logger.error('Error accepting call:', error);
    res.status(500).json({
      error: 'Failed to accept call',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/calls/:callId/decline - Fan declines a call
router.post('/:callId/decline', authenticateToken, async (req, res) => {
  const { callId } = req.params;
  const fanId = req.user.supabase_id;

  try {
    // Get call details
    const callResult = await pool.query(
      'SELECT id, creator_id, fan_id, state FROM calls WHERE id = $1 AND fan_id = $2',
      [callId, fanId]
    );

    if (callResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Call not found or unauthorized',
        timestamp: new Date().toISOString()
      });
    }

    const call = callResult.rows[0];

    if (call.state !== 'ringing') {
      return res.status(400).json({
        error: 'Call is not in ringing state',
        currentState: call.state,
        timestamp: new Date().toISOString()
      });
    }

    // Update call state
    await pool.query(
      `UPDATE calls
       SET state = 'declined',
           ended_at = NOW(),
           end_reason = 'declined',
           updated_at = NOW()
       WHERE id = $1`,
      [callId]
    );

    // Update invitation state
    await pool.query(
      `UPDATE call_invitations
       SET state = 'declined',
           responded_at = NOW()
       WHERE call_id = $1`,
      [callId]
    );

    logger.info('Call declined:', {
      callId,
      creatorId: call.creator_id,
      fanId
    });

    // Send real-time notification to creator via Ably
    try {
      await emitCallRejected(call.creator_id, {
        callId,
        type: call.call_type,
        roomId: call.id,
        creatorId: call.creator_id,
        state: 'declined',
        fanId
      });

      logger.info('Call declined notification sent to creator via Ably', {
        creatorId: call.creator_id,
        callId
      });
    } catch (ablyError) {
      logger.error('Error sending call declined notification:', ablyError);
    }

    res.json({
      success: true,
      message: 'Call declined'
    });
  } catch (error) {
    logger.error('Error declining call:', error);
    res.status(500).json({
      error: 'Failed to decline call',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/calls/:callId/end - End an active call
router.post('/:callId/end', authenticateToken, async (req, res) => {
  const { callId } = req.params;
  const userId = req.user.supabase_id;

  try {
    // Get call details
    const callResult = await pool.query(
      `SELECT
        id, creator_id, fan_id, state, connected_at, rate_per_minute
      FROM calls
      WHERE id = $1 AND (creator_id = $2 OR fan_id = $2)`,
      [callId, userId]
    );

    if (callResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Call not found or unauthorized',
        timestamp: new Date().toISOString()
      });
    }

    const call = callResult.rows[0];

    if (call.state !== 'connected') {
      return res.status(400).json({
        error: 'Call is not active',
        currentState: call.state,
        timestamp: new Date().toISOString()
      });
    }

    // Calculate duration and cost
    const connectedAt = new Date(call.connected_at);
    const endedAt = new Date();
    const durationSeconds = Math.floor((endedAt - connectedAt) / 1000);
    const durationMinutes = Math.ceil(durationSeconds / 60); // Round up to nearest minute
    const totalCost = (durationMinutes * parseFloat(call.rate_per_minute)).toFixed(2);

    // Update call state
    await pool.query(
      `UPDATE calls
       SET state = 'ended',
           ended_at = NOW(),
           ended_by = $1,
           end_reason = 'completed',
           duration_seconds = $2,
           total_cost = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [userId, durationSeconds, totalCost, callId]
    );

    // Deduct tokens from fan's balance
    await pool.query(
      `UPDATE token_balances
       SET balance = balance - $1,
           total_spent = total_spent + $1,
           last_transaction_at = NOW()
       WHERE user_id = $2`,
      [totalCost, call.fan_id]
    );

    // Add tokens to creator's earnings
    await pool.query(
      `UPDATE token_balances
       SET balance = balance + $1,
           total_earned = total_earned + $1,
           last_transaction_at = NOW()
       WHERE user_id = $2`,
      [totalCost, call.creator_id]
    );

    // Log transaction for fan
    await pool.query(
      `INSERT INTO token_transactions (
        transaction_id, user_id, type, amount,
        balance_before, balance_after, description
      )
      SELECT
        $1, $2, 'spend', $3,
        balance + $3, balance,
        'Call with creator'
      FROM token_balances WHERE user_id = $2`,
      [`txn_call_${callId}_fan`, call.fan_id, totalCost]
    );

    // Log transaction for creator
    await pool.query(
      `INSERT INTO token_transactions (
        transaction_id, user_id, type, amount,
        balance_before, balance_after, description
      )
      SELECT
        $1, $2, 'earn', $3,
        balance - $3, balance,
        'Earned from call'
      FROM token_balances WHERE user_id = $2`,
      [`txn_call_${callId}_creator`, call.creator_id, totalCost]
    );

    logger.info('Call ended:', {
      callId,
      endedBy: userId,
      durationSeconds,
      durationMinutes,
      totalCost
    });

    res.json({
      success: true,
      callId,
      durationSeconds,
      durationMinutes,
      totalCost: parseFloat(totalCost),
      endedBy: userId
    });
  } catch (error) {
    logger.error('Error ending call:', error);
    res.status(500).json({
      error: 'Failed to end call',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/calls/:callId/status - Get call status
router.get('/:callId/status', authenticateToken, async (req, res) => {
  const { callId } = req.params;
  const userId = req.user.supabase_id;

  try {
    const result = await pool.query(
      `SELECT
        id, creator_id, fan_id, call_type, state,
        initiated_at, connected_at, ended_at,
        duration_seconds, total_cost, end_reason
      FROM calls
      WHERE id = $1 AND (creator_id = $2 OR fan_id = $2)`,
      [callId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Call not found or unauthorized',
        timestamp: new Date().toISOString()
      });
    }

    const call = result.rows[0];

    res.json({
      callId: call.id,
      callType: call.call_type,
      state: call.state,
      initiatedAt: call.initiated_at,
      connectedAt: call.connected_at,
      endedAt: call.ended_at,
      durationSeconds: call.duration_seconds,
      totalCost: call.total_cost,
      endReason: call.end_reason
    });
  } catch (error) {
    logger.error('Error fetching call status:', error);
    res.status(500).json({
      error: 'Failed to fetch call status',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/calls/pending - Get pending call invitations (for fan)
router.get('/pending', authenticateToken, async (req, res) => {
  const fanId = req.user.supabase_id;

  try {
    const result = await pool.query(
      `SELECT
        ci.id as invitation_id,
        ci.call_id,
        ci.call_type,
        ci.message,
        ci.expires_at,
        ci.created_at,
        u.username as creator_username,
        u.display_name as creator_display_name,
        u.profile_pic_url as creator_avatar_url
      FROM call_invitations ci
      JOIN calls c ON ci.call_id = c.id
      JOIN users u ON ci.creator_id = u.firebase_uid
      WHERE ci.fan_id = $1
        AND ci.state = 'pending'
        AND ci.expires_at > NOW()
      ORDER BY ci.created_at DESC`,
      [fanId]
    );

    res.json({
      invitations: result.rows.map(inv => ({
        invitationId: inv.invitation_id,
        callId: inv.call_id,
        callType: inv.call_type,
        message: inv.message,
        expiresAt: inv.expires_at,
        createdAt: inv.created_at,
        creator: {
          username: inv.creator_username,
          displayName: inv.creator_display_name,
          avatarUrl: inv.creator_avatar_url
        }
      }))
    });
  } catch (error) {
    logger.error('Error fetching pending invitations:', error);
    res.status(500).json({
      error: 'Failed to fetch pending invitations',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/calls/history - Get call history
router.get('/history', authenticateToken, async (req, res) => {
  const userId = req.user.supabase_id;
  const { limit = 20, offset = 0 } = req.query;

  try {
    const result = await pool.query(
      `SELECT
        c.id,
        c.call_type,
        c.state,
        c.initiated_at,
        c.connected_at,
        c.ended_at,
        c.duration_seconds,
        c.total_cost,
        u_creator.username as creator_username,
        u_creator.display_name as creator_display_name,
        u_creator.profile_pic_url as creator_avatar_url,
        u_fan.username as fan_username,
        u_fan.display_name as fan_display_name,
        u_fan.profile_pic_url as fan_avatar_url
      FROM calls c
      JOIN users u_creator ON c.creator_id = u_creator.firebase_uid
      JOIN users u_fan ON c.fan_id = u_fan.firebase_uid
      WHERE (c.creator_id = $1 OR c.fan_id = $1)
        AND c.state IN ('connected', 'ended')
      ORDER BY c.initiated_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const isCreator = await pool.query(
      'SELECT is_creator FROM users WHERE firebase_uid = $1',
      [userId]
    );

    res.json({
      calls: result.rows.map(call => ({
        id: call.id,
        callType: call.call_type,
        state: call.state,
        initiatedAt: call.initiated_at,
        connectedAt: call.connected_at,
        endedAt: call.ended_at,
        durationSeconds: call.duration_seconds,
        totalCost: call.total_cost,
        participant: isCreator.rows[0]?.is_creator ? {
          username: call.fan_username,
          displayName: call.fan_display_name,
          avatarUrl: call.fan_avatar_url
        } : {
          username: call.creator_username,
          displayName: call.creator_display_name,
          avatarUrl: call.creator_avatar_url
        }
      }))
    });
  } catch (error) {
    logger.error('Error fetching call history:', error);
    res.status(500).json({
      error: 'Failed to fetch call history',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
