/**
 * TypeScript Authentication Hook
 * @module hooks/useAuth
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase-auth';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import toast from 'react-hot-toast';
import { User, Creator, SignupFormData, LoginFormData } from '../types';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: Error | null;
}

interface UseAuthReturn extends AuthState {
  signIn: (data: LoginFormData) => Promise<void>;
  signUp: (data: SignupFormData) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  confirmPasswordReset: (token: string, password: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  checkUsername: (username: string) => Promise<boolean>;
}

/**
 * Custom hook for authentication management
 */
export const useAuth = (): UseAuthReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const navigate = useNavigate();

  const isAuthenticated = !!session && !!user;

  /**
   * Initialize auth state
   */
  useEffect(() => {
    initializeAuth();
    
    // Subscribe to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      handleAuthStateChange
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  /**
   * Initialize authentication
   */
  const initializeAuth = async () => {
    try {
      setIsLoading(true);
      
      // Get current session
      const { data: { session: currentSession }, error: sessionError } = 
        await supabase.auth.getSession();
      
      if (sessionError) throw sessionError;
      
      if (currentSession) {
        setSession(currentSession);
        await fetchUserProfile(currentSession.user.id);
      }
    } catch (err) {
      console.error('Auth initialization error:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle auth state changes
   */
  const handleAuthStateChange = async (
    event: 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED',
    newSession: Session | null
  ) => {
    console.log('Auth state change:', event);
    setSession(newSession);

    if (event === 'SIGNED_IN' && newSession) {
      await fetchUserProfile(newSession.user.id);
      // No toast message needed - just redirect
    } else if (event === 'SIGNED_OUT') {
      setUser(null);
      navigate('/');
    } else if (event === 'TOKEN_REFRESHED' && newSession) {
      setSession(newSession);
    }
  };

  /**
   * Fetch user profile from database
   */
  const fetchUserProfile = async (userId: string): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('supabase_id', userId)
        .single();

      if (error) throw error;

      // Map database fields to User type
      const userProfile: User = {
        id: data.id,
        supabase_id: data.supabase_id,
        email: data.email,
        username: data.username,
        name: data.name || data.username,
        bio: data.bio,
        avatar: data.profile_pic_url,
        is_creator: data.is_creator,
        is_verified: data.is_verified || false,
        token_balance: data.token_balance || 0,
        created_at: data.created_at,
        updated_at: data.updated_at,
        creator_type: data.creator_type,
        followers_count: data.followers_count,
        following_count: data.following_count
      };

      // If creator, fetch additional creator data
      if (data.is_creator) {
        const creatorProfile = {
          ...userProfile,
          rating: data.rating || 0,
          total_sessions: data.total_sessions || 0,
          hourly_rate: data.hourly_rate || 0,
          per_minute_rate: data.per_minute_rate || 0,
          categories: data.categories || [],
          availability_status: data.availability_status || 'offline'
        } as Creator;
        
        setUser(creatorProfile);
      } else {
        setUser(userProfile);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setError(err as Error);
    }
  };

  /**
   * Sign in with email and password
   */
  const signIn = useCallback(async (data: LoginFormData): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password
      });

      if (authError) throw authError;

      if (authData.session) {
        setSession(authData.session);
        await fetchUserProfile(authData.user.id);
        
        // Navigate based on user type
        if (user?.is_creator) {
          navigate('/creator/dashboard');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err) {
      const error = err as Error;
      console.error('Sign in error:', error);
      setError(error);
      toast.error(error.message || 'Failed to sign in');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [navigate, user]);

  /**
   * Sign up with email and password
   */
  const signUp = useCallback(async (data: SignupFormData): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      // Check username availability
      const isAvailable = await checkUsername(data.username);
      if (!isAvailable) {
        throw new Error('Username is already taken');
      }

      // Sign up with Supabase
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            username: data.username,
            name: data.name,
            is_creator: data.is_creator
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Create user profile in database
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            supabase_id: authData.user.id,
            email: data.email,
            username: data.username,
            name: data.name,
            is_creator: data.is_creator,
            creator_type: data.creator_type,
            token_balance: 0
          });

        if (profileError) throw profileError;

        toast.success('Account created! Please check your email to verify.');
        navigate('/auth/verify-email');
      }
    } catch (err) {
      const error = err as Error;
      console.error('Sign up error:', error);
      setError(error);
      toast.error(error.message || 'Failed to sign up');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  /**
   * Sign out
   */
  const signOut = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      setSession(null);
      toast.success('Signed out successfully');
      navigate('/');
    } catch (err) {
      const error = err as Error;
      console.error('Sign out error:', error);
      setError(error);
      toast.error('Failed to sign out');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  /**
   * Update user profile
   */
  const updateProfile = useCallback(async (updates: Partial<User>): Promise<void> => {
    if (!user) throw new Error('No user logged in');

    try {
      setIsLoading(true);

      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      // Update local state
      setUser(prev => prev ? { ...prev, ...updates } : null);
      toast.success('Profile updated successfully');
    } catch (err) {
      const error = err as Error;
      console.error('Profile update error:', error);
      setError(error);
      toast.error('Failed to update profile');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  /**
   * Reset password
   */
  const resetPassword = useCallback(async (email: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      });

      if (error) throw error;

      toast.success('Password reset email sent');
    } catch (err) {
      const error = err as Error;
      console.error('Password reset error:', error);
      setError(error);
      toast.error('Failed to send reset email');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Confirm password reset
   */
  const confirmPasswordReset = useCallback(async (
    token: string,
    password: string
  ): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const { error } = await supabase.auth.updateUser({
        password
      });

      if (error) throw error;

      toast.success('Password reset successfully');
      navigate('/auth/signin');
    } catch (err) {
      const error = err as Error;
      console.error('Password reset confirmation error:', error);
      setError(error);
      toast.error('Failed to reset password');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  /**
   * Refresh session
   */
  const refreshSession = useCallback(async (): Promise<void> => {
    try {
      const { data: { session: newSession }, error } = 
        await supabase.auth.refreshSession();
      
      if (error) throw error;
      
      if (newSession) {
        setSession(newSession);
      }
    } catch (err) {
      console.error('Session refresh error:', err);
      setError(err as Error);
      throw err;
    }
  }, []);

  /**
   * Check username availability
   */
  const checkUsername = useCallback(async (username: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();

      if (error && error.code === 'PGRST116') {
        // No rows returned means username is available
        return true;
      }

      return !data;
    } catch (err) {
      console.error('Username check error:', err);
      return false;
    }
  }, []);

  return {
    user,
    session,
    isLoading,
    isAuthenticated,
    error,
    signIn,
    signUp,
    signOut,
    updateProfile,
    resetPassword,
    confirmPasswordReset,
    refreshSession,
    checkUsername
  };
};

export default useAuth;