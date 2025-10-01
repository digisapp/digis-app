const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath = path.join(__dirname, '../uploads/');
    if (file.mimetype.startsWith('image/')) {
      uploadPath = path.join(uploadPath, 'pictures/');
    } else if (file.mimetype.startsWith('video/')) {
      uploadPath = path.join(uploadPath, 'videos/');
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed!'), false);
    }
  }
});

// Get creator's content - PUBLIC ENDPOINT
router.get('/creator/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const userId = null; // Public endpoint, no auth required

    // Check if identifier is a UUID or username
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    
    // Get creator info
    const creatorQuery = await pool.query(
      isUUID 
        ? 'SELECT id, supabase_id, username, display_name, profile_pic_url, bio, is_creator, what_i_offer, availability FROM users WHERE supabase_id = $1'
        : 'SELECT id, supabase_id, username, display_name, profile_pic_url, bio, is_creator, what_i_offer, availability FROM users WHERE username = $1',
      [identifier]
    );

    if (creatorQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    const creator = creatorQuery.rows[0];

    if (!creator.is_creator) {
      return res.status(403).json({ error: 'User is not a creator' });
    }

    // For now, return empty arrays since the table doesn't exist
    // In production, you would create the creator_content table first
    const contentQuery = { rows: [] };
    
    // Query actual content from database
    const picturesQuery = await pool.query(
      `SELECT 
        id, 
        content_type, 
        title, 
        description, 
        thumbnail_url, 
        content_url, 
        price, 
        views, 
        likes, 
        created_at
      FROM creator_content 
      WHERE creator_id = $1 AND content_type = 'picture'
      ORDER BY created_at DESC`,
      [creator.id]
    );
    
    const videosQuery = await pool.query(
      `SELECT 
        id, 
        content_type, 
        title, 
        description, 
        thumbnail_url, 
        content_url, 
        price, 
        duration,
        views, 
        likes, 
        created_at
      FROM creator_content 
      WHERE creator_id = $1 AND content_type = 'video'
      ORDER BY created_at DESC`,
      [creator.id]
    );

    // Use real data from database (empty arrays if no content)
    const pictures = picturesQuery.rows || [];
    const videos = videosQuery.rows || [];

    res.json({
      creator: {
        id: creator.id,
        username: creator.username,
        displayName: creator.display_name,
        profilePic: creator.profile_pic_url,
        bio: creator.bio,
        whatIOffer: creator.what_i_offer,
        availability: creator.availability
      },
      pictures,
      videos
    });

  } catch (error) {
    console.error('Error fetching creator content:', error);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

// Purchase content
router.post('/purchase', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const userId = req.user.supabase_id;
    const { contentId, contentType, price } = req.body;

    // Verify content exists and get details
    const contentQuery = await client.query(
      'SELECT * FROM creator_content WHERE id = $1 AND is_active = true',
      [contentId]
    );

    if (contentQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Content not found' });
    }

    const content = contentQuery.rows[0];

    // Check if already purchased
    const purchaseCheck = await client.query(
      'SELECT id FROM content_purchases WHERE user_id = $1 AND content_id = $2',
      [userId, contentId]
    );

    if (purchaseCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Content already purchased' });
    }

    // Check user's token balance
    const balanceQuery = await client.query(
      'SELECT balance FROM token_balances WHERE supabase_user_id = $1',
      [userId]
    );

    if (balanceQuery.rows.length === 0 || balanceQuery.rows[0].balance < content.price) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient token balance' });
    }

    // Deduct tokens
    await client.query(
      'UPDATE token_balances SET balance = balance - $1 WHERE supabase_user_id = $2',
      [content.price, userId]
    );

    // Create purchase record
    const purchaseId = uuidv4();
    await client.query(`
      INSERT INTO content_purchases (
        id, user_id, content_id, creator_id, price, purchased_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
    `, [purchaseId, userId, contentId, content.creator_id, content.price]);

    // Create token transaction
    await client.query(`
      INSERT INTO token_transactions (
        id, user_id, transaction_type, amount, description, 
        related_id, related_type, created_at
      ) VALUES ($1, $2, 'content_purchase', $3, $4, $5, $6, NOW())
    `, [
      uuidv4(),
      userId,
      -content.price,
      `Purchased ${contentType}: ${content.title}`,
      purchaseId,
      'content_purchase'
    ]);

    // Credit creator
    await client.query(
      'UPDATE token_balances SET balance = balance + $1 WHERE supabase_user_id = $2',
      [content.price, content.creator_id] // 100% to creator, no platform fee
    );

    // Update content stats
    await client.query(
      'UPDATE creator_content SET purchases = purchases + 1 WHERE id = $1',
      [contentId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Content purchased successfully',
      purchaseId,
      contentUrl: content.content_url
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error purchasing content:', error);
    res.status(500).json({ error: 'Failed to purchase content' });
  } finally {
    client.release();
  }
});

// Upload content (for creators)
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { title, description, price, contentType } = req.body;

    // Verify user is a creator
    const creatorCheck = await pool.query(
      'SELECT is_creator FROM users WHERE supabase_id = $1',
      [userId]
    );

    if (creatorCheck.rows.length === 0 || !creatorCheck.rows[0].is_creator) {
      return res.status(403).json({ error: 'Only creators can upload content' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Create content record
    const contentId = uuidv4();
    const contentUrl = `/uploads/${contentType}s/${req.file.filename}`;
    const thumbnailUrl = contentUrl; // In production, generate actual thumbnail

    await pool.query(`
      INSERT INTO creator_content (
        id, creator_id, content_type, title, description,
        thumbnail_url, content_url, price, file_size,
        mime_type, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    `, [
      contentId,
      userId,
      contentType,
      title,
      description,
      thumbnailUrl,
      contentUrl,
      price,
      req.file.size,
      req.file.mimetype
    ]);

    res.json({
      success: true,
      message: 'Content uploaded successfully',
      contentId,
      contentUrl
    });

  } catch (error) {
    console.error('Error uploading content:', error);
    res.status(500).json({ error: 'Failed to upload content' });
  }
});

// Get purchased content
router.get('/purchased', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;

    const query = await pool.query(`
      SELECT 
        c.*,
        cp.purchased_at,
        u.username as creator_username,
        u.display_name as creator_name
      FROM content_purchases cp
      JOIN creator_content c ON c.id = cp.content_id
      JOIN users u ON u.supabase_id = c.creator_id
      WHERE cp.user_id = $1
      ORDER BY cp.purchased_at DESC
    `, [userId]);

    res.json({
      success: true,
      purchases: query.rows
    });

  } catch (error) {
    console.error('Error fetching purchased content:', error);
    res.status(500).json({ error: 'Failed to fetch purchased content' });
  }
});

// Like content
router.post('/:contentId/like', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { contentId } = req.params;

    // Check if already liked
    const likeCheck = await pool.query(
      'SELECT id FROM content_likes WHERE user_id = $1 AND content_id = $2',
      [userId, contentId]
    );

    if (likeCheck.rows.length > 0) {
      // Unlike
      await pool.query(
        'DELETE FROM content_likes WHERE user_id = $1 AND content_id = $2',
        [userId, contentId]
      );
      await pool.query(
        'UPDATE creator_content SET likes = likes - 1 WHERE id = $1',
        [contentId]
      );
      res.json({ success: true, liked: false });
    } else {
      // Like
      await pool.query(
        'INSERT INTO content_likes (id, user_id, content_id, created_at) VALUES ($1, $2, $3, NOW())',
        [uuidv4(), userId, contentId]
      );
      await pool.query(
        'UPDATE creator_content SET likes = likes + 1 WHERE id = $1',
        [contentId]
      );
      res.json({ success: true, liked: true });
    }

  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

module.exports = router;