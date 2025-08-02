const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

console.log('🔍 Testing Database Connections\n');

// Database connection from backend .env
const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('📋 Configuration:');
console.log('- Supabase URL:', SUPABASE_URL);
console.log('- Database URL:', DATABASE_URL?.split('@')[1]?.split('/')[0] || 'Not set');
console.log('- Service Key:', SUPABASE_SERVICE_KEY ? 'Present' : 'Missing');
console.log('\n' + '='.repeat(60) + '\n');

// Test 1: Direct PostgreSQL connection
async function testDirectDatabase() {
  console.log('1️⃣ Testing Direct PostgreSQL Connection...');
  
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Check current database
    const dbResult = await pool.query('SELECT current_database()');
    console.log('✅ Connected to database:', dbResult.rows[0].current_database);

    // Check users table
    const usersCount = await pool.query('SELECT COUNT(*) FROM users');
    console.log('👥 Total users in database:', usersCount.rows[0].count);

    // Get recent users
    const recentUsers = await pool.query(`
      SELECT id, username, created_at 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log('\n📅 Recent users:');
    recentUsers.rows.forEach(user => {
      console.log(`  - ${user.username || 'No username'} (${user.id}) - Created: ${user.created_at}`);
    });

    // Check if auth.users exists (Supabase auth table)
    try {
      const authUsers = await pool.query('SELECT COUNT(*) FROM auth.users');
      console.log('\n🔐 Auth users (Supabase Auth):', authUsers.rows[0].count);
    } catch (err) {
      console.log('\n⚠️  Cannot access auth.users table (normal for direct connection)');
    }

    await pool.end();
    return true;
  } catch (error) {
    console.error('❌ Database error:', error.message);
    await pool.end();
    return false;
  }
}

// Test 2: Supabase Admin Client
async function testSupabaseAdmin() {
  console.log('\n2️⃣ Testing Supabase Admin Client...');
  
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Get auth users
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) throw authError;
    
    console.log('✅ Total auth users:', authUsers.users.length);
    
    // Show recent auth users
    const recentAuthUsers = authUsers.users
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);
    
    console.log('\n🔐 Recent auth users:');
    recentAuthUsers.forEach(user => {
      console.log(`  - ${user.email} (${user.id}) - Created: ${user.created_at}`);
    });

    // Check our users table via Supabase
    const { data: dbUsers, error: dbError } = await supabaseAdmin
      .from('users')
      .select('id, username, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (dbError) throw dbError;

    console.log('\n📊 Users table via Supabase:');
    dbUsers.forEach(user => {
      console.log(`  - ${user.username || 'No username'} (${user.id}) - Created: ${user.created_at}`);
    });

    return true;
  } catch (error) {
    console.error('❌ Supabase admin error:', error.message);
    return false;
  }
}

// Test 3: Create a test user
async function createTestUser() {
  console.log('\n3️⃣ Creating Test User...');
  
  const testEmail = `test-${Date.now()}@digis.app`;
  const testPassword = 'TestPassword123!';
  
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Create auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        username: `testuser${Date.now()}`
      }
    });

    if (authError) throw authError;

    console.log('✅ Created auth user:', authUser.user.email);
    console.log('🆔 User ID:', authUser.user.id);

    // Check if user appears in our users table
    const pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Wait a moment for triggers to run
    await new Promise(resolve => setTimeout(resolve, 2000));

    const userCheck = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [authUser.user.id]
    );

    if (userCheck.rows.length > 0) {
      console.log('✅ User found in users table!');
    } else {
      console.log('❌ User NOT found in users table');
      console.log('⚠️  This suggests the auth trigger might not be working');
    }

    await pool.end();
    return authUser.user;
  } catch (error) {
    console.error('❌ Error creating test user:', error.message);
    return null;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Database Connection Tests\n');
  
  // Test direct database
  const dbWorking = await testDirectDatabase();
  
  if (!dbWorking) {
    console.log('\n❌ Cannot connect to database. Check your DATABASE_URL');
    return;
  }

  // Test Supabase admin
  const supabaseWorking = await testSupabaseAdmin();
  
  if (!supabaseWorking) {
    console.log('\n⚠️  Supabase admin client issues. Check your service role key');
  }

  // Create test user
  const testUser = await createTestUser();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 Summary:');
  console.log('- Direct database connection:', dbWorking ? '✅ Working' : '❌ Failed');
  console.log('- Supabase admin client:', supabaseWorking ? '✅ Working' : '❌ Failed');
  console.log('- Test user creation:', testUser ? '✅ Created' : '❌ Failed');
  
  console.log('\n💡 Next Steps:');
  console.log('1. Check if the test user appears in your Supabase dashboard');
  console.log('2. Verify the database URL matches your Supabase project');
  console.log('3. Check if there are any database triggers or RLS policies affecting user creation');
}

// Run tests
runAllTests().then(() => {
  console.log('\n✨ Test complete');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Test error:', err);
  process.exit(1);
});