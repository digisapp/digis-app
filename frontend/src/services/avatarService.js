// Avatar Service Layer
// Centralized avatar management with caching and optimization

import { generateAvatar, generateAvatarBlob, getAvatarUrl, generatePlaceholder } from '../utils/avatarGenerator';
import { supabase } from '../utils/supabase-auth';

class AvatarService {
  constructor() {
    // In-memory cache for generated avatars
    this.cache = new Map();
    this.cacheMaxSize = 100;
    this.cacheTimeout = 3600000; // 1 hour
    
    // Pending uploads to avoid duplicates
    this.pendingUploads = new Map();
    
    // Initialize with localStorage cache if available
    this.loadLocalCache();
  }

  /**
   * Load cached avatars from localStorage
   */
  loadLocalCache() {
    try {
      const cached = localStorage.getItem('avatar_cache');
      if (cached) {
        const data = JSON.parse(cached);
        if (data.version === '1.0' && data.avatars) {
          data.avatars.forEach(([key, value]) => {
            if (Date.now() - value.timestamp < this.cacheTimeout) {
              this.cache.set(key, value);
            }
          });
        }
      }
    } catch (error) {
      console.warn('Failed to load avatar cache:', error);
    }
  }

  /**
   * Save cache to localStorage
   */
  saveLocalCache() {
    try {
      const data = {
        version: '1.0',
        avatars: Array.from(this.cache.entries()).slice(0, 50) // Limit localStorage size
      };
      localStorage.setItem('avatar_cache', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save avatar cache:', error);
    }
  }

  /**
   * Get cache key for user
   */
  getCacheKey(user, size = 200) {
    const id = user?.id || user?.supabase_id || user?.username || 'unknown';
    const category = user?.creator_type || 'default';
    return `${id}_${category}_${size}`;
  }

  /**
   * Get avatar URL with intelligent caching and fallback
   */
  async getAvatar(user, options = {}) {
    const {
      size = 200,
      shape = 'circle',
      forceRegenerate = false,
      uploadToStorage = false
    } = options;

    // Return existing URL if available and not forcing regeneration
    if (!forceRegenerate && (user?.profile_pic_url || user?.avatar_url)) {
      return user.profile_pic_url || user.avatar_url;
    }

    const cacheKey = this.getCacheKey(user, size);

    // Check cache first
    if (!forceRegenerate && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.url;
      }
      this.cache.delete(cacheKey);
    }

    // Generate new avatar
    const username = user?.username || user?.display_name || 'User';
    const category = user?.creator_type || user?.category || null;
    const avatarUrl = generateAvatar(username, category, size, shape);

    // Cache the result
    const cacheEntry = {
      url: avatarUrl,
      timestamp: Date.now(),
      size,
      shape
    };
    this.cache.set(cacheKey, cacheEntry);

    // Limit cache size
    if (this.cache.size > this.cacheMaxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    // Save to localStorage periodically
    this.saveLocalCache();

    // Upload to storage if requested (for permanent storage)
    if (uploadToStorage && user?.id) {
      this.uploadAvatarToStorage(user, avatarUrl, size, shape);
    }

    return avatarUrl;
  }

  /**
   * Upload generated avatar to Supabase storage
   */
  async uploadAvatarToStorage(user, avatarDataUrl, size, shape) {
    const uploadKey = `${user.id}_${size}`;
    
    // Check if already uploading
    if (this.pendingUploads.has(uploadKey)) {
      return this.pendingUploads.get(uploadKey);
    }

    const uploadPromise = (async () => {
      try {
        // Convert data URL to blob
        const username = user.username || user.display_name || 'User';
        const category = user.creator_type || null;
        const blob = await generateAvatarBlob(username, category, size, shape);
        
        // Upload to Supabase storage
        const fileName = `${user.id}/avatar_${size}.png`;
        const { data, error } = await supabase.storage
          .from('avatars')
          .upload(fileName, blob, {
            contentType: 'image/png',
            upsert: true
          });

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);

        // Update cache with permanent URL
        const cacheKey = this.getCacheKey(user, size);
        this.cache.set(cacheKey, {
          url: publicUrl,
          timestamp: Date.now(),
          size,
          shape,
          permanent: true
        });

        return publicUrl;
      } catch (error) {
        console.error('Failed to upload avatar to storage:', error);
        return avatarDataUrl; // Return data URL as fallback
      } finally {
        this.pendingUploads.delete(uploadKey);
      }
    })();

    this.pendingUploads.set(uploadKey, uploadPromise);
    return uploadPromise;
  }

  /**
   * Get multiple avatar sizes for responsive images
   */
  async getResponsiveAvatars(user, sizes = [150, 400, 800]) {
    const avatars = {};
    
    for (const size of sizes) {
      avatars[`${size}w`] = await this.getAvatar(user, { size });
    }
    
    return avatars;
  }

  /**
   * Generate placeholder for loading state
   */
  getPlaceholder(user) {
    const colors = {
      'Fitness': '#FF6B6B',
      'Wellness': '#10B981',
      'Fashion': '#EC4899',
      'Business': '#3B82F6',
      'Creative': '#8B5CF6',
      'default': '#14B8A6'
    };
    
    const category = user?.creator_type || 'default';
    const color = colors[category] || colors.default;
    
    return generatePlaceholder(color);
  }

  /**
   * Validate and sanitize external avatar URLs
   */
  validateAvatarUrl(url) {
    if (!url) return null;
    
    // Check if it's a data URL (safe)
    if (url.startsWith('data:image/')) {
      return url;
    }
    
    try {
      const urlObj = new URL(url);
      
      // Whitelist trusted domains
      const trustedDomains = [
        'supabase.co',
        'supabase.io',
        'googleusercontent.com',
        'cloudinary.com',
        'imgix.net'
      ];
      
      const hostname = urlObj.hostname.toLowerCase();
      const isTrusted = trustedDomains.some(domain => 
        hostname.endsWith(domain)
      );
      
      if (isTrusted) {
        // Ensure HTTPS
        urlObj.protocol = 'https:';
        return urlObj.toString();
      }
      
      return null; // Untrusted URL
    } catch (error) {
      return null; // Invalid URL
    }
  }

  /**
   * Clear cache for a specific user
   */
  clearUserCache(userId) {
    const keysToDelete = [];
    
    for (const [key, value] of this.cache.entries()) {
      if (key.startsWith(userId)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    this.saveLocalCache();
  }

  /**
   * Clear all cached avatars
   */
  clearAllCache() {
    this.cache.clear();
    localStorage.removeItem('avatar_cache');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    let totalSize = 0;
    let expiredCount = 0;
    const now = Date.now();
    
    for (const [key, value] of this.cache.entries()) {
      // Rough estimate of data URL size
      totalSize += value.url.length;
      
      if (now - value.timestamp > this.cacheTimeout) {
        expiredCount++;
      }
    }
    
    return {
      entries: this.cache.size,
      sizeKB: Math.round(totalSize / 1024),
      expired: expiredCount,
      maxSize: this.cacheMaxSize
    };
  }
}

// Create singleton instance
const avatarService = new AvatarService();

// Export service instance and methods
export default avatarService;

export {
  avatarService,
  generateAvatar,
  getAvatarUrl
};