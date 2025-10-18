/**
 * Role Verification Utility
 * Ensures consistent and secure role management across the application
 */

import React from 'react';
import { supabase } from './supabase-auth';

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
 * Verify user role with backend
 * This is the single source of truth for user roles
 */
export async function verifyUserRole(forceRefresh = false) {
  try {
    // Check cache if not forcing refresh
    if (!forceRefresh && verifiedRoleCache && cacheTimestamp) {
      const cacheAge = Date.now() - cacheTimestamp;
      if (cacheAge < CACHE_DURATION) {
        return verifiedRoleCache;
      }
    }

    // Get current session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      clearRoleCache();
      return null;
    }

    // Verify role with backend
    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_URL}/auth/verify-role`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to verify role:', response.status);
      clearRoleCache();
      return null;
    }

    const data = await response.json();
    
    if (data.success && data.role) {
      // Cache the verified role
      verifiedRoleCache = data.role;
      cacheTimestamp = Date.now();
      
      // Store in sessionStorage as backup
      sessionStorage.setItem('verifiedRole', JSON.stringify(data.role));
      sessionStorage.setItem('roleTimestamp', Date.now().toString());
      
      return data.role;
    }

    clearRoleCache();
    return null;
  } catch (error) {
    console.error('Error verifying user role:', error);
    
    // Try to get from sessionStorage as fallback
    const cachedRole = sessionStorage.getItem('verifiedRole');
    const cachedTimestamp = sessionStorage.getItem('roleTimestamp');
    
    if (cachedRole && cachedTimestamp) {
      const age = Date.now() - parseInt(cachedTimestamp);
      if (age < CACHE_DURATION) {
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
  const role = await verifyUserRole(true);
  
  if (role) {
    // Notify backend to clear any server-side cache
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/auth/clear-role-cache`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );
      }
    } catch (error) {
      console.error('Error clearing role cache:', error);
    }
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

// Auto-sync role on auth state changes
if (typeof window !== 'undefined' && supabase?.auth) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      syncUserRole();
    } else if (event === 'SIGNED_OUT') {
      clearRoleCache();
    }
  });
}