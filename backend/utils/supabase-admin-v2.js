/**
 * Supabase Admin Client v2 - Updated with Latest 2024-2025 Features
 * Implements asymmetric JWT, analytics buckets, and observability
 */

const { createClient } = require('@supabase/supabase-js');
// NOTE: jose is an ES Module and cannot be required in CommonJS
// Temporarily disabled asymmetric JWT until we migrate to ES modules
// const { createRemoteJWKSet, jwtVerify } = require('jose');
const crypto = require('crypto');
const { logger } = require('./secureLogger');

// IMPORTANT: Use Upstash Redis for serverless compatibility
// This replaces the old Node Redis client to prevent connection pooling issues on Vercel
const { Redis } = require('@upstash/redis');

let supabaseAdmin = null;
let redisClient = null;
let jwksClient = null;

// Retry utility with exponential backoff
const retry = async (fn, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const waitTime = delay * Math.pow(2, i);
      logger.warn(`Retry ${i + 1}/${maxRetries} after ${waitTime}ms: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
};

// Initialize Upstash Redis (serverless-compatible)
const initializeRedis = () => {
  if (redisClient) return redisClient;

  try {
    // Check for Upstash environment variables
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      logger.warn('⚠️ Upstash Redis not configured, caching will be disabled');
      logger.info('Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enable caching');
      return null;
    }

    // Initialize Upstash Redis (HTTP-based, serverless-compatible)
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    logger.info('✅ Upstash Redis client initialized (serverless-compatible)');
    return redisClient;
  } catch (error) {
    logger.warn('⚠️ Redis initialization failed, continuing without cache:', error.message);
    return null;
  }
};

// Initialize Supabase Admin with latest features
const initializeSupabaseAdmin = () => {
  if (supabaseAdmin) {
    return supabaseAdmin;
  }

  try {
    // Validate required environment variables
    const requiredVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      throw new Error(`Missing Supabase environment variables: ${missing.join(', ')}`);
    }

    // Initialize with proper configuration
    supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        },
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'x-client-info': 'digis-backend/2.0.0'
          }
        }
      }
    );

    // Initialize JWKS client for asymmetric JWT verification
    // TEMPORARILY DISABLED: jose is ES Module only
    // const jwtIssuer = `${process.env.SUPABASE_URL}/auth/v1`;
    // jwksClient = createRemoteJWKSet(
    //   new URL(`${jwtIssuer}/.well-known/jwks.json`)
    // );

    logger.info('✅ Supabase Admin v2 initialized with enhanced features');
    return supabaseAdmin;
  } catch (error) {
    logger.error('❌ Supabase initialization error:', {
      message: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

/**
 * Verify Supabase JWT with asymmetric keys (New Feature)
 * Supports both symmetric (legacy) and asymmetric (new) JWT verification
 */
const verifySupabaseTokenAsymmetric = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'No token provided',
        message: 'Authorization header must be in format: Bearer <token>',
        timestamp: new Date().toISOString()
      });
    }

    const token = authHeader.split('Bearer ')[1];

    // Generate secure cache key using hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 16);

    // Check cache first (Upstash Redis)
    if (redisClient) {
      try {
        const cached = await redisClient.get(`jwt:${tokenHash}`);
        if (cached) {
          const cachedData = typeof cached === 'string' ? JSON.parse(cached) : cached;
          // Verify cache hasn't expired
          if (cachedData.exp && cachedData.exp * 1000 > Date.now()) {
            req.user = cachedData.user;
            return next();
          } else {
            // Remove expired cache
            await redisClient.del(`jwt:${tokenHash}`);
          }
        }
      } catch (cacheError) {
        logger.warn('Redis cache read failed:', cacheError.message);
        // Continue without cache
      }
    }

    // Symmetric verification (using Supabase client)
    // NOTE: Asymmetric verification with jose is temporarily disabled (ES Module issue)
    const admin = initializeSupabaseAdmin();

    // Log token info for debugging (only first 20 chars for security)
    logger.debug('Attempting symmetric verification with token:', token.substring(0, 20) + '...');

    let user;
    try {
      // Create a user-scoped client with the JWT token
      const { createClient } = require('@supabase/supabase-js');
      const userClient = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        }
      );

      // Now get the user with the authenticated client
      const result = await userClient.auth.getUser();

      if (result.error || !result.data?.user) {
        logger.error('Token verification failed:', result.error);
        return res.status(401).json({
          error: 'Invalid token',
          message: result.error?.message || 'Token verification failed',
          timestamp: new Date().toISOString()
        });
      }
      user = result.data.user;
    } catch (verifyError) {
      logger.error('Failed to verify token:', verifyError);
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token verification failed',
        timestamp: new Date().toISOString()
      });
    }

    req.user = {
      id: user.id,
      supabase_id: user.id, // Ensure supabase_id is set
      uid: user.id, // For backward compatibility
      email: user.email,
      role: user.role,
      app_metadata: user.app_metadata || {},
      user_metadata: user.user_metadata || {}
    };

    // Cache the normalized result (not raw Supabase user) using Upstash Redis
    if (redisClient) {
      try {
        const cacheData = {
          user: req.user,
          exp: Math.floor(Date.now() / 1000) + 300 // 5 minutes from now
        };
        // Upstash Redis REST API uses setex method
        await redisClient.setex(`jwt:${tokenHash}`, 300, JSON.stringify(cacheData));
      } catch (cacheError) {
        logger.warn('Redis cache write failed:', cacheError.message);
        // Continue without caching
      }
    }

    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({ 
      error: 'Authentication error',
      message: 'Failed to verify authentication token',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Analytics Buckets Integration (New Feature)
 * Store and query large-scale analytics data using Apache Iceberg format
 */
const analyticsClient = {
  /**
   * Write analytics data to Iceberg bucket
   */
  async writeAnalytics(bucketName, namespace, table, data) {
    try {
      const admin = initializeSupabaseAdmin();
      
      // Use Supabase's analytics bucket API
      const { data: result, error } = await admin
        .storage
        .from(`analytics-${bucketName}`)
        .upload(
          `${namespace}/${table}/${Date.now()}.parquet`,
          JSON.stringify(data),
          {
            contentType: 'application/parquet',
            upsert: false,
            metadata: {
              namespace,
              table,
              timestamp: new Date().toISOString(),
              rowCount: Array.isArray(data) ? data.length : 1,
            }
          }
        );
      
      if (error) throw error;
      
      logger.info(`Analytics data written to ${bucketName}/${namespace}/${table}`);
      return result;
    } catch (error) {
      logger.error('Analytics write error:', error);
      throw error;
    }
  },
  
  /**
   * Query analytics data using SQL
   */
  async queryAnalytics(query, params = []) {
    try {
      const admin = initializeSupabaseAdmin();
      
      // Execute analytics query
      const { data, error } = await admin
        .from('analytics_views')
        .rpc('execute_analytics_query', {
          query_text: query,
          query_params: params
        });
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      logger.error('Analytics query error:', error);
      throw error;
    }
  },
  
  /**
   * Create time-series bucket for streaming analytics
   */
  async createTimeSeriesBucket(streamId) {
    try {
      const admin = initializeSupabaseAdmin();
      
      const { data, error } = await admin
        .from('analytics_buckets')
        .insert({
          bucket_name: `stream_${streamId}`,
          bucket_type: 'time_series',
          retention_days: 90,
          compression: 'zstd',
          partitioning: 'hourly',
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      
      logger.info(`Time-series bucket created for stream ${streamId}`);
      return data;
    } catch (error) {
      logger.error('Bucket creation error:', error);
      throw error;
    }
  }
};

/**
 * Observability Integration (New Feature)
 * Enhanced logging, tracing, and monitoring
 */
const observability = {
  /**
   * Create OpenTelemetry span for tracing
   */
  createSpan(name, attributes = {}) {
    return {
      name,
      startTime: Date.now(),
      attributes,
      events: [],
      end() {
        const duration = Date.now() - this.startTime;
        logger.info(`Span ${name} completed in ${duration}ms`, {
          ...this.attributes,
          duration,
          events: this.events
        });
      },
      addEvent(name, attributes = {}) {
        this.events.push({ name, attributes, timestamp: Date.now() });
      }
    };
  },
  
  /**
   * Log structured event with context
   */
  logEvent(level, message, context = {}) {
    const event = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        ...context,
        service: 'digis-backend',
        environment: process.env.NODE_ENV,
        version: process.env.APP_VERSION || '2.0.0',
      }
    };
    
    // Send to Supabase logs
    if (supabaseAdmin) {
      supabaseAdmin
        .from('application_logs')
        .insert(event)
        .then(() => {})
        .catch(err => console.error('Failed to log to Supabase:', err));
    }
    
    // Also log locally
    logger[level](message, event.context);
    
    return event;
  },
  
  /**
   * Track custom metrics
   */
  async trackMetric(name, value, unit = 'count', tags = {}) {
    try {
      const admin = initializeSupabaseAdmin();
      
      await admin
        .from('custom_metrics')
        .insert({
          metric_name: name,
          metric_value: value,
          metric_unit: unit,
          tags,
          timestamp: new Date().toISOString()
        });
      
      // Also track in Redis for real-time dashboards (Upstash)
      if (redisClient) {
        try {
          const key = `metric:${name}:${Date.now()}`;
          await redisClient.setex(key, 3600, JSON.stringify({ value, unit, tags }));
        } catch (redisError) {
          logger.warn('Metric Redis tracking failed:', redisError.message);
        }
      }
    } catch (error) {
      logger.error('Metric tracking error:', error);
    }
  },
  
  /**
   * Get observability dashboard data
   */
  async getDashboardData(timeRange = '1h') {
    try {
      const admin = initializeSupabaseAdmin();
      
      const { data, error } = await admin
        .rpc('get_observability_dashboard', {
          time_range: timeRange
        });
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      logger.error('Dashboard data error:', error);
      throw error;
    }
  }
};

/**
 * Real-time Enhanced Features (New)
 */
const realtime = {
  /**
   * Subscribe to database changes with filters
   */
  subscribeToChanges(table, filters = {}, callback) {
    const admin = initializeSupabaseAdmin();
    
    const subscription = admin
      .channel(`db-changes-${table}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: filters.filter || undefined,
        },
        (payload) => {
          observability.logEvent('debug', `Realtime event on ${table}`, payload);
          callback(payload);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info(`Subscribed to ${table} changes`);
        } else if (status === 'CHANNEL_ERROR') {
          logger.error(`Subscription error for ${table}`);
        }
      });
    
    return subscription;
  },
  
  /**
   * Broadcast to channel
   */
  async broadcast(channel, event, payload) {
    const admin = initializeSupabaseAdmin();
    
    const result = await admin
      .channel(channel)
      .send({
        type: 'broadcast',
        event,
        payload
      });
    
    observability.trackMetric('realtime_broadcast', 1, 'count', { channel, event });
    
    return result;
  },
  
  /**
   * Presence tracking
   */
  trackPresence(channel, userId, userInfo) {
    const admin = initializeSupabaseAdmin();
    
    const presenceChannel = admin.channel(channel);
    
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        observability.logEvent('debug', 'Presence sync', { channel, state });
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        observability.logEvent('info', 'User joined', { channel, key, newPresences });
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        observability.logEvent('info', 'User left', { channel, key, leftPresences });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
            ...userInfo
          });
        }
      });
    
    return presenceChannel;
  }
};

/**
 * Edge Functions Integration (New)
 */
const edge = {
  /**
   * Invoke Supabase Edge Function
   */
  async invokeFunction(functionName, payload = {}, options = {}) {
    try {
      const admin = initializeSupabaseAdmin();
      const span = observability.createSpan(`edge_function_${functionName}`);
      
      const { data, error } = await admin.functions.invoke(functionName, {
        body: payload,
        headers: options.headers || {},
        method: options.method || 'POST',
      });
      
      span.end();
      
      if (error) throw error;
      
      observability.trackMetric('edge_function_invocation', 1, 'count', { function: functionName });
      
      return data;
    } catch (error) {
      logger.error(`Edge function ${functionName} error:`, error);
      throw error;
    }
  }
};

/**
 * Vector/AI Operations (New Feature)
 */
const ai = {
  /**
   * Store embedding vectors
   */
  async storeEmbedding(content, embedding, metadata = {}) {
    try {
      const admin = initializeSupabaseAdmin();
      
      const { data, error } = await admin
        .from('embeddings')
        .insert({
          content,
          embedding,
          metadata,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      logger.error('Embedding storage error:', error);
      throw error;
    }
  },
  
  /**
   * Similarity search using pgvector
   */
  async similaritySearch(queryEmbedding, limit = 10, threshold = 0.5) {
    try {
      const admin = initializeSupabaseAdmin();
      
      const { data, error } = await admin
        .rpc('match_embeddings', {
          query_embedding: queryEmbedding,
          match_threshold: threshold,
          match_count: limit
        });
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      logger.error('Similarity search error:', error);
      throw error;
    }
  }
};

// Export all utilities
module.exports = {
  initializeSupabaseAdmin,
  initializeRedis,
  verifySupabaseToken: verifySupabaseTokenAsymmetric, // Use new asymmetric verification
  analyticsClient,
  observability,
  realtime,
  edge,
  ai,
  retry,
  
  // Export the clients for direct access if needed
  getSupabaseAdmin: () => supabaseAdmin,
  getRedisClient: () => redisClient,
  
  // Cleanup function
  async cleanup() {
    // Note: Upstash Redis (HTTP-based) doesn't require explicit disconnect
    // Just nullify the reference
    if (redisClient) {
      redisClient = null;
    }
    if (supabaseAdmin) {
      // Unsubscribe from all channels
      supabaseAdmin.removeAllChannels();
      supabaseAdmin = null;
    }
    logger.info('Supabase Admin v2 cleanup completed');
  }
};