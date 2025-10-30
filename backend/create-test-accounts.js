#!/usr/bin/env node
/**
 * Create Test Accounts
 *
 * Creates a creator and fan test account with predefined credentials
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Test account credentials
const TEST_ACCOUNTS = {
  creator: {
    email: 'creator@test.com',
    password: 'Creator#123',
    username: 'testcreator',
    fullName: 'Test Creator',
    role: 'creator',
    is_creator: true
  },
  fan: {
    email: 'fan@test.com',
    password: 'Fan#123',
    username: 'testfan',
    fullName: 'Test Fan',
    role: 'fan',
    is_creator: false
  }
};

async function createTestAccounts() {
  console.log('🎭 Creating Test Accounts...\n');

  // Validate environment variables
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error('❌ SUPABASE_URL not found in environment variables');
    process.exit(1);
  }

  if (!supabaseServiceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment variables');
    console.error('   This script requires admin/service role key');
    process.exit(1);
  }

  // Create Supabase admin client
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log('📋 Account Details:\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👨‍🎨 CREATOR ACCOUNT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Name:     ${TEST_ACCOUNTS.creator.fullName}`);
  console.log(`   Email:    ${TEST_ACCOUNTS.creator.email}`);
  console.log(`   Password: ${TEST_ACCOUNTS.creator.password}`);
  console.log(`   Username: ${TEST_ACCOUNTS.creator.username}`);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👤 FAN ACCOUNT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Name:     ${TEST_ACCOUNTS.fan.fullName}`);
  console.log(`   Email:    ${TEST_ACCOUNTS.fan.email}`);
  console.log(`   Password: ${TEST_ACCOUNTS.fan.password}`);
  console.log(`   Username: ${TEST_ACCOUNTS.fan.username}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Create Creator Account
    console.log('🔄 Creating creator account...');

    const { data: creatorData, error: creatorError } = await supabase.auth.admin.createUser({
      email: TEST_ACCOUNTS.creator.email,
      password: TEST_ACCOUNTS.creator.password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        username: TEST_ACCOUNTS.creator.username,
        full_name: TEST_ACCOUNTS.creator.fullName,
        is_creator: true,
        role: 'creator',
        creator_type: 'individual'
      }
    });

    if (creatorError) {
      if (creatorError.message.includes('already registered')) {
        console.log('⚠️  Creator account already exists - updating password...');

        // Get existing user
        const { data: users } = await supabase.auth.admin.listUsers();
        const existingCreator = users.users.find(u => u.email === TEST_ACCOUNTS.creator.email);

        if (existingCreator) {
          await supabase.auth.admin.updateUserById(existingCreator.id, {
            password: TEST_ACCOUNTS.creator.password,
            user_metadata: {
              username: TEST_ACCOUNTS.creator.username,
              full_name: TEST_ACCOUNTS.creator.fullName,
              is_creator: true,
              role: 'creator',
              creator_type: 'individual'
            }
          });
          console.log('✅ Creator account updated');
        }
      } else {
        throw new Error(`Failed to create creator: ${creatorError.message}`);
      }
    } else {
      console.log('✅ Creator account created');
      console.log(`   User ID: ${creatorData.user.id}`);
    }

    // Create Fan Account
    console.log('\n🔄 Creating fan account...');

    const { data: fanData, error: fanError } = await supabase.auth.admin.createUser({
      email: TEST_ACCOUNTS.fan.email,
      password: TEST_ACCOUNTS.fan.password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        username: TEST_ACCOUNTS.fan.username,
        full_name: TEST_ACCOUNTS.fan.fullName,
        is_creator: false,
        role: 'fan'
      }
    });

    if (fanError) {
      if (fanError.message.includes('already registered')) {
        console.log('⚠️  Fan account already exists - updating password...');

        // Get existing user
        const { data: users } = await supabase.auth.admin.listUsers();
        const existingFan = users.users.find(u => u.email === TEST_ACCOUNTS.fan.email);

        if (existingFan) {
          await supabase.auth.admin.updateUserById(existingFan.id, {
            password: TEST_ACCOUNTS.fan.password,
            user_metadata: {
              username: TEST_ACCOUNTS.fan.username,
              full_name: TEST_ACCOUNTS.fan.fullName,
              is_creator: false,
              role: 'fan'
            }
          });
          console.log('✅ Fan account updated');
        }
      } else {
        throw new Error(`Failed to create fan: ${fanError.message}`);
      }
    } else {
      console.log('✅ Fan account created');
      console.log(`   User ID: ${fanData.user.id}`);
    }

    console.log('\n' + '━'.repeat(45));
    console.log('🎉 SUCCESS! Test accounts are ready\n');
    console.log('You can now sign in with:');
    console.log('');
    console.log('👨‍🎨 Creator: creator@test.com / Creator#123');
    console.log('👤 Fan:     fan@test.com / Fan#123');
    console.log('━'.repeat(45) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the script
createTestAccounts();
