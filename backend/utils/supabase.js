import { createClient } from '@supabase/supabase-js';

// Environment variables for Supabase
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase configuration');
  throw new Error('Supabase URL or Anon Key missing');
}

// Initialize Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10, // Adjust based on your needs
    },
  },
});

// Real-time subscription for chat messages
export function subscribeToChatMessages(channelName, callback) {
  const subscription = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*', // Listen to INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'chat_messages',
      },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe((status, err) => {
      if (err) {
        console.error('❌ Chat subscription error:', err);
      }
      console.log('📡 Chat subscription status:', status);
    });

  // Return unsubscribe function for cleanup
  return () => {
    supabase.removeChannel(subscription);
    console.log('🛑 Chat subscription removed:', channelName);
  };
}

// Real-time subscription for session updates
export function subscribeToSessionUpdates(channelName, callback) {
  const subscription = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE', // Only listen to UPDATE events for sessions
        schema: 'public',
        table: 'sessions',
      },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe((status, err) => {
      if (err) {
        console.error('❌ Session subscription error:', err);
      }
      console.log('📡 Session subscription status:', status);
    });

  // Return unsubscribe function for cleanup
  return () => {
    supabase.removeChannel(subscription);
    console.log('🛑 Session subscription removed:', channelName);
  };
}

// Optional: Log initialization (disable in production)
console.log('📡 Supabase client initialized (client-side)');