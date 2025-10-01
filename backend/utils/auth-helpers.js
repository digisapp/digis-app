/**
 * Auth helper utilities for consistent user ID retrieval and validation
 */

/**
 * Get the canonical user ID (supabase_id) from request
 * This ensures consistent ID usage across all routes
 * @param {Object} req - Express request object
 * @returns {string|null} - The supabase_id or null if not found
 */
const getUserId = (req) => {
  // Priority order: supabase_id > uid > sub > id
  // Always return the supabase_id for consistency
  return req.user?.supabase_id ||
         req.user?.uid ||
         req.user?.sub ||
         (req.user?.id && typeof req.user.id === 'string' ? req.user.id : null);
};

/**
 * Get the internal database user ID (integer)
 * Only use when you specifically need the internal ID for legacy FK constraints
 * @param {Object} req - Express request object
 * @returns {number|null} - The internal database ID or null
 */
const getInternalUserId = (req) => {
  if (req.user?.id && typeof req.user.id === 'number') {
    return req.user.id;
  }
  if (req.user?.internal_id) {
    return req.user.internal_id;
  }
  return null;
};

/**
 * Check if user is authenticated
 * @param {Object} req - Express request object
 * @returns {boolean} - True if user is authenticated
 */
const isAuthenticated = (req) => {
  return !!(req.user && getUserId(req));
};

/**
 * Check if user is a creator
 * @param {Object} user - User object from request
 * @returns {boolean} - True if user is a creator
 */
const isCreator = (user) => {
  return !!(user && (user.is_creator || user.role === 'creator' || user.role === 'admin'));
};

/**
 * Check if user is an admin
 * @param {Object} user - User object from request
 * @returns {boolean} - True if user is an admin
 */
const isAdmin = (user) => {
  return !!(user && (user.is_super_admin || user.role === 'admin'));
};

/**
 * Validate and sanitize user ID
 * @param {string} userId - User ID to validate
 * @returns {string|null} - Valid UUID or null
 */
const validateUserId = (userId) => {
  if (!userId) return null;

  // Basic UUID v4 validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (typeof userId === 'string' && uuidRegex.test(userId)) {
    return userId.toLowerCase();
  }

  return null;
};

/**
 * Get user details for response (sanitized)
 * Removes sensitive fields before sending to client
 * @param {Object} user - User object
 * @returns {Object} - Sanitized user object
 */
const sanitizeUserForResponse = (user) => {
  if (!user) return null;

  const {
    password,
    password_hash,
    refresh_token_version,
    last_token_refresh,
    stripe_customer_id,
    stripe_connect_account_id,
    ...safeUser
  } = user;

  return safeUser;
};

module.exports = {
  getUserId,
  getInternalUserId,
  isAuthenticated,
  isCreator,
  isAdmin,
  validateUserId,
  sanitizeUserForResponse
};