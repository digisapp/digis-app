#!/usr/bin/env node
/**
 * Create Test Users - Create sample users for testing
 *
 * Creates:
 * - 1 Admin user
 * - 3 Creator users (with different creator types)
 * - 2 Fan users
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const TEST_USERS = [
  {
    email: 'admin@digis.cc',
    password: 'Admin123!',
    username: 'admin',
    display_name: 'Admin User',
    is_creator: false,
    is_super_admin: true,
    role: 'admin'
  },
  {
    email: 'miriam@digis.cc',
    password: 'Creator123!',
    username: 'miriam',
    display_name: 'Miriam',
    is_creator: true,
    is_super_admin: false,
    role: 'creator',
    creator_type: 'entertainer',
    bio: 'Professional entertainer and content creator',
    verified: true
  },
  {
    email: 'sarah@digis.cc',
    password: 'Creator123!',
    username: 'sarah',
    display_name: 'Sarah Johnson',
    is_creator: true,
    is_super_admin: false,
    role: 'creator',
    creator_type: 'educator',
    bio: 'Online educator and mentor',
    verified: true
  },
  {
    email: 'alex@digis.cc',
    password: 'Creator123!',
    username: 'alex',
    display_name: 'Alex Chen',
    is_creator: true,
    is_super_admin: false,
    role: 'creator',
    creator_type: 'artist',
    bio: 'Digital artist and designer',
    verified: true
  },
  {
    email: 'fan1@digis.cc',
    password: 'Fan123!',
    username: 'fan1',
    display_name: 'John Doe',
    is_creator: false,
    is_super_admin: false,
    role: 'fan'
  },
  {
    email: 'fan2@digis.cc',
    password: 'Fan123!',
    username: 'fan2',
    display_name: 'Jane Smith',
    is_creator: false,
    is_super_admin: false,
    role: 'fan'
  }
];

async function createTestUsers() {
  console.log('\n' + '='.repeat(80));
  console.log('🎭 CREATING TEST USERS');
  console.log('='.repeat(80) + '\n');

  const results = {
    success: [],
    failed: []
  };

  for (const userData of TEST_USERS) {
    try {
      console.log(`📝 Creating user: ${userData.email} (${userData.role})...`);

      // 1. Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
          username: userData.username,
          display_name: userData.display_name
        }
      });

      if (authError) {
        throw new Error(`Auth creation failed: ${authError.message}`);
      }

      const userId = authData.user.id;
      console.log(`   ✅ Auth user created: ${userId}`);

      // 2. Create user in database
      const insertQuery = `
        INSERT INTO users (
          id,
          supabase_id,
          email,
          username,
          display_name,
          bio,
          is_creator,
          is_super_admin,
          role,
          creator_type,
          verified,
          email_verified,
          created_at,
          updated_at
        ) VALUES (
          $1::uuid,
          $1::uuid,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          true,
          NOW(),
          NOW()
        )
        RETURNING id, username, is_creator, role
      `;

      const dbResult = await pool.query(insertQuery, [
        userId,
        userData.email,
        userData.username,
        userData.display_name,
        userData.bio || null,
        userData.is_creator,
        userData.is_super_admin,
        userData.role,
        userData.creator_type || null,
        userData.verified || false
      ]);

      console.log(`   ✅ Database user created:`, {
        username: dbResult.rows[0].username,
        is_creator: dbResult.rows[0].is_creator,
        role: dbResult.rows[0].role
      });

      // 3. Create token balance
      await pool.query(`
        INSERT INTO token_balances (
          user_id,
          balance,
          total_earned,
          total_spent,
          total_purchased,
          created_at,
          updated_at
        ) VALUES (
          $1::uuid,
          ${userData.is_creator ? 0 : 100}, -- Give fans 100 tokens to start
          0,
          0,
          ${userData.is_creator ? 0 : 100},
          NOW(),
          NOW()
        )
      `, [userId]);

      console.log(`   ✅ Token balance created`);
      console.log('');

      results.success.push({
        email: userData.email,
        username: userData.username,
        role: userData.role,
        password: userData.password
      });

    } catch (error) {
      console.error(`   ❌ Failed to create ${userData.email}:`, error.message);
      console.log('');
      results.failed.push({
        email: userData.email,
        error: error.message
      });
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 CREATION SUMMARY');
  console.log('='.repeat(80) + '\n');

  console.log(`✅ Successfully created: ${results.success.length} users`);
  console.log(`❌ Failed: ${results.failed.length} users\n`);

  if (results.success.length > 0) {
    console.log('🔑 LOGIN CREDENTIALS:\n');
    results.success.forEach(user => {
      const roleEmoji = user.role === 'admin' ? '👑' : user.role === 'creator' ? '🎭' : '👤';
      console.log(`${roleEmoji} ${user.role.toUpperCase()}: ${user.username}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: ${user.password}`);
      console.log('');
    });
  }

  if (results.failed.length > 0) {
    console.log('❌ FAILED USERS:\n');
    results.failed.forEach(user => {
      console.log(`   ${user.email}: ${user.error}`);
    });
    console.log('');
  }

  console.log('💡 TIP: Save these credentials for testing!\n');

  await pool.end();
}

// Run the script
createTestUsers().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
