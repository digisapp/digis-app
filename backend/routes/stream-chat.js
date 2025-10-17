const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const { publishToChannel } = require('../utils/ably-adapter');
// Socket.io removed - using Ably
// const { getIO } = require('../utils/socket');

// Send chat message
router.post('/message', authenticateToken, async (req, res) => {
  try {
    const { channel, message, replyTo, mentions = [] } = req.body;
    const userId = req.user.supabase_id;
    
    // Get user info
    const userResult = await db.query(
      'SELECT display_name, profile_pic_url, is_creator FROM users WHERE supabase_id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Save message to database with mentions
    const messageResult = await db.query(
      `INSERT INTO stream_messages (channel, user_id, display_name, message, reply_to, mentions, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [channel, userId, user.display_name, message, replyTo, JSON.stringify(mentions)]
    );
    
    const savedMessage = messageResult.rows[0];
    
    // Emit to all users in the channel
// TODO: Replace with Ably publish
//     const io = getIO();
    const messageData = {
      id: savedMessage.id,
      user: user.display_name,
      message: savedMessage.message,
      timestamp: savedMessage.created_at,
      userColor: user.is_creator ? '#a855f7' : '#9ca3af',
      replyTo: savedMessage.reply_to,
      userId: userId,
      mentions: mentions
    };
    
try {
  await publishToChannel(`stream:${channel}`, 'chat-message', {
    Send notifications to mentioned users
  });
} catch (ablyError) {
  logger.error('Failed to publish chat-message to Ably:', ablyError.message);
}
    if (mentions && mentions.length > 0) {
      // Get mentioned users' IDs
      const mentionedUsersResult = await db.query(
        `SELECT supabase_id, username FROM users WHERE username = ANY($1)`,
        [mentions]
      );
      
      // Send individual notifications to mentioned users
      for (const mentionedUser of mentionedUsersResult.rows) {
try {
  await publishToChannel(`user:${mentionedUser.supabase_id}`, 'mention-notification', {
    channelId: channel,
    message: message,
    mentionedBy: user.display_name,
    timestamp: savedMessage.created_at
  });
} catch (ablyError) {
  logger.error('Failed to publish mention-notification to Ably:', ablyError.message);
}
        
        // Store notification in database
        await db.query(
          `INSERT INTO notifications (user_id, type, title, message, data, created_at)
           VALUES ($1, 'mention', $2, $3, $4, NOW())`,
          [
            mentionedUser.supabase_id,
            `@${user.display_name} mentioned you`,
            `${user.display_name} mentioned you: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`,
            JSON.stringify({
              channelId: channel,
              messageId: savedMessage.id,
              mentionedBy: userId
            })
          ]
        );
      }
    }
    
    res.json({ success: true, message: savedMessage });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Pin/unpin message
router.post('/pin', authenticateToken, async (req, res) => {
  try {
    const { channel, messageId, action } = req.body;
    const userId = req.user.supabase_id;
    
    // Check if user is creator or moderator
    const authCheck = await db.query(
      `SELECT is_creator FROM users WHERE supabase_id = $1`,
      [userId]
    );
    
    if (!authCheck.rows[0]?.is_creator) {
      return res.status(403).json({ error: 'Only creators can pin messages' });
    }
    
    if (action === 'pin') {
      // Clear existing pinned message
      await db.query(
        'UPDATE stream_messages SET is_pinned = false WHERE channel = $1 AND is_pinned = true',
        [channel]
      );
      
      // Pin new message
      await db.query(
        'UPDATE stream_messages SET is_pinned = true WHERE id = $1',
        [messageId]
      );
      
      // Get pinned message details
      const pinnedResult = await db.query(
        'SELECT * FROM stream_messages WHERE id = $1',
        [messageId]
      );
      
try {
  await publishToChannel(`stream:${channel}`, 'message-pinned', {
    message: pinnedResult.rows[0]
  });
} catch (ablyError) {
  logger.error('Failed to publish message-pinned to Ably:', ablyError.message);
}
    } else {
      // Unpin message
      await db.query(
        'UPDATE stream_messages SET is_pinned = false WHERE id = $1',
        [messageId]
      );
      
try {
  await publishToChannel(`stream:${channel}`, 'message-unpinned', {
    messageId
  });
} catch (ablyError) {
  logger.error('Failed to publish message-unpinned to Ably:', ablyError.message);
}
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error pinning message:', error);
    res.status(500).json({ error: 'Failed to pin message' });
  }
});

// Ban/timeout user
router.post('/moderate', authenticateToken, async (req, res) => {
  try {
    const { channel, targetUserId, action, duration } = req.body;
    const moderatorId = req.user.supabase_id;
    
    // Check if user is creator or moderator
    const authCheck = await db.query(
      'SELECT is_creator FROM users WHERE supabase_id = $1',
      [moderatorId]
    );
    
    if (!authCheck.rows[0]?.is_creator) {
      return res.status(403).json({ error: 'Only creators can moderate' });
    }
    
    let expiresAt = null;
    if (action === 'timeout' && duration) {
      expiresAt = new Date(Date.now() + duration * 60 * 1000); // duration in minutes
    }
    
    // Save moderation action
    await db.query(
      `INSERT INTO stream_moderation (channel, user_id, action, expires_at, moderator_id, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [channel, targetUserId, action, expiresAt, moderatorId]
    );
    
    // Get target user info
    const userResult = await db.query(
      'SELECT display_name FROM users WHERE supabase_id = $1',
      [targetUserId]
    );
    
try {
  await publishToChannel(`stream:${channel}`, 'user-moderated', {
    userId: targetUserId,
    username: userResult.rows[0]?.display_name,
    action,
    duration
  });
} catch (ablyError) {
  logger.error('Failed to publish user-moderated to Ably:', ablyError.message);
}
    
    // Notify the moderated user
try {
  await publishToChannel(`user:${targetUserId}`, 'moderation-action', {
    channel,
    action,
    duration
  });
} catch (ablyError) {
  logger.error('Failed to publish moderation-action to Ably:', ablyError.message);
}
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error moderating user:', error);
    res.status(500).json({ error: 'Failed to moderate user' });
  }
});

// Delete message
router.delete('/message/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.supabase_id;
    
    // Check if user owns the message or is creator
    const messageResult = await db.query(
      'SELECT user_id, channel FROM stream_messages WHERE id = $1',
      [messageId]
    );
    
    if (messageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    const message = messageResult.rows[0];
    
    const authCheck = await db.query(
      'SELECT is_creator FROM users WHERE supabase_id = $1',
      [userId]
    );
    
    if (message.user_id !== userId && !authCheck.rows[0]?.is_creator) {
      return res.status(403).json({ error: 'Not authorized to delete this message' });
    }
    
    // Soft delete the message
    await db.query(
      'UPDATE stream_messages SET deleted = true WHERE id = $1',
      [messageId]
    );
    
try {
  await publishToChannel(`stream:${message.channel}`, 'message-deleted', {
    messageId
  });
} catch (ablyError) {
  logger.error('Failed to publish message-deleted to Ably:', ablyError.message);
}
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Get chat history
router.get('/history/:channel', authenticateToken, async (req, res) => {
  try {
    const { channel } = req.params;
    const { limit = 50, before } = req.query;
    
    let query = `
      SELECT m.*, u.profile_pic_url, u.is_creator
      FROM stream_messages m
      JOIN users u ON m.user_id = u.supabase_id
      WHERE m.channel = $1 AND m.deleted = false
    `;
    
    const params = [channel];
    
    if (before) {
      query += ' AND m.created_at < $2';
      params.push(before);
    }
    
    query += ' ORDER BY m.created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);
    
    const result = await db.query(query, params);
    
    res.json({
      success: true,
      messages: result.rows.reverse() // Return in chronological order
    });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

module.exports = router;