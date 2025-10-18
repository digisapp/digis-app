/**
 * Session Normalizer
 * Accepts both legacy and new backend session formats
 * Prevents schema mismatch issues between frontend and backend
 */

/**
 * @typedef {Object} NormalizedSession
 * @property {'creator'|'fan'|'admin'} role - Primary role
 * @property {boolean} isCreator - Creator flag
 * @property {boolean} [isAdmin] - Admin flag
 * @property {Object} user - User object
 * @property {string} user.id - User ID
 * @property {string|number} [user.dbId] - Database ID
 * @property {string|null} [user.email] - Email
 * @property {string|null} [user.username] - Username
 * @property {string[]} [permissions] - Permissions array
 */

/**
 * Normalize session payload from backend
 * Accepts legacy {ok:true, user:{...}} or new {success:true, session:{...}}
 *
 * @param {any} payload - Raw backend response
 * @returns {NormalizedSession|null} - Normalized session or null if invalid
 */
export function normalizeSession(payload) {
  try {
    if (!payload) return null;

    // New shape: {success: true, session: {...}}
    if (payload.success && payload.session) {
      const s = payload.session;
      const role = s.role || (s.isCreator ? 'creator' : 'fan');

      return {
        role,
        isCreator: !!s.isCreator || role === 'creator',
        isAdmin: !!s.isAdmin || role === 'admin',
        user: {
          id: s.user?.id ?? s.user?.supabaseId ?? s.supabaseId,
          dbId: s.user?.dbId ?? s.dbId,
          email: s.user?.email ?? null,
          username: s.user?.username ?? null,
        },
        permissions: s.permissions || [],
      };
    }

    // Legacy shape: {ok: true, user: {...}}
    if (payload.ok && payload.user) {
      const u = payload.user;
      const role = (Array.isArray(u.roles) && u.roles[0])
        ? u.roles[0]
        : (u.isCreator ? 'creator' : 'fan');

      return {
        role,
        isCreator: !!u.isCreator || role === 'creator',
        isAdmin: !!u.isAdmin || role === 'admin',
        user: {
          id: u.supabaseId || u.id,
          dbId: u.dbId,
          email: u.email ?? null,
          username: u.username ?? null,
        },
        permissions: u.permissions || [],
      };
    }

    return null;
  } catch (error) {
    console.error('Session normalization error:', error);
    return null;
  }
}

/**
 * Get last known role from localStorage
 * @returns {string} - Last known role (defaults to 'fan')
 */
export function getLastKnownRole() {
  try {
    return localStorage.getItem('roleHint') || 'fan';
  } catch {
    return 'fan';
  }
}

/**
 * Get last known user ID from localStorage
 * @returns {string|null} - Last known user ID
 */
export function getLastKnownUserId() {
  try {
    return localStorage.getItem('userId') || null;
  } catch {
    return null;
  }
}

/**
 * Persist role and user ID to localStorage
 * @param {string} role - Role to persist
 * @param {string} userId - User ID to persist
 */
export function persistRoleHint(role, userId) {
  try {
    localStorage.setItem('roleHint', role);
    localStorage.setItem('userId', userId);
  } catch (error) {
    console.warn('Failed to persist role hint:', error);
  }
}

/**
 * Clear persisted role hints
 */
export function clearRoleHints() {
  try {
    localStorage.removeItem('roleHint');
    localStorage.removeItem('userId');
  } catch (error) {
    console.warn('Failed to clear role hints:', error);
  }
}
