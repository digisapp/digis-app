const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const { logger, requestLogger } = require('../utils/secureLogger');
const { applySecurity } = require('../middleware/security-enhanced');
const { detectVersion, versionInfo } = require('../middleware/versioning');
const { csrfTokenMiddleware, csrfProtectionDefault } = require('../middleware/csrf');
const { initializeMonitoring, errorMonitoringMiddleware } = require('../middleware/monitoring');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('../config/swagger');

// Remove sensitive console.logs - using secure logger instead
logger.info('Starting Digis backend server with enhanced features...');

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
logger.info('Express app created');

// Initialize monitoring early
initializeMonitoring(app);

// Apply comprehensive security middleware
logger.info('Applying enhanced security middleware...');
applySecurity(app);
logger.info('Security middleware applied');

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

// API versioning middleware
app.use(detectVersion);

// Initialize Supabase Admin
const { initializeSupabaseAdmin } = require('../utils/supabase-admin');
initializeSupabaseAdmin();

// Initialize database connection pool
const { pool, testConnection } = require('../utils/db');
testConnection().catch(error => {
  logger.error('Database connection failed:', error);
  process.exit(1);
});

// CSRF token generation endpoint (public)
app.get('/api/csrf-token', csrfTokenMiddleware, (req, res) => {
  res.json({ 
    csrfToken: res.locals.csrfToken,
    message: 'Include this token in X-CSRF-Token header for state-changing requests'
  });
});

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "Digis API Documentation"
}));

// Health check endpoints (no auth required)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: versionInfo.current,
    uptime: process.uptime()
  });
});

// Import routes
const authRoutes = require('../routes/auth');
const userRoutes = require('../routes/users');
const paymentRoutes = require('../routes/payments');
const tokenRoutes = require('../routes/tokens');
const agoraRoutes = require('../routes/agora');
const messagesRoutes = require('../routes/messages');
const notificationsRoutes = require('../routes/notifications');
const creatorRoutes = require('../routes/creators');
const streamingRoutes = require('../routes/streaming');
const stripeWebhookRoutes = require('../routes/stripe-webhooks');
const analyticsRoutes = require('../routes/analytics');
const subscriptionsRoutes = require('../routes/subscriptions');
const adminRoutes = require('../routes/admin');
const tvSubscriptionRoutes = require('../routes/tv-subscription');
const classesRoutes = require('../routes/classes');
const privacyRoutes = require('../routes/privacy');
const chatRoutes = require('../routes/chat');
const connectRoutes = require('../routes/connect');
const recordingRoutes = require('../routes/recording');
const creatorPayoutsRoutes = require('../routes/creator-payouts');
const tipsRoutes = require('../routes/tips');
const giftsRoutes = require('../routes/gifts');
const membershipTiersRoutes = require('../routes/membership-tiers');
const offersRoutes = require('../routes/offers');
const contentRoutes = require('../routes/content');
const experiencesRoutes = require('../routes/experiences');

// Apply routes with CSRF protection where needed
app.use('/api/auth', authRoutes);
app.use('/api/users', csrfProtectionDefault, userRoutes);
app.use('/api/payments', csrfProtectionDefault, paymentRoutes);
app.use('/api/tokens', csrfProtectionDefault, tokenRoutes);
app.use('/api/agora', csrfProtectionDefault, agoraRoutes);
app.use('/api/messages', csrfProtectionDefault, messagesRoutes);
app.use('/api/notifications', notificationsRoutes); // Read-only, no CSRF needed
app.use('/api/creators', csrfProtectionDefault, creatorRoutes);
app.use('/api/streaming', csrfProtectionDefault, streamingRoutes);
app.use('/api/stripe-webhooks', stripeWebhookRoutes); // Webhook, no CSRF
app.use('/api/analytics', analyticsRoutes); // Read-only
app.use('/api/subscriptions', csrfProtectionDefault, subscriptionsRoutes);
app.use('/api/admin', csrfProtectionDefault, adminRoutes);
app.use('/api/tv-subscription', csrfProtectionDefault, tvSubscriptionRoutes);
app.use('/api/classes', csrfProtectionDefault, classesRoutes);
app.use('/api/privacy', csrfProtectionDefault, privacyRoutes);
app.use('/api/chat', chatRoutes); // Real-time, handled separately
app.use('/api/connect', csrfProtectionDefault, connectRoutes);
app.use('/api/recording', csrfProtectionDefault, recordingRoutes);
app.use('/api/creator-payouts', csrfProtectionDefault, creatorPayoutsRoutes);
app.use('/api/tips', csrfProtectionDefault, tipsRoutes);
app.use('/api/gifts', csrfProtectionDefault, giftsRoutes);
app.use('/api/membership-tiers', csrfProtectionDefault, membershipTiersRoutes);
app.use('/api/offers', csrfProtectionDefault, offersRoutes);
app.use('/api/content', csrfProtectionDefault, contentRoutes);
app.use('/api/experiences', csrfProtectionDefault, experiencesRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    message: `Cannot ${req.method} ${req.path}`,
    timestamp: new Date().toISOString()
  });
});

// Error monitoring middleware
app.use(errorMonitoringMiddleware);

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id
  });

  // Don't expose internal errors in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  res.status(err.status || 500).json({
    error: message,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Server initialization
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  logger.info(`✅ Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  logger.info(`📊 Metrics available at http://localhost:${PORT}/metrics`);
  logger.info(`📚 API documentation available at http://localhost:${PORT}/api-docs`);
});

// Initialize Socket.io with enhanced configuration
const { initializeSocket, shutdown: shutdownSocket } = require('../utils/socket-improved');
initializeSocket(server).catch(error => {
  logger.error('Failed to initialize Socket.io:', error);
});

// Graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
  logger.info('Graceful shutdown initiated...');
  
  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      // Close Socket.io connections
      await shutdownSocket();
      
      // Close database connection
      await pool.end();
      logger.info('Database connections closed');
      
      // Close Redis connections if any
      if (process.env.REDIS_URL) {
        const { createClient } = require('redis');
        const redisClient = createClient({ url: process.env.REDIS_URL });
        await redisClient.quit();
        logger.info('Redis connections closed');
      }
      
      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown();
});

module.exports = app;