import getSupabaseClient from './supabase-singleton';
import { ENV } from '../config/env';

// Retry utility for handling transient errors
const retry = async (fn, maxRetries = 3, delay = 1000, backoff = true) => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on specific errors
      if (error.message?.includes('Invalid login credentials') ||
          error.message?.includes('Email not confirmed') ||
          error.status === 422) {
        throw error;
      }
      
      if (i === maxRetries - 1) {
        throw error;
      }
      
      const waitTime = backoff ? delay * Math.pow(2, i) : delay;
      console.warn(`Retry ${i + 1}/${maxRetries} after error: ${error.message}. Waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError;
};

// Environment validation with better error handling
const validateEnvironment = () => {
  const supabaseUrl = ENV.SUPABASE.URL || import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = ENV.SUPABASE.ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    const errorMsg = `
Missing Supabase configuration!
Please set the following environment variables:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

Current values:
- URL: ${supabaseUrl || 'MISSING'}
- Key: ${supabaseAnonKey ? 'SET' : 'MISSING'}
    `;
    
    console.error(errorMsg);
    
    // In development, show a more helpful error
    if (import.meta.env.DEV) {
      throw new Error(errorMsg);
    }
    
    // In production, fail gracefully
    return null;
  }
  
  console.log('✅ Supabase Configuration Validated');
  console.log('   URL:', supabaseUrl);
  console.log('   Key:', `${supabaseAnonKey.substring(0, 20)}...`);
  
  return { supabaseUrl, supabaseAnonKey };
};

// Initialize Supabase client with enhanced configuration
const initializeSupabase = () => {
  const config = validateEnvironment();

  if (!config) {
    console.error('❌ Supabase initialization failed due to missing configuration');
    return null;
  }

  // Use the singleton instance
  return getSupabaseClient();
};

// Initialize Supabase
export const supabase = initializeSupabase();

// Export validation state
export const isSupabaseConfigured = () => supabase !== null;

// Enhanced auth state listener with error handling
export const onAuthStateChange = (callback) => {
  if (!supabase) {
    console.error('Supabase not initialized');
    return () => {};
  }
  
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    console.log('🔐 Auth state changed:', event);
    
    // Handle specific events
    switch (event) {
      case 'SIGNED_IN':
        console.log('✅ User signed in');
        break;
      case 'SIGNED_OUT':
        console.log('👋 User signed out');
        // Clear any cached data
        localStorage.removeItem('digis-user-cache');
        break;
      case 'TOKEN_REFRESHED':
        console.log('🔄 Token refreshed');
        break;
      case 'USER_UPDATED':
        console.log('👤 User profile updated');
        break;
      default:
        break;
    }
    
    callback(event, session);
  });

  return subscription;
};

// Enhanced sign up with retry logic
export const signUp = async (email, password, metadata = {}) => {
  console.log('🔄 Attempting to sign up user...');
  
  if (!supabase) {
    return { user: null, session: null, error: new Error('Supabase not initialized') };
  }
  
  try {
    const result = await retry(async () => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            ...metadata,
            app_version: '1.0.0',
            signup_timestamp: new Date().toISOString()
          },
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

// Enhanced sign in with retry logic
export const signIn = async (email, password) => {
  console.log('🔄 Attempting to sign in user...');
  
  if (!supabase) {
    return { user: null, session: null, error: new Error('Supabase not initialized') };
  }
  
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
    
    // Provide more helpful error messages
    if (error.message?.includes('Invalid login credentials')) {
      error.message = 'Invalid email or password. Please try again.';
    }
    
    return { user: null, session: null, error };
  }
};

// Enhanced Google sign in with proper scopes
export const signInWithGoogle = async () => {
  console.log('🔄 Attempting Google sign in...');
  
  if (!supabase) {
    return { data: null, error: new Error('Supabase not initialized') };
  }
  
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
          scope: 'openid profile email',
          // Additional params for better UX
          hd: undefined, // Remove domain restriction
          login_hint: undefined // Remove email hint
        },
        // Skip intermediate Supabase screen
        skipBrowserRedirect: false
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

// Enhanced Twitter/X sign in (using v2 if available)
export const signInWithTwitter = async () => {
  console.log('🔄 Attempting Twitter/X sign in...');
  
  if (!supabase) {
    return { data: null, error: new Error('Supabase not initialized') };
  }
  
  try {
    // Check if twitter_v2 is available (Supabase 2.0+)
    const provider = 'twitter'; // Change to 'twitter_v2' when available
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'tweet.read users.read follows.read',
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

// Enhanced sign out with cleanup
export const signOut = async () => {
  console.log('🔄 Signing out user...');
  
  if (!supabase) {
    return { error: new Error('Supabase not initialized') };
  }
  
  try {
    // Clear local storage
    localStorage.removeItem('digis-user-cache');
    sessionStorage.clear();
    
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    console.log('✅ Sign out successful');
    return { error: null };
  } catch (error) {
    console.error('❌ Sign out error:', error);
    return { error };
  }
};

// Enhanced password reset with retry
export const resetPassword = async (email) => {
  console.log('🔄 Sending password reset email...');
  
  if (!supabase) {
    return { error: new Error('Supabase not initialized') };
  }
  
  try {
    const result = await retry(async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      });
      
      if (error) throw error;
    });
    
    console.log('✅ Password reset email sent');
    return { error: null };
  } catch (error) {
    console.error('❌ Password reset error:', error);
    return { error };
  }
};

// Enhanced password update
export const updatePassword = async (newPassword) => {
  console.log('🔄 Updating password...');
  
  if (!supabase) {
    return { error: new Error('Supabase not initialized') };
  }
  
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

// Enhanced profile update with retry
export const updateUserProfile = async (updates) => {
  console.log('🔄 Updating user profile...');
  
  if (!supabase) {
    return { user: null, error: new Error('Supabase not initialized') };
  }
  
  try {
    const result = await retry(async () => {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          ...updates,
          updated_at: new Date().toISOString()
        }
      });
      
      if (error) throw error;
      return data.user;
    });
    
    console.log('✅ Profile updated successfully');
    return { user: result, error: null };
  } catch (error) {
    console.error('❌ Profile update error:', error);
    return { user: null, error };
  }
};

// Get current user with caching
export const getCurrentUser = async (useCache = true) => {
  if (!supabase) {
    return { user: null, error: new Error('Supabase not initialized') };
  }
  
  try {
    // Check cache first
    if (useCache) {
      const cachedUser = localStorage.getItem('digis-user-cache');
      if (cachedUser) {
        const parsed = JSON.parse(cachedUser);
        if (Date.now() - parsed.timestamp < 5 * 60 * 1000) { // 5 minute cache
          return { user: parsed.user, error: null };
        }
      }
    }
    
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) throw error;
    
    // Cache the user
    if (user) {
      localStorage.setItem('digis-user-cache', JSON.stringify({
        user,
        timestamp: Date.now()
      }));
    }
    
    return { user, error: null };
  } catch (error) {
    // Don't log auth session missing errors - they're expected when not logged in
    if (!error.message?.includes('Auth session missing')) {
      console.error('❌ Get current user error:', error);
    }
    return { user: null, error };
  }
};

// Get session with validation
export const getSession = async () => {
  if (!supabase) {
    return { session: null, error: new Error('Supabase not initialized') };
  }
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) throw error;
    
    // Validate session expiry
    if (session && session.expires_at) {
      const expiresAt = new Date(session.expires_at * 1000);
      if (expiresAt < new Date()) {
        console.warn('Session expired, refreshing...');
        return refreshSession();
      }
    }
    
    return { session, error: null };
  } catch (error) {
    console.error('❌ Get session error:', error);
    return { session: null, error };
  }
};

// Enhanced session refresh with retry
export const refreshSession = async () => {
  if (!supabase) {
    return { session: null, error: new Error('Supabase not initialized') };
  }
  
  try {
    const result = await retry(async () => {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      
      if (error) throw error;
      return session;
    });
    
    return { session: result, error: null };
  } catch (error) {
    console.error('❌ Refresh session error:', error);
    return { session: null, error };
  }
};

// Get auth token with automatic refresh
export const getAuthToken = async () => {
  if (!supabase) {
    return null;
  }
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) throw error;
    
    // Check if token needs refresh
    if (session && session.expires_at) {
      const expiresAt = new Date(session.expires_at * 1000);
      const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
      
      if (expiresAt < fiveMinutesFromNow) {
        console.log('Token expiring soon, refreshing...');
        const { session: refreshedSession } = await refreshSession();
        return refreshedSession?.access_token || null;
      }
    }
    
    return session?.access_token || null;
  } catch (error) {
    console.error('❌ Get auth token error:', error);
    return null;
  }
};

// Enhanced OAuth callback handler
export const handleAuthCallback = async () => {
  if (!supabase) {
    return { session: null, error: new Error('Supabase not initialized') };
  }
  
  try {
    // Parse the URL for the auth code
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const searchParams = new URLSearchParams(window.location.search);
    
    // Check for errors first
    const error = hashParams.get('error') || searchParams.get('error');
    const errorDescription = hashParams.get('error_description') || searchParams.get('error_description');
    
    if (error) {
      throw new Error(errorDescription || error);
    }
    
    const { data, error: exchangeError } = await retry(async () => {
      return await supabase.auth.exchangeCodeForSession(window.location.href);
    });

    if (exchangeError) throw exchangeError;

    // Clear the URL
    window.history.replaceState({}, document.title, window.location.pathname);

    return { session: data.session, error: null };
  } catch (error) {
    console.error('❌ Auth callback error:', error);
    
    // Handle specific OAuth errors
    if (error.message?.includes('access_denied')) {
      error.message = 'Access was denied. Please try again.';
    } else if (error.message?.includes('Flow state not found')) {
      error.message = 'Authentication session expired. Please try again.';
    }
    
    return { session: null, error };
  }
};

// Subscribe to auth changes with cleanup
export const subscribeToAuthChanges = (callback) => {
  if (!supabase) {
    console.error('Supabase not initialized');
    return () => {};
  }
  
  const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });

  return () => {
    authListener.subscription.unsubscribe();
  };
};

// Enhanced real-time subscription with error handling
export const subscribeToTable = (table, callback, filters = {}) => {
  if (!supabase) {
    console.error('Supabase not initialized');
    return () => {};
  }
  
  const channelName = `${table}-${Date.now()}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: table,
        ...filters
      },
      (payload) => {
        try {
          callback(payload);
        } catch (error) {
          console.error(`Error in ${table} subscription callback:`, error);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`✅ Subscribed to ${table}`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`❌ Subscription error for ${table}`);
      } else if (status === 'TIMED_OUT') {
        console.error(`⏱️ Subscription timeout for ${table}`);
      } else if (status === 'CLOSED') {
        console.warn(`🔒 Subscription closed for ${table}`);
      }
    });

  // Return cleanup function
  return () => {
    console.log(`🧹 Unsubscribing from ${table}`);
    supabase.removeChannel(channel);
  };
};

// Token balance subscription with rate limiting
let tokenBalanceTimeout;
export const subscribeToTokenBalance = (userId, callback) => {
  if (!userId) return () => {};
  
  return subscribeToTable(
    'token_balances',
    (payload) => {
      // Rate limit updates to prevent overwhelming the UI
      clearTimeout(tokenBalanceTimeout);
      tokenBalanceTimeout = setTimeout(() => {
        if (payload.new && payload.new.supabase_user_id === userId) {
          callback(payload.new);
        }
      }, 100);
    },
    { filter: `supabase_user_id=eq.${userId}` }
  );
};

// Session updates subscription
export const subscribeToSessionUpdates = (sessionId, callback) => {
  if (!sessionId) return () => {};
  
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

// Chat messages subscription with batching
let messageBuffer = [];
let messageTimeout;
export const subscribeToChatMessages = (sessionId, callback, batchDelay = 100) => {
  if (!sessionId) return () => {};
  
  return subscribeToTable(
    'chat_messages',
    (payload) => {
      if (payload.eventType === 'INSERT' && payload.new.session_id === sessionId) {
        // Buffer messages to prevent UI flooding
        messageBuffer.push(payload.new);
        
        clearTimeout(messageTimeout);
        messageTimeout = setTimeout(() => {
          if (messageBuffer.length > 0) {
            callback(messageBuffer);
            messageBuffer = [];
          }
        }, batchDelay);
      }
    },
    { filter: `session_id=eq.${sessionId}` }
  );
};

// Verify email address
export const verifyEmail = async (token) => {
  if (!supabase) {
    return { error: new Error('Supabase not initialized') };
  }
  
  try {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'email'
    });
    
    if (error) throw error;
    
    console.log('✅ Email verified successfully');
    return { error: null };
  } catch (error) {
    console.error('❌ Email verification error:', error);
    return { error };
  }
};

// Resend verification email
export const resendVerificationEmail = async (email) => {
  if (!supabase) {
    return { error: new Error('Supabase not initialized') };
  }
  
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email
    });
    
    if (error) throw error;
    
    console.log('✅ Verification email resent');
    return { error: null };
  } catch (error) {
    console.error('❌ Resend verification error:', error);
    return { error };
  }
};

// Helper to check if user is authenticated
export const isAuthenticated = async () => {
  const { session } = await getSession();
  return !!session;
};

// Helper to check if user email is verified
export const isEmailVerified = async () => {
  const { user } = await getCurrentUser();
  return user?.email_confirmed_at !== null;
};

// Cleanup function for unmounting
export const cleanup = () => {
  // Clear all timeouts
  clearTimeout(tokenBalanceTimeout);
  clearTimeout(messageTimeout);
  
  // Clear message buffer
  messageBuffer = [];
  
  // Clear cache
  localStorage.removeItem('digis-user-cache');
  
  console.log('🧹 Auth cleanup completed');
};

// Export legacy names for backward compatibility
export const logout = signOut;

// Export retry utility for other modules
export { retry };

// Export supabase status
export default {
  supabase,
  isSupabaseConfigured,
  retry
};