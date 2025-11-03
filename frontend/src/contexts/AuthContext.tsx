import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient, type Session, type User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY!;
export const supabase = createClient(supabaseUrl, supabaseAnon);

type AuthState = {
  user: User | null;
  currentUser: User | null;  // Alias for backwards compatibility
  session: Session | null;
  loading: boolean;
  roleResolved: boolean;  // True when role determination is complete
  signInWithPassword: (email: string, password: string) => Promise<{ error: any }>;
  signInWithOtp: (email: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  isCreator: boolean;
  isAdmin: boolean;
  role: 'admin' | 'creator' | 'fan';
};

const Ctx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync user metadata from backend database to Supabase Auth
  const syncMetadata = async (accessToken: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/auth/sync-metadata`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        console.log('✅ User metadata synced successfully');
        // Refresh the session to get updated metadata
        const { data } = await supabase.auth.refreshSession();
        if (data.session) {
          setSession(data.session);
          setUser(data.session.user);
        }
      } else {
        console.warn('⚠️ Failed to sync user metadata:', await response.text());
      }
    } catch (error) {
      console.error('Error syncing user metadata:', error);
    }
  };

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);

      // Always sync metadata on initial load if user is logged in
      // This ensures database role is always reflected in the UI
      if (data.session?.access_token) {
        console.log('🔄 Syncing user metadata from database...');
        await syncMetadata(data.session.access_token);
      }

      setLoading(false);
    };
    init();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s);
      setUser(s?.user ?? null);

      // Sync metadata on sign in
      if (event === 'SIGNED_IN' && s?.access_token) {
        await syncMetadata(s.access_token);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signInWithPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signInWithOtp = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth?mode=callback`,
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Get role from user metadata (primary source)
  // Falls back to computing from isCreator/isAdmin for backward compatibility
  const metadataRole = user?.user_metadata?.role as 'admin' | 'creator' | 'fan' | undefined;
  const isCreator = metadataRole === 'creator' || !!user?.user_metadata?.isCreator;
  const isAdmin = metadataRole === 'admin' || !!user?.user_metadata?.isAdmin;
  const role = metadataRole || (isAdmin ? 'admin' : isCreator ? 'creator' : 'fan');

  // Role is resolved when loading is complete
  const roleResolved = !loading;

  // Alias for backwards compatibility
  const currentUser = user;

  return (
    <Ctx.Provider value={{ user, currentUser, session, loading, roleResolved, signInWithPassword, signInWithOtp, signOut, isCreator, isAdmin, role }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
