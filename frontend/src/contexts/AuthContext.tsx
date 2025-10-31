/**
 * AuthContext - Single source of truth for authentication
 *
 * Boring, simple, works every day.
 * No wrappers, no helpers, no abstractions - just Supabase.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient, User, Session } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isCreator: boolean;
  isAdmin: boolean;
  isPending: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, isCreator?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string>('fan');
  const [status, setStatus] = useState<string>('active');
  const [loading, setLoading] = useState(true);

  // Derived state
  const isCreator = role === 'creator';
  const isAdmin = role === 'admin';
  const isPending = status === 'pending';

  // Initialize auth state
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserRole(session.user.id);
      } else {
        setRole('fan');
        setStatus('active');
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load user role from database
  async function loadUserRole(userId: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role, status')
        .eq('supabase_id', userId)
        .single();

      if (error) throw error;

      setRole(data?.role || 'fan');
      setStatus(data?.status || 'active');
    } catch (error) {
      console.error('Error loading user role:', error);
      setRole('fan');
      setStatus('active');
    } finally {
      setLoading(false);
    }
  }

  // Sign in
  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  // Sign up
  async function signUp(email: string, password: string, isCreator = false) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    // Create user record in database
    if (data.user) {
      const { error: dbError } = await supabase
        .from('users')
        .insert({
          supabase_id: data.user.id,
          email,
          role: isCreator ? 'creator' : 'fan',
          status: isCreator ? 'pending' : 'active',
        });

      if (dbError) {
        console.error('Error creating user record:', dbError);
      }
    }
  }

  // Sign out
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  const value: AuthContextValue = {
    user,
    session,
    isCreator,
    isAdmin,
    isPending,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Export supabase client for direct use
export { supabase };
