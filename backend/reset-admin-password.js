require('dotenv').config();
const { initializeSupabaseAdmin } = require('./utils/supabase-admin');

async function resetAdminPassword() {
  try {
    const supabaseAdmin = initializeSupabaseAdmin();
    
    console.log('Resetting admin password...\n');
    
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      '904b9325-08c6-4221-a0ea-2557f852699c',
      { 
        password: 'Admin123!',
        email_confirm: true
      }
    );
    
    if (error) {
      console.error('Error resetting password:', error);
      return;
    }
    
    console.log('✅ Password reset successfully');
    console.log('New credentials:');
    console.log('  Email: admin@digis.cc');
    console.log('  Password: Admin123!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetAdminPassword();