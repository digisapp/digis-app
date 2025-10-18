/**
 * Unified Auth Store - Single Source of Truth for Authentication & Role
 *
 * This store implements a strict 3-state pattern to prevent role flip-flopping:
 * - idle: No auth attempt yet
 * - loading: Fetching session from backend
 * - ready: Session loaded, role is authoritative
 *
 * CRITICAL: Never render the app until authStatus === "ready"
 *
 * Race Condition Protection:
 * - Uses sequence numbers to prevent stale responses from overwriting newer ones
 * - Persists last-known role to localStorage (never downgrades on transient errors)
 * - Normalizes backend response format (supports both legacy and new formats)
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  normalizeSession,
  getLastKnownRole,
  getLastKnownUserId,
  persistRoleHint,
  clearRoleHints
} from '../utils/normalizeSession';

// Race condition guard: only the latest request can update state
let requestSeq = 0;

const useAuthStore = create(
  devtools(
    (set, get) => ({
      // ============================================
      // STATE - 3-State Pattern
      // ============================================
      authStatus: 'idle', // "idle" | "loading" | "ready"
      role: null, // "creator" | "fan" | "admin" | null
      user: null, // { id, email, username }
      permissions: [],
      roleVersion: 0,
      error: null,

      // ============================================
      // ACTIONS
      // ============================================

      /**
       * Start loading session
       */
      setAuthLoading: () => {
        console.log('🔐 [Auth] Setting loading state');
        set({ authStatus: 'loading', error: null });
      },

      /**
       * Set session after successful fetch (ONLY way to set role)
       */
      setSession: ({ role, user, permissions = [], roleVersion = 0 }) => {
        console.log('🔐 [Auth] Session loaded:', {
          role,
          email: user?.email,
          roleVersion
        });

        set({
          authStatus: 'ready',
          role,
          user,
          permissions,
          roleVersion,
          error: null
        });
      },

      /**
       * Set error state
       */
      setAuthError: (error) => {
        console.error('🔐 [Auth] Error:', error);
        set({
          authStatus: 'ready', // Still ready, but with no session (guest)
          role: 'fan', // Default to fan for unauthenticated users
          user: null,
          permissions: [],
          error
        });
      },

      /**
       * Clear session (logout)
       */
      clearSession: () => {
        console.log('🔐 [Auth] Clearing session');
        clearRoleHints(); // Clear persisted role hints
        set({
          authStatus: 'idle',
          role: null,
          user: null,
          permissions: [],
          roleVersion: 0,
          error: null
        });
      },

      /**
       * Force role upgrade (use when user becomes creator)
       * This should trigger a token refresh from the backend
       */
      upgradeRole: async (newRole) => {
        const currentVersion = get().roleVersion;
        console.log('🔐 [Auth] Upgrading role:', {
          from: get().role,
          to: newRole,
          version: currentVersion + 1
        });

        // Optimistically update
        set((state) => ({
          role: newRole,
          roleVersion: state.roleVersion + 1
        }));

        // Trigger session refresh to get new JWT
        try {
          await get().refreshSession();
        } catch (error) {
          console.error('🔐 [Auth] Failed to refresh session after upgrade:', error);
        }
      },

      /**
       * Refresh session from backend
       */
      refreshSession: async () => {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_BACKEND_URL}/auth/session`,
            {
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );

          if (!response.ok) {
            throw new Error(`Session fetch failed: ${response.status}`);
          }

          const data = await response.json();

          if (data.success && data.session) {
            get().setSession({
              role: data.session.role,
              user: data.session.user,
              permissions: data.session.permissions,
              roleVersion: data.session.role_version
            });
          } else {
            throw new Error('Invalid session response');
          }
        } catch (error) {
          console.error('🔐 [Auth] Refresh failed:', error);
          throw error;
        }
      },

      /**
       * Bootstrap auth on app load with race condition protection
       */
      bootstrap: async (token) => {
        const mySeq = ++requestSeq;
        console.log('🔐 [Auth] Bootstrapping... (seq:', mySeq, ', hasToken:', !!token, ')');
        get().setAuthLoading();

        // If no token, use last-known role immediately (no API call needed)
        if (!token) {
          console.log('🔐 [Auth] No token, using last-known role from localStorage');
          const lastRole = getLastKnownRole();
          const lastUserId = getLastKnownUserId();

          set({
            authStatus: 'ready',
            role: lastRole,
            user: lastUserId ? { id: lastUserId } : null,
            permissions: [],
            error: null
          });
          return;
        }

        try {
          // 1) Sync user first (idempotent, tolerate failures)
          try {
            await fetch(`${import.meta.env.VITE_BACKEND_URL}/auth/sync-user`, {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
          } catch (syncError) {
            console.warn('🔐 [Auth] Sync-user failed (tolerated):', syncError);
          }

          // 2) Fetch session
          const url = `${import.meta.env.VITE_BACKEND_URL}/auth/session`;
          console.log('🔐 [Auth] Fetching from:', url);

          const response = await fetch(url, {
            credentials: 'include',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          // RACE GUARD: Stop if this response is stale
          if (mySeq !== requestSeq) {
            console.warn('🔐 [Auth] Stale response detected, ignoring (seq:', mySeq, 'current:', requestSeq, ')');
            return;
          }

          console.log('🔐 [Auth] Response status:', response.status);

          if (!response.ok) {
            throw new Error(`Session fetch failed: ${response.status}`);
          }

          const data = await response.json();
          console.log('🔐 [Auth] Raw session data:', data);

          // 3) Normalize the response (handles both formats)
          const normalized = normalizeSession(data);
          if (!normalized) {
            throw new Error('Invalid session payload');
          }

          console.log('🔐 [Auth] Normalized session:', normalized);

          // 4) Persist last-known role and user (prevents downgrade on future errors)
          persistRoleHint(normalized.role, normalized.user.id);

          // 5) Update store with normalized data
          get().setSession({
            role: normalized.role,
            user: normalized.user,
            permissions: normalized.permissions || [],
            roleVersion: 1
          });

          console.log('🔐 [Auth] Bootstrap complete with role:', normalized.role);
        } catch (error) {
          // RACE GUARD: Stop if this error handler is stale
          if (mySeq !== requestSeq) {
            console.warn('🔐 [Auth] Stale error handler, ignoring');
            return;
          }

          console.error('🔐 [Auth] Bootstrap failed:', error);

          // DON'T DOWNGRADE ROLE ON TRANSIENT ERRORS
          // Use last-known role from localStorage as fallback
          const lastRole = getLastKnownRole();
          const lastUserId = getLastKnownUserId();

          console.warn('🔐 [Auth] Using last-known role:', lastRole);

          get().setAuthError(String(error?.message || error));

          // Still mark as ready with last-known role (prevents infinite loading)
          set({
            authStatus: 'ready',
            role: lastRole,
            user: lastUserId ? { id: lastUserId } : null,
            permissions: [],
            error: String(error?.message || error)
          });

          // Schedule silent retry (optional, helps recover from transient failures)
          setTimeout(() => {
            if (mySeq === requestSeq) {
              console.log('🔐 [Auth] Retrying bootstrap after error...');
              get().bootstrap(token);
            }
          }, 2500);
        }
      },

      // ============================================
      // COMPUTED / HELPERS
      // ============================================

      isCreator: () => {
        const state = get();
        return state.role === 'creator' || state.role === 'admin';
      },

      isAdmin: () => {
        const state = get();
        return state.role === 'admin';
      },

      hasPermission: (permission) => {
        const state = get();
        return state.permissions.includes(permission);
      },

      isReady: () => {
        const state = get();
        return state.authStatus === 'ready';
      }
    }),
    { name: 'AuthStore' }
  )
);

export default useAuthStore;
