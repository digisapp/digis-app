const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');
const logger = require('./logger');

// Initialize Supabase client with service role key for storage operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Storage bucket names
const BUCKETS = {
  PROFILE_IMAGES: 'profile-images',
  CREATOR_CARDS: 'creator-cards',
  BANNERS: 'banner-images',
  CONTENT: 'creator-content'
};

// Image size configurations
const IMAGE_SIZES = {
  thumbnail: { width: 150, height: 150 },
  medium: { width: 400, height: 400 },
  large: { width: 800, height: 800 },
  creatorCard: { width: 400, height: 500 }, // 4:5 aspect ratio
  banner: { width: 1200, height: 400 } // 3:1 aspect ratio
};

/**
 * Ensure storage buckets exist
 */
async function ensureBucketsExist() {
  try {
    for (const bucketName of Object.values(BUCKETS)) {
      const { data, error } = await supabase.storage.getBucket(bucketName);
      
      if (error && error.message.includes('not found')) {
        // Create bucket if it doesn't exist
        const { data: newBucket, error: createError } = await supabase.storage.createBucket(bucketName, {
          public: true,
          fileSizeLimit: 10485760, // 10MB
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        });
        
        if (createError) {
          logger.error(`Failed to create bucket ${bucketName}:`, createError);
        } else {
          logger.info(`✅ Created storage bucket: ${bucketName}`);
        }
      }
    }
  } catch (error) {
    logger.error('Error ensuring buckets exist:', error);
  }
}

/**
 * Process and resize image
 */
async function processImage(buffer, options = {}) {
  const { width, height, quality = 85, format = 'webp' } = options;
  
  try {
    let pipeline = sharp(buffer);
    
    // Resize if dimensions provided
    if (width || height) {
      pipeline = pipeline.resize(width, height, {
        fit: 'cover',
        position: 'center'
      });
    }
    
    // Convert to specified format
    if (format === 'webp') {
      pipeline = pipeline.webp({ quality });
    } else if (format === 'jpeg') {
      pipeline = pipeline.jpeg({ quality, progressive: true });
    } else if (format === 'png') {
      pipeline = pipeline.png({ quality, compressionLevel: 9 });
    }
    
    return await pipeline.toBuffer();
  } catch (error) {
    logger.error('Error processing image:', error);
    throw error;
  }
}

/**
 * Upload image to Supabase Storage with multiple sizes
 */
async function uploadImage(file, userId, imageType = 'profile') {
  try {
    await ensureBucketsExist();
    
    const timestamp = Date.now();
    const fileExt = file.mimetype.split('/')[1];
    const baseFileName = `${userId}/${timestamp}`;
    
    // Determine bucket based on image type
    let bucket = BUCKETS.PROFILE_IMAGES;
    let sizes = ['thumbnail', 'medium', 'large'];
    
    if (imageType === 'creator_card') {
      bucket = BUCKETS.CREATOR_CARDS;
      sizes = ['thumbnail', 'creatorCard'];
    } else if (imageType === 'banner') {
      bucket = BUCKETS.BANNERS;
      sizes = ['banner'];
    }
    
    const uploadedUrls = {};
    
    // Process and upload each size
    for (const sizeName of sizes) {
      const sizeConfig = IMAGE_SIZES[sizeName];
      const processedBuffer = await processImage(file.buffer, {
        width: sizeConfig.width,
        height: sizeConfig.height,
        format: 'webp'
      });
      
      const fileName = `${baseFileName}_${sizeName}.webp`;
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, processedBuffer, {
          contentType: 'image/webp',
          upsert: true
        });
      
      if (error) {
        logger.error(`Failed to upload ${sizeName} image:`, error);
        throw error;
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);
      
      uploadedUrls[sizeName] = urlData.publicUrl;
    }
    
    // Also upload original
    const originalFileName = `${baseFileName}_original.${fileExt}`;
    const { data: originalData, error: originalError } = await supabase.storage
      .from(bucket)
      .upload(originalFileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });
    
    if (!originalError) {
      const { data: originalUrl } = supabase.storage
        .from(bucket)
        .getPublicUrl(originalFileName);
      uploadedUrls.original = originalUrl.publicUrl;
    }
    
    logger.info(`✅ Successfully uploaded ${imageType} images for user ${userId}`);
    
    return {
      urls: uploadedUrls,
      primaryUrl: uploadedUrls.medium || uploadedUrls.creatorCard || uploadedUrls.banner,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error uploading image to Supabase Storage:', error);
    throw error;
  }
}

/**
 * Delete image from Supabase Storage
 */
async function deleteImage(fileUrl, bucket = BUCKETS.PROFILE_IMAGES) {
  try {
    // Extract file path from URL
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split('/');
    const filePath = pathParts.slice(pathParts.indexOf('object') + 2).join('/');
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);
    
    if (error) {
      logger.error('Failed to delete image:', error);
      throw error;
    }
    
    logger.info(`✅ Successfully deleted image: ${filePath}`);
    return true;
  } catch (error) {
    logger.error('Error deleting image:', error);
    return false;
  }
}

/**
 * Get signed URL for private content
 */
async function getSignedUrl(filePath, bucket = BUCKETS.CONTENT, expiresIn = 3600) {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn);
    
    if (error) {
      logger.error('Failed to create signed URL:', error);
      throw error;
    }
    
    return data.signedUrl;
  } catch (error) {
    logger.error('Error creating signed URL:', error);
    throw error;
  }
}

module.exports = {
  uploadImage,
  deleteImage,
  getSignedUrl,
  processImage,
  ensureBucketsExist,
  BUCKETS,
  IMAGE_SIZES
};