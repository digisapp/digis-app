const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { authenticateToken, verifySupabaseToken } = require('../middleware/auth');
const { supabaseAdmin } = require('../utils/supabase-admin');
const { v4: uuidv4 } = require('uuid');
const { getVerifiedRole, getUserRole, clearRoleCache } = require('../middleware/roleVerification');
const { sendCreatorWelcomeEmail, sendFanWelcomeEmail } = require('../services/emailService');
const { sessions, users: usersCache, TTL } = require('../utils/redis');

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
  try {
    const { supabaseId, email, metadata } = req.body;
    
    // Check if user already exists
    const checkQuery = `
      SELECT * FROM users 
      WHERE id = $1::uuid OR email = $2
      LIMIT 1
    `;
    
    const existingUser = await pool.query(checkQuery, [supabaseId, email]);
    
    if (existingUser.rows.length > 0) {
      // User exists, update their info
      const user = existingUser.rows[0];
      
      const updateQuery = `
        UPDATE users 
        SET 
          supabase_id = $1,
          email_verified = true,
          last_active = NOW(),
          updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
      
      const result = await pool.query(updateQuery, [supabaseId, user.id]);

      // Store session in Redis (24 hour TTL)
      const sessionId = req.headers['x-session-id'] || uuidv4();
      await sessions.store(sessionId, {
        userId: result.rows[0].id,
        email: result.rows[0].email,
        username: result.rows[0].username,
        isCreator: result.rows[0].is_creator,
        loginTime: Date.now()
      }, TTL.DAY);

      // Cache user data for faster access
      await usersCache.cache(result.rows[0].id, result.rows[0], TTL.LONG);

      return res.json({
        success: true,
        user: result.rows[0],
        isNewUser: false,
        sessionId
      });
    }
    
    // Create new user
    let username;
    const accountType = metadata?.account_type || 'fan';
    
    // Validate age verification
    if (metadata?.age_verified !== true) {
      return res.status(400).json({
        success: false,
        error: 'Age verification is required. Users must be 18 or older to join Digis.'
      });
    }
    
    // Validate date of birth if provided
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
          const checkUsername = await pool.query(
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
        id,
        email,
        email_confirmed_at,
        username,
        is_creator,
        raw_user_meta_data,
        date_of_birth,
        verified,
        created_at,
        updated_at
      ) VALUES (
        $1::uuid, $2, NOW(), $3, $4, $5, $6, true, NOW(), NOW()
      ) RETURNING *
    `;
    
    const newUser = await pool.query(insertQuery, [
      supabaseId,
      email,
      username,
      accountType === 'creator', // Set is_creator based on account_type
      JSON.stringify(metadata || {}),
      metadata?.date_of_birth || null
    ]);
    
    // If signing up as creator, create an application
    if (accountType === 'creator' && metadata?.username) {
      const applicationId = uuidv4();
      await pool.query(`
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
        const adminsQuery = await pool.query(
          'SELECT id FROM users WHERE is_super_admin = true'
        );
        
        // Create notification for each admin
        for (const admin of adminsQuery.rows) {
          await pool.query(`
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
        
        // Emit socket event for real-time update
        const io = req.app.get('io');
        if (io) {
          io.to('admins').emit('new_creator_application', {
            applicationId,
            username,
            email,
            timestamp: new Date().toISOString()
          });
        }
      } catch (notifError) {
        console.error('Failed to send admin notifications:', notifError);
      }
    }
    
    // Create token balance for new user
    await pool.query(`
      INSERT INTO token_balances (
        user_id,
        balance,
        created_at
      ) VALUES ($1::uuid, 0.00, NOW())
    `, [supabaseId]);

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

    res.json({
      success: true,
      user: newUser.rows[0],
      isNewUser: true
    });
    
  } catch (error) {
    console.error('Error syncing user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync user',
      message: error.message
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
    const userId = req.user.supabase_id || req.user.supabase_id;
    
    const query = `
      SELECT 
        u.*,
        tb.balance as token_balance,
        tb.total_purchased,
        tb.total_spent,
        tb.total_earned,
        (
          SELECT COUNT(*) FROM followers 
          WHERE creator_id = u.id
        ) as follower_count,
        (
          SELECT COUNT(*) FROM followers 
          WHERE follower_id = u.id OR followed_id = u.id
        ) as following_count
      FROM users u
      LEFT JOIN token_balances tb ON 
        tb.supabase_user_id = u.supabase_id OR 
        tb.user_id = u.supabase_id
      WHERE u.id = $1::uuid OR u.id = $2::uuid
      LIMIT 1
    `;
    
    const result = await pool.query(query, [userId, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User profile not found'
      });
    }
    
    res.json({
      success: true,
      profile: result.rows[0]
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
      price_per_min
    } = req.body;
    
    // Check if user is a fan (not creator)
    const userCheck = await pool.query(
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
      
      const existing = await pool.query(checkQuery, [username, userId, userId]);
      
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
    
    if (price_per_min !== undefined && req.user.isCreator) {
      updates.push(`price_per_min = $${paramCount}`);
      values.push(price_per_min);
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
    
    const result = await pool.query(updateQuery, values);
    
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
    
    const result = await pool.query(insertQuery, [
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
    
    const result = await pool.query(query, [username]);
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
    await pool.query('BEGIN');
    
    try {
      // Delete user data in correct order due to foreign key constraints
      await pool.query('DELETE FROM tips WHERE tipper_id = $1 OR supabase_tipper_id = $2', [userId, userId]);
      await pool.query('DELETE FROM followers WHERE follower_id = $1 OR supabase_follower_id = $2', [userId, userId]);
      await pool.query('DELETE FROM creator_subscriptions WHERE subscriber_id = $1 OR supabase_subscriber_id = $2', [userId, userId]);
      await pool.query('DELETE FROM token_transactions WHERE user_id = $1 OR supabase_user_id = $2', [userId, userId]);
      await pool.query('DELETE FROM token_balances WHERE user_id = $1 OR supabase_user_id = $2', [userId, userId]);
      await pool.query('DELETE FROM payments WHERE user_id = $1 OR supabase_user_id = $2', [userId, userId]);
      
      // Delete sessions where user is either creator or member
      await pool.query(`
        DELETE FROM sessions 
        WHERE fan_id IN (SELECT id FROM users WHERE id = $1::uuid OR id = $2::uuid)
        OR creator_id IN (SELECT id FROM users WHERE id = $1::uuid OR id = $2::uuid)
      `, [userId, userId]);
      
      // Finally delete the user
      await pool.query('DELETE FROM users WHERE id = $1::uuid OR id = $2::uuid', [userId, userId]);
      
      // Commit transaction
      await pool.query('COMMIT');
      
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
      await pool.query('ROLLBACK');
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
 *     summary: Get current user session with unified role (SINGLE SOURCE OF TRUTH)
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
 *                 success:
 *                   type: boolean
 *                 session:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                       format: uuid
 *                     email:
 *                       type: string
 *                     username:
 *                       type: string
 *                     role:
 *                       type: string
 *                       enum: [fan, creator, admin]
 *                     is_creator:
 *                       type: boolean
 *                     is_admin:
 *                       type: boolean
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *                     role_version:
 *                       type: integer
 *                     user:
 *                       type: object
 *       401:
 *         description: Not authenticated
 */
router.get('/session', verifySupabaseToken, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    // Get role from database (single source of truth)
    const userRole = await getUserRole(userId);

    if (!userRole) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Compute permissions based on role
    const permissions = [];
    if (userRole.isAdmin) {
      permissions.push('admin:all', 'creator:all', 'fan:all');
    } else if (userRole.isCreator) {
      permissions.push('creator:manage', 'creator:earnings', 'creator:analytics', 'fan:all');
    } else {
      permissions.push('fan:all');
    }

    // Return unified session object
    return res.json({
      success: true,
      session: {
        userId: userRole.id,
        email: userRole.email,
        username: userRole.username,
        role: userRole.primaryRole, // "creator" | "fan" | "admin"
        is_creator: userRole.isCreator,
        is_admin: userRole.isAdmin,
        permissions,
        role_version: 1, // Increment this when role changes
        user: {
          id: userRole.id,
          email: userRole.email,
          username: userRole.username
        }
      }
    });
  } catch (error) {
    console.error('Error getting session:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get session'
    });
  }
});

// Export router and middleware for backward compatibility
module.exports = router;
module.exports.verifySupabaseToken = authenticateToken; // Alias for migration