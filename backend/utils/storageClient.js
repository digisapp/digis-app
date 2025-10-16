// backend/utils/storageClient.js
// Supabase Storage client with service role access
// Used for server-side file uploads to avoid RLS policy issues

const { createClient } = require('@supabase/supabase-js');
const { logger } = require('./secureLogger');

// Validate required environment variables
if (!process.env.SUPABASE_URL) {
  throw new Error('SUPABASE_URL environment variable is required');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
}

// Create admin client with service role key (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

logger.info('Supabase Storage admin client initialized', {
  url: process.env.SUPABASE_URL,
  hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
});

/**
 * Upload file to Supabase Storage bucket
 * @param {string} bucket - Bucket name (e.g., 'avatars', 'cards')
 * @param {string} path - File path within bucket
 * @param {Buffer} buffer - File buffer
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} Public URL
 */
async function uploadToStorage(bucket, path, buffer, contentType) {
  try {
    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType,
        upsert: true,
        cacheControl: '3600', // 1 hour cache
      });

    if (error) {
      logger.error('Storage upload failed', {
        bucket,
        path,
        error: error.message
      });
      throw error;
    }

    // Get public URL (bucket must be public)
    const { data: publicUrlData } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(path);

    if (!publicUrlData?.publicUrl) {
      throw new Error('Failed to generate public URL');
    }

    logger.info('File uploaded to storage', {
      bucket,
      path,
      url: publicUrlData.publicUrl,
      size: buffer.length
    });

    return publicUrlData.publicUrl;
  } catch (error) {
    logger.error('Upload to storage failed', {
      bucket,
      path,
      error: error.message
    });
    throw error;
  }
}

/**
 * Delete file from Supabase Storage
 * @param {string} bucket - Bucket name
 * @param {string} path - File path within bucket
 * @returns {Promise<void>}
 */
async function deleteFromStorage(bucket, path) {
  try {
    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      logger.warn('Storage delete failed (non-fatal)', {
        bucket,
        path,
        error: error.message
      });
      // Don't throw - old files may already be deleted
    } else {
      logger.info('File deleted from storage', { bucket, path });
    }
  } catch (error) {
    logger.warn('Delete from storage failed (non-fatal)', {
      bucket,
      path,
      error: error.message
    });
  }
}

module.exports = {
  supabaseAdmin,
  uploadToStorage,
  deleteFromStorage
};
