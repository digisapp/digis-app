// backend/utils/imageProcessor.js
// Server-side image processing with Sharp
// Re-encodes images to strip EXIF, validate formats, and enforce size constraints

const sharp = require('sharp');
const { logger } = require('./secureLogger');

// Allowed MIME types for uploads
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Maximum file sizes
const MAX_AVATAR_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_CARD_SIZE = 15 * 1024 * 1024; // 15MB

/**
 * Validate image file before processing
 * @param {Express.Multer.File} file - Uploaded file
 * @param {number} maxSize - Max file size in bytes
 * @returns {{valid: boolean, error?: string}}
 */
function validateImageFile(file, maxSize = MAX_CARD_SIZE) {
  if (!file || !file.buffer) {
    return { valid: false, error: 'No file provided' };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    return {
      valid: false,
      error: `Unsupported image type: ${file.mimetype}. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `Image too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum: ${(maxSize / 1024 / 1024).toFixed(0)}MB`
    };
  }

  return { valid: true };
}

/**
 * Process avatar image (circle, PNG output)
 * - Expects PNG transparent circle from client
 * - Enforces square dimensions
 * - Strips EXIF metadata
 * - Caps at 512x512px
 *
 * @param {Express.Multer.File} file - Uploaded file
 * @returns {Promise<{buffer: Buffer, metadata: object}>}
 */
async function processAvatar(file) {
  logger.info('🖼️ Processing avatar upload', {
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: `${(file.size / 1024).toFixed(2)}KB`
  });

  // Validate file
  const validation = validateImageFile(file, MAX_AVATAR_SIZE);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  try {
    const image = sharp(file.buffer);
    const metadata = await image.metadata();

    logger.info('📊 Original avatar metadata', {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      hasAlpha: metadata.hasAlpha
    });

    // Enforce square and cap at 512x512
    const size = Math.min(Math.max(metadata.width || 512, metadata.height || 512), 512);

    const processedBuffer = await image
      .resize(size, size, {
        fit: 'cover',
        position: 'center'
      })
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: false // Keep full color
      })
      .toBuffer();

    const outputMetadata = await sharp(processedBuffer).metadata();

    logger.info('✅ Avatar processed successfully', {
      width: outputMetadata.width,
      height: outputMetadata.height,
      format: outputMetadata.format,
      size: `${(processedBuffer.length / 1024).toFixed(2)}KB`
    });

    return {
      buffer: processedBuffer,
      metadata: {
        width: outputMetadata.width,
        height: outputMetadata.height,
        format: 'png',
        size: processedBuffer.length
      }
    };
  } catch (error) {
    logger.error('❌ Avatar processing failed', { error: error.message });
    throw new Error(`Failed to process avatar: ${error.message}`);
  }
}

/**
 * Process card/banner image (JPEG output)
 * - Preserves vertical composition
 * - Caps longest edge at maxHeight
 * - Fixes orientation by EXIF
 * - Strips EXIF metadata
 * - Outputs optimized JPEG
 *
 * @param {Express.Multer.File} file - Uploaded file
 * @param {number} maxHeight - Maximum height in pixels (default 1600)
 * @returns {Promise<{buffer: Buffer, metadata: object}>}
 */
async function processCard(file, maxHeight = 1600) {
  logger.info('🖼️ Processing card/banner upload', {
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: `${(file.size / 1024).toFixed(2)}KB`
  });

  // Validate file
  const validation = validateImageFile(file, MAX_CARD_SIZE);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  try {
    // Auto-rotate based on EXIF orientation
    const image = sharp(file.buffer).rotate();
    const metadata = await image.metadata();

    logger.info('📊 Original card metadata', {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      orientation: metadata.orientation
    });

    // Resize if needed (preserve aspect ratio, cap longest edge)
    const processedBuffer = await image
      .resize({
        height: Math.min(metadata.height || maxHeight, maxHeight),
        withoutEnlargement: true,
        fit: 'inside'
      })
      .jpeg({
        quality: 90,
        mozjpeg: true, // Use mozjpeg for better compression
        chromaSubsampling: '4:4:4' // Better quality
      })
      .toBuffer();

    const outputMetadata = await sharp(processedBuffer).metadata();

    logger.info('✅ Card processed successfully', {
      width: outputMetadata.width,
      height: outputMetadata.height,
      format: outputMetadata.format,
      size: `${(processedBuffer.length / 1024).toFixed(2)}KB`
    });

    return {
      buffer: processedBuffer,
      metadata: {
        width: outputMetadata.width,
        height: outputMetadata.height,
        format: 'jpeg',
        size: processedBuffer.length
      }
    };
  } catch (error) {
    logger.error('❌ Card processing failed', { error: error.message });
    throw new Error(`Failed to process card image: ${error.message}`);
  }
}

/**
 * Process general image with custom options
 * @param {Express.Multer.File} file - Uploaded file
 * @param {object} options - Processing options
 * @param {number} [options.maxWidth] - Maximum width
 * @param {number} [options.maxHeight] - Maximum height
 * @param {'jpeg'|'png'|'webp'} [options.format='jpeg'] - Output format
 * @param {number} [options.quality=85] - Output quality (1-100)
 * @returns {Promise<{buffer: Buffer, metadata: object}>}
 */
async function processImage(file, options = {}) {
  const {
    maxWidth,
    maxHeight,
    format = 'jpeg',
    quality = 85
  } = options;

  logger.info('🖼️ Processing image with custom options', {
    originalName: file.originalname,
    format,
    quality,
    maxWidth,
    maxHeight
  });

  // Validate file
  const validation = validateImageFile(file, MAX_CARD_SIZE);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  try {
    let image = sharp(file.buffer).rotate();

    // Resize if dimensions specified
    if (maxWidth || maxHeight) {
      image = image.resize({
        width: maxWidth,
        height: maxHeight,
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Apply format-specific options
    if (format === 'png') {
      image = image.png({ compressionLevel: 9, quality });
    } else if (format === 'webp') {
      image = image.webp({ quality });
    } else {
      image = image.jpeg({ quality, mozjpeg: true });
    }

    const processedBuffer = await image.toBuffer();
    const outputMetadata = await sharp(processedBuffer).metadata();

    logger.info('✅ Image processed successfully', {
      width: outputMetadata.width,
      height: outputMetadata.height,
      format: outputMetadata.format,
      size: `${(processedBuffer.length / 1024).toFixed(2)}KB`
    });

    return {
      buffer: processedBuffer,
      metadata: {
        width: outputMetadata.width,
        height: outputMetadata.height,
        format: outputMetadata.format,
        size: processedBuffer.length
      }
    };
  } catch (error) {
    logger.error('❌ Image processing failed', { error: error.message });
    throw new Error(`Failed to process image: ${error.message}`);
  }
}

module.exports = {
  processAvatar,
  processCard,
  processImage,
  validateImageFile,
  ALLOWED_IMAGE_TYPES,
  MAX_AVATAR_SIZE,
  MAX_CARD_SIZE
};
