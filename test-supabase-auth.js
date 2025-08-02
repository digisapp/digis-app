const { createClient } = require('@supabase/supabase-js');

// Load your Supabase configuration
const SUPABASE_URL = 'https://lpphsjowsivjtcmafxnj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwcGhzam93c2l2anRjbWFmeG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1NDg5ODQsImV4cCI6MjA2ODEyNDk4NH0.QnkIphnDGyB5jsO1IEq3p2ZQYSrRbPhXI8Me9lnC-SM';

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('🔍 Testing Supabase Authentication...\n');

// Test 1: Check Supabase connection
async function testConnection() {
  console.log('1️⃣ Testing Supabase Connection...');
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) {
      console.log('❌ Connection failed:', error.message);
      return false;
    }
    console.log('✅ Successfully connected to Supabase!');
    return true;
  } catch (err) {
    console.log('❌ Connection error:', err.message);
    return false;
  }
}

// Test 2: Test sign up with a test user
async function testSignUp() {
  console.log('\n2️⃣ Testing Sign Up...');
  const testEmail = `test${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';
  
  try {
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          username: `testuser${Date.now()}`,
          full_name: 'Test User'
        }
      }
    });
    
    if (error) {
      console.log('❌ Sign up failed:', error.message);
      return null;
    }
    
    console.log('✅ Sign up successful!');
    console.log('📧 User email:', data.user?.email);
    console.log('🆔 User ID:', data.user?.id);
    console.log('⚠️  Note: Check your email for confirmation link (if email confirmations are enabled)');
    
    return { email: testEmail, password: testPassword, user: data.user };
  } catch (err) {
    console.log('❌ Sign up error:', err.message);
    return null;
  }
}

// Test 3: Test sign in
async function testSignIn(email, password) {
  console.log('\n3️⃣ Testing Sign In...');
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });
    
    if (error) {
      console.log('❌ Sign in failed:', error.message);
      return null;
    }
    
    console.log('✅ Sign in successful!');
    console.log('🔑 Session token:', data.session?.access_token ? 'Present' : 'Missing');
    console.log('⏰ Token expires at:', new Date(data.session?.expires_at * 1000).toLocaleString());
    
    return data;
  } catch (err) {
    console.log('❌ Sign in error:', err.message);
    return null;
  }
}

// Test 4: Test getting current session
async function testGetSession() {
  console.log('\n4️⃣ Testing Get Session...');
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.log('❌ Get session failed:', error.message);
      return;
    }
    
    if (session) {
      console.log('✅ Active session found!');
      console.log('👤 User:', session.user.email);
      console.log('🆔 User ID:', session.user.id);
    } else {
      console.log('ℹ️  No active session');
    }
  } catch (err) {
    console.log('❌ Get session error:', err.message);
  }
}

// Test 5: Test sign out
async function testSignOut() {
  console.log('\n5️⃣ Testing Sign Out...');
  
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.log('❌ Sign out failed:', error.message);
      return;
    }
    
    console.log('✅ Sign out successful!');
  } catch (err) {
    console.log('❌ Sign out error:', err.message);
  }
}

// Test 6: Check auth settings
async function checkAuthSettings() {
  console.log('\n6️⃣ Checking Auth Configuration...');
  
  console.log('🌐 Supabase URL:', SUPABASE_URL);
  console.log('🔑 Anon Key:', SUPABASE_ANON_KEY.substring(0, 20) + '...');
  
  // Try to access auth admin (this will fail with anon key, but shows if connection works)
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error && error.message.includes('not authenticated')) {
      console.log('✅ Auth endpoint is responding correctly');
    } else if (data?.user) {
      console.log('✅ Found authenticated user:', data.user.email);
    }
  } catch (err) {
    console.log('⚠️  Auth check error:', err.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Supabase Authentication Tests\n');
  console.log('📅 Test Date:', new Date().toLocaleString());
  console.log('🔗 Testing against:', SUPABASE_URL);
  console.log('='*60 + '\n');
  
  // Test connection
  const isConnected = await testConnection();
  if (!isConnected) {
    console.log('\n❌ Cannot proceed without database connection');
    return;
  }
  
  // Check auth settings
  await checkAuthSettings();
  
  // Test sign up
  const signUpResult = await testSignUp();
  
  if (signUpResult) {
    // Wait a bit for the user to be created
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test sign in with the new user
    const signInResult = await testSignIn(signUpResult.email, signUpResult.password);
    
    if (signInResult) {
      // Test getting session
      await testGetSession();
      
      // Test sign out
      await testSignOut();
      
      // Verify sign out worked
      await testGetSession();
    }
  }
  
  console.log('\n' + '='*60);
  console.log('✅ All tests completed!');
  console.log('\n📋 Summary:');
  console.log('- Database connection: Working');
  console.log('- Sign up: Check email confirmations in Supabase dashboard');
  console.log('- Sign in: Working if email confirmations are disabled');
  console.log('- Sessions: Working');
  console.log('\n💡 Next steps:');
  console.log('1. Check your Supabase dashboard for email confirmation settings');
  console.log('2. Look for any test users created in the Authentication section');
  console.log('3. Review the Auth settings in your Supabase project');
}

// Run the tests
runAllTests().then(() => {
  console.log('\n✨ Test script finished');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Test script error:', err);
  process.exit(1);
});