#!/usr/bin/env node
/**
 * Reset All Users - Delete all users from Supabase Auth and Database
 *
 * WARNING: This is a DESTRUCTIVE operation that will:
 * 1. Delete all users from Supabase Auth
 * 2. Delete all user data from the database (cascading)
 * 3. Reset all related tables (sessions, tokens, payments, etc.)
 *
 * USE WITH EXTREME CAUTION - THIS CANNOT BE UNDONE
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const readline = require('readline');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function countUsers() {
  try {
    // Count database users
    const dbResult = await pool.query('SELECT COUNT(*) FROM users');
    const dbCount = parseInt(dbResult.rows[0].count);

    // Count Supabase Auth users
    const { data: authUsers, error } = await supabase.auth.admin.listUsers();
    const authCount = error ? 0 : authUsers.users.length;

    return { dbCount, authCount };
  } catch (error) {
    console.error('Error counting users:', error);
    return { dbCount: 0, authCount: 0 };
  }
}

async function deleteAllUsers() {
  console.log('\n' + '='.repeat(80));
  console.log('🚨 DELETE ALL USERS - EXTREME CAUTION REQUIRED 🚨');
  console.log('='.repeat(80));

  // Count users
  const { dbCount, authCount } = await countUsers();
  console.log(`\n📊 Current user count:`);
  console.log(`   Database users: ${dbCount}`);
  console.log(`   Supabase Auth users: ${authCount}`);

  if (dbCount === 0 && authCount === 0) {
    console.log('\n✅ No users found. Database is already clean.');
    rl.close();
    await pool.end();
    return;
  }

  console.log('\n⚠️  WARNING: This will permanently delete:');
  console.log('   • All user accounts');
  console.log('   • All user profiles');
  console.log('   • All sessions');
  console.log('   • All token transactions and balances');
  console.log('   • All payments');
  console.log('   • All messages');
  console.log('   • All follows and subscriptions');
  console.log('   • ALL user-related data\n');

  // Confirmation 1
  const confirm1 = await question('Type "DELETE ALL USERS" to continue (or anything else to cancel): ');
  if (confirm1.trim() !== 'DELETE ALL USERS') {
    console.log('\n❌ Operation cancelled.');
    rl.close();
    await pool.end();
    return;
  }

  // Confirmation 2
  const confirm2 = await question('\n⚠️  Are you ABSOLUTELY SURE? Type "YES I AM SURE" to proceed: ');
  if (confirm2.trim() !== 'YES I AM SURE') {
    console.log('\n❌ Operation cancelled.');
    rl.close();
    await pool.end();
    return;
  }

  console.log('\n🔥 Starting deletion process...\n');

  try {
    // Step 1: Delete all users from Supabase Auth
    console.log('1️⃣ Deleting users from Supabase Auth...');
    const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('❌ Error listing auth users:', listError.message);
    } else if (authUsers && authUsers.users) {
      let deleted = 0;
      for (const user of authUsers.users) {
        try {
          await supabase.auth.admin.deleteUser(user.id);
          deleted++;
          if (deleted % 10 === 0) {
            console.log(`   Deleted ${deleted}/${authUsers.users.length} auth users...`);
          }
        } catch (error) {
          console.error(`   ⚠️ Failed to delete auth user ${user.email}:`, error.message);
        }
      }
      console.log(`   ✅ Deleted ${deleted} users from Supabase Auth`);
    }

    // Step 2: Delete all data from database (in correct order due to foreign keys)
    console.log('\n2️⃣ Deleting data from database...');

    const tables = [
      'stream_messages',
      'stream_chat',
      'tips',
      'virtual_gifts_sent',
      'followers',
      'creator_subscriptions',
      'token_transactions',
      'token_balances',
      'payments',
      'stripe_customers',
      'sessions',
      'call_requests',
      'notifications',
      'messages',
      'conversations',
      'creator_applications',
      'saved_creators',
      'content_items',
      'experiences',
      'ticketed_shows',
      'classes',
      'offers',
      'creator_shop_items',
      'creator_analytics',
      'users' // Delete users last
    ];

    for (const table of tables) {
      try {
        const result = await pool.query(`DELETE FROM ${table}`);
        console.log(`   ✅ Deleted ${result.rowCount} rows from ${table}`);
      } catch (error) {
        // Table might not exist, that's okay
        if (error.code !== '42P01') { // undefined_table error code
          console.warn(`   ⚠️ Error deleting from ${table}:`, error.message);
        }
      }
    }

    // Step 3: Reset sequences
    console.log('\n3️⃣ Resetting sequences...');
    try {
      const sequences = await pool.query(`
        SELECT sequence_name
        FROM information_schema.sequences
        WHERE sequence_schema = 'public'
      `);

      for (const row of sequences.rows) {
        await pool.query(`ALTER SEQUENCE ${row.sequence_name} RESTART WITH 1`);
      }
      console.log(`   ✅ Reset ${sequences.rows.length} sequences`);
    } catch (error) {
      console.warn('   ⚠️ Error resetting sequences:', error.message);
    }

    // Final count
    const { dbCount: finalDbCount, authCount: finalAuthCount } = await countUsers();

    console.log('\n' + '='.repeat(80));
    console.log('✅ DELETION COMPLETE');
    console.log('='.repeat(80));
    console.log(`\n📊 Final user count:`);
    console.log(`   Database users: ${finalDbCount}`);
    console.log(`   Supabase Auth users: ${finalAuthCount}`);

    if (finalDbCount === 0 && finalAuthCount === 0) {
      console.log('\n🎉 All users successfully deleted. Database is clean.');
    } else {
      console.log('\n⚠️  Some users may remain. Check manually if needed.');
    }

  } catch (error) {
    console.error('\n❌ Error during deletion:', error);
    throw error;
  } finally {
    rl.close();
    await pool.end();
  }
}

// Run the script
deleteAllUsers().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
