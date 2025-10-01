const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please ensure SUPABASE_URL and SUPABASE_ANON_KEY are set in your .env file');
  process.exit(1);
}

// Public client for general use
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  db: {
    schema: 'public'
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Service client for admin operations (only use server-side)
const supabaseService = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  db: {
    schema: 'public'
  }
}) : null;

// Test connection
const testSupabaseConnection = async () => {
  try {
    console.log('🔄 Testing Supabase connection...');
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      throw error;
    }
    
    console.log('✅ Supabase connection successful');
    
    // Test auth if service key is available
    if (supabaseService) {
      const { data: authTest, error: authError } = await supabaseService.auth.admin.listUsers({
        page: 1,
        perPage: 1
      });
      
      if (authError) {
        console.warn('⚠️ Supabase Auth test failed:', authError.message);
      } else {
        console.log('✅ Supabase Auth connection successful');
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Supabase connection failed:', error.message);
    return false;
  }
};

// Helper function to get Supabase client for specific user
const getSupabaseUserClient = (accessToken) => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
};

// Subscribe to real-time changes
const subscribeToTable = (table, callback, filters = {}) => {
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

  return channel;
};

// Unsubscribe from real-time changes
const unsubscribeFromChannel = async (channel) => {
  await supabase.removeChannel(channel);
};

module.exports = {
  supabase,
  supabaseService,
  testSupabaseConnection,
  getSupabaseUserClient,
  subscribeToTable,
  unsubscribeFromChannel
};