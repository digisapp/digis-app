const db = require('./db');
const { createClient } = require('@supabase/supabase-js');
const client = require('prom-client');

// Create a Registry
const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new client.Histogram({
  name: 'digis_api_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const httpRequestTotal = new client.Counter({
  name: 'digis_api_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status']
});

const activeSessionsGauge = new client.Gauge({
  name: 'digis_active_sessions',
  help: 'Number of active video/voice sessions'
});

const onlineCreatorsGauge = new client.Gauge({
  name: 'digis_online_creators',
  help: 'Number of online creators'
});

const tokenBalanceGauge = new client.Gauge({
  name: 'digis_platform_token_balance',
  help: 'Total platform token balance'
});

const tokenPurchasesCounter = new client.Counter({
  name: 'digis_token_purchases_total',
  help: 'Total number of token purchases',
  labelNames: ['payment_method', 'package']
});

const userSignupsCounter = new client.Counter({
  name: 'digis_user_signups_total',
  help: 'Total number of user signups',
  labelNames: ['user_type']
});

const apiErrorsCounter = new client.Counter({
  name: 'digis_api_errors_total',
  help: 'Total number of API errors',
  labelNames: ['endpoint', 'error_type']
});

const dbQueryDuration = new client.Histogram({
  name: 'digis_db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['query_type', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5]
});

const webSocketConnections = new client.Gauge({
  name: 'digis_websocket_connections',
  help: 'Number of active WebSocket connections'
});

const streamQualityGauge = new client.Gauge({
  name: 'digis_stream_quality_score',
  help: 'Average stream quality score (0-100)',
  labelNames: ['session_type']
});

// Register all metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(activeSessionsGauge);
register.registerMetric(onlineCreatorsGauge);
register.registerMetric(tokenBalanceGauge);
register.registerMetric(tokenPurchasesCounter);
register.registerMetric(userSignupsCounter);
register.registerMetric(apiErrorsCounter);
register.registerMetric(dbQueryDuration);
register.registerMetric(webSocketConnections);
register.registerMetric(streamQualityGauge);

class MetricsCollector {
  constructor() {
    this.register = register;
    this.startCollecting();
  }

  // Middleware to track HTTP metrics
  httpMetricsMiddleware() {
    return (req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route ? req.route.path : req.path;
        const method = req.method;
        const status = res.statusCode;
        
        httpRequestDuration.labels(method, route, status).observe(duration);
        httpRequestTotal.labels(method, route, status).inc();
        
        if (status >= 400) {
          const errorType = status >= 500 ? 'server_error' : 'client_error';
          apiErrorsCounter.labels(route, errorType).inc();
        }
      });
      
      next();
    };
  }

  // Track database query metrics
  async trackDatabaseQuery(queryType, table, queryFn) {
    const end = dbQueryDuration.startTimer({ query_type: queryType, table: table });
    try {
      const result = await queryFn();
      return result;
    } finally {
      end();
    }
  }

  // Collect platform metrics periodically
  async startCollecting() {
    setInterval(async () => {
      try {
        await this.collectPlatformMetrics();
      } catch (error) {
        console.error('Error collecting platform metrics:', error);
      }
    }, 30000); // Every 30 seconds
  }

  async collectPlatformMetrics() {
    try {
      // Active sessions
      const sessionsResult = await db.query(
        "SELECT COUNT(*) as count FROM sessions WHERE status = 'active'"
      );
      activeSessionsGauge.set(parseInt(sessionsResult.rows[0].count));

      // Online creators
      const creatorsResult = await db.query(
        "SELECT COUNT(*) as count FROM users WHERE is_creator = true AND is_online = true"
      );
      onlineCreatorsGauge.set(parseInt(creatorsResult.rows[0].count));

      // Platform token balance
      const tokenResult = await db.query(
        "SELECT SUM(balance) as total FROM user_tokens"
      );
      tokenBalanceGauge.set(parseFloat(tokenResult.rows[0].total || 0));

      // Stream quality metrics
      const qualityResult = await db.query(`
        SELECT 
          session_type,
          AVG(quality_score) as avg_quality
        FROM session_metrics
        WHERE created_at > NOW() - INTERVAL '5 minutes'
        GROUP BY session_type
      `);
      
      qualityResult.rows.forEach(row => {
        streamQualityGauge.labels(row.session_type).set(parseFloat(row.avg_quality || 0));
      });
    } catch (error) {
      console.error('Error collecting platform metrics:', error);
    }
  }

  // Collect database performance metrics
  async collectDatabaseMetrics() {
    const metrics = {};
    
    try {
      // Database size
      const sizeQuery = `
        SELECT 
          pg_database_size(current_database()) as db_size,
          pg_size_pretty(pg_database_size(current_database())) as db_size_pretty
      `;
      
      // Connection stats
      const connectionsQuery = `
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections,
          count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
        FROM pg_stat_activity
        WHERE datname = current_database()
      `;
      
      // Cache hit ratio
      const cacheQuery = `
        SELECT 
          sum(heap_blks_hit)::float / 
          NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) as cache_hit_ratio
        FROM pg_statio_user_tables
      `;
      
      // Table statistics
      const tableStatsQuery = `
        SELECT 
          schemaname,
          tablename,
          n_live_tup as live_rows,
          n_dead_tup as dead_rows,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
        LIMIT 10
      `;
      
      // Slow queries (if pg_stat_statements is enabled)
      const slowQueriesQuery = `
        SELECT 
          query,
          calls,
          mean_exec_time,
          total_exec_time,
          min_exec_time,
          max_exec_time
        FROM pg_stat_statements
        WHERE query NOT LIKE '%pg_stat_statements%'
        ORDER BY mean_exec_time DESC
        LIMIT 10
      `;
      
      // Index usage
      const indexUsageQuery = `
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan as index_scans,
          idx_tup_read as tuples_read,
          idx_tup_fetch as tuples_fetched
        FROM pg_stat_user_indexes
        ORDER BY idx_scan DESC
        LIMIT 10
      `;
      
      // Collect all metrics
      const [size, connections, cache, tableStats] = await Promise.all([
        db.query(sizeQuery),
        db.query(connectionsQuery),
        db.query(cacheQuery),
        db.query(tableStatsQuery)
      ]);
      
      metrics.database_size = size.rows[0].db_size;
      metrics.database_size_pretty = size.rows[0].db_size_pretty;
      metrics.connections = connections.rows[0];
      metrics.cache_hit_ratio = cache.rows[0].cache_hit_ratio;
      metrics.table_statistics = tableStats.rows;
      
      // Try to get slow queries (may fail if extension not enabled)
      try {
        const slowQueries = await db.query(slowQueriesQuery);
        metrics.slow_queries = slowQueries.rows;
      } catch (e) {
        metrics.slow_queries = [];
      }
      
      // Try to get index usage
      try {
        const indexUsage = await db.query(indexUsageQuery);
        metrics.index_usage = indexUsage.rows;
      } catch (e) {
        metrics.index_usage = [];
      }
      
      metrics.timestamp = new Date();
      
      return metrics;
    } catch (error) {
      console.error('Error collecting database metrics:', error);
      throw error;
    }
  }
  
  // Collect application business metrics
  async collectBusinessMetrics() {
    const metrics = {};
    
    try {
      // User metrics
      const userMetricsQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as new_users_24h,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_users_7d,
          COUNT(*) FILTER (WHERE is_creator = true) as total_creators,
          COUNT(*) FILTER (WHERE is_creator = false) as total_fans,
          COUNT(*) FILTER (WHERE last_login > NOW() - INTERVAL '24 hours') as active_users_24h
        FROM users
      `;
      
      // Session metrics
      const sessionMetricsQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE status = 'active') as active_sessions,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as sessions_24h,
          AVG(duration_minutes) as avg_session_duration,
          SUM(tokens_earned) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as tokens_earned_24h
        FROM sessions
      `;
      
      // Token economy metrics
      const tokenMetricsQuery = `
        SELECT 
          SUM(amount) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as tokens_purchased_1h,
          SUM(amount) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as tokens_purchased_24h,
          COUNT(DISTINCT user_id) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as unique_buyers_24h,
          AVG(amount) as avg_purchase_amount
        FROM token_purchases
        WHERE created_at > NOW() - INTERVAL '30 days'
      `;
      
      // Creator performance
      const creatorPerformanceQuery = `
        SELECT 
          COUNT(DISTINCT creator_id) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as active_creators_24h,
          AVG(hourly_rate) as avg_hourly_rate,
          MAX(hourly_rate) as max_hourly_rate,
          MIN(hourly_rate) as min_hourly_rate
        FROM creator_profiles
        WHERE is_active = true
      `;
      
      // Revenue metrics
      const revenueQuery = `
        SELECT 
          SUM(amount) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as revenue_1h,
          SUM(amount) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as revenue_24h,
          SUM(amount) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as revenue_7d,
          SUM(amount) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as revenue_30d
        FROM payments
        WHERE status = 'completed'
      `;
      
      // Collect all metrics
      const [users, sessions, tokens, creators, revenue] = await Promise.all([
        db.query(userMetricsQuery),
        db.query(sessionMetricsQuery),
        db.query(tokenMetricsQuery),
        db.query(creatorPerformanceQuery),
        db.query(revenueQuery)
      ]);
      
      metrics.users = users.rows[0];
      metrics.sessions = sessions.rows[0];
      metrics.tokens = tokens.rows[0];
      metrics.creators = creators.rows[0];
      metrics.revenue = revenue.rows[0];
      metrics.timestamp = new Date();
      
      return metrics;
    } catch (error) {
      console.error('Error collecting business metrics:', error);
      throw error;
    }
  }

  // Track WebSocket connections
  trackWebSocketConnection(connected) {
    if (connected) {
      webSocketConnections.inc();
    } else {
      webSocketConnections.dec();
    }
  }

  // Track token purchases
  trackTokenPurchase(paymentMethod, packageType, amount) {
    tokenPurchasesCounter.labels(paymentMethod, packageType).inc();
  }

  // Track user signups
  trackUserSignup(userType) {
    userSignupsCounter.labels(userType).inc();
  }

  // Get metrics in Prometheus format
  async getPrometheusMetrics() {
    return this.register.metrics();
  }

  // Get metrics in JSON format
  async getJSONMetrics() {
    const [dbMetrics, businessMetrics] = await Promise.all([
      this.collectDatabaseMetrics(),
      this.collectBusinessMetrics()
    ]);
    
    return {
      database: dbMetrics,
      business: businessMetrics,
      prometheus_metrics: await this.register.getMetricsAsJSON()
    };
  }
}

module.exports = new MetricsCollector();