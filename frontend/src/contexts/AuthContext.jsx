import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../utils/supabase-auth';
import { subscribeToAuthChanges } from '../utils/auth-helpers';
import { syncUserRole, clearRoleCache } from '../utils/roleVerification';
import { loadProfileCache, saveProfileCache, clearProfileCache } from '../utils/profileCache';
import useAuthStore from '../stores/useAuthStore';
import { authLogger } from '../utils/logger';

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

export const AuthProvider = ({ children }) => {
  // State
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState('');

  // Refs for throttling
  const fetchInProgress = useRef({ profile: false, balance: false });
  const lastFetch = useRef({ profile: 0, balance: 0 });

  // Computed values - use canonical role from /api/me (single source of truth)
  const isCreator = profile?.is_creator === true;  // Backend computes this canonically
  const isAdmin = profile?.is_admin === true;      // Backend computes this canonically
  const isAuthenticated = !!user;
  const roleResolved = !!profile?.id && typeof profile?.is_creator === 'boolean'; // Role is fully resolved

  /**
   * Fetch canonical user role from /api/me (SINGLE SOURCE OF TRUTH)
   */
  const fetchCanonicalRole = useCallback(async (session) => {
    if (!session?.access_token) return null;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/auth/me`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Canonical role fetched from /api/me:', {
          username: data.username,
          is_creator: data.is_creator,
          is_admin: data.is_admin
        });
        return data;
      } else {
        console.error('Failed to fetch canonical role:', response.status);
        return null;
      }
    } catch (error) {
      console.error('Error fetching canonical role:', error);
      return null;
    }
  }, []);

  /**
   * FALLBACK: Fetch profile directly from Supabase if backend is unreachable
   * This provides mobile resilience and offline-first capability
   */
  const fetchProfileFromSupabaseDirect = useCallback(async (userId) => {
    try {
      console.log('🔄 Trying Supabase direct fallback for user:', userId);

      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          token_balances!inner(balance, total_earned, total_spent, total_purchased)
        `)
        .eq('id', userId)
        .single();

      if (error) throw error;

      // Compute canonical role client-side (same logic as backend)
      const canonicalProfile = {
        ...data,
        // Token balance from join
        token_balance: data.token_balances?.balance || 0,
        total_earned: data.token_balances?.total_earned || 0,
        total_spent: data.token_balances?.total_spent || 0,
        total_purchased: data.token_balances?.total_purchased || 0,

        // Canonical role computation (matches backend logic in routes/auth.js)
        is_creator: data.is_creator === true ||
                    data.role === 'creator' ||
                    (data.creator_type !== null && data.creator_type !== undefined),
        is_admin: data.is_super_admin === true ||
                  data.role === 'admin'
      };

      console.log('✅ Supabase direct fallback succeeded:', {
        username: canonicalProfile.username,
        is_creator: canonicalProfile.is_creator,
        is_admin: canonicalProfile.is_admin,
        token_balance: canonicalProfile.token_balance
      });

      return canonicalProfile;
    } catch (error) {
      console.error('❌ Supabase direct fallback failed:', error);
      return null;
    }
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
   * Sign out
   */
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setTokenBalance(0);
      clearProfileCache();
      clearRoleCache();
      console.log('✅ Signed out successfully');
    } catch (error) {
      console.error('Sign out error:', error);
      setError('Failed to sign out');
    }
  }, []);

  /**
   * Initialize authentication on mount
   */
  useEffect(() => {
    let mounted = true;
    let timeoutId;

    const initAuth = async () => {
      // Check if AppBootstrap already authenticated
      const authStoreState = useAuthStore?.getState?.();
      if (authStoreState?.authStatus === 'ready' && authStoreState?.user) {
        console.log('✅ AppBootstrap already authenticated, syncing...');
        setUser({
          id: authStoreState.user.id,
          email: authStoreState.user.email
        });

        // Fetch full profile
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          try {
            const response = await fetch(
              `${import.meta.env.VITE_BACKEND_URL}/api/auth/sync-user`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                  supabaseId: session.user.id,
                  email: session.user.email,
                  metadata: session.user.user_metadata
                })
              }
            );

            if (response.ok) {
              const data = await response.json();
              const userData = data.user;
              setProfile(userData);
              saveProfileCache(userData, session);
              if (userData.token_balance !== undefined) {
                setTokenBalance(userData.token_balance);
              }
              setAuthLoading(false);
              return;
            } else {
              const errorData = await response.json().catch(() => ({}));
              console.error('❌ AppBootstrap sync failed:', {
                status: response.status,
                error: errorData.error,
                message: errorData.message
              });
            }
          } catch (error) {
            console.error('Error syncing from AppBootstrap:', error);
          }
        }
      }

      // Load cached profile
      const cachedProfile = loadProfileCache();
      if (cachedProfile && mounted) {
        console.log('📦 Loading cached profile:', cachedProfile.username);
        setProfile(cachedProfile);
        if (cachedProfile.token_balance !== undefined) {
          setTokenBalance(cachedProfile.token_balance);
        }
      }

      // Check for existing session
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          // Sync user with backend
          try {
            const response = await fetch(
              `${import.meta.env.VITE_BACKEND_URL}/api/auth/sync-user`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                  supabaseId: session.user.id,
                  email: session.user.email,
                  metadata: session.user.user_metadata
                })
              }
            );

            if (response.ok) {
              const data = await response.json();
              const userData = data.user;

              console.log('✅ sync-user success:', {
                username: userData.username,
                is_creator: userData.is_creator,
                is_admin: userData.is_admin
              });

              setUser(session.user);
              setProfile(userData);
              saveProfileCache(userData, session);

              if (userData.token_balance !== undefined) {
                setTokenBalance(userData.token_balance);
              }

              setError('');
              setAuthLoading(false);
              clearTimeout(timeoutId);

              // Fetch token balance
              setTimeout(() => fetchTokenBalance(session.user), 200);
            } else {
              // Log detailed error response
              const errorData = await response.json().catch(() => ({}));
              console.error('❌ sync-user failed (HTTP error):', {
                status: response.status,
                error: errorData.error,
                message: errorData.message,
                detail: errorData.detail
              });

              // TRY FALLBACK: Direct Supabase query for resilience
              console.log('🔄 Trying Supabase fallback due to HTTP error...');
              const fallbackProfile = await fetchProfileFromSupabaseDirect(session.user.id);

              if (fallbackProfile && mounted) {
                console.log('✅ Fallback succeeded despite HTTP error!');
                setUser(session.user);
                setProfile(fallbackProfile);
                saveProfileCache(fallbackProfile, session);
                setTokenBalance(fallbackProfile.token_balance);
                setError('');
                setAuthLoading(false);
                clearTimeout(timeoutId);
                return; // Success via fallback!
              }

              // BOTH FAILED: Sign out to prevent redirect loops
              console.error('❌ Both backend and Supabase fallback failed');
              setError('Authentication failed. Please try logging in again.');
              setAuthLoading(false);
              clearTimeout(timeoutId);

              await supabase.auth.signOut();
              setUser(null);
              setProfile(null);
            }
          } catch (syncError) {
            console.error('❌ Backend sync failed, trying Supabase fallback...', syncError);

            // TRY FALLBACK: Direct Supabase query for mobile resilience
            const fallbackProfile = await fetchProfileFromSupabaseDirect(session.user.id);

            if (fallbackProfile && mounted) {
              console.log('✅ Fallback succeeded! Using Supabase data');
              setUser(session.user);
              setProfile(fallbackProfile);
              saveProfileCache(fallbackProfile, session);
              setTokenBalance(fallbackProfile.token_balance);
              setError('');
              setAuthLoading(false);
              clearTimeout(timeoutId);
              return; // Success via fallback!
            }

            // BOTH FAILED: Sign out to prevent redirect loops
            console.error('❌ Both backend and Supabase fallback failed');
            setError('Authentication failed. Please try logging in again.');
            setAuthLoading(false);
            clearTimeout(timeoutId);

            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
      }

      // Timeout fallback - reduced from 30s to 10s
      timeoutId = setTimeout(() => {
        if (mounted && authLoading) {
          console.error('⚠️ Auth timeout reached after 10s');
          setAuthLoading(false);
        }
      }, 10000);

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
            // Signed out
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

  // Memoize value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    // State
    user,
    profile,
    tokenBalance,
    authLoading,
    error,

    // Computed
    isAuthenticated,
    isCreator,
    isAdmin,
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
    tokenBalance,
    authLoading,
    error,
    isAuthenticated,
    isCreator,
    isAdmin,
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
