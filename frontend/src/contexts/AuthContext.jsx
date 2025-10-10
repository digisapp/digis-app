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

  // Computed values - check multiple creator indicators for robustness
  const isCreator = profile?.is_creator === true ||
                    profile?.role === 'creator' ||
                    profile?.creator_type != null;
  const isAdmin = profile?.is_super_admin === true || profile?.role === 'admin';
  const isAuthenticated = !!user;

  /**
   * Fetch user profile from backend
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
              setUser(session.user);
              setError('');
              setAuthLoading(false);
              setTimeout(() => fetchUserProfile(session.user), 100);
              setTimeout(() => fetchTokenBalance(session.user), 200);
            }
          } catch (syncError) {
            console.error('Error syncing user:', syncError);
            setUser(session.user);
            setAuthLoading(false);
            setTimeout(() => fetchUserProfile(session.user), 100);
            setTimeout(() => fetchTokenBalance(session.user), 200);
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
      }

      // Timeout fallback
      timeoutId = setTimeout(() => {
        if (mounted && authLoading) {
          console.log('Auth timeout reached');
          setAuthLoading(false);
        }
      }, 30000);

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
