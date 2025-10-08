const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:JWiYM6v3bq4Imaot@db.lpphsjowsivjtcmafxnj.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
  const client = await pool.connect();
  try {
    console.log('Checking database schema...\n');
    
    // Check analytics_events table
    const analyticsCheck = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'analytics_events'
      ORDER BY ordinal_position
    `);
    
    console.log('=== ANALYTICS_EVENTS TABLE ===');
    console.table(analyticsCheck.rows);
    
    // Check users table critical columns
    const usersCheck = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'users' 
        AND column_name IN (
          'stream_price', 'voice_price', 'video_price', 'creator_rate',
          'text_message_price', 'image_message_price', 'available_for_calls',
          'is_online', 'total_sessions', 'total_earnings', 'token_balance'
        )
      ORDER BY column_name
    `);
    
    console.log('\n=== USERS TABLE (Critical Pricing Columns) ===');
    console.table(usersCheck.rows);
    
    // Check private call tables
    const privateCallTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE '%private_call%'
      ORDER BY table_name
    `);
    
    console.log('\n=== PRIVATE CALL TABLES ===');
    console.table(privateCallTables.rows);
    
    // Check followers table
    const followersCheck = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'followers'
      ORDER BY ordinal_position
    `);
    
    console.log('\n=== FOLLOWERS TABLE ===');
    if (followersCheck.rows.length > 0) {
      console.table(followersCheck.rows);
    } else {
      console.log('❌ Followers table does not exist or has no columns');
    }
    
    // Count total tables
    const tableCount = await client.query(`
      SELECT COUNT(*) as total_tables
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('\n=== DATABASE SUMMARY ===');
    console.log('Total tables:', tableCount.rows[0].total_tables);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkSchema();
