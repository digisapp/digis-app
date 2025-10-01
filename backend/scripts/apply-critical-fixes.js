#!/usr/bin/env node

/**
 * Script to apply critical fixes to the database
 * Run with: node backend/scripts/apply-critical-fixes.js
 *
 * This fixes the identity mismatch issue between the schema and middleware
 */

const { pool } = require('../utils/db');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  const client = await pool.connect();

  try {
    console.log('🔧 Applying critical database fixes...\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/200_fix_identity_mismatch.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Apply the migration
    await client.query(migrationSQL);

    console.log('✅ Critical fixes applied successfully!');
    console.log('\n📝 Summary of changes:');
    console.log('  - Added supabase_id column to users table');
    console.log('  - Added role column with proper constraints');
    console.log('  - Added money columns in cents for safe calculations');
    console.log('  - Added request tracking columns for observability');
    console.log('  - Created proper indexes for performance');
    console.log('  - Added ENUMs for type safety');

    // Verify the changes
    const { rows: columns } = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'users'
        AND column_name IN ('supabase_id', 'role')
      ORDER BY column_name;
    `);

    if (columns.length === 2) {
      console.log('\n✅ Verification successful! New columns exist:');
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.warn('\n⚠️ Warning: Expected columns may not have been created properly');
    }

  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

// Run the migration
applyMigration()
  .then(() => {
    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });