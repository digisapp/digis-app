const express = require('express');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { logger, requestLogger } = require('../utils/secureLogger');
const { applySecurity } = require('../middleware/security');
const { detectVersion, versionInfo } = require('../middleware/versioning');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('../config/swagger');

// Remove sensitive console.logs - using secure logger instead
logger.info('Starting Digis backend server...');

// Load environment variables with comprehensive validation
try {
  const dotenvResult = require('dotenv').config({ path: path.join(__dirname, '../.env') });
  
  if (dotenvResult.error) {
    throw new Error(`Failed to load .env file: ${dotenvResult.error.message}`);
  }
  
  // Validate all environment variables
  const { validateEnvironmentVariables } = require('../utils/env-validator');
  validateEnvironmentVariables();
  
} catch (envError) {
  logger.error('Environment configuration error:', { error: envError.message });
  process.exit(1);
}

// Initialize Express app
const app = express();
console.log('Express app created');

// Apply comprehensive security middleware
console.log('Applying security middleware...');
applySecurity(app);
console.log('Security middleware applied');

// Add request logging middleware
app.use(requestLogger);

// Enable response compression
app.use(compression({
  level: 6, // Balanced compression level
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req, res) => {
    // Don't compress for specific content types
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression for JSON, text, etc.
    return compression.filter(req, res);
  }
}));

// Additional security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Remove sensitive headers
  res.removeHeader('X-Powered-By');
  
  next();
});

// Rate limiting with different limits for different endpoints
const createRateLimiter = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { 
    error: message, 
    timestamp: new Date().toISOString() 
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

// Apply rate limiters to specific routes - Increased for development
app.use('/api/auth/profile', createRateLimiter(1 * 60 * 1000, 2000, 'Too many profile requests')); // High limit for profile checks
app.use('/api/tokens/balance', createRateLimiter(1 * 60 * 1000, 2000, 'Too many balance requests')); // High limit for balance checks
app.use('/api/recommendations', createRateLimiter(1 * 60 * 1000, 1000, 'Too many recommendation requests')); // High limit for recommendations
app.use('/api/users/preferences', createRateLimiter(1 * 60 * 1000, 1000, 'Too many preference requests')); // High limit for preferences
app.use('/api/auth', createRateLimiter(15 * 60 * 1000, 500, 'Too many auth attempts'));
app.use('/api/tokens/purchase', createRateLimiter(15 * 60 * 1000, 200, 'Too many purchase attempts'));
app.use('/api/tokens/tip', createRateLimiter(5 * 60 * 1000, 1000, 'Too many tip attempts'));
app.use('/api/agora', createRateLimiter(5 * 60 * 1000, 2000, 'Too many Agora requests'));
app.use('/api/notifications', createRateLimiter(1 * 60 * 1000, 1000, 'Too many notification requests')); // Allow 1000 requests per minute
app.use('/api/classes', createRateLimiter(1 * 60 * 1000, 500, 'Too many class requests'));
app.use('/api/tv-subscription', createRateLimiter(1 * 60 * 1000, 500, 'Too many TV subscription requests'));
app.use('/api/users/public', createRateLimiter(1 * 60 * 1000, 500, 'Too many public user requests'));
app.use('/api/wallet', createRateLimiter(1 * 60 * 1000, 500, 'Too many wallet requests'));
app.use('/api/payments', createRateLimiter(1 * 60 * 1000, 500, 'Too many payment requests'));
app.use(createRateLimiter(15 * 60 * 1000, 50000, 'Too many requests')); // Increased to 50000 for development

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      // Production domains
      'https://digis.app',
      'https://www.digis.app',
      // Vercel preview URLs
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
      // Development (remove in production)
      process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
      process.env.NODE_ENV === 'development' ? 'http://localhost:3002' : null,
      process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:3000' : null,
      process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:3002' : null
    ].filter(Boolean);
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Body parsing middleware with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API versioning middleware
app.use('/api', detectVersion);

// Version information endpoint
app.get('/api/versions', versionInfo);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      apiVersion: req.apiVersion
    });
  });
  
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip} - Version: ${req.apiVersion || 'none'}`);
  next();
});

// Load and register routes with error handling
try {
  // Load v1 routes
  const v1Routes = require('../routes/v1');
  
  // Load individual routes for backward compatibility
  const authRoutes = require('../routes/auth');
  const paymentRoutes = require('../routes/payments');
  const agoraRoutes = require('../routes/agora');
  const userRoutes = require('../routes/users');
  const tokenRoutes = require('../routes/tokens');
  const subscriptionRoutes = require('../routes/subscriptions');
  const giftRoutes = require('../routes/gifts');
  const tipRoutes = require('../routes/tips');
  const pollRoutes = require('../routes/polls');
  const questionRoutes = require('../routes/questions');
  const messageRoutes = require('../routes/messages');
  const chatRoutes = require('../routes/chat');
  const notificationRoutes = require('../routes/notifications');
  const privacyRoutes = require('../routes/privacy');
  const webhookRoutes = require('../routes/webhook');
  const analyticsRoutes = require('../routes/analytics');
  const moderationRoutes = require('../routes/moderation');
  const streamingRoutes = require('../routes/streaming');
  const collaborationRoutes = require('../routes/collaborations');
  const membershipTiersRoutes = require('../routes/membership-tiers');
  const offersRoutes = require('../routes/offers');
  const classesRoutes = require('../routes/classes');
  const creatorsRoutes = require('../routes/creators');
  const tvSubscriptionRoutes = require('../routes/tv-subscription');
  const connectRoutes = require('../routes/connect');
  const creatorPayoutRoutes = require('../routes/creator-payouts');
  const stripeWebhookRoutes = require('../routes/stripe-webhooks');
  const recordingRoutes = require('../routes/recording');
  const contentRoutes = require('../routes/content');
  const experiencesRoutes = require('../routes/experiences');
  
  // Mount v1 routes
  app.use('/api/v1', v1Routes);

  app.use('/api/auth', authRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/agora', agoraRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/tokens', tokenRoutes);
  app.use('/api/subscriptions', subscriptionRoutes);
  app.use('/api/gifts', giftRoutes);
  app.use('/api/tips', tipRoutes);
  app.use('/api/polls', pollRoutes);
  app.use('/api/questions', questionRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/badges', require('../routes/badges'));
  app.use('/api/discovery', require('../routes/discovery'));
  app.use('/api/goals', require('../routes/goals'));
  app.use('/api/challenges', require('../routes/challenges'));
  app.use('/api/admin', require('../routes/admin'));
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/moderation', moderationRoutes);
  app.use('/api/offers', offersRoutes);
  app.use('/api/streaming', streamingRoutes);
  app.use('/api/collaborations', collaborationRoutes);
  app.use('/api/membership-tiers', membershipTiersRoutes);
  app.use('/api/classes', classesRoutes);
  app.use('/api/creators', creatorsRoutes);
  app.use('/api/tv-subscription', tvSubscriptionRoutes);
  app.use('/api/connect', connectRoutes);
  app.use('/api/creator-payouts', creatorPayoutRoutes);
  app.use('/api/privacy', privacyRoutes);
  app.use('/api/recording', recordingRoutes);
  app.use('/api/content', contentRoutes);
  app.use('/api/experiences', experiencesRoutes);
  app.use('/api/wallet', tokenRoutes); // Wallet endpoints are in tokens route
  app.use('/webhooks', webhookRoutes);
  app.use('/webhooks', stripeWebhookRoutes);
  
  console.log('✅ All routes loaded successfully');
} catch (routeError) {
  console.error('❌ Error loading routes:', routeError.message);
  console.error('Make sure all route files exist in backend/routes/');
  logger.error('Route loading failed', { error: routeError.message, stack: routeError.stack });
}

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Digis API Documentation'
}));

// Health check endpoints
app.get('/', (req, res) => {
  res.json({ 
    message: 'Digis Backend with Token Economy',
    status: 'OK',
    version: '1.0.0',
    apiVersions: {
      current: 'v1',
      supported: ['v1'],
      versionEndpoint: '/api/versions'
    },
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    documentation: process.env.NODE_ENV === 'development' ? 'http://localhost:3001/api-docs' : '/api-docs',
    routes: {
      v1: ['/api/v1/auth', '/api/v1/payments', '/api/v1/agora', '/api/v1/users', '/api/v1/tokens'],
      legacy: ['/api/auth', '/api/payments', '/api/agora', '/api/users', '/api/tokens', '/api/subscriptions', '/api/gifts', '/api/tips', '/api/polls', '/api/questions', '/api/messages', '/api/chat', '/api/notifications', '/api/collaborations', '/api/membership-tiers']
    },
    features: [
      'Supabase Authentication',
      'Stripe Payments',
      'Agora.io Integration',
      'Token Economy',
      'Real-time Communication',
      'Video/Voice Calls',
      'Live Streaming',
      'Chat System',
      'Creator Subscriptions',
      'Virtual Gifts & Tipping',
      'Interactive Polls & Q&A',
      'Real-time Notifications',
      'Notification Preferences',
      'Analytics Dashboard',
      'Creator Collaborations',
      'AI Content Moderation',
      'Membership Tiers',
      'Predictive Analytics'
    ]
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version
  });
});

// Environment test route
app.get('/test', (req, res) => {
  res.json({
    environment: 'Configuration Status',
    agoraAppId: process.env.AGORA_APP_ID ? 'Loaded' : 'Missing',
    databaseUrl: process.env.DATABASE_URL ? 'Loaded' : 'Missing',
    stripeKey: process.env.STRIPE_SECRET_KEY ? 'Loaded' : 'Missing',
    supabaseUrl: process.env.SUPABASE_URL ? 'Loaded' : 'Missing',
    frontendUrl: process.env.FRONTEND_URL || 'Not set',
    nodeEnv: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// 404 handler for unmatched routes
app.use('*', (req, res) => {
  logger.warn('404 - Route not found', {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip
  });
  
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    availableRoutes: ['/api/auth', '/api/payments', '/api/agora', '/api/users', '/api/tokens'],
    timestamp: new Date().toISOString()
  });
});

// Global error handling middleware
app.use((err, req, res, _next) => {
  logger.error('Server error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  // Handle specific error types
  let statusCode = 500;
  let errorMessage = 'Internal server error';
  
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorMessage = 'Validation error';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorMessage = 'Unauthorized';
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    errorMessage = 'File too large';
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    errorMessage = 'Invalid JSON';
  }

  res.status(statusCode).json({
    error: errorMessage,
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] || Math.random().toString(36).substr(2, 9)
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received, shutting down gracefully');
  logger.info('Server shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🔄 SIGINT received, shutting down gracefully');
  logger.info('Server shutting down gracefully');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  logger.error('Unhandled rejection', { reason, promise });
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Create HTTP server for Socket.io
const http = require('http');
const server = http.createServer(app);

// Initialize Socket.io
try {
  const { initializeSocket } = require('../utils/socket');
  initializeSocket(server);
  console.log('Socket.io initialized successfully');
} catch (socketError) {
  console.error('Failed to initialize Socket.io:', socketError.message);
  // Continue without socket support
}

server.listen(PORT, HOST, () => {
  console.log(`🚀 Digis Backend running on ${HOST}:${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📚 API Documentation: http://${HOST}:${PORT}/api-docs`);
  console.log(`🏥 Health Check: http://${HOST}:${PORT}/health`);
  // Removed sensitive URL logging - use secure logger instead
  
  logger.info('Server started successfully', {
    port: PORT,
    host: HOST,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  });

  // Initialize scheduled jobs for payouts
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_CRON === 'true') {
    const { initializeScheduledJobs } = require('../jobs/cron-config');
    initializeScheduledJobs();
    console.log('📅 Scheduled jobs initialized for creator payouts');
    
    // Initialize automatic withdrawal cron jobs
    const { scheduleWithdrawals } = require('../utils/cron-withdrawals');
    scheduleWithdrawals();
    console.log('💰 Automatic withdrawal jobs scheduled for 1st and 15th of each month');
  }
});

module.exports = app;