/**
 * Input sanitization utilities for security
 * Prevents XSS attacks in user-generated content
 */

/**
 * Sanitize HTML input to prevent XSS attacks
 * @param {string} input - Raw input string
 * @returns {string} Sanitized string safe for display
 */
export const sanitizeHtml = (input) => {
  if (!input || typeof input !== 'string') return '';

  // Basic HTML entity encoding for display
  const entityMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return String(input).replace(/[&<>"'/]/g, (s) => entityMap[s]);
};

/**
 * Sanitize text for chat messages
 * Allows basic formatting but prevents scripts
 * @param {string} message - Chat message
 * @returns {string} Sanitized message
 */
export const sanitizeChatMessage = (message) => {
  if (!message || typeof message !== 'string') return '';

  // Remove any script tags or event handlers
  let sanitized = message
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');

  // Encode remaining HTML entities
  return sanitizeHtml(sanitized);
};

/**
 * Validate and sanitize username
 * @param {string} username - User input username
 * @returns {string} Sanitized username
 */
export const sanitizeUsername = (username) => {
  if (!username || typeof username !== 'string') return '';

  // Remove any HTML/special characters, keep alphanumeric, spaces, and basic punctuation
  return username
    .replace(/[<>\"'\/\\]/g, '')
    .trim()
    .substring(0, 50); // Limit length
};

/**
 * Sanitize stream title
 * @param {string} title - Stream title
 * @returns {string} Sanitized title
 */
export const sanitizeStreamTitle = (title) => {
  if (!title || typeof title !== 'string') return '';

  // Remove HTML but allow basic punctuation
  return title
    .replace(/<[^>]*>/g, '')
    .replace(/[<>\"']/g, '')
    .trim()
    .substring(0, 100); // Limit length
};

/**
 * Sanitize URL for safe usage
 * @param {string} url - URL string
 * @returns {string} Sanitized URL or empty string if invalid
 */
export const sanitizeUrl = (url) => {
  if (!url || typeof url !== 'string') return '';

  try {
    const urlObj = new URL(url);
    // Only allow http(s) protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return '';
    }
    return urlObj.toString();
  } catch {
    return '';
  }
};

/**
 * Check if content contains potential XSS patterns
 * @param {string} content - Content to check
 * @returns {boolean} True if potentially dangerous
 */
export const containsXssPattern = (content) => {
  if (!content || typeof content !== 'string') return false;

  const xssPatterns = [
    /<script[\s\S]*?<\/script>/gi,
    /<iframe[\s\S]*?<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<embed/gi,
    /<object/gi,
    /eval\(/gi,
    /expression\(/gi,
    /vbscript:/gi,
    /data:text\/html/gi,
  ];

  return xssPatterns.some(pattern => pattern.test(content));
};

/**
 * Sanitize object keys and values recursively
 * @param {object} obj - Object to sanitize
 * @returns {object} Sanitized object
 */
export const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const sanitizedKey = sanitizeHtml(key);
    if (typeof value === 'string') {
      sanitized[sanitizedKey] = sanitizeHtml(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[sanitizedKey] = sanitizeObject(value);
    } else {
      sanitized[sanitizedKey] = value;
    }
  }
  return sanitized;
};

// Export all functions as default object too
export default {
  sanitizeHtml,
  sanitizeChatMessage,
  sanitizeUsername,
  sanitizeStreamTitle,
  sanitizeUrl,
  containsXssPattern,
  sanitizeObject,
};