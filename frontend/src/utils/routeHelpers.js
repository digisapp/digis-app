/**
 * Single source of truth for role-based routing
 * Prevents redirect conflicts between login callbacks, root routes, and component effects
 */

import { addBreadcrumb } from '../lib/sentry.client';

/**
 * Valid role types
 * @typedef {'admin' | 'creator' | 'fan'} Role
 */

/**
 * Type guard for role validation
 * @param {unknown} x - Value to check
 * @returns {x is Role} True if value is a valid role
 */
export const isRole = (x) => {
  return x === 'admin' || x === 'creator' || x === 'fan';
};

/**
 * Normalize path for comparison (remove trailing slash, ignore query strings)
 */
const normalizePath = (path) => {
  if (!path) return '/';
  // Remove query string and hash
  const pathOnly = path.split('?')[0].split('#')[0];
  // Remove trailing slash (except for root)
  return pathOnly === '/' ? '/' : pathOnly.replace(/\/$/, '');
};

/**
 * Get the default landing path for a given role
 * @param {string} role - The user's role ('admin' | 'creator' | 'fan' | null)
 * @returns {string} The default path for this role
 */
export const defaultPathFor = (role) => {
  // Defensive: normalize role casing (in case upstream sends unexpected casing)
  const safeRole = typeof role === 'string' ? role.toLowerCase() : role;
  const targetPath = safeRole === 'admin' ? '/admin' : safeRole === 'creator' ? '/dashboard' : '/explore';

  // Redirect throttle: No-op if already on target path (prevents loops)
  // Normalize paths to handle trailing slashes and query strings
  if (typeof window !== 'undefined') {
    const currentPath = normalizePath(window.location.pathname);
    const normalizedTarget = normalizePath(targetPath);

    if (currentPath === normalizedTarget) {
      return targetPath; // Already there, don't redirect
    }

    // Only log successful redirects where from !== to (reduces noise)
    const debugEnabled = import.meta.env.VITE_DEBUG_UI === 'true' || process.env.NODE_ENV !== 'production';
    const eventData = {
      event: 'role_redirect',
      from: currentPath,
      to: normalizedTarget,
      role: safeRole
    };

    if (debugEnabled) {
      console.log('🧭 Role redirect:', eventData);
    } else {
      // Production: Send to Sentry as breadcrumb only for actual redirects
      addBreadcrumb('role_redirect', {
        category: 'navigation',
        level: 'info',
        ...eventData
      });
    }
  }

  // Validate role
  // INTENTIONAL: Null/undefined role defaults to 'fan' (guest/unauthenticated users)
  // This ensures graceful fallback for edge cases where role hasn't loaded yet
  if (safeRole && !isRole(safeRole)) {
    if (debugEnabled) {
      console.warn('⚠️ Invalid role detected in defaultPathFor:', role, 'falling back to fan');
    } else {
      // Production: Send to Sentry as breadcrumb
      addBreadcrumb('invalid_role', {
        category: 'auth',
        level: 'warning',
        event: 'invalid_role',
        role: safeRole,
        originalRole: role, // Include original for debugging casing issues
        fallback: 'explore'
      });
    }
    return '/explore';
  }

  return targetPath;
};

/**
 * Check if a role is resolved and valid
 * @param {boolean} roleResolved - Whether the role has been resolved from backend
 * @param {string|null} role - The resolved role value
 * @returns {boolean} True if role is ready to use for routing
 */
export const isRoleReady = (roleResolved, role) => {
  return roleResolved && typeof role === 'string';
};
