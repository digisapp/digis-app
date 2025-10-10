const pool = require('../utils/db');
const { supabaseAdmin } = require('../utils/supabase-admin');

/**
 * Role Verification Middleware
 * Ensures users can only access resources appropriate to their role
 * Prevents any role switching or unauthorized access
 */

// Cache user roles for performance (5 minute TTL)
const roleCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get user role from database with caching
 */
async function getUserRole(supabaseId) {
  // Check cache first
  const cached = roleCache.get(supabaseId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    // Query database for user role and profile data
    const query = `
      SELECT
        supabase_id as id,
        email,
        is_creator,
        is_super_admin as is_admin,
        role,
        username,
        display_name,
        profile_pic_url,
        bio,
        creator_type,
        verified
      FROM users
      WHERE supabase_id = $1
      LIMIT 1
    `;
    
    const result = await pool.query(query, [supabaseId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const user = result.rows[0];
    const roleData = {
      id: user.id,
      supabaseId: user.id,  // Using id as supabaseId since we're querying by Supabase user ID
      email: user.email,
      isCreator: user.is_creator === true,
      isAdmin: user.is_admin === true || user.role === 'admin',
      role: user.role,
      username: user.username,
      display_name: user.display_name,
      profile_pic_url: user.profile_pic_url,
      bio: user.bio,
      creator_type: user.creator_type,
      verified: user.verified,
      // Determine primary role
      primaryRole: user.is_admin || user.role === 'admin'
        ? 'admin'
        : user.is_creator
        ? 'creator'
        : 'fan'
    };
    
    // Cache the result
    roleCache.set(supabaseId, {
      data: roleData,
      timestamp: Date.now()
    });
    
    return roleData;
  } catch (error) {
    console.error('Error fetching user role:', error);
    throw error;
  }
}

/**
 * Clear role cache for a specific user
 */
function clearRoleCache(supabaseId) {
  roleCache.delete(supabaseId);
}

/**
 * Clear entire role cache
 */
function clearAllRoleCache() {
  roleCache.clear();
}

/**
 * Verify user has required role
 */
async function verifyRole(req, res, next) {
  try {
    // Get user from request (set by auth middleware) - prefer supabase_id
    const userId = req.user?.supabase_id || req.user?.id || req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Get user role from database using supabase_id
    const userRole = await getUserRole(userId);
    
    if (!userRole) {
      return res.status(403).json({
        success: false,
        error: 'User not found or access denied'
      });
    }
    
    // Attach role data to request
    req.userRole = userRole;
    req.isCreator = userRole.isCreator;
    req.isAdmin = userRole.isAdmin;
    req.primaryRole = userRole.primaryRole;
    
    next();
  } catch (error) {
    console.error('Role verification error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify user role'
    });
  }
}

/**
 * Middleware to require creator role
 */
async function requireCreator(req, res, next) {
  try {
    await verifyRole(req, res, () => {
      if (!req.isCreator && !req.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Creator access required'
        });
      }
      next();
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to verify creator role'
    });
  }
}

/**
 * Middleware to require admin role
 */
async function requireAdmin(req, res, next) {
  try {
    await verifyRole(req, res, () => {
      if (!req.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }
      next();
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to verify admin role'
    });
  }
}

/**
 * Middleware to require fan (non-creator) role
 */
async function requireFan(req, res, next) {
  try {
    await verifyRole(req, res, () => {
      // Fans can access, creators can access (they might want to purchase), but not admins in admin mode
      if (req.primaryRole === 'admin' && !req.query.viewAs) {
        return res.status(403).json({
          success: false,
          error: 'This feature is for fans and creators only'
        });
      }
      next();
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to verify fan role'
    });
  }
}

/**
 * Get verified user role for frontend
 * This endpoint is crucial for frontend role determination
 */
async function getVerifiedRole(req, res) {
  try {
    const userId = req.user?.id || req.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    // Force fresh fetch from database (no cache)
    roleCache.delete(userId);
    const userRole = await getUserRole(userId);
    
    if (!userRole) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Return role information
    return res.json({
      success: true,
      role: {
        primaryRole: userRole.primaryRole,
        isCreator: userRole.isCreator,
        isAdmin: userRole.isAdmin,
        email: userRole.email,
        username: userRole.username
      }
    });
  } catch (error) {
    console.error('Error getting verified role:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get user role'
    });
  }
}

module.exports = {
  verifyRole,
  requireCreator,
  requireAdmin,
  requireFan,
  getVerifiedRole,
  getUserRole,
  clearRoleCache,
  clearAllRoleCache
};