const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');

// Get all conversations for a user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    
    // Get all conversations with last message
    const conversationsResult = await db.query(`
      SELECT 
        c.id,
        c.participant1_id,
        c.participant2_id,
        c.last_message_id,
        c.last_message_time,
        c.unread_count_p1,
        c.unread_count_p2,
        c.is_pinned_p1,
        c.is_pinned_p2,
        c.is_archived_p1,
        c.is_archived_p2,
        c.is_request,
        CASE 
          WHEN c.participant1_id = $1 THEN u2.supabase_id
          ELSE u1.supabase_id
        END as participant_id,
        CASE 
          WHEN c.participant1_id = $1 THEN u2.username
          ELSE u1.username
        END as participant_username,
        CASE 
          WHEN c.participant1_id = $1 THEN u2.display_name
          ELSE u1.display_name
        END as participant_name,
        CASE 
          WHEN c.participant1_id = $1 THEN u2.profile_pic_url
          ELSE u1.profile_pic_url
        END as participant_avatar,
        CASE 
          WHEN c.participant1_id = $1 THEN u2.is_online
          ELSE u1.is_online
        END as participant_online,
        CASE 
          WHEN c.participant1_id = $1 THEN u2.last_active
          ELSE u1.last_active
        END as participant_last_seen,
        CASE 
          WHEN c.participant1_id = $1 THEN u2.is_creator
          ELSE u1.is_creator
        END as participant_is_creator,
        m.content as last_message_content,
        m.sender_id as last_message_sender,
        m.created_at as last_message_time,
        CASE 
          WHEN c.participant1_id = $1 THEN c.unread_count_p1
          ELSE c.unread_count_p2
        END as unread_count,
        CASE 
          WHEN c.participant1_id = $1 THEN c.is_pinned_p1
          ELSE c.is_pinned_p2
        END as is_pinned,
        CASE 
          WHEN c.participant1_id = $1 THEN c.is_archived_p1
          ELSE c.is_archived_p2
        END as is_archived
      FROM conversations c
      LEFT JOIN users u1 ON c.participant1_id = u1.supabase_id
      LEFT JOIN users u2 ON c.participant2_id = u2.supabase_id
      LEFT JOIN messages m ON c.last_message_id = m.id
      WHERE c.participant1_id = $1 OR c.participant2_id = $1
      ORDER BY 
        is_pinned DESC,
        c.last_message_time DESC NULLS LAST
    `, [userId]);
    
    // Check if user is a creator to get VIP information
    const userResult = await db.query(
      'SELECT is_creator FROM users WHERE supabase_id = $1',
      [userId]
    );
    const isCreator = userResult.rows[0]?.is_creator || false;
    
    // Get VIP fans if user is a creator
    let vipFans = [];
    if (isCreator) {
      const vipResult = await db.query(`
        SELECT DISTINCT fan_id
        FROM vip_fans
        WHERE creator_id = $1
      `, [userId]);
      vipFans = vipResult.rows.map(r => r.fan_id);
    }
    
    // Get spending stats for each conversation partner
    const spendingStatsResult = await db.query(`
      SELECT 
        s.fan_supabase_id as fan_id,
        COALESCE(SUM(p.amount), 0) as total_spent,
        COUNT(DISTINCT s.id) as session_count
      FROM sessions s
      LEFT JOIN payments p ON s.id = p.session_id
      WHERE s.creator_supabase_id = $1
        AND p.status = 'completed'
      GROUP BY s.fan_supabase_id
    `, [userId]);
    
    const spendingMap = {};
    spendingStatsResult.rows.forEach(row => {
      spendingMap[row.fan_id] = {
        totalSpent: parseFloat(row.total_spent),
        sessionCount: parseInt(row.session_count)
      };
    });
    
    // Format conversations
    const conversations = conversationsResult.rows.map(conv => ({
      id: conv.id,
      participant: {
        id: conv.participant_id,
        name: conv.participant_name || conv.participant_username || 'Unknown User',
        username: conv.participant_username,
        avatar: conv.participant_avatar,
        isOnline: conv.participant_online || false,
        isVIP: vipFans.includes(conv.participant_id),
        lastSeen: conv.participant_last_seen,
        isCreator: conv.participant_is_creator
      },
      lastMessage: {
        content: conv.last_message_content || 'Start a conversation',
        timestamp: conv.last_message_time || new Date(),
        isRead: conv.unread_count === 0,
        sender: conv.last_message_sender
      },
      unreadCount: parseInt(conv.unread_count || 0),
      isPinned: conv.is_pinned || false,
      isArchived: conv.is_archived || false,
      isRequest: conv.is_request || false,
      totalSpent: spendingMap[conv.participant_id]?.totalSpent || 0,
      sessionCount: spendingMap[conv.participant_id]?.sessionCount || 0
    }));
    
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get messages for a conversation
router.get('/:conversationId/messages', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { conversationId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    // Verify user is part of this conversation
    const convResult = await db.query(
      'SELECT * FROM conversations WHERE id = $1 AND (participant1_id = $2 OR participant2_id = $2)',
      [conversationId, userId]
    );
    
    if (convResult.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get messages
    const messagesResult = await db.query(`
      SELECT 
        m.id,
        m.content,
        m.sender_id,
        m.created_at as timestamp,
        m.is_read,
        m.metadata
      FROM messages m
      WHERE m.conversation_id = $1
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3
    `, [conversationId, limit, offset]);
    
    // Mark messages as read
    await db.query(`
      UPDATE messages 
      SET is_read = true 
      WHERE conversation_id = $1 
        AND sender_id != $2 
        AND is_read = false
    `, [conversationId, userId]);
    
    // Update unread count in conversation
    const isParticipant1 = convResult.rows[0].participant1_id === userId;
    if (isParticipant1) {
      await db.query(
        'UPDATE conversations SET unread_count_p1 = 0 WHERE id = $1',
        [conversationId]
      );
    } else {
      await db.query(
        'UPDATE conversations SET unread_count_p2 = 0 WHERE id = $1',
        [conversationId]
      );
    }
    
    res.json(messagesResult.rows.reverse()); // Reverse to show oldest first
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send a message
router.post('/:conversationId/messages', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { conversationId } = req.params;
    const { content, metadata } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    // Verify user is part of this conversation
    const convResult = await db.query(
      'SELECT * FROM conversations WHERE id = $1 AND (participant1_id = $2 OR participant2_id = $2)',
      [conversationId, userId]
    );
    
    if (convResult.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Insert message
    const messageResult = await db.query(`
      INSERT INTO messages (conversation_id, sender_id, content, metadata, is_read)
      VALUES ($1, $2, $3, $4, false)
      RETURNING *
    `, [conversationId, userId, content, metadata || {}]);
    
    const message = messageResult.rows[0];
    
    // Update conversation
    const isParticipant1 = convResult.rows[0].participant1_id === userId;
    const otherParticipantField = isParticipant1 ? 'unread_count_p2' : 'unread_count_p1';
    
    await db.query(`
      UPDATE conversations 
      SET 
        last_message_id = $1,
        last_message_time = $2,
        ${otherParticipantField} = ${otherParticipantField} + 1
      WHERE id = $3
    `, [message.id, message.created_at, conversationId]);
    
    res.json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Toggle pin status
router.put('/:conversationId/pin', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { conversationId } = req.params;
    
    // Verify user is part of this conversation
    const convResult = await db.query(
      'SELECT * FROM conversations WHERE id = $1 AND (participant1_id = $2 OR participant2_id = $2)',
      [conversationId, userId]
    );
    
    if (convResult.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const isParticipant1 = convResult.rows[0].participant1_id === userId;
    const pinField = isParticipant1 ? 'is_pinned_p1' : 'is_pinned_p2';
    const currentPinStatus = isParticipant1 ? convResult.rows[0].is_pinned_p1 : convResult.rows[0].is_pinned_p2;
    
    await db.query(
      `UPDATE conversations SET ${pinField} = $1 WHERE id = $2`,
      [!currentPinStatus, conversationId]
    );
    
    res.json({ isPinned: !currentPinStatus });
  } catch (error) {
    console.error('Error toggling pin status:', error);
    res.status(500).json({ error: 'Failed to toggle pin status' });
  }
});

// Toggle archive status
router.put('/:conversationId/archive', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { conversationId } = req.params;
    
    // Verify user is part of this conversation
    const convResult = await db.query(
      'SELECT * FROM conversations WHERE id = $1 AND (participant1_id = $2 OR participant2_id = $2)',
      [conversationId, userId]
    );
    
    if (convResult.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const isParticipant1 = convResult.rows[0].participant1_id === userId;
    const archiveField = isParticipant1 ? 'is_archived_p1' : 'is_archived_p2';
    const currentArchiveStatus = isParticipant1 ? convResult.rows[0].is_archived_p1 : convResult.rows[0].is_archived_p2;
    
    await db.query(
      `UPDATE conversations SET ${archiveField} = $1 WHERE id = $2`,
      [!currentArchiveStatus, conversationId]
    );
    
    res.json({ isArchived: !currentArchiveStatus });
  } catch (error) {
    console.error('Error toggling archive status:', error);
    res.status(500).json({ error: 'Failed to toggle archive status' });
  }
});

// Toggle VIP status (creators only)
router.put('/:participantId/vip', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;
    const { participantId } = req.params;
    
    // Verify user is a creator
    const userResult = await db.query(
      'SELECT is_creator FROM users WHERE supabase_id = $1',
      [creatorId]
    );
    
    if (!userResult.rows[0]?.is_creator) {
      return res.status(403).json({ error: 'Creator access required' });
    }
    
    // Check if VIP relationship exists
    const vipResult = await db.query(
      'SELECT * FROM vip_fans WHERE creator_id = $1 AND fan_id = $2',
      [creatorId, participantId]
    );
    
    if (vipResult.rows.length > 0) {
      // Remove VIP status
      await db.query(
        'DELETE FROM vip_fans WHERE creator_id = $1 AND fan_id = $2',
        [creatorId, participantId]
      );
      res.json({ isVIP: false });
    } else {
      // Add VIP status
      await db.query(
        'INSERT INTO vip_fans (creator_id, fan_id) VALUES ($1, $2)',
        [creatorId, participantId]
      );
      res.json({ isVIP: true });
    }
  } catch (error) {
    console.error('Error toggling VIP status:', error);
    res.status(500).json({ error: 'Failed to toggle VIP status' });
  }
});

module.exports = router;