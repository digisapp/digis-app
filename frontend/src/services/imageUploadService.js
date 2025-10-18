// Image upload service for avatars and creator cards
// Wraps uploadService with specialized methods for profile images

import { uploadService } from './uploadService';
import { devLog, devError } from '../utils/devLog';

/**
 * Upload avatar image (client has already cropped as PNG)
 * @param {File} file - Cropped avatar PNG file
 * @param {Function} [onProgress] - Progress callback (0-100)
 * @returns {Promise<string>} - Public URL of uploaded avatar
 */
export async function uploadAvatar(file, onProgress) {
  try {
    devLog('Uploading avatar...', {
      filename: file.name,
      size: `${(file.size / 1024).toFixed(2)}KB`,
      type: file.type
    });

    const result = await uploadService.uploadFile(file, {
      endpoint: '/uploads/avatar',
      type: 'image',
      compress: false, // Already processed on client
      onProgress
    });

    if (!result.success) {
      throw new Error(result.error || 'Avatar upload failed');
    }

    devLog('Avatar uploaded successfully:', result.url);
    return result.url;
  } catch (error) {
    devError('Avatar upload error:', error);
    throw error;
  }
}

/**
 * Upload creator card image (client has already cropped as JPEG)
 * @param {File} file - Cropped card JPEG file
 * @param {Function} [onProgress] - Progress callback (0-100)
 * @returns {Promise<string>} - Public URL of uploaded card
 */
export async function uploadCard(file, onProgress) {
  try {
    devLog('Uploading card image...', {
      filename: file.name,
      size: `${(file.size / 1024).toFixed(2)}KB`,
      type: file.type
    });

    const result = await uploadService.uploadFile(file, {
      endpoint: '/uploads/card',
      type: 'image',
      compress: false, // Already processed on client
      onProgress
    });

    if (!result.success) {
      throw new Error(result.error || 'Card upload failed');
    }

    devLog('Card uploaded successfully:', result.url);
    return result.url;
  } catch (error) {
    devError('Card upload error:', error);
    throw error;
  }
}
