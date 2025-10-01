/**
 * Input Sanitization Middleware
 * Prevents XSS attacks by sanitizing user inputs
 */

const validator = require('validator');
const xss = require('xss');

// XSS options for different content types
const xssOptions = {
  // Strict mode - removes all HTML
  strict: {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style']
  },
  // Basic mode - allows basic formatting
  basic: {
    whiteList: {
      a: ['href', 'title', 'target'],
      b: [],
      i: [],
      em: [],
      strong: [],
      p: [],
      br: []
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style']
  },
  // Rich mode - for user-generated content
  rich: {
    whiteList: {
      a: ['href', 'title', 'target'],
      b: [], i: [], em: [], strong: [],
      p: [], br: [], hr: [],
      h1: [], h2: [], h3: [], h4: [], h5: [], h6: [],
      ul: [], ol: [], li: [],
      blockquote: [], code: [], pre: [],
      img: ['src', 'alt', 'title', 'width', 'height']
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style'],
    onTag: function(tag, html, options) {
      // Remove dangerous attributes
      if (tag === 'a') {
        html = html.replace(/javascript:/gi, '');
        html = html.replace(/vbscript:/gi, '');
      }
      return html;
    }
  }
};

// Sanitize individual value based on type
const sanitizeValue = (value, type = 'strict') => {
  if (value === null || value === undefined) return value;

  // Handle different data types
  if (typeof value === 'string') {
    // Remove any null bytes
    value = value.replace(/\0/g, '');

    // Apply XSS protection
    const options = xssOptions[type] || xssOptions.strict;
    value = xss(value, options);

    // Additional sanitization
    value = validator.escape(value); // Escape HTML entities
    value = value.trim(); // Remove leading/trailing whitespace

    // Remove potential SQL injection patterns (belt and suspenders)
    value = value.replace(/(\-\-|;|\/\*|\*\/)/g, '');

    return value;
  } else if (typeof value === 'object' && value !== null) {
    // Recursively sanitize objects
    if (Array.isArray(value)) {
      return value.map(item => sanitizeValue(item, type));
    } else {
      const sanitized = {};
      for (const key in value) {
        if (value.hasOwnProperty(key)) {
          // Sanitize the key itself
          const sanitizedKey = sanitizeValue(key, 'strict');
          sanitized[sanitizedKey] = sanitizeValue(value[key], type);
        }
      }
      return sanitized;
    }
  }

  return value;
};

// Middleware to sanitize request data
const sanitizeInput = (options = {}) => {
  const {
    body: bodyType = 'strict',
    query: queryType = 'strict',
    params: paramsType = 'strict',
    headers: headersType = 'strict',
    skipFields = [], // Fields to skip sanitization
    customSanitizers = {} // Custom sanitizers for specific fields
  } = options;

  return (req, res, next) => {
    try {
      // Sanitize body
      if (req.body && Object.keys(req.body).length > 0) {
        for (const key in req.body) {
          if (skipFields.includes(key)) continue;

          if (customSanitizers[key]) {
            req.body[key] = customSanitizers[key](req.body[key]);
          } else {
            req.body[key] = sanitizeValue(req.body[key], bodyType);
          }
        }
      }

      // Sanitize query parameters
      if (req.query && Object.keys(req.query).length > 0) {
        for (const key in req.query) {
          if (skipFields.includes(key)) continue;

          req.query[key] = sanitizeValue(req.query[key], queryType);
        }
      }

      // Sanitize URL parameters
      if (req.params && Object.keys(req.params).length > 0) {
        for (const key in req.params) {
          if (skipFields.includes(key)) continue;

          req.params[key] = sanitizeValue(req.params[key], paramsType);
        }
      }

      // Optionally sanitize headers (be careful with this)
      if (options.sanitizeHeaders) {
        const safeHeaders = ['x-custom-header', 'x-request-id'];
        for (const header of safeHeaders) {
          if (req.headers[header]) {
            req.headers[header] = sanitizeValue(req.headers[header], headersType);
          }
        }
      }

      next();
    } catch (error) {
      console.error('Sanitization error:', error);
      res.status(400).json({
        error: 'Invalid input data',
        message: 'Request contains invalid or malicious content'
      });
    }
  };
};

// Specific sanitizers for common use cases
const sanitizers = {
  // Email sanitization
  email: (value) => {
    if (!value) return '';
    value = value.toLowerCase().trim();
    return validator.isEmail(value) ? validator.normalizeEmail(value) : '';
  },

  // Username sanitization (alphanumeric + underscore only)
  username: (value) => {
    if (!value) return '';
    return value.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 30);
  },

  // URL sanitization
  url: (value) => {
    if (!value) return '';
    value = value.trim();
    return validator.isURL(value) ? value : '';
  },

  // Phone sanitization
  phone: (value) => {
    if (!value) return '';
    return value.replace(/[^0-9+\-() ]/g, '').substring(0, 20);
  },

  // Numeric sanitization
  numeric: (value) => {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  },

  // Boolean sanitization
  boolean: (value) => {
    return value === true || value === 'true' || value === '1' || value === 1;
  },

  // Date sanitization
  date: (value) => {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date.toISOString();
  },

  // MongoDB ObjectId sanitization (keep for reference, not used in PostgreSQL)
  objectId: (value) => {
    if (!value) return '';
    return validator.isMongoId(value) ? value : '';
  },

  // UUID sanitization
  uuid: (value) => {
    if (!value) return '';
    return validator.isUUID(value) ? value : '';
  },

  // JSON sanitization
  json: (value) => {
    try {
      const parsed = JSON.parse(value);
      return sanitizeValue(parsed, 'strict');
    } catch {
      return {};
    }
  }
};

// Validation helpers
const validators = {
  isEmail: validator.isEmail,
  isURL: validator.isURL,
  isUUID: validator.isUUID,
  isNumeric: validator.isNumeric,
  isAlphanumeric: validator.isAlphanumeric,
  isMobilePhone: validator.isMobilePhone,
  isStrongPassword: (password) => {
    return validator.isStrongPassword(password, {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1
    });
  }
};

module.exports = {
  sanitizeValue,
  sanitizeInput,
  sanitizers,
  validators,
  xssOptions
};