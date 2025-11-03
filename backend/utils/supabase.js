// utils/supabase.js
// Supabase client for backend (CommonJS)
const { createClient } = require('@supabase/supabase-js');

// Environment variables for Supabase
const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('Looking for: SUPABASE_URL or REACT_APP_SUPABASE_URL');
  console.error('Looking for: SUPABASE_SERVICE_ROLE_KEY (required for backend)');
  // Don't throw - allow server to start but warn
}

// Initialize Supabase client with SERVICE ROLE KEY for backend operations
// This bypasses Row Level Security (RLS) which is required for backend operations
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false, // Backend doesn't need session persistence
    autoRefreshToken: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
}) : null;

// Real-time subscription for chat messages
function subscribeToChatMessages(channelName, callback) {
  if (!supabase) {
    console.error('❌ Supabase client not initialized');
    return () => {};
  }

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
function subscribeToSessionUpdates(channelName, callback) {
  if (!supabase) {
    console.error('❌ Supabase client not initialized');
    return () => {};
  }

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

// Log initialization (disable in production)
if (supabase) {
  console.log('📡 Supabase client initialized (backend)');
} else {
  console.warn('⚠️ Supabase client not initialized - missing environment variables');
}

// Export for CommonJS
module.exports = {
  supabase,
  subscribeToChatMessages,
  subscribeToSessionUpdates
};
