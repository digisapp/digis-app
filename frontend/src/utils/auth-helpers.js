import { supabase } from './supabase-auth';

/**
 * Get the current Supabase session token
 * Gets the Supabase session token (replaces Firebase's getIdToken)
 */
export const getAuthToken = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Error getting session:', error);
    throw error;
  }
  
  if (!session) {
    throw new Error('No active session');
  }
  
  return session.access_token;
};

/**
 * Get the current user from Supabase
 */
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.error('Error getting user:', error);
    throw error;
  }
  
  return user;
};

/**
 * Helper to get user ID
 * Returns Supabase user ID instead of Firebase UID
 */
export const getUserId = async () => {
  const user = await getCurrentUser();
  return user?.id;
};