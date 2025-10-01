/**
 * Centralized error definitions and handling
 */

// Base error class
class AppError extends Error {
  constructor(message, code, statusCode = 500, isOperational = true, retryable = false) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.retryable = retryable;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false,
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      timestamp: this.timestamp,
      ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
    };
  }
}

// Authentication errors
class AuthError extends AppError {
  constructor(message = 'Authentication failed', code = 'AUTH.FAILED') {
    super(message, code, 401, true, false);
  }
}

class TokenExpiredError extends AuthError {
  constructor(message = 'Token has expired') {
    super(message, 'AUTH.TOKEN_EXPIRED');
    this.retryable = true;
  }
}

class InvalidTokenError extends AuthError {
  constructor(message = 'Invalid token provided') {
    super(message, 'AUTH.INVALID_TOKEN');
  }
}

class InsufficientPermissionsError extends AppError {
  constructor(message = 'Insufficient permissions', requiredRole = null) {
    super(message, 'AUTH.INSUFFICIENT_PERMISSIONS', 403, true, false);
    this.requiredRole = requiredRole;
  }
}

// Payment errors
class PaymentError extends AppError {
  constructor(message = 'Payment processing failed', code = 'PAYMENT.FAILED') {
    super(message, code, 402, true, true);
  }
}

class InsufficientFundsError extends PaymentError {
  constructor(message = 'Insufficient funds', required, available) {
    super(message, 'PAYMENT.INSUFFICIENT_FUNDS');
    this.required = required;
    this.available = available;
    this.retryable = false;
  }
}

class PaymentDeclinedError extends PaymentError {
  constructor(message = 'Payment was declined', declineCode = null) {
    super(message, 'PAYMENT.DECLINED');
    this.declineCode = declineCode;
    this.retryable = false;
  }
}

class DuplicateTransactionError extends PaymentError {
  constructor(message = 'Duplicate transaction detected', transactionId = null) {
    super(message, 'PAYMENT.DUPLICATE', 409);
    this.transactionId = transactionId;
    this.retryable = false;
  }
}

// Validation errors
class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors = []) {
    super(message, 'VALIDATION.FAILED', 400, true, false);
    this.errors = errors;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      errors: this.errors
    };
  }
}

class RequiredFieldError extends ValidationError {
  constructor(fieldName) {
    super(`${fieldName} is required`, [{
      field: fieldName,
      message: `${fieldName} is required`
    }]);
    this.code = 'VALIDATION.REQUIRED_FIELD';
  }
}

class InvalidFormatError extends ValidationError {
  constructor(fieldName, expectedFormat) {
    super(`Invalid format for ${fieldName}`, [{
      field: fieldName,
      message: `Invalid format. Expected: ${expectedFormat}`
    }]);
    this.code = 'VALIDATION.INVALID_FORMAT';
  }
}

// Stream/Video errors
class StreamError extends AppError {
  constructor(message = 'Stream error occurred', code = 'STREAM.ERROR') {
    super(message, code, 500, true, true);
  }
}

class StreamNotFoundError extends StreamError {
  constructor(streamId) {
    super(`Stream ${streamId} not found`, 'STREAM.NOT_FOUND');
    this.statusCode = 404;
    this.streamId = streamId;
  }
}

class StreamConnectionError extends StreamError {
  constructor(message = 'Failed to connect to stream') {
    super(message, 'STREAM.CONNECTION_FAILED');
    this.retryable = true;
  }
}

class StreamDroppedError extends StreamError {
  constructor(reason = 'unknown') {
    super(`Stream dropped: ${reason}`, 'STREAM.DROPPED');
    this.reason = reason;
  }
}

// Resource errors
class ResourceNotFoundError extends AppError {
  constructor(resource, id = null) {
    const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
    super(message, 'RESOURCE.NOT_FOUND', 404, true, false);
    this.resource = resource;
    this.resourceId = id;
  }
}

class ResourceConflictError extends AppError {
  constructor(message = 'Resource conflict', conflictingField = null) {
    super(message, 'RESOURCE.CONFLICT', 409, true, false);
    this.conflictingField = conflictingField;
  }
}

class ResourceExhaustedError extends AppError {
  constructor(resource, limit) {
    super(`${resource} limit exceeded`, 'RESOURCE.EXHAUSTED', 429, true, true);
    this.resource = resource;
    this.limit = limit;
  }
}

// Rate limiting errors
class RateLimitError extends AppError {
  constructor(retryAfter = 60) {
    super('Too many requests', 'RATE_LIMIT.EXCEEDED', 429, true, true);
    this.retryAfter = retryAfter;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      retryAfter: this.retryAfter
    };
  }
}

// External service errors
class ExternalServiceError extends AppError {
  constructor(service, originalError = null) {
    super(`External service error: ${service}`, 'EXTERNAL.SERVICE_ERROR', 503, true, true);
    this.service = service;
    this.originalError = originalError;
  }
}

class StripeError extends ExternalServiceError {
  constructor(stripeError) {
    super('Stripe', stripeError);
    this.code = `EXTERNAL.STRIPE.${stripeError.type?.toUpperCase() || 'ERROR'}`;
    this.stripeCode = stripeError.code;
    this.stripeMessage = stripeError.message;
  }
}

class AgoraError extends ExternalServiceError {
  constructor(agoraError) {
    super('Agora', agoraError);
    this.code = 'EXTERNAL.AGORA.ERROR';
  }
}

// Database errors
class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', query = null) {
    super(message, 'DATABASE.ERROR', 500, false, true);
    this.query = query;
  }
}

class DatabaseConnectionError extends DatabaseError {
  constructor() {
    super('Database connection failed', null);
    this.code = 'DATABASE.CONNECTION_FAILED';
  }
}

class TransactionError extends DatabaseError {
  constructor(message = 'Transaction failed') {
    super(message, null);
    this.code = 'DATABASE.TRANSACTION_FAILED';
  }
}

// Business logic errors
class BusinessLogicError extends AppError {
  constructor(message, code = 'BUSINESS.ERROR') {
    super(message, code, 400, true, false);
  }
}

class WithdrawalLimitError extends BusinessLogicError {
  constructor(limit, requested) {
    super(`Withdrawal limit exceeded. Limit: ${limit}, Requested: ${requested}`);
    this.code = 'BUSINESS.WITHDRAWAL_LIMIT';
    this.limit = limit;
    this.requested = requested;
  }
}

class SessionExpiredError extends BusinessLogicError {
  constructor(sessionId) {
    super('Session has expired');
    this.code = 'BUSINESS.SESSION_EXPIRED';
    this.sessionId = sessionId;
  }
}

// Error factory
const createError = (type, ...args) => {
  const errorMap = {
    auth: AuthError,
    tokenExpired: TokenExpiredError,
    invalidToken: InvalidTokenError,
    insufficientPermissions: InsufficientPermissionsError,
    payment: PaymentError,
    insufficientFunds: InsufficientFundsError,
    paymentDeclined: PaymentDeclinedError,
    duplicateTransaction: DuplicateTransactionError,
    validation: ValidationError,
    requiredField: RequiredFieldError,
    invalidFormat: InvalidFormatError,
    stream: StreamError,
    streamNotFound: StreamNotFoundError,
    streamConnection: StreamConnectionError,
    streamDropped: StreamDroppedError,
    resourceNotFound: ResourceNotFoundError,
    resourceConflict: ResourceConflictError,
    resourceExhausted: ResourceExhaustedError,
    rateLimit: RateLimitError,
    externalService: ExternalServiceError,
    stripe: StripeError,
    agora: AgoraError,
    database: DatabaseError,
    databaseConnection: DatabaseConnectionError,
    transaction: TransactionError,
    businessLogic: BusinessLogicError,
    withdrawalLimit: WithdrawalLimitError,
    sessionExpired: SessionExpiredError
  };

  const ErrorClass = errorMap[type];
  if (!ErrorClass) {
    return new AppError('Unknown error type', 'UNKNOWN.ERROR');
  }

  return new ErrorClass(...args);
};

// Error handler middleware
const errorHandler = (logger) => (err, req, res, next) => {
  // Log error
  if (!err.isOperational) {
    logger.error('Unexpected error:', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      body: req.body,
      userId: req.user?.id
    });
  } else {
    logger.warn('Operational error:', {
      code: err.code,
      message: err.message,
      path: req.path,
      userId: req.user?.id
    });
  }

  // Send error response
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Handle Mongoose/Sequelize errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      code: 'VALIDATION.FAILED',
      message: 'Validation failed',
      errors: Object.values(err.errors || {}).map(e => ({
        field: e.path,
        message: e.message
      }))
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      code: 'AUTH.INVALID_TOKEN',
      message: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      code: 'AUTH.TOKEN_EXPIRED',
      message: 'Token expired',
      retryable: true
    });
  }

  // Default error
  res.status(500).json({
    success: false,
    code: 'INTERNAL.ERROR',
    message: process.env.NODE_ENV === 'production'
      ? 'An error occurred'
      : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  AppError,
  AuthError,
  TokenExpiredError,
  InvalidTokenError,
  InsufficientPermissionsError,
  PaymentError,
  InsufficientFundsError,
  PaymentDeclinedError,
  DuplicateTransactionError,
  ValidationError,
  RequiredFieldError,
  InvalidFormatError,
  StreamError,
  StreamNotFoundError,
  StreamConnectionError,
  StreamDroppedError,
  ResourceNotFoundError,
  ResourceConflictError,
  ResourceExhaustedError,
  RateLimitError,
  ExternalServiceError,
  StripeError,
  AgoraError,
  DatabaseError,
  DatabaseConnectionError,
  TransactionError,
  BusinessLogicError,
  WithdrawalLimitError,
  SessionExpiredError,
  createError,
  errorHandler,
  asyncHandler
};