const { createClient } = require('@supabase/supabase-js');
const redis = require('redis');

let supabaseAdmin = null;
let redisClient = null;

// Retry utility for network resilience
const retry = async (fn, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.warn(`Retry ${i + 1}/${maxRetries}: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
};

// Initialize Redis client for caching
const initializeRedis = async () => {
  if (redisClient) return redisClient;
  
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (times) => Math.min(times * 50, 2000)
      }
    });
    
    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });
    
    await redisClient.connect();
    console.log('✅ Redis client connected for user caching');
    return redisClient;
  } catch (error) {
    console.warn('⚠️ Redis connection failed, continuing without cache:', error.message);
    return null;
  }
};

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

    // Initialize Supabase Admin Client with service role key
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
        }
      }
    );

    console.log('✅ Supabase Admin initialized successfully');
    return supabaseAdmin;
  } catch (error) {
    console.error('❌ Supabase initialization error:', {
      message: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

// Middleware to verify Supabase JWT token
const verifySupabaseToken = async (req, res, next) => {
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
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Empty token provided',
        timestamp: new Date().toISOString()
      });
    }

    // Initialize Supabase if not already done
    const supabase = initializeSupabaseAdmin();

    // Check Redis cache first
    const redis = await initializeRedis();
    if (redis) {
      try {
        const cachedUser = await redis.get(`user:${token}`);
        if (cachedUser) {
          req.user = JSON.parse(cachedUser);
          return next();
        }
      } catch (cacheError) {
        console.warn('Redis cache error:', cacheError.message);
      }
    }

    // Verify the JWT token with retry logic
    const { data: { user }, error } = await retry(() => supabase.auth.getUser(token));

    if (error || !user) {
      console.error('❌ Token verification failed:', {
        message: error?.message || 'No user found',
        timestamp: new Date().toISOString()
      });

      let statusCode = 401;
      let errorMessage = 'Invalid token';
      
      if (error?.message?.includes('expired')) {
        errorMessage = 'Token expired. Please sign in again.';
      } else if (error?.message?.includes('revoked')) {
        errorMessage = 'Token revoked. Please sign in again.';
      } else if (error?.message?.includes('malformed')) {
        errorMessage = 'Invalid token format';
      }

      return res.status(statusCode).json({
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
    }

    // Get additional user info from our database
    const { pool } = require('./db');
    const userQuery = `
      SELECT 
        id,
        supabase_id,
        username,
        is_creator,
        COALESCE(is_super_admin, false) as is_super_admin,
        profile_pic_url,
        COALESCE(created_at, NOW())::timestamp as created_at
      FROM users
      WHERE supabase_id = $1::uuid
      LIMIT 1
    `;

    let userResult, dbUser;
    try {
      userResult = await retry(() => pool.query(userQuery, [user.id]));
      dbUser = userResult.rows[0];
    } catch (dbError) {
      console.error('❌ DB error in user query:', dbError.message);
      return res.status(500).json({ 
        error: 'Database error during authentication',
        timestamp: new Date().toISOString()
      });
    }

    if (!dbUser) {
      // User exists in Supabase but not in our database - create them
      const createUserQuery = `
        INSERT INTO users (
          supabase_id,
          username,
          created_at,
          updated_at
        ) VALUES (
          $1::uuid, $2, $3, $4
        ) RETURNING *
      `;

      // Generate unique username
      let username = user.user_metadata?.username || user.email.split('@')[0];
      
      try {
        // Check if username already exists
        const existingUser = await retry(() => 
          pool.query('SELECT id FROM users WHERE username = $1', [username])
        );
        
        if (existingUser.rows.length > 0) {
          // Append random number to make it unique
          username = `${username}_${Math.floor(Math.random() * 10000)}`;
        }
      } catch (error) {
        console.error('Error checking username uniqueness:', error);
      }

      const createResult = await retry(() => pool.query(createUserQuery, [
        user.id,  // Store Supabase UUID in id column
        username,
        new Date(),
        new Date()
      ]));

      const newUser = createResult.rows[0];

      // Also create token balance with retry
      await retry(() => pool.query(`
        INSERT INTO token_balances (user_id, supabase_user_id, balance)
        VALUES ($1, $2, 0.00)
        ON CONFLICT (user_id) DO NOTHING
      `, [newUser.id, user.id]));

      req.user = {
        id: newUser.id,
        uid: user.id, // Supabase ID
        supabase_id: user.id,
        email: user.email,
        emailVerified: user.email_confirmed_at !== null,
        username: newUser.username,
        displayName: newUser.username, // Use username as display name
        isCreator: false,
        isSuperAdmin: false,
        profilePicUrl: newUser.profile_pic_url,
        authTime: user.last_sign_in_at,
        supabase: user
      };
    } else {
      // Add user info to request object
      req.user = {
        id: dbUser.id,
        uid: user.id, // Use Supabase ID as uid
        supabase_id: user.id,
        email: user.email,
        emailVerified: user.email_confirmed_at !== null,
        username: dbUser.username,
        displayName: dbUser.username, // Use username as display name
        isCreator: dbUser.is_creator,
        isSuperAdmin: dbUser.is_super_admin,
        profilePicUrl: dbUser.profile_pic_url,
        authTime: user.last_sign_in_at,
        supabase: user
      };
    }
    
    // Cache the user data in Redis (if available)
    if (redis && req.user) {
      try {
        await redis.setEx(
          `user:${token}`,
          300, // Cache for 5 minutes
          JSON.stringify(req.user)
        );
      } catch (cacheError) {
        console.warn('Failed to cache user data:', cacheError.message);
      }
    }
    
    next();
  } catch (error) {
    console.error('❌ Unexpected error in token verification:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      error: 'Authentication service error',
      timestamp: new Date().toISOString()
    });
  }
};

// Function to verify if a user has a specific role
const hasRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        timestamp: new Date().toISOString()
      });
    }

    const userRole = req.user.supabase?.role || req.user.supabase?.app_metadata?.role || 'authenticated';
    
    if (userRole !== role && role !== 'authenticated') {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required_role: role,
        current_role: userRole,
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
};

// Helper function to get Supabase client for user operations
const getSupabaseClient = (accessToken) => {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    }
  );
};

// Clear user cache (useful for logout or user updates)
const clearUserCache = async (token) => {
  const redis = await initializeRedis();
  if (redis) {
    try {
      await redis.del(`user:${token}`);
    } catch (error) {
      console.error('Failed to clear user cache:', error);
    }
  }
};

// Cleanup function for graceful shutdown
const cleanup = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
};

module.exports = {
  initializeSupabaseAdmin,
  verifySupabaseToken,
  hasRole,
  getSupabaseClient,
  clearUserCache,
  cleanup,
  supabaseAdmin: () => supabaseAdmin
};