#!/usr/bin/env node
/**
 * Quick Reset - Delete and recreate users using Supabase API only
 * Bypasses direct database connection issues
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TEST_USERS = [
  {
    email: 'admin@digis.cc',
    password: 'Admin123!',
    username: 'admin',
    display_name: 'Admin User',
    account_type: 'admin'
  },
  {
    email: 'miriam@digis.cc',
    password: 'Creator123!',
    username: 'miriam',
    display_name: 'Miriam',
    account_type: 'creator'
  },
  {
    email: 'sarah@digis.cc',
    password: 'Creator123!',
    username: 'sarah',
    display_name: 'Sarah Johnson',
    account_type: 'creator'
  },
  {
    email: 'alex@digis.cc',
    password: 'Creator123!',
    username: 'alex',
    display_name: 'Alex Chen',
    account_type: 'creator'
  },
  {
    email: 'fan1@digis.cc',
    password: 'Fan123!',
    username: 'fan1',
    display_name: 'John Doe',
    account_type: 'fan'
  },
  {
    email: 'fan2@digis.cc',
    password: 'Fan123!',
    username: 'fan2',
    display_name: 'Jane Smith',
    account_type: 'fan'
  }
];

async function resetUsers() {
  console.log('\n🔄 Quick User Reset via Supabase API\n');

  // Step 1: Delete all existing auth users
  console.log('1️⃣ Deleting existing auth users...');
  const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    console.error('❌ Error listing users:', listError.message);
  } else if (existingUsers?.users) {
    console.log(`   Found ${existingUsers.users.length} existing users`);
    for (const user of existingUsers.users) {
      await supabase.auth.admin.deleteUser(user.id);
      console.log(`   🗑️  Deleted: ${user.email}`);
    }
  }

  console.log('');

  // Step 2: Create new test users
  console.log('2️⃣ Creating fresh test users...\n');

  const results = [];

  for (const userData of TEST_USERS) {
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
          username: userData.username,
          display_name: userData.display_name,
          account_type: userData.account_type,
          age_verified: true
        }
      });

      if (error) throw error;

      const roleEmoji = userData.account_type === 'admin' ? '👑' : userData.account_type === 'creator' ? '🎭' : '👤';
      console.log(`${roleEmoji} ${userData.display_name}`);
      console.log(`   Email: ${userData.email}`);
      console.log(`   Password: ${userData.password}`);
      console.log(`   Type: ${userData.account_type}`);
      console.log(`   Auth ID: ${data.user.id}`);
      console.log('');

      results.push({
        ...userData,
        id: data.user.id,
        success: true
      });

    } catch (error) {
      console.error(`❌ Failed to create ${userData.email}:`, error.message);
      results.push({
        ...userData,
        success: false,
        error: error.message
      });
    }
  }

  // Summary
  const successful = results.filter(r => r.success).length;
  console.log('\n' + '='.repeat(80));
  console.log(`✅ Created ${successful}/${TEST_USERS.length} users successfully`);
  console.log('='.repeat(80) + '\n');

  console.log('⚠️  IMPORTANT: These users need to log in once to sync with database!\n');
  console.log('Next steps:');
  console.log('1. Go to https://digis.cc (or your frontend)');
  console.log('2. Log in with each account');
  console.log('3. The /api/auth/sync-user endpoint will create database records automatically\n');
}

resetUsers().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
