const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function createMissingTables() {
  console.log('🔄 Creating missing tables in Supabase...');

  try {
    // Create client_logs table
    const clientLogsSQL = `
      CREATE TABLE IF NOT EXISTS client_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        level VARCHAR(20),
        message TEXT,
        context JSONB,
        user_id UUID REFERENCES auth.users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    const { error: clientLogsError } = await supabase.rpc('exec_sql', { 
      sql: clientLogsSQL 
    }).single();

    if (clientLogsError && !clientLogsError.message?.includes('already exists')) {
      // Try direct approach
      const { data, error } = await supabase
        .from('client_logs')
        .select('id')
        .limit(1);
      
      if (error?.code === '42P01') {
        console.log('❌ client_logs table does not exist and cannot be created via RPC');
        console.log('Please run the following SQL in Supabase SQL Editor:');
        console.log(clientLogsSQL);
      } else {
        console.log('✅ client_logs table already exists');
      }
    } else {
      console.log('✅ client_logs table created or already exists');
    }

    // Create analytics_events table
    const analyticsEventsSQL = `
      CREATE TABLE IF NOT EXISTS analytics_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_name VARCHAR(255) NOT NULL,
        event_data JSONB,
        user_id UUID REFERENCES auth.users(id),
        session_id VARCHAR(255),
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    const { error: analyticsError } = await supabase.rpc('exec_sql', { 
      sql: analyticsEventsSQL 
    }).single();

    if (analyticsError && !analyticsError.message?.includes('already exists')) {
      // Try direct approach
      const { data, error } = await supabase
        .from('analytics_events')
        .select('id')
        .limit(1);
      
      if (error?.code === '42P01') {
        console.log('❌ analytics_events table does not exist and cannot be created via RPC');
        console.log('Please run the following SQL in Supabase SQL Editor:');
        console.log(analyticsEventsSQL);
      } else {
        console.log('✅ analytics_events table already exists');
      }
    } else {
      console.log('✅ analytics_events table created or already exists');
    }

    // Create user_tokens table
    const userTokensSQL = `
      CREATE TABLE IF NOT EXISTS user_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users(id),
        balance INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    const { error: tokensError } = await supabase.rpc('exec_sql', { 
      sql: userTokensSQL 
    }).single();

    if (tokensError && !tokensError.message?.includes('already exists')) {
      // Try direct approach
      const { data, error } = await supabase
        .from('user_tokens')
        .select('id')
        .limit(1);
      
      if (error?.code === '42P01') {
        console.log('❌ user_tokens table does not exist and cannot be created via RPC');
        console.log('Please run the following SQL in Supabase SQL Editor:');
        console.log(userTokensSQL);
      } else {
        console.log('✅ user_tokens table already exists');
      }
    } else {
      console.log('✅ user_tokens table created or already exists');
    }

    console.log('\n📋 Summary:');
    console.log('If any tables failed to create, please copy the SQL from CREATE_MISSING_TABLES.sql');
    console.log('and run it in your Supabase SQL Editor at:');
    console.log('https://supabase.com/dashboard/project/lpphsjowsivjtcmafxnj/sql/new');

  } catch (error) {
    console.error('Error creating tables:', error);
    console.log('\n⚠️  Please manually run the SQL from CREATE_MISSING_TABLES.sql in Supabase SQL Editor');
  }
}

createMissingTables();