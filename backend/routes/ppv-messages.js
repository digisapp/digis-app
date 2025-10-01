const express = require('express');
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/ppv/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|mp3|wav|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Create a PPV message
router.post('/send', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const senderId = req.user.supabase_id;
    const {
      receiver_id,
      conversation_id,
      price,
      description,
      is_exclusive,
      expires_in,
      message_text
    } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Determine content type from file
    const contentType = req.file.mimetype.startsWith('image/') ? 'image' :
                       req.file.mimetype.startsWith('video/') ? 'video' :
                       req.file.mimetype.startsWith('audio/') ? 'audio' : 'file';
    
    // Calculate expiration if provided
    let expiresAt = null;
    if (expires_in && expires_in !== 'never') {
      const expirationMap = {
        '24h': 24 * 60 * 60 * 1000,
        '48h': 48 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };
      expiresAt = new Date(Date.now() + (expirationMap[expires_in] || 0));
    }
    
    // Generate secure URLs
    const contentUrl = `${process.env.BACKEND_URL}/uploads/ppv/${req.file.filename}`;
    const thumbnailUrl = contentType === 'image' ? contentUrl : null; // For images, use same as thumbnail
    
    // Start transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create PPV message record
      const ppvResult = await client.query(
        `INSERT INTO ppv_messages (
          sender_id, receiver_id, conversation_id,
          content_type, content_url, thumbnail_url,
          file_name, file_size, mime_type,
          description, price, is_exclusive, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          senderId, receiver_id, conversation_id,
          contentType, contentUrl, thumbnailUrl,
          req.file.originalname, req.file.size, req.file.mimetype,
          description, price, is_exclusive, expiresAt
        ]
      );
      
      const ppvMessage = ppvResult.rows[0];
      
      // Create chat message with PPV flag
      const messageResult = await client.query(
        `INSERT INTO chat_messages (
          sender_id, receiver_id, content, message_type,
          is_ppv, ppv_price, ppv_message_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          senderId, receiver_id,
          message_text || `Sent a premium ${contentType}`,
          'ppv',
          true, price, ppvMessage.id
        ]
      );
      
      // Update PPV message with chat message ID
      await client.query(
        'UPDATE ppv_messages SET message_id = $1 WHERE id = $2',
        [messageResult.rows[0].id, ppvMessage.id]
      );
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: messageResult.rows[0],
        ppv_message: ppvMessage
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('PPV message error:', error);
    res.status(500).json({ error: 'Failed to send PPV message' });
  }
});

// Unlock a PPV message
router.post('/unlock', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { message_id, price } = req.body;
    
    // Call the unlock function
    const result = await pool.query(
      'SELECT unlock_ppv_message($1, $2) as result',
      [userId, message_id]
    );
    
    const unlockResult = result.rows[0].result;
    
    if (unlockResult.success) {
      res.json({
        success: true,
        content_url: unlockResult.content_url,
        unlock_id: unlockResult.unlock_id,
        tokens_spent: unlockResult.tokens_spent
      });
    } else {
      res.status(400).json({
        success: false,
        error: unlockResult.error
      });
    }
    
  } catch (error) {
    console.error('Unlock error:', error);
    res.status(500).json({ error: 'Failed to unlock content' });
  }
});

// Get PPV message details (for preview)
router.get('/preview/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const messageId = req.params.id;
    
    const result = await pool.query(
      `SELECT 
        pm.*,
        CASE 
          WHEN pm.sender_id = $1 THEN true
          WHEN EXISTS (
            SELECT 1 FROM ppv_unlocks 
            WHERE ppv_message_id = pm.id AND user_id = $1
          ) THEN true
          ELSE false
        END as is_unlocked,
        u.username as sender_name,
        u.profile_pic_url as sender_avatar
      FROM ppv_messages pm
      JOIN users u ON pm.sender_id = u.supabase_id
      WHERE pm.id = $2
        AND (pm.sender_id = $1 OR pm.receiver_id = $1)`,
      [userId, messageId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    const message = result.rows[0];
    
    // Don't send content URL unless unlocked
    if (!message.is_unlocked) {
      delete message.content_url;
    }
    
    res.json(message);
    
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: 'Failed to get preview' });
  }
});

// Get PPV analytics for creators
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;
    
    // Check if user is a creator
    const creatorCheck = await pool.query(
      'SELECT is_creator FROM users WHERE supabase_id = $1',
      [creatorId]
    );
    
    if (!creatorCheck.rows[0]?.is_creator) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    // Get analytics
    const analyticsResult = await pool.query(
      `SELECT 
        COUNT(DISTINCT pm.id) as total_ppv_messages,
        COUNT(DISTINCT pu.id) as total_unlocks,
        COALESCE(SUM(pu.price_paid), 0) as total_revenue,
        COALESCE(AVG(pu.price_paid), 0) as avg_price,
        COUNT(DISTINCT pm.receiver_id) as unique_recipients,
        COUNT(DISTINCT pu.user_id) as unique_buyers
      FROM ppv_messages pm
      LEFT JOIN ppv_unlocks pu ON pm.id = pu.ppv_message_id
      WHERE pm.sender_id = $1`,
      [creatorId]
    );
    
    // Get top performing content
    const topContent = await pool.query(
      `SELECT 
        content_type,
        price,
        unlock_count,
        total_earned,
        created_at
      FROM ppv_messages
      WHERE sender_id = $1
      ORDER BY unlock_count DESC
      LIMIT 5`,
      [creatorId]
    );
    
    // Get recent unlocks
    const recentUnlocks = await pool.query(
      `SELECT 
        pu.unlocked_at,
        pu.price_paid,
        u.username,
        pm.content_type
      FROM ppv_unlocks pu
      JOIN ppv_messages pm ON pu.ppv_message_id = pm.id
      JOIN users u ON pu.user_id = u.supabase_id
      WHERE pm.sender_id = $1
      ORDER BY pu.unlocked_at DESC
      LIMIT 10`,
      [creatorId]
    );
    
    res.json({
      analytics: analyticsResult.rows[0],
      top_content: topContent.rows,
      recent_unlocks: recentUnlocks.rows
    });
    
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// Get user's unlocked PPV content
router.get('/unlocked', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    
    const result = await pool.query(
      `SELECT 
        pm.*,
        pu.unlocked_at,
        pu.price_paid,
        u.username as sender_name,
        u.profile_pic_url as sender_avatar
      FROM ppv_unlocks pu
      JOIN ppv_messages pm ON pu.ppv_message_id = pm.id
      JOIN users u ON pm.sender_id = u.supabase_id
      WHERE pu.user_id = $1
      ORDER BY pu.unlocked_at DESC`,
      [userId]
    );
    
    res.json({
      unlocked_content: result.rows
    });
    
  } catch (error) {
    console.error('Unlocked content error:', error);
    res.status(500).json({ error: 'Failed to get unlocked content' });
  }
});

module.exports = router;