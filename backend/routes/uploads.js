// backend/routes/uploads.js
// Image upload routes for avatars and creator cards
// Handles file processing, validation, and storage upload

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { upload, handleUploadError } = require('../middleware/upload');
const { uploadToStorage, supabaseAdmin } = require('../utils/storageClient');
const { processAvatar, processCard } = require('../utils/imageProcessor');
const { verifySupabaseToken } = require('../middleware/auth');
const { logger } = require('../utils/secureLogger');

/**
 * Get file extension from MIME type
 * @param {string} mime - MIME type
 * @returns {string} File extension
 */
function extFromMime(mime) {
  const extensions = {
    'image/png': 'png',
    'image/webp': 'webp',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif'
  };
  return extensions[mime] || 'jpg';
}

/**
 * Extract user ID from authenticated request
 * @param {Object} req - Express request with req.user
 * @returns {string} User ID
 */
function getUserId(req) {
  return req.user?.supabase_id || req.user?.uid || req.user?.sub;
}

/**
 * POST /api/uploads/avatar
 * Upload and crop avatar image
 * Expects multipart/form-data with 'file' field
 * Returns public URL after processing and upload
 */
router.post('/avatar', verifySupabaseToken, upload.single('file'), async (req, res) => {
  const startTime = Date.now();

  try {
    // Validate file uploaded
    if (!req.file) {
      logger.warn('Avatar upload: no file provided', { userId: getUserId(req) });
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        code: 'NO_FILE'
      });
    }

    // Get authenticated user ID
    const userId = getUserId(req);
    if (!userId) {
      logger.error('Avatar upload: missing user ID', { file: req.file.originalname });
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED'
      });
    }

    logger.info('Processing avatar upload', {
      userId,
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Process image with Sharp (re-encode, validate, resize)
    const { buffer, metadata } = await processAvatar(req.file);
    const mime = `image/${metadata.format}`;

    // Generate unique filename with hash
    const hash = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 10);
    const ext = extFromMime(mime);
    const key = `${userId}/avatar-${Date.now()}-${hash}.${ext}`;

    // Upload to Supabase Storage
    const publicUrl = await uploadToStorage('avatars', key, buffer, mime);

    // Update user record with new avatar URL
    const { error: dbErr } = await supabaseAdmin
      .from('users')
      .update({
        avatar_url: publicUrl,
        avatar_updated_at: new Date().toISOString()
      })
      .eq('supabase_id', userId);

    if (dbErr) {
      logger.error('Avatar upload: DB update failed', {
        userId,
        error: dbErr.message
      });
      throw new Error(`Database update failed: ${dbErr.message}`);
    }

    const duration = Date.now() - startTime;

    logger.info('Avatar upload completed', {
      userId,
      url: publicUrl,
      size: buffer.length,
      duration: `${duration}ms`
    });

    res.json({
      success: true,
      url: publicUrl,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: metadata.size
      },
      duration
    });
  } catch (err) {
    const duration = Date.now() - startTime;

    logger.error('Avatar upload error', {
      userId: getUserId(req),
      error: err.message,
      stack: err.stack,
      duration: `${duration}ms`
    });

    res.status(400).json({
      success: false,
      error: 'Failed to process avatar',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
      code: 'PROCESSING_ERROR'
    });
  }
});

/**
 * POST /api/uploads/card
 * Upload and crop creator card/banner image
 * Expects multipart/form-data with 'file' field
 * Returns public URL after processing and upload
 */
router.post('/card', verifySupabaseToken, upload.single('file'), async (req, res) => {
  const startTime = Date.now();

  try {
    // Validate file uploaded
    if (!req.file) {
      logger.warn('Card upload: no file provided', { userId: getUserId(req) });
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        code: 'NO_FILE'
      });
    }

    // Get authenticated user ID
    const userId = getUserId(req);
    if (!userId) {
      logger.error('Card upload: missing user ID', { file: req.file.originalname });
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED'
      });
    }

    logger.info('Processing card upload', {
      userId,
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Process image with Sharp (re-encode, validate, resize)
    const { buffer, metadata } = await processCard(req.file);
    const mime = `image/${metadata.format}`;

    // Generate unique filename with hash
    const hash = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 10);
    const ext = extFromMime(mime);
    const key = `${userId}/card-${Date.now()}-${hash}.${ext}`;

    // Upload to Supabase Storage
    const publicUrl = await uploadToStorage('cards', key, buffer, mime);

    // Update user record with new card image URL
    const { error: dbErr } = await supabaseAdmin
      .from('users')
      .update({
        card_image_url: publicUrl,
        card_image_updated_at: new Date().toISOString()
      })
      .eq('supabase_id', userId);

    if (dbErr) {
      logger.error('Card upload: DB update failed', {
        userId,
        error: dbErr.message
      });
      throw new Error(`Database update failed: ${dbErr.message}`);
    }

    const duration = Date.now() - startTime;

    logger.info('Card upload completed', {
      userId,
      url: publicUrl,
      size: buffer.length,
      duration: `${duration}ms`
    });

    res.json({
      success: true,
      url: publicUrl,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: metadata.size
      },
      duration
    });
  } catch (err) {
    const duration = Date.now() - startTime;

    logger.error('Card upload error', {
      userId: getUserId(req),
      error: err.message,
      stack: err.stack,
      duration: `${duration}ms`
    });

    res.status(400).json({
      success: false,
      error: 'Failed to process card image',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
      code: 'PROCESSING_ERROR'
    });
  }
});

// Error handler for multer errors
router.use(handleUploadError);

module.exports = router;
