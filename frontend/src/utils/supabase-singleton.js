// Single shared Supabase client instance
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase';

// Create a single instance that will be shared across the app
let supabaseClient = null;

export const getSupabaseClient = () => {
  if (!supabaseClient) {
    // Validate environment variables
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('Missing Supabase configuration:', {
        url: SUPABASE_URL || 'MISSING',
        key: SUPABASE_ANON_KEY ? 'SET' : 'MISSING'
      });
      // Return null instead of throwing to prevent app crash
      return null;
    }

    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'digis-auth-token',
      }
    });
  }
  return supabaseClient;
};

// Export the client getter as default
export default getSupabaseClient;