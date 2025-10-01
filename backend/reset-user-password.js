require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function resetUserPassword(email, newPassword) {
  try {
    console.log(`\n🔄 Resetting password for: ${email}\n`);
    
    // First find the user
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError.message);
      return;
    }
    
    const user = users.users.find(u => u.email === email);
    
    if (!user) {
      console.error(`❌ User ${email} not found`);
      return;
    }
    
    console.log(`✅ Found user: ${user.email} (ID: ${user.id})`);
    
    // Update the password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );
    
    if (updateError) {
      console.error('❌ Error updating password:', updateError.message);
      return;
    }
    
    console.log('✅ Password updated successfully!');
    
    // Test the new password
    console.log('\n🔐 Testing new password...');
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: email,
      password: newPassword
    });
    
    if (signInError) {
      console.error('❌ Sign in failed:', signInError.message);
    } else {
      console.log('✅ Sign in successful with new password!');
    }
    
    console.log('\n✨ Password reset complete!');
    console.log(`   Email: ${email}`);
    console.log(`   New Password: ${newPassword}`);
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Reset passwords for your accounts
const accountsToReset = [
  { email: 'nathan@examodels.com', password: 'Nathan123!' },
  { email: 'miriam@examodels.com', password: 'Miriam123!' },
  { email: 'admin@digis.cc', password: 'Admin123!' }
];

async function resetAllPasswords() {
  for (const account of accountsToReset) {
    await resetUserPassword(account.email, account.password);
    console.log('\n-------------------\n');
  }
}

resetAllPasswords();