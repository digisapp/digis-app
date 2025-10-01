const promBundle = require('express-prom-bundle');
const { register, Counter, Histogram, Gauge } = require('prom-client');

// Custom metrics for business logic
const customMetrics = {
  // User metrics
  activeUsers: new Gauge({
    name: 'digis_active_users_total',
    help: 'Total number of active users',
    labelNames: ['type']
  }),
  
  userRegistrations: new Counter({
    name: 'digis_user_registrations_total',
    help: 'Total number of user registrations',
    labelNames: ['method']
  }),
  
  // Token metrics
  tokenPurchases: new Counter({
    name: 'digis_token_purchases_total',
    help: 'Total number of token purchases',
    labelNames: ['payment_method', 'status']
  }),
  
  tokenBalance: new Gauge({
    name: 'digis_token_balance_total',
    help: 'Total token balance across all users'
  }),
  
  // Session metrics
  videoSessions: new Counter({
    name: 'digis_video_sessions_total',
    help: 'Total number of video sessions',
    labelNames: ['type', 'status']
  }),
  
  sessionDuration: new Histogram({
    name: 'digis_session_duration_seconds',
    help: 'Duration of video/voice sessions in seconds',
    labelNames: ['type'],
    buckets: [30, 60, 120, 300, 600, 1200, 1800, 3600] // 30s to 1 hour
  }),
  
  sessionRevenue: new Counter({
    name: 'digis_session_revenue_tokens',
    help: 'Total revenue from sessions in tokens',
    labelNames: ['type', 'creator_id']
  }),
  
  // Streaming metrics
  activeStreams: new Gauge({
    name: 'digis_active_streams_total',
    help: 'Current number of active streams'
  }),
  
  streamViewers: new Gauge({
    name: 'digis_stream_viewers_total',
    help: 'Current total viewers across all streams'
  }),
  
  // Payment metrics
  paymentAttempts: new Counter({
    name: 'digis_payment_attempts_total',
    help: 'Total payment attempts',
    labelNames: ['provider', 'status']
  }),
  
  paymentAmount: new Histogram({
    name: 'digis_payment_amount_usd',
    help: 'Payment amounts in USD',
    buckets: [5, 10, 20, 50, 100, 200, 500, 1000]
  }),
  
  // WebSocket metrics
  websocketConnections: new Gauge({
    name: 'digis_websocket_connections_active',
    help: 'Current active WebSocket connections'
  }),
  
  websocketMessages: new Counter({
    name: 'digis_websocket_messages_total',
    help: 'Total WebSocket messages',
    labelNames: ['type', 'direction']
  }),
  
  // Error metrics
  applicationErrors: new Counter({
    name: 'digis_application_errors_total',
    help: 'Total application errors',
    labelNames: ['type', 'severity', 'endpoint']
  }),
  
  // API metrics
  apiCalls: new Counter({
    name: 'digis_api_calls_total',
    help: 'Total API calls',
    labelNames: ['endpoint', 'method', 'status_code']
  }),
  
  apiResponseTime: new Histogram({
    name: 'digis_api_response_time_seconds',
    help: 'API response time in seconds',
    labelNames: ['endpoint', 'method'],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
  }),
  
  // Database metrics
  dbQueries: new Counter({
    name: 'digis_database_queries_total',
    help: 'Total database queries',
    labelNames: ['operation', 'table', 'status']
  }),
  
  dbQueryDuration: new Histogram({
    name: 'digis_database_query_duration_seconds',
    help: 'Database query duration',
    labelNames: ['operation', 'table'],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1]
  }),
  
  dbConnections: new Gauge({
    name: 'digis_database_connections_active',
    help: 'Active database connections'
  }),
  
  // Cache metrics
  cacheHits: new Counter({
    name: 'digis_cache_hits_total',
    help: 'Total cache hits',
    labelNames: ['cache_type']
  }),
  
  cacheMisses: new Counter({
    name: 'digis_cache_misses_total',
    help: 'Total cache misses',
    labelNames: ['cache_type']
  })
};

// Prometheus middleware configuration
const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  includeUp: true,
  customLabels: {
    project_name: 'digis',
    environment: process.env.NODE_ENV || 'development'
  },
  promClient: {
    collectDefaultMetrics: {
      timeout: 5000
    }
  },
  urlValueParser: {
    // Normalize URLs to avoid high cardinality
    // e.g., /users/123 becomes /users/:id
    minHexLength: 5,
    extraMasks: [
      /^\/api\/users\/[^\/]+$/,
      /^\/api\/creators\/[^\/]+$/,
      /^\/api\/sessions\/[^\/]+$/,
      /^\/api\/streams\/[^\/]+$/
    ]
  },
  normalizePath: [
    ['^/api/users/[0-9]+', '/api/users/:id'],
    ['^/api/creators/[0-9]+', '/api/creators/:id'],
    ['^/api/sessions/[0-9]+', '/api/sessions/:id'],
    ['^/api/streams/[0-9]+', '/api/streams/:id'],
    ['^/api/users/profile\\?uid=.+', '/api/users/profile'],
  ],
  metricsPath: '/metrics',
  collectGCMetrics: true,
  requestDurationBuckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  promRegistry: register
});

// Helper functions to update custom metrics
const metrics = {
  // User metrics
  recordUserRegistration: (method = 'email') => {
    customMetrics.userRegistrations.inc({ method });
  },
  
  updateActiveUsers: (count, type = 'total') => {
    customMetrics.activeUsers.set({ type }, count);
  },
  
  // Token metrics
  recordTokenPurchase: (paymentMethod, status, amount) => {
    customMetrics.tokenPurchases.inc({ payment_method: paymentMethod, status });
    if (status === 'success' && amount) {
      customMetrics.paymentAmount.observe(amount);
    }
  },
  
  updateTokenBalance: (totalBalance) => {
    customMetrics.tokenBalance.set(totalBalance);
  },
  
  // Session metrics
  recordVideoSession: (type, status) => {
    customMetrics.videoSessions.inc({ type, status });
  },
  
  recordSessionDuration: (duration, type) => {
    customMetrics.sessionDuration.observe({ type }, duration);
  },
  
  recordSessionRevenue: (tokens, type, creatorId) => {
    customMetrics.sessionRevenue.inc({ type, creator_id: creatorId }, tokens);
  },
  
  // Streaming metrics
  updateActiveStreams: (count) => {
    customMetrics.activeStreams.set(count);
  },
  
  updateStreamViewers: (count) => {
    customMetrics.streamViewers.set(count);
  },
  
  // WebSocket metrics
  updateWebsocketConnections: (count) => {
    customMetrics.websocketConnections.set(count);
  },
  
  recordWebsocketMessage: (type, direction) => {
    customMetrics.websocketMessages.inc({ type, direction });
  },
  
  // Error metrics
  recordError: (type, severity, endpoint) => {
    customMetrics.applicationErrors.inc({ type, severity, endpoint });
  },
  
  // Database metrics
  recordDatabaseQuery: (operation, table, status, duration) => {
    customMetrics.dbQueries.inc({ operation, table, status });
    if (duration) {
      customMetrics.dbQueryDuration.observe({ operation, table }, duration);
    }
  },
  
  updateDatabaseConnections: (count) => {
    customMetrics.dbConnections.set(count);
  },
  
  // Cache metrics
  recordCacheHit: (cacheType) => {
    customMetrics.cacheHits.inc({ cache_type: cacheType });
  },
  
  recordCacheMiss: (cacheType) => {
    customMetrics.cacheMisses.inc({ cache_type: cacheType });
  },
  
  // Payment metrics
  recordPaymentAttempt: (provider, status) => {
    customMetrics.paymentAttempts.inc({ provider, status });
  }
};

// Database query monitoring wrapper
const monitorDatabaseQuery = async (operation, table, queryFn) => {
  const start = Date.now();
  let status = 'success';
  
  try {
    const result = await queryFn();
    return result;
  } catch (error) {
    status = 'error';
    throw error;
  } finally {
    const duration = (Date.now() - start) / 1000;
    metrics.recordDatabaseQuery(operation, table, status, duration);
  }
};

// Error monitoring middleware
const errorMonitoringMiddleware = (err, req, res, next) => {
  const severity = err.status >= 500 ? 'error' : 'warning';
  const endpoint = req.route?.path || req.path || 'unknown';
  
  metrics.recordError(
    err.name || 'UnknownError',
    severity,
    endpoint
  );
  
  next(err);
};

// Custom endpoint monitoring
const monitorEndpoint = (req, res, next) => {
  const start = Date.now();
  
  // Override res.end to capture metrics
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = (Date.now() - start) / 1000;
    const endpoint = req.route?.path || req.path || 'unknown';
    
    customMetrics.apiCalls.inc({
      endpoint,
      method: req.method,
      status_code: res.statusCode
    });
    
    customMetrics.apiResponseTime.observe({
      endpoint,
      method: req.method
    }, duration);
    
    originalEnd.apply(res, args);
  };
  
  next();
};

// Health check endpoint with metrics
const healthCheckEndpoint = async (req, res) => {
  try {
    // Check database connection
    const { pool } = require('../utils/db');
    const dbCheck = await pool.query('SELECT 1');
    
    // Check Redis if configured
    let redisStatus = 'not_configured';
    if (process.env.REDIS_URL) {
      try {
        const { createClient } = require('redis');
        const redisClient = createClient({ url: process.env.REDIS_URL });
        await redisClient.connect();
        await redisClient.ping();
        await redisClient.disconnect();
        redisStatus = 'healthy';
      } catch (error) {
        redisStatus = 'unhealthy';
      }
    }
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      services: {
        database: dbCheck.rows.length > 0 ? 'healthy' : 'unhealthy',
        redis: redisStatus
      },
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Initialize monitoring
const initializeMonitoring = (app) => {
  // Add Prometheus metrics endpoint
  app.use(metricsMiddleware);
  
  // Add custom endpoint monitoring
  app.use(monitorEndpoint);
  
  // Add health check endpoint
  app.get('/health', healthCheckEndpoint);
  app.get('/api/health', healthCheckEndpoint);
  
  console.log('✅ Monitoring initialized with Prometheus metrics at /metrics');
};

module.exports = {
  metricsMiddleware,
  metrics,
  monitorDatabaseQuery,
  errorMonitoringMiddleware,
  initializeMonitoring,
  customMetrics
};