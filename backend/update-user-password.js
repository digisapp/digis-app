#!/usr/bin/env node
/**
 * Update Supabase User Password
 *
 * This script updates a user's password using Supabase Admin API
 *
 * Usage:
 *   node update-user-password.js <email> <new-password>
 *
 * Example:
 *   node update-user-password.js nathan@examodels.com "Nathan#123"
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function updateUserPassword(email, newPassword) {
  console.log('🔐 Updating user password...\n');

  // Validate environment variables
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error('❌ SUPABASE_URL not found in environment variables');
    process.exit(1);
  }

  if (!supabaseServiceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment variables');
    console.error('   This script requires admin/service role key to update passwords');
    process.exit(1);
  }

  // Create Supabase admin client
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Step 1: Find user by email
    console.log(`📧 Looking up user: ${email}`);
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`);
    }

    const user = users.users.find(u => u.email === email);

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      console.log('\n📋 Available users:');
      users.users.forEach(u => {
        console.log(`   - ${u.email} (${u.id})`);
      });
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.email}`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);
    console.log(`   Last Sign In: ${user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}\n`);

    // Step 2: Update password
    console.log(`🔄 Updating password for ${email}...`);

    const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        password: newPassword
      }
    );

    if (updateError) {
      throw new Error(`Failed to update password: ${updateError.message}`);
    }

    console.log('\n✅ Password updated successfully!');
    console.log(`\n📝 New credentials:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${newPassword}`);
    console.log(`\n⚠️  Please change this password after first login for security.\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('Usage: node update-user-password.js <email> <new-password>');
  console.log('\nExample:');
  console.log('  node update-user-password.js nathan@examodels.com "Nathan#123"');
  process.exit(1);
}

const [email, newPassword] = args;

// Run the update
updateUserPassword(email, newPassword);
