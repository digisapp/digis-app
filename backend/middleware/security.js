const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
// const mongoSanitize = require('express-mongo-sanitize'); // Not needed for PostgreSQL
const xss = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');
const { validationResult } = require('express-validator');

// Content Security Policy configuration
const contentSecurityPolicy = {
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    scriptSrc: ["'self'", "'unsafe-inline'", 'https://www.gstatic.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
    connectSrc: ["'self'", 'wss:', 'https:'],
    mediaSrc: ["'self'", 'blob:'],
    objectSrc: ["'none'"],
    frameSrc: ["'self'", 'https://www.youtube.com'],
    workerSrc: ["'self'", 'blob:'],
    childSrc: ["'self'", 'blob:'],
    formAction: ["'self'"],
    upgradeInsecureRequests: [],
  },
};

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:3001',
      'https://digis.app',
      'https://www.digis.app'
    ];
    
    // Allow requests with no origin (like mobile apps)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
};

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: message,
        retryAfter: res.getHeader('Retry-After')
      });
    }
  });
};

// Different rate limiters for different endpoints
const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // limit each IP to 5 requests per windowMs
  'Too many authentication attempts, please try again later'
);

const apiLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // limit each IP to 100 requests per windowMs
  'Too many requests, please try again later'
);

const strictLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  10, // limit each IP to 10 requests per windowMs
  'Rate limit exceeded for this operation'
);

// Input validation middleware
const validateInput = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  next();
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Remove sensitive headers
  res.removeHeader('X-Powered-By');
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // HSTS for production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  next();
};

// Request sanitization middleware
const sanitizeRequest = (req, res, next) => {
  // Sanitize request body, query, and params
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  next();
};

// Helper function to sanitize objects
const sanitizeObject = (obj) => {
  if (typeof obj !== 'object' || obj === null) return obj;
  
  const sanitized = Array.isArray(obj) ? [] : {};
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (typeof obj[key] === 'string') {
        // Remove any potential SQL injection attempts
        sanitized[key] = obj[key]
          .replace(/[';\\]/g, '')
          .replace(/--/g, '')
          .replace(/\/\*/g, '')
          .replace(/\*\//g, '')
          .trim();
      } else if (typeof obj[key] === 'object') {
        sanitized[key] = sanitizeObject(obj[key]);
      } else {
        sanitized[key] = obj[key];
      }
    }
  }
  
  return sanitized;
};

// CSRF protection middleware
const csrfProtection = (req, res, next) => {
  // Skip CSRF for certain routes
  const skipRoutes = ['/api/webhook', '/health', '/api/auth/verify'];
  if (skipRoutes.some(route => req.path.startsWith(route))) {
    return next();
  }
  
  // Verify CSRF token for state-changing operations
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const token = req.headers['x-csrf-token'] || req.body._csrf;
    const sessionToken = req.session?.csrfToken;
    
    if (!token || token !== sessionToken) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }
  }
  
  next();
};

// Apply all security middleware
const applySecurity = (app) => {
  console.log('Applying helmet...');
  // Basic security headers
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? contentSecurityPolicy : false,
    crossOriginEmbedderPolicy: false
  }));
  
  console.log('Applying CORS...');
  // CORS
  app.use(cors(corsOptions));
  
  console.log('Applying body parsers...');
  // Body parsing security
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  console.log('Applying security middleware...');
  // Security middleware
  // Skip mongoSanitize for now - not needed for PostgreSQL
  // app.use(mongoSanitize());
  app.use(xss());
  app.use(hpp());
  app.use(securityHeaders);
  app.use(sanitizeRequest);
  
  console.log('Setting trust proxy...');
  // Trust proxy for accurate IP addresses
  app.set('trust proxy', 1);
  
  console.log('Applying rate limiters...');
  // Global rate limiting
  app.use('/api/', apiLimiter);
  app.use('/api/auth/', authLimiter);
  app.use('/api/payments/', strictLimiter);
  app.use('/api/tokens/purchase', strictLimiter);
  
  console.log('Security middleware applied successfully');
};

module.exports = {
  applySecurity,
  authLimiter,
  apiLimiter,
  strictLimiter,
  validateInput,
  csrfProtection,
  corsOptions,
  securityHeaders,
  sanitizeRequest
};