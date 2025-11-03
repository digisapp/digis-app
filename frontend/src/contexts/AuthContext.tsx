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
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/v1/auth/sync-metadata`, {
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
      } else if (response.status === 404) {
        // Route might not be deployed yet or available - silently skip
        console.debug('ℹ️ Metadata sync endpoint not available (this is OK, skipping)');
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.warn('⚠️ Failed to sync user metadata (non-critical):', response.status, errorText);
        // Don't fail the login process if sync fails
        // User can still use the app, metadata will sync on next login
      }
    } catch (error) {
      // Network errors or other issues - don't prevent login
      console.debug('ℹ️ Could not sync user metadata (non-critical):', error instanceof Error ? error.message : 'Unknown error');
      // Non-critical error - don't prevent login
    }
  };

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();

      console.log('🔐 Initial session check:', {
        hasSession: !!data.session,
        hasUser: !!data.session?.user,
        email: data.session?.user?.email
      });

      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setLoading(false);

      // Sync metadata AFTER setting loading to false (non-blocking)
      if (data.session?.access_token) {
        console.log('🔄 Syncing user metadata from database (background)...');
        syncMetadata(data.session.access_token).catch(err => {
          console.error('Metadata sync failed (non-critical):', err);
        });
      }
    };
    init();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      console.log(`🔐 Auth state changed: ${event}`, {
        hasSession: !!s,
        hasUser: !!s?.user,
        email: s?.user?.email
      });

      // Set session and user immediately (don't wait for metadata sync)
      setSession(s);
      setUser(s?.user ?? null);

      // Sync metadata on sign in (non-blocking, in background)
      if (event === 'SIGNED_IN' && s?.access_token) {
        console.log('🔄 Syncing metadata in background...');
        syncMetadata(s.access_token).catch(err => {
          console.error('Metadata sync failed (non-critical):', err);
        });
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
