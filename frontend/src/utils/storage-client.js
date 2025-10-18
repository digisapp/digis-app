import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

class StorageClient {
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
  }

  /**
   * Upload file directly to Supabase Storage
   */
  async uploadFile(bucket, path, file, options = {}) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: options.cacheControl || '3600',
          upsert: options.upsert || false,
          contentType: file.type
        });

      if (error) throw error;

      // Get public URL for public buckets
      if (this.isPublicBucket(bucket)) {
        const { data: { publicUrl } } = supabase.storage
          .from(bucket)
          .getPublicUrl(path);
        
        return { ...data, publicUrl };
      }

      return data;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  }

  /**
   * Upload via backend API (with processing)
   */
  async uploadViaAPI(endpoint, formData, options = {}) {
    try {
      const token = await this.getAuthToken();
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/storage/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          ...options.headers
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      return await response.json();
    } catch (error) {
      console.error('API upload error:', error);
      throw error;
    }
  }

  /**
   * Upload profile picture
   */
  async uploadProfilePicture(file) {
    const formData = new FormData();
    formData.append('image', file);
    
    return this.uploadViaAPI('profile-picture', formData);
  }

  /**
   * Upload creator banner
   */
  async uploadCreatorBanner(file) {
    const formData = new FormData();
    formData.append('banner', file);
    
    return this.uploadViaAPI('creator-banner', formData);
  }

  /**
   * Upload creator content
   */
  async uploadCreatorContent(files, metadata) {
    const formData = new FormData();
    
    // Add files
    files.forEach(file => {
      formData.append('files', file);
    });
    
    // Add metadata
    Object.keys(metadata).forEach(key => {
      formData.append(key, metadata[key]);
    });
    
    return this.uploadViaAPI('creator-content', formData);
  }

  /**
   * Upload message attachment
   */
  async uploadMessageAttachment(file) {
    const formData = new FormData();
    formData.append('attachment', file);
    
    return this.uploadViaAPI('message-attachment', formData);
  }

  /**
   * Upload shop product images
   */
  async uploadShopProductImages(files) {
    const formData = new FormData();
    
    files.forEach(file => {
      formData.append('images', file);
    });
    
    return this.uploadViaAPI('shop-product', formData);
  }

  /**
   * Get signed URL for private content
   */
  async getSignedUrl(bucket, path, expiresIn = 3600) {
    try {
      const token = await this.getAuthToken();
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/storage/signed-url`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bucket,
          path,
          expires_in: expiresIn
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get signed URL');
      }

      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error('Signed URL error:', error);
      throw error;
    }
  }

  /**
   * Delete file
   */
  async deleteFile(bucket, path) {
    try {
      const token = await this.getAuthToken();
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/storage/file`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bucket, path })
      });

      if (!response.ok) {
        throw new Error('Failed to delete file');
      }

      return await response.json();
    } catch (error) {
      console.error('Delete file error:', error);
      throw error;
    }
  }

  /**
   * List user's files
   */
  async listMyFiles(bucket, options = {}) {
    try {
      const token = await this.getAuthToken();
      const params = new URLSearchParams(options);
      
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/storage/my-files/${bucket}?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to list files');
      }

      return await response.json();
    } catch (error) {
      console.error('List files error:', error);
      throw error;
    }
  }

  /**
   * Get storage usage
   */
  async getStorageUsage() {
    try {
      const token = await this.getAuthToken();
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/storage/usage`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get storage usage');
      }

      return await response.json();
    } catch (error) {
      console.error('Storage usage error:', error);
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
      errors.push(`File size exceeds ${this.formatFileSize(options.maxSize)}`);
    }

    // Check file type
    if (options.acceptedTypes && !options.acceptedTypes.includes(file.type)) {
      errors.push(`File type ${file.type} is not allowed`);
    }

    // Check file extension
    if (options.acceptedExtensions) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!options.acceptedExtensions.includes(`.${ext}`)) {
        errors.push(`File extension .${ext} is not allowed`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Generate thumbnail preview
   */
  generateThumbnail(file, maxWidth = 200, maxHeight = 200) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('File is not an image'));
        return;
      }

      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Calculate new dimensions
          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob((blob) => {
            resolve({
              blob,
              dataUrl: canvas.toDataURL('image/jpeg', 0.8),
              width,
              height
            });
          }, 'image/jpeg', 0.8);
        };
        
        img.onerror = reject;
        img.src = e.target.result;
      };
      
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Check if bucket is public
   */
  isPublicBucket(bucket) {
    const publicBuckets = [
      this.buckets.PROFILE_PICTURES,
      this.buckets.CREATOR_BANNERS,
      this.buckets.STREAM_THUMBNAILS,
      this.buckets.SHOP_PRODUCTS,
      this.buckets.VIRTUAL_GIFTS
    ];
    return publicBuckets.includes(bucket);
  }

  /**
   * Get auth token
   */
  async getAuthToken() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }
    return session.access_token;
  }

  /**
   * Upload with progress tracking
   */
  async uploadWithProgress(endpoint, formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const percentComplete = (e.loaded / e.total) * 100;
          onProgress(percentComplete);
        }
      });
      
      xhr.addEventListener('load', async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (e) {
            reject(new Error('Invalid response'));
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });
      
      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });
      
      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'));
      });
      
      this.getAuthToken().then(token => {
        xhr.open('POST', `${import.meta.env.VITE_BACKEND_URL}/storage/${endpoint}`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      }).catch(reject);
    });
  }
}

export default new StorageClient();