/**
 * Role Verification Utility
 * Ensures consistent and secure role management across the application
 *
 * IMPORTANT: Uses /auth/session as single source of truth
 * No separate /auth/verify-role endpoint - reduces API calls and prevents inconsistency
 */

import React from 'react';
import { supabase } from './supabase-auth';
import { apiClient } from './apiClient';
import { normalizeSession, persistRoleHint } from './normalizeSession';

// Role constants
export const ROLES = {
  ADMIN: 'admin',
  CREATOR: 'creator',
  FAN: 'fan'
};

// Cache for verified role
let verifiedRoleCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Verify user role with backend using session endpoint
 * This is the single source of truth for user roles
 *
 * NOTE: This function uses the same /auth/session endpoint as authSync.js
 * to ensure consistency. No separate /auth/verify-role endpoint is needed.
 */
export async function verifyUserRole(forceRefresh = false) {
  try {
    // Check cache if not forcing refresh
    if (!forceRefresh && verifiedRoleCache && cacheTimestamp) {
      const cacheAge = Date.now() - cacheTimestamp;
      if (cacheAge < CACHE_DURATION) {
        console.log('[RoleVerification] Using cached role');
        return verifiedRoleCache;
      }
    }

    // Get current session
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      clearRoleCache();
      return null;
    }

    // Use /auth/session as single source of truth (prevents inconsistency)
    // This matches authSync.js for consistency
    try {
      const data = await apiClient.get('/auth/session', {
        withAuth: true
      });

      // Normalize the response (handles both formats)
      const normalized = normalizeSession(data);

      if (!normalized) {
        clearRoleCache();
        return null;
      }

      // Build role object for backward compatibility
      const roleData = {
        primaryRole: normalized.role,
        isCreator: normalized.isCreator,
        isAdmin: normalized.isAdmin,
        email: normalized.user.email,
        username: normalized.user.username
      };

      // Cache the verified role
      verifiedRoleCache = roleData;
      cacheTimestamp = Date.now();

      // Store in sessionStorage as backup
      sessionStorage.setItem('verifiedRole', JSON.stringify(roleData));
      sessionStorage.setItem('roleTimestamp', Date.now().toString());

      // Persist to localStorage for race condition protection
      persistRoleHint(normalized.role, normalized.user.id);

      return roleData;
    } catch (apiError) {
      console.error('Failed to verify role with API:', apiError);

      // Try to get from sessionStorage as fallback
      const cachedRole = sessionStorage.getItem('verifiedRole');
      const cachedTimestamp = sessionStorage.getItem('roleTimestamp');

      if (cachedRole && cachedTimestamp) {
        const age = Date.now() - parseInt(cachedTimestamp);
        if (age < CACHE_DURATION) {
          console.warn('Using cached role due to API error');
          return JSON.parse(cachedRole);
        }
      }

      clearRoleCache();
      return null;
    }
  } catch (error) {
    console.error('Error verifying user role:', error);

    // Try to get from sessionStorage as fallback
    const cachedRole = sessionStorage.getItem('verifiedRole');
    const cachedTimestamp = sessionStorage.getItem('roleTimestamp');

    if (cachedRole && cachedTimestamp) {
      const age = Date.now() - parseInt(cachedTimestamp);
      if (age < CACHE_DURATION) {
        console.warn('Using cached role due to error');
        return JSON.parse(cachedRole);
      }
    }

    clearRoleCache();
    return null;
  }
}

/**
 * Clear role cache
 */
export function clearRoleCache() {
  verifiedRoleCache = null;
  cacheTimestamp = null;
  sessionStorage.removeItem('verifiedRole');
  sessionStorage.removeItem('roleTimestamp');
}

/**
 * Check if user is creator
 */
export async function isUserCreator() {
  const role = await verifyUserRole();
  return role?.isCreator === true || role?.primaryRole === ROLES.CREATOR;
}

/**
 * Check if user is admin
 */
export async function isUserAdmin() {
  const role = await verifyUserRole();
  return role?.isAdmin === true || role?.primaryRole === ROLES.ADMIN;
}

/**
 * Check if user is fan
 */
export async function isUserFan() {
  const role = await verifyUserRole();
  return role?.primaryRole === ROLES.FAN;
}

/**
 * Get user's primary role
 */
export async function getUserPrimaryRole() {
  const role = await verifyUserRole();
  return role?.primaryRole || null;
}

/**
 * Route guard for role-based access
 */
export async function canAccessRoute(requiredRole) {
  const role = await verifyUserRole();
  
  if (!role) {
    return false;
  }

  switch (requiredRole) {
    case ROLES.ADMIN:
      return role.isAdmin === true;
    case ROLES.CREATOR:
      return role.isCreator === true || role.isAdmin === true;
    case ROLES.FAN:
      return true; // All authenticated users can access fan routes
    default:
      return false;
  }
}

/**
 * Sync user role on auth state change
 */
export async function syncUserRole() {
  // Force refresh to get latest role from backend
  // This calls /auth/session which is already the source of truth
  const role = await verifyUserRole(true);

  if (role) {
    console.log('🔐 [RoleVerification] Synced role:', role.primaryRole);
  }

  return role;
}

/**
 * Protected route wrapper
 * Use this to wrap components that require specific roles
 */
export function withRoleProtection(Component, requiredRole) {
  return function ProtectedComponent(props) {
    const [hasAccess, setHasAccess] = React.useState(false);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
      async function checkAccess() {
        const canAccess = await canAccessRoute(requiredRole);
        setHasAccess(canAccess);
        setLoading(false);
      }
      checkAccess();
    }, []);

    if (loading) {
      return <div>Verifying access...</div>;
    }

    if (!hasAccess) {
      return <div>Access denied. You do not have permission to view this page.</div>;
    }

    return <Component {...props} />;
  };
}

/**
 * Singleton Auth Watcher
 * Prevents duplicate Supabase auth subscriptions
 */
let _roleWatcherSubscribed = false;

/**
 * Start the role watcher exactly once
 * Subsequent calls return a no-op unsubscribe function
 *
 * @param {Function} startFn - Function that installs the auth listener and returns unsubscribe
 * @returns {Function} Unsubscribe function
 */
export function startRoleWatcherOnce(startFn) {
  if (_roleWatcherSubscribed) {
    console.log('[RoleWatcher] Already subscribed, skipping');
    return () => {}; // no-op unsubscribe
  }

  console.log('[RoleWatcher] Installing singleton auth watcher');
  _roleWatcherSubscribed = true;
  return startFn();
}

/**
 * Install auth state change watcher
 * This should only be called via startRoleWatcherOnce from AuthProvider
 *
 * @param {Object} supabase - Supabase client
 * @param {Function} onAuthEvent - Callback for auth events
 * @returns {Object} Subscription object with unsubscribe method
 */
export function installAuthWatcher(supabase, onAuthEvent) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    console.log(`[RoleWatcher] Auth event: ${event}`);
    onAuthEvent(event, session);
  });

  return data.subscription;
}