/**
 * Unified Auth Store - Single Source of Truth for Authentication & Role
 *
 * This store implements a strict 3-state pattern to prevent role flip-flopping:
 * - idle: No auth attempt yet
 * - loading: Fetching session from backend
 * - ready: Session loaded, role is authoritative
 *
 * CRITICAL: Never render the app until authStatus === "ready"
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

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
            `${import.meta.env.VITE_BACKEND_URL}/api/auth/session`,
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
       * Bootstrap auth on app load
       */
      bootstrap: async (token) => {
        console.log('🔐 [Auth] Bootstrapping...');
        get().setAuthLoading();

        try {
          const url = `${import.meta.env.VITE_BACKEND_URL}/api/auth/session`;
          console.log('🔐 [Auth] Fetching from:', url);
          console.log('🔐 [Auth] Token preview:', token?.substring(0, 20) + '...');

          const response = await fetch(url, {
            credentials: 'include',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          console.log('🔐 [Auth] Response status:', response.status);

          if (!response.ok) {
            const errorText = await response.text();
            console.error('🔐 [Auth] Session fetch failed:', {
              status: response.status,
              error: errorText
            });
            // Not authenticated - default to fan
            get().setAuthError(`Not authenticated (${response.status})`);
            return;
          }

          const data = await response.json();
          console.log('🔐 [Auth] Session data:', data);

          if (data.success && data.session) {
            console.log('🔐 [Auth] Setting session with role:', data.session.role);
            get().setSession({
              role: data.session.role,
              user: data.session.user,
              permissions: data.session.permissions,
              roleVersion: data.session.role_version
            });
          } else {
            console.error('🔐 [Auth] Invalid session response:', data);
            get().setAuthError('Invalid session');
          }
        } catch (error) {
          console.error('🔐 [Auth] Bootstrap failed:', error);
          get().setAuthError(error.message);
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
