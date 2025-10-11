#!/usr/bin/env node
/**
 * Check Miriam's database records to diagnose sync-user failures
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkMiriamAccount() {
  try {
    console.log('🔍 Searching for Miriam\'s account...\n');

    // Search for Miriam by username, email, or display name
    const userQuery = `
      SELECT id, supabase_id, email, username, display_name,
             is_creator, is_super_admin, role, creator_type, created_at
      FROM users
      WHERE username ILIKE '%miriam%'
         OR email ILIKE '%miriam%'
         OR display_name ILIKE '%miriam%'
      LIMIT 5
    `;

    const userResult = await pool.query(userQuery);

    if (userResult.rows.length === 0) {
      console.log('❌ No user found matching "miriam"');
      console.log('\nSearching for all creators...\n');

      const creatorsQuery = `
        SELECT id, username, display_name, email, is_creator, role
        FROM users
        WHERE is_creator = true
        LIMIT 10
      `;

      const creatorsResult = await pool.query(creatorsQuery);
      console.log(`Found ${creatorsResult.rows.length} creators:`);
      creatorsResult.rows.forEach(user => {
        console.log(`  - ${user.display_name || user.username} (${user.email})`);
      });

      await pool.end();
      return;
    }

    console.log(`✅ Found ${userResult.rows.length} user(s):\n`);

    for (const user of userResult.rows) {
      console.log('━'.repeat(80));
      console.log(`User: ${user.display_name || user.username}`);
      console.log(`  ID: ${user.id}`);
      console.log(`  Supabase ID: ${user.supabase_id || 'NULL ⚠️'}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Username: ${user.username}`);
      console.log(`  Is Creator: ${user.is_creator}`);
      console.log(`  Role: ${user.role || 'NULL ⚠️'}`);
      console.log(`  Creator Type: ${user.creator_type || 'NULL'}`);
      console.log(`  Created: ${user.created_at}`);

      // Check token balance
      const balanceQuery = `
        SELECT balance
        FROM token_balances
        WHERE user_id = $1
      `;

      const balanceResult = await pool.query(balanceQuery, [user.id]);

      if (balanceResult.rows.length === 0) {
        console.log(`  Token Balance: MISSING ❌ (No record in token_balances table)`);
      } else {
        const balance = balanceResult.rows[0];
        console.log(`  Token Balance: ${balance.balance || 0} tokens`);
      }

      // Check for any sessions
      const sessionQuery = `
        SELECT COUNT(*) as session_count
        FROM sessions
        WHERE creator_id = $1 OR user_id = $1
      `;

      const sessionResult = await pool.query(sessionQuery, [user.id]);
      console.log(`  Total Sessions: ${sessionResult.rows[0].session_count}`);

      console.log('━'.repeat(80));
      console.log();
    }

    // Check for NULL or problematic values
    console.log('\n🔍 Checking for data integrity issues...\n');

    const integrityQuery = `
      SELECT
        COUNT(*) FILTER (WHERE supabase_id IS NULL) as missing_supabase_id,
        COUNT(*) FILTER (WHERE email IS NULL) as missing_email,
        COUNT(*) FILTER (WHERE role IS NULL) as missing_role,
        COUNT(*) FILTER (WHERE username IS NULL) as missing_username
      FROM users
      WHERE username ILIKE '%miriam%'
         OR email ILIKE '%miriam%'
         OR display_name ILIKE '%miriam%'
    `;

    const integrityResult = await pool.query(integrityQuery);
    const issues = integrityResult.rows[0];

    if (issues.missing_supabase_id > 0) console.log(`⚠️  ${issues.missing_supabase_id} user(s) missing supabase_id`);
    if (issues.missing_email > 0) console.log(`⚠️  ${issues.missing_email} user(s) missing email`);
    if (issues.missing_role > 0) console.log(`⚠️  ${issues.missing_role} user(s) missing role`);
    if (issues.missing_username > 0) console.log(`⚠️  ${issues.missing_username} user(s) missing username`);

    if (Object.values(issues).every(v => v === 0)) {
      console.log('✅ No obvious data integrity issues found');
    }

    await pool.end();
    console.log('\n✅ Database check complete');

  } catch (error) {
    console.error('❌ Error checking database:', error.message);
    console.error('Stack trace:', error.stack);
    await pool.end();
    process.exit(1);
  }
}

checkMiriamAccount();
