const winston = require('winston');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// List of sensitive fields to redact
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'session',
  'credit_card',
  'creditCard',
  'ssn',
  'social_security',
  'private_key',
  'privateKey',
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'stripe_secret',
  'supabase_key',
  'email_password',
  'database_url',
  'jwt_secret'
];

// Function to redact sensitive data
const redactSensitiveData = (obj, depth = 0) => {
  if (depth > 10) return obj; // Prevent infinite recursion
  
  if (typeof obj === 'string') {
    // Redact potential tokens or secrets in strings
    if (obj.length > 20 && /^[A-Za-z0-9_\-]+$/.test(obj)) {
      return obj.substring(0, 4) + '****' + obj.substring(obj.length - 4);
    }
    return obj;
  }
  
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveData(item, depth + 1));
  }
  
  const redacted = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const lowerKey = key.toLowerCase();
      
      // Check if this is a sensitive field
      if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
        redacted[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        redacted[key] = redactSensitiveData(obj[key], depth + 1);
      } else {
        redacted[key] = obj[key];
      }
    }
  }
  
  return redacted;
};

// Custom format for structured logging
const structuredFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
  const log = {
    timestamp,
    level,
    message,
    ...redactSensitiveData(metadata)
  };
  
  // Add request ID if available
  if (metadata.requestId) {
    log.requestId = metadata.requestId;
  }
  
  // Add user ID (hashed for privacy)
  if (metadata.userId) {
    log.userId = crypto.createHash('sha256').update(metadata.userId).digest('hex').substring(0, 8);
  }
  
  return JSON.stringify(log);
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    structuredFormat
  ),
  defaultMeta: { 
    service: 'digis-backend',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
      silent: process.env.NODE_ENV === 'test'
    }),
    
    // File transport for errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10,
      tailable: true
    })
  ],
  
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 5242880,
      maxFiles: 5
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

// Create child logger for specific contexts
const createContextLogger = (context) => {
  return logger.child({ context });
};

// Middleware to add request ID to all logs
const requestLogger = (req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  req.logger = logger.child({ 
    requestId: req.id,
    method: req.method,
    url: req.url,
    ip: req.ip
  });
  
  // Log request
  req.logger.info('Request received', {
    headers: redactSensitiveData(req.headers),
    query: redactSensitiveData(req.query),
    body: req.body ? redactSensitiveData(req.body) : undefined
  });
  
  // Log response
  const originalSend = res.send;
  res.send = function(data) {
    res.send = originalSend;
    
    req.logger.info('Response sent', {
      statusCode: res.statusCode,
      responseTime: Date.now() - req.startTime
    });
    
    return res.send(data);
  };
  
  req.startTime = Date.now();
  next();
};

// Performance logging
const performanceLogger = {
  startTimer: (operation) => {
    const start = process.hrtime.bigint();
    return {
      end: (metadata = {}) => {
        const end = process.hrtime.bigint();
        const duration = Number(end - start) / 1000000; // Convert to milliseconds
        
        logger.info('Performance metric', {
          operation,
          duration,
          ...metadata
        });
        
        // Alert if operation is slow
        if (duration > 1000) {
          logger.warn('Slow operation detected', {
            operation,
            duration,
            ...metadata
          });
        }
      }
    };
  }
};

// Database query logger
const queryLogger = {
  log: (query, params, duration) => {
    // Redact sensitive data from queries
    const safeQuery = query.replace(/password\s*=\s*'[^']*'/gi, "password='[REDACTED]'");
    const safeParams = redactSensitiveData(params);
    
    logger.info('Database query', {
      query: safeQuery,
      params: safeParams,
      duration
    });
    
    // Alert on slow queries
    if (duration > 100) {
      logger.warn('Slow query detected', {
        query: safeQuery,
        duration
      });
    }
  }
};

// Error logger with stack trace sanitization
const errorLogger = {
  log: (error, context = {}) => {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      code: error.code,
      ...redactSensitiveData(context)
    };
    
    // Sanitize stack traces
    if (errorInfo.stack) {
      errorInfo.stack = errorInfo.stack
        .replace(/\/\/(.*):(.*)@/g, '//[REDACTED]:[REDACTED]@')
        .replace(/password=([^&\s]*)/gi, 'password=[REDACTED]');
    }
    
    logger.error('Error occurred', errorInfo);
  }
};

// Audit logger for security events
const auditLogger = {
  log: (action, userId, metadata = {}) => {
    logger.info('Audit event', {
      action,
      userId: userId ? crypto.createHash('sha256').update(userId).digest('hex').substring(0, 8) : null,
      timestamp: new Date().toISOString(),
      ...redactSensitiveData(metadata)
    });
  }
};

module.exports = {
  logger,
  createContextLogger,
  requestLogger,
  performanceLogger,
  queryLogger,
  errorLogger,
  auditLogger,
  redactSensitiveData
};