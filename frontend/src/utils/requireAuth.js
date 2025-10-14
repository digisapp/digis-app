/**
 * requireAuth - Soft auth helper for public pages
 *
 * Checks for a valid Supabase session (not profile) to determine if user is authenticated.
 * This prevents logged-in users from being bounced to sign-up when profile is temporarily null.
 *
 * Pattern:
 * - Check session (fast, reliable) not profile (slow, can fail)
 * - If no session → open auth modal with intent tracking
 * - If session exists → execute authenticated action with automatic token refresh
 *
 * Usage:
 * ```js
 * const requireAuth = useRequireAuth();
 *
 * <button onClick={() => requireAuth('follow', async (session) => {
 *   await followCreator(username, session.access_token);
 * })}>
 *   Follow
 * </button>
 * ```
 */

import { supabase } from './supabase-auth';
import { addBreadcrumb } from '../lib/sentry.client';

/**
 * Check if user has a valid session (authentication check only)
 * @returns {Promise<object|null>} Session object or null
 */
export async function getSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error getting session:', error);
      return null;
    }
    return session;
  } catch (error) {
    console.error('Session check failed:', error);
    return null;
  }
}

/**
 * Fetch with automatic token refresh on 401
 * @param {string} url - API endpoint
 * @param {object} init - fetch init options (method, headers, body, etc.)
 * @returns {Promise<Response>}
 */
export async function authedFetch(url, init = {}) {
  const session = await getSession();

  const doFetch = (token) => fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  // First attempt with current token
  let response = await doFetch(session?.access_token || '');

  // If 401, refresh token and retry once
  if (response.status === 401) {
    console.log('🔄 Token expired, refreshing...');

    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;

      if (data?.session?.access_token) {
        console.log('✅ Token refreshed, retrying request');
        response = await doFetch(data.session.access_token);
      }
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      // Return original 401 response
    }
  }

  return response;
}

/**
 * Hook for requiring authentication before actions
 * Returns a function that checks session and either executes action or shows auth modal
 *
 * @param {Function} openAuthModal - Callback to open sign-up/sign-in modal
 * @param {object} context - Additional context for breadcrumb tracking (e.g., creatorUsername, page)
 * @returns {Function} requireAuth function
 */
export function useRequireAuth(openAuthModal, context = {}) {
  /**
   * Require authentication before executing an action
   *
   * @param {string} action - Intent/action name for tracking (e.g., 'follow', 'tip', 'message')
   * @param {Function} onAuthenticated - Callback to execute if authenticated, receives (session)
   * @param {object} data - Additional data for breadcrumb tracking
   * @returns {Promise<boolean>} true if action was executed, false if auth required
   */
  return async function requireAuth(action, onAuthenticated, data = {}) {
    const session = await getSession();

    if (!session) {
      // Track auth wall for analytics
      addBreadcrumb({
        category: 'auth',
        level: 'info',
        message: 'Auth wall shown',
        data: {
          action,
          ...context,
          ...data
        }
      });

      // Open auth modal with intent to return after login
      openAuthModal({
        intent: action,
        returnTo: window.location.pathname,
        ...data
      });

      return false;
    }

    // User is authenticated, execute action
    try {
      await onAuthenticated(session);
      return true;
    } catch (error) {
      console.error(`Error executing authenticated action '${action}':`, error);

      // If it's an auth error (401/403), show auth modal
      if (error.response?.status === 401 || error.response?.status === 403) {
        openAuthModal({
          intent: action,
          returnTo: window.location.pathname,
          error: 'Session expired. Please sign in again.'
        });
        return false;
      }

      // Re-throw non-auth errors for caller to handle
      throw error;
    }
  };
}

/**
 * Simple version without React hook - for use in class components or outside React
 *
 * @param {string} action - Intent/action name
 * @param {Function} onAuthenticated - Callback if authenticated
 * @param {Function} onUnauthenticated - Callback if not authenticated
 * @param {object} context - Context for tracking
 * @returns {Promise<boolean>}
 */
export async function requireAuthSimple(action, onAuthenticated, onUnauthenticated, context = {}) {
  const session = await getSession();

  if (!session) {
    addBreadcrumb({
      category: 'auth',
      level: 'info',
      message: 'Auth wall shown',
      data: { action, ...context }
    });

    await onUnauthenticated();
    return false;
  }

  try {
    await onAuthenticated(session);
    return true;
  } catch (error) {
    console.error(`Error in authenticated action '${action}':`, error);

    if (error.response?.status === 401 || error.response?.status === 403) {
      await onUnauthenticated();
      return false;
    }

    throw error;
  }
}

export default {
  getSession,
  authedFetch,
  useRequireAuth,
  requireAuthSimple
};
