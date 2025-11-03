import getSupabaseClient from './supabase-singleton';
import { ENV } from '../config/env';

// Retry utility for network resilience
const retry = async (fn, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.warn(`Retry ${i + 1}/${maxRetries} after error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
};

// Use the shared singleton instance
export const supabase = getSupabaseClient() || {};

// Keep these for backward compatibility
const supabaseUrl = ENV.SUPABASE.URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = ENV.SUPABASE.ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

// Auth event listener
export const onAuthStateChange = (callback) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    console.log('🔐 Auth state changed:', event);
    callback(event, session);
  });

  return subscription;
};

// Sign up with email and password - with retry logic
export const signUp = async (email, password, metadata = {}) => {
  console.log('🔄 Attempting to sign up user...');
  try {
    const result = await retry(async () => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata, // username, display_name, etc.
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });
      
      if (error) throw error;
      return { user: data.user, session: data.session };
    });
    
    console.log('✅ Sign up successful');
    return { ...result, error: null };
  } catch (error) {
    console.error('❌ Sign up error:', error);
    return { user: null, session: null, error };
  }
};

// Sign in with email and password - with retry logic
export const signIn = async (email, password) => {
  console.log('🔄 Attempting to sign in user...');
  try {
    const result = await retry(async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      return { user: data.user, session: data.session };
    });
    
    console.log('✅ Sign in successful');
    return { ...result, error: null };
  } catch (error) {
    console.error('❌ Sign in error:', error);
    return { user: null, session: null, error };
  }
};

// Enhanced Google sign in with scopes
export const signInWithGoogle = async () => {
  console.log('🔄 Attempting Google sign in...');
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
          scope: 'openid email profile' // Enhanced scopes for user data
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

// Sign in with Twitter/X - check for v2 support
export const signInWithTwitter = async () => {
  console.log('🔄 Attempting Twitter/X sign in...');
  try {
    // Try twitter_v2 first, fallback to twitter
    const provider = 'twitter'; // Update to 'twitter_v2' when available
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        skipBrowserRedirect: false
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

// Sign out with retry
export const signOut = async () => {
  console.log('🔄 Signing out user...');
  try {
    const result = await retry(async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { error: null };
    }, 2); // Fewer retries for signout
    
    console.log('✅ Sign out successful');
    return result;
  } catch (error) {
    console.error('❌ Sign out error:', error);
    return { error };
  }
};

// Reset password with retry
export const resetPassword = async (email) => {
  console.log('🔄 Sending password reset email...');
  try {
    const result = await retry(async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      });
      
      if (error) throw error;
      return { error: null };
    });

    console.log('✅ Password reset email sent');
    return result;
  } catch (error) {
    console.error('❌ Password reset error:', error);
    return { error };
  }
};

// Update password with retry
export const updatePassword = async (newPassword) => {
  console.log('🔄 Updating password...');
  try {
    const result = await retry(async () => {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
      return { error: null };
    });

    console.log('✅ Password updated successfully');
    return result;
  } catch (error) {
    console.error('❌ Password update error:', error);
    return { error };
  }
};

// Update user profile with retry
export const updateUserProfile = async (updates) => {
  console.log('🔄 Updating user profile...');
  try {
    const result = await retry(async () => {
      const { data, error } = await supabase.auth.updateUser({
        data: updates // username, display_name, profile_pic_url, etc.
      });
      
      if (error) throw error;
      return { user: data.user };
    });

    console.log('✅ Profile updated successfully');
    return { ...result, error: null };
  } catch (error) {
    console.error('❌ Profile update error:', error);
    return { user: null, error };
  }
};

// Get current user with retry
export const getCurrentUser = async () => {
  try {
    const result = await retry(async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return { user };
    }, 2); // Fewer retries for reads
    
    return { ...result, error: null };
  } catch (error) {
    console.error('❌ Get current user error:', error);
    return { user: null, error };
  }
};

// Get current session with retry
export const getSession = async () => {
  try {
    const result = await retry(async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      return { session };
    }, 2);
    
    return { ...result, error: null };
  } catch (error) {
    console.error('❌ Get session error:', error);
    return { session: null, error };
  }
};

// Refresh session with retry
export const refreshSession = async () => {
  try {
    const result = await retry(async () => {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      return { session };
    });
    
    return { ...result, error: null };
  } catch (error) {
    console.error('❌ Refresh session error:', error);
    return { session: null, error };
  }
};

// Get auth token for API calls with retry and validation
export const getAuthToken = async () => {
  try {
    const result = await retry(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Validate JWT format (should have 3 parts: header.payload.signature)
      if (token && token.split('.').length !== 3) {
        console.warn('⚠️ Malformed JWT token detected, refreshing session...');
        // Try to refresh the session to get a valid token
        const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
        return refreshedSession?.access_token || null;
      }

      return token || null;
    }, 2);

    return result;
  } catch (error) {
    console.error('❌ Get auth token error:', error);
    return null;
  }
};

// Handle OAuth callback with retry
export const handleAuthCallback = async () => {
  try {
    const result = await retry(async () => {
      const { data, error } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );
      
      if (error) throw error;
      return { session: data.session };
    });

    return { ...result, error: null };
  } catch (error) {
    console.error('❌ Auth callback error:', error);
    
    // Handle specific PKCE errors
    if (error.message?.includes('Flow State not found') || 
        error.message?.includes('Bad authorization state')) {
      console.error('⚠️ PKCE state expired or invalid. User needs to re-authenticate.');
    }
    
    return { session: null, error };
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

// Enhanced real-time subscription with error handling
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
      payload => {
        try {
          callback(payload);
        } catch (error) {
          console.error(`❌ Subscription callback error in ${table}:`, error);
        }
      }
    )
    .subscribe((status) => {
      switch (status) {
        case 'SUBSCRIBED':
          console.log(`✅ Subscribed to ${table}`);
          break;
        case 'CHANNEL_ERROR':
          console.error(`❌ Subscription error for ${table}`);
          break;
        case 'TIMED_OUT':
          console.error(`⏱️ Subscription timed out for ${table}`);
          break;
        case 'CLOSED':
          console.warn(`🔒 Subscription closed for ${table}`);
          break;
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
};

// Token balance real-time subscription with enhanced error handling
export const subscribeToTokenBalance = (userId, callback) => {
  if (!userId) {
    console.error('❌ Cannot subscribe to token balance without userId');
    return () => {};
  }
  
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

// Session updates real-time subscription with validation
export const subscribeToSessionUpdates = (sessionId, callback) => {
  if (!sessionId) {
    console.error('❌ Cannot subscribe to session updates without sessionId');
    return () => {};
  }
  
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

// Chat messages real-time subscription with validation
export const subscribeToChatMessages = (sessionId, callback) => {
  if (!sessionId) {
    console.error('❌ Cannot subscribe to chat messages without sessionId');
    return () => {};
  }
  
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

// Check if user is authenticated
export const isAuthenticated = async () => {
  const { session } = await getSession();
  return !!session;
};

// Get user metadata
export const getUserMetadata = async () => {
  const { user } = await getCurrentUser();
  return user?.user_metadata || {};
};

// Verify and refresh token if needed
export const verifyAndRefreshToken = async () => {
  try {
    const { session, error } = await getSession();
    
    if (error || !session) {
      return { valid: false, session: null };
    }
    
    // Check if token is about to expire (within 5 minutes)
    const expiresAt = session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = expiresAt - now;
    
    if (timeUntilExpiry < 300) { // 5 minutes
      console.log('🔄 Token expiring soon, refreshing...');
      const { session: newSession } = await refreshSession();
      return { valid: true, session: newSession };
    }
    
    return { valid: true, session };
  } catch (error) {
    console.error('❌ Token verification error:', error);
    return { valid: false, session: null };
  }
};