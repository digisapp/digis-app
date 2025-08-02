const express = require('express');
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get all notifications for a user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; // Use integer ID instead of UUID
    const { limit = 20, offset = 0, unread_only = false } = req.query;

    let query = `
      SELECT 
        n.id,
        n.type,
        n.title,
        n.message,
        n.data,
        n.read_at,
        n.created_at,
        n.expires_at,
        u.username as sender_name,
        u.profile_pic_url as sender_avatar
      FROM notifications n
      LEFT JOIN users u ON n.sender_id::text = u.id::text
      WHERE n.recipient_id::text = $1::text
        AND (n.expires_at IS NULL OR n.expires_at > NOW())
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
         AND read_at IS NULL 
         AND (expires_at IS NULL OR expires_at > NOW())`,
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
    const userId = req.user.id;
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
    const userId = req.user.id;

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
    const userId = req.user.id;
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
    const userId = req.user.id;

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
    const userId = req.user.id;
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

// Export helper functions for use in other routes
module.exports = router;
module.exports.NotificationTypes = NotificationTypes;
module.exports.createNotification = createNotification;
module.exports.sendMessageNotification = sendMessageNotification;
module.exports.sendSessionRequestNotification = sendSessionRequestNotification;
module.exports.sendTipNotification = sendTipNotification;
module.exports.sendCreatorOnlineNotification = sendCreatorOnlineNotification;
module.exports.sendFollowNotification = sendFollowNotification;