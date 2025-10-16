// backend/middleware/upload.js
// Multer middleware for handling file uploads
// Stores files in memory for processing before upload to Supabase Storage

const multer = require('multer');
const { logger } = require('../utils/secureLogger');

const MB = 1024 * 1024;

// Allowed MIME types for image uploads
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif'
];

// File filter to reject non-image files
function imageFilter(req, file, cb) {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    logger.warn('Rejected non-image upload', {
      mimetype: file.mimetype,
      filename: file.originalname
    });
    cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`), false);
  }
}

// Multer configuration for memory storage
// Files are stored in req.file.buffer for processing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * MB,   // Hard cap: 8MB
    files: 1,           // Only one file per request
    fields: 10,         // Limit form fields
  },
  fileFilter: imageFilter
});

// Error handler for multer errors
function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    logger.error('Multer upload error', {
      code: err.code,
      field: err.field,
      message: err.message
    });

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        details: 'Maximum file size is 8MB',
        code: 'FILE_TOO_LARGE'
      });
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files',
        details: 'Only one file allowed per upload',
        code: 'TOO_MANY_FILES'
      });
    }

    return res.status(400).json({
      error: 'Upload error',
      details: err.message,
      code: err.code
    });
  }

  // Other errors (like file filter rejections)
  if (err) {
    logger.error('Upload error', { error: err.message });
    return res.status(400).json({
      error: 'Upload failed',
      details: err.message
    });
  }

  next();
}

module.exports = {
  upload,
  handleUploadError,
  ALLOWED_IMAGE_TYPES
};
