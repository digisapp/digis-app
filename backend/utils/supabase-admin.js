const { createClient } = require('@supabase/supabase-js');

let supabaseAdmin = null;

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

    // Verify the JWT token
    const { data: { user }, error } = await supabase.auth.getUser(token);

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

    const userResult = await pool.query(userQuery, [user.id]);
    const dbUser = userResult.rows[0];

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

      const username = user.user_metadata?.username || user.email.split('@')[0];

      const createResult = await pool.query(createUserQuery, [
        user.id,  // Store Supabase UUID in id column
        username,
        new Date(),
        new Date()
      ]);

      const newUser = createResult.rows[0];

      // Also create token balance
      await pool.query(`
        INSERT INTO token_balances (user_id, supabase_user_id, balance)
        VALUES ($1, $2, 0.00)
        ON CONFLICT (user_id) DO NOTHING
      `, [newUser.id, user.id]);

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

module.exports = {
  initializeSupabaseAdmin,
  verifySupabaseToken,
  hasRole,
  getSupabaseClient,
  supabaseAdmin: () => supabaseAdmin
};