// routes/stream-chat.js
// Live Stream Chat API using Supabase (replaces Agora RTM + Ably)
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { supabase } = require('../utils/supabase');

/**
 * GET /api/v1/stream-chat/history/:streamId
 * Get chat messages for a stream
 */
router.get('/history/:streamId', authenticateToken, async (req, res) => {
  try {
    const { streamId } = req.params;
    const { limit = 50, before } = req.query;

    console.log('📥 Stream chat history request:', {
      streamId,
      limit,
      before,
      userId: req.user?.supabase_id || req.user?.id
    });

    // Check if Supabase client is initialized
    if (!supabase) {
      console.error('❌ Supabase client not initialized');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
        message: 'Database client not available'
      });
    }

    let query = supabase
      .from('stream_chat_messages')
      .select(`
        *,
        user:user_id(id, username, display_name, profile_pic_url, is_creator)
      `)
      .eq('stream_id', streamId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error('❌ Supabase query error:', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }

    console.log(`✅ Fetched ${messages?.length || 0} messages for stream ${streamId}`);

    res.json({
      success: true,
      messages: messages.reverse() // Return oldest first (chronological)
    });
  } catch (error) {
    console.error('❌ Error fetching stream chat:', {
      message: error.message,
      stack: error.stack,
      streamId: req.params.streamId
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/v1/stream-chat/message
 * Send a chat message to a stream
 */
router.post('/message', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { channel, message, replyTo, mentions = [] } = req.body;

    if (!channel || !message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Channel and message are required' });
    }

    // Check if user is banned or muted
    const { data: isBanned } = await supabase.rpc('is_user_moderated', {
      p_stream_id: channel,
      p_user_id: userId,
      p_action: 'ban'
    });

    if (isBanned) {
      return res.status(403).json({
        success: false,
        error: 'You are banned from this stream chat'
      });
    }

    const { data: isMuted } = await supabase.rpc('is_user_moderated', {
      p_stream_id: channel,
      p_user_id: userId,
      p_action: 'mute'
    });

    if (isMuted) {
      return res.status(403).json({
        success: false,
        error: 'You are muted in this stream chat'
      });
    }

    // Get user info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('username, display_name, profile_pic_url, is_creator')
      .eq('supabase_id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Determine user role
    let userRole = 'viewer';
    // TODO: Check if user is the stream host or moderator
    // For now, just check if creator
    if (user.is_creator) {
      userRole = 'host'; // You can make this more sophisticated
    }

    // Insert message
    const { data: newMessage, error } = await supabase
      .from('stream_chat_messages')
      .insert({
        stream_id: channel,
        user_id: userId,
        message: message.trim(),
        user_role: userRole
      })
      .select(`
        *,
        user:user_id(id, username, display_name, profile_pic_url, is_creator)
      `)
      .single();

    if (error) throw error;

    // Format response for compatibility with old LiveChat component
    const formattedMessage = {
      id: newMessage.id,
      user: user.display_name || user.username,
      message: newMessage.message,
      timestamp: newMessage.created_at,
      userColor: user.is_creator ? '#a855f7' : '#9ca3af',
      userId: userId,
      user_role: userRole
    };

    res.json({
      success: true,
      message: formattedMessage
    });
  } catch (error) {
    console.error('❌ Error sending stream chat message:', error);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

/**
 * DELETE /api/v1/stream-chat/message/:messageId
 * Delete a message (user or moderators/host)
 */
router.delete('/message/:messageId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { messageId } = req.params;

    // Get message and check permissions
    const { data: message, error: fetchError } = await supabase
      .from('stream_chat_messages')
      .select('user_id, stream_id')
      .eq('id', messageId)
      .single();

    if (fetchError || !message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    // Check if user is the sender or a creator (moderator)
    const { data: user } = await supabase
      .from('users')
      .select('is_creator')
      .eq('supabase_id', userId)
      .single();

    if (message.user_id !== userId && !user?.is_creator) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Soft delete
    const { error } = await supabase
      .from('stream_chat_messages')
      .update({
        is_deleted: true,
        deleted_by: userId,
        deleted_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting stream chat message:', error);
    res.status(500).json({ success: false, error: 'Failed to delete message' });
  }
});

/**
 * POST /api/v1/stream-chat/moderate
 * Ban/mute/timeout a user (host/moderator only)
 */
router.post('/moderate', authenticateToken, async (req, res) => {
  try {
    const moderatorId = req.user.supabase_id;
    const { channel, targetUserId, action, duration, reason } = req.body;

    if (!channel || !targetUserId || !action) {
      return res.status(400).json({
        success: false,
        error: 'channel, targetUserId, and action are required'
      });
    }

    if (!['ban', 'mute', 'timeout'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    // Check if user is a creator (has moderation rights)
    const { data: moderator } = await supabase
      .from('users')
      .select('is_creator')
      .eq('supabase_id', moderatorId)
      .single();

    if (!moderator?.is_creator) {
      return res.status(403).json({
        success: false,
        error: 'Only creators can moderate chat'
      });
    }

    // Calculate expiration for timeout
    const expiresAt = (action === 'timeout' && duration)
      ? new Date(Date.now() + duration * 60 * 1000).toISOString()
      : null;

    // Insert moderation action
    const { error } = await supabase
      .from('stream_chat_moderation')
      .upsert({
        stream_id: channel,
        user_id: targetUserId,
        action,
        duration_minutes: duration,
        reason,
        moderator_id: moderatorId,
        expires_at: expiresAt
      }, {
        onConflict: 'stream_id,user_id,action'
      });

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error moderating user:', error);
    res.status(500).json({ success: false, error: 'Failed to moderate user' });
  }
});

/**
 * POST /api/v1/stream-chat/pin
 * Pin/unpin a message (host only)
 */
router.post('/pin', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { channel, messageId, action } = req.body;

    // Check if user is creator
    const { data: user } = await supabase
      .from('users')
      .select('is_creator')
      .eq('supabase_id', userId)
      .single();

    if (!user?.is_creator) {
      return res.status(403).json({
        success: false,
        error: 'Only creators can pin messages'
      });
    }

    // TODO: Add is_pinned column to stream_chat_messages if needed
    // For now, return success
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error pinning message:', error);
    res.status(500).json({ success: false, error: 'Failed to pin message' });
  }
});

module.exports = router;
