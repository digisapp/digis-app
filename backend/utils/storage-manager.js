const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const fileType = require('file-type');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

class StorageManager {
  constructor() {
    this.buckets = {
      PROFILE_PICTURES: 'profile-pictures',
      CREATOR_BANNERS: 'creator-banners',
      STREAM_THUMBNAILS: 'stream-thumbnails',
      SHOP_PRODUCTS: 'shop-products',
      CREATOR_CONTENT: 'creator-content',
      MESSAGE_ATTACHMENTS: 'message-attachments',
      STREAM_RECORDINGS: 'stream-recordings',
      SESSION_RECORDINGS: 'session-recordings',
      IDENTITY_VERIFICATION: 'identity-verification',
      ANALYTICS_REPORTS: 'analytics-reports',
      VIRTUAL_GIFTS: 'virtual-gifts',
      TICKETED_SHOWS: 'ticketed-shows'
    };

    this.imageSizePresets = {
      thumbnail: { width: 150, height: 150 },
      small: { width: 320, height: 320 },
      medium: { width: 640, height: 640 },
      large: { width: 1280, height: 1280 },
      banner: { width: 1920, height: 480 }
    };
  }

  /**
   * Generate a unique file path
   */
  generateFilePath(userId, fileName, folder = null) {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    const sanitizedName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');
    
    const parts = [userId];
    if (folder) parts.push(folder);
    parts.push(`${timestamp}_${randomString}_${sanitizedName}${ext}`);
    
    return parts.join('/');
  }

  /**
   * Validate file type by magic bytes
   */
  async validateFileType(fileBuffer, expectedMimeType) {
    try {
      // Check magic bytes
      const type = await fileType.fromBuffer(fileBuffer);

      if (!type) {
        throw new Error('Unable to determine file type');
      }

      // Validate against expected mime type
      if (expectedMimeType && !type.mime.startsWith(expectedMimeType.split('/')[0])) {
        throw new Error(`Invalid file type. Expected ${expectedMimeType}, got ${type.mime}`);
      }

      // Check against allowed types
      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/webm',
        'audio/mpeg',
        'audio/wav',
        'application/pdf'
      ];

      if (!allowedTypes.includes(type.mime)) {
        throw new Error(`File type ${type.mime} is not allowed`);
      }

      return type;
    } catch (error) {
      console.error('File validation error:', error);
      throw error;
    }
  }

  /**
   * Upload a file to storage
   */
  async uploadFile(bucket, filePath, fileBuffer, options = {}) {
    try {
      // Validate file type by magic bytes
      const fileTypeResult = await this.validateFileType(fileBuffer, options.contentType);

      // Use detected mime type if not provided
      const contentType = options.contentType || fileTypeResult.mime;

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, fileBuffer, {
          contentType,
          cacheControl: options.cacheControl || '3600',
          upsert: options.upsert || false
        });

      if (error) throw error;

      // Get public URL only for public buckets
      // Private/paid content should use signed URLs
      if (this.isPublicBucket(bucket)) {
        const { data: { publicUrl } } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath);

        return { path: data.path, publicUrl };
      }

      // For private/paid content buckets, don't return public URL
      // Caller should use createSignedUrl instead
      return { path: data.path, isPrivate: true };
    } catch (error) {
      console.error('Upload error:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Upload profile picture with automatic resizing
   */
  async uploadProfilePicture(userId, fileBuffer, mimeType) {
    try {
      // Generate different sizes
      const sizes = {
        original: fileBuffer,
        large: await this.resizeImage(fileBuffer, this.imageSizePresets.large),
        medium: await this.resizeImage(fileBuffer, this.imageSizePresets.medium),
        thumbnail: await this.resizeImage(fileBuffer, this.imageSizePresets.thumbnail)
      };

      const uploadPromises = Object.entries(sizes).map(([size, buffer]) => {
        const filePath = `${userId}/${size === 'original' ? 'profile' : `profile_${size}`}.webp`;
        return this.uploadFile(this.buckets.PROFILE_PICTURES, filePath, buffer, {
          contentType: 'image/webp',
          upsert: true
        });
      });

      const results = await Promise.all(uploadPromises);
      
      return {
        original: results[0].publicUrl,
        large: results[1].publicUrl,
        medium: results[2].publicUrl,
        thumbnail: results[3].publicUrl
      };
    } catch (error) {
      console.error('Profile picture upload error:', error);
      throw error;
    }
  }

  /**
   * Upload creator content with access control
   */
  async uploadCreatorContent(creatorId, fileBuffer, fileName, mimeType, metadata = {}) {
    try {
      const filePath = this.generateFilePath(creatorId, fileName, 'content');
      
      // Upload file
      const result = await this.uploadFile(
        this.buckets.CREATOR_CONTENT,
        filePath,
        fileBuffer,
        {
          contentType: mimeType,
          upsert: false
        }
      );

      // Store metadata in database
      const { data, error } = await supabase
        .from('file_uploads')
        .insert({
          user_id: creatorId,
          bucket_id: this.buckets.CREATOR_CONTENT,
          file_path: filePath,
          file_name: fileName,
          file_size: fileBuffer.length,
          mime_type: mimeType,
          metadata: metadata,
          upload_status: 'completed'
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        path: result.path,
        fileName: fileName,
        size: fileBuffer.length,
        mimeType: mimeType
      };
    } catch (error) {
      console.error('Creator content upload error:', error);
      throw error;
    }
  }

  /**
   * Upload stream recording
   */
  async uploadStreamRecording(creatorId, streamId, fileBuffer, metadata = {}) {
    try {
      const fileName = `stream_${streamId}_${Date.now()}.mp4`;
      const filePath = `${creatorId}/recordings/${fileName}`;
      
      const result = await this.uploadFile(
        this.buckets.STREAM_RECORDINGS,
        filePath,
        fileBuffer,
        {
          contentType: 'video/mp4',
          cacheControl: '86400' // 24 hours
        }
      );

      // Store recording metadata
      const { data, error } = await supabase
        .from('stream_recordings')
        .insert({
          stream_id: streamId,
          creator_id: creatorId,
          file_path: filePath,
          file_size: fileBuffer.length,
          duration: metadata.duration,
          metadata: metadata
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Stream recording upload error:', error);
      throw error;
    }
  }

  /**
   * Generate a signed URL for private content
   */
  async generateSignedUrl(bucket, filePath, expiresIn = 3600) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, expiresIn);

      if (error) throw error;
      
      return data.signedUrl;
    } catch (error) {
      console.error('Signed URL generation error:', error);
      throw error;
    }
  }

  /**
   * Check if user has access to content
   */
  async checkContentAccess(userId, bucket, filePath) {
    try {
      // For public buckets, always allow
      if (this.isPublicBucket(bucket)) {
        return true;
      }

      // Extract creator ID from file path
      const creatorId = filePath.split('/')[0];

      // Check if user is the creator
      if (userId === creatorId) {
        return true;
      }

      // Check subscription status for creator content
      if (bucket === this.buckets.CREATOR_CONTENT) {
        const { data } = await supabase
          .from('creator_subscriptions')
          .select('id')
          .eq('user_id', userId)
          .eq('creator_id', creatorId)
          .eq('status', 'active')
          .gte('expires_at', new Date().toISOString())
          .single();

        return !!data;
      }

      // Check if content was purchased
      const { data: purchase } = await supabase
        .from('content_purchases')
        .select('id')
        .eq('user_id', userId)
        .eq('file_path', filePath)
        .single();

      return !!purchase;
    } catch (error) {
      console.error('Access check error:', error);
      return false;
    }
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(bucket, filePath) {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([filePath]);

      if (error) throw error;

      // Remove from database
      await supabase
        .from('file_uploads')
        .delete()
        .eq('bucket_id', bucket)
        .eq('file_path', filePath);

      return true;
    } catch (error) {
      console.error('Delete error:', error);
      throw error;
    }
  }

  /**
   * List files in a bucket folder
   */
  async listFiles(bucket, folder, options = {}) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(folder, {
          limit: options.limit || 100,
          offset: options.offset || 0,
          sortBy: {
            column: options.sortBy || 'created_at',
            order: options.order || 'desc'
          }
        });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('List files error:', error);
      throw error;
    }
  }

  /**
   * Get user's storage usage
   */
  async getUserStorageUsage(userId) {
    try {
      const { data, error } = await supabase
        .rpc('get_user_storage_usage', { user_id: userId });

      if (error) throw error;

      const totalUsage = data.reduce((acc, bucket) => ({
        totalFiles: acc.totalFiles + parseInt(bucket.file_count),
        totalSize: acc.totalSize + parseInt(bucket.total_size),
        totalSizeMB: acc.totalSizeMB + parseFloat(bucket.total_size_mb)
      }), { totalFiles: 0, totalSize: 0, totalSizeMB: 0 });

      return {
        buckets: data,
        total: totalUsage
      };
    } catch (error) {
      console.error('Storage usage error:', error);
      throw error;
    }
  }

  /**
   * Move file between buckets
   */
  async moveFile(fromBucket, toBucket, filePath, newPath = null) {
    try {
      // Download file
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(fromBucket)
        .download(filePath);

      if (downloadError) throw downloadError;

      // Upload to new bucket
      const targetPath = newPath || filePath;
      const { error: uploadError } = await supabase.storage
        .from(toBucket)
        .upload(targetPath, fileData);

      if (uploadError) throw uploadError;

      // Delete from old bucket
      const { error: deleteError } = await supabase.storage
        .from(fromBucket)
        .remove([filePath]);

      if (deleteError) throw deleteError;

      return { success: true, newPath: targetPath };
    } catch (error) {
      console.error('Move file error:', error);
      throw error;
    }
  }

  /**
   * Process and optimize image
   */
  async resizeImage(buffer, dimensions) {
    try {
      return await sharp(buffer)
        .resize(dimensions.width, dimensions.height, {
          fit: 'cover',
          position: 'center'
        })
        .webp({ quality: 85 })
        .toBuffer();
    } catch (error) {
      console.error('Image resize error:', error);
      throw error;
    }
  }

  /**
   * Validate file before upload
   */
  validateFile(file, options = {}) {
    const errors = [];

    // Check file size
    if (options.maxSize && file.size > options.maxSize) {
      errors.push(`File size exceeds maximum allowed size of ${options.maxSize} bytes`);
    }

    // Check mime type
    if (options.allowedTypes && !options.allowedTypes.includes(file.mimetype)) {
      errors.push(`File type ${file.mimetype} is not allowed`);
    }

    // Check file extension
    if (options.allowedExtensions) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!options.allowedExtensions.includes(ext)) {
        errors.push(`File extension ${ext} is not allowed`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if bucket is public
   * SECURITY: Only profile pictures and basic metadata should be public
   * All paid/premium content must be private with signed URLs
   */
  isPublicBucket(bucket) {
    const publicBuckets = [
      this.buckets.PROFILE_PICTURES,
      this.buckets.CREATOR_BANNERS,
      this.buckets.STREAM_THUMBNAILS,
      this.buckets.VIRTUAL_GIFTS
      // REMOVED: SHOP_PRODUCTS - should be private for premium content
    ];
    return publicBuckets.includes(bucket);
  }

  /**
   * Check if bucket contains paid/premium content
   */
  isPaidContentBucket(bucket) {
    const paidContentBuckets = [
      this.buckets.CREATOR_CONTENT,
      this.buckets.MESSAGE_ATTACHMENTS,
      this.buckets.STREAM_RECORDINGS,
      this.buckets.SESSION_RECORDINGS,
      this.buckets.TICKETED_SHOWS,
      this.buckets.SHOP_PRODUCTS // Premium shop items need access control
    ];
    return paidContentBuckets.includes(bucket);
  }

  /**
   * Log content access
   */
  async logContentAccess(userId, contentType, contentId, filePath, accessType, req) {
    try {
      await supabase
        .from('content_access_logs')
        .insert({
          user_id: userId,
          content_type: contentType,
          content_id: contentId,
          file_path: filePath,
          access_type: accessType,
          ip_address: req.ip,
          user_agent: req.get('user-agent')
        });
    } catch (error) {
      console.error('Access log error:', error);
      // Don't throw - logging should not break the request
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanupTempFiles() {
    try {
      const buckets = [this.buckets.MESSAGE_ATTACHMENTS, this.buckets.CREATOR_CONTENT];
      
      for (const bucket of buckets) {
        const { data: files } = await supabase.storage
          .from(bucket)
          .list('temp', {
            limit: 100
          });

        if (files && files.length > 0) {
          const oldFiles = files.filter(file => {
            const createdAt = new Date(file.created_at);
            const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            return createdAt < dayAgo;
          });

          if (oldFiles.length > 0) {
            const filePaths = oldFiles.map(f => `temp/${f.name}`);
            await supabase.storage
              .from(bucket)
              .remove(filePaths);
          }
        }
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}

module.exports = new StorageManager();