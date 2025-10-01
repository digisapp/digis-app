const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');
const { validationResult } = require('express-validator');

// Enhanced Content Security Policy configuration
const contentSecurityPolicy = {
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdn.jsdelivr.net'],
    scriptSrc: ["'self'", "'unsafe-inline'", 'https://www.gstatic.com', 'https://cdn.jsdelivr.net', 'https://js.stripe.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
    imgSrc: ["'self'", 'data:', 'https:', 'blob:', 'https://*.supabase.co'],
    connectSrc: [
      "'self'", 
      'wss:', 
      'https:', 
      'https://*.supabase.co',
      'https://api.stripe.com',
      'wss://*.agora.io',
      'https://*.agora.io'
    ],
    mediaSrc: ["'self'", 'blob:', 'https://*.agora.io'],
    objectSrc: ["'none'"],
    frameSrc: ["'self'", 'https://www.youtube.com', 'https://js.stripe.com', 'https://hooks.stripe.com'],
    workerSrc: ["'self'", 'blob:'],
    childSrc: ["'self'", 'blob:'],
    formAction: ["'self'"],
    upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
  },
};

// Enhanced CORS configuration with stricter production settings
const getCorsOptions = () => {
  // Development origins
  const devOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173', // Vite default
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5173'
  ];

  // Production origins
  const prodOrigins = [
    'https://digis.app',
    'https://www.digis.app',
    process.env.FRONTEND_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    // Add any custom domains here
  ].filter(Boolean); // Remove null values

  return {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, Postman)
      if (!origin) {
        return callback(null, true);
      }

      // Check if we're in development
      if (process.env.NODE_ENV === 'development') {
        // In development, allow dev origins and configured origins
        const allowedOrigins = [...devOrigins, ...prodOrigins];
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        // Be more permissive in development
        console.warn(`CORS: Allowing origin ${origin} in development mode`);
        return callback(null, true);
      }

      // Production mode - strict checking
      if (prodOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Log rejected origins in production for debugging
      console.error(`CORS: Rejected origin ${origin}`);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-Requested-With', 
      'X-CSRF-Token',
      'X-Client-Version',
      'X-Request-ID'
    ],
    exposedHeaders: [
      'X-Total-Count', 
      'X-Page-Count',
      'X-CSRF-Token',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset'
    ],
    maxAge: 86400 // 24 hours
  };
};

// Enhanced rate limiting with Redis support
const createRateLimiter = (options) => {
  const baseConfig = {
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: options.message || 'Too many requests',
        retryAfter: res.getHeader('Retry-After'),
        timestamp: new Date().toISOString()
      });
    },
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health' || req.path === '/api/health';
    }
  };

  // Use Redis store in production if available
  if (process.env.REDIS_URL && process.env.NODE_ENV === 'production') {
    const RedisStore = require('rate-limit-redis');
    const { createClient } = require('redis');
    
    const redisClient = createClient({
      url: process.env.REDIS_URL
    });
    
    redisClient.connect().catch(console.error);
    
    return rateLimit({
      ...baseConfig,
      ...options,
      store: new RedisStore({
        client: redisClient,
        prefix: 'rl:',
      })
    });
  }

  // Fallback to memory store
  return rateLimit({
    ...baseConfig,
    ...options
  });
};

// Different rate limiters for different endpoints
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later',
  skipSuccessfulRequests: true
});

const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // More lenient in dev
  message: 'Too many requests, please try again later'
});

const strictLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Rate limit exceeded for this operation'
});

const paymentLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // limit each IP to 20 payment attempts per hour
  message: 'Too many payment attempts, please try again later'
});

const streamingLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 requests per minute for streaming
  message: 'Streaming rate limit exceeded'
});

// Input validation middleware
const validateInput = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: process.env.NODE_ENV === 'development' ? err.value : undefined
      }))
    });
  }
  next();
};

// Request ID middleware for tracing
const requestIdMiddleware = (req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Additional security headers
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Remove fingerprinting headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  next();
};

// Apply all security middleware
const applySecurity = (app) => {
  // Request ID for tracing
  app.use(requestIdMiddleware);
  
  // Basic security headers
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? contentSecurityPolicy : false,
    crossOriginEmbedderPolicy: false, // Disable for Agora.io compatibility
  }));
  
  // Additional security headers
  app.use(securityHeaders);
  
  // CORS with enhanced configuration
  app.use(cors(getCorsOptions()));
  
  // Body parsing with size limits
  app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
      // Store raw body for webhook signature verification
      if (req.originalUrl.startsWith('/api/webhook') || 
          req.originalUrl.startsWith('/api/stripe-webhook')) {
        req.rawBody = buf.toString('utf8');
      }
    }
  }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // XSS protection
  app.use(xss());
  
  // Prevent HTTP Parameter Pollution
  app.use(hpp({
    whitelist: ['sort', 'filter', 'page', 'limit'] // Allow these parameters to have arrays
  }));
  
  // Apply rate limiting to API routes
  app.use('/api/', apiLimiter);
  
  // Stricter rate limiting for auth routes
  app.use('/api/auth/', authLimiter);
  app.use('/api/users/register', authLimiter);
  app.use('/api/users/login', authLimiter);
  
  // Payment endpoints rate limiting
  app.use('/api/payments/', paymentLimiter);
  app.use('/api/tokens/purchase', paymentLimiter);
  
  // Streaming endpoints rate limiting
  app.use('/api/streaming/', streamingLimiter);
  app.use('/api/agora/', streamingLimiter);
  
  // Trust proxy for accurate IP addresses (important for rate limiting)
  app.set('trust proxy', 1);
  
  console.log('✅ Enhanced security middleware applied');
};

module.exports = {
  applySecurity,
  corsOptions: getCorsOptions(),
  authLimiter,
  apiLimiter,
  strictLimiter,
  paymentLimiter,
  streamingLimiter,
  validateInput,
  helmet,
  contentSecurityPolicy
};