// IMPORTANT: Sentry must be imported first for proper instrumentation
// Wrap in try-catch to make non-fatal on serverless
try {
  require('../instrument');
  console.log('✅ Sentry instrumentation loaded');
} catch (sentryError) {
  console.warn('⚠️ Failed to load Sentry instrumentation (non-fatal):', sentryError.message);
}

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { logger, requestLogger } = require('../utils/secureLogger');
const { applySecurity } = require('../middleware/security');
const { sanitizeInput } = require('../middleware/sanitize');
const { errorHandler, notFound } = require('../middleware/error-handler');
const { buildLimiters } = require('../middleware/rate-limiters');
const { detectVersion, versionInfo } = require('../middleware/versioning');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('../config/swagger');

// Remove sensitive console.logs - using secure logger instead
logger.info('Starting Digis backend server...');

// Load environment variables with comprehensive validation
try {
  // On Vercel/serverless, env vars are injected automatically - skip dotenv loading
  const isServerlessEnv = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (!isServerlessEnv) {
    const dotenvResult = require('dotenv').config({ path: path.join(__dirname, '../.env') });

    if (dotenvResult.error) {
      throw new Error(`Failed to load .env file: ${dotenvResult.error.message}`);
    }
  } else {
    console.log('🚀 Serverless environment detected - using injected environment variables');
  }

  // Validate all environment variables with Zod (non-fatal on serverless for debugging)
  try {
    const { validateEnv } = require('../utils/env');
    validateEnv();
  } catch (validationError) {
    console.warn('⚠️ Environment validation failed (continuing anyway):', validationError.message);
    // Don't exit - continue to see if app starts anyway
  }

} catch (envError) {
  console.error('❌ Critical environment configuration error:', envError.message);
  logger.error('Environment configuration error:', { error: envError.message });
  process.exit(1);
}

// Initialize Express app
const app = express();
console.log('Express app created');

// Apply comprehensive security middleware
console.log('Applying security middleware...');
applySecurity(app);

// Apply CSP headers for XSS protection
const { applyCSP } = require('../middleware/csp-headers');
applyCSP(app, {
  reportOnly: process.env.NODE_ENV === 'development', // Report-only in dev, enforce in prod
  reportUri: '/api/csp-report'
});

// Apply global input sanitization
app.use(sanitizeInput({
  body: 'strict',
  query: 'strict',
  params: 'strict',
  skipFields: ['password', 'paymentMethodId', 'stripeToken'] // Don't sanitize sensitive fields
}));

console.log('Security middleware applied');

// Add request ID middleware - MUST be early in the chain
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  // Enhance logging context
  req.log = {
    info: (message, meta = {}) => logger.info(message, { ...meta, requestId }),
    warn: (message, meta = {}) => logger.warn(message, { ...meta, requestId }),
    error: (message, meta = {}) => logger.error(message, { ...meta, requestId })
  };

  next();
});

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

// Additional security headers for JWT protection
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  // Removed Cross-Origin-Resource-Policy to allow CORS
  // res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  // Remove sensitive headers
  res.removeHeader('X-Powered-By');

  next();
});

// Note: Rate limiting is applied via buildLimiters() below when routes are registered

// Use the centralized CORS configuration
const { corsOptions } = require('../middleware/cors-config');
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

// Initialize rate limiters (async)
let rateLimiters = {};
(async () => {
  try {
    rateLimiters = await buildLimiters();
    console.log('✅ Rate limiters initialized');
  } catch (error) {
    console.warn('⚠️ Failed to initialize rate limiters, using defaults:', error.message);
  }
})();

// Load and register routes with error handling
let routeLoadError = null;
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
  const subscriptionTierRoutes = require('../routes/subscription-tiers');
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
  const sessionsRoutes = require('../routes/sessions');
  const streamChatRoutes = require('../routes/stream-chat');
  const streamFeaturesRoutes = require('../routes/stream-features');
  const earningsAnalyticsRoutes = require('../routes/earnings-analytics-v2'); // Using v2 with better schema
  const publicConnectRoutes = require('../routes/public-connect');
  const dashboardStatsRoutes = require('../routes/dashboard-stats');
  const conversationsRoutes = require('../routes/conversations');
  const subscriptionTiersRoutes = require('../routes/subscription-tiers');
  const ticketedShowsRoutes = require('../routes/ticketed-shows');
  const monitoringRoutes = require('../routes/monitoring');
  const storageRoutes = require('../routes/storage');
  const creatorDashboardRoutes = require('../routes/creator-dashboard');
  const digitalsRoutes = require('../routes/digitals');
  
  // Apply metrics middleware
  const metricsCollector = require('../utils/metrics-collector');
  app.use(metricsCollector.httpMetricsMiddleware());
  
  // Mount v1 routes
  app.use('/api/v1', v1Routes);

  // Use enhanced auth with JWT refresh tokens
  const authEnhancedRoutes = require('../routes/auth-enhanced');

  // Apply rate limiters to sensitive routes (disabled in development)
  const authLimiter = process.env.NODE_ENV === 'production' ? (rateLimiters.auth || ((req, res, next) => next())) : ((req, res, next) => next());
  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/auth/v2', authLimiter, authEnhancedRoutes); // New auth endpoints with refresh tokens

  // Ably token authentication endpoint (for Vercel real-time)
  const ablyAuth = require('./ably-auth');
  app.post('/api/ably-auth', ablyAuth);
  app.get('/api/ably-auth', ablyAuth);

  // Inngest trigger endpoint (for QStash cron) - MUST be before general handler
  const inngestTrigger = require('./inngest-trigger');
  app.post('/api/inngest/trigger', inngestTrigger);

  // Inngest webhook handler (for serverless workflows)
  const inngestHandler = require('./inngest');
  app.use('/api/inngest', inngestHandler);

  // Use enhanced payment routes with idempotency and rate limiting
  const paymentsEnhanced = require('../routes/payments-enhanced');
  app.use('/api/v1/payments', paymentsEnhanced); // New enhanced version
  app.use('/api/payments', rateLimiters.payment || ((req, res, next) => next()), paymentRoutes); // Keep legacy for backward compatibility
  app.use('/api/agora', rateLimiters.streaming || ((req, res, next) => next()), agoraRoutes);
  app.use('/api/users', rateLimiters.api || ((req, res, next) => next()), userRoutes);
  app.use('/api/tokens', rateLimiters.tokenPurchase || ((req, res, next) => next()), tokenRoutes);
  app.use('/api/subscriptions', rateLimiters.api || ((req, res, next) => next()), subscriptionRoutes);
  app.use('/api/subscription-tiers', rateLimiters.api || ((req, res, next) => next()), subscriptionTierRoutes);
  app.use('/api/gifts', rateLimiters.api || ((req, res, next) => next()), giftRoutes);
  app.use('/api/tips', rateLimiters.api || ((req, res, next) => next()), tipRoutes);
  app.use('/api/polls', rateLimiters.api || ((req, res, next) => next()), pollRoutes);
  app.use('/api/questions', rateLimiters.api || ((req, res, next) => next()), questionRoutes);
  app.use('/api/messages', rateLimiters.api || ((req, res, next) => next()), messageRoutes);
  app.use('/api/chat', rateLimiters.streaming || ((req, res, next) => next()), chatRoutes);
  app.use('/api/notifications', rateLimiters.api || ((req, res, next) => next()), notificationRoutes);
  app.use('/api/badges', rateLimiters.api || ((req, res, next) => next()), require('../routes/badges'));
  app.use('/api/loyalty', rateLimiters.api || ((req, res, next) => next()), require('../routes/loyalty'));
  app.use('/api/enhanced-subscriptions', rateLimiters.api || ((req, res, next) => next()), require('../routes/enhanced-subscriptions'));
  app.use('/api/subscriptions', rateLimiters.api || ((req, res, next) => next()), subscriptionTiersRoutes);
  app.use('/api/discovery', rateLimiters.public || ((req, res, next) => next()), require('../routes/discovery'));
  app.use('/api/goals', rateLimiters.api || ((req, res, next) => next()), require('../routes/goals'));
  app.use('/api/challenges', rateLimiters.api || ((req, res, next) => next()), require('../routes/challenges'));
  app.use('/api/admin', rateLimiters.api || ((req, res, next) => next()), require('../routes/admin'));
  app.use('/api/analytics', rateLimiters.analytics || ((req, res, next) => next()), analyticsRoutes);
  app.use('/api/moderation', rateLimiters.api || ((req, res, next) => next()), moderationRoutes);
  app.use('/api/offers', rateLimiters.api || ((req, res, next) => next()), offersRoutes);
  app.use('/api/streaming', rateLimiters.streaming || ((req, res, next) => next()), streamingRoutes);
  app.use('/api/ticketed-shows', rateLimiters.api || ((req, res, next) => next()), ticketedShowsRoutes);
  app.use('/api/collaborations', rateLimiters.api || ((req, res, next) => next()), collaborationRoutes);
  app.use('/api/membership-tiers', rateLimiters.api || ((req, res, next) => next()), membershipTiersRoutes);
  app.use('/api/classes', rateLimiters.api || ((req, res, next) => next()), classesRoutes);
  app.use('/api/stream-chat', rateLimiters.streaming || ((req, res, next) => next()), streamChatRoutes);
  app.use('/api/stream-features', rateLimiters.streaming || ((req, res, next) => next()), streamFeaturesRoutes);
  app.use('/api/earnings', rateLimiters.analytics || ((req, res, next) => next()), earningsAnalyticsRoutes);
  app.use('/api/public', rateLimiters.public || ((req, res, next) => next()), publicConnectRoutes);
  app.use('/api/dashboard', rateLimiters.analytics || ((req, res, next) => next()), dashboardStatsRoutes);
  app.use('/api/conversations', rateLimiters.api || ((req, res, next) => next()), conversationsRoutes);
  app.use('/api/creators', rateLimiters.public || ((req, res, next) => next()), creatorsRoutes);
  app.use('/api/tv-subscription', rateLimiters.api || ((req, res, next) => next()), tvSubscriptionRoutes);
  app.use('/api/vod', rateLimiters.api || ((req, res, next) => next()), require('../routes/vod'));
  app.use('/api/shop', rateLimiters.api || ((req, res, next) => next()), require('../routes/shop'));
  app.use('/api/live-shopping', rateLimiters.api || ((req, res, next) => next()), require('../routes/live-shopping'));
  app.use('/api/connect', rateLimiters.api || ((req, res, next) => next()), connectRoutes);
  app.use('/api/creator-payouts', rateLimiters.api || ((req, res, next) => next()), creatorPayoutRoutes);
  app.use('/api/privacy', rateLimiters.api || ((req, res, next) => next()), privacyRoutes);
  app.use('/api/recording', rateLimiters.streaming || ((req, res, next) => next()), recordingRoutes);
  app.use('/api/content', rateLimiters.upload || ((req, res, next) => next()), contentRoutes);
  app.use('/api/experiences', rateLimiters.api || ((req, res, next) => next()), experiencesRoutes);
  app.use('/api/sessions', rateLimiters.api || ((req, res, next) => next()), sessionsRoutes);
  app.use('/api/schedule', rateLimiters.api || ((req, res, next) => next()), require('../routes/schedule'));
  app.use('/api/wallet', rateLimiters.api || ((req, res, next) => next()), tokenRoutes); // Wallet endpoints are in tokens route
  app.use('/api/saved-creators', rateLimiters.api || ((req, res, next) => next()), require('../routes/saved-creators')); // Saved creators/bookmarks

  // Sentry test endpoints (DEVELOPMENT ONLY - remove in production)
  if (process.env.NODE_ENV !== 'production') {
    app.use('/api/sentry-test', require('../routes/sentry-test'));
  }
  app.use('/api/creator-dashboard', rateLimiters.analytics || ((req, res, next) => next()), creatorDashboardRoutes);
  app.use('/api/digitals', rateLimiters.upload || ((req, res, next) => next()), digitalsRoutes);
  app.use('/api/metrics', rateLimiters.analytics || ((req, res, next) => next()), monitoringRoutes);
  app.use('/api/storage', rateLimiters.upload || ((req, res, next) => next()), storageRoutes);
  app.use('/webhooks', webhookRoutes); // No rate limiting for webhooks
  app.use('/webhooks', stripeWebhookRoutes); // No rate limiting for webhooks
  
  console.log('✅ All routes loaded successfully');
} catch (routeError) {
  routeLoadError = routeError;
  console.error('❌ Error loading routes:', routeError.message);
  console.error('Stack:', routeError.stack);
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
    documentation: process.env.NODE_ENV === 'development' ? 'http://localhost:3005/api-docs' : '/api-docs',
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

// Sentry verification endpoint - Test error reporting
app.get('/debug-sentry', function mainHandler(req, res) {
  throw new Error("My first Sentry error!");
});

// Health check endpoint (liveness probe)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version
  });
});

// Readiness check endpoint (checks dependencies)
app.get('/ready', async (req, res) => {
  const checks = {
    database: false,
    redis: false,
    timestamp: new Date().toISOString()
  };

  try {
    // Check database
    const { pool } = require('../utils/db');
    await pool.query('SELECT 1');
    checks.database = true;
  } catch (error) {
    console.error('Database health check failed:', error.message);
  }

  try {
    // Check Redis if available
    const redis = require('../utils/redis');
    if (redis && redis.ping) {
      await redis.ping();
      checks.redis = true;
    }
  } catch (error) {
    console.error('Redis health check failed:', error.message);
    checks.redis = 'Not configured';
  }

  const allHealthy = checks.database && (checks.redis === true || checks.redis === 'Not configured');

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'not ready',
    checks
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

// Debug endpoint to check route loading errors
app.get('/debug/routes', (req, res) => {
  if (routeLoadError) {
    res.status(500).json({
      routesLoaded: false,
      error: {
        message: routeLoadError.message,
        stack: routeLoadError.stack,
        code: routeLoadError.code
      },
      timestamp: new Date().toISOString()
    });
  } else {
    res.json({
      routesLoaded: true,
      message: 'All routes loaded successfully',
      timestamp: new Date().toISOString()
    });
  }
});

// 404 handler for unmatched routes
app.use('*', notFound);

// Sentry error handler must be before any other error middleware
const Sentry = require('@sentry/node');
Sentry.setupExpressErrorHandler(app);

// Global error handling middleware
app.use(errorHandler);

// Legacy error handler (kept for compatibility)
app.use((err, req, res, _next) => {
  // This will only be called if errorHandler doesn't catch it
  // Log error details internally (never expose to client in production)
  logger.error('Server error', {
    requestId: req.requestId,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    body: process.env.NODE_ENV === 'development' ? req.body : undefined,
    timestamp: new Date().toISOString()
  });

  // Determine appropriate error response
  let statusCode = err.statusCode || err.status || 500;
  let errorMessage = 'Internal server error';
  let errorCode = 'INTERNAL_ERROR';

  // Map specific error types to user-friendly messages
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorMessage = 'Invalid input provided';
    errorCode = 'VALIDATION_ERROR';
  } else if (err.name === 'UnauthorizedError' || statusCode === 401) {
    statusCode = 401;
    errorMessage = 'Authentication required';
    errorCode = 'UNAUTHORIZED';
  } else if (err.name === 'ForbiddenError' || statusCode === 403) {
    statusCode = 403;
    errorMessage = 'Access denied';
    errorCode = 'FORBIDDEN';
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    errorMessage = 'File too large';
    errorCode = 'FILE_TOO_LARGE';
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    errorMessage = 'Invalid request format';
    errorCode = 'INVALID_FORMAT';
  } else if (err.code === '23505') { // PostgreSQL unique violation
    statusCode = 409;
    errorMessage = 'Resource already exists';
    errorCode = 'DUPLICATE_RESOURCE';
  } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
    statusCode = 503;
    errorMessage = 'Service temporarily unavailable';
    errorCode = 'SERVICE_UNAVAILABLE';
  }

  // Build response based on environment
  const response = {
    success: false,
    error: {
      code: errorCode,
      message: errorMessage,
      requestId: req.requestId
    },
    timestamp: new Date().toISOString()
  };

  // Add detailed error info only in development
  if (process.env.NODE_ENV === 'development') {
    response.error.details = err.message;
    response.error.stack = err.stack;
  }

  // Send response with appropriate headers
  res.setHeader('x-request-id', req.requestId);
  res.status(statusCode).json(response);
});

// Graceful shutdown handling
const gracefulShutdown = () => {
  logger.info('Server shutting down gracefully');
  
  // Stop stream activity monitor
  try {
    const streamActivityMonitor = require('../utils/stream-activity-monitor');
    streamActivityMonitor.stop();
    console.log('Stream activity monitor stopped');
  } catch (error) {
    console.error('Error stopping stream monitor:', error);
  }
  
  // Stop loyalty perk delivery jobs
  try {
    const loyaltyPerkDeliveryJob = require('../jobs/loyalty-perk-delivery');
    loyaltyPerkDeliveryJob.stop();
    console.log('Loyalty perk delivery jobs stopped');
  } catch (error) {
    console.error('Error stopping loyalty jobs:', error);
  }
  
  process.exit(0);
};

process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received, shutting down gracefully');
  gracefulShutdown();
});

process.on('SIGINT', () => {
  console.log('🔄 SIGINT received, shutting down gracefully');
  gracefulShutdown();
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

const PORT = process.env.PORT || 3005;
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

// Initialize Stream Activity Monitor
try {
  const streamActivityMonitor = require('../utils/stream-activity-monitor');
  streamActivityMonitor.start();
  console.log('Stream activity monitor started successfully');
} catch (monitorError) {
  console.error('Failed to start stream activity monitor:', monitorError.message);
  // Continue without monitor
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

  // Initialize BullMQ background workers (skip on serverless)
  // BullMQ workers require persistent connections and don't work on Vercel/AWS Lambda
  const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (!isServerless) {
    try {
      const { initWorkers } = require('../lib/queue');
      initWorkers();
      console.log('⚙️ Background job workers initialized (BullMQ)');
    } catch (queueError) {
      console.warn('⚠️ Failed to initialize background workers:', queueError.message);
      // Continue without background jobs
    }
  } else {
    console.log('🚀 Serverless environment detected - skipping BullMQ workers (using Inngest instead)');
  }

  // Initialize scheduled jobs for payouts (skip on serverless - use QStash instead)
  if (!isServerless && (process.env.NODE_ENV === 'production' || process.env.ENABLE_CRON === 'true')) {
    const { initializeScheduledJobs } = require('../jobs/cron-config');
    initializeScheduledJobs();
    console.log('📅 Scheduled jobs initialized for creator payouts');

    // Initialize automatic withdrawal cron jobs
    const { scheduleWithdrawals } = require('../utils/cron-withdrawals');
    scheduleWithdrawals();
    console.log('💰 Automatic withdrawal jobs scheduled for 1st and 15th of each month');

    // Initialize loyalty perk delivery jobs
    const loyaltyPerkDeliveryJob = require('../jobs/loyalty-perk-delivery');
    loyaltyPerkDeliveryJob.start();
    console.log('🎁 Loyalty perk delivery jobs initialized');
  } else if (isServerless) {
    console.log('⏰ Serverless environment - cron jobs will be triggered via QStash (see /api/inngest/trigger)');
  }
});

module.exports = app;