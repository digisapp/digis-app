const express = require('express');
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// Validation middleware for message content
const validateMessage = [
  body('recipientId').notEmpty().isString().trim(),
  body('content').notEmpty().isString().trim().isLength({ max: 5000 }),
  body('messageType').optional().isIn(['text', 'image', 'audio', 'video'])
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

// Get conversations for a user
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;

    const query = `
      SELECT DISTINCT
        CASE 
          WHEN sender_id = $1 THEN receiver_id 
          ELSE sender_id 
        END AS user_id,
        u.email as user_name,
        u.is_creator,
        u.profile_pic_url,
        COALESCE(last_msg.content, '') as last_message,
        COALESCE(last_msg.created_at, NOW()) as last_message_time,
        COALESCE(unread.unread_count, 0) as unread_count,
        CASE WHEN u.last_seen > NOW() - INTERVAL '5 minutes' THEN true ELSE false END as is_online
      FROM chat_messages cm
      JOIN users u ON (
        CASE 
          WHEN cm.sender_id = $1 THEN cm.receiver_id = u.supabase_id 
          ELSE cm.sender_id = u.supabase_id 
        END
      )
      LEFT JOIN LATERAL (
        SELECT content, created_at 
        FROM chat_messages 
        WHERE (sender_id = $1 AND receiver_id = u.supabase_id) 
           OR (sender_id = u.supabase_id AND receiver_id = $1)
        ORDER BY created_at DESC 
        LIMIT 1
      ) last_msg ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as unread_count
        FROM chat_messages 
        WHERE sender_id = u.supabase_id 
          AND receiver_id = $1 
          AND read_at IS NULL
      ) unread ON true
      WHERE cm.sender_id = $1 OR cm.receiver_id = $1
      ORDER BY last_message_time DESC
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
router.get('/conversation/:userId', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.supabase_id;
    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Mark messages as read
    await pool.query(
      `UPDATE chat_messages 
       SET read_at = NOW() 
       WHERE sender_id = $1 AND receiver_id = $2 AND read_at IS NULL`,
      [userId, currentUserId]
    );

    // Get messages
    const query = `
      SELECT 
        id,
        sender_id,
        receiver_id,
        content,
        message_type,
        created_at,
        read_at,
        CASE WHEN sender_id = $1 THEN 'sent' ELSE 'received' END as type
      FROM chat_messages
      WHERE (sender_id = $1 AND receiver_id = $2) 
         OR (sender_id = $2 AND receiver_id = $1)
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await pool.query(query, [currentUserId, userId, limit, offset]);

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

// Get creator message rates
router.get('/rates/:creatorId', authenticateToken, async (req, res) => {
  try {
    const { creatorId } = req.params;
    
    const query = `
      SELECT 
        text_message_price,
        image_message_price,
        audio_message_price,
        video_message_price,
        is_creator
      FROM users 
      WHERE supabase_id = $1
    `;
    
    const result = await pool.query(query, [creatorId]);
    
    if (result.rows.length === 0 || !result.rows[0].is_creator) {
      return res.json({
        success: true,
        rates: {
          text: 0,
          image: 0,
          audio: 0,
          video: 0
        }
      });
    }
    
    const creator = result.rows[0];
    res.json({
      success: true,
      rates: {
        text: creator.text_message_price || 1,
        image: creator.image_message_price || 2,
        audio: creator.audio_message_price || 3,
        video: creator.video_message_price || 5
      }
    });
    
  } catch (error) {
    console.error('Get message rates error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch message rates'
    });
  }
});

// Send a message
router.post('/send', authenticateToken, validateMessage, handleValidationErrors, async (req, res) => {
  try {
    const senderId = req.user.supabase_id;
    const { recipientId, content, messageType = 'text' } = req.body;

    if (!recipientId || !content) {
      return res.status(400).json({
        success: false,
        error: 'Recipient ID and content are required'
      });
    }

    // Start a transaction for token deduction and message insertion
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get recipient's rates if they're a creator
      const ratesQuery = `
        SELECT 
          is_creator,
          text_message_price,
          image_message_price,
          audio_message_price,
          video_message_price
        FROM users 
        WHERE supabase_id = $1
      `;
      
      const ratesResult = await client.query(ratesQuery, [recipientId]);
      
      let cost = 0;
      if (ratesResult.rows.length > 0 && ratesResult.rows[0].is_creator) {
        const rates = ratesResult.rows[0];
        switch(messageType) {
          case 'text':
            cost = rates.text_message_price || 1;
            break;
          case 'image':
            cost = rates.image_message_price || 2;
            break;
          case 'audio':
            cost = rates.audio_message_price || 3;
            break;
          case 'video':
            cost = rates.video_message_price || 5;
            break;
          default:
            cost = rates.text_message_price || 1;
        }
      }

      // If there's a cost, handle token deduction
      if (cost > 0) {
        // Get sender's current token balance with row lock to prevent race conditions
        const balanceQuery = 'SELECT token_balance FROM users WHERE supabase_id = $1 FOR UPDATE';
        const balanceResult = await client.query(balanceQuery, [senderId]);

        if (balanceResult.rows.length === 0) {
          throw new Error('User not found');
        }

        const currentBalance = balanceResult.rows[0].token_balance || 0;

        if (currentBalance < cost) {
          throw new Error('Insufficient token balance');
        }

        // Deduct tokens from sender
        await client.query(
          'UPDATE users SET token_balance = token_balance - $1 WHERE supabase_id = $2',
          [cost, senderId]
        );

        // Add tokens to recipient (creator earns from messages)
        await client.query(
          'UPDATE users SET token_balance = token_balance + $1 WHERE supabase_id = $2',
          [cost, recipientId]
        );

        // Record the token transaction
        await client.query(
          `INSERT INTO token_transactions (user_id, type, amount, description, related_user_id) 
           VALUES ($1, 'deduction', $2, $3, $4)`,
          [senderId, cost, `Message to user (${messageType})`, recipientId]
        );

        await client.query(
          `INSERT INTO token_transactions (user_id, type, amount, description, related_user_id) 
           VALUES ($1, 'earning', $2, $3, $4)`,
          [recipientId, cost, `Message received (${messageType})`, senderId]
        );
      }

      // Insert message
      const messageQuery = `
        INSERT INTO chat_messages (sender_id, receiver_id, content, message_type)
        VALUES ($1, $2, $3, $4)
        RETURNING id, created_at
      `;

      const messageResult = await client.query(messageQuery, [senderId, recipientId, content, messageType]);

      await client.query('COMMIT');

      res.json({
        success: true,
        message: {
          id: messageResult.rows[0].id,
          sender_id: senderId,
          receiver_id: recipientId,
          content,
          message_type: messageType,
          created_at: messageResult.rows[0].created_at,
          cost,
          type: 'sent'
        }
      });

    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Send message error:', error);
    
    let errorMessage = 'Failed to send message';
    if (error.message === 'Insufficient token balance') {
      errorMessage = 'Insufficient tokens to send this message';
    } else if (error.message === 'User not found') {
      errorMessage = 'User account not found';
    }

    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

// Mark messages as read
router.put('/mark-read/:senderId', authenticateToken, async (req, res) => {
  try {
    const receiverId = req.user.supabase_id;
    const { senderId } = req.params;

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

// Delete a conversation
router.delete('/conversation/:userId', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.supabase_id;
    const { userId } = req.params;

    const query = `
      DELETE FROM chat_messages 
      WHERE (sender_id = $1 AND receiver_id = $2) 
         OR (sender_id = $2 AND receiver_id = $1)
    `;

    await pool.query(query, [currentUserId, userId]);

    res.json({
      success: true,
      message: 'Conversation deleted'
    });

  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete conversation'
    });
  }
});

// Search messages
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { query: searchQuery, limit = 50 } = req.query;

    if (!searchQuery) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const query = `
      SELECT 
        cm.id,
        cm.sender_id,
        cm.receiver_id,
        cm.content,
        cm.message_type,
        cm.created_at,
        u.email as other_user_name,
        CASE WHEN cm.sender_id = $1 THEN 'sent' ELSE 'received' END as type
      FROM chat_messages cm
      JOIN users u ON (
        CASE 
          WHEN cm.sender_id = $1 THEN cm.receiver_id = u.supabase_id 
          ELSE cm.sender_id = u.supabase_id 
        END
      )
      WHERE (cm.sender_id = $1 OR cm.receiver_id = $1)
        AND cm.content ILIKE $2
      ORDER BY cm.created_at DESC
      LIMIT $3
    `;

    const result = await pool.query(query, [userId, `%${searchQuery}%`, limit]);

    res.json({
      success: true,
      messages: result.rows
    });

  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search messages'
    });
  }
});

module.exports = router;