const { body, param, query, validationResult } = require('express-validator');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Common validators
const validators = {
  // User validators
  userId: param('userId').isUUID().withMessage('Invalid user ID'),
  supabaseId: param('supabaseId').isUUID().withMessage('Invalid Supabase ID'),

  // Session validators
  sessionId: param('sessionId').isUUID().withMessage('Invalid session ID'),
  channelName: body('channelName').notEmpty().withMessage('Channel name is required'),

  // Token validators
  tokenAmount: body('amount').isInt({ min: 1 }).withMessage('Amount must be a positive integer'),
  tokenBalance: body('balance').isInt({ min: 0 }).withMessage('Balance must be non-negative'),

  // Payment validators
  paymentAmount: body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be positive'),
  stripeToken: body('token').notEmpty().withMessage('Payment token is required'),

  // Message validators
  messageContent: body('content').notEmpty().trim().withMessage('Message content is required'),
  messagePrice: body('price').optional().isInt({ min: 0 }).withMessage('Price must be non-negative'),

  // Pagination validators
  limit: query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  offset: query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),

  // Auth validators
  email: body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
  password: body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  username: body('username').optional().isAlphanumeric().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 alphanumeric characters')
};

// Validation chains for common operations
const validateCreateSession = [
  validators.channelName,
  handleValidationErrors
];

const validateTokenPurchase = [
  validators.tokenAmount,
  validators.stripeToken,
  handleValidationErrors
];

const validateSendMessage = [
  validators.messageContent,
  validators.messagePrice,
  handleValidationErrors
];

const validatePagination = [
  validators.limit,
  validators.offset,
  handleValidationErrors
];

const validateUserRegistration = [
  validators.email,
  validators.password,
  validators.username,
  handleValidationErrors
];

const validateLogin = [
  validators.email,
  validators.password,
  handleValidationErrors
];

// Session invite validation
const validateSessionInvite = [
  body('type').isIn(['video', 'voice']).withMessage('Invalid session type'),
  body('sessionType').optional().isIn(['instant', 'scheduled']).withMessage('Invalid session type'),
  body('fanId').optional().isUUID().withMessage('Invalid fan ID'),
  body('duration').optional().isInt({ min: 1 }).withMessage('Invalid duration'),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validators,
  validateCreateSession,
  validateTokenPurchase,
  validateSendMessage,
  validatePagination,
  validateUserRegistration,
  validateLogin,
  validateSessionInvite
};