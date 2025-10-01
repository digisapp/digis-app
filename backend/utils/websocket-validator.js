/**
 * WebSocket message validation and sanitization utilities
 */

const { z } = require('zod');
const DOMPurify = require('isomorphic-dompurify');

// Common validation schemas
const schemas = {
  // User ID validation (UUID format)
  userId: z.string().uuid('Invalid user ID format'),
  
  // Stream/Channel ID validation
  streamId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid stream ID format'),
  
  // Session ID validation
  sessionId: z.string().min(1).max(100),
  
  // Text content validation (with sanitization)
  textContent: z.string().min(1).max(1000).transform(val => DOMPurify.sanitize(val)),
  
  // Short text validation
  shortText: z.string().min(1).max(200).transform(val => DOMPurify.sanitize(val)),
  
  // Emoji validation
  emoji: z.string().regex(/^(\p{Emoji}|\p{Emoji_Component})+$/u, 'Invalid emoji'),
  
  // Number validations
  positiveInt: z.number().int().positive(),
  tokenAmount: z.number().positive().max(10000),
  duration: z.number().int().min(1).max(86400), // 1 second to 24 hours
  
  // Status validations
  userStatus: z.enum(['online', 'away', 'busy', 'offline']),
  streamStatus: z.enum(['live', 'ended', 'scheduled']),
  
  // Poll option validation
  pollOption: z.string().min(1).max(100).transform(val => DOMPurify.sanitize(val)),
  
  // Array validations
  userIds: z.array(z.string().uuid()).max(100),
  pollOptions: z.array(z.string().min(1).max(100)).min(2).max(6),
  
  // Timestamp validation
  timestamp: z.number().int().positive(),
  
  // Reaction validation
  reaction: z.object({
    emoji: z.string(),
    count: z.number().int().min(1).max(100).default(1),
    targetType: z.enum(['stream', 'message', 'user']).default('stream')
  }),
  
  // Message validation
  message: z.object({
    content: z.string().min(1).max(1000).transform(val => DOMPurify.sanitize(val)),
    channelId: z.string(),
    parentId: z.string().optional(),
    mentions: z.array(z.string().uuid()).optional(),
    attachments: z.array(z.object({
      type: z.enum(['image', 'video', 'file']),
      url: z.string().url(),
      name: z.string().optional(),
      size: z.number().optional()
    })).optional()
  })
};

// WebSocket event schemas
const eventSchemas = {
  // Stream events
  'join-stream': z.object({
    streamId: schemas.streamId
  }),
  
  'leave-stream': z.object({
    streamId: schemas.streamId
  }),
  
  'stream-chat': z.object({
    streamId: schemas.streamId,
    message: schemas.textContent,
    type: z.enum(['chat', 'announcement', 'tip']).optional()
  }),
  
  // User presence events
  'update-presence': z.object({
    status: schemas.userStatus,
    customStatus: schemas.shortText.optional()
  }),
  
  'get-presence': z.object({
    userIds: schemas.userIds
  }),
  
  // Typing indicators
  'typing-start': z.object({
    channel: schemas.streamId
  }),
  
  'typing-stop': z.object({
    channel: schemas.streamId
  }),
  
  // Reaction events
  'send_reaction': z.object({
    channelId: schemas.streamId,
    reaction: schemas.emoji,
    count: schemas.positiveInt.default(1),
    targetType: z.enum(['stream', 'message', 'user']).default('stream'),
    timestamp: schemas.timestamp.optional()
  }),
  
  'send_reaction_burst': z.object({
    channelId: schemas.streamId,
    reaction: schemas.emoji,
    count: z.number().int().min(1).max(10).default(5),
    targetType: z.enum(['stream', 'message', 'user']).default('stream')
  }),
  
  // Poll events
  'create_poll': z.object({
    channelId: schemas.streamId,
    question: schemas.textContent,
    options: schemas.pollOptions,
    duration: schemas.duration.default(300) // Default 5 minutes
  }),
  
  'vote_poll': z.object({
    pollId: z.string().uuid(),
    optionId: schemas.positiveInt
  }),
  
  // Q&A events
  'submit_question': z.object({
    channelId: schemas.streamId,
    question: schemas.textContent
  }),
  
  'vote_question': z.object({
    questionId: z.string().uuid(),
    voteType: z.enum(['up', 'down'])
  }),
  
  // Session events
  'session-start': z.object({
    sessionId: schemas.sessionId,
    sessionType: z.enum(['video', 'voice']),
    creatorId: schemas.userId
  }),
  
  'session-end': z.object({
    sessionId: schemas.sessionId,
    reason: z.enum(['normal', 'timeout', 'error']).optional()
  }),
  
  'session-heartbeat': z.object({
    sessionId: schemas.sessionId,
    timestamp: schemas.timestamp
  }),
  
  // Token events
  'send-tip': z.object({
    recipientId: schemas.userId,
    amount: schemas.tokenAmount,
    message: schemas.shortText.optional(),
    sessionId: schemas.sessionId.optional()
  }),
  
  // Virtual gift events
  'send-gift': z.object({
    recipientId: schemas.userId,
    giftType: z.string(),
    quantity: schemas.positiveInt.default(1),
    message: schemas.shortText.optional()
  }),
  
  // Message events
  'send-message': schemas.message,
  
  'edit-message': z.object({
    messageId: z.string().uuid(),
    content: schemas.textContent
  }),
  
  'delete-message': z.object({
    messageId: z.string().uuid()
  }),
  
  // Notification events
  'mark-notification-read': z.object({
    notificationId: z.string().uuid()
  }),
  
  'mark-all-notifications-read': z.object({}),
  
  // Stream control events (creator only)
  'update-stream-settings': z.object({
    streamId: schemas.streamId,
    settings: z.object({
      title: schemas.shortText.optional(),
      description: schemas.textContent.optional(),
      isPrivate: z.boolean().optional(),
      maxViewers: schemas.positiveInt.optional(),
      tokenPrice: schemas.tokenAmount.optional()
    })
  }),
  
  'kick-user': z.object({
    streamId: schemas.streamId,
    userId: schemas.userId,
    reason: schemas.shortText.optional()
  }),
  
  'ban-user': z.object({
    streamId: schemas.streamId,
    userId: schemas.userId,
    duration: schemas.duration.optional(), // In seconds
    reason: schemas.shortText.optional()
  })
};

// Error codes for consistent error handling
const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  INSUFFICIENT_TOKENS: 'INSUFFICIENT_TOKENS',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR'
};

// Validation middleware factory
const createValidator = (schema) => {
  return (data) => {
    try {
      return {
        success: true,
        data: schema.parse(data)
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: {
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Invalid input data',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          }
        };
      }
      return {
        success: false,
        error: {
          code: ErrorCodes.SERVER_ERROR,
          message: 'Validation error',
          details: error.message
        }
      };
    }
  };
};

// Create validators for all events
const validators = {};
for (const [eventName, schema] of Object.entries(eventSchemas)) {
  validators[eventName] = createValidator(schema);
}

// Enhanced error handler
const handleSocketError = (socket, error, eventName = 'unknown') => {
  console.error(`[WebSocket Error] Event: ${eventName}, User: ${socket.userId}`, error);
  
  const errorResponse = {
    event: eventName,
    timestamp: Date.now(),
    error: {
      code: error.code || ErrorCodes.SERVER_ERROR,
      message: error.message || 'An unexpected error occurred',
      details: error.details || undefined
    }
  };
  
  socket.emit('error', errorResponse);
  
  // Log to monitoring system
  if (process.env.NODE_ENV === 'production') {
    // Add your monitoring/logging service here
    // e.g., Sentry, LogRocket, etc.
  }
};

// Rate limit handler
const handleRateLimit = (socket, eventName) => {
  const error = {
    code: ErrorCodes.RATE_LIMIT_ERROR,
    message: 'Too many requests. Please slow down.',
    details: {
      event: eventName,
      retryAfter: 60 // seconds
    }
  };
  
  handleSocketError(socket, error, eventName);
};

// Permission check helper
const checkPermission = async (socket, action, resource) => {
  // Add your permission logic here
  // For example, check if user is creator for certain actions
  
  const permissions = {
    'update-stream-settings': async (userId, streamId) => {
      // Check if user is the stream creator
      const { pool } = require('./db');
      const result = await pool.query(
        'SELECT creator_id FROM streams WHERE stream_id = $1',
        [streamId]
      );
      return result.rows[0]?.creator_id === userId;
    },
    'kick-user': async (userId, streamId) => {
      // Same as update-stream-settings
      return permissions['update-stream-settings'](userId, streamId);
    },
    'ban-user': async (userId, streamId) => {
      // Same as update-stream-settings
      return permissions['update-stream-settings'](userId, streamId);
    }
  };
  
  if (permissions[action]) {
    return await permissions[action](socket.userId, resource);
  }
  
  return true; // Default allow for unspecified actions
};

// Sanitize output data before sending to clients
const sanitizeOutput = (data) => {
  if (typeof data === 'string') {
    return DOMPurify.sanitize(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeOutput);
  }
  
  if (data && typeof data === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      // Don't sanitize certain fields
      if (['id', 'userId', 'streamId', 'timestamp', 'createdAt', 'updatedAt'].includes(key)) {
        sanitized[key] = value;
      } else {
        sanitized[key] = sanitizeOutput(value);
      }
    }
    return sanitized;
  }
  
  return data;
};

// Middleware to wrap socket event handlers with validation and error handling
const withValidation = (eventName, handler) => {
  return async (data, callback) => {
    const socket = this;
    
    try {
      // Validate input if schema exists
      if (validators[eventName]) {
        const validation = validators[eventName](data);
        
        if (!validation.success) {
          handleSocketError(socket, validation.error, eventName);
          if (callback) callback(validation.error);
          return;
        }
        
        // Use validated and sanitized data
        data = validation.data;
      }
      
      // Check permissions if needed
      const requiresPermission = ['update-stream-settings', 'kick-user', 'ban-user'].includes(eventName);
      if (requiresPermission) {
        const hasPermission = await checkPermission(socket, eventName, data.streamId);
        
        if (!hasPermission) {
          const error = {
            code: ErrorCodes.PERMISSION_ERROR,
            message: 'You do not have permission to perform this action'
          };
          handleSocketError(socket, error, eventName);
          if (callback) callback(error);
          return;
        }
      }
      
      // Call the actual handler
      const result = await handler.call(socket, data, callback);
      
      // Sanitize output if returning data
      if (result && callback) {
        callback(null, sanitizeOutput(result));
      }
    } catch (error) {
      handleSocketError(socket, error, eventName);
      if (callback) callback({ code: ErrorCodes.SERVER_ERROR, message: error.message });
    }
  };
};

module.exports = {
  schemas,
  eventSchemas,
  validators,
  ErrorCodes,
  createValidator,
  handleSocketError,
  handleRateLimit,
  checkPermission,
  sanitizeOutput,
  withValidation
};