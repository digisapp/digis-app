import { createClient } from '@supabase/supabase-js';
import { ENV } from '../config/env';

// Initialize Supabase client
const supabaseUrl = ENV.SUPABASE.URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = ENV.SUPABASE.ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('🔧 Supabase Configuration:');
console.log('   URL:', supabaseUrl);
console.log('   Anon Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'MISSING');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('Please ensure SUPABASE_URL and SUPABASE_ANON_KEY are configured');
  console.error('ENV.SUPABASE:', ENV.SUPABASE);
  console.error('import.meta.env:', import.meta.env);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: window.localStorage,
    storageKey: 'digis-auth-token'
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Auth event listener
export const onAuthStateChange = (callback) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    console.log('🔐 Auth state changed:', event);
    callback(event, session);
  });

  return subscription;
};

// Sign up with email and password
export const signUp = async (email, password, metadata = {}) => {
  console.log('🔄 Attempting to sign up user...');
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata, // username, display_name, etc.
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (error) throw error;

    console.log('✅ Sign up successful');
    return { user: data.user, session: data.session, error: null };
  } catch (error) {
    console.error('❌ Sign up error:', error);
    return { user: null, session: null, error };
  }
};

// Sign in with email and password
export const signIn = async (email, password) => {
  console.log('🔄 Attempting to sign in user...');
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    console.log('✅ Sign in successful');
    return { user: data.user, session: data.session, error: null };
  } catch (error) {
    console.error('❌ Sign in error:', error);
    return { user: null, session: null, error };
  }
};

// Sign in with Google
export const signInWithGoogle = async () => {
  console.log('🔄 Attempting Google sign in...');
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    });

    if (error) throw error;

    console.log('✅ Google sign-in initiated');
    return { data, error: null };
  } catch (error) {
    console.error('❌ Google sign in error:', error);
    return { data: null, error };
  }
};

// Sign in with Twitter/X
export const signInWithTwitter = async () => {
  console.log('🔄 Attempting Twitter/X sign in...');
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'twitter',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (error) throw error;

    console.log('✅ Twitter/X sign-in initiated');
    return { data, error: null };
  } catch (error) {
    console.error('❌ Twitter/X sign in error:', error);
    return { data: null, error };
  }
};

// Sign out
export const signOut = async () => {
  console.log('🔄 Signing out user...');
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    console.log('✅ Sign out successful');
    return { error: null };
  } catch (error) {
    console.error('❌ Sign out error:', error);
    return { error };
  }
};

// Reset password
export const resetPassword = async (email) => {
  console.log('🔄 Sending password reset email...');
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`
    });

    if (error) throw error;

    console.log('✅ Password reset email sent');
    return { error: null };
  } catch (error) {
    console.error('❌ Password reset error:', error);
    return { error };
  }
};

// Update password
export const updatePassword = async (newPassword) => {
  console.log('🔄 Updating password...');
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;

    console.log('✅ Password updated successfully');
    return { error: null };
  } catch (error) {
    console.error('❌ Password update error:', error);
    return { error };
  }
};

// Update user profile
export const updateUserProfile = async (updates) => {
  console.log('🔄 Updating user profile...');
  try {
    const { data, error } = await supabase.auth.updateUser({
      data: updates // username, display_name, profile_pic_url, etc.
    });

    if (error) throw error;

    console.log('✅ Profile updated successfully');
    return { user: data.user, error: null };
  } catch (error) {
    console.error('❌ Profile update error:', error);
    return { user: null, error };
  }
};

// Get current user
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) throw error;
    
    return { user, error: null };
  } catch (error) {
    console.error('❌ Get current user error:', error);
    return { user: null, error };
  }
};

// Get current session
export const getSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) throw error;
    
    return { session, error: null };
  } catch (error) {
    console.error('❌ Get session error:', error);
    return { session: null, error };
  }
};

// Refresh session
export const refreshSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.refreshSession();
    
    if (error) throw error;
    
    return { session, error: null };
  } catch (error) {
    console.error('❌ Refresh session error:', error);
    return { session: null, error };
  }
};

// Get auth token for API calls
export const getAuthToken = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch (error) {
    console.error('❌ Get auth token error:', error);
    return null;
  }
};

// Handle OAuth callback
export const handleAuthCallback = async () => {
  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(
      window.location.href
    );

    if (error) throw error;

    return { session: data.session, error: null };
  } catch (error) {
    console.error('❌ Auth callback error:', error);
    return { session: null, error };
  }
};

// Migration helper: Link existing Firebase user to Supabase
export const linkFirebaseUser = async (firebaseUid, email) => {
  try {
    // This would be called during migration to link accounts
    const { data, error } = await supabase.auth.updateUser({
      data: {
        firebase_uid: firebaseUid,
        migrated_from: 'firebase',
        migrated_at: new Date().toISOString()
      }
    });

    if (error) throw error;

    return { user: data.user, error: null };
  } catch (error) {
    console.error('❌ Link Firebase user error:', error);
    return { user: null, error };
  }
};

// Alias for signOut
export const logout = signOut;

// Subscribe to auth changes
export const subscribeToAuthChanges = (callback) => {
  const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });

  return () => {
    authListener.subscription.unsubscribe();
  };
};

// Real-time subscriptions
export const subscribeToTable = (table, callback, filters = {}) => {
  const channel = supabase
    .channel(`public:${table}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: table,
        ...filters
      },
      callback
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// Token balance real-time subscription
export const subscribeToTokenBalance = (userId, callback) => {
  return subscribeToTable(
    'token_balances',
    (payload) => {
      if (payload.new && payload.new.supabase_user_id === userId) {
        callback(payload.new);
      }
    },
    { filter: `supabase_user_id=eq.${userId}` }
  );
};

// Session updates real-time subscription
export const subscribeToSessionUpdates = (sessionId, callback) => {
  return subscribeToTable(
    'sessions',
    (payload) => {
      if (payload.new && payload.new.id === sessionId) {
        callback(payload.new);
      }
    },
    { filter: `id=eq.${sessionId}` }
  );
};

// Chat messages real-time subscription
export const subscribeToChatMessages = (sessionId, callback) => {
  return subscribeToTable(
    'chat_messages',
    (payload) => {
      if (payload.eventType === 'INSERT' && payload.new.session_id === sessionId) {
        callback(payload.new);
      }
    },
    { filter: `session_id=eq.${sessionId}` }
  );
};