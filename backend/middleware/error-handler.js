/**
 * Enhanced Error Handler with User-Friendly Messages
 * Provides consistent error responses with stack redaction in production
 */

const { logger } = require('../utils/secureLogger');
const Sentry = require('@sentry/node');

/**
 * Custom error class for application errors
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * User-friendly error messages mapped to error codes
 */
const UserFriendlyMessages = {
  // Authentication
  AUTH_REQUIRED: 'Please log in to continue',
  INVALID_TOKEN: 'Your session has expired. Please log in again',
  TOKEN_EXPIRED: 'Your session has expired. Please log in again',
  INVALID_CREDENTIALS: 'Invalid email or password',

  // Authorization
  FORBIDDEN: 'You don\'t have permission to access this resource',
  INSUFFICIENT_PERMISSIONS: 'You need additional permissions for this action',
  CREATOR_ONLY: 'This feature is only available to creators',
  ADMIN_ONLY: 'Administrator access required',

  // Payment
  INSUFFICIENT_TOKENS: 'Not enough tokens. Please purchase more tokens to continue',
  PAYMENT_REQUIRED: 'Payment is required for this action',
  PAYMENT_FAILED: 'Payment could not be processed. Please try again or use a different payment method',

  // Validation
  VALIDATION_ERROR: 'Please check your input and try again',
  INVALID_INPUT: 'The information provided is invalid',
  MISSING_REQUIRED_FIELD: 'Please fill in all required fields',

  // Not found
  NOT_FOUND: 'The requested resource was not found',
  USER_NOT_FOUND: 'User not found',
  RESOURCE_NOT_FOUND: 'The requested item could not be found',

  // Conflicts
  DUPLICATE_ENTRY: 'This item already exists',
  RESOURCE_EXISTS: 'A similar item already exists',
  CONFLICT: 'There was a conflict with your request',

  // Rate limiting
  RATE_LIMITED: 'You\'re making requests too quickly. Please wait a moment and try again',

  // Server errors
  INTERNAL_ERROR: 'Something went wrong on our end. Please try again later',
  DATABASE_ERROR: 'We\'re having trouble accessing data. Please try again',
  SERVICE_UNAVAILABLE: 'This service is temporarily unavailable. Please try again later'
};

/**
 * Error codes for consistent error handling
 */
const ErrorCodes = {
  // Authentication errors (401)
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

  // Authorization errors (403)
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  CREATOR_ONLY: 'CREATOR_ONLY',
  ADMIN_ONLY: 'ADMIN_ONLY',

  // Payment errors (402)
  INSUFFICIENT_TOKENS: 'INSUFFICIENT_TOKENS',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',

  // Validation errors (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Not found errors (404)
  NOT_FOUND: 'NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',

  // Conflict errors (409)
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  RESOURCE_EXISTS: 'RESOURCE_EXISTS',
  CONFLICT: 'CONFLICT',

  // Rate limiting (429)
  RATE_LIMITED: 'RATE_LIMITED',

  // Server errors (500)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
};

/**
 * Handle 404 errors
 */
const notFound = (req, res, next) => {
  const error = new AppError(
    `Route not found: ${req.method} ${req.originalUrl}`,
    404,
    ErrorCodes.NOT_FOUND
  );
  next(error);
};

/**
 * Handle validation errors from express-validator
 */
const handleValidationError = (err, req, res, next) => {
  if (err.array && typeof err.array === 'function') {
    const errors = err.array();
    return res.status(400).json({
      success: false,
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Validation failed',
      errors: errors.map(e => ({
        field: e.param,
        message: e.msg,
        value: e.value
      })),
      requestId: req.id || req.requestId
    });
  }
  next(err);
};

/**
 * Handle database errors
 */
const handleDatabaseError = (err) => {
  // PostgreSQL error codes
  switch (err.code) {
    case '23505': // Unique violation
      return new AppError('Duplicate entry', 409, ErrorCodes.DUPLICATE_ENTRY);
    case '23503': // Foreign key violation
      return new AppError('Referenced resource not found', 400, ErrorCodes.VALIDATION_ERROR);
    case '23502': // Not null violation
      return new AppError('Missing required field', 400, ErrorCodes.MISSING_REQUIRED_FIELD);
    case '22P02': // Invalid text representation
      return new AppError('Invalid input format', 400, ErrorCodes.INVALID_INPUT);
    case '42P01': // Undefined table
      return new AppError('Database schema error', 500, ErrorCodes.DATABASE_ERROR);
    default:
      return new AppError('Database operation failed', 500, ErrorCodes.DATABASE_ERROR);
  }
};

/**
 * Handle Stripe errors
 */
const handleStripeError = (err) => {
  switch (err.type) {
    case 'StripeCardError':
      return new AppError(err.message, 400, ErrorCodes.PAYMENT_FAILED);
    case 'StripeInvalidRequestError':
      return new AppError('Invalid payment request', 400, ErrorCodes.INVALID_INPUT);
    case 'StripeAPIError':
      return new AppError('Payment service error', 503, ErrorCodes.SERVICE_UNAVAILABLE);
    case 'StripeConnectionError':
      return new AppError('Payment service unreachable', 503, ErrorCodes.SERVICE_UNAVAILABLE);
    case 'StripeAuthenticationError':
      return new AppError('Payment configuration error', 500, ErrorCodes.INTERNAL_ERROR);
    case 'StripeRateLimitError':
      return new AppError('Too many payment requests', 429, ErrorCodes.RATE_LIMITED);
    default:
      return new AppError('Payment processing failed', 500, ErrorCodes.PAYMENT_FAILED);
  }
};

/**
 * Get user-friendly message for error code
 */
const getUserFriendlyMessage = (code, defaultMessage) => {
  return UserFriendlyMessages[code] || defaultMessage || 'An unexpected error occurred';
};

/**
 * Send error response with user-friendly messages
 */
const sendErrorResponse = (err, req, res) => {
  const { statusCode = 500, code = ErrorCodes.INTERNAL_ERROR, message } = err;
  const isProduction = process.env.NODE_ENV === 'production';

  // Determine the message to send
  let responseMessage;
  if (isProduction) {
    // In production, use user-friendly messages
    responseMessage = getUserFriendlyMessage(code,
      statusCode >= 500 ? 'Something went wrong. Please try again later' : message
    );
  } else {
    // In development, show actual error message
    responseMessage = message;
  }

  // Prepare error response
  const response = {
    success: false,
    code,
    message: responseMessage,
    requestId: req.requestId || req.id
  };

  // Add retry information for rate limiting
  if (statusCode === 429 && res.getHeader('Retry-After')) {
    response.retryAfter = parseInt(res.getHeader('Retry-After'));
  }

  // Development-only debugging info
  if (!isProduction) {
    // Add stack trace (redacted in production)
    if (err.stack) {
      response.stack = err.stack.split('\n').map(line => line.trim()).filter(Boolean);
    }
    // Add additional error details
    if (err.details) {
      response.details = err.details;
    }
    // Add original error message if different
    if (message !== responseMessage) {
      response.originalMessage = message;
    }
  }

  res.status(statusCode).json(response);
};

/**
 * Main error handler middleware with Sentry integration
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.stack = err.stack;

  // Set Sentry context
  if (typeof Sentry !== 'undefined' && Sentry.getCurrentHub) {
    Sentry.setContext('request', {
      requestId: req.requestId || req.id,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    if (req.user) {
      Sentry.setUser({
        id: req.user.supabase_id,
        username: req.user.username,
        email: req.user.email
      });
    }

    // Add request ID to Sentry scope
    Sentry.setTag('request_id', req.requestId || req.id);
  }

  // Log error with structured logging
  const errorLog = {
    message: err.message,
    code: err.code,
    statusCode: err.statusCode,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user?.supabase_id,
    requestId: req.requestId || req.id,
    userAgent: req.get('User-Agent')
  };

  // Only include stack in development or for 500 errors
  if (process.env.NODE_ENV !== 'production' || err.statusCode >= 500) {
    errorLog.stack = err.stack;
  }

  logger.error('Request error', errorLog);

  // Handle specific error types
  if (err.name === 'ValidationError') {
    error = new AppError('Validation error', 400, ErrorCodes.VALIDATION_ERROR);
  }

  if (err.name === 'CastError') {
    error = new AppError('Invalid ID format', 400, ErrorCodes.INVALID_INPUT);
  }

  if (err.code && err.code.toString().startsWith('23')) {
    error = handleDatabaseError(err);
  }

  if (err.type && err.type.includes('Stripe')) {
    error = handleStripeError(err);
  }

  if (err.name === 'TokenExpiredError') {
    error = new AppError('Token has expired', 401, ErrorCodes.TOKEN_EXPIRED);
  }

  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token', 401, ErrorCodes.INVALID_TOKEN);
  }

  if (err.statusCode === 429) {
    error = new AppError(err.message || 'Too many requests', 429, ErrorCodes.RATE_LIMITED);
  }

  sendErrorResponse(error, req, res);
};

/**
 * Async error wrapper for route handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Create error factory functions
 */
const createError = {
  badRequest: (message = 'Bad request') =>
    new AppError(message, 400, ErrorCodes.INVALID_INPUT),

  unauthorized: (message = 'Authentication required') =>
    new AppError(message, 401, ErrorCodes.AUTH_REQUIRED),

  forbidden: (message = 'Access forbidden') =>
    new AppError(message, 403, ErrorCodes.FORBIDDEN),

  notFound: (message = 'Resource not found') =>
    new AppError(message, 404, ErrorCodes.NOT_FOUND),

  conflict: (message = 'Resource conflict') =>
    new AppError(message, 409, ErrorCodes.CONFLICT),

  tooManyRequests: (message = 'Too many requests') =>
    new AppError(message, 429, ErrorCodes.RATE_LIMITED),

  internal: (message = 'Internal server error') =>
    new AppError(message, 500, ErrorCodes.INTERNAL_ERROR),

  serviceUnavailable: (message = 'Service unavailable') =>
    new AppError(message, 503, ErrorCodes.SERVICE_UNAVAILABLE)
};

/**
 * Initialize error handling for the application
 */
const initializeErrorHandling = (app) => {
  // Override console methods in production
  if (process.env.NODE_ENV === 'production') {
    const { overrideConsole } = require('../utils/console-override');
    overrideConsole();
  }

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise
    });

    if (Sentry && Sentry.captureException) {
      Sentry.captureException(reason);
    }
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
      message: error.message,
      stack: error.stack
    });

    if (Sentry && Sentry.captureException) {
      Sentry.captureException(error);
    }

    // Give time for logs to flush then exit
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
};

module.exports = {
  AppError,
  ErrorCodes,
  UserFriendlyMessages,
  notFound,
  handleValidationError,
  errorHandler,
  asyncHandler,
  createError,
  getUserFriendlyMessage,
  initializeErrorHandling
};