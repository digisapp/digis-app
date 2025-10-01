const express = require('express');
const webpush = require('web-push');
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Configure web-push
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:support@digis.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn('⚠️ VAPID keys not configured - push notifications will not work');
}

// Get VAPID public key for push subscriptions
router.get('/vapid-key', authenticateToken, async (req, res) => {
  try {
    if (!process.env.VAPID_PUBLIC_KEY) {
      return res.status(501).json({
        success: false,
        error: 'Push notifications not configured'
      });
    }

    res.json({
      success: true,
      publicKey: process.env.VAPID_PUBLIC_KEY
    });
  } catch (error) {
    console.error('Get VAPID key error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get VAPID key'
    });
  }
});

// Get all notifications for a user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.supabase_id || req.user?.uid;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID not found'
      });
    }
    
    const { limit = 20, offset = 0, unread_only = false } = req.query;

    let query = `
      SELECT 
        n.id,
        n.type,
        n.title,
        n.body as message,
        n.data,
        n.read_at,
        n.created_at,
        NULL as expires_at,
        u.username as sender_name,
        u.profile_pic_url as sender_avatar
      FROM notifications n
      LEFT JOIN users u ON n.sender_id::text = u.id::text
      WHERE n.recipient_id::text = $1::text
    `;
    
    const params = [userId.toString()];
    let paramIndex = 2;

    if (unread_only === 'true') {
      query += ` AND n.read_at IS NULL`;
    }

    query += ` ORDER BY n.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Also get unread count
    const unreadResult = await pool.query(
      `SELECT COUNT(*) as unread_count 
       FROM notifications 
       WHERE recipient_id::text = $1::text 
         AND read_at IS NULL`,
      [userId.toString()]
    );

    res.json({
      success: true,
      notifications: result.rows,
      unread_count: parseInt(unreadResult.rows[0].unread_count),
      total: result.rows.length
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications'
    });
  }
});

// Mark notification as read
router.put('/:notificationId/read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.supabase_id || req.user?.uid;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID not found'
      });
    }
    const { notificationId } = req.params;

    const result = await pool.query(
      `UPDATE notifications 
       SET read_at = NOW() 
       WHERE id = $1 AND recipient_id = $2 AND read_at IS NULL
       RETURNING id`,
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found or already read'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read'
    });
  }
});

// Mark all notifications as read
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.supabase_id || req.user?.uid;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID not found'
      });
    }

    await pool.query(
      `UPDATE notifications 
       SET read_at = NOW() 
       WHERE recipient_id = $1 AND read_at IS NULL`,
      [userId]
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });

  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read'
    });
  }
});

// Delete a notification
router.delete('/:notificationId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { notificationId } = req.params;

    const result = await pool.query(
      `DELETE FROM notifications 
       WHERE id = $1 AND recipient_id = $2
       RETURNING id`,
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted'
    });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete notification'
    });
  }
});

// Create a notification (internal use)
const createNotification = async ({
  recipientId,
  senderId = null,
  type,
  title,
  message,
  data = {},
  expiresIn = null // in hours
}) => {
  try {
    let expiresAt = null;
    if (expiresIn) {
      expiresAt = new Date(Date.now() + expiresIn * 60 * 60 * 1000);
    }

    const result = await pool.query(
      `INSERT INTO notifications (recipient_id, sender_id, type, title, message, data, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, created_at`,
      [recipientId, senderId, type, title, message, JSON.stringify(data), expiresAt]
    );

    const notification = {
      id: result.rows[0].id,
      recipient_id: recipientId,
      sender_id: senderId,
      type,
      title,
      message,
      data,
      expires_at: expiresAt,
      created_at: result.rows[0].created_at,
      read_at: null
    };

    // Here you would typically emit the notification via WebSocket
    // We'll implement that next
    console.log('📨 Notification created:', notification);

    return notification;

  } catch (error) {
    console.error('Create notification error:', error);
    throw error;
  }
};

// Enhanced notification types and categories
const NotificationTypes = {
  // Existing types
  MESSAGE: 'message',
  SESSION_REQUEST: 'session_request',
  SESSION_STARTED: 'session_started',
  SESSION_ENDED: 'session_ended',
  TIP_RECEIVED: 'tip_received',
  FOLLOW: 'follow',
  CREATOR_ONLINE: 'creator_online',
  SYSTEM: 'system',
  
  // New enhanced types
  STREAM_STARTED: 'stream_started',
  STREAM_REMINDER: 'stream_reminder',
  NEW_SUBSCRIBER: 'new_subscriber',
  SUBSCRIPTION_RENEWAL: 'subscription_renewal',
  PAYMENT_SUCCESSFUL: 'payment_successful',
  PAYOUT_PROCESSED: 'payout_processed',
  CALL_REQUEST: 'call_request',
  CALL_ACCEPTED: 'call_accepted',
  BADGE_EARNED: 'badge_earned',
  LEVEL_UP: 'level_up',
  SECURITY_ALERT: 'security_alert',
  NEW_CONTENT: 'new_content',
  CONTENT_APPROVED: 'content_approved'
};

const NotificationCategories = {
  STREAMING: 'streaming',
  SOCIAL: 'social',
  FINANCIAL: 'financial',
  COMMUNICATION: 'communication',
  ACHIEVEMENT: 'achievement',
  SECURITY: 'security',
  CONTENT: 'content',
  SYSTEM: 'system'
};

const NotificationPriorities = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
};

// Helper functions for common notifications
const sendMessageNotification = async (recipientId, senderId, senderName) => {
  return createNotification({
    recipientId,
    senderId,
    type: NotificationTypes.MESSAGE,
    title: 'New Message',
    message: `${senderName} sent you a message`,
    data: { senderId, senderName }
  });
};

const sendSessionRequestNotification = async (recipientId, senderId, senderName, sessionType) => {
  return createNotification({
    recipientId,
    senderId,
    type: NotificationTypes.SESSION_REQUEST,
    title: 'Session Request',
    message: `${senderName} wants to start a ${sessionType} session with you`,
    data: { senderId, senderName, sessionType }
  });
};

const sendTipNotification = async (recipientId, senderId, senderName, amount) => {
  return createNotification({
    recipientId,
    senderId,
    type: NotificationTypes.TIP_RECEIVED,
    title: 'Tip Received!',
    message: `${senderName} sent you a tip of ${amount} tokens`,
    data: { senderId, senderName, amount }
  });
};

const sendCreatorOnlineNotification = async (recipientId, creatorId, creatorName) => {
  return createNotification({
    recipientId,
    senderId: creatorId,
    type: NotificationTypes.CREATOR_ONLINE,
    title: 'Creator Online',
    message: `${creatorName} is now online and available`,
    data: { creatorId, creatorName },
    expiresIn: 2 // expires in 2 hours
  });
};

const sendFollowNotification = async (recipientId, senderId, senderName) => {
  return createNotification({
    recipientId,
    senderId,
    type: NotificationTypes.FOLLOW,
    title: 'New Follower',
    message: `${senderName} started following you`,
    data: { senderId, senderName }
  });
};

// Enhanced notification helper functions
const sendStreamStartedNotification = async (recipientId, creatorId, creatorName, streamTitle) => {
  return createNotification({
    recipientId,
    senderId: creatorId,
    type: NotificationTypes.STREAM_STARTED,
    title: 'Creator is Live!',
    message: `${creatorName} started streaming: ${streamTitle}`,
    data: { creatorId, creatorName, streamTitle },
    expiresIn: 24 // expires in 24 hours
  });
};

const sendNewSubscriberNotification = async (recipientId, subscriberId, subscriberName, tierName) => {
  return createNotification({
    recipientId,
    senderId: subscriberId,
    type: NotificationTypes.NEW_SUBSCRIBER,
    title: 'New Subscriber!',
    message: `${subscriberName} subscribed to your ${tierName} tier`,
    data: { subscriberId, subscriberName, tierName }
  });
};

const sendPaymentSuccessfulNotification = async (recipientId, amount, description) => {
  return createNotification({
    recipientId,
    senderId: null,
    type: NotificationTypes.PAYMENT_SUCCESSFUL,
    title: 'Payment Successful',
    message: `Your payment of $${amount} for ${description} was successful`,
    data: { amount, description }
  });
};

const sendBadgeEarnedNotification = async (recipientId, badgeName, badgeIcon, points) => {
  return createNotification({
    recipientId,
    senderId: null,
    type: NotificationTypes.BADGE_EARNED,
    title: 'Badge Earned!',
    message: `You earned the "${badgeName}" badge (+${points} points)`,
    data: { badgeName, badgeIcon, points }
  });
};

const sendCallRequestNotification = async (recipientId, senderId, senderName, callType) => {
  return createNotification({
    recipientId,
    senderId,
    type: NotificationTypes.CALL_REQUEST,
    title: 'Call Request',
    message: `${senderName} wants to start a ${callType} call with you`,
    data: { senderId, senderName, callType },
    expiresIn: 1 // expires in 1 hour
  });
};

const sendSecurityAlertNotification = async (recipientId, alertType, details) => {
  return createNotification({
    recipientId,
    senderId: null,
    type: NotificationTypes.SECURITY_ALERT,
    title: 'Security Alert',
    message: `Security alert: ${alertType}`,
    data: { alertType, details }
  });
};

// Get notification preferences
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;

    const result = await pool.query(
      `SELECT * FROM notification_preferences WHERE user_id = $1`,
      [userId]
    );

    let preferences = {
      messages: true,
      session_requests: true,
      tips: true,
      follows: true,
      creator_online: true,
      system: true,
      email_notifications: false,
      push_notifications: true
    };

    if (result.rows.length > 0) {
      preferences = { ...preferences, ...result.rows[0].preferences };
    }

    res.json({
      success: true,
      preferences
    });

  } catch (error) {
    console.error('Get notification preferences error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notification preferences'
    });
  }
});

// Update notification preferences
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { preferences } = req.body;

    await pool.query(
      `INSERT INTO notification_preferences (user_id, preferences)
       VALUES ($1, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET preferences = $2, updated_at = NOW()`,
      [userId, JSON.stringify(preferences)]
    );

    res.json({
      success: true,
      message: 'Notification preferences updated'
    });

  } catch (error) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification preferences'
    });
  }
});

// Push notification subscription endpoint
router.post('/subscribe', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { subscription, userAgent } = req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription object'
      });
    }

    // Save or update subscription
    const result = await pool.query(
      `INSERT INTO push_subscriptions 
       (user_id, endpoint, p256dh, auth, user_agent, created_at, last_used_at, is_active)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), true)
       ON CONFLICT (user_id, endpoint) 
       DO UPDATE SET 
         p256dh = $3,
         auth = $4,
         user_agent = $5,
         last_used_at = NOW(),
         is_active = true
       RETURNING id`,
      [
        userId,
        subscription.endpoint,
        subscription.keys.p256dh,
        subscription.keys.auth,
        userAgent || req.headers['user-agent']
      ]
    );

    // Ensure user has push notification preferences
    await pool.query(
      `INSERT INTO push_notification_preferences (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    console.log('✅ Push subscription saved:', {
      userId,
      subscriptionId: result.rows[0].id,
      endpoint: subscription.endpoint.substring(0, 50) + '...'
    });

    res.json({
      success: true,
      message: 'Push notifications enabled',
      subscriptionId: result.rows[0].id
    });

  } catch (error) {
    console.error('Push subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save push subscription'
    });
  }
});

// Push notification unsubscribe endpoint
router.post('/unsubscribe', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        error: 'Endpoint is required'
      });
    }

    await pool.query(
      `UPDATE push_subscriptions 
       SET is_active = false, last_used_at = NOW()
       WHERE user_id = $1 AND endpoint = $2`,
      [userId, endpoint]
    );

    res.json({
      success: true,
      message: 'Push notifications disabled'
    });

  } catch (error) {
    console.error('Push unsubscribe error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unsubscribe from push notifications'
    });
  }
});

// Get push notification preferences
router.get('/push-preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;

    const result = await pool.query(
      `SELECT * FROM push_notification_preferences WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Return default preferences
      return res.json({
        success: true,
        preferences: {
          enabled: true,
          quiet_hours_enabled: false,
          quiet_hours_start: '22:00',
          quiet_hours_end: '08:00',
          new_followers: true,
          creator_online: true,
          creator_content: true,
          creator_live: true,
          messages: true,
          session_reminders: true,
          tips_received: true,
          promotions: false,
          system_updates: true
        }
      });
    }

    res.json({
      success: true,
      preferences: result.rows[0]
    });

  } catch (error) {
    console.error('Get push preferences error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch push preferences'
    });
  }
});

// Update push notification preferences
router.put('/push-preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { preferences } = req.body;

    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid preferences object'
      });
    }

    // Validate boolean fields
    const booleanFields = [
      'enabled', 'quiet_hours_enabled', 'new_followers', 'creator_online',
      'creator_content', 'creator_live', 'messages', 'session_reminders',
      'tips_received', 'promotions', 'system_updates'
    ];

    for (const field of booleanFields) {
      if (field in preferences && typeof preferences[field] !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: `${field} must be a boolean value`
        });
      }
    }

    // Build update query dynamically
    const updateFields = [];
    const values = [userId];
    let paramIndex = 2;

    for (const [key, value] of Object.entries(preferences)) {
      if (booleanFields.includes(key) || key === 'quiet_hours_start' || key === 'quiet_hours_end') {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid preferences to update'
      });
    }

    await pool.query(
      `INSERT INTO push_notification_preferences (user_id, ${updateFields.map(f => f.split(' = ')[0]).join(', ')})
       VALUES ($1, ${values.slice(1).map((_, i) => `$${i + 2}`).join(', ')})
       ON CONFLICT (user_id)
       DO UPDATE SET ${updateFields.join(', ')}, updated_at = NOW()`,
      values
    );

    res.json({
      success: true,
      message: 'Push preferences updated'
    });

  } catch (error) {
    console.error('Update push preferences error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update push preferences'
    });
  }
});

// Toggle creator notification preferences
router.post('/creator/:creatorId/toggle', authenticateToken, async (req, res) => {
  try {
    const fanId = req.user.supabase_id || req.user.id;
    const { creatorId } = req.params;
    const { enabled = true } = req.body;

    // Convert IDs to ensure they're integers
    const fanIdInt = parseInt(fanId);
    const creatorIdInt = parseInt(creatorId);

    if (isNaN(fanIdInt) || isNaN(creatorIdInt)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user or creator ID'
      });
    }

    // Check if creator exists
    const creatorCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND is_creator = true',
      [creatorIdInt]
    );

    if (creatorCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Creator not found'
      });
    }

    // Insert or update notification preference
    const result = await pool.query(
      `INSERT INTO creator_notification_preferences 
       (fan_id, creator_id, notifications_enabled, live_notifications, content_notifications, announcement_notifications)
       VALUES ($1, $2, $3, $3, $3, $3)
       ON CONFLICT (fan_id, creator_id)
       DO UPDATE SET 
         notifications_enabled = $3,
         live_notifications = $3,
         content_notifications = $3,
         announcement_notifications = $3,
         updated_at = NOW()
       RETURNING *`,
      [fanIdInt, creatorIdInt, enabled]
    );

    res.json({
      success: true,
      message: enabled ? 'Notifications enabled for this creator' : 'Notifications disabled for this creator',
      preference: result.rows[0]
    });

  } catch (error) {
    console.error('Toggle creator notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification preferences'
    });
  }
});

// Get creator notification preference for a specific creator
router.get('/creator/:creatorId/preference', authenticateToken, async (req, res) => {
  try {
    const fanId = req.user.supabase_id || req.user.id;
    const { creatorId } = req.params;
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(fanId) || !uuidRegex.test(creatorId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user or creator ID format'
      });
    }

    const result = await pool.query(
      `SELECT * FROM creator_notification_preferences 
       WHERE fan_id = $1 AND creator_id = $2`,
      [fanId, creatorId]
    );

    res.json({
      success: true,
      enabled: result.rows.length > 0 ? result.rows[0].notifications_enabled : false,
      preference: result.rows[0] || null
    });

  } catch (error) {
    console.error('Get creator notification preference error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notification preference'
    });
  }
});

// Get all creator notification preferences for a user
router.get('/creator-preferences', authenticateToken, async (req, res) => {
  try {
    const fanId = req.user.supabase_id || req.user.id;

    const result = await pool.query(
      `SELECT 
        cnp.*,
        u.username as creator_username,
        u.display_name as creator_name,
        u.profile_pic_url as creator_avatar
       FROM creator_notification_preferences cnp
       JOIN users u ON cnp.creator_id = u.id
       WHERE cnp.fan_id = $1
       ORDER BY cnp.updated_at DESC`,
      [parseInt(fanId)]
    );

    res.json({
      success: true,
      preferences: result.rows
    });

  } catch (error) {
    console.error('Get creator preferences error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch creator preferences'
    });
  }
});

// Helper function to send push notification
const sendPushNotification = async (userId, notification) => {
  try {
    // Check if user should receive this notification
    const shouldSend = await pool.query(
      'SELECT should_send_push_notification($1, $2) as should_send',
      [userId, notification.type]
    );

    if (!shouldSend.rows[0].should_send) {
      console.log('⏭️ Skipping push notification due to user preferences');
      return { sent: false, reason: 'user_preferences' };
    }

    // Get active push subscriptions
    const subscriptions = await pool.query(
      `SELECT id, endpoint, p256dh, auth 
       FROM push_subscriptions 
       WHERE user_id = $1 AND is_active = true`,
      [userId]
    );

    if (subscriptions.rows.length === 0) {
      console.log('⏭️ No active push subscriptions for user');
      return { sent: false, reason: 'no_subscriptions' };
    }

    const results = [];

    for (const sub of subscriptions.rows) {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };

        const payload = JSON.stringify({
          title: notification.title,
          body: notification.message,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          data: {
            ...notification.data,
            notificationId: notification.id,
            type: notification.type,
            timestamp: new Date().toISOString()
          },
          actions: notification.actions || []
        });

        await webpush.sendNotification(pushSubscription, payload);

        // Log successful push
        await pool.query(
          `INSERT INTO push_notification_logs 
           (user_id, subscription_id, type, title, body, data, status, sent_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'sent', NOW())`,
          [
            userId,
            sub.id,
            notification.type,
            notification.title,
            notification.message,
            JSON.stringify(notification.data)
          ]
        );

        results.push({ success: true, subscriptionId: sub.id });

      } catch (error) {
        console.error('Push notification send error:', error);

        // Log failed push
        await pool.query(
          `INSERT INTO push_notification_logs 
           (user_id, subscription_id, type, title, body, data, status, error_message, sent_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'failed', $7, NOW())`,
          [
            userId,
            sub.id,
            notification.type,
            notification.title,
            notification.message,
            JSON.stringify(notification.data),
            error.message
          ]
        );

        // Mark subscription as inactive if it's invalid
        if (error.statusCode === 410) {
          await pool.query(
            'UPDATE push_subscriptions SET is_active = false WHERE id = $1',
            [sub.id]
          );
        }

        results.push({ success: false, subscriptionId: sub.id, error: error.message });
      }
    }

    return { sent: true, results };

  } catch (error) {
    console.error('Send push notification error:', error);
    return { sent: false, error: error.message };
  }
};

// Enhanced createNotification function with push support
const createNotificationWithPush = async ({
  recipientId,
  senderId = null,
  type,
  title,
  message,
  data = {},
  expiresIn = null,
  actions = []
}) => {
  try {
    // Create the notification in database
    const notification = await createNotification({
      recipientId,
      senderId,
      type,
      title,
      message,
      data,
      expiresIn
    });

    // Send push notification
    const pushResult = await sendPushNotification(recipientId, {
      ...notification,
      actions
    });

    console.log('📨 Notification created with push:', {
      notificationId: notification.id,
      pushSent: pushResult.sent,
      pushResults: pushResult.results
    });

    return {
      ...notification,
      pushSent: pushResult.sent,
      pushResults: pushResult.results
    };

  } catch (error) {
    console.error('Create notification with push error:', error);
    throw error;
  }
};

// Enhanced follow notification with push
const sendFollowNotificationWithPush = async (recipientId, senderId, senderName) => {
  return createNotificationWithPush({
    recipientId,
    senderId,
    type: NotificationTypes.FOLLOW,
    title: 'New Follower',
    message: `${senderName} started following you`,
    data: { senderId, senderName },
    actions: [
      {
        action: 'view-profile',
        title: 'View Profile'
      }
    ]
  });
};

// Enhanced creator online notification with push
const sendCreatorOnlineNotificationWithPush = async (recipientId, creatorId, creatorName) => {
  return createNotificationWithPush({
    recipientId,
    senderId: creatorId,
    type: NotificationTypes.CREATOR_ONLINE,
    title: 'Creator Online',
    message: `${creatorName} is now online and available`,
    data: { creatorId, creatorName },
    expiresIn: 2,
    actions: [
      {
        action: 'start-session',
        title: 'Start Session'
      }
    ]
  });
};

// Test push notification endpoint (for debugging)
router.post('/test-push', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;

    const result = await createNotificationWithPush({
      recipientId: userId,
      type: NotificationTypes.SYSTEM,
      title: 'Test Push Notification',
      message: 'This is a test push notification from Digis',
      data: { test: true },
      actions: [
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ]
    });

    res.json({
      success: true,
      notification: result
    });

  } catch (error) {
    console.error('Test push error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test push notification'
    });
  }
});

// Export helper functions for use in other routes
module.exports = router;
module.exports.NotificationTypes = NotificationTypes;
module.exports.createNotification = createNotification;
module.exports.createNotificationWithPush = createNotificationWithPush;
module.exports.sendPushNotification = sendPushNotification;
module.exports.sendMessageNotification = sendMessageNotification;
module.exports.sendSessionRequestNotification = sendSessionRequestNotification;
module.exports.sendTipNotification = sendTipNotification;
module.exports.sendCreatorOnlineNotification = sendCreatorOnlineNotification;
module.exports.sendFollowNotification = sendFollowNotification;
module.exports.sendFollowNotificationWithPush = sendFollowNotificationWithPush;
module.exports.sendCreatorOnlineNotificationWithPush = sendCreatorOnlineNotificationWithPush;