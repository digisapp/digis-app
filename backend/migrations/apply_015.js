#!/usr/bin/env node
// Script to apply migration 015 using Node.js
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function applyMigration() {
  console.log('🔍 Applying migration 015_fix_function_search_path_security.sql...\n');

  // Check DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL not set in .env file');
    process.exit(1);
  }

  console.log('✅ DATABASE_URL found');

  // Read migration file
  const migrationPath = path.join(__dirname, '015_fix_function_search_path_security.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  console.log('📝 Applying migration...\n');

  // Create pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Execute migration
    await pool.query(migrationSQL);

    console.log('\n✅ Migration applied successfully!\n');
    console.log('📊 Verifying function configurations...\n');

    // Verify search_path is set
    const result = await pool.query(`
      SELECT
        proname as function_name,
        prosecdef as is_security_definer,
        proconfig as configuration
      FROM pg_proc
      WHERE proname IN ('cached_auth_uid', 'get_current_user_db_id')
        AND pronamespace = 'public'::regnamespace
      ORDER BY proname;
    `);

    console.log('Function Configurations:');
    console.table(result.rows);

    console.log('\n✅ Verification complete!');
    console.log('\nExpected: Both functions should show configuration = {search_path=public}');
    console.log('\nNext steps:');
    console.log('1. Re-run Supabase Database Linter to confirm warnings resolved');
    console.log('2. Test your app to ensure functions still work correctly');
    console.log('3. Address remaining security warnings (see SECURITY_FIXES.md)');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Details:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
