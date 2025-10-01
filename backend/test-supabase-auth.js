require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase Admin client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 Supabase Configuration:');
console.log('   URL:', supabaseUrl);
console.log('   Service Key:', supabaseServiceKey ? 'Present' : 'MISSING');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testAuth() {
  try {
    console.log('\n📋 Testing Supabase Auth Connection...\n');
    
    // 1. Test connection by listing users
    console.log('1️⃣ Fetching existing users...');
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError.message);
      return;
    }
    
    console.log(`✅ Found ${users.users.length} users in the database`);
    
    // Show first few users (without sensitive data)
    if (users.users.length > 0) {
      console.log('\n📦 Sample users:');
      users.users.slice(0, 5).forEach(user => {
        console.log(`   - ${user.email} (ID: ${user.id.substring(0, 8)}...)`);
      });
    }
    
    // 2. Create a test user
    const testEmail = 'test@digis.cc';
    const testPassword = 'TestPassword123!';
    
    console.log(`\n2️⃣ Creating test user: ${testEmail}`);
    
    // First check if user exists
    const existingUser = users.users.find(u => u.email === testEmail);
    
    if (existingUser) {
      console.log('⚠️  Test user already exists, updating password...');
      
      // Update password for existing user
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        { password: testPassword }
      );
      
      if (updateError) {
        console.error('❌ Error updating password:', updateError.message);
      } else {
        console.log('✅ Password updated successfully!');
      }
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true,
        user_metadata: {
          username: 'testuser',
          is_creator: false
        }
      });
      
      if (createError) {
        console.error('❌ Error creating user:', createError.message);
      } else {
        console.log('✅ Test user created successfully!');
        console.log(`   ID: ${newUser.user.id}`);
      }
    }
    
    // 3. Test sign in with the test user
    console.log('\n3️⃣ Testing sign in with test user...');
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    
    if (signInError) {
      console.error('❌ Sign in failed:', signInError.message);
    } else {
      console.log('✅ Sign in successful!');
      console.log(`   Session token: ${signInData.session.access_token.substring(0, 20)}...`);
    }
    
    // 4. Show specific users if requested
    const checkEmails = [
      'nathan@examodels.com',
      'miriam@examodels.com',
      'admin@digis.cc'
    ];
    
    console.log('\n4️⃣ Checking requested users:');
    checkEmails.forEach(email => {
      const user = users.users.find(u => u.email === email);
      if (user) {
        console.log(`   ✅ ${email} exists (ID: ${user.id.substring(0, 8)}...)`);
        console.log(`      Created: ${new Date(user.created_at).toLocaleDateString()}`);
        console.log(`      Confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
      } else {
        console.log(`   ❌ ${email} not found`);
      }
    });
    
    console.log('\n✨ Test Complete!');
    console.log('\nYou can now sign in with:');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testAuth();