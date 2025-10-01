// Upload service with image compression and progress tracking
// Reduces bandwidth usage and improves upload speeds

import { apiClient } from '../utils/apiClient';
import { devLog, devError } from '../utils/devLog';

// Configuration
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_AUDIO_SIZE = 20 * 1024 * 1024; // 20MB
const DEFAULT_IMAGE_QUALITY = 0.85;
const DEFAULT_MAX_WIDTH = 1920;
const DEFAULT_MAX_HEIGHT = 1920;

// Allowed MIME types
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif'
];

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime'
];

const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/webm',
  'audio/ogg'
];

class UploadService {
  constructor() {
    this.activeUploads = new Map();
  }

  /**
   * Compress an image file
   * @param {File} file - Original image file
   * @param {Object} options - Compression options
   * @returns {Promise<Blob>} - Compressed image blob
   */
  async compressImage(file, options = {}) {
    const {
      maxWidth = DEFAULT_MAX_WIDTH,
      maxHeight = DEFAULT_MAX_HEIGHT,
      quality = DEFAULT_IMAGE_QUALITY,
      format = 'image/jpeg'
    } = options;

    devLog('Compressing image:', {
      originalSize: (file.size / 1024 / 1024).toFixed(2) + 'MB',
      type: file.type
    });

    try {
      // Convert HEIC/HEIF to JPEG for compatibility
      const shouldConvert = file.type === 'image/heic' || file.type === 'image/heif';
      const outputFormat = shouldConvert ? 'image/jpeg' : format;

      // Create image bitmap
      const bitmap = await createImageBitmap(file);

      // Calculate new dimensions
      let { width, height } = bitmap;

      if (width > maxWidth || height > maxHeight) {
        const aspectRatio = width / height;

        if (width > maxWidth) {
          width = maxWidth;
          height = width / aspectRatio;
        }

        if (height > maxHeight) {
          height = maxHeight;
          width = height * aspectRatio;
        }
      }

      // Use OffscreenCanvas for better performance
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // Draw and compress
      ctx.drawImage(bitmap, 0, 0, width, height);

      const blob = await canvas.convertToBlob({
        type: outputFormat,
        quality
      });

      devLog('Image compressed:', {
        newSize: (blob.size / 1024 / 1024).toFixed(2) + 'MB',
        compression: ((1 - blob.size / file.size) * 100).toFixed(1) + '%',
        dimensions: `${width}x${height}`
      });

      return blob;
    } catch (error) {
      devError('Image compression failed:', error);
      // Return original file as blob if compression fails
      return file;
    }
  }

  /**
   * Validate file before upload
   * @param {File} file - File to validate
   * @param {string} type - Expected file type (image/video/audio)
   * @returns {Object} - { valid: boolean, error?: string }
   */
  validateFile(file, type) {
    if (!file) {
      return { valid: false, error: 'No file provided' };
    }

    // Check MIME type
    let allowedTypes, maxSize;

    switch (type) {
      case 'image':
        allowedTypes = ALLOWED_IMAGE_TYPES;
        maxSize = MAX_IMAGE_SIZE;
        break;
      case 'video':
        allowedTypes = ALLOWED_VIDEO_TYPES;
        maxSize = MAX_VIDEO_SIZE;
        break;
      case 'audio':
        allowedTypes = ALLOWED_AUDIO_TYPES;
        maxSize = MAX_AUDIO_SIZE;
        break;
      default:
        return { valid: false, error: 'Invalid file type' };
    }

    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type not allowed. Accepted types: ${allowedTypes.join(', ')}`
      };
    }

    // Check file size
    if (file.size > maxSize) {
      const maxSizeMB = maxSize / 1024 / 1024;
      return {
        valid: false,
        error: `File too large. Maximum size: ${maxSizeMB}MB`
      };
    }

    return { valid: true };
  }

  /**
   * Upload a file with progress tracking
   * @param {File|Blob} file - File or blob to upload
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} - Upload result
   */
  async uploadFile(file, options = {}) {
    const {
      endpoint,
      onProgress,
      additionalData = {},
      compress = true,
      type = 'image'
    } = options;

    const uploadId = Math.random().toString(36).substr(2, 9);

    try {
      // Validate file
      if (file instanceof File) {
        const validation = this.validateFile(file, type);
        if (!validation.valid) {
          throw new Error(validation.error);
        }
      }

      // Compress image if needed
      let uploadBlob = file;
      if (compress && type === 'image' && file.size > 500 * 1024) { // Compress if > 500KB
        uploadBlob = await this.compressImage(file);
      }

      // Create FormData
      const formData = new FormData();
      formData.append('file', uploadBlob, file.name || 'upload');

      // Add additional data
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value);
      });

      // Create abort controller
      const abortController = new AbortController();
      this.activeUploads.set(uploadId, abortController);

      // Upload with progress
      const response = await this.uploadWithProgress(
        endpoint,
        formData,
        {
          signal: abortController.signal,
          onProgress: (progress) => {
            devLog(`Upload progress (${uploadId}):`, progress + '%');
            onProgress?.(progress);
          }
        }
      );

      // Clean up
      this.activeUploads.delete(uploadId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Upload failed');
      }

      const result = await response.json();
      devLog('Upload successful:', result);

      return {
        success: true,
        ...result
      };
    } catch (error) {
      // Clean up on error
      this.activeUploads.delete(uploadId);

      if (error.name === 'AbortError') {
        devLog('Upload cancelled:', uploadId);
        return { success: false, cancelled: true };
      }

      devError('Upload failed:', error);
      throw error;
    }
  }

  /**
   * Upload with XMLHttpRequest for progress tracking
   * @private
   */
  uploadWithProgress(url, formData, options = {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const { signal, onProgress } = options;

      // Handle abort
      if (signal) {
        signal.addEventListener('abort', () => {
          xhr.abort();
          reject(new DOMException('Aborted', 'AbortError'));
        });
      }

      // Progress handler
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      });

      // Complete handler
      xhr.addEventListener('load', () => {
        const response = new Response(xhr.response, {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: new Headers({ 'Content-Type': 'application/json' })
        });
        resolve(response);
      });

      // Error handler
      xhr.addEventListener('error', () => {
        reject(new Error('Network error'));
      });

      // Open and send
      const fullUrl = url.startsWith('http') ? url : `${import.meta.env.VITE_BACKEND_URL}${url}`;
      xhr.open('POST', fullUrl);

      // Add auth header
      const token = localStorage.getItem('accessToken');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.send(formData);
    });
  }

  /**
   * Cancel an active upload
   * @param {string} uploadId - Upload ID to cancel
   */
  cancelUpload(uploadId) {
    const controller = this.activeUploads.get(uploadId);
    if (controller) {
      controller.abort();
      this.activeUploads.delete(uploadId);
      return true;
    }
    return false;
  }

  /**
   * Cancel all active uploads
   */
  cancelAllUploads() {
    this.activeUploads.forEach((controller) => {
      controller.abort();
    });
    this.activeUploads.clear();
  }

  /**
   * Upload multiple files
   * @param {FileList|File[]} files - Files to upload
   * @param {Object} options - Upload options
   * @returns {Promise<Object[]>} - Upload results
   */
  async uploadMultiple(files, options = {}) {
    const filesArray = Array.from(files);
    const results = [];

    for (const file of filesArray) {
      try {
        const result = await this.uploadFile(file, {
          ...options,
          onProgress: (progress) => {
            const index = filesArray.indexOf(file);
            const totalProgress = ((index * 100) + progress) / filesArray.length;
            options.onTotalProgress?.(totalProgress);
            options.onProgress?.(progress, index);
          }
        });
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          file: file.name
        });
      }
    }

    return results;
  }

  /**
   * Helper to create a file picker
   * @param {Object} options - Picker options
   * @returns {Promise<File[]>} - Selected files
   */
  async pickFiles(options = {}) {
    const {
      accept = 'image/*',
      multiple = false,
      capture = false
    } = options;

    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.multiple = multiple;

      if (capture) {
        input.capture = 'environment';
      }

      input.addEventListener('change', (event) => {
        const files = Array.from(event.target.files || []);
        resolve(files);
      });

      input.click();
    });
  }

  /**
   * Convert data URL to Blob
   * @param {string} dataURL - Data URL to convert
   * @returns {Blob} - Blob object
   */
  dataURLToBlob(dataURL) {
    const [header, data] = dataURL.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const binary = atob(data);
    const array = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }

    return new Blob([array], { type: mime });
  }
}

// Export singleton instance
export const uploadService = new UploadService();

// Export for testing
export { UploadService };