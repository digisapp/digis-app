// Centralized stream utilities to avoid duplication across components

/**
 * Format duration from seconds to human-readable format
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration (e.g., "2:45:30" or "45:30")
 */
export const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Format viewer count with K/M suffixes
 * @param {number} count - Viewer count
 * @returns {string} Formatted count (e.g., "1.2K", "2.5M")
 */
export const formatViewerCount = (count) => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
};

/**
 * Throttle function execution
 * @param {Function} func - Function to throttle
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Throttled function
 */
export const throttle = (func, delay) => {
  let lastCall = 0;
  let timeoutId = null;

  return (...args) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        func(...args);
        timeoutId = null;
      }, delay - (now - lastCall));
    }
  };
};

/**
 * Debounce function execution
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * Generate unique stream ID
 * @returns {string} Unique stream ID
 */
export const generateStreamId = () => {
  return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Check if device is mobile
 * @returns {boolean} True if mobile device
 */
export const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.matchMedia && window.matchMedia("(max-width: 768px)").matches);
};

/**
 * Check if device supports haptic feedback
 * @returns {boolean} True if haptic feedback is supported
 */
export const supportsHaptics = () => {
  return 'vibrate' in navigator;
};

/**
 * Trigger haptic feedback
 * @param {number} duration - Vibration duration in ms
 */
export const triggerHaptic = (duration = 50) => {
  if (supportsHaptics()) {
    navigator.vibrate(duration);
  }
};

/**
 * Calculate token cost for stream duration
 * @param {number} minutes - Stream duration in minutes
 * @param {number} ratePerMinute - Token rate per minute
 * @returns {number} Total token cost
 */
export const calculateTokenCost = (minutes, ratePerMinute) => {
  return Math.ceil(minutes * ratePerMinute);
};

/**
 * Validate stream title
 * @param {string} title - Stream title
 * @returns {boolean} True if valid
 */
export const validateStreamTitle = (title) => {
  return title && title.trim().length >= 3 && title.trim().length <= 100;
};

/**
 * Get optimal video constraints for device
 * @param {boolean} isMobile - Is mobile device
 * @param {boolean} isPortrait - Is portrait orientation
 * @returns {object} Video constraints for getUserMedia
 */
export const getVideoConstraints = (isMobile, isPortrait) => {
  if (isMobile) {
    return {
      facingMode: 'user',
      width: isPortrait ? { ideal: 720, max: 1080 } : { ideal: 1280, max: 1920 },
      height: isPortrait ? { ideal: 1280, max: 1920 } : { ideal: 720, max: 1080 },
      aspectRatio: isPortrait ? 9/16 : 16/9,
      frameRate: { ideal: 30, max: 30 }
    };
  }

  return {
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    aspectRatio: 16/9,
    frameRate: { ideal: 30, max: 60 }
  };
};

/**
 * Format token amount with commas
 * @param {number} amount - Token amount
 * @returns {string} Formatted amount
 */
export const formatTokenAmount = (amount) => {
  return amount.toLocaleString();
};

/**
 * Get stream quality label
 * @param {string} quality - Quality setting
 * @returns {string} Human-readable quality label
 */
export const getQualityLabel = (quality) => {
  const labels = {
    '480p': 'SD',
    '720p': 'HD',
    '1080p': 'Full HD',
    '1440p': '2K',
    '2160p': '4K',
    'auto': 'Auto'
  };
  return labels[quality] || quality;
};

/**
 * Calculate engagement rate
 * @param {number} messages - Number of messages
 * @param {number} viewers - Number of viewers
 * @param {number} duration - Duration in seconds
 * @returns {number} Engagement rate percentage
 */
export const calculateEngagementRate = (messages, viewers, duration) => {
  if (!viewers || !duration) return 0;
  const messagesPerViewer = messages / viewers;
  const messagesPerMinute = messages / (duration / 60);
  return Math.min(100, Math.round((messagesPerViewer * messagesPerMinute) * 10));
};

/**
 * Parse stream URL for channel/username
 * @param {string} url - Stream URL
 * @returns {string|null} Channel/username or null
 */
export const parseStreamUrl = (url) => {
  const match = url.match(/\/stream\/([^/]+)/);
  return match ? match[1] : null;
};

/**
 * Format relative time
 * @param {Date|number} timestamp - Timestamp
 * @returns {string} Relative time (e.g., "2 minutes ago")
 */
export const formatRelativeTime = (timestamp) => {
  const now = Date.now();
  const time = timestamp instanceof Date ? timestamp.getTime() : timestamp;
  const diff = now - time;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (seconds > 0) return `${seconds} second${seconds > 1 ? 's' : ''} ago`;
  return 'Just now';
};