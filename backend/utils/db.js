const { Pool } = require('pg');

// Load environment variables if not already loaded
if (!process.env.DATABASE_URL && !process.env.DB_USER) {
  require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
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

console.log('🔗 Database connection config:', {
  user: connectionConfig.user,
  host: connectionConfig.host,
  port: connectionConfig.port,
  database: connectionConfig.database,
  ssl: !!connectionConfig.ssl,
  passwordLength: connectionConfig.password ? connectionConfig.password.length : 0
});

// Create a new pool instance
const pool = new Pool({
  ...connectionConfig,
  max: 20, // Maximum number of connections
  idleTimeoutMillis: 30000, // How long to wait before timing out when connecting
  connectionTimeoutMillis: 10000, // How long to wait for a connection
  keepAlive: true,
  keepAliveInitialDelayMillis: 0,
  statement_timeout: 30000, // 30 seconds
  query_timeout: 30000, // 30 seconds
  application_name: 'digis-backend'
});

// Connection event handlers
pool.on('connect', (client) => {
  console.log('✅ Connected to Supabase PostgreSQL database');
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
      host: connectionConfig.host,
      port: connectionConfig.port,
      database: connectionConfig.database,
      user: connectionConfig.user,
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

// Helper function to execute queries with error handling
const query = async (text, params) => {
  const start = Date.now();
  let client;
  
  try {
    client = await pool.connect();
    const result = await client.query(text, params);
    const duration = Date.now() - start;
    
    console.log('📝 Query executed:', {
      text: text.substring(0, 80) + (text.length > 80 ? '...' : ''),
      duration: duration + 'ms',
      rows: result.rowCount
    });
    
    return result;
  } catch (error) {
    console.error('❌ Query error:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      query: text.substring(0, 80) + (text.length > 80 ? '...' : '')
    });
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
};

// Helper function to get a client from the pool
const getClient = async () => {
  try {
    const client = await pool.connect();
    return client;
  } catch (error) {
    console.error('❌ Error getting client from pool:', error);
    throw error;
  }
};

// Helper function to create a user (works with your existing table structure)
const createUser = async (supabase_id, is_creator = false, bio = '', profile_pic_url = '', price_per_min = 1.00) => {
  const text = `
    INSERT INTO users (supabase_id, is_creator, bio, profile_pic_url, price_per_min)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const values = [supabase_id, is_creator, bio, profile_pic_url, price_per_min];
  return await query(text, values);
};

// Helper function to get user by supabase_id
const getUserByFirebaseUid = async (supabase_id) => {
  const text = 'SELECT * FROM users WHERE supabase_id = $1';
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

// Helper function to update user profile
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
    WHERE supabase_id = $${paramIndex}
    RETURNING *
  `;
  
  return await query(text, values);
};

// Helper function to create a session
const createSession = async (creator_id, member_id, type = 'video') => {
  const text = `
    INSERT INTO sessions (creator_id, member_id, start_time, type)
    VALUES ($1, $2, NOW(), $3)
    RETURNING *
  `;
  const values = [creator_id, member_id, type];
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
    LEFT JOIN users member ON s.member_id = member.id
    WHERE s.creator_id = $1 OR s.member_id = $1
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
    LEFT JOIN users member ON s.member_id = member.id
    WHERE s.member_id = $1 OR s.creator_id = $1
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
      COUNT(DISTINCT s.member_id) as unique_customers,
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
    SELECT id, supabase_id, bio, profile_pic_url, price_per_min
    FROM users 
    WHERE is_creator = TRUE 
    AND (LOWER(bio) LIKE $1 OR LOWER(supabase_id) LIKE $1)
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
    LEFT JOIN users member ON s.member_id = member.id
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
    LEFT JOIN users member ON s.member_id = member.id
    WHERE (s.creator_id = $1 OR s.member_id = $1) AND s.end_time IS NULL
    ORDER BY s.start_time DESC
  `;
  return await query(text, [user_id]);
};

// Transaction helper
const transaction = async (callback) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Health check function
const healthCheck = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT 1 as health');
    client.release();
    return result.rows[0].health === 1;
  } catch (error) {
    console.error('❌ Health check failed:', error);
    return false;
  }
};

// Get pool statistics
const getPoolStats = () => {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  };
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

// Export the pool and helper functions
module.exports = {
  pool,
  query,
  getClient,
  testConnection,
  createUser,
  getUserByFirebaseUid,
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
  addMissingColumns
};