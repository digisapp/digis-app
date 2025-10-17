const { Pool } = require('pg');

// Load environment variables if not already loaded
if (!process.env.DATABASE_URL && !process.env.DB_USER) {
  require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
}

// Sanitize DATABASE_URL to remove literal \n, quotes, whitespace and ensure SSL
function cleanDbUrl(raw) {
  if (!raw) return raw;
  let val = String(raw)
    .replace(/^"+|"+$/g, '')      // remove wrapping quotes if any
    .replace(/\\n/g, '')          // remove literal backslash-n characters
    .trim();

  // Ensure sslmode=require
  try {
    const u = new URL(val);
    if (!u.searchParams.get('sslmode')) {
      u.searchParams.set('sslmode', 'require');
    }

    // Guard against pooler/port mismatches
    const isPoolerHost = u.hostname.includes('pooler.supabase.com');
    if (isPoolerHost && u.port === '5432') {
      console.warn('[DB] Pooler host on 5432 detected. Consider switching host to db.<ref>.supabase.co');
    }
    if (!isPoolerHost && (!u.port || u.port === '6543')) {
      u.port = '5432';
    }

    val = u.toString();
  } catch (e) {
    console.error('[DB] Invalid DATABASE_URL format after cleaning:', e?.message);
  }
  return val;
}

// Retry helper function for handling transient errors
const retry = async (fn, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      // Only retry on transient errors
      const retriableErrors = ['ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH'];
      const isRetriable = retriableErrors.includes(error.code) ||
                         error.message.includes('timeout') ||
                         error.message.includes('Connection terminated');

      if (!isRetriable) throw error;

      console.warn(`⚠️ Retry ${i + 1}/${maxRetries} after error: ${error.code || error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i))); // Exponential backoff
    }
  }
};

// Clean DATABASE_URL BEFORE any other processing
if (process.env.DATABASE_URL) {
  const RAW_DATABASE_URL = process.env.DATABASE_URL;
  const CLEAN_DATABASE_URL = cleanDbUrl(RAW_DATABASE_URL);
  process.env.DATABASE_URL = CLEAN_DATABASE_URL;

  // Optional: log safe diagnostics
  try {
    const u = new URL(CLEAN_DATABASE_URL);
    const safe = CLEAN_DATABASE_URL.replace(/\/\/([^:]+):[^@]+@/, '//$1:***@');
    console.log('[DB] Using', safe);
    console.log('[DB] host:', u.hostname, 'port:', u.port, 'sslmode:', u.searchParams.get('sslmode'));
  } catch (e) {
    console.error('[DB] Could not parse cleaned URL for logging:', e?.message);
  }
}

// Debug: Log environment variables
console.log('🔍 Environment check:', {
  DATABASE_URL: !!process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV
});

// Parse the database URL or use individual components
const parseConnectionString = (connectionString) => {
  try {
    if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
      const url = new URL(connectionString);
      
      const config = {
        user: url.username,
        password: url.password,
        host: url.hostname,
        port: parseInt(url.port) || 5432,
        database: url.pathname.slice(1), // Remove leading slash
        ssl: { rejectUnauthorized: false } // Required for Supabase
      };
      
      return config;
    }
    
    throw new Error('Invalid connection string format');
  } catch (error) {
    console.error('❌ Error parsing connection string:', error.message);
    throw new Error('Invalid DATABASE_URL format');
  }
};

// Create connection configuration
let connectionConfig;

if (process.env.DATABASE_URL) {
  console.log('🔄 Using DATABASE_URL for connection');
  connectionConfig = parseConnectionString(process.env.DATABASE_URL);
} else {
  console.log('🔄 Using individual DB environment variables');
  
  // Validate that all required environment variables are present
  const requiredEnvVars = ['DB_USER', 'DB_PASSWORD', 'DB_HOST'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
  
  connectionConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'postgres',
    ssl: { rejectUnauthorized: false } // Required for Supabase
  };
}

// Ensure all values are the correct type
if (connectionConfig.password && typeof connectionConfig.password !== 'string') {
  connectionConfig.password = String(connectionConfig.password);
}

if (connectionConfig.port && typeof connectionConfig.port !== 'number') {
  connectionConfig.port = parseInt(connectionConfig.port);
}

if (connectionConfig.user && typeof connectionConfig.user !== 'string') {
  connectionConfig.user = String(connectionConfig.user);
}

if (connectionConfig.host && typeof connectionConfig.host !== 'string') {
  connectionConfig.host = String(connectionConfig.host);
}

if (connectionConfig.database && typeof connectionConfig.database !== 'string') {
  connectionConfig.database = String(connectionConfig.database);
}

// Detect connection mode (pooler vs direct)
const host = connectionConfig.host;
const port = connectionConfig.port || 5432;
const isPoolerHost = /pooler\.supabase\.com$/i.test(host);
const mode =
  isPoolerHost && port === 6543 ? 'pooler:transaction' :
  isPoolerHost && port === 5432 ? 'pooler:session' :
  'direct';

console.log('[DB] host=%s port=%s mode=%s', host, port, mode);

// Warn if using pooler when direct is recommended
if (isPoolerHost) {
  console.warn('⚠️ WARNING: Using pooler host instead of direct connection.');
  console.warn('⚠️ For serverless (Vercel), use: db.<project-ref>.supabase.co:5432');
  console.warn('⚠️ This may cause "max client connections" errors under load.');
}

// Mask sensitive data for security
console.log('🔗 Database connection config:', {
  user: connectionConfig.user ? `${connectionConfig.user.substring(0, 3)}***` : 'MISSING',
  host: connectionConfig.host ? connectionConfig.host.replace(/\.(.+)$/, '.***') : 'MISSING',
  port: connectionConfig.port,
  database: connectionConfig.database,
  ssl: !!connectionConfig.ssl,
  passwordLength: connectionConfig.password ? connectionConfig.password.length : 0,
  connectionMode: mode
});

// Create a new pool instance with optimized settings
// Serverless-optimized configuration (Vercel/AWS Lambda)
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

// CRITICAL FIX: Optimized for Supabase connection modes
// - Direct Connection (db.<ref>.supabase.co:5432): Up to 60 concurrent connections, best for serverless
// - Session Pooler (pooler.supabase.com:5432): PgBouncer session mode, limited connections
// - Transaction Pooler (pooler.supabase.com:6543): Max 15 connections, fastest per-query
const isUsingTransactionPooler = isPoolerHost && port === 6543;
const isUsingSessionPooler = isPoolerHost && port === 5432;
const isDirectConnection = !isPoolerHost;

const poolConfig = {
  ...connectionConfig,
  // Connection pool sizing based on connection mode - ULTRA CONSERVATIVE for pooler
  max: isUsingTransactionPooler
    ? 1          // Transaction pooler: very limited
    : isUsingSessionPooler
    ? 1          // Session pooler: ONLY 1 connection per serverless function
    : (isServerless ? 2 : 5),         // Direct: optimal for serverless (2-3)
  min: 0, // Start with no connections
  idleTimeoutMillis: isServerless ? 500 : 3000, // Very aggressive cleanup for serverless
  connectionTimeoutMillis: 30000, // 30s timeout for pooler (was 10s)
  keepAlive: false,     // Disable keepalive for pooler
  keepAliveInitialDelayMillis: 0,
  maxUses: 100, // Recycle connections more frequently (was 1000)
  statement_timeout: 45000, // 45 seconds (increased for pooler)
  query_timeout: 45000, // 45 seconds (increased for pooler)
  application_name: 'digis-backend',
  allowExitOnIdle: true, // ALWAYS allow cleanup when idle
};

const pool = new Pool(poolConfig);

console.log(`📊 Database pool configured for ${isServerless ? 'SERVERLESS' : 'TRADITIONAL'} environment:`, {
  max: poolConfig.max,
  idleTimeout: poolConfig.idleTimeoutMillis,
  allowExitOnIdle: poolConfig.allowExitOnIdle,
  connectionMode: mode,
  keepAlive: poolConfig.keepAlive
});

// Monitor pool health in production
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    const stats = {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount
    };
    console.log('📊 Pool stats:', stats);
    
    // Warn if pool is under stress
    if (stats.waiting > stats.total * 0.5) {
      console.warn('⚠️ High pool contention detected:', stats);
    }
  }, 60000); // Check every minute
}

// Connection event handlers - Set per-connection timeouts for PgBouncer compatibility
pool.on('connect', (client) => {
  console.log('✅ Connected to Supabase PostgreSQL database');

  // Set per-connection timeouts (works better behind PgBouncer/pooler)
  client.query("SET statement_timeout = '45s'; SET lock_timeout = '8s';").catch(err => {
    console.warn('⚠️ Failed to set connection timeouts:', err.message);
  });
});

pool.on('error', (err, client) => {
  console.error('❌ Database pool error:', err);
  // Don't exit the process, just log the error
});

pool.on('acquire', () => {
  console.log('🔄 Database client acquired from pool');
});

pool.on('release', () => {
  console.log('🔄 Database client released back to pool');
});

// Test the connection on startup
const testConnection = async () => {
  let client;
  try {
    console.log('🔄 Testing Supabase database connection...');
    console.log('🔄 Attempting to connect to:', {
      host: connectionConfig.host ? connectionConfig.host.replace(/\.(.+)$/, '.***') : 'MISSING',
      port: connectionConfig.port,
      database: connectionConfig.database,
      user: connectionConfig.user ? `${connectionConfig.user.substring(0, 3)}***` : 'MISSING',
      ssl: !!connectionConfig.ssl
    });
    
    client = await pool.connect();
    
    const result = await client.query('SELECT NOW() as current_time, current_database() as database_name, version() as version');
    console.log('✅ Database connection test successful:', {
      time: result.rows[0].current_time,
      database: result.rows[0].database_name,
      version: result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1]
    });
    
    // Check existing tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📊 Available tables:', tablesResult.rows.map(row => row.table_name));
    
    // Check users table structure
    const usersCheck = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    if (usersCheck.rows.length > 0) {
      console.log('👥 Users table columns:', usersCheck.rows.map(row => `${row.column_name} (${row.data_type})`));
    }
    
    // Check sessions table structure
    const sessionsCheck = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'sessions' 
      ORDER BY ordinal_position
    `);
    
    if (sessionsCheck.rows.length > 0) {
      console.log('🎥 Sessions table columns:', sessionsCheck.rows.map(row => `${row.column_name} (${row.data_type})`));
    }
    
    // Check payments table structure
    const paymentsCheck = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'payments' 
      ORDER BY ordinal_position
    `);
    
    if (paymentsCheck.rows.length > 0) {
      console.log('💳 Payments table columns:', paymentsCheck.rows.map(row => `${row.column_name} (${row.data_type})`));
    }
    
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
    
    // Provide helpful error messages
    if (error.code === '28P01') {
      console.error('🔑 Authentication failed. Please check your database credentials.');
    } else if (error.code === 'ENOTFOUND') {
      console.error('🌐 Host not found. Please check your database host.');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('🚫 Connection refused. Please check your database host and port.');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('⏱️ Connection timeout. Please check your network connection.');
    } else if (error.message.includes('password must be a string')) {
      console.error('🔐 Password format error. Please check your database password.');
    }
    
    return false;
  } finally {
    if (client) {
      client.release();
    }
  }
};

// Enhanced query execution with retries and monitoring (merged from db-enhanced.js)
const executeQuery = async (text, params = [], options = {}) => {
  const { maxRetries = 3, retryDelay = 1000, timeout } = options;
  const start = Date.now();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let client;
    try {
      client = await pool.connect();

      // Set statement timeout if specified
      if (timeout) {
        await client.query(`SET statement_timeout = ${timeout}`);
      }

      const result = await client.query(text, params);
      const duration = Date.now() - start;

      // Warn on slow queries (from db-optimized.js)
      if (duration > 1000) {
        console.warn(`⚠️ Slow query (${duration}ms):`, text.slice(0, 120));
      }

      // Only log in development or for slow queries
      if (process.env.NODE_ENV !== 'production' || duration > 1000) {
        console.log('📝 Query executed:', {
          text: text.substring(0, 80) + (text.length > 80 ? '...' : ''),
          duration: duration + 'ms',
          rows: result.rowCount
        });
      }

      return result;
    } catch (error) {
      // Don't retry on specific errors
      if (attempt === maxRetries || error.code === '23505') {
        const errorInfo = {
          message: error.message,
          code: error.code,
          duration: Date.now() - start + 'ms'
        };

        // Enhanced error handling with specific messages
        if (error.code === '28P01') {
          console.error('🔐 Authentication failed:', errorInfo);
          throw new Error('Database authentication failed. Please check credentials.');
        } else if (error.code === 'ECONNREFUSED') {
          console.error('🚫 Connection refused:', errorInfo);
          throw new Error('Database connection refused. Service may be down.');
        } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
          console.error('⏱️ Query timeout:', errorInfo);
          throw new Error('Database query timed out. Please try again.');
        } else if (error.code === '23505') {
          console.error('🔑 Unique constraint violation:', errorInfo);
          throw new Error('Duplicate key error. This record already exists.');
        } else if (error.code === '23503') {
          console.error('🔗 Foreign key violation:', errorInfo);
          throw new Error('Referenced record does not exist.');
        } else {
          console.error('❌ Query error:', {
            ...errorInfo,
            detail: error.detail,
            query: text.substring(0, 80) + (text.length > 80 ? '...' : '')
          });
          throw error;
        }
      }

      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
    } finally {
      if (client) {
        client.release();
      }
    }
  }
};

// Legacy query function for backward compatibility
const query = executeQuery;

// Helper function to get a client from the pool with retries
const getClient = async () => {
  try {
    const client = await retry(() => pool.connect(), 3, 1000);
    return client;
  } catch (error) {
    console.error('❌ Error getting client from pool:', {
      message: error.message,
      code: error.code,
      poolStats: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      }
    });
    throw error;
  }
};

// Helper function to create a user (works with Supabase UUID)
const createUser = async (supabase_id, is_creator = false, bio = '', profile_pic_url = '', price_per_min = 1.00) => {
  const text = `
    INSERT INTO users (supabase_id, is_creator, bio, profile_pic_url, price_per_min)
    VALUES ($1::uuid, $2, $3, $4, $5)
    RETURNING *
  `;
  const values = [supabase_id, is_creator, bio, profile_pic_url, price_per_min];
  return await query(text, values);
};

// Helper function to get user by supabase_id (UUID)
const getUserBySupabaseId = async (supabase_id) => {
  const text = 'SELECT * FROM users WHERE supabase_id = $1::uuid';
  const values = [supabase_id];
  const result = await query(text, values);
  return result.rows[0] || null;
};

// Helper function to get all creators
const getCreators = async () => {
  const text = 'SELECT * FROM users WHERE is_creator = TRUE ORDER BY id DESC';
  const result = await query(text);
  return result.rows;
};

// Helper function to update user profile (works with Supabase UUID)
const updateUserProfile = async (supabase_id, updates) => {
  const allowedFields = ['is_creator', 'bio', 'profile_pic_url', 'price_per_min'];
  const setFields = [];
  const values = [];
  let paramIndex = 1;

  // Build dynamic SET clause
  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key) && value !== undefined) {
      setFields.push(`${key} = $${paramIndex++}`);
      values.push(value);
    }
  }

  if (setFields.length === 0) {
    throw new Error('No valid fields to update');
  }

  values.push(supabase_id); // Add supabase_id as last parameter
  
  const text = `
    UPDATE users 
    SET ${setFields.join(', ')}
    WHERE supabase_id = $${paramIndex}::uuid
    RETURNING *
  `;
  
  return await query(text, values);
};

// Helper function to create a session
const createSession = async (creator_id, fan_id, type = 'video') => {
  const text = `
    INSERT INTO sessions (creator_id, fan_id, start_time, type)
    VALUES ($1, $2, NOW(), $3)
    RETURNING *
  `;
  const values = [creator_id, fan_id, type];
  return await query(text, values);
};

// Helper function to end a session
const endSession = async (session_id) => {
  const text = `
    UPDATE sessions 
    SET end_time = NOW() 
    WHERE id = $1 
    RETURNING *
  `;
  const values = [session_id];
  return await query(text, values);
};

// Helper function to get user sessions
const getUserSessions = async (user_id, limit = 50, offset = 0) => {
  const text = `
    SELECT s.*, 
           creator.supabase_id as creator_supabase_id, creator.bio as creator_bio,
           member.supabase_id as member_supabase_id
    FROM sessions s
    LEFT JOIN users creator ON s.creator_id = creator.id
    LEFT JOIN users member ON s.fan_id = member.id
    WHERE s.creator_id = $1 OR s.fan_id = $1
    ORDER BY s.start_time DESC
    LIMIT $2 OFFSET $3
  `;
  return await query(text, [user_id, limit, offset]);
};

// Helper function to create a payment record
const createPayment = async (session_id, amount, tip = 0) => {
  const text = `
    INSERT INTO payments (session_id, amount, tip)
    VALUES ($1, $2, $3)
    RETURNING *
  `;
  const values = [session_id, amount, tip];
  return await query(text, values);
};

// Helper function to get payment history
const getPaymentHistory = async (user_id, limit = 50, offset = 0) => {
  const text = `
    SELECT p.*, s.type as session_type, s.start_time, s.end_time,
           creator.supabase_id as creator_supabase_id, member.supabase_id as member_supabase_id
    FROM payments p
    LEFT JOIN sessions s ON p.session_id = s.id
    LEFT JOIN users creator ON s.creator_id = creator.id
    LEFT JOIN users member ON s.fan_id = member.id
    WHERE s.fan_id = $1 OR s.creator_id = $1
    ORDER BY p.id DESC
    LIMIT $2 OFFSET $3
  `;
  return await query(text, [user_id, limit, offset]);
};

// Helper function to get creator earnings
const getCreatorEarnings = async (creator_id) => {
  const text = `
    SELECT 
      SUM(p.amount) as total_earnings,
      COUNT(p.id) as total_payments,
      COUNT(DISTINCT s.fan_id) as unique_customers,
      AVG(p.amount) as average_payment
    FROM payments p
    LEFT JOIN sessions s ON p.session_id = s.id
    WHERE s.creator_id = $1
  `;
  return await query(text, [creator_id]);
};

// Helper function to search creators
const searchCreators = async (searchTerm, limit = 20, offset = 0) => {
  const text = `
    SELECT id, supabase_id, username, display_name, bio, profile_pic_url, price_per_min
    FROM users 
    WHERE is_creator = TRUE 
    AND (LOWER(bio) LIKE $1 OR LOWER(username) LIKE $1 OR LOWER(display_name) LIKE $1)
    ORDER BY id DESC
    LIMIT $2 OFFSET $3
  `;
  const searchPattern = `%${searchTerm.toLowerCase()}%`;
  return await query(text, [searchPattern, limit, offset]);
};

// Helper function to get session by ID
const getSessionById = async (session_id) => {
  const text = `
    SELECT s.*, 
           creator.supabase_id as creator_supabase_id, creator.bio as creator_bio,
           member.supabase_id as member_supabase_id
    FROM sessions s
    LEFT JOIN users creator ON s.creator_id = creator.id
    LEFT JOIN users member ON s.fan_id = member.id
    WHERE s.id = $1
  `;
  const result = await query(text, [session_id]);
  return result.rows[0] || null;
};

// Helper function to get active sessions for a user
const getActiveSessions = async (user_id) => {
  const text = `
    SELECT s.*, 
           creator.supabase_id as creator_supabase_id, creator.bio as creator_bio,
           member.supabase_id as member_supabase_id
    FROM sessions s
    LEFT JOIN users creator ON s.creator_id = creator.id
    LEFT JOIN users member ON s.fan_id = member.id
    WHERE (s.creator_id = $1 OR s.fan_id = $1) AND s.end_time IS NULL
    ORDER BY s.start_time DESC
  `;
  return await query(text, [user_id]);
};

// Enhanced transaction helper with better error handling (merged from db-enhanced.js)
const withTransaction = async (fn) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transaction rolled back:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

// Legacy transaction function for backward compatibility
const transaction = withTransaction;

// Health check function with timeout
const healthCheck = async () => {
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Health check timeout')), 5000)
  );
  
  try {
    const checkPromise = (async () => {
      const client = await retry(() => pool.connect(), 2, 500);
      try {
        const result = await client.query('SELECT 1 as health');
        return result.rows[0].health === 1;
      } finally {
        client.release();
      }
    })();
    
    return await Promise.race([checkPromise, timeoutPromise]);
  } catch (error) {
    console.error('❌ Health check failed:', {
      message: error.message,
      poolStats: getPoolStats()
    });
    return false;
  }
};

// Get pool statistics with health status
const getPoolStats = () => {
  const stats = {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    max: pool._options?.max || 20
  };
  
  // Add health indicators
  stats.utilizationPercent = Math.round((stats.totalCount - stats.idleCount) / stats.max * 100);
  stats.isHealthy = stats.waitingCount < stats.max * 0.5;
  
  return stats;
};

// Add missing columns to existing tables (if needed)
const addMissingColumns = async () => {
  const client = await getClient();
  try {
    console.log('🔄 Checking for missing columns...');
    
    // Add missing columns to users table
    try {
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS total_sessions INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(10,2) DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS total_spent DECIMAL(10,2) DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
      `);
      console.log('✅ Users table columns updated');
    } catch (error) {
      console.log('ℹ️ Users table columns already exist or error:', error.message);
    }
    
    // Add missing columns to sessions table
    try {
      await client.query(`
        ALTER TABLE sessions 
        ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
      `);
      console.log('✅ Sessions table columns updated');
    } catch (error) {
      console.log('ℹ️ Sessions table columns already exist or error:', error.message);
    }
    
    // Add missing columns to payments table
    try {
      await client.query(`
        ALTER TABLE payments 
        ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
      `);
      console.log('✅ Payments table columns updated');
    } catch (error) {
      console.log('ℹ️ Payments table columns already exist or error:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error adding missing columns:', error);
  } finally {
    client.release();
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🔄 Shutting down gracefully...');
  await pool.end();
  console.log('✅ Database pool closed');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🔄 Shutting down gracefully...');
  await pool.end();
  console.log('✅ Database pool closed');
  process.exit(0);
});

// Run connection test and add missing columns on startup
// Run in background to not block startup
setTimeout(async () => {
  try {
    const connected = await testConnection();
    if (connected) {
      await addMissingColumns();
    }
  } catch (error) {
    console.error('Background DB test failed:', error.message);
  }
}, 1000);

// Atomic token operation helper to prevent race conditions
const atomicTokenUpdate = async (userId, tokenAmount, operation = 'add') => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Use SELECT FOR UPDATE to lock the row during transaction
    const balanceCheck = await client.query(
      `SELECT balance FROM token_balances WHERE user_id = $1 FOR UPDATE`,
      [userId]
    );

    const currentBalance = balanceCheck.rows.length > 0 ? balanceCheck.rows[0].balance : 0;

    if (operation === 'subtract' && currentBalance < tokenAmount) {
      await client.query('ROLLBACK');
      throw new Error('Insufficient token balance');
    }

    const newBalance = operation === 'add'
      ? currentBalance + tokenAmount
      : currentBalance - tokenAmount;

    // Update with atomic operation using ON CONFLICT
    const result = await client.query(
      `INSERT INTO token_balances (user_id, balance, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET balance = $2, updated_at = NOW()
       RETURNING balance`,
      [userId, newBalance]
    );

    await client.query('COMMIT');
    return result.rows[0].balance;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Singleton pool getter function
const getPool = () => pool;

// Export the pool and helper functions
module.exports = {
  pool,
  getPool, // Singleton getter for pool
  query,
  executeQuery, // Enhanced query function
  withTransaction, // Enhanced transaction function
  getClient,
  testConnection,
  createUser,
  getUserBySupabaseId, // New export for UUID lookups
  getCreators,
  updateUserProfile,
  createSession,
  endSession,
  getUserSessions,
  createPayment,
  getPaymentHistory,
  getCreatorEarnings,
  searchCreators,
  getSessionById,
  getActiveSessions,
  transaction,
  healthCheck,
  getPoolStats,
  addMissingColumns,
  atomicTokenUpdate // New atomic token operation helper
};