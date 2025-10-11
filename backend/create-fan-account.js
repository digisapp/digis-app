require('dotenv').config();

const { Pool } = require('pg');
const { initializeSupabaseAdmin } = require('./utils/supabase-admin-v2');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : false
});

async function createFanAccount() {
  try {
    console.log('Creating Supabase Auth user for superfan@test.com...\n');

    // First, check if user already exists in database
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      ['superfan@test.com']
    );

    let dbUserId = existingUser.rows[0]?.id;

    // Initialize Supabase Admin
    const supabaseAdmin = initializeSupabaseAdmin();

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: 'superfan@test.com',
      password: 'SuperFan123!',
      email_confirm: true,
      user_metadata: {
        display_name: 'Super Fan',
        username: 'superfan'
      }
    });

    if (authError) {
      console.error('❌ Auth error:', authError.message);
      process.exit(1);
    }

    console.log('✅ Supabase Auth user created!');
    console.log('   Auth ID:', authData.user.id);

    // Update the database user with the correct supabase_id
    if (dbUserId) {
      await pool.query(
        'UPDATE users SET supabase_id = $1 WHERE id = $2',
        [authData.user.id, dbUserId]
      );
      console.log('✅ Updated existing database user with Supabase Auth ID');
    } else {
      // Create new database user
      const result = await pool.query(`
        INSERT INTO users (
          id,
          supabase_id,
          email,
          username,
          display_name,
          bio,
          is_creator,
          token_balance,
          email_verified,
          is_admin,
          profile_complete,
          onboarding_completed,
          text_message_price,
          image_message_price,
          audio_message_price,
          video_message_price,
          message_price_cents,
          video_rate_cents,
          voice_rate_cents,
          stream_rate_cents,
          country,
          created_at,
          updated_at
        ) VALUES (
          $1, $1, $2, $3, $4, $5, false, 10000, true, false, true, true,
          50, 100, 150, 200, 100, 0, 0, 0, 'United States', NOW(), NOW()
        )
        RETURNING id
      `, [authData.user.id, 'superfan@test.com', 'superfan', 'Super Fan', 'I love supporting creators!']);

      console.log('✅ Created new database user');
    }

    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log('║   FAN ACCOUNT LOGIN CREDENTIALS ✅     ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');
    console.log('📧 Email:    superfan@test.com');
    console.log('🔑 Password: SuperFan123!');
    console.log('👤 Username: superfan');
    console.log('💰 Balance:  10,000 tokens');
    console.log('');
    console.log('✅ You can now log in with these credentials!');
    console.log('');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

createFanAccount();
