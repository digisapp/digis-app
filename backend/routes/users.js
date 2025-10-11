const express = require('express');
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const { supabaseAdmin } = require('../utils/supabase-admin-v2');
const multer = require('multer');
const { validateUsername, checkUsernameAvailability } = require('../utils/usernameValidation');
const { profileUpdateSchema, validate } = require('../validators/schemas');
const { logger } = require('../utils/secureLogger');
const { sendNotification } = require('../utils/socket');
const { sendFollowNotificationWithPush } = require('./notifications');
const { uploadImage: uploadToSupabase } = require('../utils/supabase-storage');
const { users: usersCache, creators: creatorsCache, TTL } = require('../utils/redis');
const router = express.Router();

// Configure multer for file uploads
// Use memory storage for serverless compatibility (uploads go to Supabase storage)
const upload = multer({
  storage: multer.memoryStorage(), // Store in memory instead of filesystem
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept video and audio files
    if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video and audio files are allowed'), false);
    }
  }
});

// Configure multer for image uploads
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG and GIF are allowed.'));
    }
  }
});

const TOKEN_REDEMPTION_VALUE = 0.05; // $0.05 per token

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Users route working',
    database: 'Supabase PostgreSQL',
    timestamp: new Date().toISOString()
  });
});

// Search users by username prefix for mentions
router.get('/search-by-username', authenticateToken, async (req, res) => {
  const { q, limit = 5, channel } = req.query;
  
  if (!q || q.trim().length < 1) {
    return res.status(400).json({
      error: 'Search query must be at least 1 character',
      timestamp: new Date().toISOString()
    });
  }

  logger.info('🔍 Username search for mentions:', { 
    query: q, 
    limit, 
    channel,
    timestamp: new Date().toISOString()
  });

  try {
    const searchTerm = `${q.trim().toLowerCase()}%`;
    
    // If channel is provided, prioritize users who are active in that channel
    let query;
    let params;
    
    if (channel) {
      // Get users who have recently chatted in this channel or are creators/mods
      query = `
        SELECT DISTINCT
          u.id,
          u.id as supabase_id,
          u.username,
          u.display_name,
          u.profile_pic_url,
          u.is_creator,
          u.is_online,
          CASE 
            WHEN u.is_creator THEN 1
            WHEN sc.user_id IS NOT NULL THEN 2
            ELSE 3
          END as priority
        FROM users u
        LEFT JOIN stream_chat sc ON u.id::text = sc.user_id 
          AND sc.channel_id = $3 
          AND sc.created_at > NOW() - INTERVAL '7 days'
        WHERE LOWER(u.username) LIKE $1
        ORDER BY priority, u.username
        LIMIT $2
      `;
      params = [searchTerm, limit, channel];
    } else {
      // General username search
      query = `
        SELECT 
          id,
          id as supabase_id,
          username,
          display_name,
          profile_pic_url,
          is_creator,
          is_online
        FROM users
        WHERE LOWER(username) LIKE $1
        ORDER BY 
          CASE WHEN is_creator THEN 0 ELSE 1 END,
          username
        LIMIT $2
      `;
      params = [searchTerm, limit];
    }
    
    const result = await pool.query(query, params);
    
    const users = result.rows.map(user => ({
      id: user.supabase_id || user.id,
      username: user.username,
      display_name: user.display_name || user.username,
      profile_pic_url: user.profile_pic_url,
      is_creator: user.is_creator || false,
      is_online: user.is_online || false,
      // Add role indicators for UI
      is_moderator: false, // Can be extended with moderator table check
      is_vip: false, // Can be extended with VIP status check
      is_subscriber: false // Can be extended with subscription check
    }));

    logger.info('✅ Username search completed:', users.length, 'results');
    res.json({
      users: users,
      query: q,
      total: users.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Username search error:', error);
    res.status(500).json({
      error: 'Failed to search users',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Check username availability (public endpoint)
router.get('/check-username/:username', async (req, res) => {
  const { username } = req.params;
  
  try {
    // Validate username format
    const validation = validateUsername(username);
    if (!validation.valid) {
      return res.json({
        available: false,
        reason: validation.errors[0],
        errors: validation.errors
      });
    }
    
    // Check availability in database
    const availability = await checkUsernameAvailability(username, pool);
    
    res.json({
      available: availability.available,
      username: username,
      normalizedUsername: validation.normalizedUsername,
      reason: availability.available ? null : 'Username is already taken'
    });
  } catch (error) {
    logger.error('Error checking username availability:', error);
    res.status(500).json({
      error: 'Failed to check username availability',
      timestamp: new Date().toISOString()
    });
  }
});

// Update creator status
router.post('/update-creator-status', authenticateToken, async (req, res) => {
  const { is_creator } = req.body;
  const userId = req.user.supabase_id;
  
  logger.info('🔄 Updating creator status:', { 
    userId, 
    is_creator,
    timestamp: new Date().toISOString()
  });
  
  try {
    // First check if user exists
    const checkUser = await pool.query(
      'SELECT * FROM users WHERE id = $1::uuid',
      [userId]
    );
    
    if (checkUser.rows.length === 0) {
      // Create user record if it doesn't exist
      logger.info('Creating user record for:', userId);
      const createResult = await pool.query(
        `INSERT INTO users (supabase_id, email, is_creator, created_at, updated_at) 
         VALUES ($1, $2, $3, NOW(), NOW()) 
         RETURNING *`,
        [userId, req.user.email, is_creator]
      );
      
      return res.json({
        success: true,
        is_creator: createResult.rows[0].is_creator,
        message: `Account created and set to ${is_creator ? 'Creator' : 'Fan'}`,
        timestamp: new Date().toISOString()
      });
    }
    
    // Update existing user
    const result = await pool.query(
      'UPDATE users SET is_creator = $1, updated_at = NOW() WHERE supabase_id = $2 RETURNING *',
      [is_creator, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }
    
    const updatedUser = result.rows[0];
    
    logger.info('✅ Creator status updated successfully:', {
      userId,
      is_creator: updatedUser.is_creator,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      is_creator: updatedUser.is_creator,
      message: `Account type changed to ${updatedUser.is_creator ? 'Creator' : 'Fan'}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Error updating creator status:', error);
    res.status(500).json({
      error: 'Failed to update creator status',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

// Create/update profile
router.put('/profile', authenticateToken, validate(profileUpdateSchema), async (req, res) => {
  const { 
    bio, 
    display_name: displayName,
    profile_pic_url: profilePic,
    banner_url: bannerUrl,
    stream_price: streamPrice, 
    video_price: videoPrice, 
    voice_price: voicePrice, 
    message_price: messagePrice, 
    text_message_price: textMessagePrice,
    image_message_price: imageMessagePrice,
    video_message_price: videoMessagePrice,
    voice_memo_price: voiceMemoPrice,
    username, 
    creator_type: creatorType,
    interests,
    show_token_balance: showTokenBalance,
    gallery_photos: galleryPhotos,
    stream_audience_control: streamAudienceControl,
    is_creator: isCreator,
    state,
    country,
    notification_preferences: notificationPrefs,
    privacy_settings: privacySettings,
    language,
    timezone,
    availability_schedule: availabilitySchedule,
    auto_response_message: autoResponseMessage,
    analytics_visibility: analyticsVisibility,
    watermark_enabled: watermarkEnabled
  } = req.body;
  
  const uid = req.user.supabase_id; // Get UID from verified token
  
  logger.info('👤 Profile update request:', { 
    uid, 
    isCreator, 
    bio: bio ? bio.substring(0, 50) + '...' : 'empty',
    profilePic: profilePic ? 'provided' : 'empty',
    streamPrice,
    videoPrice,
    voicePrice,
    messagePrice,
    requestUser: req.user.ui,
    timestamp: new Date().toISOString()
  });

  // UID validation removed since we get it from the verified token

  if (bio && bio.length > 1000) {
    return res.status(400).json({
      error: 'Bio must be less than 1000 characters',
      timestamp: new Date().toISOString()
    });
  }

  if (isCreator) {
    if (!streamPrice || streamPrice <= 0 || !videoPrice || videoPrice <= 0 || 
        !voicePrice || voicePrice <= 0 || !messagePrice || messagePrice <= 0 ||
        !textMessagePrice || textMessagePrice <= 0 || !imageMessagePrice || imageMessagePrice <= 0 ||
        !videoMessagePrice || videoMessagePrice <= 0 || !voiceMemoPrice || voiceMemoPrice <= 0) {
      return res.status(400).json({
        error: 'Creators must set all prices greater than 0',
        timestamp: new Date().toISOString()
      });
    }

    if (streamPrice > 1000 || videoPrice > 1000 || voicePrice > 1000 || messagePrice > 1000 ||
        textMessagePrice > 100 || imageMessagePrice > 100 || videoMessagePrice > 100 || voiceMemoPrice > 100) {
      return res.status(400).json({
        error: 'Live session prices cannot exceed $1000 per minute, messaging prices cannot exceed $100 per item',
        timestamp: new Date().toISOString()
      });
    }

    // Creator type is required for creators
    if (!creatorType || creatorType.trim().length === 0) {
      return res.status(400).json({
        error: 'Creator type is required for creators',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Validate username format
  const usernameValidation = validateUsername(username);
  if (!usernameValidation.valid) {
    return res.status(400).json({
      error: usernameValidation.errors[0], // Return first error
      errors: usernameValidation.errors, // Return all errors
      timestamp: new Date().toISOString()
    });
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Check if username is available
    const availability = await checkUsernameAvailability(username, client, uid);
    if (!availability.available) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Username is already taken',
        timestamp: new Date().toISOString()
      });
    }

    const existingUser = await client.query(
      'SELECT * FROM users WHERE id = $1::uuid',
      [uid]
    );

    let result;
    if (existingUser.rows.length > 0) {
      result = await client.query(
        `UPDATE users 
         SET is_creator = $2, bio = $3, display_name = $4, profile_pic_url = $5, banner_url = $6, stream_price = $7, video_price = $8, voice_price = $9, message_price = $10, 
             text_message_price = $11, image_message_price = $12, video_message_price = $13, voice_memo_price = $14,
             username = $15, creator_type = $16, interests = $17, show_token_balance = $18, gallery_photos = $19, stream_audience_control = $20, 
             state = $21, country = $22, notification_preferences = $23, privacy_settings = $24, language = $25, timezone = $26,
             availability_schedule = $27, auto_response_message = $28, analytics_visibility = $29, watermark_enabled = $30,
             what_i_offer = $31, availability = $32,
             updated_at = NOW()
         WHERE supabase_id = $1
         RETURNING *`,
        [uid, isCreator, bio, displayName, profilePic, bannerUrl, streamPrice || 5.00, videoPrice || 8.00, voicePrice || 6.00, messagePrice || 2.00, 
         textMessagePrice || 1.00, imageMessagePrice || 3.00, videoMessagePrice || 5.00, voiceMemoPrice || 2.00,
         username, creatorType, interests || [], showTokenBalance || false, JSON.stringify(galleryPhotos || []), streamAudienceControl || 'public',
         state, country, JSON.stringify(notificationPrefs || {}), JSON.stringify(privacySettings || {}), language || 'en', timezone || 'America/New_York',
         JSON.stringify(availabilitySchedule || {}), autoResponseMessage, analyticsVisibility || 'public', watermarkEnabled || false,
         req.body.whatIOffer || null, req.body.availability || null]
      );
      logger.info('✅ Profile updated successfully');
    } else {
      result = await client.query(
        `INSERT INTO users (supabase_id, is_creator, bio, display_name, profile_pic_url, banner_url, stream_price, video_price, voice_price, message_price, 
                           text_message_price, image_message_price, video_message_price, voice_memo_price,
                           username, creator_type, interests, show_token_balance, gallery_photos, stream_audience_control, state, country,
                           notification_preferences, privacy_settings, language, timezone, availability_schedule,
                           auto_response_message, analytics_visibility, watermark_enabled, what_i_offer, availability, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, NOW(), NOW()) 
         RETURNING *`,
        [uid, isCreator, bio, displayName, profilePic, bannerUrl, streamPrice || 5.00, videoPrice || 8.00, voicePrice || 6.00, messagePrice || 2.00, 
         textMessagePrice || 1.00, imageMessagePrice || 3.00, videoMessagePrice || 5.00, voiceMemoPrice || 2.00,
         username, creatorType, interests || [], showTokenBalance || false, JSON.stringify(galleryPhotos || []), streamAudienceControl || 'public',
         state, country, JSON.stringify(notificationPrefs || {}), JSON.stringify(privacySettings || {}), language || 'en', timezone || 'America/New_York',
         JSON.stringify(availabilitySchedule || {}), autoResponseMessage, analyticsVisibility || 'public', watermarkEnabled || false,
         req.body.whatIOffer || null, req.body.availability || null]
      );
      logger.info('✅ Profile created successfully');

      // Initialize token balance for new users
      await client.query(
        `INSERT INTO token_balances (user_id, balance, updated_at)
         VALUES ($1, 0, NOW())`,
        [uid]
      );
    }
    
    const user = result.rows[0];

    await client.query('COMMIT');

    // Invalidate user cache after update
    await usersCache.invalidate(uid);
    if (user.is_creator) {
      await creatorsCache.invalidate(uid);
    }
    logger.info('🔄 Cache invalidated after profile update', { userId: uid });

    try {
      // Supabase removed - using Supabase
      await supabaseAdmin.auth.admin.setCustomUserClaims(uid, {
        isCreator: isCreator,
        profileComplete: true
      });
      logger.info('✅ Supabase custom claims updated');
    } catch (claimsError) {
      logger.error('⚠️ Failed to update Supabase claims:', claimsError.message);
    }

    res.json({ 
      success: true, 
      user: {
        id: user.id,
        supabase_id: user.id,
        username: user.username,
        display_name: user.display_name,
        is_creator: user.is_creator,
        bio: user.bio,
        profile_pic_url: user.profile_pic_url,
        stream_price: parseFloat(user.stream_price || 5.00),
        video_price: parseFloat(user.video_price || 8.00),
        voice_price: parseFloat(user.voice_price || 6.00),
        message_price: parseFloat(user.message_price || 2.00),
        created_at: user.created_at,
        updated_at: user.updated_at,
        total_sessions: user.total_sessions || 0,
        total_earnings: parseFloat(user.total_earnings || 0),
        total_spent: parseFloat(user.total_spent || 0),
        auto_refill_enabled: user.auto_refill_enabled,
        auto_refill_package: user.auto_refill_package,
        last_purchase_amount: user.last_purchase_amount
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('❌ Profile update error:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    client.release();
  }
});

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  const { uid } = req.query;
  const targetUid = uid || req.user.supabase_id;

  logger.info('👤 Profile GET request:', {
    targetUid,
    requestUser: req.user.supabase_id,
    timestamp: new Date().toISOString()
  });

  try {
    // Check Redis cache first
    const cachedUser = await usersCache.get(targetUid);
    let user;
    let fromCache = false;

    if (cachedUser) {
      user = cachedUser;
      fromCache = true;
      logger.info('✅ User profile served from cache', { userId: targetUid });
    } else {
      // Fetch from database if not cached
      const result = await pool.query(
        'SELECT * FROM users WHERE id = $1::uuid',
        [targetUid]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Profile not found',
          timestamp: new Date().toISOString()
        });
      }

      user = result.rows[0];

      // Cache the user data for 30 minutes
      await usersCache.cache(targetUid, user, TTL.MEDIUM);
      logger.info('📝 User profile cached', { userId: targetUid });
    }
    const isOwnProfile = targetUid === req.user.sub || targetUid === req.user.supabase_id;
    
    const profileData = {
      id: user.id,
      supabase_id: user.id,
      is_creator: user.is_creator,
      is_super_admin: user.is_super_admin || false,
      role: user.role || 'user',
      bio: user.bio,
      username: user.username,
      display_name: user.display_name || user.username,
      creator_type: user.creator_type,
      interests: user.interests || [],
      profile_pic_url: user.profile_pic_url,
      stream_price: parseFloat(user.stream_price || 5.00),
      video_price: parseFloat(user.video_price || 8.00),
      voice_price: parseFloat(user.voice_price || 6.00),
      message_price: parseFloat(user.message_price || 2.00),
      text_message_price: parseFloat(user.text_message_price || 1.00),
      image_message_price: parseFloat(user.image_message_price || 3.00),
      video_message_price: parseFloat(user.video_message_price || 5.00),
      voice_memo_price: parseFloat(user.voice_memo_price || 2.00),
      show_token_balance: user.show_token_balance,
      gallery_photos: user.gallery_photos ? JSON.parse(user.gallery_photos) : [],
      stream_audience_control: user.stream_audience_control || 'public',
      // Gifter tier information
      gifter_tier: user.gifter_tier || 'Supporter',
      gifter_tier_color: user.gifter_tier_color || '#5C4033',
      lifetime_tokens_spent: user.lifetime_tokens_spent || 0,
      notification_preferences: user.notification_preferences ? 
        (typeof user.notification_preferences === 'string' ? JSON.parse(user.notification_preferences) : user.notification_preferences) : {},
      privacy_settings: user.privacy_settings ? 
        (typeof user.privacy_settings === 'string' ? JSON.parse(user.privacy_settings) : user.privacy_settings) : {},
      language: user.language || 'en',
      timezone: user.timezone || 'America/New_York',
      availability_schedule: user.availability_schedule ? 
        (typeof user.availability_schedule === 'string' ? JSON.parse(user.availability_schedule) : user.availability_schedule) : {},
      auto_response_message: user.auto_response_message,
      analytics_visibility: user.analytics_visibility || 'public',
      watermark_enabled: user.watermark_enabled || false,
      created_at: user.created_at,
      updated_at: user.updated_at
    };

    if (isOwnProfile) {
      profileData.total_sessions = user.total_sessions || 0;
      profileData.total_earnings = parseFloat(user.total_earnings || 0);
      profileData.total_spent = parseFloat(user.total_spent || 0);
      profileData.auto_refill_enabled = user.auto_refill_enabled;
      profileData.auto_refill_package = user.auto_refill_package;
      profileData.last_purchase_amount = user.last_purchase_amount;
    }

    logger.info('✅ Profile retrieved successfully');
    res.json(profileData);
  } catch (error) {
    logger.error('❌ Profile GET error:', error);
    res.status(500).json({
      error: 'Failed to retrieve profile',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Upload profile image
router.post('/upload-profile-image', authenticateToken, uploadImage.single('file'), async (req, res) => {
  const { supabase_id } = req.user;
  
  logger.info('📸 Profile image upload request:', { 
    supabase_id,
    fileSize: req.file?.size,
    mimeType: req.file?.mimetype,
    timestamp: new Date().toISOString()
  });

  if (!req.file) {
    return res.status(400).json({
      error: 'No file uploaded',
      timestamp: new Date().toISOString()
    });
  }

  try {
    // Use Supabase Storage instead of base64
    const storageManager = require('../utils/storage-manager');
    
    // Upload to Supabase Storage
    const urls = await storageManager.uploadProfilePicture(
      supabase_id,
      req.file.buffer,
      req.file.mimetype
    );
    
    // Update user profile with Supabase Storage URL
    await pool.query(
      'UPDATE users SET profile_pic_url = $1, updated_at = NOW() WHERE supabase_id = $2',
      [urls.original, supabase_id]
    );

    logger.info('✅ Profile image uploaded to Supabase Storage successfully');
    res.json({
      url: urls.original,
      urls: urls,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Profile image upload error:', error);
    res.status(500).json({
      error: 'Failed to upload profile image',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get public creators list (no auth required)
router.get('/public/creators', async (req, res) => {
  const { limit = 50, offset = 0, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;
  
  logger.info('🌟 Public creators GET request:', { 
    limit, 
    offset, 
    sortBy, 
    sortOrder,
    timestamp: new Date().toISOString()
  });
  
  const allowedSortFields = ['created_at', 'stream_price', 'total_sessions', 'total_earnings'];
  const allowedSortOrders = ['ASC', 'DESC'];
  
  const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
  const validSortOrder = allowedSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';
  
  try {
    // First, try to get creators with is_creator = true
    let result = await pool.query(
      `SELECT 
         COALESCE(u.supabase_id, u.id) as uid,
         u.id::text as id,
         u.username, 
         u.display_name,
         u.bio, 
         u.profile_pic_url, 
         u.creator_type,
         COALESCE(u.stream_price, 100) as stream_price, 
         COALESCE(u.video_price, 150) as video_price, 
         COALESCE(u.voice_price, 50) as voice_price, 
         COALESCE(u.message_price, 50) as message_price,
         COALESCE(u.text_message_price, 50) as text_message_price,
         COALESCE(u.image_message_price, 100) as image_message_price,
         COALESCE(u.audio_message_price, 150) as audio_message_price,
         COALESCE(u.video_message_price, 200) as video_message_price,
         u.state,
         u.country,
         u.created_at, 
         u.updated_at, 
         u.total_sessions, 
         u.total_earnings,
         u.last_active,
         u.is_verified,
         CASE 
           WHEN u.last_active > NOW() - INTERVAL '5 minutes' THEN true 
           ELSE false 
         END as is_online,
         false as is_streaming,
         (SELECT COUNT(*) FROM follows f WHERE f.creator_id = u.id) as follower_count
       FROM public.users u
       WHERE u.is_creator = TRUE AND u.username IS NOT NULL
       ORDER BY u.${validSortBy} ${validSortOrder}
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    // If no creators found, try a more lenient query to get any users with creator-like attributes
    if (result.rows.length === 0) {
      logger.info('⚠️ No creators found with is_creator=true, trying fallback query');
      result = await pool.query(
        `SELECT 
           COALESCE(u.supabase_id, u.id) as uid,
           u.id::text as id,
           u.username, 
           u.display_name,
           u.bio, 
           u.profile_pic_url, 
           u.creator_type,
           COALESCE(u.stream_price, 100) as stream_price, 
           COALESCE(u.video_price, 150) as video_price, 
           COALESCE(u.voice_price, 50) as voice_price, 
           COALESCE(u.message_price, 50) as message_price,
           COALESCE(u.text_message_price, 50) as text_message_price,
           COALESCE(u.image_message_price, 100) as image_message_price,
           COALESCE(u.audio_message_price, 150) as audio_message_price,
           COALESCE(u.video_message_price, 200) as video_message_price,
           u.state,
           u.country,
           u.created_at, 
           u.updated_at, 
           u.total_sessions, 
           u.total_earnings,
           u.last_active,
           u.is_verified,
           CASE 
             WHEN u.last_active > NOW() - INTERVAL '5 minutes' THEN true 
             ELSE false 
           END as is_online,
           false as is_streaming,
           (SELECT COUNT(*) FROM follows f WHERE f.creator_id = u.id) as follower_count
         FROM public.users u
         WHERE u.username IS NOT NULL 
           AND (
             u.is_creator = TRUE 
             OR u.creator_type IS NOT NULL 
             OR LOWER(u.username) LIKE '%creator%'
             OR LOWER(u.display_name) LIKE '%creator%'
             OR u.stream_price IS NOT NULL
           )
         ORDER BY 
           CASE WHEN u.is_creator = TRUE THEN 0 ELSE 1 END,
           u.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM users 
       WHERE username IS NOT NULL 
         AND (
           is_creator = TRUE 
           OR creator_type IS NOT NULL 
           OR LOWER(username) LIKE '%creator%'
           OR LOWER(display_name) LIKE '%creator%'
           OR stream_price IS NOT NULL
         )`
    );

    const creators = result.rows.map(creator => ({
      uid: creator.uid,
      id: creator.id,
      username: creator.username,
      full_name: creator.display_name || creator.username,
      displayName: creator.display_name || creator.username,
      bio: creator.bio,
      profile_pic_url: creator.profile_pic_url,
      profilePicUrl: creator.profile_pic_url,
      creator_type: creator.creator_type || 'other',
      streamPrice: parseFloat(creator.stream_price || 5.00),
      stream_price: parseFloat(creator.stream_price || 5.00),
      videoPrice: parseFloat(creator.video_price || 8.00),
      video_price: parseFloat(creator.video_price || 8.00),
      voicePrice: parseFloat(creator.voice_price || 6.00),
      voice_price: parseFloat(creator.voice_price || 6.00),
      messagePrice: parseFloat(creator.message_price || 2.00),
      message_price: parseFloat(creator.message_price || 2.00),
      state: creator.state,
      country: creator.country,
      createdAt: creator.created_at,
      updatedAt: creator.updated_at,
      totalSessions: creator.total_sessions || 0,
      total_sessions: creator.total_sessions || 0,
      totalEarnings: parseFloat(creator.total_earnings || 0),
      is_online: creator.is_online || false,
      is_streaming: creator.is_streaming || false,
      is_live: creator.is_streaming || false,
      is_verified: creator.is_verified || false,
      follower_count: parseInt(creator.follower_count || 0),
      languages: ['English'], // Default for now, can be expanded
      response_time: '< 1 hour', // Default for now
      specialties: creator.creator_type ? [creator.creator_type] : []
    }));

    logger.info('✅ Public creators retrieved successfully:', creators.length);
    res.json({
      creators: creators,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Public creators GET error:', error);
    res.status(500).json({
      error: 'Failed to retrieve creators',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get creators list with enhanced filtering
router.get('/creators', async (req, res) => {
  const {
    limit = 20,
    page = 1,
    offset = 0,
    category = 'all',
    languages = '',
    sort = 'popular',
    sortBy,
    sortOrder = 'DESC',
    excludeUserId  // NEW: Filter out the current user from results
  } = req.query;

  // Calculate actual offset from page number
  const actualLimit = parseInt(limit);
  const actualOffset = page ? (parseInt(page) - 1) * actualLimit : parseInt(offset);

  logger.info('👥 Creators GET request:', {
    limit: actualLimit,
    offset: actualOffset,
    page,
    category,
    languages,
    sort,
    sortBy,
    sortOrder,
    excludeUserId: excludeUserId ? '***' : undefined,
    timestamp: new Date().toISOString()
  });

  try {
    // Build WHERE clause based on filters
    let whereConditions = ['u.is_creator = TRUE'];
    let queryParams = [];
    let paramIndex = 1;

    // IMPORTANT: Exclude the current user from results (prevent self-discovery)
    if (excludeUserId) {
      whereConditions.push(`u.supabase_id != $${paramIndex}`);
      queryParams.push(excludeUserId);
      paramIndex++;
    }

    // Category filter
    if (category && category !== 'all') {
      whereConditions.push(`LOWER(u.creator_type) = LOWER($${paramIndex})`);
      queryParams.push(category);
      paramIndex++;
    }
    
    // Languages filter (for now, we'll skip this as it's not in the database)
    // TODO: Add languages column to users table
    
    // Determine sort field based on sort parameter
    let orderByClause = 'u.created_at DESC';
    switch(sort || sortBy) {
      case 'popular':
        orderByClause = 'COALESCE(u.total_sessions, 0) DESC, u.created_at DESC';
        break;
      case 'rating':
        orderByClause = 'u.created_at DESC'; // Rating column doesn't exist yet
        break;
      case 'online':
        orderByClause = `CASE WHEN u.last_active > NOW() - INTERVAL '5 minutes' THEN 0 ELSE 1 END, u.created_at DESC`;
        break;
      case 'price-low':
        orderByClause = 'COALESCE(u.video_price, 150) ASC';
        break;
      case 'price-high':
        orderByClause = 'COALESCE(u.video_price, 150) DESC';
        break;
      case 'created_at':
      case 'total_sessions':
      case 'total_earnings':
        const validSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';
        orderByClause = `u.${sort || sortBy} ${validSortOrder}`;
        break;
    }
    
    // Add limit and offset params
    queryParams.push(actualLimit);
    queryParams.push(actualOffset);
    
    const whereClause = whereConditions.join(' AND ');
    
    const result = await pool.query(
      `SELECT 
         u.id::text as id,
         COALESCE(u.supabase_id, u.id) as uid,
         u.username, 
         u.email,
         u.display_name,
         u.bio, 
         u.profile_pic_url, 
         u.creator_type,
         COALESCE(u.stream_price, 100) as stream_price, 
         COALESCE(u.video_price, 150) as video_price, 
         COALESCE(u.voice_price, 50) as voice_price, 
         COALESCE(u.message_price, 50) as message_price,
         COALESCE(u.text_message_price, 50) as text_message_price,
         COALESCE(u.image_message_price, 100) as image_message_price,
         COALESCE(u.audio_message_price, 150) as audio_message_price,
         COALESCE(u.video_message_price, 200) as video_message_price,
         u.state,
         u.country,
         u.created_at, 
         u.updated_at, 
         u.total_sessions, 
         u.total_earnings,
         u.last_active,
         u.is_verified,
         CASE 
           WHEN u.last_active > NOW() - INTERVAL '5 minutes' THEN true 
           ELSE false 
         END as is_online,
         false as is_streaming,
         (SELECT COUNT(*) FROM follows f WHERE f.creator_id = u.id) as follower_count
       FROM public.users u
       WHERE ${whereClause}
       ORDER BY ${orderByClause}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      queryParams
    );

    // Get total count with same filters
    const countParams = queryParams.slice(0, -2); // Remove limit and offset
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM users u WHERE ${whereClause}`,
      countParams
    );

    const creators = result.rows.map(creator => ({
      id: creator.id,
      uid: creator.uid,
      username: creator.username,
      email: creator.email,
      display_name: creator.display_name || creator.username,
      displayName: creator.display_name || creator.username,
      bio: creator.bio,
      profile_pic_url: creator.profile_pic_url,
      profilePicUrl: creator.profile_pic_url,
      avatar: creator.profile_pic_url,
      category: creator.creator_type || 'Other',
      creator_type: creator.creator_type || 'other',
      specialties: creator.creator_type ? [creator.creator_type] : [],
      stream_price: parseFloat(creator.stream_price || 100),
      streamPrice: parseFloat(creator.stream_price || 100),
      video_price: parseFloat(creator.video_price || 150),
      videoPrice: parseFloat(creator.video_price || 150),
      voice_price: parseFloat(creator.voice_price || 50),
      voicePrice: parseFloat(creator.voice_price || 50),
      message_price: parseFloat(creator.message_price || 50),
      messagePrice: parseFloat(creator.message_price || 50),
      state: creator.state,
      country: creator.country,
      created_at: creator.created_at,
      createdAt: creator.created_at,
      updated_at: creator.updated_at,
      updatedAt: creator.updated_at,
      total_sessions: creator.total_sessions || 0,
      totalSessions: creator.total_sessions || 0,
      total_earnings: parseFloat(creator.total_earnings || 0),
      totalEarnings: parseFloat(creator.total_earnings || 0),
      rating: 4.5, // Default rating for now
      total_reviews: Math.floor(Math.random() * 100), // Random for demo
      totalReviews: Math.floor(Math.random() * 100),
      is_online: creator.is_online || false,
      isOnline: creator.is_online || false,
      is_streaming: creator.is_streaming || false,
      isStreaming: creator.is_streaming || false,
      isLive: creator.is_streaming || false,
      is_live: creator.is_streaming || false,
      is_verified: creator.is_verified || false,
      isVerified: creator.is_verified || false,
      follower_count: parseInt(creator.follower_count || 0),
      languages: ['English'], // Default for now
      responseTime: '< 1 hour', // Default for now
      response_time: '< 1 hour'
    }));

    logger.info('✅ Creators retrieved successfully:', creators.length);
    res.json({
      creators: creators,
      total: parseInt(countResult.rows[0].total),
      hasMore: actualOffset + creators.length < parseInt(countResult.rows[0].total),
      limit: actualLimit,
      offset: actualOffset,
      page: parseInt(page),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Creators GET error:', error);
    res.status(500).json({
      error: 'Failed to retrieve creators',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Search creators
router.get('/creators/search', async (req, res) => {
  const { q, limit = 20, offset = 0 } = req.query;
  
  if (!q || q.trim().length < 2) {
    return res.status(400).json({
      error: 'Search query must be at least 2 characters',
      timestamp: new Date().toISOString()
    });
  }

  logger.info('🔍 Creator search request:', { 
    query: q, 
    limit, 
    offset,
    timestamp: new Date().toISOString()
  });

  try {
    const searchTerm = `%${q.trim().toLowerCase()}%`;
    
    const result = await pool.query(
      `SELECT
         id, supabase_id, bio, profile_pic_url,
         COALESCE(creator_rate, voice_rate, stream_price, 0) as price_per_min,
         created_at, updated_at,
         total_sessions, total_earnings
       FROM users
       WHERE is_creator = TRUE
       AND (LOWER(bio) LIKE $1 OR LOWER(supabase_id) LIKE $1)
       ORDER BY total_sessions DESC, created_at DESC
       LIMIT $2 OFFSET $3`,
      [searchTerm, limit, offset]
    );

    const creators = result.rows.map(creator => ({
      id: creator.id,
      supabase_id: creator.supabase_id,
      bio: creator.bio,
      profile_pic_url: creator.profile_pic_url,
      price_per_min: parseFloat(creator.price_per_min),
      created_at: creator.created_at,
      updated_at: creator.updated_at,
      total_sessions: creator.total_sessions || 0,
      total_earnings: parseFloat(creator.total_earnings || 0)
    }));

    logger.info('✅ Creator search completed:', creators.length, 'results');
    res.json({
      creators: creators,
      query: q,
      total: creators.length,
      limit: parseInt(limit),
      offset: parseInt(offset),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Creator search error:', error);
    res.status(500).json({
      error: 'Failed to search creators',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Search for users (fans or creators)
router.get('/search', authenticateToken, async (req, res) => {
  const { q, type = 'all', limit = 10 } = req.query;
  
  if (!q || q.trim().length < 2) {
    return res.json({ users: [], creators: [] });
  }
  
  logger.info('🔍 User search request:', { 
    query: q, 
    type,
    limit,
    timestamp: new Date().toISOString()
  });
  
  try {
    const searchTerm = `%${q.trim().toLowerCase()}%`;
    let query;
    let params = [searchTerm, limit];
    
    if (type === 'fan') {
      // Search only for fans
      query = `
        SELECT 
          supabase_id as id,
          username,
          display_name,
          profile_pic_url,
          subscription_tier
        FROM users 
        WHERE (is_creator = FALSE OR is_creator IS NULL)
        AND (LOWER(username) LIKE $1 OR LOWER(display_name) LIKE $1)
        LIMIT $2
      `;
    } else if (type === 'creator') {
      // Search only for creators
      query = `
        SELECT 
          supabase_id as id,
          username,
          display_name,
          profile_pic_url,
          creator_type,
          video_price,
          voice_price,
          is_online
        FROM users 
        WHERE is_creator = TRUE
        AND (LOWER(username) LIKE $1 OR LOWER(display_name) LIKE $1)
        LIMIT $2
      `;
    } else {
      // Search all users
      query = `
        SELECT 
          supabase_id as id,
          username,
          display_name,
          profile_pic_url,
          is_creator,
          creator_type,
          subscription_tier
        FROM users 
        WHERE LOWER(username) LIKE $1 OR LOWER(display_name) LIKE $1
        LIMIT $2
      `;
    }
    
    const result = await pool.query(query, params);
    
    res.json({
      users: result.rows,
      success: true
    });
    
  } catch (error) {
    logger.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Create session with token validation
router.post('/session', authenticateToken, async (req, res) => {
  const { creatorId, type } = req.body;
  
  logger.info('🎥 Session creation request:', { 
    creatorId, 
    type, 
    fanId: req.user.supabase_id,
    timestamp: new Date().toISOString()
  });

  if (!creatorId || !type) {
    return res.status(400).json({
      error: 'Creator ID and session type are required',
      timestamp: new Date().toISOString()
    });
  }

  const validTypes = ['video', 'voice', 'stream'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({
      error: 'Invalid session type. Must be: video, voice, or stream',
      timestamp: new Date().toISOString()
    });
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const fanResult = await client.query(
      'SELECT id FROM users WHERE supabase_id = $1',
      [req.user.supabase_id]
    );
    
    const creatorResult = await client.query(
      'SELECT id, supabase_id, COALESCE(creator_rate, voice_rate, stream_price, 0) as price_per_min FROM users WHERE supabase_id = $1 AND is_creator = TRUE',
      [creatorId]
    );

    if (fanResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'User profile not found',
        timestamp: new Date().toISOString()
      });
    }

    if (creatorResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Creator not found',
        timestamp: new Date().toISOString()
      });
    }

    const fanId = fanResult.rows[0].id;
    const creatorDbId = creatorResult.rows[0].id;
    const pricePerMin = parseFloat(creatorResult.rows[0].price_per_min);

    // Check token balance for non-stream sessions
    if (type !== 'stream') {
      const tokensPerMin = Math.ceil(pricePerMin / TOKEN_REDEMPTION_VALUE);
      const balanceResult = await client.query(
        `SELECT balance FROM token_balances WHERE user_id = $1`,
        [req.user.supabase_id]
      );

      const balance = balanceResult.rows.length > 0 ? balanceResult.rows[0].balance : 0;

      if (balance < tokensPerMin) {
        await client.query('ROLLBACK');
        return res.status(402).json({
          error: 'Insufficient token balance to start session',
          currentBalance: balance,
          requiredTokensPerMin: tokensPerMin,
          pricePerMin: pricePerMin,
          timestamp: new Date().toISOString()
        });
      }
    }

    const result = await client.query(
      `INSERT INTO sessions (creator_id, fan_id, start_time, type, status, price_per_min) 
       VALUES ($1, $2, NOW(), $3, 'active', $4) 
       RETURNING *`,
      [creatorDbId, fanId, type, pricePerMin]
    );

    await client.query('COMMIT');
    
    logger.info('✅ Session created successfully:', result.rows[0].id);
    res.json({ 
      success: true, 
      session: {
        id: result.rows[0].id,
        creator_id: result.rows[0].creator_id,
        fan_id: result.rows[0].fan_id,
        start_time: result.rows[0].start_time,
        type: result.rows[0].type,
        status: result.rows[0].status,
        price_per_min: parseFloat(result.rows[0].price_per_min)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('❌ Session creation error:', error);
    res.status(500).json({
      error: 'Failed to create session',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    client.release();
  }
});

// End session with token deduction
router.put('/session/:sessionId/end', authenticateToken, async (req, res) => {
  const { sessionId } = req.params;

  logger.info('🏁 Session end request:', { 
    sessionId, 
    userId: req.user.supabase_id,
    timestamp: new Date().toISOString()
  });

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      'SELECT id FROM users WHERE supabase_id = $1',
      [req.user.supabase_id]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    const userId = userResult.rows[0].id;

    const sessionResult = await client.query(
      `UPDATE sessions 
       SET end_time = NOW(), status = 'ended'
       WHERE id = $1 AND (creator_id = $2 OR fan_id = $2)
       RETURNING *`,
      [sessionId, userId]
    );

    if (sessionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Session not found or you do not have permission to end it',
        timestamp: new Date().toISOString()
      });
    }

    const session = sessionResult.rows[0];
    const endTime = new Date();
    const startTime = new Date(session.start_time);
    const durationMs = endTime - startTime;
    const durationMinutes = Math.ceil(durationMs / 60000);
    const pricePerMin = parseFloat(session.price_per_min);
    const tokenAmount = Math.ceil((pricePerMin / TOKEN_REDEMPTION_VALUE) * durationMinutes);
    const totalAmount = tokenAmount * TOKEN_REDEMPTION_VALUE;

    // Update session duration and total
    await client.query(
      `UPDATE sessions 
       SET duration_minutes = $1, total_amount = $2
       WHERE id = $3`,
      [durationMinutes, totalAmount, sessionId]
    );

    let charge = null;

    // Process token deduction for member
    if (session.fan_id === userId && session.type !== 'stream' && tokenAmount > 0) {
      // Get creator info
      const creatorResult = await client.query(
        'SELECT supabase_id FROM users WHERE supabase_id = $1',
        [session.creator_id]
      );

      if (creatorResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          error: 'Creator not found',
          timestamp: new Date().toISOString()
        });
      }

      const creatorUid = creatorResult.rows[0].supabase_id;

      // Check current balance
      const balanceResult = await client.query(
        `SELECT balance FROM token_balances WHERE user_id = $1`,
        [req.user.supabase_id]
      );

      let balance = balanceResult.rows.length > 0 ? balanceResult.rows[0].balance : 0;

      // Handle insufficient balance with auto-refill
      if (balance < tokenAmount) {
        const userSettingsResult = await client.query(
          `SELECT auto_refill_enabled, auto_refill_package, last_purchase_amount 
           FROM users WHERE supabase_id = $1`,
          [req.user.supabase_id]
        );

        const autoRefillEnabled = userSettingsResult.rows[0]?.auto_refill_enabled;
        const autoRefillPackage = userSettingsResult.rows[0]?.auto_refill_package || 
                                 userSettingsResult.rows[0]?.last_purchase_amount;

        if (autoRefillEnabled && autoRefillPackage) {
          // Auto-refill logic would go here
          // For now, return insufficient balance error
          await client.query('ROLLBACK');
          return res.status(402).json({
            error: 'Insufficient token balance',
            currentBalance: balance,
            requiredTokens: tokenAmount,
            autoRefillAvailable: true,
            suggestedPackage: autoRefillPackage,
            timestamp: new Date().toISOString()
          });
        } else {
          await client.query('ROLLBACK');
          return res.status(402).json({
            error: 'Insufficient token balance',
            currentBalance: balance,
            requiredTokens: tokenAmount,
            timestamp: new Date().toISOString()
          });
        }
      }

      // Deduct tokens from member
      await client.query(
        `UPDATE token_balances 
         SET balance = balance - $1, updated_at = NOW()
         WHERE user_id = $2`,
        [tokenAmount, req.user.supabase_id]
      );

      // Add tokens to creator
      await client.query(
        `INSERT INTO token_balances (user_id, balance, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET balance = token_balances.balance + $2, updated_at = NOW()`,
        [creatorUid, tokenAmount]
      );

      // Record transaction for member
      await client.query(
        `INSERT INTO token_transactions (user_id, type, tokens, amount_usd, status, session_id, created_at)
         VALUES ($1, 'call', $2, $3, 'completed', $4, NOW())`,
        [req.user.supabase_id, tokenAmount, totalAmount, sessionId]
      );

      // Record transaction for creator
      await client.query(
        `INSERT INTO token_transactions (user_id, type, tokens, amount_usd, status, session_id, created_at)
         VALUES ($1, 'call', $2, $3, 'completed', $4, NOW())`,
        [creatorUid, tokenAmount, totalAmount, sessionId]
      );

      // Record earnings for payout system
      await client.query(
        `INSERT INTO creator_earnings (creator_id, earning_type, source_id, tokens_earned, usd_value, description, fan_id)
         VALUES ($1, 'session', $2, $3, $4, $5, $6)`,
        [creatorUid, sessionId, tokenAmount, totalAmount, `${session.type} session - ${durationMinutes} minutes`, req.user.supabase_id]
      );

      // Update user stats
      await client.query(
        `UPDATE users SET total_earnings = total_earnings + $1, total_sessions = total_sessions + 1
         WHERE supabase_id = $2`,
        [totalAmount, creatorUid]
      );

      await client.query(
        `UPDATE users SET total_spent = total_spent + $1
         WHERE supabase_id = $2`,
        [totalAmount, req.user.supabase_id]
      );

      charge = {
        tokenAmount,
        durationMinutes,
        pricePerMin,
        totalAmount
      };
    }

    await client.query('COMMIT');

    logger.info('✅ Session ended successfully');
    res.json({ 
      success: true, 
      session: {
        id: session.id,
        creator_id: session.creator_id,
        fan_id: session.fan_id,
        start_time: session.start_time,
        end_time: endTime,
        type: session.type,
        status: 'ended',
        duration_minutes: durationMinutes,
        total_amount: totalAmount
      },
      charge,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('❌ Session end error:', error);
    res.status(500).json({
      error: 'Failed to end session',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    client.release();
  }
});

// Get user sessions
router.get('/sessions', authenticateToken, async (req, res) => {
  const { limit = 50, offset = 0, status } = req.query;
  
  logger.info('📊 Sessions GET request:', { 
    userId: req.user.supabase_id,
    limit, 
    offset, 
    status,
    timestamp: new Date().toISOString()
  });

  try {
    const userResult = await pool.query(
      'SELECT id FROM users WHERE supabase_id = $1',
      [req.user.supabase_id]
    );

    if (userResult.rows.length === 0) {
      return res.json({
        sessions: [],
        total: 0,
        timestamp: new Date().toISOString()
      });
    }

    const userId = userResult.rows[0].id;

    let query = `
      SELECT s.*, 
             creator.supabase_id as creator_uid, creator.bio as creator_bio,
             member.supabase_id as member_uid
      FROM sessions s
      LEFT JOIN users creator ON s.creator_id = creator.id
      LEFT JOIN users member ON s.fan_id = member.id
      WHERE s.creator_id = $1 OR s.fan_id = $1
    `;
    
    const params = [userId];
    
    if (status) {
      query += ` AND s.status = $${params.length + 1}`;
      params.push(status);
    }
    
    query += ` ORDER BY s.start_time DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    let countQuery = `
      SELECT COUNT(*) as total FROM sessions s
      WHERE s.creator_id = $1 OR s.fan_id = $1
    `;
    const countParams = [userId];
    
    if (status) {
      countQuery += ` AND s.status = $2`;
      countParams.push(status);
    }
    
    const countResult = await pool.query(countQuery, countParams);

    logger.info('✅ Sessions retrieved successfully:', result.rows.length);
    res.json({
      sessions: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Sessions GET error:', error);
    res.status(500).json({
      error: 'Failed to retrieve sessions',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get user statistics
router.get('/stats', authenticateToken, async (req, res) => {
  logger.info('📈 Stats request:', { 
    userId: req.user.supabase_id,
    timestamp: new Date().toISOString()
  });

  try {
    const userResult = await pool.query(
      'SELECT id, is_creator FROM users WHERE supabase_id = $1',
      [req.user.supabase_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    const userId = userResult.rows[0].id;
    const isCreator = userResult.rows[0].is_creator;

    let stats = {};

    if (isCreator) {
      const creatorStats = await pool.query(
        `SELECT 
           COUNT(DISTINCT s.id) as total_sessions,
           COUNT(DISTINCT s.fan_id) as unique_members,
           COALESCE(SUM(tt.amount_usd), 0) as total_earnings,
           AVG(tt.amount_usd) as avg_payment
         FROM sessions s
         LEFT JOIN token_transactions tt ON s.id = tt.session_id AND tt.user_id = $1 AND tt.type = 'call'
         WHERE s.creator_id = $2`,
        [req.user.supabase_id, userId]
      );

      stats = {
        role: 'creator',
        totalSessions: parseInt(creatorStats.rows[0].total_sessions || 0),
        uniqueFans: parseInt(creatorStats.rows[0].unique_members || 0),
        totalEarnings: parseFloat(creatorStats.rows[0].total_earnings || 0),
        averagePayment: parseFloat(creatorStats.rows[0].avg_payment || 0)
      };
    } else {
      const fanStats = await pool.query(
        `SELECT 
           COUNT(DISTINCT s.id) as total_sessions,
           COUNT(DISTINCT s.creator_id) as unique_creators,
           COALESCE(SUM(tt.amount_usd), 0) as total_spent,
           AVG(tt.amount_usd) as avg_payment
         FROM sessions s
         LEFT JOIN token_transactions tt ON s.id = tt.session_id AND tt.user_id = $1 AND tt.type = 'call'
         WHERE s.fan_id = $2`,
        [req.user.supabase_id, userId]
      );

      stats = {
        role: 'fan',
        totalSessions: parseInt(fanStats.rows[0].total_sessions || 0),
        uniqueCreators: parseInt(fanStats.rows[0].unique_creators || 0),
        totalSpent: parseFloat(fanStats.rows[0].total_spent || 0),
        averagePayment: parseFloat(fanStats.rows[0].avg_payment || 0)
      };
    }

    logger.info('✅ Stats retrieved successfully');
    res.json({
      stats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Stats error:', error);
    res.status(500).json({
      error: 'Failed to retrieve statistics',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get session billing information
router.get('/session/:sessionId/billing', authenticateToken, async (req, res) => {
  const { sessionId } = req.params;
  try {
    const session = await pool.query(
      'SELECT * FROM sessions WHERE id = $1 AND (fan_id = (SELECT id FROM users WHERE supabase_id = $2) OR creator_id = (SELECT id FROM users WHERE supabase_id = $2))',
      [sessionId, req.user.supabase_id]
    );
    if (session.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    const payment = await pool.query('SELECT * FROM payments WHERE session_id = $1', [sessionId]);
    res.json({
      billing: {
        paymentIntentId: payment.rows[0]?.stripe_payment_intent_id,
        clientSecret: payment.rows[0]?.client_secret,
        durationMinutes: session.rows[0].duration_minutes || 0,
        ratePerMinute: session.rows[0].price_per_min,
        totalAmount: session.rows[0].total_amount || 0,
      },
    });
  } catch (error) {
    logger.error('❌ Billing fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch billing', details: error.message });
  }
});

// Find user by username
router.get('/username/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    const result = await pool.query(
      `SELECT supabase_id, username, bio, profile_pic_url, is_creator, show_token_balance,
              CASE WHEN show_token_balance = true 
                   THEN (SELECT balance FROM token_balances WHERE user_id = supabase_id)
                   ELSE NULL END as token_balance
       FROM users 
       WHERE username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    const user = result.rows[0];
    res.json({
      success: true,
      user: {
        username: user.username,
        bio: user.bio,
        profilePicUrl: user.profile_pic_url,
        isCreator: user.is_creator,
        tokenBalance: user.token_balance,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('❌ Find user by username error:', error);
    res.status(500).json({
      error: 'Failed to find user',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Send tip/gift to username
router.post('/send-tip', authenticateToken, async (req, res) => {
  const { recipientUsername, amount, message, type = 'tip' } = req.body;
  
  if (!recipientUsername || !amount || amount <= 0) {
    return res.status(400).json({
      error: 'Recipient username and valid amount are required',
      timestamp: new Date().toISOString()
    });
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Find recipient by username
    const recipientResult = await client.query(
      'SELECT supabase_id, username FROM users WHERE username = $1',
      [recipientUsername]
    );

    if (recipientResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Recipient user not found',
        timestamp: new Date().toISOString()
      });
    }

    const recipientUid = recipientResult.rows[0].supabase_id;
    
    // Check if trying to send to self
    if (recipientUid === req.user.supabase_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Cannot send tokens to yourself',
        timestamp: new Date().toISOString()
      });
    }

    // Check sender's token balance
    const senderBalanceResult = await client.query(
      'SELECT balance FROM token_balances WHERE user_id = $1',
      [req.user.supabase_id]
    );

    const senderBalance = senderBalanceResult.rows.length > 0 ? senderBalanceResult.rows[0].balance : 0;
    
    if (senderBalance < amount) {
      await client.query('ROLLBACK');
      return res.status(402).json({
        error: 'Insufficient token balance',
        currentBalance: senderBalance,
        requiredAmount: amount,
        timestamp: new Date().toISOString()
      });
    }

    // Deduct tokens from sender
    await client.query(
      `UPDATE token_balances 
       SET balance = balance - $1, updated_at = NOW()
       WHERE user_id = $2`,
      [amount, req.user.supabase_id]
    );

    // Add tokens to recipient (create balance if doesn't exist)
    await client.query(
      `INSERT INTO token_balances (user_id, balance, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET balance = token_balances.balance + $2, updated_at = NOW()`,
      [recipientUid, amount]
    );

    // Record transaction for sender
    await client.query(
      `INSERT INTO token_transactions (user_id, type, tokens, description, created_at, status)
       VALUES ($1, 'debit', $2, $3, NOW(), 'completed')`,
      [req.user.supabase_id, amount, `${type} sent to @${recipientUsername}: ${message || 'No message'}`]
    );

    // Record transaction for recipient
    await client.query(
      `INSERT INTO token_transactions (user_id, type, tokens, description, created_at, status)
       VALUES ($1, 'credit', $2, $3, NOW(), 'completed')`,
      [recipientUid, amount, `${type} received from sender: ${message || 'No message'}`]
    );

    await client.query('COMMIT');

    logger.info(`✅ ${type} sent: ${amount} tokens from ${req.user.supabase_id} to @${recipientUsername}`);

    res.json({
      success: true,
      message: `${type} sent successfully`,
      amount,
      recipient: recipientUsername,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`❌ Send ${type} error:`, error);
    res.status(500).json({
      error: `Failed to send ${type}`,
      details: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    client.release();
  }
});

// Follow/unfollow creator
router.post('/follow', authenticateToken, async (req, res) => {
  const { creatorUsername } = req.body;
  
  if (!creatorUsername) {
    return res.status(400).json({
      error: 'Creator username is required',
      timestamp: new Date().toISOString()
    });
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Find creator by username
    const creatorResult = await client.query(
      'SELECT id, supabase_id FROM users WHERE username = $1 AND is_creator = TRUE',
      [creatorUsername]
    );

    if (creatorResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Creator not found',
        timestamp: new Date().toISOString()
      });
    }

    const creatorId = creatorResult.rows[0].id;
    const creatorSupabaseId = creatorResult.rows[0].supabase_id;

    // Check if already following
    const existingFollow = await client.query(
      'SELECT id FROM followers WHERE creator_id = $1 AND follower_id = $2',
      [creatorId, req.user.supabase_id]
    );

    if (existingFollow.rows.length > 0) {
      // Unfollow
      await client.query(
        'DELETE FROM followers WHERE creator_id = $1 AND follower_id = $2',
        [creatorId, req.user.supabase_id]
      );
      
      await client.query('COMMIT');
      res.json({
        success: true,
        action: 'unfollowed',
        creator: creatorUsername,
        timestamp: new Date().toISOString()
      });
    } else {
      // Follow
      await client.query(
        'INSERT INTO followers (creator_id, follower_id, created_at) VALUES ($1, $2, NOW())',
        [creatorId, req.user.supabase_id]
      );
      
      // Send notification to creator about new follower
      try {
        // Get follower info
        const followerResult = await client.query(
          'SELECT username, display_name FROM users WHERE supabase_id = $1',
          [req.user.supabase_id]
        );
        
        if (followerResult.rows.length > 0) {
          const follower = followerResult.rows[0];
          const followerName = follower.display_name || follower.username || 'Someone';
          
          // Send follow notification with push support
          await sendFollowNotificationWithPush(
            creatorSupabaseId,
            req.user.supabase_id,
            followerName
          );
          
          // Also send real-time notification via WebSocket
          sendNotification(creatorSupabaseId, {
            type: 'follow',
            title: 'New Follower',
            message: `${followerName} started following you`,
            data: { 
              followerUsername: follower.username,
              followerDisplayName: follower.display_name,
              followerId: req.user.supabase_id
            }
          });
        }
      } catch (notifError) {
        // Log but don't fail the follow action if notification fails
        logger.error('Failed to send follow notification:', notifError);
      }
      
      await client.query('COMMIT');
      res.json({
        success: true,
        action: 'followed',
        creator: creatorUsername,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('❌ Follow/unfollow error:', error);
    res.status(500).json({
      error: 'Failed to update follow status',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    client.release();
  }
});

// Get creator's followers
router.get('/creator/:username/followers', async (req, res) => {
  const { username } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT u.username, u.profile_pic_url, f.created_at,
              CASE WHEN uos.is_online = true THEN true ELSE false END as is_online,
              uos.last_seen
       FROM followers f
       JOIN users creator ON f.creator_id = creator.id
       JOIN users u ON f.follower_id = u.supabase_id
       LEFT JOIN user_online_status uos ON u.supabase_id = uos.user_id
       WHERE creator.username = $1
       ORDER BY f.created_at DESC`,
      [username]
    );

    res.json({
      followers: result.rows,
      total: result.rows.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Get followers error:', error);
    res.status(500).json({
      error: 'Failed to get followers',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Update online status
router.post('/online-status', authenticateToken, async (req, res) => {
  const { isOnline } = req.body;
  
  try {
    await pool.query(
      `INSERT INTO user_online_status (user_id, is_online, last_seen, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET is_online = $2, last_seen = NOW(), updated_at = NOW()`,
      [req.user.supabase_id, isOnline || false]
    );

    res.json({
      success: true,
      isOnline: isOnline || false,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Update online status error:', error);
    res.status(500).json({
      error: 'Failed to update online status',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get public creator profile (no auth required)
router.get('/public/creator/:identifier', async (req, res) => {
  const { identifier } = req.params;
  
  try {
    // Check if identifier is a UUID or username
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    
    const query = isUUID
      ? `SELECT username, bio, profile_pic_url, banner_url, stream_price, video_price, voice_price, message_price, 
                created_at, total_sessions, total_earnings, state, country, supabase_id, interests, creator_type
         FROM users 
         WHERE (supabase_id = $1 OR id = $1) AND is_creator = TRUE`
      : `SELECT username, bio, profile_pic_url, banner_url, stream_price, video_price, voice_price, message_price, 
                created_at, total_sessions, total_earnings, state, country, supabase_id, interests, creator_type
         FROM users 
         WHERE username = $1 AND is_creator = TRUE`;
    
    const result = await pool.query(query, [identifier]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Creator not found',
        timestamp: new Date().toISOString()
      });
    }

    const creator = result.rows[0];

    // Get follower count using the creator's supabase_id
    const followerCount = await pool.query(
      'SELECT COUNT(*) as count FROM followers WHERE creator_id = $1',
      [creator.supabase_id]
    );

    res.json({
      creator: {
        username: creator.username,
        bio: creator.bio,
        profilePicUrl: creator.profile_pic_url,
        banner_url: creator.banner_url,
        streamPrice: parseFloat(creator.stream_price || 5.00),
        videoPrice: parseFloat(creator.video_price || 8.00),
        voicePrice: parseFloat(creator.voice_price || 6.00),
        messagePrice: parseFloat(creator.message_price || 2.00),
        totalSessions: creator.total_sessions || 0,
        totalEarnings: parseFloat(creator.total_earnings || 0),
        followerCount: parseInt(followerCount.rows[0].count),
        createdAt: creator.created_at
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Get public creator profile error:', error);
    res.status(500).json({
      error: 'Failed to get creator profile',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Send call request to creator
router.post('/sessions/call-request', authenticateToken, async (req, res) => {
  const { creatorId, sessionType, fanUsername, fanProfilePicUrl, fanBio, estimatedDuration } = req.body;
  const fanId = req.user.supabase_id;

  if (!creatorId || !sessionType) {
    return res.status(400).json({
      error: 'Creator ID and session type are required',
      timestamp: new Date().toISOString()
    });
  }

  if (!['video', 'voice'].includes(sessionType)) {
    return res.status(400).json({
      error: 'Session type must be video or voice',
      timestamp: new Date().toISOString()
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Find creator by username
    const creatorResult = await client.query(
      'SELECT supabase_id, username, video_price, voice_price FROM users WHERE username = $1 AND is_creator = TRUE',
      [creatorId]
    );

    if (creatorResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Creator not found',
        timestamp: new Date().toISOString()
      });
    }

    const creator = creatorResult.rows[0];
    const creatorSupabaseId = creator.supabase_id;

    // Check if creator is online (you could add an online status table)
    // For now, we'll assume they might be available

    // Create call request record
    const callRequestId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const callRequest = await client.query(
      `INSERT INTO call_requests (id, fan_id, creator_id, session_type, fan_username, fan_profile_pic_url, fan_bio, estimated_duration, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW())
       RETURNING *`,
      [
        callRequestId,
        fanId,
        creatorSupabaseId,
        sessionType,
        fanUsername,
        fanProfilePicUrl,
        fanBio,
        estimatedDuration || 10
      ]
    );

    await client.query('COMMIT');

    // Here you would typically send a WebSocket notification to the creator
    // For now, we'll create a notification record
    try {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, data, created_at, is_read)
         VALUES ($1, 'session_request', $2, $3, $4, NOW(), false)`,
        [
          creatorSupabaseId,
          `Incoming ${sessionType} call`,
          `@${fanUsername} wants to start a ${sessionType} call with you`,
          JSON.stringify({
            callRequestId: callRequestId,
            fanId: fanId,
            fanUsername: fanUsername,
            fanProfilePicUrl: fanProfilePicUrl,
            sessionType: sessionType,
            estimatedDuration: estimatedDuration
          })
        ]
      );
      logger.info(`✅ Call request notification created for creator ${creatorId}`);
    } catch (notificationError) {
      logger.warn('⚠️ Failed to create notification:', notificationError);
      // Don't fail the request if notification creation fails
    }

    logger.info(`✅ Call request created: ${callRequestId} from ${fanUsername} to ${creatorId}`);

    res.json({
      success: true,
      callRequestId: callRequestId,
      message: `Call request sent to @${creatorId}`,
      sessionType: sessionType,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('❌ Call request error:', error);
    res.status(500).json({
      error: 'Failed to send call request',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    client.release();
  }
});

// Accept or decline call request
router.post('/sessions/call-response', authenticateToken, async (req, res) => {
  const { callRequestId, action, channelName, sessionId } = req.body; // action: 'accept' | 'decline'
  const creatorId = req.user.supabase_id;

  if (!callRequestId || !action) {
    return res.status(400).json({
      error: 'Call request ID and action are required',
      timestamp: new Date().toISOString()
    });
  }

  if (!['accept', 'decline'].includes(action)) {
    return res.status(400).json({
      error: 'Action must be accept or decline',
      timestamp: new Date().toISOString()
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get call request
    const callRequestResult = await client.query(
      'SELECT * FROM call_requests WHERE id = $1 AND creator_id = $2 AND status = $3',
      [callRequestId, creatorId, 'pending']
    );

    if (callRequestResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Call request not found or already responded',
        timestamp: new Date().toISOString()
      });
    }

    const callRequest = callRequestResult.rows[0];

    // Update call request status
    await client.query(
      'UPDATE call_requests SET status = $1, responded_at = NOW() WHERE id = $2',
      [action === 'accept' ? 'accepted' : 'declined', callRequestId]
    );

    await client.query('COMMIT');

    // Send notification back to fan
    const responseMessage = action === 'accept' 
      ? `${callRequest.creator_username || 'Creator'} accepted your ${callRequest.session_type} call request!`
      : `${callRequest.creator_username || 'Creator'} declined your ${callRequest.session_type} call request`;

    try {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, data, created_at, is_read)
         VALUES ($1, $2, $3, $4, $5, NOW(), false)`,
        [
          callRequest.fan_id,
          `session_${action}`,
          `Call ${action}ed`,
          responseMessage,
          JSON.stringify({
            callRequestId: callRequestId,
            action: action,
            sessionType: callRequest.session_type,
            channelName: channelName,
            sessionId: sessionId
          })
        ]
      );
    } catch (notificationError) {
      logger.warn('⚠️ Failed to create response notification:', notificationError);
    }

    logger.info(`✅ Call request ${action}ed: ${callRequestId}`);

    res.json({
      success: true,
      action: action,
      callRequestId: callRequestId,
      message: `Call request ${action}ed successfully`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`❌ Call response error:`, error);
    res.status(500).json({
      error: `Failed to ${action} call request`,
      details: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    client.release();
  }
});

// Enhanced availability and creator management endpoints

// Update creator availability status
router.post('/availability', authenticateToken, async (req, res) => {
  try {
    const { status, lastSeenAt } = req.body;
    const userId = req.user.supabase_id;

    // Validate status
    const validStatuses = ['online', 'busy', 'away', 'dnd', 'offline'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        validStatuses
      });
    }

    // Update user availability
    const updateQuery = `
      UPDATE users 
      SET availability_status = $1, last_seen_at = $2, updated_at = NOW()
      WHERE supabase_id = $3
      RETURNING availability_status, last_seen_at
    `;

    const result = await pool.query(updateQuery, [status, lastSeenAt || new Date(), userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      status: result.rows[0].availability_status,
      lastSeenAt: result.rows[0].last_seen_at
    });

  } catch (error) {
    logger.error('Error updating availability status:', error);
    res.status(500).json({ error: 'Failed to update availability status' });
  }
});

// Get creator stats for dashboard
router.get('/creator-stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;

    // Get current queue count
    const queueQuery = `
      SELECT COUNT(*) as queue_count
      FROM call_queue cq
      WHERE cq.creator_id = $1 AND cq.status = 'waiting'
    `;

    // Get today's earnings and calls
    const todayQuery = `
      SELECT 
        COALESCE(SUM(tt.tokens_redeemed * 0.05), 0) as today_earnings,
        COUNT(DISTINCT s.id) as calls_today,
        COALESCE(SUM(s.duration_minutes), 0) as minutes_today
      FROM sessions s
      LEFT JOIN token_transactions tt ON s.id::text = tt.session_id
      WHERE s.creator_id = (SELECT id FROM users WHERE supabase_id = $1)
      AND s.start_time >= CURRENT_DATE
      AND s.end_time IS NOT NULL
    `;

    // Get active time today (approximate based on availability changes)
    const activeTimeQuery = `
      SELECT 
        COALESCE(
          EXTRACT(EPOCH FROM (NOW() - CURRENT_DATE)) / 3600, 0
        ) as active_hours
      FROM users 
      WHERE supabase_id = $1 
      AND availability_status IN ('online', 'busy')
    `;

    const [queueResult, todayResult, activeResult] = await Promise.all([
      pool.query(queueQuery, [userId]),
      pool.query(todayQuery, [userId]),
      pool.query(activeTimeQuery, [userId])
    ]);

    const stats = {
      queueCount: parseInt(queueResult.rows[0]?.queue_count || 0),
      todayEarnings: parseFloat(todayResult.rows[0]?.today_earnings || 0),
      callsToday: parseInt(todayResult.rows[0]?.calls_today || 0),
      activeTime: parseFloat(activeResult.rows[0]?.active_hours || 0)
    };

    res.json({ success: true, stats });

  } catch (error) {
    logger.error('Error fetching creator stats:', error);
    res.status(500).json({ error: 'Failed to fetch creator stats' });
  }
});

// Set creator preferences
router.post('/creator-preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const {
      customGreeting,
      minSessionDuration,
      maxSessionDuration,
      requireVerification,
      autoAcceptRegulars
    } = req.body;

    const updateQuery = `
      UPDATE users 
      SET 
        custom_greeting = COALESCE($1, custom_greeting),
        min_session_duration = COALESCE($2, min_session_duration),
        max_session_duration = COALESCE($3, max_session_duration),
        require_verification = COALESCE($4, require_verification),
        auto_accept_regulars = COALESCE($5, auto_accept_regulars),
        updated_at = NOW()
      WHERE supabase_id = $6
      RETURNING custom_greeting, min_session_duration, max_session_duration, 
               require_verification, auto_accept_regulars
    `;

    const result = await pool.query(updateQuery, [
      customGreeting,
      minSessionDuration,
      maxSessionDuration,
      requireVerification,
      autoAcceptRegulars,
      userId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      preferences: result.rows[0]
    });

  } catch (error) {
    logger.error('Error updating creator preferences:', error);
    res.status(500).json({ error: 'Failed to update creator preferences' });
  }
});

// Get creator preferences
router.get('/creator-preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;

    const prefQuery = `
      SELECT custom_greeting, min_session_duration, max_session_duration,
             require_verification, auto_accept_regulars
      FROM users 
      WHERE supabase_id = $1
    `;

    const result = await pool.query(prefQuery, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      preferences: result.rows[0]
    });

  } catch (error) {
    logger.error('Error fetching creator preferences:', error);
    res.status(500).json({ error: 'Failed to fetch creator preferences' });
  }
});

// Block/unblock user
router.post('/block-user', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;
    const { blockedUserId, reason, action = 'block' } = req.body;

    if (action === 'block') {
      const blockQuery = `
        INSERT INTO creator_blocked_users (creator_id, blocked_user_id, reason)
        VALUES ($1, $2, $3)
        ON CONFLICT (creator_id, blocked_user_id) DO UPDATE 
        SET reason = $3, created_at = NOW()
      `;
      
      await pool.query(blockQuery, [creatorId, blockedUserId, reason || 'No reason provided']);
      
      res.json({
        success: true,
        message: `User blocked successfully`
      });
    } else if (action === 'unblock') {
      const unblockQuery = `
        DELETE FROM creator_blocked_users 
        WHERE creator_id = $1 AND blocked_user_id = $2
      `;
      
      await pool.query(unblockQuery, [creatorId, blockedUserId]);
      
      res.json({
        success: true,
        message: `User unblocked successfully`
      });
    } else {
      return res.status(400).json({ error: 'Invalid action. Use "block" or "unblock"' });
    }

  } catch (error) {
    logger.error('Error managing blocked user:', error);
    res.status(500).json({ error: 'Failed to manage blocked user' });
  }
});

// Get blocked users list
router.get('/blocked-users', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;

    const blockedQuery = `
      SELECT cbu.*, u.username, u.profile_pic_url
      FROM creator_blocked_users cbu
      JOIN users u ON cbu.blocked_user_id = u.supabase_id
      WHERE cbu.creator_id = $1
      ORDER BY cbu.created_at DESC
    `;

    const result = await pool.query(blockedQuery, [creatorId]);

    res.json({
      success: true,
      blockedUsers: result.rows
    });

  } catch (error) {
    logger.error('Error fetching blocked users:', error);
    res.status(500).json({ error: 'Failed to fetch blocked users' });
  }
});

// Queue system endpoints

// Join call queue
router.post('/join-queue', authenticateToken, async (req, res) => {
  try {
    const fanId = req.user.supabase_id;
    const { creatorId, sessionType, estimatedDuration = 10 } = req.body;

    // Check if fan is already in queue for this creator
    const existingQuery = `
      SELECT id FROM call_queue 
      WHERE fan_id = $1 AND creator_id = $2 AND status = 'waiting'
    `;
    const existingResult = await pool.query(existingQuery, [fanId, creatorId]);

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: 'Already in queue for this creator' });
    }

    // Check if creator is available
    const creatorQuery = `
      SELECT availability_status FROM users WHERE supabase_id = $1
    `;
    const creatorResult = await pool.query(creatorQuery, [creatorId]);

    if (creatorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    const creatorStatus = creatorResult.rows[0].availability_status;
    if (creatorStatus === 'offline' || creatorStatus === 'dnd') {
      return res.status(400).json({ 
        error: 'Creator is not available',
        creatorStatus
      });
    }

    // Calculate estimated cost using dynamic pricing
    const pricingResponse = await pool.query(
      'SELECT * FROM calculate_dynamic_price($1, $2, $3)',
      [creatorId, sessionType, estimatedDuration]
    );
    const estimatedCost = Math.ceil(pricingResponse.rows[0].calculate_dynamic_price * estimatedDuration * 20);

    // Get current queue position
    const queuePositionQuery = `
      SELECT COALESCE(MAX(queue_position), 0) + 1 as next_position
      FROM call_queue 
      WHERE creator_id = $1 AND status = 'waiting'
    `;
    const positionResult = await pool.query(queuePositionQuery, [creatorId]);
    const queuePosition = positionResult.rows[0].next_position;

    // Add to queue
    const insertQuery = `
      INSERT INTO call_queue (
        creator_id, fan_id, session_type, estimated_duration,
        estimated_cost, queue_position, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'waiting')
      RETURNING id, queue_position
    `;

    const insertResult = await pool.query(insertQuery, [
      creatorId,
      fanId,
      sessionType,
      estimatedDuration,
      estimatedCost,
      queuePosition
    ]);

    // Calculate estimated wait time (5 minutes per person ahead)
    const estimatedWait = Math.max(0, (queuePosition - 1) * 5);

    // Get total queue count
    const totalQuery = `
      SELECT COUNT(*) as total FROM call_queue 
      WHERE creator_id = $1 AND status = 'waiting'
    `;
    const totalResult = await pool.query(totalQuery, [creatorId]);

    res.json({
      success: true,
      queueId: insertResult.rows[0].id,
      position: queuePosition,
      totalInQueue: parseInt(totalResult.rows[0].total),
      estimatedWait: estimatedWait,
      estimatedCost: estimatedCost
    });

  } catch (error) {
    logger.error('Error joining queue:', error);
    res.status(500).json({ error: 'Failed to join queue' });
  }
});

// Leave call queue
router.post('/leave-queue', authenticateToken, async (req, res) => {
  try {
    const fanId = req.user.supabase_id;
    const { queueId } = req.body;

    let deleteQuery;
    let queryParams;

    if (queueId) {
      deleteQuery = `
        DELETE FROM call_queue 
        WHERE id = $1 AND fan_id = $2 AND status = 'waiting'
        RETURNING creator_id, queue_position
      `;
      queryParams = [queueId, fanId];
    } else {
      deleteQuery = `
        DELETE FROM call_queue 
        WHERE fan_id = $1 AND status = 'waiting'
        RETURNING creator_id, queue_position
      `;
      queryParams = [fanId];
    }

    const result = await pool.query(deleteQuery, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found in queue' });
    }

    res.json({
      success: true,
      message: 'Left queue successfully'
    });

  } catch (error) {
    logger.error('Error leaving queue:', error);
    res.status(500).json({ error: 'Failed to leave queue' });
  }
});

// Get creator's current queue (creator only)
router.get('/queue', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;

    const queueQuery = `
      SELECT 
        cq.*,
        u.username as fan_username,
        u.profile_pic_url as fan_profile_pic_url,
        fe.loyalty_tier as fan_tier,
        EXTRACT(EPOCH FROM (NOW() - cq.created_at))/60 as wait_time
      FROM call_queue cq
      JOIN users u ON cq.fan_id = u.id
      LEFT JOIN fan_engagement fe ON fe.fan_id = u.id AND fe.creator_id = $1
      WHERE cq.creator_id = $1 AND cq.status = 'waiting'
      ORDER BY cq.queue_position ASC
    `;

    const result = await pool.query(queueQuery, [creatorId]);

    const queue = result.rows.map(row => ({
      id: row.id,
      fanId: row.fan_id,
      fanUsername: row.fan_username,
      fanProfilePicUrl: row.fan_profile_pic_url,
      fanTier: row.fan_tier || 'newcomer',
      sessionType: row.session_type,
      estimatedDuration: row.estimated_duration,
      estimatedCost: row.estimated_cost,
      queuePosition: row.queue_position,
      waitTime: Math.round(row.wait_time),
      createdAt: row.created_at
    }));

    res.json({
      success: true,
      queue: queue,
      totalWaiting: queue.length
    });

  } catch (error) {
    logger.error('Error fetching queue:', error);
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

// Call next person in queue (creator only)
router.post('/call-next', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;

    // Get next person in queue
    const nextQuery = `
      SELECT cq.*, u.username as fan_username
      FROM call_queue cq
      JOIN users u ON cq.fan_id = u.id
      WHERE cq.creator_id = $1 AND cq.status = 'waiting'
      ORDER BY cq.queue_position ASC
      LIMIT 1
    `;

    const nextResult = await pool.query(nextQuery, [creatorId]);

    if (nextResult.rows.length === 0) {
      return res.status(404).json({ error: 'No one in queue' });
    }

    const nextFan = nextResult.rows[0];

    // Update status to called
    const updateQuery = `
      UPDATE call_queue 
      SET status = 'called'
      WHERE id = $1
    `;

    await pool.query(updateQuery, [nextFan.id]);

    // Create call request
    const callRequestId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const callRequestQuery = `
      INSERT INTO call_requests (
        id, fan_id, creator_id, session_type, 
        fan_username, estimated_duration, estimated_cost,
        queue_id, priority_level, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
      RETURNING id
    `;

    await pool.query(callRequestQuery, [
      callRequestId,
      nextFan.fan_id,
      creatorId,
      nextFan.session_type,
      nextFan.fan_username,
      nextFan.estimated_duration,
      nextFan.estimated_cost,
      nextFan.id,
      'normal'
    ]);

    res.json({
      success: true,
      fanId: nextFan.fan_id,
      fanUsername: nextFan.fan_username,
      sessionType: nextFan.session_type,
      callRequestId: callRequestId
    });

  } catch (error) {
    logger.error('Error calling next person:', error);
    res.status(500).json({ error: 'Failed to call next person' });
  }
});

// Skip user in queue (creator only)
router.post('/skip-queue-user', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;
    const { queueId, reason = 'Skipped by creator' } = req.body;

    const updateQuery = `
      UPDATE call_queue 
      SET status = 'cancelled'
      WHERE id = $1 AND creator_id = $2 AND status = 'waiting'
      RETURNING fan_id, queue_position
    `;

    const result = await pool.query(updateQuery, [queueId, creatorId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Queue item not found' });
    }

    res.json({
      success: true,
      message: 'User skipped successfully'
    });

  } catch (error) {
    logger.error('Error skipping queue user:', error);
    res.status(500).json({ error: 'Failed to skip user' });
  }
});

// Get dynamic pricing
router.get('/dynamic-pricing', authenticateToken, async (req, res) => {
  try {
    const { creatorId, sessionType, duration = 10 } = req.query;
    const fanId = req.user.supabase_id;

    // Get dynamic pricing
    const pricingResult = await pool.query(
      'SELECT * FROM calculate_dynamic_price($1, $2, $3)',
      [creatorId, sessionType, duration]
    );

    const dynamicRate = pricingResult.rows[0].calculate_dynamic_price;

    // Get fan engagement for loyalty discount
    const fanEngagementQuery = `
      SELECT loyalty_tier, total_calls, total_spent
      FROM fan_engagement 
      WHERE fan_id = $1 AND creator_id = $2
    `;
    
    const engagementResult = await pool.query(fanEngagementQuery, [fanId, creatorId]);
    const engagement = engagementResult.rows[0];

    let loyaltyDiscount = 0;
    let fanTier = 'newcomer';

    if (engagement) {
      fanTier = engagement.loyalty_tier;
      switch (fanTier) {
        case 'regular':
          loyaltyDiscount = 0.05; // 5%
          break;
        case 'vip':
          loyaltyDiscount = 0.10; // 10%
          break;
        case 'legend':
          loyaltyDiscount = 0.15; // 15%
          break;
      }
    }

    const finalRate = dynamicRate * (1 - loyaltyDiscount);

    res.json({
      success: true,
      pricing: {
        baseRate: dynamicRate,
        finalRate: finalRate,
        peakMultiplier: 1.0, // This would be calculated in the SQL function
        demandMultiplier: 1.0, // This would be calculated in the SQL function
        loyaltyDiscount: loyaltyDiscount
      },
      fanTier: fanTier,
      loyaltyDiscount: loyaltyDiscount
    });

  } catch (error) {
    logger.error('Error calculating dynamic pricing:', error);
    res.status(500).json({ error: 'Failed to calculate pricing' });
  }
});

// Enhanced creator dashboard endpoint
// Get creator profile by ID (for dashboard)
router.get('/creator/:id', authenticateToken, async (req, res) => {
  try {
    const creatorIdOrUsername = req.params.id;
    
    // Check if it's a UUID or username
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(creatorIdOrUsername);
    
    // Get creator profile data
    const creatorQuery = `
      SELECT 
        u.id,
        u.supabase_id,
        u.username,
        u.display_name,
        u.email,
        u.profile_pic_url,
        u.bio,
        u.is_creator,
        u.is_verified,
        u.creator_type,
        u.video_price,
        u.voice_price,
        u.stream_price,
        u.message_price,
        u.availability_status,
        u.custom_greeting,
        u.min_session_duration,
        u.max_session_duration,
        u.require_verification,
        u.auto_accept_regulars,
        4.5 as average_rating,
        COALESCE(u.total_sessions, 0) as total_sessions,
        COALESCE(u.total_earnings, 0) as total_earnings,
        u.creator_token_balance,
        u.is_online,
        u.last_active,
        COUNT(DISTINCT f.user_id) as follower_count
      FROM users u
      LEFT JOIN follows f ON u.supabase_id = f.creator_id
      WHERE ${isUUID ? 'u.supabase_id = $1' : 'LOWER(u.username) = LOWER($1)'}
      GROUP BY u.id
    `;
    
    const result = await pool.query(creatorQuery, [creatorIdOrUsername]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Creator not found',
        timestamp: new Date().toISOString()
      });
    }
    
    const creator = result.rows[0];
    
    // Get additional stats
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT s.id) as total_calls,
        COALESCE(SUM(s.duration_minutes), 0) as total_minutes,
        4.5 as avg_rating,
        COUNT(DISTINCT s.fan_id) as unique_fans
      FROM sessions s
      WHERE s.creator_id = $1
      AND s.ended_at IS NOT NULL
    `;
    
    const statsResult = await pool.query(statsQuery, [creator.supabase_id]);
    const stats = statsResult.rows[0];
    
    res.json({
      success: true,
      data: {
        ...creator,
        stats: {
          total_calls: parseInt(stats.total_calls) || 0,
          total_minutes: parseInt(stats.total_minutes) || 0,
          avg_rating: parseFloat(stats.avg_rating) || 0,
          unique_fans: parseInt(stats.unique_fans) || 0
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error fetching creator profile:', error);
    res.status(500).json({ 
      error: 'Failed to fetch creator profile',
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/creator-dashboard', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;

    // Get today's stats
    const todayStatsQuery = `
      SELECT 
        COALESCE(SUM(tt.tokens_redeemed * 0.05), 0) as today_earnings,
        COUNT(DISTINCT s.id) as today_calls,
        COALESCE(SUM(s.duration_minutes), 0) as today_minutes,
        COALESCE(AVG(sr.rating), 0) as avg_rating,
        COUNT(DISTINCT s.fan_id) as unique_fans
      FROM sessions s
      LEFT JOIN token_transactions tt ON s.id::text = tt.session_id
      LEFT JOIN session_ratings sr ON s.id = sr.session_id
      WHERE s.creator_id = (SELECT id FROM users WHERE supabase_id = $1)
      AND s.start_time >= CURRENT_DATE
      AND s.end_time IS NOT NULL
    `;

    // Get week stats with growth calculation
    const weekStatsQuery = `
      SELECT 
        COALESCE(SUM(tt.tokens_redeemed * 0.05), 0) as week_earnings,
        COUNT(DISTINCT s.id) as week_calls,
        COALESCE(SUM(s.duration_minutes), 0) as week_minutes
      FROM sessions s
      LEFT JOIN token_transactions tt ON s.id::text = tt.session_id
      WHERE s.creator_id = (SELECT id FROM users WHERE supabase_id = $1)
      AND s.start_time >= CURRENT_DATE - INTERVAL '7 days'
      AND s.end_time IS NOT NULL
    `;

    // Get last week stats for growth comparison
    const lastWeekStatsQuery = `
      SELECT 
        COALESCE(SUM(tt.tokens_redeemed * 0.05), 0) as last_week_earnings
      FROM sessions s
      LEFT JOIN token_transactions tt ON s.id::text = tt.session_id
      WHERE s.creator_id = (SELECT id FROM users WHERE supabase_id = $1)
      AND s.start_time >= CURRENT_DATE - INTERVAL '14 days'
      AND s.start_time < CURRENT_DATE - INTERVAL '7 days'
      AND s.end_time IS NOT NULL
    `;

    // Get top fans
    const topFansQuery = `
      SELECT 
        fe.fan_id,
        u.username,
        u.profile_pic_url,
        fe.total_calls,
        fe.total_spent,
        fe.loyalty_tier
      FROM fan_engagement fe
      JOIN users u ON fe.fan_id = u.id
      WHERE fe.creator_id = $1
      ORDER BY fe.total_spent DESC
      LIMIT 5
    `;

    // Get recent activities (recent sessions with earnings)
    const recentActivitiesQuery = `
      SELECT 
        s.id,
        s.start_time,
        s.end_time,
        s.duration_minutes,
        s.type as session_type,
        u.username as fan_username,
        COALESCE(tt.tokens_redeemed * 0.05, 0) as amount,
        EXTRACT(EPOCH FROM (NOW() - s.start_time)) / 3600 as hours_ago
      FROM sessions s
      JOIN users u ON s.fan_id = u.id
      LEFT JOIN token_transactions tt ON s.id::text = tt.session_id
      WHERE s.creator_id = (SELECT id FROM users WHERE supabase_id = $1)
      AND s.end_time IS NOT NULL
      ORDER BY s.start_time DESC
      LIMIT 10
    `;

    const [
      todayResult,
      weekResult,
      lastWeekResult,
      topFansResult,
      activitiesResult
    ] = await Promise.all([
      pool.query(todayStatsQuery, [creatorId]),
      pool.query(weekStatsQuery, [creatorId]),
      pool.query(lastWeekStatsQuery, [creatorId]),
      pool.query(topFansQuery, [creatorId]),
      pool.query(recentActivitiesQuery, [creatorId])
    ]);

    const todayStats = todayResult.rows[0];
    const weekStats = weekResult.rows[0];
    const lastWeekStats = lastWeekResult.rows[0];

    // Calculate growth percentage
    const growth = lastWeekStats.last_week_earnings > 0 
      ? ((weekStats.week_earnings - lastWeekStats.last_week_earnings) / lastWeekStats.last_week_earnings) * 100
      : 0;

    // Format activities
    const recentActivities = activitiesResult.rows.map(activity => ({
      description: `${activity.session_type} call with @${activity.fan_username}`,
      amount: parseFloat(activity.amount).toFixed(2),
      timeAgo: activity.hours_ago < 1 
        ? `${Math.round(activity.hours_ago * 60)} minutes ago`
        : activity.hours_ago < 24 
          ? `${Math.round(activity.hours_ago)} hours ago`
          : `${Math.round(activity.hours_ago / 24)} days ago`,
      fanUsername: activity.fan_username
    }));

    // Sample goals (in a real app, these would come from a goals table)
    const upcomingGoals = [
      {
        title: 'Weekly Earnings Goal',
        progress: Math.min(100, (weekStats.week_earnings / 500) * 100),
        current: weekStats.week_earnings,
        target: 500,
        timeRemaining: '3 days left'
      },
      {
        title: 'Monthly Calls Goal',
        progress: Math.min(100, (todayStats.today_calls / 100) * 100),
        current: todayStats.today_calls,
        target: 100,
        timeRemaining: '15 days left'
      }
    ];

    const dashboard = {
      todayStats: {
        earnings: parseFloat(todayStats.today_earnings || 0),
        calls: parseInt(todayStats.today_calls || 0),
        minutes: parseInt(todayStats.today_minutes || 0),
        avgRating: parseFloat(todayStats.avg_rating || 0),
        uniqueFans: parseInt(todayStats.unique_fans || 0)
      },
      weekStats: {
        earnings: parseFloat(weekStats.week_earnings || 0),
        calls: parseInt(weekStats.week_calls || 0),
        minutes: parseInt(weekStats.week_minutes || 0),
        growth: Math.round(growth * 100) / 100
      },
      topFans: topFansResult.rows.map(fan => ({
        username: fan.username,
        profilePicUrl: fan.profile_pic_url,
        totalCalls: fan.total_calls,
        totalSpent: parseFloat(fan.total_spent).toFixed(2),
        loyaltyTier: fan.loyalty_tier
      })),
      recentActivities: recentActivities,
      upcomingGoals: upcomingGoals,
      peakHours: [] // This would be calculated from peak hours data
    };

    res.json({
      success: true,
      dashboard: dashboard
    });

  } catch (error) {
    logger.error('Error fetching creator dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Get user's call recordings
router.get('/recordings', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        cr.*,
        COALESCE(u_partner.username, 'Unknown User') as partner_username,
        u_partner.profile_pic_url as partner_profile_pic_url
      FROM call_recordings cr
      LEFT JOIN users u_partner ON (
        (cr.creator_id = $1 AND cr.fan_id = u_partner.id) OR 
        (cr.fan_id = (SELECT id FROM users WHERE supabase_id = $1) AND cr.creator_id = u_partner.id)
      )
      WHERE cr.creator_id = (SELECT id FROM users WHERE supabase_id = $1) 
         OR cr.fan_id = (SELECT id FROM users WHERE supabase_id = $1)
      ORDER BY cr.created_at DESC
    `;
    
    const result = await pool.query(query, [req.user.supabase_id]);
    
    res.json({
      success: true,
      recordings: result.rows.map(row => ({
        id: row.id,
        sessionId: row.session_id,
        sessionType: row.session_type,
        fileUrl: row.file_url,
        fileName: row.file_name,
        fileSize: row.file_size,
        duration: row.duration,
        createdAt: row.created_at,
        partnerUsername: row.partner_username,
        partnerProfilePicUrl: row.partner_profile_pic_url,
        consentGiven: row.consent_given,
        isPrivate: row.is_private
      }))
    });
  } catch (error) {
    logger.error('Error fetching recordings:', error);
    res.status(500).json({
      error: 'Failed to fetch recordings',
      timestamp: new Date().toISOString()
    });
  }
});

// Upload a call recording
router.post('/upload-recording', authenticateToken, upload.single('recording'), async (req, res) => {
  try {
    const { sessionId, sessionType } = req.body;
    const file = req.file;

    if (!file || !sessionId || !sessionType) {
      return res.status(400).json({
        error: 'Missing required fields: recording file, sessionId, and sessionType',
        timestamp: new Date().toISOString()
      });
    }

    // Get session details
    const sessionQuery = `
      SELECT s.*, 
             u_creator.id as creator_db_id, 
             u_fan.id as fan_db_id
      FROM sessions s
      JOIN users u_creator ON s.creator_id = u_creator.id
      JOIN users u_fan ON s.fan_id = u_fan.id
      WHERE s.id = $1
    `;
    
    const sessionResult = await pool.query(sessionQuery, [sessionId]);
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Session not found',
        timestamp: new Date().toISOString()
      });
    }

    const session = sessionResult.rows[0];
    
    // Check if user is participant in this session
    if (session.creator_id !== req.user.supabase_id && session.fan_id !== req.user.supabase_id) {
      return res.status(403).json({
        error: 'Unauthorized: You can only upload recordings for your own sessions',
        timestamp: new Date().toISOString()
      });
    }

    // Generate unique filename
    const fileName = `recording_${sessionId}_${Date.now()}.webm`;
    const fileUrl = `/uploads/recordings/${fileName}`;
    
    // Move file to permanent storage (in production, use cloud storage)
    const fs = require('fs').promises;
    const path = require('path');
const { logger } = require('../utils/secureLogger');
    
    const uploadsDir = path.join(__dirname, '../uploads/recordings');
    await fs.mkdir(uploadsDir, { recursive: true });
    
    const permanentPath = path.join(uploadsDir, fileName);
    await fs.rename(file.path, permanentPath);

    // Get file duration (simplified - in production use proper video analysis)
    const duration = Math.floor(Math.random() * 1800) + 300; // Mock duration 5-35 minutes

    // Save recording metadata to database
    const insertQuery = `
      INSERT INTO call_recordings (
        session_id, session_type, creator_id, fan_id, 
        file_url, file_name, file_size, duration, consent_given
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const result = await pool.query(insertQuery, [
      sessionId,
      sessionType,
      session.creator_db_id,
      session.fan_db_id,
      fileUrl,
      fileName,
      file.size,
      duration,
      true // Assume consent was given if recording was uploaded
    ]);

    res.json({
      success: true,
      recording: {
        id: result.rows[0].id,
        sessionId: result.rows[0].session_id,
        fileUrl: result.rows[0].file_url,
        fileName: result.rows[0].file_name,
        duration: result.rows[0].duration
      }
    });
  } catch (error) {
    logger.error('Error uploading recording:', error);
    res.status(500).json({
      error: 'Failed to upload recording',
      timestamp: new Date().toISOString()
    });
  }
});

// Delete a call recording
router.delete('/recordings/:recordingId', authenticateToken, async (req, res) => {
  try {
    const { recordingId } = req.params;
    
    // Check if user owns this recording
    const checkQuery = `
      SELECT cr.*, cr.file_name
      FROM call_recordings cr
      JOIN users u_creator ON cr.creator_id = u_creator.id
      JOIN users u_fan ON cr.fan_id = u_fan.id
      WHERE cr.id = $1 
        AND (u_creator.supabase_id = $2 OR u_fan.supabase_id = $2)
    `;
    
    const checkResult = await pool.query(checkQuery, [recordingId, req.user.supabase_id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Recording not found or unauthorized',
        timestamp: new Date().toISOString()
      });
    }

    const recording = checkResult.rows[0];

    // Delete file from storage
    const fs = require('fs').promises;
    const path = require('path');
    const filePath = path.join(__dirname, '../uploads/recordings', recording.file_name);
    
    try {
      await fs.unlink(filePath);
    } catch (fileError) {
      logger.warn('Could not delete file:', fileError.message);
    }

    // Delete from database
    await pool.query('DELETE FROM call_recordings WHERE id = $1', [recordingId]);

    res.json({
      success: true,
      message: 'Recording deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting recording:', error);
    res.status(500).json({
      error: 'Failed to delete recording',
      timestamp: new Date().toISOString()
    });
  }
});

// Update recording privacy settings
router.patch('/recordings/:recordingId/privacy', authenticateToken, async (req, res) => {
  try {
    const { recordingId } = req.params;
    const { isPrivate } = req.body;
    
    // Check if user owns this recording
    const checkQuery = `
      SELECT 1 FROM call_recordings cr
      JOIN users u_creator ON cr.creator_id = u_creator.id
      JOIN users u_fan ON cr.fan_id = u_fan.id
      WHERE cr.id = $1 
        AND (u_creator.supabase_id = $2 OR u_fan.supabase_id = $2)
    `;
    
    const checkResult = await pool.query(checkQuery, [recordingId, req.user.supabase_id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Recording not found or unauthorized',
        timestamp: new Date().toISOString()
      });
    }

    // Update privacy setting
    await pool.query(
      'UPDATE call_recordings SET is_private = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [isPrivate, recordingId]
    );

    res.json({
      success: true,
      message: 'Privacy setting updated successfully'
    });
  } catch (error) {
    logger.error('Error updating recording privacy:', error);
    res.status(500).json({
      error: 'Failed to update privacy setting',
      timestamp: new Date().toISOString()
    });
  }
});

// Get recording consent status for a session
router.get('/recording-consent/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const query = `
      SELECT recording_consent_creator, recording_consent_fan
      FROM sessions 
      WHERE id = $1 
        AND (creator_id = $2 OR fan_id = $2)
    `;
    
    const result = await pool.query(query, [sessionId, req.user.supabase_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Session not found or unauthorized',
        timestamp: new Date().toISOString()
      });
    }

    const session = result.rows[0];
    
    res.json({
      success: true,
      consent: {
        creator: session.recording_consent_creator,
        fan: session.recording_consent_fan,
        bothConsented: session.recording_consent_creator && session.recording_consent_fan
      }
    });
  } catch (error) {
    logger.error('Error fetching recording consent:', error);
    res.status(500).json({
      error: 'Failed to fetch recording consent',
      timestamp: new Date().toISOString()
    });
  }
});

// Update recording consent for a session
router.post('/recording-consent', authenticateToken, async (req, res) => {
  try {
    const { sessionId, consent } = req.body;
    
    if (typeof consent !== 'boolean') {
      return res.status(400).json({
        error: 'Consent must be a boolean value',
        timestamp: new Date().toISOString()
      });
    }

    // Get session details
    const sessionQuery = `
      SELECT creator_id, fan_id 
      FROM sessions 
      WHERE id = $1
    `;
    
    const sessionResult = await pool.query(sessionQuery, [sessionId]);
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Session not found',
        timestamp: new Date().toISOString()
      });
    }

    const session = sessionResult.rows[0];
    
    // Determine if user is creator or fan
    let updateField;
    if (session.creator_id === req.user.supabase_id) {
      updateField = 'recording_consent_creator';
    } else if (session.fan_id === req.user.supabase_id) {
      updateField = 'recording_consent_fan';
    } else {
      return res.status(403).json({
        error: 'Unauthorized: You are not a participant in this session',
        timestamp: new Date().toISOString()
      });
    }

    // Update consent
    const updateQuery = `
      UPDATE sessions 
      SET ${updateField} = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2
      RETURNING recording_consent_creator, recording_consent_fan
    `;
    
    const result = await pool.query(updateQuery, [consent, sessionId]);
    const updated = result.rows[0];

    res.json({
      success: true,
      consent: {
        creator: updated.recording_consent_creator,
        fan: updated.recording_consent_fan,
        bothConsented: updated.recording_consent_creator && updated.recording_consent_fan
      }
    });
  } catch (error) {
    logger.error('Error updating recording consent:', error);
    res.status(500).json({
      error: 'Failed to update recording consent',
      timestamp: new Date().toISOString()
    });
  }
});

// Get user notifications
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const query = `
      SELECT 
        n.*,
        COALESCE(u_sender.username, 'System') as sender_username,
        u_sender.profile_pic_url as sender_profile_pic_url
      FROM notifications n
      LEFT JOIN users u_sender ON n.sender_id = u_sender.supabase_id
      WHERE n.user_id = (SELECT id FROM users WHERE supabase_id = $1)
      ORDER BY n.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const countQuery = `
      SELECT COUNT(*) as total, 
             COUNT(*) FILTER (WHERE read = false) as unread_count
      FROM notifications 
      WHERE user_id = (SELECT id FROM users WHERE supabase_id = $1)
    `;
    
    const [notificationsResult, countResult] = await Promise.all([
      pool.query(query, [req.user.supabase_id, limit, offset]),
      pool.query(countQuery, [req.user.supabase_id])
    ]);
    
    const notifications = notificationsResult.rows.map(row => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      read: row.read,
      createdAt: row.created_at,
      actionUrl: row.action_url,
      actionText: row.action_text,
      actionData: row.action_data ? JSON.parse(row.action_data) : null,
      senderUsername: row.sender_username,
      senderProfilePicUrl: row.sender_profile_pic_url
    }));

    res.json({
      success: true,
      notifications,
      total: parseInt(countResult.rows[0].total),
      unreadCount: parseInt(countResult.rows[0].unread_count)
    });
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    res.status(500).json({
      error: 'Failed to fetch notifications',
      timestamp: new Date().toISOString()
    });
  }
});

// Mark notification as read
router.post('/notifications/:notificationId/read', authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const result = await pool.query(
      `UPDATE notifications 
       SET read = true, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND user_id = (SELECT id FROM users WHERE supabase_id = $2)
       RETURNING *`,
      [notificationId, req.user.supabase_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Notification not found',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    res.status(500).json({
      error: 'Failed to mark notification as read',
      timestamp: new Date().toISOString()
    });
  }
});

// Mark all notifications as read
router.post('/notifications/mark-all-read', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications 
       SET read = true, updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = (SELECT id FROM users WHERE supabase_id = $1) AND read = false`,
      [req.user.supabase_id]
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    res.status(500).json({
      error: 'Failed to mark all notifications as read',
      timestamp: new Date().toISOString()
    });
  }
});

// Send notification to user
router.post('/send-notification', authenticateToken, async (req, res) => {
  try {
    const {
      targetUserId,
      type,
      title,
      body,
      actionUrl,
      actionText,
      actionData
    } = req.body;

    if (!targetUserId || !type || !title || !body) {
      return res.status(400).json({
        error: 'Missing required fields: targetUserId, type, title, body',
        timestamp: new Date().toISOString()
      });
    }

    // Get sender and target user IDs
    const senderQuery = `SELECT id FROM users WHERE supabase_id = $1`;
    const targetQuery = `SELECT id FROM users WHERE supabase_id = $1`;
    
    const [senderResult, targetResult] = await Promise.all([
      pool.query(senderQuery, [req.user.supabase_id]),
      pool.query(targetQuery, [targetUserId])
    ]);

    if (targetResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Target user not found',
        timestamp: new Date().toISOString()
      });
    }

    const senderId = senderResult.rows[0]?.id;
    const targetUserDbId = targetResult.rows[0].id;

    // Insert notification
    const insertQuery = `
      INSERT INTO notifications (
        user_id, sender_id, type, title, body, 
        action_url, action_text, action_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const result = await pool.query(insertQuery, [
      targetUserDbId,
      senderId,
      type,
      title,
      body,
      actionUrl,
      actionText,
      actionData ? JSON.stringify(actionData) : null
    ]);

    const notification = result.rows[0];

    // Here you would typically send the notification via WebSocket to the target user
    // For now, we'll just return success

    res.json({
      success: true,
      notification: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body
      }
    });
  } catch (error) {
    logger.error('Error sending notification:', error);
    res.status(500).json({
      error: 'Failed to send notification',
      timestamp: new Date().toISOString()
    });
  }
});

// Delete notification
router.delete('/notifications/:notificationId', authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const result = await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = (SELECT id FROM users WHERE supabase_id = $2)',
      [notificationId, req.user.supabase_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Notification not found',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    logger.error('Error deleting notification:', error);
    res.status(500).json({
      error: 'Failed to delete notification',
      timestamp: new Date().toISOString()
    });
  }
});

// Get notification settings
router.get('/notification-settings', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT * FROM notification_settings 
      WHERE user_id = (SELECT id FROM users WHERE supabase_id = $1)
    `;
    
    const result = await pool.query(query, [req.user.supabase_id]);
    
    if (result.rows.length === 0) {
      // Return default settings
      res.json({
        success: true,
        settings: {
          callRequests: true,
          queueUpdates: true,
          tokenUpdates: true,
          earnings: true,
          fanInteractions: true,
          systemUpdates: true,
          soundEnabled: true,
          desktopNotifications: true
        }
      });
    } else {
      const settings = result.rows[0];
      res.json({
        success: true,
        settings: {
          callRequests: settings.call_requests,
          queueUpdates: settings.queue_updates,
          tokenUpdates: settings.token_updates,
          earnings: settings.earnings,
          fanInteractions: settings.fan_interactions,
          systemUpdates: settings.system_updates,
          soundEnabled: settings.sound_enabled,
          desktopNotifications: settings.desktop_notifications
        }
      });
    }
  } catch (error) {
    logger.error('Error fetching notification settings:', error);
    res.status(500).json({
      error: 'Failed to fetch notification settings',
      timestamp: new Date().toISOString()
    });
  }
});

// Update notification settings
router.post('/notification-settings', authenticateToken, async (req, res) => {
  try {
    const {
      callRequests,
      queueUpdates,
      tokenUpdates,
      earnings,
      fanInteractions,
      systemUpdates,
      soundEnabled,
      desktopNotifications
    } = req.body;

    const userIdQuery = `SELECT id FROM users WHERE supabase_id = $1`;
    const userResult = await pool.query(userIdQuery, [req.user.supabase_id]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    const userId = userResult.rows[0].id;

    const upsertQuery = `
      INSERT INTO notification_settings (
        user_id, call_requests, queue_updates, token_updates,
        earnings, fan_interactions, system_updates, 
        sound_enabled, desktop_notifications
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (user_id) DO UPDATE SET
        call_requests = EXCLUDED.call_requests,
        queue_updates = EXCLUDED.queue_updates,
        token_updates = EXCLUDED.token_updates,
        earnings = EXCLUDED.earnings,
        fan_interactions = EXCLUDED.fan_interactions,
        system_updates = EXCLUDED.system_updates,
        sound_enabled = EXCLUDED.sound_enabled,
        desktop_notifications = EXCLUDED.desktop_notifications,
        updated_at = CURRENT_TIMESTAMP
    `;

    await pool.query(upsertQuery, [
      userId, callRequests, queueUpdates, tokenUpdates,
      earnings, fanInteractions, systemUpdates,
      soundEnabled, desktopNotifications
    ]);

    res.json({
      success: true,
      message: 'Notification settings updated'
    });
  } catch (error) {
    logger.error('Error updating notification settings:', error);
    res.status(500).json({
      error: 'Failed to update notification settings',
      timestamp: new Date().toISOString()
    });
  }
});

// Get creator protection settings
router.get('/protection-settings', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT * FROM creator_protection_settings 
      WHERE creator_id = (SELECT id FROM users WHERE supabase_id = $1)
    `;
    
    const result = await pool.query(query, [req.user.supabase_id]);
    
    if (result.rows.length === 0) {
      // Return default settings
      res.json({
        success: true,
        settings: {
          autoModeration: true,
          profanityFilter: true,
          requireApproval: false,
          blockAnonymous: false,
          minimumAccountAge: 0,
          restrictNewUsers: false,
          allowScreenshots: true,
          allowRecording: true,
          timeoutDuration: 5,
          maxWarnings: 3
        }
      });
    } else {
      const settings = result.rows[0];
      res.json({
        success: true,
        settings: {
          autoModeration: settings.auto_moderation,
          profanityFilter: settings.profanity_filter,
          requireApproval: settings.require_approval,
          blockAnonymous: settings.block_anonymous,
          minimumAccountAge: settings.minimum_account_age,
          restrictNewUsers: settings.restrict_new_users,
          allowScreenshots: settings.allow_screenshots,
          allowRecording: settings.allow_recording,
          timeoutDuration: settings.timeout_duration,
          maxWarnings: settings.max_warnings
        }
      });
    }
  } catch (error) {
    logger.error('Error fetching protection settings:', error);
    res.status(500).json({
      error: 'Failed to fetch protection settings',
      timestamp: new Date().toISOString()
    });
  }
});

// Update creator protection settings
router.post('/protection-settings', authenticateToken, async (req, res) => {
  try {
    const {
      autoModeration,
      profanityFilter,
      requireApproval,
      blockAnonymous,
      minimumAccountAge,
      restrictNewUsers,
      allowScreenshots,
      allowRecording,
      timeoutDuration,
      maxWarnings
    } = req.body;

    const userIdQuery = `SELECT id FROM users WHERE supabase_id = $1 AND is_creator = TRUE`;
    const userResult = await pool.query(userIdQuery, [req.user.supabase_id]);
    
    if (userResult.rows.length === 0) {
      return res.status(403).json({
        error: 'Only creators can update protection settings',
        timestamp: new Date().toISOString()
      });
    }

    const userId = userResult.rows[0].id;

    const upsertQuery = `
      INSERT INTO creator_protection_settings (
        creator_id, auto_moderation, profanity_filter, require_approval,
        block_anonymous, minimum_account_age, restrict_new_users,
        allow_screenshots, allow_recording, timeout_duration, max_warnings
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (creator_id) DO UPDATE SET
        auto_moderation = EXCLUDED.auto_moderation,
        profanity_filter = EXCLUDED.profanity_filter,
        require_approval = EXCLUDED.require_approval,
        block_anonymous = EXCLUDED.block_anonymous,
        minimum_account_age = EXCLUDED.minimum_account_age,
        restrict_new_users = EXCLUDED.restrict_new_users,
        allow_screenshots = EXCLUDED.allow_screenshots,
        allow_recording = EXCLUDED.allow_recording,
        timeout_duration = EXCLUDED.timeout_duration,
        max_warnings = EXCLUDED.max_warnings,
        updated_at = CURRENT_TIMESTAMP
    `;

    await pool.query(upsertQuery, [
      userId, autoModeration, profanityFilter, requireApproval,
      blockAnonymous, minimumAccountAge || 0, restrictNewUsers,
      allowScreenshots, allowRecording, timeoutDuration || 5, maxWarnings || 3
    ]);

    res.json({
      success: true,
      message: 'Protection settings updated'
    });
  } catch (error) {
    logger.error('Error updating protection settings:', error);
    res.status(500).json({
      error: 'Failed to update protection settings',
      timestamp: new Date().toISOString()
    });
  }
});

// Block a user
router.post('/block-user', authenticateToken, async (req, res) => {
  try {
    const { targetUserId, reason = '' } = req.body;

    if (!targetUserId) {
      return res.status(400).json({
        error: 'Target user ID is required',
        timestamp: new Date().toISOString()
      });
    }

    // Get user IDs
    const blockerQuery = `SELECT id FROM users WHERE supabase_id = $1`;
    const targetQuery = `SELECT id FROM users WHERE supabase_id = $1`;
    
    const [blockerResult, targetResult] = await Promise.all([
      pool.query(blockerQuery, [req.user.supabase_id]),
      pool.query(targetQuery, [targetUserId])
    ]);

    if (blockerResult.rows.length === 0 || targetResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    const blockerId = blockerResult.rows[0].id;
    const targetUserDbId = targetResult.rows[0].id;

    // Insert block record
    const insertQuery = `
      INSERT INTO user_blocks (blocker_id, blocked_id, reason) 
      VALUES ($1, $2, $3)
      ON CONFLICT (blocker_id, blocked_id) DO NOTHING
    `;
    
    await pool.query(insertQuery, [blockerId, targetUserDbId, reason]);

    res.json({
      success: true,
      message: 'User blocked successfully'
    });
  } catch (error) {
    logger.error('Error blocking user:', error);
    res.status(500).json({
      error: 'Failed to block user',
      timestamp: new Date().toISOString()
    });
  }
});

// Unblock a user
router.post('/unblock-user', authenticateToken, async (req, res) => {
  try {
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({
        error: 'Target user ID is required',
        timestamp: new Date().toISOString()
      });
    }

    const deleteQuery = `
      DELETE FROM user_blocks 
      WHERE blocker_id = (SELECT id FROM users WHERE supabase_id = $1) 
        AND blocked_id = (SELECT id FROM users WHERE supabase_id = $2)
    `;
    
    const result = await pool.query(deleteQuery, [req.user.supabase_id, targetUserId]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Block record not found',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'User unblocked successfully'
    });
  } catch (error) {
    logger.error('Error unblocking user:', error);
    res.status(500).json({
      error: 'Failed to unblock user',
      timestamp: new Date().toISOString()
    });
  }
});

// Get blocked users
router.get('/blocked-users', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        ub.*,
        u_blocked.supabase_id as user_id,
        u_blocked.username,
        u_blocked.profile_pic_url
      FROM user_blocks ub
      JOIN users u_blocked ON ub.blocked_id = u_blocked.id
      WHERE ub.blocker_id = (SELECT id FROM users WHERE supabase_id = $1)
      ORDER BY ub.created_at DESC
    `;
    
    const result = await pool.query(query, [req.user.supabase_id]);
    
    const blockedUsers = result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      username: row.username,
      profilePicUrl: row.profile_pic_url,
      reason: row.reason,
      blockedAt: row.created_at
    }));

    res.json({
      success: true,
      blockedUsers
    });
  } catch (error) {
    logger.error('Error fetching blocked users:', error);
    res.status(500).json({
      error: 'Failed to fetch blocked users',
      timestamp: new Date().toISOString()
    });
  }
});

// Report a user
router.post('/report-user', authenticateToken, async (req, res) => {
  try {
    const { targetUserId, reason, details = '' } = req.body;

    if (!targetUserId || !reason) {
      return res.status(400).json({
        error: 'Target user ID and reason are required',
        timestamp: new Date().toISOString()
      });
    }

    // Get user IDs
    const reporterQuery = `SELECT id FROM users WHERE supabase_id = $1`;
    const targetQuery = `SELECT id FROM users WHERE supabase_id = $1`;
    
    const [reporterResult, targetResult] = await Promise.all([
      pool.query(reporterQuery, [req.user.supabase_id]),
      pool.query(targetQuery, [targetUserId])
    ]);

    if (reporterResult.rows.length === 0 || targetResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    const reporterId = reporterResult.rows[0].id;
    const targetUserDbId = targetResult.rows[0].id;

    // Insert report
    const insertQuery = `
      INSERT INTO user_reports (reporter_id, reported_id, reason, details) 
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const result = await pool.query(insertQuery, [reporterId, targetUserDbId, reason, details]);

    res.json({
      success: true,
      report: {
        id: result.rows[0].id,
        reason: result.rows[0].reason,
        status: result.rows[0].status
      }
    });
  } catch (error) {
    logger.error('Error reporting user:', error);
    res.status(500).json({
      error: 'Failed to report user',
      timestamp: new Date().toISOString()
    });
  }
});

// Get user reports
router.get('/reports', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        ur.*,
        u_reported.username as target_username,
        u_reported.profile_pic_url as target_profile_pic_url
      FROM user_reports ur
      JOIN users u_reported ON ur.reported_id = u_reported.id
      WHERE ur.reporter_id = (SELECT id FROM users WHERE supabase_id = $1)
      ORDER BY ur.created_at DESC
    `;
    
    const result = await pool.query(query, [req.user.supabase_id]);
    
    const reports = result.rows.map(row => ({
      id: row.id,
      targetUsername: row.target_username,
      targetProfilePicUrl: row.target_profile_pic_url,
      reason: row.reason,
      details: row.details,
      status: row.status,
      createdAt: row.created_at
    }));

    res.json({
      success: true,
      reports
    });
  } catch (error) {
    logger.error('Error fetching reports:', error);
    res.status(500).json({
      error: 'Failed to fetch reports',
      timestamp: new Date().toISOString()
    });
  }
});

// Give warning to user
router.post('/give-warning', authenticateToken, async (req, res) => {
  try {
    const { targetUserId, reason } = req.body;

    if (!targetUserId || !reason) {
      return res.status(400).json({
        error: 'Target user ID and reason are required',
        timestamp: new Date().toISOString()
      });
    }

    // Check if user is creator
    const creatorQuery = `SELECT id FROM users WHERE supabase_id = $1 AND is_creator = TRUE`;
    const creatorResult = await pool.query(creatorQuery, [req.user.supabase_id]);
    
    if (creatorResult.rows.length === 0) {
      return res.status(403).json({
        error: 'Only creators can issue warnings',
        timestamp: new Date().toISOString()
      });
    }

    // Get target user ID
    const targetQuery = `SELECT id FROM users WHERE supabase_id = $1`;
    const targetResult = await pool.query(targetQuery, [targetUserId]);

    if (targetResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Target user not found',
        timestamp: new Date().toISOString()
      });
    }

    const creatorId = creatorResult.rows[0].id;
    const targetUserDbId = targetResult.rows[0].id;

    // Insert warning
    const insertQuery = `
      INSERT INTO user_warnings (creator_id, target_id, reason) 
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const result = await pool.query(insertQuery, [creatorId, targetUserDbId, reason]);

    res.json({
      success: true,
      warning: {
        id: result.rows[0].id,
        reason: result.rows[0].reason
      }
    });
  } catch (error) {
    logger.error('Error giving warning:', error);
    res.status(500).json({
      error: 'Failed to give warning',
      timestamp: new Date().toISOString()
    });
  }
});

// Get issued warnings
router.get('/warnings', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        uw.*,
        u_target.username as target_username,
        u_target.profile_pic_url as target_profile_pic_url
      FROM user_warnings uw
      JOIN users u_target ON uw.target_id = u_target.id
      WHERE uw.creator_id = (SELECT id FROM users WHERE supabase_id = $1)
      ORDER BY uw.created_at DESC
    `;
    
    const result = await pool.query(query, [req.user.supabase_id]);
    
    const warnings = result.rows.map(row => ({
      id: row.id,
      targetUsername: row.target_username,
      targetProfilePicUrl: row.target_profile_pic_url,
      reason: row.reason,
      createdAt: row.created_at
    }));

    res.json({
      success: true,
      warnings
    });
  } catch (error) {
    logger.error('Error fetching warnings:', error);
    res.status(500).json({
      error: 'Failed to fetch warnings',
      timestamp: new Date().toISOString()
    });
  }
});

// Timeout user (temporary restriction)
router.post('/timeout-user', authenticateToken, async (req, res) => {
  try {
    const { targetUserId, duration = 5 } = req.body;

    if (!targetUserId) {
      return res.status(400).json({
        error: 'Target user ID is required',
        timestamp: new Date().toISOString()
      });
    }

    // Check if user is creator
    const creatorQuery = `SELECT id FROM users WHERE supabase_id = $1 AND is_creator = TRUE`;
    const creatorResult = await pool.query(creatorQuery, [req.user.supabase_id]);
    
    if (creatorResult.rows.length === 0) {
      return res.status(403).json({
        error: 'Only creators can timeout users',
        timestamp: new Date().toISOString()
      });
    }

    // Get target user ID
    const targetQuery = `SELECT id FROM users WHERE supabase_id = $1`;
    const targetResult = await pool.query(targetQuery, [targetUserId]);

    if (targetResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Target user not found',
        timestamp: new Date().toISOString()
      });
    }

    const creatorId = creatorResult.rows[0].id;
    const targetUserDbId = targetResult.rows[0].id;
    const expiresAt = new Date(Date.now() + duration * 60000); // Convert minutes to milliseconds

    // Insert timeout
    const insertQuery = `
      INSERT INTO user_timeouts (creator_id, target_id, duration_minutes, expires_at) 
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (creator_id, target_id) DO UPDATE SET
        duration_minutes = EXCLUDED.duration_minutes,
        expires_at = EXCLUDED.expires_at,
        created_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const result = await pool.query(insertQuery, [creatorId, targetUserDbId, duration, expiresAt]);

    res.json({
      success: true,
      timeout: {
        id: result.rows[0].id,
        duration: result.rows[0].duration_minutes,
        expiresAt: result.rows[0].expires_at
      }
    });
  } catch (error) {
    logger.error('Error timing out user:', error);
    res.status(500).json({
      error: 'Failed to timeout user',
      timestamp: new Date().toISOString()
    });
  }
});

// Get fan engagement data for a specific creator (from fan perspective)
router.get('/fan-engagement/:creatorId?', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.params.creatorId;
    
    if (!creatorId) {
      return res.status(400).json({
        error: 'Creator ID is required',
        timestamp: new Date().toISOString()
      });
    }

    const fanId = req.user.supabase_id;
    
    const query = `
      SELECT 
        fe.*,
        u_fan.created_at as fan_joined_date,
        COALESCE(
          (SELECT COUNT(*) FROM sessions WHERE fan_id = $1 AND creator_id = (SELECT id FROM users WHERE supabase_id = $2)),
          0
        ) as total_sessions,
        COALESCE(
          (SELECT SUM(duration_minutes) FROM sessions WHERE fan_id = $1 AND creator_id = (SELECT id FROM users WHERE supabase_id = $2)),
          0
        ) as total_minutes,
        COALESCE(
          (SELECT SUM(amount_spent) FROM sessions WHERE fan_id = $1 AND creator_id = (SELECT id FROM users WHERE supabase_id = $2)),
          0
        ) as total_spent,
        COALESCE(
          (SELECT AVG(duration_minutes) FROM sessions WHERE fan_id = $1 AND creator_id = (SELECT id FROM users WHERE supabase_id = $2)),
          0
        ) as avg_session_duration
      FROM fan_engagement fe
      JOIN users u_fan ON fe.fan_id = u_fan.id
      WHERE fe.fan_id = (SELECT id FROM users WHERE supabase_id = $1) 
        AND fe.creator_id = (SELECT id FROM users WHERE supabase_id = $2)
    `;
    
    const result = await pool.query(query, [fanId, creatorId]);
    
    let engagement = {
      loyaltyTier: 'newcomer',
      totalSpent: 0,
      totalSessions: 0,
      totalMinutes: 0,
      streakDays: 0,
      lastInteraction: null,
      joinedDate: null,
      favoriteSessionType: 'video',
      averageSessionDuration: 0,
      totalTips: 0,
      badgesEarned: [],
      levelProgress: 0
    };

    if (result.rows.length > 0) {
      const data = result.rows[0];
      engagement = {
        loyaltyTier: data.loyalty_tier || 'newcomer',
        totalSpent: parseFloat(data.total_spent) || 0,
        totalSessions: parseInt(data.total_sessions) || 0,
        totalMinutes: parseInt(data.total_minutes) || 0,
        streakDays: parseInt(data.streak_days) || 0,
        lastInteraction: data.last_interaction,
        joinedDate: data.fan_joined_date,
        favoriteSessionType: data.favorite_session_type || 'video',
        averageSessionDuration: parseFloat(data.avg_session_duration) || 0,
        totalTips: parseFloat(data.total_tips) || 0,
        badgesEarned: data.badges_earned ? JSON.parse(data.badges_earned) : [],
        levelProgress: parseInt(data.level_progress) || 0
      };
    }

    // Get available rewards
    const rewardsQuery = `
      SELECT * FROM loyalty_rewards 
      WHERE creator_id = (SELECT id FROM users WHERE supabase_id = $1)
        AND required_tier <= (
          SELECT 
            CASE 
              WHEN loyalty_tier = 'newcomer' THEN 0
              WHEN loyalty_tier = 'regular' THEN 1  
              WHEN loyalty_tier = 'vip' THEN 2
              WHEN loyalty_tier = 'legend' THEN 3
              ELSE 0
            END
          FROM fan_engagement 
          WHERE fan_id = (SELECT id FROM users WHERE supabase_id = $2) 
            AND creator_id = (SELECT id FROM users WHERE supabase_id = $1)
        )
        AND active = true
      ORDER BY required_tier ASC
    `;
    
    const rewardsResult = await pool.query(rewardsQuery, [creatorId, fanId]);
    const rewards = rewardsResult.rows;

    res.json({
      success: true,
      engagement,
      rewards,
      achievements: [] // Could be expanded with actual achievements system
    });
  } catch (error) {
    logger.error('Error fetching fan engagement:', error);
    res.status(500).json({
      error: 'Failed to fetch fan engagement data',
      timestamp: new Date().toISOString()
    });
  }
});

// Get fan engagement overview for creators
router.get('/fan-engagement-overview', authenticateToken, async (req, res) => {
  try {
    // Check if user is creator
    const creatorQuery = `SELECT id FROM users WHERE supabase_id = $1 AND is_creator = TRUE`;
    const creatorResult = await pool.query(creatorQuery, [req.user.supabase_id]);
    
    if (creatorResult.rows.length === 0) {
      return res.status(403).json({
        error: 'Only creators can access fan engagement overview',
        timestamp: new Date().toISOString()
      });
    }

    const creatorDbId = creatorResult.rows[0].id;

    // Get top fans
    const topFansQuery = `
      SELECT 
        fe.*,
        u.supabase_id as user_id,
        u.username,
        u.profile_pic_url,
        COALESCE(
          (SELECT COUNT(*) FROM sessions WHERE fan_id = fe.fan_id AND creator_id = $1),
          0
        ) as total_calls,
        COALESCE(
          (SELECT SUM(duration_minutes) FROM sessions WHERE fan_id = fe.fan_id AND creator_id = $1),
          0
        ) as total_minutes
      FROM fan_engagement fe
      JOIN users u ON fe.fan_id = u.id
      WHERE fe.creator_id = $1
      ORDER BY fe.total_spent DESC, fe.total_sessions DESC
      LIMIT 10
    `;
    
    const topFansResult = await pool.query(topFansQuery, [creatorDbId]);
    
    const topFans = topFansResult.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      username: row.username,
      profilePicUrl: row.profile_pic_url,
      loyaltyTier: row.loyalty_tier,
      totalSpent: parseFloat(row.total_spent),
      totalCalls: parseInt(row.total_calls),
      totalMinutes: parseInt(row.total_minutes),
      lastInteraction: row.last_interaction
    }));

    // Get fan statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_fans,
        COUNT(*) FILTER (WHERE loyalty_tier IN ('vip', 'legend')) as vip_fans,
        AVG(total_spent) as average_spend,
        COUNT(*) FILTER (WHERE streak_days > 0) as active_streaks,
        COUNT(*) FILTER (WHERE loyalty_tier = 'newcomer') as newcomer_fans,
        COUNT(*) FILTER (WHERE loyalty_tier = 'regular') as regular_fans,
        COUNT(*) FILTER (WHERE loyalty_tier = 'vip') as vip_fans_count,
        COUNT(*) FILTER (WHERE loyalty_tier = 'legend') as legend_fans
      FROM fan_engagement 
      WHERE creator_id = $1
    `;
    
    const statsResult = await pool.query(statsQuery, [creatorDbId]);
    const stats = statsResult.rows[0];

    const fanStats = {
      totalFans: parseInt(stats.total_fans) || 0,
      vipFans: parseInt(stats.vip_fans) || 0,
      averageSpend: parseFloat(stats.average_spend) || 0,
      activeStreaks: parseInt(stats.active_streaks) || 0,
      tierBreakdown: {
        newcomer: parseInt(stats.newcomer_fans) || 0,
        regular: parseInt(stats.regular_fans) || 0,
        vip: parseInt(stats.vip_fans_count) || 0,
        legend: parseInt(stats.legend_fans) || 0
      }
    };

    res.json({
      success: true,
      topFans,
      fanStats
    });
  } catch (error) {
    logger.error('Error fetching fan engagement overview:', error);
    res.status(500).json({
      error: 'Failed to fetch fan engagement overview',
      timestamp: new Date().toISOString()
    });
  }
});

// Update fan engagement after session
router.post('/update-fan-engagement', authenticateToken, async (req, res) => {
  try {
    const { 
      fanId, 
      creatorId, 
      sessionType, 
      duration, 
      amountSpent, 
      tipAmount = 0 
    } = req.body;

    if (!fanId || !creatorId || !sessionType || !duration || amountSpent === undefined) {
      return res.status(400).json({
        error: 'Missing required fields',
        timestamp: new Date().toISOString()
      });
    }

    // Get database IDs
    const fanDbQuery = `SELECT id FROM users WHERE supabase_id = $1`;
    const creatorDbQuery = `SELECT id FROM users WHERE supabase_id = $1 AND is_creator = TRUE`;
    
    const [fanResult, creatorResult] = await Promise.all([
      pool.query(fanDbQuery, [fanId]),
      pool.query(creatorDbQuery, [creatorId])
    ]);

    if (fanResult.rows.length === 0 || creatorResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Fan or creator not found',
        timestamp: new Date().toISOString()
      });
    }

    const fanDbId = fanResult.rows[0].id;
    const creatorDbId = creatorResult.rows[0].id;

    // Update or create fan engagement record
    const upsertQuery = `
      INSERT INTO fan_engagement (
        fan_id, creator_id, total_spent, total_sessions, total_minutes,
        total_tips, favorite_session_type, last_interaction
      ) VALUES ($1, $2, $3, 1, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (fan_id, creator_id) DO UPDATE SET
        total_spent = fan_engagement.total_spent + EXCLUDED.total_spent,
        total_sessions = fan_engagement.total_sessions + 1,
        total_minutes = fan_engagement.total_minutes + EXCLUDED.total_minutes,
        total_tips = fan_engagement.total_tips + EXCLUDED.total_tips,
        favorite_session_type = EXCLUDED.favorite_session_type,
        last_interaction = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const result = await pool.query(upsertQuery, [
      fanDbId, creatorDbId, amountSpent, duration, tipAmount, sessionType
    ]);

    const engagement = result.rows[0];

    // Calculate and update loyalty tier based on total spent
    let newTier = 'newcomer';
    const totalSpent = parseFloat(engagement.total_spent);
    
    if (totalSpent >= 500) newTier = 'legend';
    else if (totalSpent >= 200) newTier = 'vip';
    else if (totalSpent >= 50) newTier = 'regular';

    // Update loyalty tier if changed
    if (engagement.loyalty_tier !== newTier) {
      await pool.query(
        'UPDATE fan_engagement SET loyalty_tier = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newTier, engagement.id]
      );
    }

    res.json({
      success: true,
      engagement: {
        id: engagement.id,
        loyaltyTier: newTier,
        totalSpent: parseFloat(engagement.total_spent),
        totalSessions: parseInt(engagement.total_sessions),
        totalMinutes: parseInt(engagement.total_minutes)
      }
    });
  } catch (error) {
    logger.error('Error updating fan engagement:', error);
    res.status(500).json({
      error: 'Failed to update fan engagement',
      timestamp: new Date().toISOString()
    });
  }
});

// Award badge to fan
router.post('/award-badge', authenticateToken, async (req, res) => {
  try {
    const { fanId, badgeKey, reason = '' } = req.body;

    if (!fanId || !badgeKey) {
      return res.status(400).json({
        error: 'Fan ID and badge key are required',
        timestamp: new Date().toISOString()
      });
    }

    // Check if user is creator
    const creatorQuery = `SELECT id FROM users WHERE supabase_id = $1 AND is_creator = TRUE`;
    const creatorResult = await pool.query(creatorQuery, [req.user.supabase_id]);
    
    if (creatorResult.rows.length === 0) {
      return res.status(403).json({
        error: 'Only creators can award badges',
        timestamp: new Date().toISOString()
      });
    }

    const creatorDbId = creatorResult.rows[0].id;

    // Get fan's engagement record
    const fanQuery = `
      SELECT fe.* FROM fan_engagement fe
      JOIN users u ON fe.fan_id = u.id
      WHERE u.supabase_id = $1 AND fe.creator_id = $2
    `;
    
    const fanResult = await pool.query(fanQuery, [fanId, creatorDbId]);
    
    if (fanResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Fan engagement record not found',
        timestamp: new Date().toISOString()
      });
    }

    const engagement = fanResult.rows[0];
    let badgesEarned = engagement.badges_earned ? JSON.parse(engagement.badges_earned) : [];
    
    // Add badge if not already earned
    if (!badgesEarned.includes(badgeKey)) {
      badgesEarned.push(badgeKey);
      
      await pool.query(
        'UPDATE fan_engagement SET badges_earned = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [JSON.stringify(badgesEarned), engagement.id]
      );
    }

    res.json({
      success: true,
      badgesEarned
    });
  } catch (error) {
    logger.error('Error awarding badge:', error);
    res.status(500).json({
      error: 'Failed to award badge',
      timestamp: new Date().toISOString()
    });
  }
});

// Creator application submission endpoint
router.post('/apply-creator', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const {
      bio,
      specialties,
      experience,
      socialMedia,
      pricing,
      availability,
      agreeToTerms,
      over18
    } = req.body;

    // Input validation
    if (!bio || bio.trim().length === 0) {
      return res.status(400).json({
        error: 'Bio is required',
        timestamp: new Date().toISOString()
      });
    }

    if (bio.length > 500) {
      return res.status(400).json({
        error: 'Bio must be 500 characters or less',
        timestamp: new Date().toISOString()
      });
    }

    if (!specialties || !Array.isArray(specialties) || specialties.length === 0) {
      return res.status(400).json({
        error: 'At least one specialty is required',
        timestamp: new Date().toISOString()
      });
    }

    if (!experience || experience.trim().length === 0) {
      return res.status(400).json({
        error: 'Experience level is required',
        timestamp: new Date().toISOString()
      });
    }

    if (!pricing || !pricing.videoCall || !pricing.voiceCall || !pricing.privateStream) {
      return res.status(400).json({
        error: 'All pricing fields are required',
        timestamp: new Date().toISOString()
      });
    }

    // Validate pricing ranges (1-500 tokens per minute)
    const pricingFields = ['videoCall', 'voiceCall', 'privateStream'];
    for (const field of pricingFields) {
      if (pricing[field] < 1 || pricing[field] > 500) {
        return res.status(400).json({
          error: `${field} pricing must be between 1-500 tokens per minute`,
          timestamp: new Date().toISOString()
        });
      }
    }

    if (!agreeToTerms || !over18) {
      return res.status(400).json({
        error: 'You must agree to terms and confirm you are 18+',
        timestamp: new Date().toISOString()
      });
    }

    // Check if user exists
    const userQuery = 'SELECT id, is_creator FROM users WHERE supabase_id = $1';
    const userResult = await pool.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    const user = userResult.rows[0];
    
    if (user.is_creator) {
      return res.status(400).json({
        error: 'You are already a creator',
        timestamp: new Date().toISOString()
      });
    }

    // Check for existing pending application
    const existingQuery = `
      SELECT id FROM creator_applications 
      WHERE user_id = $1 AND status = 'pending'
    `;
    const existingResult = await pool.query(existingQuery, [userId]);
    
    if (existingResult.rows.length > 0) {
      return res.status(400).json({
        error: 'You already have a pending application',
        timestamp: new Date().toISOString()
      });
    }

    // Create application
    const insertQuery = `
      INSERT INTO creator_applications (
        user_id,
        bio,
        specialties,
        experience,
        social_media,
        pricing,
        availability,
        status,
        submitted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())
      RETURNING id, status, submitted_at
    `;

    const values = [
      userId,
      bio.trim(),
      JSON.stringify(specialties),
      experience,
      JSON.stringify(socialMedia || {}),
      JSON.stringify(pricing),
      JSON.stringify(availability || {}),
    ];

    const result = await pool.query(insertQuery, values);
    const application = result.rows[0];

    // Log the application submission
    logger.info(`Creator application submitted by user ${userId} at ${new Date().toISOString()}`);

    res.status(201).json({
      success: true,
      message: 'Creator application submitted successfully',
      application: {
        id: application.id,
        status: application.status,
        submittedAt: application.submitted_at
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error submitting creator application:', error);
    res.status(500).json({
      error: 'Failed to submit application',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get creator analytics
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id || req.user.uid;
    
    // Check if user is a creator
    const userQuery = await pool.query(
      'SELECT is_creator FROM users WHERE supabase_id = $1',
      [userId]
    );
    
    if (userQuery.rows.length === 0 || !userQuery.rows[0].is_creator) {
      return res.status(403).json({
        error: 'Creator access required',
        timestamp: new Date().toISOString()
      });
    }
    
    // Get analytics data
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Get earnings analytics
    const earningsQuery = await pool.query(`
      SELECT 
        COUNT(DISTINCT s.id) as total_sessions,
        SUM(s.total_tokens) as total_tokens_earned,
        SUM(s.total_tokens * 0.05) as total_earnings,
        AVG(s.duration_minutes) as avg_session_duration,
        COUNT(DISTINCT s.fan_id) as unique_members
      FROM sessions s
      WHERE s.creator_id IN (SELECT id FROM users WHERE supabase_id = $1)
        AND s.created_at >= $2
        AND s.status = 'completed'
    `, [userId, thirtyDaysAgo]);
    
    // Get subscriber count
    const subscribersQuery = await pool.query(`
      SELECT COUNT(*) as subscriber_count
      FROM creator_subscriptions
      WHERE creator_id IN (SELECT id FROM users WHERE supabase_id = $1)
        AND status = 'active'
    `, [userId]);
    
    // Get recent sessions
    const recentSessionsQuery = await pool.query(`
      SELECT 
        s.id,
        s.session_type,
        s.duration_minutes,
        s.total_tokens,
        s.created_at,
        u.username as member_username,
        u.profile_pic_url as member_profile_pic
      FROM sessions s
      JOIN users u ON u.id = s.fan_id
      WHERE s.creator_id IN (SELECT id FROM users WHERE supabase_id = $1)
      ORDER BY s.created_at DESC
      LIMIT 10
    `, [userId]);
    
    // Get tips received
    const tipsQuery = await pool.query(`
      SELECT 
        COUNT(*) as tip_count,
        SUM(amount) as total_tips
      FROM tips
      WHERE recipient_id = $1
        AND created_at >= $2
    `, [userId, thirtyDaysAgo]);
    
    const analytics = {
      earnings: {
        totalSessions: parseInt(earningsQuery.rows[0].total_sessions || 0),
        totalTokensEarned: parseFloat(earningsQuery.rows[0].total_tokens_earned || 0),
        totalEarnings: parseFloat(earningsQuery.rows[0].total_earnings || 0),
        avgSessionDuration: parseFloat(earningsQuery.rows[0].avg_session_duration || 0),
        uniqueMembers: parseInt(earningsQuery.rows[0].unique_members || 0)
      },
      subscribers: {
        count: parseInt(subscribersQuery.rows[0].subscriber_count || 0)
      },
      tips: {
        count: parseInt(tipsQuery.rows[0].tip_count || 0),
        totalAmount: parseFloat(tipsQuery.rows[0].total_tips || 0)
      },
      recentSessions: recentSessionsQuery.rows,
      period: {
        start: thirtyDaysAgo,
        end: now
      }
    };
    
    res.json({
      success: true,
      analytics,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error fetching analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch analytics',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get list of users the current user is following
router.get('/following', authenticateToken, async (req, res) => {
  const userId = req.user.supabase_id;
  const { limit = 50, offset = 0 } = req.query;

  try {
    const result = await db.query(
      `SELECT 
        u.id,
        u.username,
        u.profile_pic_url,
        u.bio,
        u.is_creator,
        u.video_price,
        u.voice_price,
        u.stream_price,
        f.created_at as followed_at,
        CASE 
          WHEN u.last_seen > NOW() - INTERVAL '5 minutes' THEN true 
          ELSE false 
        END as is_online
      FROM follows f
      JOIN users u ON f.followed_id = u.id
      WHERE f.follower_id = $1
      ORDER BY f.created_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    // Get follower counts for privacy
    const followedIds = result.rows.map(u => u.id);
    const followerCounts = {};
    
    if (followedIds.length > 0) {
      const countResult = await db.query(
        `SELECT followed_id, COUNT(*) as count
         FROM follows
         WHERE followed_id = ANY($1)
         GROUP BY followed_id`,
        [followedIds]
      );
      
      countResult.rows.forEach(row => {
        followerCounts[row.followed_id] = parseInt(row.count);
      });
    }

    // Add follower count only for creators
    const following = result.rows.map(user => ({
      ...user,
      followerCount: user.is_creator ? (followerCounts[user.id] || 0) : undefined
    }));

    res.json({
      following,
      count: following.length
    });

  } catch (error) {
    logger.error('Error fetching following list:', error);
    res.status(500).json({ error: 'Failed to fetch following list' });
  }
});

// Get activity from users the current user is following
router.get('/following/activity', authenticateToken, async (req, res) => {
  const userId = req.user.supabase_id;
  const { limit = 20, offset = 0 } = req.query;

  try {
    // Get recent activity from followed users
    const result = await db.query(
      `SELECT 
        a.id,
        a.type,
        a.creator_id,
        a.metadata,
        a.created_at,
        u.username,
        u.profile_pic_url,
        u.is_creator
      FROM (
        -- Live streams
        SELECT 
          'stream' as type,
          s.id,
          s.creator_id,
          jsonb_build_object(
            'title', s.title,
            'viewers', s.viewer_count,
            'is_live', s.is_live
          ) as metadata,
          s.created_at
        FROM streams s
        WHERE s.creator_id IN (
          SELECT followed_id FROM follows WHERE follower_id = $1
        )
        AND s.created_at > NOW() - INTERVAL '7 days'
        
        UNION ALL
        
        -- New content
        SELECT 
          'content' as type,
          c.id,
          c.creator_id,
          jsonb_build_object(
            'content_type', c.content_type,
            'title', c.title,
            'price', c.price
          ) as metadata,
          c.created_at
        FROM content c
        WHERE c.creator_id IN (
          SELECT followed_id FROM follows WHERE follower_id = $1
        )
        AND c.created_at > NOW() - INTERVAL '7 days'
        
        UNION ALL
        
        -- Profile updates
        SELECT 
          'profile_update' as type,
          u.id,
          u.id as creator_id,
          jsonb_build_object(
            'update_type', 'profile'
          ) as metadata,
          u.updated_at as created_at
        FROM users u
        WHERE u.id IN (
          SELECT followed_id FROM follows WHERE follower_id = $1
        )
        AND u.updated_at > NOW() - INTERVAL '7 days'
        AND u.updated_at > u.created_at + INTERVAL '1 hour'
      ) a
      JOIN users u ON a.creator_id = u.id
      ORDER BY a.created_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({
      activity: result.rows
    });

  } catch (error) {
    logger.error('Error fetching following activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// Follow a user
router.post('/:userId/follow', authenticateToken, async (req, res) => {
  const followerId = req.user.supabase_id;
  const followedId = parseInt(req.params.userId);

  if (followerId === followedId) {
    return res.status(400).json({ error: 'Cannot follow yourself' });
  }

  try {
    // Check if user exists
    const userResult = await db.query(
      'SELECT id, username FROM users WHERE supabase_id = $1',
      [followedId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already following
    const existingFollow = await db.query(
      'SELECT id FROM follows WHERE follower_id = $1 AND followed_id = $2',
      [followerId, followedId]
    );

    if (existingFollow.rows.length > 0) {
      return res.status(400).json({ error: 'Already following this user' });
    }

    // Create follow relationship
    await db.query(
      'INSERT INTO follows (follower_id, followed_id) VALUES ($1, $2)',
      [followerId, followedId]
    );

    // Send notification to followed user
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        followedId,
        'new_follower',
        'New follower',
        `${req.user.username} started following you`,
        JSON.stringify({
          followerId,
          followerUsername: req.user.username
        })
      ]
    );

    logger.info('User followed', { followerId, followedId });

    res.json({
      success: true,
      message: 'Successfully followed user'
    });

  } catch (error) {
    logger.error('Error following user:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

// Unfollow a user
router.delete('/:userId/follow', authenticateToken, async (req, res) => {
  const followerId = req.user.supabase_id;
  const followedId = parseInt(req.params.userId);

  try {
    const result = await db.query(
      'DELETE FROM follows WHERE follower_id = $1 AND followed_id = $2 RETURNING id',
      [followerId, followedId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not following this user' });
    }

    logger.info('User unfollowed', { followerId, followedId });

    res.json({
      success: true,
      message: 'Successfully unfollowed user'
    });

  } catch (error) {
    logger.error('Error unfollowing user:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// Check if current user follows a specific user
router.get('/:userId/follow-status', authenticateToken, async (req, res) => {
  const followerId = req.user.supabase_id;
  const followedId = parseInt(req.params.userId);

  try {
    const result = await db.query(
      'SELECT id FROM follows WHERE follower_id = $1 AND followed_id = $2',
      [followerId, followedId]
    );

    res.json({
      isFollowing: result.rows.length > 0
    });

  } catch (error) {
    logger.error('Error checking follow status:', error);
    res.status(500).json({ error: 'Failed to check follow status' });
  }
});

// Get user stats (followers, content, etc.)
router.get('/:username/stats', authenticateToken, async (req, res) => {
  try {
    const { username } = req.params;
    
    // Get user ID from username
    const userQuery = await pool.query(
      'SELECT supabase_id FROM users WHERE username = $1',
      [username]
    );
    
    if (userQuery.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userQuery.rows[0].supabase_id;
    
    // Get stats from materialized view
    const statsQuery = await pool.query(
      `SELECT 
        followers,
        total_content as posts,
        total_likes as likes,
        total_views as totalViews,
        joined_date as joinedDate,
        total_pictures,
        total_videos,
        total_sessions,
        total_tips_received
       FROM creator_stats 
       WHERE creator_id = $1`,
      [userId]
    );
    
    if (statsQuery.rows.length === 0) {
      // Fallback to calculating stats directly
      const fallbackStats = await pool.query(
        `SELECT
          (SELECT COUNT(*) FROM follows WHERE creator_id = $1) as followers,
          (SELECT COUNT(*) FROM content WHERE creator_id = $1) as posts,
          (SELECT COALESCE(SUM(likes), 0) FROM content WHERE creator_id = $1) as likes,
          (SELECT COALESCE(SUM(views), 0) FROM content WHERE creator_id = $1) as totalViews,
          (SELECT created_at FROM users WHERE supabase_id = $1) as joinedDate`,
        [userId]
      );
      
      return res.json(fallbackStats.rows[0]);
    }
    
    res.json(statsQuery.rows[0]);
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get profile data with cards and achievements
router.get('/profile/:username', authenticateToken, async (req, res) => {
  try {
    const { username } = req.params;
    const profile = await pool.query(
      `SELECT u.supabase_id, u.username, u.display_name, u.bio, u.profile_pic_url,
         u.created_at as member_since, u.is_creator,
         (SELECT COUNT(*) FROM cards WHERE user_id = u.supabase_id) as cards_owned,
         (SELECT COUNT(*) FROM card_trades WHERE from_user_id = u.supabase_id AND status = 'completed') as cards_traded,
         (SELECT COUNT(*) FROM gift_transactions WHERE sender_id = u.supabase_id) as gifts_sent,
         (SELECT COALESCE(SUM(value), 0) FROM cards WHERE user_id = u.supabase_id) as total_value,
         (SELECT COUNT(*) FROM followers WHERE creator_id = u.supabase_id) as followers_count,
         (SELECT COUNT(*) FROM followers WHERE follower_id = u.supabase_id) as following_count,
         (SELECT json_agg(json_build_object(
           'id', c.id,
           'creator_name', c.creator_name,
           'card_number', c.card_number,
           'rarity', c.rarity,
           'category', c.category,
           'value', c.value,
           'acquired_at', c.acquired_at
         )) FROM cards c WHERE c.user_id = u.supabase_id) as cards,
         (SELECT json_agg(json_build_object(
           'id', a.id,
           'type', a.type,
           'title', a.title,
           'description', a.description,
           'icon', a.icon,
           'earned_at', a.earned_at
         )) FROM achievements a WHERE a.user_id = u.supabase_id) as achievements
       FROM users u WHERE username = $1`,
      [username]
    );

    if (profile.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profileData = profile.rows[0];
    
    res.json({
      ...profileData,
      stats: {
        cards_owned: parseInt(profileData.cards_owned || 0),
        cards_traded: parseInt(profileData.cards_traded || 0),
        gifts_sent: parseInt(profileData.gifts_sent || 0),
        total_value: parseInt(profileData.total_value || 0),
        followers_count: parseInt(profileData.followers_count || 0),
        following_count: parseInt(profileData.following_count || 0)
      }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

module.exports = router;