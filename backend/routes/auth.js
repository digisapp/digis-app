const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { authenticateToken, verifySupabaseToken } = require('../middleware/auth');
const { supabaseAdmin } = require('../utils/supabase-admin-v2');
const { v4: uuidv4 } = require('uuid');
const { getVerifiedRole, getUserRole, clearRoleCache } = require('../middleware/roleVerification');
const { sendCreatorWelcomeEmail, sendFanWelcomeEmail } = require('../services/emailService');
const { sessions, users: usersCache, TTL } = require('../utils/redis');
const noStore = require('../middleware/noStore');
const { publishToChannel } = require('../utils/ably-adapter');

// Helper to use req.pg if available (with JWT context), otherwise fall back to pool
const db = (req) => req.pg || pool;

/**
 * @swagger
 * /auth/sync-user:
 *   post:
 *     summary: Sync user from Supabase Auth to database
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - supabaseId
 *               - email
 *             properties:
 *               supabaseId:
 *                 type: string
 *                 format: uuid
 *               email:
 *                 type: string
 *                 format: email
 *               metadata:
 *                 type: object
 *                 properties:
 *                   account_type:
 *                     type: string
 *                     enum: [fan, creator]
 *                   username:
 *                     type: string
 *     responses:
 *       200:
 *         description: User synced successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 isNewUser:
 *                   type: boolean
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Sync user from Supabase Auth to our database
router.post('/sync-user', verifySupabaseToken, async (req, res) => {
  const rid = req.headers['x-request-id'] || uuidv4();
  const TIMEOUT_MS = 1500; // 1.5 second timeout

  // Environment variable validation
  const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DATABASE_URL'];
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  if (missingVars.length > 0) {
    console.error('❌ sync-user missing environment variables', {
      rid,
      missing: missingVars
    });
    return res.status(500).json({
      success: false,
      rid,
      error: 'SERVER_CONFIG_ERROR',
      message: 'Server configuration error - missing required environment variables',
      hint: process.env.NODE_ENV === 'development' ? `Missing: ${missingVars.join(', ')}` : undefined
    });
  }

  // CORS headers for cross-origin requests
  const ALLOWED_ORIGINS = [
    'https://digis.cc',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
  const origin = req.headers.origin;

  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
  }

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Helper for consistent error responses
  const fail = (code, payload) => {
    console.error('❌ sync-user fail', { rid, code, ...payload });
    return res.status(code).json({ success: false, rid, ...payload });
  };

  // Timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS);
  });

  // Main handler promise
  const handlerPromise = (async () => {
    // Validate request body
    const { supabaseId, email, metadata } = req.body;

    if (!supabaseId || !email) {
      console.error('❌ sync-user missing required fields', { rid, body: req.body });
      return fail(400, {
        error: 'MISSING_FIELDS',
        message: 'supabaseId and email are required',
        required: ['supabaseId', 'email']
      });
    }

    // Verify authentication (verifySupabaseToken middleware should have set req.user)
    if (!req.user || !req.user.id) {
      console.error('❌ sync-user no user in request', { rid, hasAuthHeader: !!req.headers.authorization });
      return fail(401, {
        error: 'UNAUTHENTICATED',
        message: 'No valid user in token. Authentication required.',
        hint: 'Ensure Authorization header is present and valid'
      });
    }

    // Verify supabaseId matches authenticated user
    if (req.user.id !== supabaseId) {
      console.error('❌ sync-user ID mismatch', {
        rid,
        tokenUserId: req.user.id,
        bodySupabaseId: supabaseId
      });
      return fail(403, {
        error: 'ID_MISMATCH',
        message: 'Token user ID does not match request supabaseId'
      });
    }

    // Log token claims for debugging
    console.log('✅ sync-user request', {
      rid,
      userId: req.user.id,
      email: req.user.email,
      supabaseId,
      requestEmail: email
    });

    // IDEMPOTENT: Ensure user exists (create or update)
    // EMAIL-LINKING: If email exists, link it to the new supabase_id instead of failing

    // Safe account type and creator status fallbacks
    const accountTypeForUpsert = metadata?.account_type || metadata?.role || 'fan';
    const isAdminForUpsert = accountTypeForUpsert === 'admin';
    const isCreatorForUpsert = accountTypeForUpsert === 'creator' || isAdminForUpsert;
    const roleForUpsert = isAdminForUpsert ? 'admin' : (isCreatorForUpsert ? 'creator' : 'fan');

    // Safe username fallback
    const safeUsername = metadata?.username ||
                         email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '') ||
                         `user_${supabaseId.slice(0, 8)}`;

    // Default pricing in cents
    const vr = 10000; // $100 = 100 tokens/min for video
    const ar = 5000;  // $50 = 50 tokens/min for voice
    const sr = 1000;  // $10 = 10 tokens/min for stream
    const mp = 500;   // $5 = 5 tokens/msg

    try {
      // Use pool (service role) to bypass RLS
      await pool.query('BEGIN');

      // 1) Check if user exists by supabase_id
      const rowById = await pool.query(
        `SELECT id, supabase_id FROM users WHERE supabase_id = $1 LIMIT 1`,
        [supabaseId]
      );

      if (rowById.rows.length) {
        // User exists by supabase_id - UPDATE
        console.log('✅ User found by supabase_id, updating', { rid, supabaseId });
        await pool.query(`
          UPDATE users SET
            email = COALESCE($2, email),
            username = COALESCE($3, username),
            role = $4,
            is_creator = $5,
            is_super_admin = $6,
            video_rate_cents = $7,
            voice_rate_cents = $8,
            stream_rate_cents = $9,
            message_price_cents = $10,
            email_verified = true,
            last_active = NOW(),
            updated_at = NOW()
          WHERE supabase_id = $1
        `, [supabaseId, email || null, safeUsername || null, roleForUpsert, isCreatorForUpsert, isAdminForUpsert, vr, ar, sr, mp]);

      } else if (email) {
        // 2) Check if user exists by email
        const rowByEmail = await pool.query(
          `SELECT id, supabase_id FROM users WHERE LOWER(email) = $1 LIMIT 1`,
          [email.toLowerCase()]
        );

        if (rowByEmail.rows.length) {
          // EMAIL-LINKING: Link existing email account to new supabase_id
          console.log('✅ User found by email, linking to supabase_id', { rid, email, supabaseId, existingId: rowByEmail.rows[0].id });
          await pool.query(`
            UPDATE users SET
              supabase_id = $1,
              username = COALESCE($2, username),
              role = $3,
              is_creator = $4,
              is_super_admin = $5,
              video_rate_cents = $6,
              voice_rate_cents = $7,
              stream_rate_cents = $8,
              message_price_cents = $9,
              email_verified = true,
              last_active = NOW(),
              updated_at = NOW()
            WHERE id = $10
          `, [supabaseId, safeUsername || null, roleForUpsert, isCreatorForUpsert, isAdminForUpsert, vr, ar, sr, mp, rowByEmail.rows[0].id]);

        } else {
          // 3) Fresh insert - user doesn't exist
          console.log('✅ New user, inserting', { rid, email, supabaseId });
          await pool.query(`
            INSERT INTO users (
              supabase_id, email, username, role, is_creator, is_super_admin,
              video_rate_cents, voice_rate_cents, stream_rate_cents, message_price_cents,
              email_verified, last_active, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, NOW(), NOW(), NOW())
          `, [supabaseId, email || null, safeUsername || null, roleForUpsert, isCreatorForUpsert, isAdminForUpsert, vr, ar, sr, mp]);
        }
      } else {
        // No email - create with placeholder
        console.log('✅ New user without email, inserting with placeholder', { rid, supabaseId });
        await pool.query(`
          INSERT INTO users (
            supabase_id, email, username, role, is_creator, is_super_admin,
            video_rate_cents, voice_rate_cents, stream_rate_cents, message_price_cents,
            email_verified, last_active, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, NOW(), NOW(), NOW())
        `, [supabaseId, `${supabaseId}@placeholder.local`, safeUsername || null, roleForUpsert, isCreatorForUpsert, isAdminForUpsert, vr, ar, sr, mp]);
      }

      console.log('✅ sync-user upsert/link complete', {
        rid,
        supabaseId,
        email,
        role: roleForUpsert,
        is_creator: isCreatorForUpsert
      });

    } catch (dbError) {
      await pool.query('ROLLBACK');
      console.error('❌ sync-user DB operation failed', {
        rid,
        code: dbError.code,
        message: dbError.message,
        detail: dbError.detail,
        constraint: dbError.constraint
      });

      return fail(500, {
        error: 'INTERNAL',
        message: dbError.message || 'Failed to create or update user in database',
        code: dbError.code,
        detail: process.env.NODE_ENV === 'development' ? dbError.detail : undefined
      });
    }

    // IDEMPOTENT: Ensure token balance exists using SECURITY DEFINER function
    // This bypasses RLS without needing an INSERT policy
    try {
      await pool.query(`SELECT public.ensure_token_balance($1)`, [supabaseId]);
      console.log('✅ Token balance ensured', { rid, supabaseId });
    } catch (dbError) {
      console.error('❌ sync-user token balance failed', {
        rid,
        code: dbError.code,
        message: dbError.message
      });
      // Non-fatal: token balance can be created later
    }

    // Commit the transaction
    try {
      await pool.query('COMMIT');
    } catch (commitError) {
      await pool.query('ROLLBACK');
      console.error('❌ sync-user commit failed', { rid, error: commitError.message });
      return fail(500, {
        error: 'INTERNAL',
        message: 'Transaction commit failed',
        code: commitError.code
      });
    }

    // Now fetch the complete profile
    let existingUser;
    try {
      const checkQuery = `
        SELECT * FROM users
        WHERE supabase_id = $1::uuid
        LIMIT 1
      `;
      // Use pool for fetching user too (service role)
      existingUser = await pool.query(checkQuery, [supabaseId]);
    } catch (dbError) {
      console.error('❌ sync-user DB fetch user failed', {
        rid,
        code: dbError.code,
        message: dbError.message
      });
      return fail(500, {
        error: 'DB_FETCH_FAILED',
        message: 'Failed to fetch user from database',
        code: dbError.code
      });
    }

    if (existingUser.rows.length > 0) {
      // User exists, update their info and fetch complete profile with token balance
      const user = existingUser.rows[0];

      try {
        const updateQuery = `
          UPDATE users
          SET
            email_verified = true,
            last_active = NOW(),
            updated_at = NOW()
          WHERE supabase_id = $1
          RETURNING supabase_id
        `;
        // Use pool (service role) for update too
        await pool.query(updateQuery, [supabaseId]);
      } catch (dbError) {
        console.error('❌ sync-user DB update user failed', {
          rid,
          code: dbError.code,
          message: dbError.message
        });
        // Non-fatal: we can still return the profile
      }

      // Fetch complete user profile with token balance
      let profileResult;
      try {
        const profileQuery = `
          SELECT
            u.id,
            u.supabase_id,
            u.email,
            u.username,
            u.display_name,
            u.bio,
            u.profile_pic_url,
            u.is_creator,
            u.is_super_admin,
            u.role,
            u.creator_type,
            u.video_rate_cents,
            u.voice_rate_cents,
            u.stream_rate_cents,
            u.message_price_cents,
            u.verified,
            u.email_verified,
            u.created_at,
            u.updated_at,
            u.last_active,
            COALESCE(tb.balance, 0) as token_balance,
            COALESCE(tb.total_purchased, 0) as total_purchased,
            COALESCE(tb.total_spent, 0) as total_spent,
            COALESCE(tb.total_earned, 0) as total_earned
          FROM users u
          LEFT JOIN token_balances tb ON tb.user_id = u.supabase_id
          WHERE u.supabase_id = $1::uuid
          LIMIT 1
        `;
        profileResult = await db(req).query(profileQuery, [user.supabase_id]);
      } catch (dbError) {
        console.error('❌ sync-user DB fetch profile failed', {
          rid,
          code: dbError.code,
          message: dbError.message
        });
        return fail(500, {
          error: 'DB_PROFILE_FETCH_FAILED',
          message: 'Failed to fetch user profile from database',
          code: dbError.code
        });
      }

      if (!profileResult.rows || profileResult.rows.length === 0) {
        return fail(404, {
          error: 'PROFILE_NOT_FOUND',
          message: 'User profile not found in database',
          userId: user.id
        });
      }

      const rawProfile = profileResult.rows[0];

      // **CANONICAL ROLE COMPUTATION** - Override with server truth
      // Add null-safe checks for all fields
      const completeProfile = {
        ...rawProfile,
        is_creator: rawProfile.is_creator === true ||
                    rawProfile.role === 'creator' ||
                    (rawProfile.creator_type !== null && rawProfile.creator_type !== undefined),
        is_admin: rawProfile.is_super_admin === true ||
                  rawProfile.role === 'admin',
        // Ensure token balance fields are always numbers
        token_balance: parseFloat(rawProfile.token_balance) || 0,
        total_purchased: parseFloat(rawProfile.total_purchased) || 0,
        total_spent: parseFloat(rawProfile.total_spent) || 0,
        total_earned: parseFloat(rawProfile.total_earned) || 0
      };

      console.log('✅ Canonical profile computed:', {
        username: completeProfile.username,
        is_creator: completeProfile.is_creator,
        is_admin: completeProfile.is_admin,
        fields_checked: {
          is_creator_field: rawProfile.is_creator,
          role_field: rawProfile.role,
          creator_type_field: rawProfile.creator_type,
          is_super_admin_field: rawProfile.is_super_admin
        }
      });

      // Store session in Redis (24 hour TTL) - non-blocking
      const sessionId = req.headers['x-session-id'] || uuidv4();
      try {
        await sessions.store(sessionId, {
          userId: completeProfile.id,
          email: completeProfile.email,
          username: completeProfile.username,
          isCreator: completeProfile.is_creator,
          loginTime: Date.now()
        }, TTL.DAY);

        // Cache user data for faster access
        await usersCache.cache(completeProfile.id, completeProfile, TTL.LONG);
      } catch (cacheError) {
        console.error('⚠️ Redis cache error (non-fatal):', cacheError.message);
        // Don't fail the request if caching fails
      }

      console.log('✅ sync-user success', { rid, username: completeProfile.username, is_creator: completeProfile.is_creator });

      // Commit transaction
      if (req.pg) {
        try {
          await req.pg.query('COMMIT');
        } catch (commitError) {
          console.error('⚠️ Commit failed (non-fatal):', commitError.message);
        }
      }

      return res.json({
        success: true,
        rid,
        user: completeProfile,
        isNewUser: false,
        sessionId
      });
    }
    
    // Create new user
    let username;
    const accountType = metadata?.account_type || 'fan';

    // Age verification - SKIP FOR AUTHENTICATED USERS
    // If user has valid Supabase JWT (verified by verifySupabaseToken middleware),
    // they already passed age verification during Supabase signup.
    // This section should rarely be reached since UPSERT above handles user creation.
    // Keeping age check only for development/testing with explicit metadata.
    if (metadata?.age_verified === false) {
      // Only reject if explicitly set to false (not missing)
      return res.status(400).json({
        success: false,
        error: 'Age verification is required. Users must be 18 or older to join Digis.'
      });
    }

    // Validate date of birth if provided (double-check for safety)
    if (metadata?.date_of_birth) {
      const birthDate = new Date(metadata.date_of_birth);
      const today = new Date();
      const age = Math.floor((today - birthDate) / (365.25 * 24 * 60 * 60 * 1000));

      if (age < 18) {
        return res.status(400).json({
          success: false,
          error: 'Users must be 18 or older to join Digis.'
        });
      }
    }
    
    // Use provided username for both fans and creators
    if (metadata?.username) {
      username = metadata.username;
    } else {
      // Fallback: Generate unique username if not provided
      if (accountType === 'fan') {
        // Generate unique fan handle like @user173635
        const randomNum = Math.floor(100000 + Math.random() * 900000); // 6-digit random number
        username = `user${randomNum}`;
        
        // Check if username already exists and regenerate if needed
        let attempts = 0;
        while (attempts < 10) {
          const checkUsername = await db(req).query(
            'SELECT id FROM users WHERE username = $1',
            [username]
          );
          if (checkUsername.rows.length === 0) break;
          
          username = `user${Math.floor(100000 + Math.random() * 900000)}`;
          attempts++;
        }
      } else {
        // Creator fallback username from email
        username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
      }
    }
    
    
    const insertQuery = `
      INSERT INTO users (
        supabase_id,
        email,
        username,
        display_name,
        email_verified,
        is_creator,
        is_super_admin,
        role,
        video_rate_cents,
        voice_rate_cents,
        stream_rate_cents,
        message_price_cents,
        last_active,
        created_at,
        updated_at
      ) VALUES (
        $1::uuid, $2, $3, $3, true, $4, false, $5,
        COALESCE($6, 10000),
        COALESCE($7, 5000),
        COALESCE($8, 1000),
        COALESCE($9, 500),
        NOW(), NOW(), NOW()
      ) RETURNING *
    `;

    const isCreatorFallback = accountType === 'creator';
    const roleFallback = isCreatorFallback ? 'creator' : 'fan';

    const newUser = await db(req).query(insertQuery, [
      supabaseId,
      email,
      username,
      isCreatorFallback,
      roleFallback,
      10000, // defaultVideoRateCents
      5000,  // defaultVoiceRateCents
      1000,  // defaultStreamRateCents
      500    // defaultMessagePriceCents
    ]);
    
    // If signing up as creator, create an application
    if (accountType === 'creator' && metadata?.username) {
      const applicationId = uuidv4();
      await db(req).query(`
        INSERT INTO creator_applications (
          id,
          supabase_user_id,
          application_reason,
          status,
          created_at
        ) VALUES (
          $1, $2, $3, 'pending', NOW()
        )
      `, [
        applicationId,
        supabaseId,
        'Initial application from signup'
      ]);
      
      // Send real-time notification to admins
      try {
        // Get all admin users
        const adminsQuery = await db(req).query(
          'SELECT id FROM users WHERE is_super_admin = true'
        );
        
        // Create notification for each admin
        for (const admin of adminsQuery.rows) {
          await db(req).query(`
            INSERT INTO notifications (
              id,
              recipient_id,
              type,
              title,
              content,
              metadata,
              created_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, NOW()
            )
          `, [
            uuidv4(),
            admin.id,
            'creator_application',
            'New Creator Application',
            `${username} has applied to become a creator`,
            JSON.stringify({
              applicationId,
              username,
              email,
              timestamp: new Date().toISOString()
            })
          ]);
        }
        
        // Emit Ably event for real-time update to admin dashboard
        try {
          await publishToChannel('admins', 'new_creator_application', {
            applicationId,
            username,
            email,
            timestamp: new Date().toISOString()
          });
        } catch (ablyError) {
          console.error('Failed to publish to Ably:', ablyError.message);
        }
      } catch (notifError) {
        console.error('Failed to send admin notifications:', notifError);
      }
    }
    
    // Create token balance for new user
    try {
      await db(req).query(`
        INSERT INTO token_balances (
          user_id,
          balance,
          total_earned,
          total_spent,
          total_purchased,
          created_at,
          updated_at
        ) VALUES ($1::uuid, 0, 0, 0, 0, NOW(), NOW())
        ON CONFLICT (user_id) DO NOTHING
      `, [supabaseId]);
    } catch (tokenBalanceError) {
      console.error('❌ Failed to create token balance (non-fatal):', {
        error: tokenBalanceError.message,
        code: tokenBalanceError.code,
        supabaseId
      });
      // Non-fatal: token balance can be created later
    }

    // Send welcome email based on account type (non-blocking)
    try {
      if (accountType === 'creator') {
        // Send creator welcome email asynchronously
        sendCreatorWelcomeEmail(email, username).catch(emailError => {
          console.error('Failed to send creator welcome email:', emailError.message);
        });
      } else {
        // Send fan welcome email asynchronously
        sendFanWelcomeEmail(email, username).catch(emailError => {
          console.error('Failed to send fan welcome email:', emailError.message);
        });
      }
    } catch (emailError) {
      // Don't block user creation if email fails
      console.error('Email service error:', emailError.message);
    }

    // Apply canonical role computation for new users too
    const rawNewUser = newUser.rows[0];
    const canonicalNewUser = {
      ...rawNewUser,
      is_creator: rawNewUser.is_creator === true ||
                  rawNewUser.role === 'creator' ||
                  rawNewUser.creator_type != null,
      is_admin: rawNewUser.is_super_admin === true ||
                rawNewUser.role === 'admin'
    };

    // Commit transaction
    if (req.pg) {
      try {
        await req.pg.query('COMMIT');
      } catch (commitError) {
        console.error('⚠️ Commit failed (non-fatal):', commitError.message);
      }
    }

    return res.json({
      success: true,
      user: canonicalNewUser,
      isNewUser: true
    });
  })();

  // Race handler against timeout
  try {
    await Promise.race([handlerPromise, timeoutPromise]);
  } catch (error) {
    // Handle timeout specifically
    if (error.message === 'TIMEOUT') {
      console.error('❌ sync-user timeout', { rid, timeoutMs: TIMEOUT_MS });
      return res.status(504).json({
        success: false,
        rid,
        error: 'TIMEOUT',
        message: `Request exceeded ${TIMEOUT_MS}ms timeout`,
        detail: 'Database query took too long. Please try again.'
      });
    }

    // Handle other errors
    console.error('❌ sync-user error', {
      rid,
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack,
      supabaseId: req.body?.supabaseId,
      email: req.body?.email
    });

    // Rollback transaction on error
    if (req.pg) {
      try {
        await req.pg.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('⚠️ Rollback failed:', rollbackError.message);
      }
    }

    return res.status(500).json({
      success: false,
      rid,
      error: 'INTERNAL',
      message: error.message,
      code: error.code,
      detail: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 profile:
 *                   allOf:
 *                     - $ref: '#/components/schemas/User'
 *                     - type: object
 *                       properties:
 *                         token_balance:
 *                           type: number
 *                         total_purchased:
 *                           type: number
 *                         total_spent:
 *                           type: number
 *                         total_earned:
 *                           type: number
 *                         follower_count:
 *                           type: integer
 *                         following_count:
 *                           type: integer
 *       404:
 *         description: User profile not found
 *       401:
 *         description: Unauthorized
 */
// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const supabaseId = req.user?.supabase_id || req.user?.id;

    if (!supabaseId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated - missing user ID'
      });
    }

    const query = `
      SELECT
        u.id,
        u.supabase_id,
        u.email,
        u.username,
        u.display_name,
        u.bio,
        u.profile_pic_url,
        u.is_creator,
        u.is_super_admin,
        u.role,
        u.creator_type,
        u.verified,
        u.email_verified,
        u.created_at,
        u.updated_at,
        u.last_active,
        COALESCE(tb.balance, 0) as token_balance,
        COALESCE(tb.total_purchased, 0) as total_purchased,
        COALESCE(tb.total_spent, 0) as total_spent,
        COALESCE(tb.total_earned, 0) as total_earned,
        (
          SELECT COUNT(*) FROM followers
          WHERE creator_id = u.id
        ) as follower_count,
        (
          SELECT COUNT(*) FROM followers
          WHERE follower_id = u.supabase_id
        ) as following_count
      FROM users u
      LEFT JOIN token_balances tb ON tb.user_id = u.supabase_id
      WHERE u.id = $1::uuid OR u.supabase_id = $1
      LIMIT 1
    `;

    const result = await db(req).query(query, [supabaseId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User profile not found'
      });
    }

    // Apply canonical role computation
    const rawProfile = result.rows[0];
    const profile = {
      ...rawProfile,
      is_creator: rawProfile.is_creator === true ||
                  rawProfile.role === 'creator' ||
                  (rawProfile.creator_type !== null && rawProfile.creator_type !== undefined),
      is_admin: rawProfile.is_super_admin === true ||
                rawProfile.role === 'admin',
      token_balance: parseFloat(rawProfile.token_balance) || 0,
      total_purchased: parseFloat(rawProfile.total_purchased) || 0,
      total_spent: parseFloat(rawProfile.total_spent) || 0,
      total_earned: parseFloat(rawProfile.total_earned) || 0
    };

    res.json({
      success: true,
      profile
    });

  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile',
      message: error.message
    });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id || req.user.supabase_id;
    const {
      username,
      bio,
      profile_pic_url,
      video_rate_cents,
      voice_rate_cents,
      stream_rate_cents,
      message_price_cents
    } = req.body;
    
    // Check if user is a fan (not creator)
    const userCheck = await db(req).query(
      'SELECT is_creator, username FROM users WHERE id = $1::uuid',
      [userId]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    const isCreator = userCheck.rows[0].is_creator;
    const currentUsername = userCheck.rows[0].username;
    
    // Fans cannot change their username (only creators can)
    if (username && !isCreator && currentUsername.startsWith('user')) {
      return res.status(403).json({
        success: false,
        error: 'Fans cannot change their username handle. You can only update your display name.'
      });
    }
    
    // Validate username if provided (for creators only)
    if (username && isCreator) {
      const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (cleanUsername !== username || username.length < 3 || username.length > 30) {
        return res.status(400).json({
          success: false,
          error: 'Invalid username. Must be 3-30 characters, lowercase letters, numbers, and underscores only.'
        });
      }
      
      // Check if username is taken
      const checkQuery = `
        SELECT id FROM users 
        WHERE username = $1 AND (id != $2::uuid AND id != $3::uuid)
        LIMIT 1
      `;
      
      const existing = await db(req).query(checkQuery, [username, userId, userId]);
      
      if (existing.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Username is already taken'
        });
      }
    }
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (username !== undefined) {
      updates.push(`username = $${paramCount}`);
      values.push(username);
      paramCount++;
    }
    
    
    if (bio !== undefined) {
      updates.push(`bio = $${paramCount}`);
      values.push(bio);
      paramCount++;
    }
    
    if (profile_pic_url !== undefined) {
      updates.push(`profile_pic_url = $${paramCount}`);
      values.push(profile_pic_url);
      paramCount++;
    }

    if (video_rate_cents !== undefined && req.user.isCreator) {
      updates.push(`video_rate_cents = $${paramCount}`);
      values.push(video_rate_cents);
      paramCount++;
    }

    if (voice_rate_cents !== undefined && req.user.isCreator) {
      updates.push(`voice_rate_cents = $${paramCount}`);
      values.push(voice_rate_cents);
      paramCount++;
    }

    if (stream_rate_cents !== undefined && req.user.isCreator) {
      updates.push(`stream_rate_cents = $${paramCount}`);
      values.push(stream_rate_cents);
      paramCount++;
    }

    if (message_price_cents !== undefined && req.user.isCreator) {
      updates.push(`message_price_cents = $${paramCount}`);
      values.push(message_price_cents);
      paramCount++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }
    
    updates.push(`updated_at = NOW()`);
    
    const updateQuery = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE (id = $${paramCount}::uuid OR id = $${paramCount + 1}::uuid)
      RETURNING *
    `;
    
    values.push(userId, userId);
    
    const result = await db(req).query(updateQuery, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Also update Supabase user metadata if we have a Supabase ID
    if (req.user.supabase_id) {
      try {
        const admin = supabaseAdmin();
        await admin.auth.admin.updateUserById(req.user.supabase_id, {
          user_metadata: {
            username,
            bio,
            profile_pic_url
          }
        });
      } catch (supabaseError) {
        console.error('Failed to update Supabase metadata:', supabaseError);
        // Don't fail the request if Supabase update fails
      }
    }
    
    res.json({
      success: true,
      profile: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
      message: error.message
    });
  }
});

// Apply to become a creator
router.post('/apply-creator', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id || req.user.supabase_id;
    const {
      application_reason,
      content_types,
      social_media_links,
      portfolio_url
    } = req.body;
    
    // Check if user is already a creator
    if (req.user.isCreator) {
      return res.status(400).json({
        success: false,
        error: 'You are already registered as a creator'
      });
    }
    
    // Create creator application
    const applicationId = uuidv4();
    
    const insertQuery = `
      INSERT INTO creator_applications (
        id,
        user_id,
        supabase_user_id,
        supabase_id,
        application_reason,
        content_types,
        social_media_links,
        portfolio_url,
        status,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW()
      ) RETURNING *
    `;
    
    const userIdValue = req.user.supabase_id || req.body.userId;
    
    const result = await db(req).query(insertQuery, [
      applicationId,
      userIdValue,
      req.user.supabase_id,
      req.user.supabase_id,
      application_reason,
      JSON.stringify(content_types || []),
      JSON.stringify(social_media_links || {}),
      portfolio_url
    ]);
    
    res.json({
      success: true,
      application: result.rows[0],
      message: 'Creator application submitted successfully. We will review it within 24-48 hours.'
    });
    
  } catch (error) {
    console.error('Error submitting creator application:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit creator application',
      message: error.message
    });
  }
});

// Check username availability
router.get('/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    const query = `
      SELECT COUNT(*) as count 
      FROM users 
      WHERE LOWER(username) = LOWER($1)
    `;
    
    const result = await db(req).query(query, [username]);
    const isAvailable = result.rows[0].count === '0';
    
    res.json({
      success: true,
      available: isAvailable,
      username: username.toLowerCase()
    });
    
  } catch (error) {
    console.error('Error checking username:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check username availability'
    });
  }
});

// Delete account
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id || req.user.supabase_id;
    const { confirmEmail } = req.body;
    
    // Verify email confirmation
    if (confirmEmail !== req.user.email) {
      return res.status(400).json({
        success: false,
        error: 'Email confirmation does not match'
      });
    }
    
    // Start transaction
    await db(req).query('BEGIN');
    
    try {
      // Delete user data in correct order due to foreign key constraints
      await db(req).query('DELETE FROM tips WHERE tipper_id = $1 OR supabase_tipper_id = $2', [userId, userId]);
      await db(req).query('DELETE FROM followers WHERE follower_id = $1 OR supabase_follower_id = $2', [userId, userId]);
      await db(req).query('DELETE FROM creator_subscriptions WHERE subscriber_id = $1 OR supabase_subscriber_id = $2', [userId, userId]);
      await db(req).query('DELETE FROM token_transactions WHERE user_id = $1 OR supabase_user_id = $2', [userId, userId]);
      await db(req).query('DELETE FROM token_balances WHERE user_id = $1 OR supabase_user_id = $2', [userId, userId]);
      await db(req).query('DELETE FROM payments WHERE user_id = $1 OR supabase_user_id = $2', [userId, userId]);
      
      // Delete sessions where user is either creator or member
      await db(req).query(`
        DELETE FROM sessions 
        WHERE fan_id IN (SELECT id FROM users WHERE id = $1::uuid OR id = $2::uuid)
        OR creator_id IN (SELECT id FROM users WHERE id = $1::uuid OR id = $2::uuid)
      `, [userId, userId]);
      
      // Finally delete the user
      await db(req).query('DELETE FROM users WHERE id = $1::uuid OR id = $2::uuid', [userId, userId]);
      
      // Commit transaction
      await db(req).query('COMMIT');
      
      // Delete from Supabase Auth if we have a Supabase ID
      if (req.user.supabase_id) {
        try {
          const admin = supabaseAdmin();
          await admin.auth.admin.deleteUser(req.user.supabase_id);
        } catch (supabaseError) {
          console.error('Failed to delete Supabase auth user:', supabaseError);
          // Don't fail the request if Supabase deletion fails
        }
      }
      
      res.json({
        success: true,
        message: 'Account deleted successfully'
      });
      
    } catch (error) {
      await db(req).query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete account',
      message: error.message
    });
  }
});

// Migration status check
router.get('/migration-status', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    res.json({
      success: true,
      authProvider: req.authProvider || 'unknown',
      hasSupabaseId: !!user.supabase_id,
      migrationComplete: !!user.supabase_id,
      user: {
        email: user.email,
        username: user.username,
        isCreator: user.isCreator
      }
    });
    
  } catch (error) {
    console.error('Error checking migration status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check migration status'
    });
  }
});

/**
 * @swagger
 * /auth/verify-role:
 *   get:
 *     summary: Get verified user role from database
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User role information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 role:
 *                   type: object
 *                   properties:
 *                     primaryRole:
 *                       type: string
 *                       enum: [admin, creator, fan]
 *                     isCreator:
 *                       type: boolean
 *                     isAdmin:
 *                       type: boolean
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 */
router.get('/verify-role', verifySupabaseToken, getVerifiedRole);

// Clear role cache when user is updated
router.post('/clear-role-cache', verifySupabaseToken, (req, res) => {
  const userId = req.user?.id || req.userId;
  if (userId) {
    clearRoleCache(userId);
  }
  res.json({ success: true, message: 'Role cache cleared' });
});

/**
 * @swagger
 * /auth/session:
 *   get:
 *     summary: Get current user session with authoritative role (SINGLE SOURCE OF TRUTH - NO CACHE)
 *     description: |
 *       Returns authoritative user role and profile directly from database.
 *       NO CDN/device caching. This is the canonical endpoint for role resolution.
 *       Frontend should call this on login/refresh to get the true server role.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Session data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 user:
 *                   type: object
 *                   properties:
 *                     supabaseId:
 *                       type: string
 *                       format: uuid
 *                     dbId:
 *                       type: string
 *                       format: uuid
 *                     roles:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["creator"]
 *                     isCreator:
 *                       type: boolean
 *                     isAdmin:
 *                       type: boolean
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: User not found
 */
router.get('/session', verifySupabaseToken, async (req, res) => {
  try {
    const supabaseId = req.user?.id || req.userId;

    if (!supabaseId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    // CRITICAL: Query database directly - NO cache, NO guessing
    // This is the single source of truth for roles
    const query = `
      SELECT
        u.id as db_id,
        u.supabase_id,
        COALESCE(u.is_creator, false) as is_creator,
        COALESCE(u.is_super_admin, false) as is_admin
      FROM users u
      WHERE u.supabase_id = $1
      LIMIT 1
    `;

    const result = await db(req).query(query, [supabaseId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = result.rows[0];

    // Debug logging for role detection
    console.log('🔍 /auth/session role check:', {
      supabaseId,
      is_creator: user.is_creator,
      is_admin: user.is_admin,
      db_id: user.db_id
    });

    // Determine primary role (frontend expects single role)
    let primaryRole = 'fan'; // default
    if (user.is_admin) {
      primaryRole = 'admin';
    } else if (user.is_creator) {
      primaryRole = 'creator';
    }

    // Build permissions array
    const permissions = [];
    if (user.is_creator) permissions.push('create_content');
    if (user.is_admin) permissions.push('admin_access');

    // Prevent CDN/device caching - force fresh data
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Vary', 'Authorization'); // Ensure CDN respects per-user caching

    // Return session format expected by frontend useAuthStore
    return res.json({
      success: true,
      session: {
        role: primaryRole,
        user: {
          id: user.supabase_id,
          dbId: user.db_id,
          email: req.user?.email || null,
          username: req.user?.username || null
        },
        permissions,
        role_version: 1,
        // Legacy fields for compatibility
        isCreator: user.is_creator,
        isAdmin: user.is_admin
      }
    });

  } catch (error) {
    console.error('❌ Error getting session:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get session'
    });
  }
});

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get canonical user role (SINGLE SOURCE OF TRUTH)
 *     description: Returns simplified user role computed from multiple DB fields
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User role information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 email:
 *                   type: string
 *                 username:
 *                   type: string
 *                 is_creator:
 *                   type: boolean
 *                   description: Canonical creator status (checks is_creator OR role='creator' OR creator_type != null)
 *                 is_admin:
 *                   type: boolean
 *                   description: Canonical admin status (checks is_super_admin OR role='admin')
 *                 profile:
 *                   type: object
 *       401:
 *         description: Not authenticated
 */
router.get('/me', noStore, verifySupabaseToken, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get user from database with ALL role-related fields
    const query = `
      SELECT
        id,
        email,
        username,
        is_creator,
        is_super_admin,
        role,
        creator_type,
        bio,
        profile_pic_url,
        verified
      FROM users
      WHERE id = $1::uuid
      LIMIT 1
    `;

    const result = await db(req).query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // **CANONICAL ROLE COMPUTATION** - Single source of truth
    // A user is a creator if ANY of these conditions are true:
    const isCreator = user.is_creator === true ||
                      user.role === 'creator' ||
                      user.creator_type != null;

    const isAdmin = user.is_super_admin === true ||
                    user.role === 'admin';

    // Return simplified, canonical response
    return res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      is_creator: isCreator,
      is_admin: isAdmin,
      profile: {
        bio: user.bio,
        profile_pic_url: user.profile_pic_url,
        verified: user.verified
      }
    });

  } catch (error) {
    console.error('Error in /api/me:', error);
    return res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Temporary debugging endpoint - check database connectivity
router.get('/debug-db', async (req, res) => {
  try {
    const result = await db(req).query('SELECT NOW() as current_time, version() as pg_version');

    res.json({
      success: true,
      database: 'connected',
      timestamp: result.rows[0].current_time,
      postgresql: result.rows[0].pg_version
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Database connection failed',
      message: error.message,
      code: error.code
    });
  }
});

// Debug endpoint - check users table schema
router.get('/debug-schema', async (req, res) => {
  try {
    // Get all tables in public schema
    const tablesResult = await db(req).query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);

    // Get users table columns
    const columnsResult = await db(req).query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
      ORDER BY ordinal_position;
    `);

    // Get primary key
    const pkResult = await db(req).query(`
      SELECT a.attname
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = 'users'::regclass AND i.indisprimary;
    `);

    // Check for critical columns
    const columnNames = columnsResult.rows.map(r => r.column_name);
    const criticalColumns = {
      id: columnNames.includes('id'),
      supabase_id: columnNames.includes('supabase_id'),
      firebase_uid: columnNames.includes('firebase_uid'),
      email: columnNames.includes('email'),
      username: columnNames.includes('username'),
      display_name: columnNames.includes('display_name'),
      is_creator: columnNames.includes('is_creator'),
      email_verified: columnNames.includes('email_verified'),
      last_active: columnNames.includes('last_active')
    };

    const notNullColumns = columnsResult.rows
      .filter(r => r.is_nullable === 'NO')
      .map(r => r.column_name);

    // Get creator-related data columns
    const creatorDataColumns = columnNames.filter(col =>
      col.includes('rate') ||
      col.includes('price') ||
      col.includes('token') ||
      col.includes('bio') ||
      col.includes('about') ||
      col.includes('avatar') ||
      col.includes('photo') ||
      col.includes('image') ||
      col.includes('banner') ||
      col.includes('gallery')
    );

    res.json({
      success: true,
      allTables: tablesResult.rows.map(r => r.tablename),
      columns: columnsResult.rows,
      primaryKey: pkResult.rows.map(r => r.attname),
      criticalColumns,
      notNullColumns,
      creatorDataColumns,
      totalColumns: columnsResult.rows.length,
      totalTables: tablesResult.rows.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Schema check failed',
      message: error.message
    });
  }
});

// Debug endpoint - show DATABASE_URL connection info (no secrets)
router.get('/debug-db-info', async (req, res) => {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return res.json({
        success: false,
        error: 'DATABASE_URL not set'
      });
    }

    const u = new URL(dbUrl);
    const isPoolerHost = u.hostname.includes('pooler.supabase.com');

    res.json({
      success: true,
      connection: {
        host: u.hostname,
        port: u.port,
        database: u.pathname.slice(1),
        sslmode: u.searchParams.get('sslmode'),
        poolerHost: isPoolerHost,
        connectionMode: isPoolerHost && u.port === '6543' ? 'pooler:transaction' :
                       isPoolerHost && u.port === '5432' ? 'pooler:session' :
                       'direct'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to parse DATABASE_URL',
      message: error.message
    });
  }
});

// Export router and middleware for backward compatibility
module.exports = router;
module.exports.verifySupabaseToken = authenticateToken; // Alias for migration