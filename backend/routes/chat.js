const express = require('express');
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const { getUserId } = require('../utils/auth-helpers');
const { sendMessageNotification } = require('./notifications');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Get conversations for a user (updated for new frontend)
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = getUserId(req);

    const query = `
      WITH latest_messages AS (
        SELECT DISTINCT ON (
          CASE 
            WHEN sender_id = $1 THEN receiver_id 
            ELSE sender_id 
          END
        )
          CASE 
            WHEN sender_id = $1 THEN receiver_id 
            ELSE sender_id 
          END AS other_user_id,
          content as last_message,
          created_at as last_message_time,
          message_type
        FROM chat_messages
        WHERE sender_id = $1 OR receiver_id = $1
        ORDER BY 
          CASE 
            WHEN sender_id = $1 THEN receiver_id 
            ELSE sender_id 
          END,
          created_at DESC
      )
      SELECT 
        ROW_NUMBER() OVER (ORDER BY lm.last_message_time DESC) as id,
        lm.other_user_id,
        COALESCE(u.username, u.email) as other_user_name,
        u.display_name as other_user_display_name,
        u.profile_pic_url as other_user_avatar,
        lm.last_message,
        lm.last_message_time,
        lm.message_type,
        COALESCE(unread.unread_count, 0) as unread_count,
        CASE WHEN u.last_seen > NOW() - INTERVAL '5 minutes' THEN true ELSE false END as is_online
      FROM latest_messages lm
      JOIN users u ON u.supabase_id = lm.other_user_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as unread_count
        FROM chat_messages 
        WHERE sender_id = lm.other_user_id 
          AND receiver_id = $1 
          AND read_at IS NULL
      ) unread ON true
      ORDER BY lm.last_message_time DESC
    `;

    const result = await pool.query(query, [userId]);

    res.json({
      success: true,
      conversations: result.rows
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversations'
    });
  }
});

// Get messages for a specific conversation
router.get('/conversations/:conversationId/messages', authenticateToken, async (req, res) => {
  try {
    const currentUserId = getUserId(req);
    const { conversationId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // First, get the other user ID from conversation ID
    // For simplicity, we'll assume conversation ID corresponds to the other user's ID
    const otherUserId = conversationId;

    // Mark messages as read
    await pool.query(
      `UPDATE chat_messages 
       SET read_at = NOW() 
       WHERE sender_id = $1 AND receiver_id = $2 AND read_at IS NULL`,
      [otherUserId, currentUserId]
    );

    // Get messages with tip and gift details
    const query = `
      SELECT 
        cm.id,
        cm.sender_id,
        cm.receiver_id,
        cm.content,
        cm.message_type,
        cm.created_at,
        cm.read_at,
        cm.sender_id = $1 as is_mine,
        cm.tip_id,
        cm.gift_sent_id,
        cm.metadata,
        -- Tip details
        t.amount as tip_amount,
        -- Gift details
        vg.name as gift_name,
        vg.icon_url as gift_icon,
        vg.animation_url as gift_animation,
        gs.quantity as gift_quantity
      FROM chat_messages cm
      LEFT JOIN tips t ON cm.tip_id = t.tip_id
      LEFT JOIN gifts_sent gs ON cm.gift_sent_id = gs.sent_id
      LEFT JOIN virtual_gifts vg ON gs.gift_id = vg.gift_id
      WHERE (cm.sender_id = $1 AND cm.receiver_id = $2) 
         OR (cm.sender_id = $2 AND cm.receiver_id = $1)
      ORDER BY cm.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await pool.query(query, [currentUserId, otherUserId, limit, offset]);

    res.json({
      success: true,
      messages: result.rows.reverse() // Reverse to show oldest first
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages'
    });
  }
});

// Send a message to a conversation (supports text, tips, and gifts)
router.post('/conversations/:conversationId/messages', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const senderId = getUserId(req);
    const { conversationId } = req.params;
    const { content, type = 'text', tipAmount, giftId, giftQuantity = 1 } = req.body;

    // Validate input based on message type
    if (type === 'text' && !content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required for text messages'
      });
    }

    if (type === 'tip' && (!tipAmount || tipAmount <= 0)) {
      return res.status(400).json({
        success: false,
        error: 'Valid tip amount is required'
      });
    }

    if (type === 'gift' && !giftId) {
      return res.status(400).json({
        success: false,
        error: 'Gift ID is required'
      });
    }

    // For simplicity, conversation ID is the other user's ID
    const receiverId = conversationId;

    await client.query('BEGIN');

    // Get sender info
    const senderResult = await client.query(
      'SELECT id, username, display_name FROM users WHERE supabase_id = $1',
      [senderId]
    );
    
    if (senderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Sender not found'
      });
    }
    
    const senderInfo = senderResult.rows[0];

    // Get receiver info
    const receiverResult = await client.query(
      'SELECT id, username, display_name, is_creator FROM users WHERE supabase_id = $1',
      [receiverId]
    );
    
    if (receiverResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Receiver not found'
      });
    }
    
    const receiverInfo = receiverResult.rows[0];

    let messageContent = content;
    let metadata = {};
    let tipId = null;
    let giftSentId = null;

    // Handle tip message
    if (type === 'tip') {
      if (!receiverInfo.is_creator) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'Can only send tips to creators'
        });
      }

      // Generate tip ID
      tipId = `tip_${Date.now()}_${uuidv4()}`;

      // Process tip using the stored procedure from migration
      const tipResult = await client.query(
        'SELECT * FROM process_token_tip($1, $2, $3)',
        [senderInfo.id, receiverInfo.id, tipAmount]
      );

      if (!tipResult.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'Failed to process tip'
        });
      }

      // Create tip record
      await client.query(
        `INSERT INTO tips (tip_id, supabase_tipper_id, creator_id, amount, message, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [tipId, senderId, receiverInfo.id, tipAmount, content || '']
      );

      messageContent = content || `${senderInfo.display_name || senderInfo.username} sent ${tipAmount} tokens`;
      metadata = { amount: tipAmount, original_message: content };
    }

    // Handle gift message
    if (type === 'gift') {
      // Process gift using the stored procedure
      const giftResult = await client.query(
        'SELECT * FROM process_gift_send($1, $2, $3, $4, $5, NULL, NULL, false)',
        [senderInfo.id, receiverInfo.id, giftId, giftQuantity, content]
      );

      const { success, sent_id, error_message } = giftResult.rows[0];

      if (!success) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: error_message
        });
      }

      giftSentId = sent_id;

      // Get gift details
      const giftDetailsResult = await client.query(
        'SELECT name, icon_url FROM virtual_gifts WHERE gift_id = $1',
        [giftId]
      );
      const giftDetails = giftDetailsResult.rows[0];
      const giftName = giftDetails?.name || 'gift';

      messageContent = content || `${senderInfo.display_name || senderInfo.username} sent ${giftQuantity}x ${giftName}`;
      metadata = { 
        gift_name: giftName, 
        gift_icon: giftDetails?.icon_url,
        quantity: giftQuantity, 
        original_message: content 
      };
    }

    // Insert message
    const insertQuery = `
      INSERT INTO chat_messages (
        sender_id, receiver_id, content, message_type, 
        tip_id, gift_sent_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, created_at
    `;

    const result = await client.query(insertQuery, [
      senderId, 
      receiverId, 
      messageContent, 
      type,
      tipId,
      giftSentId,
      metadata ? JSON.stringify(metadata) : null
    ]);

    // Create notification for the receiver
    let notificationTitle = 'New message';
    let notificationMessage = `${senderInfo.display_name || senderInfo.username} sent you a message`;

    if (type === 'tip') {
      notificationTitle = 'You received a tip!';
      notificationMessage = `${senderInfo.display_name || senderInfo.username} sent you ${tipAmount} tokens`;
    } else if (type === 'gift') {
      notificationTitle = 'You received a gift!';
      notificationMessage = `${senderInfo.display_name || senderInfo.username} sent you a gift`;
    }

    try {
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, data, created_at, is_read)
         VALUES ($1, $2, $3, $4, $5, NOW(), false)`,
        [
          receiverInfo.id,
          type === 'text' ? 'message' : type + '_received',
          notificationTitle,
          notificationMessage,
          JSON.stringify({
            senderId: senderInfo.id,
            senderName: senderInfo.display_name || senderInfo.username,
            messageType: type,
            amount: tipAmount,
            giftId,
            giftQuantity
          })
        ]
      );
    } catch (notificationError) {
      console.error('Failed to create message notification:', notificationError);
      // Don't fail the message send if notification fails
    }

    await client.query('COMMIT');

    // Prepare response
    const response = {
      id: result.rows[0].id,
      sender_id: senderId,
      receiver_id: receiverId,
      content: messageContent,
      message_type: type,
      created_at: result.rows[0].created_at,
      is_own: true,
      metadata
    };

    if (type === 'tip') {
      response.tip_amount = tipAmount;
    }

    if (type === 'gift') {
      response.gift_name = metadata.gift_name;
      response.gift_icon = metadata.gift_icon;
      response.gift_quantity = giftQuantity;
    }

    res.json({
      success: true,
      message: response
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  } finally {
    client.release();
  }
});

// Mark conversation as read
router.post('/conversations/:conversationId/read', authenticateToken, async (req, res) => {
  try {
    const receiverId = getUserId(req);
    const { conversationId } = req.params;
    
    // For simplicity, conversation ID is the other user's ID
    const senderId = conversationId;

    const query = `
      UPDATE chat_messages 
      SET read_at = NOW() 
      WHERE sender_id = $1 AND receiver_id = $2 AND read_at IS NULL
    `;

    await pool.query(query, [senderId, receiverId]);

    res.json({
      success: true,
      message: 'Messages marked as read'
    });

  } catch (error) {
    console.error('Mark messages as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark messages as read'
    });
  }
});

// Create a new conversation (start messaging with someone)
router.post('/conversations', authenticateToken, async (req, res) => {
  try {
    const currentUserId = getUserId(req);
    const { otherUserId, initialMessage } = req.body;

    if (!otherUserId) {
      return res.status(400).json({
        success: false,
        error: 'Other user ID is required'
      });
    }

    // Check if user exists
    const userCheck = await pool.query(
      'SELECT supabase_id FROM users WHERE supabase_id = $1',
      [otherUserId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // If there's an initial message, send it
    if (initialMessage) {
      await pool.query(
        `INSERT INTO chat_messages (sender_id, receiver_id, content, message_type)
         VALUES ($1, $2, $3, 'text')`,
        [currentUserId, otherUserId, initialMessage]
      );

      // Get sender information for notification
      const senderQuery = `
        SELECT COALESCE(display_name, username, email) as sender_name 
        FROM users 
        WHERE supabase_id = $1
      `;
      const senderResult = await pool.query(senderQuery, [currentUserId]);
      const senderName = senderResult.rows[0]?.sender_name || 'Someone';

      // Create notification for the receiver
      try {
        await sendMessageNotification(otherUserId, currentUserId, senderName);
        console.log(`📨 Initial message notification sent to ${otherUserId} from ${senderName}`);
      } catch (notificationError) {
        console.error('Failed to create initial message notification:', notificationError);
        // Don't fail the conversation creation if notification fails
      }
    }

    res.json({
      success: true,
      conversation: {
        id: otherUserId, // Using other user ID as conversation ID for simplicity
        other_user_id: otherUserId,
        created_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create conversation'
    });
  }
});

// Get tip/gift statistics for chat
router.get('/stats/:userId', authenticateToken, async (req, res) => {
  try {
    const currentUserId = getUserId(req);
    const { userId } = req.params;
    const { period = '30d' } = req.query;

    // Verify access - can only see stats for conversations you're part of
    const conversationCheck = await pool.query(
      `SELECT COUNT(*) as count
       FROM chat_messages
       WHERE (sender_id = $1 AND receiver_id = $2)
          OR (sender_id = $2 AND receiver_id = $1)`,
      [currentUserId, userId]
    );

    if (conversationCheck.rows[0].count === '0') {
      return res.status(403).json({
        success: false,
        error: 'No conversation found with this user'
      });
    }

    // Build date filter
    let dateFilter = "AND cm.created_at >= NOW() - INTERVAL '30 days'";
    if (period === '7d') {
      dateFilter = "AND cm.created_at >= NOW() - INTERVAL '7 days'";
    } else if (period === '24h') {
      dateFilter = "AND cm.created_at >= NOW() - INTERVAL '24 hours'";
    } else if (period === 'all') {
      dateFilter = '';
    }

    // Get tip statistics
    const tipStats = await pool.query(
      `SELECT 
        COUNT(*) as tip_count,
        SUM(t.amount) as total_tip_amount,
        AVG(t.amount) as avg_tip_amount
       FROM chat_messages cm
       JOIN tips t ON cm.tip_id = t.tip_id
       WHERE ((cm.sender_id = $1 AND cm.receiver_id = $2)
           OR (cm.sender_id = $2 AND cm.receiver_id = $1))
         AND cm.message_type = 'tip'
         ${dateFilter}`,
      [currentUserId, userId]
    );

    // Get gift statistics
    const giftStats = await pool.query(
      `SELECT 
        COUNT(*) as gift_count,
        SUM(gs.amount) as total_gift_value,
        COUNT(DISTINCT vg.gift_id) as unique_gift_types
       FROM chat_messages cm
       JOIN gifts_sent gs ON cm.gift_sent_id = gs.sent_id
       JOIN virtual_gifts vg ON gs.gift_id = vg.gift_id
       WHERE ((cm.sender_id = $1 AND cm.receiver_id = $2)
           OR (cm.sender_id = $2 AND cm.receiver_id = $1))
         AND cm.message_type = 'gift'
         ${dateFilter}`,
      [currentUserId, userId]
    );

    res.json({
      success: true,
      stats: {
        tips: tipStats.rows[0],
        gifts: giftStats.rows[0],
        period
      }
    });

  } catch (error) {
    console.error('Get chat stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chat statistics'
    });
  }
});

module.exports = router;