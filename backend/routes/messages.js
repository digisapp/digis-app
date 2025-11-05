// routes/messages.js
// Supabase-based Messaging System API
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { supabase, getSupabaseAdmin } = require('../utils/supabase');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get or create user in database from Supabase Auth
 * This ensures users exist in the database even if they weren't created during registration
 */
async function getOrCreateUser(supabaseId, email) {
  // Try to get existing user
  let { data: userData, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('supabase_id', supabaseId)
    .single();

  // If user exists, return their ID
  if (userData && !userError) {
    return userData.id;
  }

  // User doesn't exist - create them
  console.log('📝 Creating user record for supabase_id:', supabaseId);

  // Generate unique username to avoid conflicts
  const baseUsername = email?.split('@')[0] || `user`;
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const username = `${baseUsername}_${randomSuffix}`;

  try {
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        supabase_id: supabaseId,
        email: email,
        username: username,
        display_name: email?.split('@')[0] || 'User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (createError) {
      // Check if it's a race condition (user was created by another request)
      if (createError.code === '23505') { // Unique constraint violation
        console.log('⚠️ User already exists (race condition), fetching existing user...');
        const { data: existingUser, error: fetchError } = await supabase
          .from('users')
          .select('id')
          .eq('supabase_id', supabaseId)
          .single();

        if (existingUser && !fetchError) {
          console.log('✅ Found existing user with ID:', existingUser.id);
          return existingUser.id;
        }
      }

      console.error('❌ Failed to create user:', createError);
      throw createError; // Throw original error for better debugging
    }

    console.log('✅ User created with ID:', newUser.id);
    return newUser.id;
  } catch (error) {
    console.error('❌ Exception in getOrCreateUser:', error);
    // Return a more helpful error message
    throw new Error(`Failed to get or create user: ${error.message}`);
  }
}

// ============================================================================
// CONVERSATIONS
// ============================================================================

/**
 * GET /api/v1/messages/conversations
 * Get all conversations for the authenticated user
 */
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const supabaseId = req.user.supabase_id;
    const email = req.user.email;

    // Get or create user in database
    const userId = await getOrCreateUser(supabaseId, email);

    const { data: conversations, error } = await supabase
      .from('conversations')
      .select(`
        *,
        user1:user1_id(id, username, display_name, profile_pic_url),
        user2:user2_id(id, username, display_name, profile_pic_url),
        last_message:last_message_id(id, content, media_url, message_type, created_at, sender_id)
      `)
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order('last_message_at', { ascending: false });

    if (error) throw error;

    // Format conversations to show the "other" user
    const formattedConversations = conversations.map(conv => {
      const otherUser = conv.user1_id === userId ? conv.user2 : conv.user1;
      return {
        id: conv.id,
        otherUser,
        lastMessage: conv.last_message,
        lastMessageAt: conv.last_message_at,
        updatedAt: conv.updated_at
      };
    });

    res.json({ success: true, conversations: formattedConversations });
  } catch (error) {
    console.error('❌ Error fetching conversations:', error);
    // Provide more specific error message for debugging
    const errorMessage = error.message || 'Failed to fetch conversations';
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversations',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
});

/**
 * POST /api/v1/messages/conversations
 * Get or create a conversation with another user
 */
router.post('/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { otherUserId } = req.body;

    if (!otherUserId) {
      return res.status(400).json({ success: false, error: 'otherUserId is required' });
    }

    if (otherUserId === userId) {
      return res.status(400).json({ success: false, error: 'Cannot create conversation with yourself' });
    }

    // Call the database function to get or create conversation
    const { data, error } = await supabase.rpc('get_or_create_conversation', {
      p_user1_id: userId,
      p_user2_id: otherUserId
    });

    if (error) throw error;

    // Fetch the full conversation details
    const { data: conversation, error: fetchError } = await supabase
      .from('conversations')
      .select(`
        *,
        user1:user1_id(id, username, display_name, profile_pic_url),
        user2:user2_id(id, username, display_name, profile_pic_url)
      `)
      .eq('id', data)
      .single();

    if (fetchError) throw fetchError;

    res.json({ success: true, conversation });
  } catch (error) {
    console.error('❌ Error creating conversation:', error);
    res.status(500).json({ success: false, error: 'Failed to create conversation' });
  }
});

// ============================================================================
// MESSAGES
// ============================================================================

/**
 * GET /api/v1/messages/conversation/:conversationId
 * Get messages for a specific conversation
 */
router.get('/conversation/:conversationId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { conversationId } = req.params;
    const { limit = 50, before } = req.query;

    // Verify user has access to this conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('user1_id, user2_id')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    if (conversation.user1_id !== userId && conversation.user2_id !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Build query
    let query = supabase
      .from('messages')
      .select(`
        *,
        sender:sender_id(id, username, display_name, profile_pic_url),
        reactions:message_reactions(id, user_id, reaction)
      `)
      .eq('conversation_id', conversationId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    // Pagination: get messages before a specific timestamp
    if (before) {
      query = query.lt('created_at', before);
    }

    const { data: messages, error } = await query;

    if (error) throw error;

    // Mark messages as read
    await supabase.rpc('mark_messages_as_read', {
      p_conversation_id: conversationId,
      p_user_id: userId
    });

    res.json({ success: true, messages: messages.reverse() });
  } catch (error) {
    console.error('❌ Error fetching messages:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
});

/**
 * POST /api/v1/messages/send
 * Send a new message
 */
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const {
      recipientId,
      content,
      mediaUrl,
      mediaType,
      messageType = 'text',
      metadata = {},
      isPremium = false,
      unlockPrice = 0
    } = req.body;

    if (!recipientId) {
      return res.status(400).json({ success: false, error: 'recipientId is required' });
    }

    if (!content && !mediaUrl) {
      return res.status(400).json({ success: false, error: 'Either content or mediaUrl is required' });
    }

    // Get or create conversation
    const { data: conversationId, error: convError } = await supabase.rpc('get_or_create_conversation', {
      p_user1_id: userId,
      p_user2_id: recipientId
    });

    if (convError) throw convError;

    // Calculate token cost based on message type and creator settings
    let tokensSpent = 0;
    if (isPremium) {
      // Fetch creator's message rate from users table
      const { data: recipientData } = await supabase
        .from('users')
        .select('message_price')
        .eq('supabase_id', recipientId)
        .single();

      tokensSpent = recipientData?.message_price || 5; // Default to 5 tokens

      // Check if user has enough tokens
      const { data: userData } = await supabase
        .from('users')
        .select('token_balance')
        .eq('supabase_id', userId)
        .single();

      if (!userData || userData.token_balance < tokensSpent) {
        return res.status(402).json({
          success: false,
          error: 'Insufficient tokens',
          required: tokensSpent,
          balance: userData?.token_balance || 0
        });
      }

      // Deduct tokens from sender
      await supabase
        .from('users')
        .update({ token_balance: userData.token_balance - tokensSpent })
        .eq('supabase_id', userId);

      // Add tokens to recipient (creator)
      const { data: creatorData } = await supabase
        .from('users')
        .select('token_balance')
        .eq('supabase_id', recipientId)
        .single();

      await supabase
        .from('users')
        .update({ token_balance: (creatorData?.token_balance || 0) + tokensSpent })
        .eq('supabase_id', recipientId);

      // Record transaction
      await supabase.from('token_transactions').insert([
        {
          user_id: userId,
          type: 'deduction',
          amount: tokensSpent,
          description: `Message to user (${messageType})`,
          related_user_id: recipientId
        },
        {
          user_id: recipientId,
          type: 'earning',
          amount: tokensSpent,
          description: `Message received (${messageType})`,
          related_user_id: userId
        }
      ]);
    }

    // Create message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        recipient_id: recipientId,
        content,
        media_url: mediaUrl,
        media_type: mediaType,
        message_type: messageType,
        metadata,
        tokens_spent: tokensSpent,
        is_premium: isPremium,
        unlock_price: unlockPrice
      })
      .select(`
        *,
        sender:sender_id(id, username, display_name, profile_pic_url)
      `)
      .single();

    if (messageError) throw messageError;

    res.json({ success: true, message });
  } catch (error) {
    console.error('❌ Error sending message:', error);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

/**
 * PATCH /api/v1/messages/:messageId
 * Update a message (mark as read, delete, etc.)
 */
router.patch('/:messageId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { messageId } = req.params;
    const { isRead, isDeleted } = req.body;

    // Verify user owns this message or is recipient
    const { data: message, error: fetchError } = await supabase
      .from('messages')
      .select('sender_id, recipient_id')
      .eq('id', messageId)
      .single();

    if (fetchError || !message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    if (message.sender_id !== userId && message.recipient_id !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Build update object
    const updates = {};
    if (typeof isRead === 'boolean' && message.recipient_id === userId) {
      updates.is_read = isRead;
      if (isRead) updates.read_at = new Date().toISOString();
    }
    if (typeof isDeleted === 'boolean' && message.sender_id === userId) {
      updates.is_deleted = isDeleted;
      if (isDeleted) updates.deleted_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('messages')
      .update(updates)
      .eq('id', messageId)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, message: data });
  } catch (error) {
    console.error('❌ Error updating message:', error);
    res.status(500).json({ success: false, error: 'Failed to update message' });
  }
});

// ============================================================================
// TYPING INDICATORS
// ============================================================================

/**
 * POST /api/v1/messages/:conversationId/typing
 * Update typing status for a conversation
 */
router.post('/:conversationId/typing', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { conversationId } = req.params;
    const { isTyping } = req.body;

    if (isTyping) {
      // Upsert typing indicator
      const { error } = await supabase
        .from('typing_indicators')
        .upsert({
          conversation_id: conversationId,
          user_id: userId,
          started_at: new Date().toISOString()
        }, {
          onConflict: 'conversation_id,user_id'
        });

      if (error) throw error;
    } else {
      // Remove typing indicator
      await supabase
        .from('typing_indicators')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error updating typing status:', error);
    res.status(500).json({ success: false, error: 'Failed to update typing status' });
  }
});

// ============================================================================
// MESSAGE REACTIONS
// ============================================================================

/**
 * POST /api/v1/messages/:messageId/react
 * Add a reaction to a message
 */
router.post('/:messageId/react', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { messageId } = req.params;
    const { reaction } = req.body;

    if (!reaction) {
      return res.status(400).json({ success: false, error: 'Reaction is required' });
    }

    // Add reaction (will fail if duplicate due to unique constraint)
    const { data, error } = await supabase
      .from('message_reactions')
      .insert({
        message_id: messageId,
        user_id: userId,
        reaction
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // Already reacted, toggle it off
        await supabase
          .from('message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', userId)
          .eq('reaction', reaction);

        return res.json({ success: true, removed: true });
      }
      throw error;
    }

    res.json({ success: true, reaction: data });
  } catch (error) {
    console.error('❌ Error adding reaction:', error);
    res.status(500).json({ success: false, error: 'Failed to add reaction' });
  }
});

// ============================================================================
// UNREAD COUNT
// ============================================================================

/**
 * GET /api/v1/messages/unread/count
 * Get total unread message count for user
 */
router.get('/unread/count', authenticateToken, async (req, res) => {
  try {
    const supabaseId = req.user.supabase_id;
    const email = req.user.email;

    // Get or create user in database
    const userId = await getOrCreateUser(supabaseId, email);

    const { data, error } = await supabase.rpc('get_unread_count', {
      p_user_id: userId
    });

    if (error) throw error;

    res.json({ success: true, count: data });
  } catch (error) {
    console.error('❌ Error fetching unread count:', error);
    // Provide more specific error message for debugging
    const errorMessage = error.message || 'Failed to fetch unread count';
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unread count',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
});

// ============================================================================
// MESSAGE RATES
// ============================================================================

/**
 * GET /api/v1/messages/rates/:creatorId
 * Get message rates for a creator
 */
router.get('/rates/:creatorId', authenticateToken, async (req, res) => {
  try {
    const { creatorId } = req.params;

    const { data: creator, error } = await supabase
      .from('users')
      .select('message_price, is_creator')
      .eq('supabase_id', creatorId)
      .single();

    if (error) throw error;

    if (!creator || !creator.is_creator) {
      return res.json({
        success: true,
        rates: { text: 0, image: 0, audio: 0, video: 0 }
      });
    }

    res.json({
      success: true,
      rates: {
        text: creator.message_price || 5,
        image: creator.message_price || 5,
        audio: creator.message_price || 5,
        video: creator.message_price || 5
      }
    });
  } catch (error) {
    console.error('❌ Error fetching message rates:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch message rates' });
  }
});

// ============================================================================
// MEDIA UPLOAD
// ============================================================================

/**
 * POST /api/v1/messages/upload
 * Upload media for messages (images, videos, files)
 */
router.post('/upload', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { file, fileType, fileName } = req.body;

    if (!file) {
      return res.status(400).json({ success: false, error: 'File is required' });
    }

    // Upload to Supabase Storage
    const fileExt = fileName.split('.').pop();
    const filePath = `messages/${userId}/${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('message-media')
      .upload(filePath, file, {
        contentType: fileType,
        upsert: false
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('message-media')
      .getPublicUrl(filePath);

    res.json({
      success: true,
      url: urlData.publicUrl,
      path: filePath
    });
  } catch (error) {
    console.error('❌ Error uploading media:', error);
    res.status(500).json({ success: false, error: 'Failed to upload media' });
  }
});

module.exports = router;
