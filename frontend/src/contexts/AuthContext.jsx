import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../utils/supabase-auth';
import { subscribeToAuthChanges } from '../utils/auth-helpers';
import { syncUserRole, clearRoleCache } from '../utils/roleVerification';
import { loadProfileCache, saveProfileCache, clearProfileCache } from '../utils/profileCache';
import useAuthStore from '../stores/useAuthStore';
import { authLogger } from '../utils/logger';
import { isRole } from '../utils/routeHelpers';
import { addBreadcrumb, setTag } from '../lib/sentry.client';
import toast from 'react-hot-toast';
import { fetchWithTimeout, safeFetch } from '../utils/fetchWithTimeout';

/**
 * AuthContext - Single Source of Truth for Authentication
 *
 * Consolidates:
 * - Supabase session management
 * - Profile syncing with backend
 * - Token balance tracking
 * - Role verification (creator/admin/fan)
 * - Profile caching for persistence
 *
 * Replaces duplicate auth logic in App.js and useHybridStore
 */

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const FETCH_THROTTLE_MS = 5000; // 5 seconds between fetches

// Circuit breaker for sync-user failures
const CIRCUIT_BREAKER_DELAYS = [5000, 15000, 60000]; // 5s → 15s → 60s backoff
const CIRCUIT_BREAKER_STORAGE_KEY = 'auth_circuit_breaker_state';

export const AuthProvider = ({ children }) => {
  // State
  const [user, setUser] = useState(null);
  const [profile, setProfileRaw] = useState(null);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [roleResolved, setRoleResolved] = useState(false);

  // Protected setProfile - prevents role downgrade
  const setProfile = useCallback((newProfile) => {
    if (!newProfile) {
      setProfileRaw(newProfile);
      return;
    }

    setProfileRaw((currentProfile) => {
      // CRITICAL: Never downgrade from creator/admin to fan
      if (currentProfile?.is_creator === true && newProfile.is_creator !== true) {
        console.warn('🛡️ Blocked creator→fan downgrade attempt:', {
          current: { username: currentProfile.username, is_creator: currentProfile.is_creator },
          attempted: { username: newProfile.username, is_creator: newProfile.is_creator }
        });
        // Keep existing creator profile, just update token balance if provided
        return {
          ...currentProfile,
          ...(newProfile.token_balance !== undefined ? { token_balance: newProfile.token_balance } : {})
        };
      }

      if (currentProfile?.is_admin === true && newProfile.is_admin !== true) {
        console.warn('🛡️ Blocked admin→fan downgrade attempt:', {
          current: { username: currentProfile.username, is_admin: currentProfile.is_admin },
          attempted: { username: newProfile.username, is_admin: newProfile.is_admin }
        });
        // Keep existing admin profile, just update token balance if provided
        return {
          ...currentProfile,
          ...(newProfile.token_balance !== undefined ? { token_balance: newProfile.token_balance } : {})
        };
      }

      // Safe update - no downgrade detected
      return newProfile;
    });
  }, []);
  const [error, setError] = useState('');

  // Refs for throttling
  const fetchInProgress = useRef({ profile: false, balance: false });
  const lastFetch = useRef({ profile: 0, balance: 0 });

  // Circuit breaker state - persisted in sessionStorage to survive reloads during outages
  // In-memory fallback for Safari private mode or storage-denied scenarios
  const inMemoryCircuitBreaker = useRef({ lastAttempt: 0, backoffIndex: 0, failureCount: 0 });
  const storageAvailable = useRef(true);

  // Load initial state from sessionStorage with fallback
  const loadCircuitBreakerState = () => {
    try {
      const stored = sessionStorage.getItem(CIRCUIT_BREAKER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          lastAttempt: parsed.lastAttempt || 0,
          backoffIndex: parsed.backoffIndex || 0,
          failureCount: parsed.failureCount || 0
        };
      }
    } catch (e) {
      // Storage denied (Safari private mode, quota exceeded, etc.)
      storageAvailable.current = false;
      return inMemoryCircuitBreaker.current; // Use in-memory fallback
    }
    return { lastAttempt: 0, backoffIndex: 0, failureCount: 0 };
  };

  const initialState = loadCircuitBreakerState();
  const syncUserFailureCount = useRef(initialState.failureCount);
  const lastSyncUserAttempt = useRef(initialState.lastAttempt);
  const syncUserBackoffIndex = useRef(initialState.backoffIndex);
  const authSyncFailedLogged = useRef(false); // Only log once per session
  const wasInBackoff = useRef(false); // Track if we were in backoff mode for recovery log

  // Computed values - use canonical role from /api/me (single source of truth)
  const isCreator = profile?.is_creator === true;  // Backend computes this canonically
  const isAdmin = profile?.is_admin === true;      // Backend computes this canonically
  const isAuthenticated = !!user;

  // Canonical role string - simplified to trust backend exclusively
  // Anti-downgrade: once creator/admin, stays that way during session
  const role = useMemo(() => {
    if (profile?.is_admin === true || isAdmin) return 'admin';
    if (profile?.is_creator === true || isCreator) return 'creator';
    return user ? 'fan' : null;
  }, [profile?.is_admin, profile?.is_creator, isAdmin, isCreator, user]);

  // Canonical currentUser - single source of truth for UI components
  // Merges Supabase auth (id, email) with DB profile (username, display_name, role, etc.)
  const currentUser = useMemo(() => {
    // Prefer DB profile fields; fall back to auth user
    if (profile && user) return { ...user, ...profile };
    return profile || user || null;
  }, [user, profile]);

  /**
   * Persist last-known role for debugging only (NEVER READ THIS FOR UI DECISIONS)
   * This is a breadcrumb for troubleshooting, not a source of truth
   */
  useEffect(() => {
    if (profile?.id) {
      const lkr = profile.is_admin ? 'admin' : profile.is_creator ? 'creator' : 'fan';
      try {
        localStorage.setItem('digis:lastKnownRole', lkr);
        console.log('💾 Persisted lastKnownRole (debug only):', lkr);
      } catch (e) {
        // Ignore storage errors
      }
    }
  }, [profile?.id, profile?.is_creator, profile?.is_admin]);

  /**
   * Circuit breaker: Check if we should attempt sync-user based on failure history
   */
  const shouldAttemptSyncUser = useCallback(() => {
    const now = Date.now();
    const backoffDelay = CIRCUIT_BREAKER_DELAYS[Math.min(syncUserBackoffIndex.current, CIRCUIT_BREAKER_DELAYS.length - 1)];
    const timeSinceLastAttempt = now - lastSyncUserAttempt.current;

    if (timeSinceLastAttempt < backoffDelay) {
      console.log(`⏸️ Circuit breaker: Skipping sync-user (backoff: ${backoffDelay}ms, elapsed: ${timeSinceLastAttempt}ms)`);
      return false;
    }

    return true;
  }, []);

  /**
   * Circuit breaker: Record sync-user success (resets backoff)
   */
  const recordSyncUserSuccess = useCallback(() => {
    // Log recovery if we were in backoff
    if (wasInBackoff.current) {
      wasInBackoff.current = false;
      const debugEnabled = import.meta.env.VITE_DEBUG_UI === 'true' || process.env.NODE_ENV !== 'production';
      const eventData = {
        event: 'auth_sync_recovered',
        previousFailureCount: syncUserFailureCount.current,
        timestamp: new Date().toISOString()
      };

      if (debugEnabled) {
        console.log('✅ Auth sync recovered:', eventData);
      } else {
        // Production: Send recovery breadcrumb to close the loop
        addBreadcrumb('auth_sync_recovered', {
          category: 'auth',
          level: 'info',
          ...eventData
        });
      }

      // Emit CustomEvent for dev tools / UI badges
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:circuit', {
          detail: { state: 'ok', previousFailures: syncUserFailureCount.current }
        }));
      }
    }

    syncUserFailureCount.current = 0;
    syncUserBackoffIndex.current = 0;
    authSyncFailedLogged.current = false;

    // Clear sessionStorage on success (with fallback)
    try {
      if (storageAvailable.current) {
        sessionStorage.removeItem(CIRCUIT_BREAKER_STORAGE_KEY);
      } else {
        // Use in-memory fallback
        inMemoryCircuitBreaker.current = { lastAttempt: 0, backoffIndex: 0, failureCount: 0 };
      }
    } catch (e) {
      // Storage still denied - use in-memory
      storageAvailable.current = false;
      inMemoryCircuitBreaker.current = { lastAttempt: 0, backoffIndex: 0, failureCount: 0 };
    }
  }, []);

  /**
   * Circuit breaker: Record sync-user failure (increments backoff)
   */
  const recordSyncUserFailure = useCallback(() => {
    wasInBackoff.current = true; // Track that we entered backoff mode
    syncUserFailureCount.current += 1;
    lastSyncUserAttempt.current = Date.now();

    // Increment backoff index (capped at max delay)
    if (syncUserBackoffIndex.current < CIRCUIT_BREAKER_DELAYS.length - 1) {
      syncUserBackoffIndex.current += 1;
    }

    // Persist circuit breaker state to sessionStorage (survives full reload during outages)
    // With in-memory fallback for Safari private mode
    try {
      if (storageAvailable.current) {
        sessionStorage.setItem(CIRCUIT_BREAKER_STORAGE_KEY, JSON.stringify({
          lastAttempt: lastSyncUserAttempt.current,
          backoffIndex: syncUserBackoffIndex.current,
          failureCount: syncUserFailureCount.current
        }));
      } else {
        // Use in-memory fallback
        inMemoryCircuitBreaker.current = {
          lastAttempt: lastSyncUserAttempt.current,
          backoffIndex: syncUserBackoffIndex.current,
          failureCount: syncUserFailureCount.current
        };
      }
    } catch (e) {
      // Storage denied - switch to in-memory fallback
      storageAvailable.current = false;
      inMemoryCircuitBreaker.current = {
        lastAttempt: lastSyncUserAttempt.current,
        backoffIndex: syncUserBackoffIndex.current,
        failureCount: syncUserFailureCount.current
      };
    }

    // Log telemetry once per session
    if (!authSyncFailedLogged.current) {
      authSyncFailedLogged.current = true;
      const debugEnabled = import.meta.env.VITE_DEBUG_UI === 'true' || process.env.NODE_ENV !== 'production';
      const eventData = {
        event: 'auth_sync_failed',
        failureCount: syncUserFailureCount.current,
        backoffDelay: CIRCUIT_BREAKER_DELAYS[syncUserBackoffIndex.current],
        timestamp: new Date().toISOString()
      };

      if (debugEnabled) {
        console.warn('🔴 Auth sync failed (circuit breaker active):', eventData);
      } else {
        // Production: Send to Sentry as breadcrumb
        addBreadcrumb('auth_sync_failed', {
          category: 'auth',
          level: 'warning',
          ...eventData
        });
      }

      // Emit CustomEvent for dev tools / UI badges
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:circuit', {
          detail: {
            state: 'backoff',
            failureCount: syncUserFailureCount.current,
            backoffDelay: CIRCUIT_BREAKER_DELAYS[syncUserBackoffIndex.current]
          }
        }));
      }
    }
  }, []);

  /**
   * Fetch canonical session from /api/auth/session (SINGLE SOURCE OF TRUTH)
   * This endpoint returns authoritative role directly from database with no caching
   * Returns format compatible with safeFetch for circuit breaker logic
   */
  const fetchCanonicalSession = useCallback(async (session, useTimeout = true) => {
    if (!session?.access_token) {
      return { ok: false, error: 'No access token', data: null };
    }

    try {
      const fetchFn = useTimeout ? fetchWithTimeout : fetch;
      const response = await fetchFn(
        `${import.meta.env.VITE_BACKEND_URL}/api/auth/session`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Cache-Control': 'no-store'
          },
          timeout: 6000 // 6 second timeout
        }
      );

      if (response.ok) {
        const data = await response.json();

        if (!data?.ok || !data?.user) {
          console.error('Invalid session payload:', data);
          return { ok: false, error: 'Invalid payload', data: null };
        }

        console.log('✅ Canonical session fetched from /api/auth/session:', {
          isCreator: data.user.isCreator,
          isAdmin: data.user.isAdmin,
          roles: data.user.roles
        });

        // Return in safeFetch-compatible format with normalized user data
        return {
          ok: true,
          data: {
            user: {
              id: data.user.supabaseId,
              supabase_id: data.user.supabaseId,
              db_id: data.user.dbId,
              is_creator: data.user.isCreator,
              is_admin: data.user.isAdmin,
              roles: data.user.roles || [],
              // Add minimal fields expected by downstream code
              username: session.user.email?.split('@')[0] || 'user',
              email: session.user.email
            }
          },
          status: response.status
        };
      } else {
        console.error('Failed to fetch canonical session:', response.status);
        return { ok: false, error: `HTTP ${response.status}`, status: response.status, data: null };
      }
    } catch (error) {
      console.error('Error fetching canonical session:', error);
      return { ok: false, error: error.message, data: null };
    }
  }, []);

  /**
   * DISABLED: Supabase direct fallback removed due to RLS restrictions
   * RLS policies prevent direct queries without bypassing auth
   * Backend is the single source of truth for user data
   */
  const fetchProfileFromSupabaseDirect = useCallback(async (userId) => {
    console.log('⚠️ Supabase direct fallback disabled - backend is required for auth');
    return null;
  }, []);

  /**
   * Fetch user profile from backend (legacy - kept for token balance)
   */
  const fetchUserProfile = useCallback(async (currentUser = user) => {
    if (!currentUser) return;

    // Throttle
    const now = Date.now();
    if (fetchInProgress.current.profile || now - lastFetch.current.profile < FETCH_THROTTLE_MS) {
      return;
    }

    fetchInProgress.current.profile = true;
    lastFetch.current.profile = now;

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        console.error('No valid session found');
        return;
      }

      const token = session.access_token;
      const userId = session.user.id || currentUser.id;

      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/users/profile?uid=${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Profile fetched:', data.username);
        setProfile(data);
        saveProfileCache(data, session);

        if (data.token_balance !== undefined) {
          setTokenBalance(data.token_balance);
        }
      } else {
        console.error('Failed to fetch profile:', response.status);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      fetchInProgress.current.profile = false;
    }
  }, [user]);

  /**
   * Fetch token balance from backend
   */
  const fetchTokenBalance = useCallback(async (currentUser = user) => {
    if (!currentUser) return;

    // Throttle
    const now = Date.now();
    if (fetchInProgress.current.balance || now - lastFetch.current.balance < FETCH_THROTTLE_MS) {
      return;
    }

    fetchInProgress.current.balance = true;
    lastFetch.current.balance = now;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/tokens/balance`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Token balance fetched:', data.balance);
        setTokenBalance(data.balance || 0);
      }
    } catch (error) {
      console.error('Error fetching token balance:', error);
    } finally {
      fetchInProgress.current.balance = false;
    }
  }, [user]);

  /**
   * Update token balance (for purchases/spending)
   */
  const updateTokenBalance = useCallback((newBalance) => {
    setTokenBalance(newBalance);
  }, []);

  /**
   * Refresh profile data
   */
  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchUserProfile(user);
    }
  }, [user, fetchUserProfile]);

  /**
   * Teardown side effects on logout (prevents "zombie" redirects)
   * Cancels any in-flight operations that might try to navigate
   */
  const teardownOnLogout = useCallback(() => {
    try {
      // Clear any throttling state
      fetchInProgress.current = { profile: false, balance: false };
      lastFetch.current = { profile: 0, balance: 0 };

      // Reset circuit breaker state
      if (storageAvailable.current) {
        try {
          sessionStorage.removeItem(CIRCUIT_BREAKER_STORAGE_KEY);
        } catch (e) {
          // Ignore storage errors
        }
      }
      inMemoryCircuitBreaker.current = { lastAttempt: 0, backoffIndex: 0, failureCount: 0 };
      syncUserFailureCount.current = 0;
      lastSyncUserAttempt.current = 0;
      syncUserBackoffIndex.current = 0;

      // Clear service worker caches (if enabled)
      if ('caches' in window) {
        caches.keys().then(keys => {
          keys.forEach(cacheName => {
            caches.delete(cacheName);
            console.log(`🧹 Deleted cache: ${cacheName}`);
          });
        }).catch(err => {
          console.warn('Cache cleanup warning (non-critical):', err);
        });
      }

      console.log('🧹 Cleanup completed on logout');
    } catch (error) {
      console.error('Teardown error (non-critical):', error);
    }
  }, []);

  /**
   * Sign out
   */
  const signOut = useCallback(async () => {
    try {
      console.log('🔓 Starting sign out process...');

      // Mark page as signed-out to prevent stale tabs from re-authing
      try {
        sessionStorage.setItem('signedOutAt', String(Date.now()));
      } catch (e) {
        // Ignore storage errors (Safari private mode)
      }

      // Teardown side effects before signing out
      teardownOnLogout();

      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setTokenBalance(0);
      clearProfileCache();
      clearRoleCache();
      console.log('✅ Signed out successfully');

      // Return success - navigation will be handled by calling component
      return true;
    } catch (error) {
      console.error('Sign out error:', error);
      setError('Failed to sign out');
      return false;
    }
  }, [teardownOnLogout]);

  /**
   * Initialize authentication on mount
   */
  useEffect(() => {
    let mounted = true;
    let timeoutId;

    const initAuth = async () => {
      // CRITICAL: Hard timeout fallback to prevent infinite loading on slow devices
      // Mobile devices get longer timeout (10s) for slower 3G/4G networks
      const MAX_BOOT_MS = (typeof window !== 'undefined' && window.innerWidth < 768) ? 10000 : 5000;
      const bootTimeout = setTimeout(() => {
        if (mounted) {
          console.warn(`⚠️ Hard auth timeout reached after ${MAX_BOOT_MS / 1000}s - forcing load complete`);
          setAuthLoading(false);
        }
      }, MAX_BOOT_MS);

      // Check if AppBootstrap already authenticated
      const authStoreState = useAuthStore?.getState?.();
      if (authStoreState?.authStatus === 'ready' && authStoreState?.user) {
        console.log('✅ AppBootstrap already authenticated, syncing...');
        setUser({
          id: authStoreState.user.id,
          email: authStoreState.user.email
        });

        // Fetch full profile using canonical session endpoint
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          const result = await fetchCanonicalSession(session);

          if (result.ok && result.data?.user) {
            const userData = result.data.user;

            // Clear signedOutAt flag on successful login
            try {
              sessionStorage.removeItem('signedOutAt');
            } catch (e) {
              // Ignore storage errors
            }

            setProfile(userData);
            saveProfileCache(userData, session);
            if (userData.token_balance !== undefined) {
              setTokenBalance(userData.token_balance);
            }
            setRoleResolved(true); // Mark role as resolved
            setAuthLoading(false);
            clearTimeout(bootTimeout);
            return;
          } else {
            console.warn('⚠️ AppBootstrap session fetch failed (non-blocking):', {
              status: result.status,
              error: result.error
            });
            // Fail open - don't block the app, mark role resolved to unblock ProtectedRoute
            setRoleResolved(true);
            setAuthLoading(false);
            clearTimeout(bootTimeout);
          }
        }
      }

      // Load cached profile FIRST - this prevents flash of empty state
      const cachedProfile = loadProfileCache();

      // Check for existing session
      try {
        const { data: { session } } = await supabase.auth.getSession();

        // If NO session exists, stop loading immediately (public homepage)
        if (!session?.user && mounted) {
          console.log('✅ No session found - showing public homepage');
          setAuthLoading(false);
          clearTimeout(timeoutId);
          clearTimeout(bootTimeout);
          return; // Exit early for public users
        }

        // Set cached profile immediately if we have one
        if (cachedProfile && mounted) {
          console.log('📦 Loading cached profile:', cachedProfile.username);
          setProfile(cachedProfile);
          if (cachedProfile.token_balance !== undefined) {
            setTokenBalance(cachedProfile.token_balance);
          }
          // IMPORTANT: Also set user from session so roleResolved works
          if (session?.user) {
            setUser(session.user);
          }
          // CRITICAL: Mark role as resolved when using cache to prevent flickering
          setRoleResolved(true);
          console.log('✅ Role resolved from cache:', {
            is_creator: cachedProfile.is_creator,
            is_admin: cachedProfile.is_admin
          });
        }

        if (session?.user && mounted) {
          // Circuit breaker: Skip if in backoff period
          if (!shouldAttemptSyncUser()) {
            console.log('⏸️ Using cached profile (circuit breaker active)');
            setAuthLoading(false);
            clearTimeout(bootTimeout);
            return;
          }

          // Fetch canonical session from backend - fail open with timeout
          const result = await fetchCanonicalSession(session);

          if (result.ok && result.data?.user) {
            const userData = result.data.user;

            console.log('✅ Canonical session loaded:', {
              is_creator: userData.is_creator,
              is_admin: userData.is_admin
            });

            // Circuit breaker: Reset on success
            recordSyncUserSuccess();

            setUser(session.user);
            setProfile(userData);
            saveProfileCache(userData, session);

            if (userData.token_balance !== undefined) {
              setTokenBalance(userData.token_balance);
            }

            setError('');
            setRoleResolved(true); // Mark role as resolved
            setAuthLoading(false);
            clearTimeout(timeoutId);
            clearTimeout(bootTimeout);

            // Fetch token balance
            setTimeout(() => fetchTokenBalance(session.user), 200);
          } else {
            // Circuit breaker: Record failure
            recordSyncUserFailure();

            console.warn('⚠️ Session fetch failed (non-blocking):', {
              status: result.status,
              error: result.error
            });

            // Fail open: mark role resolved even on failure to unblock ProtectedRoute
            setRoleResolved(true);

            // Backend failed - use cached profile if available
            const cachedProfile = loadProfileCache();

            if (cachedProfile && mounted) {
              console.log('✅ Using cached profile as fallback');
              setUser(session.user);
              setProfile(cachedProfile);
              setTokenBalance(cachedProfile.token_balance || 0);
              setError('');
              setAuthLoading(false);
              clearTimeout(timeoutId);
              clearTimeout(bootTimeout);
            } else {
              console.error('❌ No cached profile available and session fetch failed');
              console.warn('⚠️ Keeping existing profile to prevent role downgrade');

              // CRITICAL: Don't set profile = null if we already have one (prevents role downgrade)
              // This handles the case where a late/failed session fetch tries to clobber a good profile
              if (!profile) {
                // Only show error if we truly have no profile at all
                setError('Unable to load your profile. Please refresh the page or sign in again.');
              }

              setUser(session.user); // Keep session so they can sign out

              // Stop loading so error message shows (or app continues with cached data)
              setAuthLoading(false);
              clearTimeout(timeoutId);
              clearTimeout(bootTimeout);

              // Auto-retry after 3 seconds if we're in circuit breaker backoff
              setTimeout(async () => {
                if (shouldAttemptSyncUser() && mounted) {
                  console.log('🔄 Auto-retrying session fetch after failure...');
                  window.location.reload(); // Simple reload to retry
                }
              }, 3000);
            }
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
        // Fail open: mark role resolved even on exception to unblock ProtectedRoute
        setRoleResolved(true);
        setAuthLoading(false);
      }

      // Timeout fallback - reduced from 30s to 10s
      timeoutId = setTimeout(() => {
        if (mounted && authLoading) {
          console.error('⚠️ Auth timeout reached after 10s');
          setAuthLoading(false);
        }
      }, 10000);

      // Guard to prevent double redirects on sign-out
      const hasRedirectedOnSignOut = { current: false };

      // Subscribe to auth changes
      const unsubscribe = subscribeToAuthChanges(async (event, session) => {
        if (!mounted) return;

        try {
          if (session?.user) {
            setUser(session.user);
            setError('');

            // Verify role
            const verifiedRole = await syncUserRole();
            if (verifiedRole) {
              console.log('✅ Role verified:', verifiedRole.primaryRole);
            }

            // Fetch profile and balance
            setTimeout(() => fetchUserProfile(session.user), 100);
            setTimeout(() => fetchTokenBalance(session.user), 200);
          } else {
            // Signed out - guard against double redirects
            if (event === 'SIGNED_OUT' && !hasRedirectedOnSignOut.current) {
              hasRedirectedOnSignOut.current = true;
              console.log('🔓 Auth state change: User signed out');
              addBreadcrumb('auth_signed_out', {
                category: 'auth',
                level: 'info',
                timestamp: new Date().toISOString()
              });
            }

            setUser(null);
            setProfile(null);
            setTokenBalance(0);
            clearRoleCache();
            clearProfileCache();
          }
        } catch (error) {
          console.error('Auth state change error:', error);
          setError('Authentication error');
        } finally {
          if (mounted) {
            setAuthLoading(false);
            clearTimeout(timeoutId);
          }
        }
      });

      return unsubscribe;
    };

    let unsubscribe;
    initAuth().then(unsub => {
      unsubscribe = unsub;
    });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-stop loading when user/profile are set manually (for manual login flows)
  useEffect(() => {
    if (user && profile) {
      console.log('✅ AuthContext: User and profile set, stopping loading');
      setAuthLoading(false);
    }
  }, [user, profile]);

  // CRITICAL: Defer roleResolved until BOTH user AND profile exist
  // This prevents mobile layout from rendering with wrong role (fan→creator flip)
  useEffect(() => {
    if (user && profile && !roleResolved) {
      console.log('✅ AuthContext: Both user and profile exist - marking role as resolved');
      setRoleResolved(true);
    }
  }, [user, profile, roleResolved]);

  // Invariant: Warn if role resolution takes >3s (dev only or DEBUG_UI)
  useEffect(() => {
    const debugEnabled = import.meta.env.VITE_DEBUG_UI === 'true' || process.env.NODE_ENV !== 'production';
    if (!currentUser || roleResolved) return;

    const timeoutId = setTimeout(() => {
      if (currentUser && !roleResolved) {
        const eventData = {
          event: 'role_resolution_slow',
          uid: currentUser.id,
          elapsed: '3000ms',
          hasProfile: !!profile,
          profileKeys: profile ? Object.keys(profile) : []
        };

        if (debugEnabled) {
          console.warn('⚠️ Slow role resolution detected:', eventData);
        } else {
          // Production: Send to Sentry as breadcrumb
          addBreadcrumb('role_resolution_slow', {
            category: 'auth',
            level: 'warning',
            ...eventData
          });
        }
      }
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [currentUser, roleResolved, profile]);

  // Invariant: Warn if role is invalid (dev only or DEBUG_UI)
  useEffect(() => {
    const debugEnabled = import.meta.env.VITE_DEBUG_UI === 'true' || process.env.NODE_ENV !== 'production';

    if (roleResolved && role && !isRole(role)) {
      const eventData = {
        event: 'invalid_role',
        role,
        profile_role: profile?.role,
        is_creator: profile?.is_creator,
        is_admin: profile?.is_admin
      };

      if (debugEnabled) {
        console.warn('⚠️ Invalid role detected after resolution:', eventData);
      } else {
        // Production: Send to Sentry as breadcrumb
        addBreadcrumb('invalid_role', {
          category: 'auth',
          level: 'error',
          ...eventData
        });
      }
    }
  }, [roleResolved, role, profile]);

  // Observability: Log auth boot event once (dev only or DEBUG_UI)
  const authBootLogged = useRef(false);
  useEffect(() => {
    const debugEnabled = import.meta.env.VITE_DEBUG_UI === 'true' || process.env.NODE_ENV !== 'production';
    if (!(!authLoading && currentUser && roleResolved && !authBootLogged.current)) return;

    authBootLogged.current = true;

    // SSR-safe: Coalesce navigator.userAgent for edge/SSR environments
    const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone/i.test(navigator?.userAgent || '');
    const eventData = {
      event: 'auth_boot',
      role,
      roleResolved: true,
      uid: currentUser.id,
      device: isMobile ? 'mobile' : 'desktop',
      hasTokenBalance: tokenBalance !== undefined,
      timestamp: new Date().toISOString()
    };

    if (debugEnabled) {
      console.log('🚀 Auth boot complete:', eventData);
    } else {
      // Production: Send to Sentry as breadcrumb
      addBreadcrumb('auth_boot', {
        category: 'auth',
        level: 'info',
        ...eventData
      });

      // Set Sentry tag for issue grouping by role
      setTag('role', role || 'guest');
    }
  }, [authLoading, currentUser, roleResolved, role, tokenBalance]);

  // Listen for circuit breaker events and show non-blocking toast (once per session)
  const circuitBreakerToastShown = useRef(false);
  useEffect(() => {
    const handleCircuitEvent = (event) => {
      const { state } = event.detail;

      if (state === 'backoff' && !circuitBreakerToastShown.current) {
        circuitBreakerToastShown.current = true;
        // Non-blocking, auto-dismiss toast
        toast('We\'re syncing your account. You can keep browsing.', {
          duration: 4000,
          icon: '🔄',
          position: 'bottom-center',
          style: {
            background: '#6366f1',
            color: '#fff',
            fontSize: '14px'
          }
        });
      } else if (state === 'ok') {
        // Reset flag so toast can show again in future outages
        circuitBreakerToastShown.current = false;
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('auth:circuit', handleCircuitEvent);
      return () => window.removeEventListener('auth:circuit', handleCircuitEvent);
    }
  }, []);

  // Memoize value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    // State
    user,           // Keep for low-level needs (Supabase auth only)
    profile,        // Keep for advanced needs (DB profile only)
    currentUser,    // ⭐ CANONICAL - Use this in UI components
    tokenBalance,
    authLoading,
    error,

    // Computed
    isAuthenticated,
    isCreator,
    isAdmin,
    role,           // ⭐ CANONICAL role string ('creator' | 'admin' | 'fan' | null)
    roleResolved,

    // Actions
    signOut,
    refreshProfile,
    fetchTokenBalance,
    updateTokenBalance,
    setUser,
    setProfile
  }), [
    user,
    profile,
    currentUser,
    tokenBalance,
    authLoading,
    error,
    isAuthenticated,
    isCreator,
    isAdmin,
    role,
    roleResolved,
    signOut,
    refreshProfile,
    fetchTokenBalance,
    updateTokenBalance
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
