const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configure multer for memory storage (we'll upload to Supabase from memory)
const storage = multer.memoryStorage();

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

// Helper function to upload to Supabase Storage
async function uploadToSupabase(file, userId, contentType) {
  const fileExt = file.originalname.split('.').pop();
  const subfolder = contentType === 'photo' ? 'photos' : 'videos';
  const fileName = `${subfolder}/${userId}/${Date.now()}-${uuidv4()}.${fileExt}`;
  const bucket = 'creator-content'; // Using existing bucket

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    throw new Error(`Supabase upload error: ${error.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName);

  return { publicUrl, path: data.path };
}

// Get creator's content - PUBLIC ENDPOINT
router.get('/creator/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;

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

    // Query actual content from database - use supabase_id
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
      WHERE creator_id = $1 AND content_type = 'photo' AND is_active = true
      ORDER BY created_at DESC`,
      [creator.supabase_id]
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
        views,
        likes,
        created_at
      FROM creator_content
      WHERE creator_id = $1 AND content_type = 'video' AND is_active = true
      ORDER BY created_at DESC`,
      [creator.supabase_id]
    );

    // Use real data from database (empty arrays if no content)
    const pictures = picturesQuery.rows || [];
    const videos = videosQuery.rows || [];

    res.json({
      creator: {
        id: creator.supabase_id,
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

// Upload content (for creators) - WITH SUPABASE STORAGE
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { title, description, price, type } = req.body;
    const contentType = type === 'videos' ? 'video' : 'photo';

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

    // Upload to Supabase Storage
    const { publicUrl } = await uploadToSupabase(req.file, userId, contentType);

    // Create content record
    const contentId = uuidv4();
    const thumbnailUrl = publicUrl; // In production, generate actual thumbnail

    await pool.query(`
      INSERT INTO creator_content (
        id, creator_id, content_type, title, description,
        thumbnail_url, content_url, price, file_size,
        mime_type, is_active, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, NOW())
    `, [
      contentId,
      userId,
      contentType,
      title || 'Untitled',
      description || '',
      thumbnailUrl,
      publicUrl,
      parseInt(price) || 0,
      req.file.size,
      req.file.mimetype
    ]);

    res.json({
      success: true,
      message: 'Content uploaded successfully',
      content: {
        id: contentId,
        contentUrl: publicUrl,
        thumbnailUrl,
        title,
        type: contentType
      }
    });

  } catch (error) {
    console.error('Error uploading content:', error);
    res.status(500).json({ error: 'Failed to upload content', details: error.message });
  }
});

// Upload photo bundle (for bulk uploads) - WITH SUPABASE STORAGE
router.post('/upload-bundle', authenticateToken, upload.array('photos', 100), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userId = req.user.supabase_id;
    const { title, description, category, is_premium, price } = req.body;

    // Verify user is a creator
    const creatorCheck = await client.query(
      'SELECT is_creator FROM users WHERE supabase_id = $1',
      [userId]
    );

    if (creatorCheck.rows.length === 0 || !creatorCheck.rows[0].is_creator) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only creators can upload content' });
    }

    if (!req.files || req.files.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Create bundle record first
    const bundleId = uuidv4();
    await client.query(`
      INSERT INTO content_bundles (
        id, creator_id, title, description, category,
        is_premium, price, photo_count, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [
      bundleId,
      userId,
      title || 'Photo Bundle',
      description || '',
      category || 'general',
      is_premium === 'true',
      parseFloat(price) || 0,
      req.files.length
    ]);

    // Upload each photo to Supabase and link to bundle
    const uploadedPhotos = [];
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const photoTitle = req.body[`titles[${i}]`] || `Photo ${i + 1}`;
      const photoDescription = req.body[`descriptions[${i}]`] || '';

      // Upload to Supabase
      const { publicUrl } = await uploadToSupabase(file, userId, 'photo');

      const photoId = uuidv4();

      await client.query(`
        INSERT INTO creator_content (
          id, creator_id, content_type, title, description,
          thumbnail_url, content_url, price, file_size,
          mime_type, bundle_id, is_premium, category, is_active, created_at
        ) VALUES ($1, $2, 'photo', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, NOW())
      `, [
        photoId,
        userId,
        photoTitle,
        photoDescription,
        publicUrl,
        publicUrl,
        is_premium === 'true' ? 0 : 0, // Individual photos in bundle don't have separate prices
        file.size,
        file.mimetype,
        bundleId,
        is_premium === 'true',
        category || 'general'
      ]);

      uploadedPhotos.push({
        id: photoId,
        title: photoTitle,
        url: publicUrl,
        thumbnail_url: publicUrl
      });
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Bundle uploaded successfully with ${req.files.length} photos`,
      bundle: {
        id: bundleId,
        title,
        description,
        price: parseFloat(price) || 0,
        is_premium: is_premium === 'true',
        photo_count: req.files.length,
        photos: uploadedPhotos
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error uploading bundle:', error);
    res.status(500).json({ error: 'Failed to upload bundle', details: error.message });
  } finally {
    client.release();
  }
});

// Delete content
router.delete('/:contentId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { contentId } = req.params;

    // Get content details
    const contentQuery = await pool.query(
      'SELECT content_url, content_type, creator_id FROM creator_content WHERE id = $1',
      [contentId]
    );

    if (contentQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const content = contentQuery.rows[0];

    // Verify ownership
    if (content.creator_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Delete from Supabase Storage
    const bucket = 'creator-content';
    // Extract file path from URL (format: .../creator-content/photos/userId/filename.ext)
    const urlParts = content.content_url.split('/creator-content/');
    const filePath = urlParts.length > 1 ? urlParts[1] : null;

    if (filePath) {
      await supabase.storage
        .from(bucket)
        .remove([filePath]);
    }

    // Delete from database
    await pool.query('DELETE FROM creator_content WHERE id = $1', [contentId]);

    res.json({ success: true, message: 'Content deleted successfully' });

  } catch (error) {
    console.error('Error deleting content:', error);
    res.status(500).json({ error: 'Failed to delete content' });
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
        'UPDATE creator_content SET likes = GREATEST(likes - 1, 0) WHERE id = $1',
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

// Purchase content
router.post('/purchase', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userId = req.user.supabase_id;
    const { contentId } = req.body;

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
      `Purchased ${content.content_type}: ${content.title}`,
      purchaseId,
      'content_purchase'
    ]);

    // Credit creator
    await client.query(
      'UPDATE token_balances SET balance = balance + $1 WHERE supabase_user_id = $2',
      [content.price, content.creator_id]
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

// Track content view
router.post('/view/:contentId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { contentId } = req.params;

    // Check if user has access (either purchased or is creator)
    const accessCheck = await pool.query(`
      SELECT c.creator_id FROM creator_content c
      WHERE c.id = $1 AND (
        c.creator_id = $2 OR
        EXISTS (SELECT 1 FROM content_purchases WHERE content_id = $1 AND user_id = $2)
      )
    `, [contentId, userId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Increment view count
    await pool.query(
      'UPDATE creator_content SET views = views + 1 WHERE id = $1',
      [contentId]
    );

    // Track individual view
    await pool.query(`
      INSERT INTO content_views (id, content_id, user_id, viewed_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT DO NOTHING
    `, [uuidv4(), contentId, userId]);

    res.json({ success: true });

  } catch (error) {
    console.error('Error tracking view:', error);
    res.status(500).json({ error: 'Failed to track view' });
  }
});

// Download purchased content
router.get('/download/:contentId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { contentId } = req.params;

    // Verify purchase and check if downloadable
    const contentCheck = await pool.query(`
      SELECT c.content_url, c.title, c.content_type, c.is_downloadable
      FROM creator_content c
      JOIN content_purchases cp ON cp.content_id = c.id
      WHERE c.id = $1 AND cp.user_id = $2
    `, [contentId, userId]);

    if (contentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Content not found or not purchased' });
    }

    const content = contentCheck.rows[0];

    if (!content.is_downloadable) {
      return res.status(403).json({ error: 'This content is not available for download' });
    }

    // Get signed URL from Supabase Storage
    const filePath = content.content_url.split('/').slice(-2).join('/'); // Extract path from full URL
    const { data, error } = await supabase.storage
      .from('creator-content')
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (error) {
      console.error('Error creating signed URL:', error);
      return res.status(500).json({ error: 'Failed to generate download link' });
    }

    // Track download
    await pool.query(
      'UPDATE creator_content SET downloads = downloads + 1 WHERE id = $1',
      [contentId]
    );

    res.json({
      success: true,
      downloadUrl: data.signedUrl,
      filename: `${content.title}.${content.content_type === 'video' ? 'mp4' : 'jpg'}`
    });

  } catch (error) {
    console.error('Error downloading content:', error);
    res.status(500).json({ error: 'Failed to download content' });
  }
});

module.exports = router;
