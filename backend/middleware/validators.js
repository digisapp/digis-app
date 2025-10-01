const { body, param, query, validationResult } = require('express-validator');

// Custom validation middleware
const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value
      }))
    });
  };
};

// Common validators
const commonValidators = {
  isValidUUID: (field) => {
    return body(field)
      .isUUID()
      .withMessage(`${field} must be a valid UUID`);
  },
  
  isValidEmail: (field) => {
    return body(field)
      .isEmail()
      .normalizeEmail()
      .withMessage('Invalid email address');
  },
  
  isValidPhone: (field) => {
    return body(field)
      .optional()
      .isMobilePhone()
      .withMessage('Invalid phone number');
  },
  
  isValidURL: (field) => {
    return body(field)
      .optional()
      .isURL({ protocols: ['http', 'https'] })
      .withMessage('Invalid URL');
  },
  
  isPositiveInteger: (field) => {
    return body(field)
      .isInt({ min: 1 })
      .withMessage(`${field} must be a positive integer`);
  },
  
  isValidPrice: (field) => {
    return body(field)
      .isFloat({ min: 0, max: 999999.99 })
      .withMessage(`${field} must be a valid price`);
  },
  
  sanitizeString: (field) => {
    return body(field)
      .trim()
      .escape()
      .isLength({ min: 1, max: 1000 })
      .withMessage(`${field} must be between 1 and 1000 characters`);
  }
};

// Auth validators
const authValidators = {
  register: validate([
    body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain uppercase, lowercase, number and special character'),
    body('username')
      .optional()
      .isAlphanumeric()
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be 3-30 alphanumeric characters'),
    body('displayName')
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage('Display name must be 1-50 characters')
  ]),
  
  login: validate([
    body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
    body('password').notEmpty().withMessage('Password is required')
  ]),
  
  updateProfile: validate([
    body('displayName')
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage('Display name must be 1-50 characters'),
    body('bio')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Bio must be less than 500 characters'),
    body('photoURL')
      .optional()
      .isURL()
      .withMessage('Invalid photo URL')
  ])
};

// User validators
const userValidators = {
  updateUser: validate([
    param('userId').isUUID().withMessage('Invalid user ID'),
    body('displayName')
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage('Display name must be 1-50 characters'),
    body('bio')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Bio must be less than 500 characters'),
    body('isCreator')
      .optional()
      .isBoolean()
      .withMessage('isCreator must be a boolean')
  ]),
  
  getUser: validate([
    param('userId').isUUID().withMessage('Invalid user ID')
  ]),
  
  updateCreatorProfile: validate([
    body('bio')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Bio must be less than 1000 characters'),
    body('hourlyRate')
      .optional()
      .isFloat({ min: 0, max: 10000 })
      .withMessage('Hourly rate must be between 0 and 10000'),
    body('categories')
      .optional()
      .isArray()
      .withMessage('Categories must be an array'),
    body('socialLinks')
      .optional()
      .isObject()
      .withMessage('Social links must be an object')
  ])
};

// Payment validators
const paymentValidators = {
  createPaymentIntent: validate([
    body('amount')
      .isInt({ min: 50, max: 999999 })
      .withMessage('Amount must be between $0.50 and $9,999.99'),
    body('currency')
      .optional()
      .isIn(['usd', 'eur', 'gbp'])
      .withMessage('Invalid currency'),
    body('metadata')
      .optional()
      .isObject()
      .withMessage('Metadata must be an object')
  ]),
  
  confirmPayment: validate([
    body('paymentIntentId')
      .notEmpty()
      .withMessage('Payment intent ID is required')
      .matches(/^pi_/)
      .withMessage('Invalid payment intent ID format')
  ])
};

// Token validators
const tokenValidators = {
  purchaseTokens: validate([
    body('amount')
      .isInt({ min: 100, max: 100000 })
      .withMessage('Token amount must be between 100 and 100,000'),
    body('paymentMethodId')
      .notEmpty()
      .withMessage('Payment method is required')
      .matches(/^pm_/)
      .withMessage('Invalid payment method ID format')
  ]),
  
  transferTokens: validate([
    body('recipientId').isUUID().withMessage('Invalid recipient ID'),
    body('amount')
      .isInt({ min: 1, max: 100000 })
      .withMessage('Transfer amount must be between 1 and 100,000'),
    body('message')
      .optional()
      .isLength({ max: 200 })
      .withMessage('Message must be less than 200 characters')
  ])
};

// Session validators
const sessionValidators = {
  createSession: validate([
    body('creatorId').isUUID().withMessage('Invalid creator ID'),
    body('type')
      .isIn(['video', 'voice', 'chat'])
      .withMessage('Invalid session type'),
    body('duration')
      .optional()
      .isInt({ min: 1, max: 480 })
      .withMessage('Duration must be between 1 and 480 minutes')
  ]),
  
  endSession: validate([
    param('sessionId').isUUID().withMessage('Invalid session ID'),
    body('duration')
      .isInt({ min: 1 })
      .withMessage('Duration must be a positive integer')
  ])
};

// Message validators
const messageValidators = {
  sendMessage: validate([
    body('recipientId').isUUID().withMessage('Invalid recipient ID'),
    body('content')
      .isLength({ min: 1, max: 5000 })
      .withMessage('Message must be between 1 and 5000 characters'),
    body('type')
      .optional()
      .isIn(['text', 'image', 'video', 'audio', 'file'])
      .withMessage('Invalid message type')
  ]),
  
  getMessages: validate([
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ])
};

// Agora validators
const agoraValidators = {
  generateToken: validate([
    query('channel')
      .notEmpty()
      .withMessage('Channel name is required')
      .isLength({ min: 1, max: 64 })
      .withMessage('Channel name must be 1-64 characters')
      .matches(/^[a-zA-Z0-9!#$%&()+\-:;<=.>?@[\]^_{}|~, ]+$/)
      .withMessage('Invalid channel name format'),
    query('uid')
      .notEmpty()
      .withMessage('User ID is required'),
    query('role')
      .optional()
      .isIn(['publisher', 'subscriber'])
      .withMessage('Role must be either publisher or subscriber')
  ])
};

// Search validators
const searchValidators = {
  searchUsers: validate([
    query('q')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Search query must be 1-100 characters'),
    query('type')
      .optional()
      .isIn(['all', 'creators', 'users'])
      .withMessage('Invalid search type'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50')
  ])
};

// File upload validators
const fileValidators = {
  uploadImage: (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed' });
    }
    
    // Check file size (max 10MB)
    if (req.file.size > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size too large. Maximum 10MB allowed' });
    }
    
    next();
  },
  
  uploadVideo: (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Check file type
    const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type. Only MP4, WebM, and OGG are allowed' });
    }
    
    // Check file size (max 100MB)
    if (req.file.size > 100 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size too large. Maximum 100MB allowed' });
    }
    
    next();
  }
};

module.exports = {
  validate,
  commonValidators,
  authValidators,
  userValidators,
  paymentValidators,
  tokenValidators,
  sessionValidators,
  messageValidators,
  agoraValidators,
  searchValidators,
  fileValidators
};