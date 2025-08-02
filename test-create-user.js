const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

async function createTestUser() {
  console.log('🚀 Creating test user with timestamp:', new Date().toISOString());
  
  // Create Supabase admin client
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const timestamp = Date.now();
  const testEmail = `testuser${timestamp}@example.com`;
  const testPassword = 'TestPassword123!';
  const testUsername = `testuser${timestamp}`;

  try {
    console.log('\n1️⃣ Creating user in Supabase Auth...');
    console.log('📧 Email:', testEmail);
    console.log('👤 Username:', testUsername);

    // Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        username: testUsername,
        full_name: 'Test User ' + timestamp
      }
    });

    if (authError) {
      console.error('❌ Auth error:', authError.message);
      return;
    }

    console.log('✅ Created auth user!');
    console.log('🆔 Auth User ID:', authUser.user.id);
    console.log('📧 Auth Email:', authUser.user.email);

    // Wait a moment for any triggers
    console.log('\n⏳ Waiting 3 seconds for database triggers...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if user appears in users table
    console.log('\n2️⃣ Checking users table...');
    
    const pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    const userCheck = await pool.query(
      'SELECT id, username, created_at FROM users WHERE id = $1',
      [authUser.user.id]
    );

    if (userCheck.rows.length > 0) {
      console.log('✅ User found in users table!');
      console.log('👤 Database user:', userCheck.rows[0]);
    } else {
      console.log('❌ User NOT found in users table');
      console.log('\n3️⃣ Manually creating user in users table...');
      
      // Manually insert into users table
      const insertResult = await pool.query(`
        INSERT INTO users (id, username, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
        RETURNING *
      `, [authUser.user.id, testUsername]);
      
      console.log('✅ Manually created user in users table:', insertResult.rows[0].username);
      
      // Also create token balance
      await pool.query(`
        INSERT INTO token_balances (user_id, balance, created_at, updated_at)
        VALUES ($1, 0, NOW(), NOW())
        ON CONFLICT (user_id) DO NOTHING
      `, [authUser.user.id]);
      
      console.log('✅ Created token balance record');
    }

    // Final check - count all users
    const countResult = await pool.query('SELECT COUNT(*) FROM users');
    console.log('\n📊 Total users in database now:', countResult.rows[0].count);

    await pool.end();

    console.log('\n✅ Test complete!');
    console.log('\n📋 Summary:');
    console.log('- Email:', testEmail);
    console.log('- Password:', testPassword);
    console.log('- User ID:', authUser.user.id);
    console.log('\n🔍 Check your Supabase dashboard:');
    console.log(`https://supabase.com/dashboard/project/${SUPABASE_URL.split('.')[0].split('//')[1]}/auth/users`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the test
createTestUser().then(() => {
  console.log('\n✨ Done!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});