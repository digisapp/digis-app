const router = require('express').Router();
const { authenticateToken } = require('../middleware/auth');
const { validateSessionInvite, handleValidationErrors } = require('../middleware/validation');
const db = require('../utils/db');
const { supabase, supabaseAdmin } = require('../utils/supabase-admin-v2');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const { notifyUser, sendNotification } = require('../utils/notifications');
const { getTokenFunctions } = require('../utils/tokens');

// Validation schemas
const inviteSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['video', 'voice'] },
    sessionType: { type: 'string', enum: ['scheduled', 'now'] },
    fanId: { type: 'number' },
    scheduled: { type: 'boolean' },
    date: { type: 'string', format: 'date' },
    time: { type: 'string' },
    duration: { type: 'number', minimum: 1, maximum: 180 },
    message: { type: 'string', maxLength: 500 },
    isRecurring: { type: 'boolean' },
    recurringFrequency: { type: 'string', enum: ['weekly', 'biweekly', 'monthly'] },
    recurringCount: { type: 'number', minimum: 1, maximum: 12 },
    totalCost: { type: 'number', minimum: 0 },
    preparations: { type: 'object' },
    package: { type: 'object' },
    requestIntakeForm: { type: 'boolean' }
  },
  required: ['type', 'fanId', 'duration', 'totalCost'],
  additionalProperties: false
};

// Request a session (video call, voice call, or message) - for fans
router.post('/request', authenticateToken, async (req, res) => {
  const userId = req.user.supabase_id; // Use supabase_id consistently
  const { creatorId, creatorUsername, serviceType, price } = req.body;

  logger.info('📞 Session request:', { 
    userId, 
    creatorId, 
    creatorUsername,
    serviceType, 
    price 
  });

  try {
    // Start a transaction
    await db.query('BEGIN');

    // 1. Check if user has enough tokens (use token_balances table)
    const balanceResult = await db.query(
      'SELECT balance FROM token_balances WHERE user_id = $1',
      [userId]
    );

    if (!balanceResult.rows[0] || balanceResult.rows[0].balance < price) {
      await db.query('ROLLBACK');
      return res.status(400).json({
        error: 'Insufficient tokens',
        required: price,
        balance: balanceResult.rows[0]?.balance || 0
      });
    }

    // Get internal user IDs for session_invites table
    const userIdResult = await db.query(
      'SELECT id FROM users WHERE supabase_id = $1',
      [userId]
    );
    const creatorIdResult = await db.query(
      'SELECT id FROM users WHERE supabase_id = $1',
      [creatorId]
    );

    if (!userIdResult.rows[0] || !creatorIdResult.rows[0]) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'User or creator not found' });
    }

    const fanIntId = userIdResult.rows[0].id;
    const creatorIntId = creatorIdResult.rows[0].id;

    // 2. Create a session request in session_invites table
    const requestResult = await db.query(
      `INSERT INTO session_invites
       (creator_id, fan_id, type, status, scheduled_date, scheduled_time,
        duration, message, total_cost, created_at)
       VALUES ($1, $2, $3, 'pending', NOW(), NOW()::time,
        $4, 'Immediate call request', $5, NOW())
       RETURNING id`,
      [creatorIntId, fanIntId, serviceType, 5, price] // Use internal IDs for foreign keys
    );

    const requestId = requestResult.rows[0].id;

    // 3. For messages, we can auto-accept and deduct tokens immediately
    if (serviceType === 'message') {
      // Deduct tokens for the message (use token_balances table)
      await db.query(
        'UPDATE token_balances SET balance = balance - $1 WHERE user_id = $2',
        [price, userId]
      );

      // Update request status
      await db.query(
        "UPDATE session_invites SET status = 'accepted' WHERE id = $1",
        [requestId]
      );

      // Record the transaction
      await db.query(
        `INSERT INTO token_transactions 
         (user_id, amount, type, description, related_id, created_at)
         VALUES ($1, $2, 'message', $3, $4, NOW())`,
        [userId, -price, `Message to ${creatorUsername}`, requestId]
      );

      await db.query('COMMIT');

      // Notify creator
      await notifyUser(creatorId, {
        type: 'new_message',
        title: 'New Message Request',
        message: `You have a new message request`,
        data: { requestId, fanId: userId, price }
      });

      res.json({
        success: true,
        requestId,
        sessionId: requestId,
        message: 'Message sent successfully'
      });
    } else {
      // For calls, keep the request pending until creator accepts
      await db.query('COMMIT');

      // Get fan info
      const fanResult = await db.query(
        'SELECT username, display_name, profile_pic_url FROM users WHERE supabase_id = $1',
        [userId]
      );
      const fan = fanResult.rows[0];

      // Notify creator
      await notifyUser(creatorId, {
        type: 'incoming_call',
        title: `${serviceType === 'video' ? 'Video' : 'Voice'} Call Request`,
        message: `${fan.display_name || fan.username} wants to ${serviceType} call with you`,
        data: {
          requestId,
          fanId: userId,
          fanUsername: fan.username,
          fanDisplayName: fan.display_name || fan.username,
          fanAvatar: fan.profile_pic_url,
          serviceType,
          price
        }
      });

      res.json({
        success: true,
        requestId,
        sessionId: requestId,
        message: `${serviceType === 'video' ? 'Video' : 'Voice'} call request sent. Waiting for creator to accept...`
      });
    }
  } catch (error) {
    await db.query('ROLLBACK');
    logger.error('❌ Session request error:', error);
    res.status(500).json({ 
      error: 'Failed to send request',
      details: error.message 
    });
  }
});

// Create session invite
router.post('/invite', authenticateToken, validateSessionInvite, async (req, res) => {
  const {
    type,
    sessionType,
    fanId,
    scheduled,
    date,
    time,
    duration,
    message,
    isRecurring,
    recurringFrequency,
    recurringCount,
    totalCost,
    preparations,
    package: sessionPackage,
    requestIntakeForm
  } = req.body;

  const creatorId = req.user.supabase_id;

  try {
    // Start transaction
    await db.query('BEGIN');

    // Verify fan exists
    const fanResult = await db.query(
      'SELECT id, username, email FROM users WHERE supabase_id = $1',
      [fanId]
    );

    if (fanResult.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Fan not found' });
    }

    const fan = fanResult.rows[0];

    // Get creator details
    const creatorResult = await db.query(
      'SELECT username, video_price, voice_price FROM users WHERE supabase_id = $1',
      [creatorId]
    );

    const creator = creatorResult.rows[0];
    const ratePerMin = type === 'video' ? creator.video_price : creator.voice_price;

    // Create session invite record
    const sessionUid = uuidv4();
    const inviteResult = await db.query(
      `INSERT INTO session_invites (
        session_uid,
        creator_id,
        fan_id,
        type,
        status,
        scheduled,
        scheduled_date,
        scheduled_time,
        duration_minutes,
        rate_per_min,
        total_cost,
        message,
        is_recurring,
        recurring_frequency,
        recurring_count,
        preparations,
        package,
        request_intake_form
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        sessionUid,
        creatorId,
        fanId,
        type,
        'pending',
        scheduled || false,
        date || null,
        time || null,
        duration,
        ratePerMin,
        totalCost,
        message || null,
        isRecurring || false,
        recurringFrequency || null,
        recurringCount || null,
        preparations ? JSON.stringify(preparations) : null,
        sessionPackage ? JSON.stringify(sessionPackage) : null,
        requestIntakeForm || false
      ]
    );

    const invite = inviteResult.rows[0];

    // Send notification to fan
    await sendNotification(fanId, {
      type: 'session_invite',
      title: `${creator.username} invited you to a ${type} call`,
      message: message || `You've been invited to a ${duration} minute ${type} call`,
      data: {
        inviteId: invite.id,
        creatorId,
        creatorUsername: creator.username,
        type,
        duration,
        cost: totalCost,
        scheduled,
        date,
        time
      }
    });

    // If it's a recurring session, create the recurring schedule
    if (isRecurring && recurringFrequency && recurringCount) {
      const schedules = [];
      let currentDate = new Date(date);

      for (let i = 0; i < recurringCount; i++) {
        schedules.push({
          inviteId: invite.id,
          sessionDate: new Date(currentDate),
          sessionTime: time,
          sequenceNumber: i + 1
        });

        // Calculate next date based on frequency
        switch (recurringFrequency) {
          case 'weekly':
            currentDate.setDate(currentDate.getDate() + 7);
            break;
          case 'biweekly':
            currentDate.setDate(currentDate.getDate() + 14);
            break;
          case 'monthly':
            currentDate.setMonth(currentDate.getMonth() + 1);
            break;
        }
      }

      // Insert recurring schedules
      for (const schedule of schedules) {
        await db.query(
          `INSERT INTO session_recurring_schedules 
           (invite_id, session_date, session_time, sequence_number)
           VALUES ($1, $2, $3, $4)`,
          [schedule.inviteId, schedule.sessionDate, schedule.sessionTime, schedule.sequenceNumber]
        );
      }
    }

    await db.query('COMMIT');

    logger.info('Session invite created', {
      inviteId: invite.id,
      creatorId,
      fanId,
      type,
      duration,
      totalCost,
      isRecurring
    });

    res.json({
      success: true,
      invite: {
        ...invite,
        creatorUsername: creator.username,
        fanUsername: fan.username
      }
    });

  } catch (error) {
    await db.query('ROLLBACK');
    logger.error('Error creating session invite:', error);
    res.status(500).json({ error: 'Failed to create session invite' });
  }
});

// Get pending invites for a user
router.get('/invites', authenticateToken, async (req, res) => {
  const userId = req.user.supabase_id;
  const { role } = req.query; // 'fan' or 'creator'

  try {
    let query;
    let params;

    if (role === 'creator') {
      // Get invites sent by creator
      query = `
        SELECT 
          si.*,
          u.username as fan_username,
          u.profile_pic_url as fan_profile_pic
        FROM session_invites si
        JOIN users u ON si.fan_id = u.id
        WHERE si.creator_id = $1
        ORDER BY si.created_at DESC
        LIMIT 50
      `;
      params = [userId];
    } else {
      // Get invites received by fan
      query = `
        SELECT 
          si.*,
          u.username as creator_username,
          u.profile_pic_url as creator_profile_pic,
          u.bio as creator_bio
        FROM session_invites si
        JOIN users u ON si.creator_id = u.id
        WHERE si.fan_id = $1 AND si.status = 'pending'
        ORDER BY si.created_at DESC
        LIMIT 50
      `;
      params = [userId];
    }

    const result = await db.query(query, params);

    res.json({
      invites: result.rows
    });

  } catch (error) {
    logger.error('Error fetching session invites:', error);
    res.status(500).json({ error: 'Failed to fetch invites' });
  }
});

// Accept/decline invite
router.put('/invites/:inviteId', authenticateToken, async (req, res) => {
  const { inviteId } = req.params;
  const { action, declineReason } = req.body; // action: 'accept' or 'decline'
  const userId = req.user.supabase_id;

  if (!['accept', 'decline'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  try {
    // Get invite details
    const inviteResult = await db.query(
      'SELECT * FROM session_invites WHERE id = $1 AND fan_id = $2 AND status = $3',
      [inviteId, userId, 'pending']
    );

    if (inviteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invite not found or already processed' });
    }

    const invite = inviteResult.rows[0];

    // Update invite status
    const newStatus = action === 'accept' ? 'accepted' : 'declined';
    await db.query(
      `UPDATE session_invites 
       SET status = $1, 
           updated_at = NOW(),
           decline_reason = $2
       WHERE id = $3`,
      [newStatus, declineReason || null, inviteId]
    );

    // Get creator details for notification
    const creatorResult = await db.query(
      'SELECT username FROM users WHERE supabase_id = $1',
      [invite.creator_id]
    );
    const creator = creatorResult.rows[0];

    // Send notification to creator
    await sendNotification(invite.creator_id, {
      type: `session_invite_${action}ed`,
      title: `Invite ${action}ed`,
      message: `${req.user.username} has ${action}ed your ${invite.type} call invite`,
      data: {
        inviteId,
        fanId: userId,
        fanUsername: req.user.username,
        action
      }
    });

    // If accepted and scheduled, create calendar entry
    if (action === 'accept' && invite.scheduled) {
      // This would integrate with calendar system
      // For now, just log it
      logger.info('Session accepted - calendar entry needed', {
        inviteId,
        date: invite.scheduled_date,
        time: invite.scheduled_time
      });
    }

    res.json({
      success: true,
      message: `Invite ${action}ed successfully`
    });

  } catch (error) {
    logger.error('Error processing invite:', error);
    res.status(500).json({ error: 'Failed to process invite' });
  }
});

// Get user's schedule (both as creator and fan)
router.get('/schedule', authenticateToken, async (req, res) => {
  const userId = req.user.supabase_id;
  
  try {
    const query = `
      SELECT 
        si.id,
        si.session_id,
        si.type,
        si.scheduled_date,
        si.scheduled_time,
        si.duration_minutes,
        si.rate_per_min,
        si.status,
        si.message as title,
        CASE 
          WHEN si.creator_id = $1 THEN true 
          ELSE false 
        END as is_creator,
        CASE 
          WHEN si.creator_id = $1 THEN u_fan.username
          ELSE u_creator.username
        END as creator_name,
        CASE 
          WHEN si.creator_id = $1 THEN u_fan.username
          ELSE u_creator.username
        END as fan_name,
        (si.rate_per_min * si.duration_minutes) as total_cost
      FROM session_invites si
      LEFT JOIN users u_creator ON si.creator_id = u_creator.supabase_id
      LEFT JOIN users u_fan ON si.fan_id = u_fan.supabase_id
      WHERE (si.creator_id = $1 OR si.fan_id = $1)
        AND si.status IN ('accepted', 'confirmed')
        AND si.scheduled_date >= CURRENT_DATE
      ORDER BY si.scheduled_date, si.scheduled_time
      LIMIT 100
    `;
    
    const result = await pool.query(query, [userId]);
    
    res.json({
      success: true,
      sessions: result.rows
    });
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch schedule'
    });
  }
});

// Get call requests for creators
router.get('/requests', authenticateToken, async (req, res) => {
  const creatorId = req.user.supabase_id;
  const { status = 'pending' } = req.query;
  
  try {
    let query;
    let params = [creatorId];
    
    if (status === 'all') {
      query = `
        SELECT 
          pcr.*,
          u.username as fan_username,
          u.profile_pic_url as fan_profile_pic,
          si.scheduled_date,
          si.scheduled_time,
          si.duration_minutes,
          si.message,
          si.type,
          si.rate_per_min
        FROM (
          SELECT 
            id, 
            fan_id, 
            creator_id, 
            price_per_minute, 
            estimated_duration,
            status,
            expires_at,
            created_at,
            'private_call' as request_type
          FROM private_call_requests
          WHERE creator_id = $1
          UNION ALL
          SELECT 
            id,
            fan_id,
            creator_id,
            rate_per_min as price_per_minute,
            duration_minutes as estimated_duration,
            status,
            created_at + INTERVAL '48 hours' as expires_at,
            created_at,
            'session_invite' as request_type
          FROM session_invites
          WHERE creator_id = $1
        ) pcr
        LEFT JOIN users u ON pcr.fan_id = u.supabase_id
        LEFT JOIN session_invites si ON pcr.id = si.id AND pcr.request_type = 'session_invite'
        ORDER BY pcr.created_at DESC
        LIMIT 50
      `;
    } else {
      params.push(status);
      query = `
        SELECT 
          pcr.*,
          u.username as fan_username,
          u.profile_pic_url as fan_profile_pic,
          si.scheduled_date,
          si.scheduled_time,
          si.duration_minutes,
          si.message,
          si.type,
          si.rate_per_min
        FROM (
          SELECT 
            id, 
            fan_id, 
            creator_id, 
            price_per_minute, 
            estimated_duration,
            status,
            expires_at,
            created_at,
            'private_call' as request_type
          FROM private_call_requests
          WHERE creator_id = $1 AND status = $2
          UNION ALL
          SELECT 
            id,
            fan_id,
            creator_id,
            rate_per_min as price_per_minute,
            duration_minutes as estimated_duration,
            status,
            created_at + INTERVAL '48 hours' as expires_at,
            created_at,
            'session_invite' as request_type
          FROM session_invites
          WHERE creator_id = $1 AND status = $2
        ) pcr
        LEFT JOIN users u ON pcr.fan_id = u.supabase_id
        LEFT JOIN session_invites si ON pcr.id = si.id AND pcr.request_type = 'session_invite'
        ORDER BY pcr.created_at DESC
        LIMIT 50
      `;
    }
    
    const result = await db.query(query, params);
    
    res.json({
      success: true,
      requests: result.rows.map(row => ({
        ...row,
        type: row.type || 'video',
        duration_minutes: row.duration_minutes || row.estimated_duration,
        rate_per_min: row.rate_per_min || row.price_per_minute
      }))
    });
    
  } catch (error) {
    logger.error('Error fetching call requests:', error);
    res.status(500).json({ error: 'Failed to fetch call requests' });
  }
});

// Accept call request and sync to calendar
router.post('/requests/:requestId/accept', authenticateToken, async (req, res) => {
  const { requestId } = req.params;
  const creatorId = req.user.supabase_id;
  const { scheduled_date, scheduled_time } = req.body;
  
  try {
    await db.query('BEGIN');
    
    // Check if it's a private call request or session invite
    const privateCallResult = await db.query(
      'SELECT * FROM private_call_requests WHERE id = $1 AND creator_id = $2',
      [requestId, creatorId]
    );
    
    let session;
    
    if (privateCallResult.rows.length > 0) {
      // Handle private call request
      const request = privateCallResult.rows[0];
      
      // Update request status
      await db.query(
        'UPDATE private_call_requests SET status = $1, responded_at = NOW() WHERE id = $2',
        ['accepted', requestId]
      );
      
      // Create calendar entry
      const calendarResult = await db.query(
        `INSERT INTO calendar_events (
          creator_id,
          fan_id,
          event_type,
          title,
          scheduled_date,
          scheduled_time,
          duration_minutes,
          status,
          reference_id,
          reference_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          creatorId,
          request.fan_id,
          'call',
          'Private Call',
          scheduled_date || new Date().toISOString().split('T')[0],
          scheduled_time || '12:00',
          request.estimated_duration || 10,
          'scheduled',
          requestId,
          'private_call_request'
        ]
      );
      
      session = calendarResult.rows[0];
      
      // Notify fan
      await sendNotification(request.fan_id, {
        type: 'call_request_accepted',
        title: 'Call Request Accepted',
        message: `Your call request has been accepted and scheduled for ${scheduled_date} at ${scheduled_time}`,
        data: { requestId, sessionId: session.id }
      });
      
    } else {
      // Check session invites
      const inviteResult = await db.query(
        'SELECT * FROM session_invites WHERE id = $1 AND creator_id = $2',
        [requestId, creatorId]
      );
      
      if (inviteResult.rows.length === 0) {
        await db.query('ROLLBACK');
        return res.status(404).json({ error: 'Request not found' });
      }
      
      const invite = inviteResult.rows[0];
      
      // Update invite status
      await db.query(
        'UPDATE session_invites SET status = $1, updated_at = NOW() WHERE id = $2',
        ['accepted', requestId]
      );
      
      // Create calendar entry
      const calendarResult = await db.query(
        `INSERT INTO calendar_events (
          creator_id,
          fan_id,
          event_type,
          title,
          scheduled_date,
          scheduled_time,
          duration_minutes,
          status,
          reference_id,
          reference_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          creatorId,
          invite.fan_id,
          invite.type,
          `${invite.type === 'video' ? 'Video' : 'Voice'} Call`,
          invite.scheduled_date || scheduled_date,
          invite.scheduled_time || scheduled_time,
          invite.duration_minutes,
          'scheduled',
          requestId,
          'session_invite'
        ]
      );
      
      session = calendarResult.rows[0];
      
      // Notify fan
      await sendNotification(invite.fan_id, {
        type: 'session_invite_accepted',
        title: 'Session Accepted',
        message: `Your ${invite.type} call has been accepted and scheduled`,
        data: { inviteId: requestId, sessionId: session.id }
      });
    }
    
    await db.query('COMMIT');
    
    res.json({
      success: true,
      message: 'Request accepted and added to calendar',
      session
    });
    
  } catch (error) {
    await db.query('ROLLBACK');
    logger.error('Error accepting call request:', error);
    res.status(500).json({ error: 'Failed to accept request' });
  }
});

// Decline call request
router.post('/requests/:requestId/decline', authenticateToken, async (req, res) => {
  const { requestId } = req.params;
  const creatorId = req.user.supabase_id;
  const { reason } = req.body;
  
  try {
    // Try updating private call request
    const privateCallResult = await db.query(
      'UPDATE private_call_requests SET status = $1, responded_at = NOW() WHERE id = $2 AND creator_id = $3 RETURNING fan_id',
      ['rejected', requestId, creatorId]
    );
    
    if (privateCallResult.rows.length > 0) {
      // Notify fan
      await sendNotification(privateCallResult.rows[0].fan_id, {
        type: 'call_request_declined',
        title: 'Call Request Declined',
        message: reason || 'Your call request has been declined',
        data: { requestId }
      });
    } else {
      // Try updating session invite
      const inviteResult = await db.query(
        'UPDATE session_invites SET status = $1, decline_reason = $2, updated_at = NOW() WHERE id = $3 AND creator_id = $4 RETURNING fan_id',
        ['declined', reason, requestId, creatorId]
      );
      
      if (inviteResult.rows.length > 0) {
        // Notify fan
        await sendNotification(inviteResult.rows[0].fan_id, {
          type: 'session_invite_declined',
          title: 'Session Declined',
          message: reason || 'Your session request has been declined',
          data: { inviteId: requestId }
        });
      } else {
        return res.status(404).json({ error: 'Request not found' });
      }
    }
    
    res.json({
      success: true,
      message: 'Request declined'
    });
    
  } catch (error) {
    logger.error('Error declining call request:', error);
    res.status(500).json({ error: 'Failed to decline request' });
  }
});

// Cancel accepted call request
router.post('/requests/:requestId/cancel', authenticateToken, async (req, res) => {
  const { requestId } = req.params;
  const creatorId = req.user.supabase_id;
  const { reason } = req.body;
  
  try {
    await db.query('BEGIN');
    
    // Update the request status to cancelled
    const privateCallResult = await db.query(
      'UPDATE private_call_requests SET status = $1, responded_at = NOW() WHERE id = $2 AND creator_id = $3 AND status = $4 RETURNING fan_id',
      ['cancelled', requestId, creatorId, 'accepted']
    );
    
    let fanId;
    
    if (privateCallResult.rows.length > 0) {
      fanId = privateCallResult.rows[0].fan_id;
      
      // Remove from calendar_events
      await db.query(
        'UPDATE calendar_events SET status = $1, updated_at = NOW() WHERE reference_id = $2 AND reference_type = $3',
        ['cancelled', requestId, 'private_call_request']
      );
    } else {
      // Try session invites
      const inviteResult = await db.query(
        'UPDATE session_invites SET status = $1, decline_reason = $2, updated_at = NOW() WHERE id = $3 AND creator_id = $4 AND status = $5 RETURNING fan_id',
        ['cancelled', reason, requestId, creatorId, 'accepted']
      );
      
      if (inviteResult.rows.length > 0) {
        fanId = inviteResult.rows[0].fan_id;
        
        // Remove from calendar_events
        await db.query(
          'UPDATE calendar_events SET status = $1, updated_at = NOW() WHERE reference_id = $2 AND reference_type = $3',
          ['cancelled', requestId, 'session_invite']
        );
      } else {
        await db.query('ROLLBACK');
        return res.status(404).json({ error: 'Accepted request not found' });
      }
    }
    
    // Notify fan about cancellation (NO TOKEN REFUND - just calendar removal)
    await sendNotification(fanId, {
      type: 'call_cancelled',
      title: 'Call Cancelled',
      message: reason || 'Your scheduled call has been cancelled by the creator. Note: No tokens will be refunded for this cancellation.',
      data: { requestId, noRefund: true }
    });
    
    await db.query('COMMIT');
    
    res.json({
      success: true,
      message: 'Call cancelled successfully'
    });
    
  } catch (error) {
    await db.query('ROLLBACK');
    logger.error('Error cancelling call:', error);
    res.status(500).json({ error: 'Failed to cancel call' });
  }
});

// Get scheduled sessions
router.get('/scheduled', authenticateToken, async (req, res) => {
  const userId = req.user.supabase_id;
  const { role } = req.query; // 'fan' or 'creator'

  try {
    let query;
    let params;

    if (role === 'creator') {
      // Get scheduled sessions for creator
      query = `
        SELECT 
          si.*,
          u.username as fan_username,
          u.profile_pic_url as fan_profile_pic
        FROM session_invites si
        JOIN users u ON si.fan_id = u.supabase_id
        WHERE si.creator_id = $1 
          AND si.status = 'accepted'
          AND si.scheduled = true
          AND si.scheduled_date >= CURRENT_DATE
        ORDER BY si.scheduled_date ASC, si.scheduled_time ASC
        LIMIT 50
      `;
      params = [userId];
    } else {
      // Get scheduled sessions for fan
      query = `
        SELECT 
          si.*,
          u.username as creator_username,
          u.profile_pic_url as creator_profile_pic
        FROM session_invites si
        JOIN users u ON si.creator_id = u.supabase_id
        WHERE si.fan_id = $1 
          AND si.status = 'accepted'
          AND si.scheduled = true
          AND si.scheduled_date >= CURRENT_DATE
        ORDER BY si.scheduled_date ASC, si.scheduled_time ASC
        LIMIT 50
      `;
      params = [userId];
    }

    const result = await db.query(query, params);

    res.json({
      success: true,
      sessions: result.rows
    });

  } catch (error) {
    logger.error('Error fetching scheduled sessions:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled sessions' });
  }
});

// Get session history
router.get('/history', authenticateToken, async (req, res) => {
  const userId = req.user.supabase_id;
  const { role, limit = 20, offset = 0 } = req.query;

  try {
    let query;
    let params;

    if (role === 'creator') {
      query = `
        SELECT 
          s.*,
          u.username as fan_username,
          u.profile_pic_url as fan_profile_pic
        FROM sessions s
        JOIN users u ON s.fan_id = u.id
        WHERE s.creator_id = $1
        ORDER BY s.created_at DESC
        LIMIT $2 OFFSET $3
      `;
      params = [userId, limit, offset];
    } else {
      query = `
        SELECT 
          s.*,
          u.username as creator_username,
          u.profile_pic_url as creator_profile_pic
        FROM sessions s
        JOIN users u ON s.creator_id = u.id
        WHERE s.fan_id = $1
        ORDER BY s.created_at DESC
        LIMIT $2 OFFSET $3
      `;
      params = [userId, limit, offset];
    }

    const result = await db.query(query, params);

    res.json({
      sessions: result.rows
    });

  } catch (error) {
    logger.error('Error fetching session history:', error);
    res.status(500).json({ error: 'Failed to fetch session history' });
  }
});

// Get upcoming sessions for dashboard
router.get('/upcoming', authenticateToken, async (req, res) => {
  const userId = req.user.supabase_id;
  
  try {
    const query = `
      SELECT 
        si.id,
        si.type,
        si.status,
        si.scheduled_date,
        si.scheduled_time,
        si.duration_minutes,
        si.rate_per_min,
        si.total_cost,
        si.message,
        si.created_at,
        CASE 
          WHEN si.creator_id = $1 THEN u_fan.username
          ELSE u_creator.username
        END as other_user_username,
        CASE 
          WHEN si.creator_id = $1 THEN u_fan.profile_pic_url
          ELSE u_creator.profile_pic_url
        END as other_user_profile_pic,
        CASE 
          WHEN si.creator_id = $1 THEN 'creator'
          ELSE 'fan'
        END as user_role
      FROM session_invites si
      LEFT JOIN users u_creator ON si.creator_id = u_creator.supabase_id
      LEFT JOIN users u_fan ON si.fan_id = u_fan.supabase_id
      WHERE (si.creator_id = $1 OR si.fan_id = $1)
        AND si.status IN ('accepted', 'confirmed')
        AND si.scheduled_date >= CURRENT_DATE
      ORDER BY si.scheduled_date, si.scheduled_time
      LIMIT 10
    `;
    
    const result = await db.query(query, [userId]);
    
    res.json({
      success: true,
      sessions: result.rows
    });
  } catch (error) {
    logger.error('Error fetching upcoming sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch upcoming sessions'
    });
  }
});

// Get session statistics
router.get('/stats', authenticateToken, async (req, res) => {
  const userId = req.user.supabase_id || req.user.id;

  try {
    // Get user info to determine if they're a creator
    const userResult = await db.query(
      'SELECT is_creator, role FROM users WHERE supabase_id = $1 OR id = $1',
      [userId]
    );

    const isCreator = userResult.rows[0]?.is_creator || userResult.rows[0]?.role === 'creator';

    let stats = {};

    if (isCreator) {
      // Get creator statistics
      const statsQuery = `
        SELECT
          COUNT(DISTINCT s.id) as total_sessions,
          COUNT(DISTINCT CASE WHEN s.session_type = 'video' THEN s.id END) as video_sessions,
          COUNT(DISTINCT CASE WHEN s.session_type = 'voice' THEN s.id END) as voice_sessions,
          COALESCE(SUM(s.total_cost), 0) as total_earned,
          COALESCE(AVG(s.duration_minutes), 0) as avg_duration,
          COUNT(DISTINCT s.user_id) as unique_fans
        FROM sessions s
        WHERE s.creator_id = $1 AND s.status = 'completed'
      `;

      const result = await db.query(statsQuery, [userId]);
      stats = result.rows[0];

      // Get recent sessions
      const recentQuery = `
        SELECT
          s.id,
          s.session_type,
          s.started_at,
          s.duration_minutes,
          s.total_cost,
          u.username as fan_username,
          u.avatar_url as fan_avatar
        FROM sessions s
        JOIN users u ON s.user_id = u.supabase_id
        WHERE s.creator_id = $1
        ORDER BY s.started_at DESC
        LIMIT 5
      `;

      const recentResult = await db.query(recentQuery, [userId]);
      stats.recent_sessions = recentResult.rows;

    } else {
      // Get fan statistics
      const statsQuery = `
        SELECT
          COUNT(DISTINCT s.id) as total_sessions,
          COUNT(DISTINCT CASE WHEN s.session_type = 'video' THEN s.id END) as video_sessions,
          COUNT(DISTINCT CASE WHEN s.session_type = 'voice' THEN s.id END) as voice_sessions,
          COALESCE(SUM(s.total_cost), 0) as total_spent,
          COALESCE(AVG(s.duration_minutes), 0) as avg_duration,
          COUNT(DISTINCT s.creator_id) as creators_connected
        FROM sessions s
        WHERE s.user_id = $1 AND s.status = 'completed'
      `;

      const result = await db.query(statsQuery, [userId]);
      stats = result.rows[0];

      // Get recent sessions for fan
      const recentQuery = `
        SELECT
          s.id,
          s.session_type,
          s.started_at,
          s.duration_minutes,
          s.total_cost,
          u.username as creator_username,
          u.avatar_url as creator_avatar
        FROM sessions s
        JOIN users u ON s.creator_id = u.supabase_id
        WHERE s.user_id = $1
        ORDER BY s.started_at DESC
        LIMIT 5
      `;

      const recentResult = await db.query(recentQuery, [userId]);
      stats.recent_sessions = recentResult.rows;
    }

    res.json({
      success: true,
      stats,
      isCreator
    });

  } catch (error) {
    logger.error('Error fetching session stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch session statistics'
    });
  }
});

module.exports = router;