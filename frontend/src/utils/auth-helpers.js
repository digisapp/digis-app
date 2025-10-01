import { supabase } from './supabase-auth';

// Validate Supabase client configuration
if (!supabase) {
  throw new Error('Supabase client not initialized. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

// Session and user cache
let sessionCache = null;
let userCache = null;

/**
 * Retry utility for handling transient network errors
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} delay - Initial delay between retries in milliseconds
 * @returns {Promise} - Result of the function
 */
const retry = async (fn, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.warn(`Retry ${i + 1}/${maxRetries}: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
};

/**
 * Get the current Supabase session token with retry logic and caching
 * @returns {Promise<string>} - Session access token
 * @throws {Error} - If session cannot be retrieved
 */
export const getAuthToken = async () => {
  try {
    // Check cache first
    if (sessionCache && sessionCache.expires_at > Date.now() / 1000) {
      console.log('Using cached session');
      return sessionCache.access_token;
    }

    const { data: { session }, error } = await retry(() => supabase.auth.getSession());
    
    if (error) {
      // Provide specific error messages
      if (error.message.includes('network')) throw new Error('Network error fetching session');
      if (error.message.includes('unauthorized')) throw new Error('Unauthorized: Please sign in again');
      throw new Error(`Session error: ${error.message}`);
    }
    
    if (!session) throw new Error('No active session: Please sign in');
    
    // Cache the session
    sessionCache = session;
    return session.access_token;
  } catch (error) {
    console.error('Error getting session:', error);
    throw error;
  }
};

/**
 * Get the current user from Supabase with retry logic and caching
 * @returns {Promise<Object>} - User object
 * @throws {Error} - If user cannot be retrieved
 */
export const getCurrentUser = async () => {
  try {
    // Check cache first
    if (userCache) {
      console.log('Using cached user');
      return userCache;
    }

    const { data: { user }, error } = await retry(() => supabase.auth.getUser());
    
    if (error) {
      // Provide specific error messages
      if (error.message.includes('network')) throw new Error('Network error fetching user');
      if (error.message.includes('unauthorized')) throw new Error('Unauthorized: Please sign in again');
      throw new Error(`User error: ${error.message}`);
    }
    
    if (!user) throw new Error('No active user: Please sign in');
    
    // Cache the user
    userCache = user;
    return user;
  } catch (error) {
    console.error('Error getting user:', error);
    throw error;
  }
};

/**
 * Helper to get user ID with error handling
 * @returns {Promise<string>} - User ID
 * @throws {Error} - If user ID cannot be retrieved
 */
export const getUserId = async () => {
  try {
    const user = await getCurrentUser();
    if (!user?.id) throw new Error('User ID not found');
    return user.id;
  } catch (error) {
    console.error('Error getting user ID:', error);
    throw error;
  }
};

/**
 * Clear the authentication cache
 * Should be called on sign out or auth state changes
 */
export const clearAuthCache = () => {
  sessionCache = null;
  userCache = null;
  console.log('Auth cache cleared');
};

/**
 * Subscribe to auth state changes
 * @param {Function} callback - Callback function to handle auth changes
 * @returns {Function} - Unsubscribe function
 */
export const subscribeToAuthChanges = (callback) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    // Clear cache on auth state changes
    if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
      clearAuthCache();
    }
    
    // Update cache on sign in
    if (event === 'SIGNED_IN' && session) {
      sessionCache = session;
      userCache = session.user;
    }
    
    // Call the provided callback
    if (callback) callback(event, session);
  });
  
  return () => subscription.unsubscribe();
};

/**
 * Check if user is authenticated
 * @returns {Promise<boolean>} - True if authenticated, false otherwise
 */
export const isAuthenticated = async () => {
  try {
    const token = await getAuthToken();
    return !!token;
  } catch {
    return false;
  }
};

/**
 * Get user metadata
 * @returns {Promise<Object>} - User metadata
 */
export const getUserMetadata = async () => {
  try {
    const user = await getCurrentUser();
    return user?.user_metadata || {};
  } catch (error) {
    console.error('Error getting user metadata:', error);
    throw error;
  }
};

/**
 * Refresh the session if needed
 * @returns {Promise<string>} - New access token
 */
export const refreshSession = async () => {
  try {
    clearAuthCache(); // Clear cache to force refresh
    const { data: { session }, error } = await retry(() => supabase.auth.refreshSession());
    
    if (error) throw new Error(`Failed to refresh session: ${error.message}`);
    if (!session) throw new Error('No session after refresh');
    
    sessionCache = session;
    return session.access_token;
  } catch (error) {
    console.error('Error refreshing session:', error);
    throw error;
  }
};