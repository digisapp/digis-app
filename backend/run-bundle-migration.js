#!/usr/bin/env node

/**
 * Run the content_bundles migration on Supabase
 *
 * Usage: node run-bundle-migration.js
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import database pool
const { pool } = require('./utils/db');

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting content_bundles migration...\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '148_create_content_bundles.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded: 148_create_content_bundles.sql');
    console.log('🔗 Connecting to Supabase database...\n');

    // Execute the migration
    await client.query('BEGIN');
    console.log('⚙️  Executing migration SQL...');

    await client.query(migrationSQL);

    await client.query('COMMIT');

    console.log('✅ Migration completed successfully!\n');

    // Verify the table was created
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'content_bundles'
      );
    `);

    if (tableCheck.rows[0].exists) {
      console.log('✅ content_bundles table created');

      // Check columns
      const columnsCheck = await client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'content_bundles'
        ORDER BY ordinal_position;
      `);

      console.log('\n📋 Table columns:');
      columnsCheck.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type}`);
      });
    }

    // Check if bundle_id was added to creator_content
    const bundleIdCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'creator_content' AND column_name = 'bundle_id'
      );
    `);

    if (bundleIdCheck.rows[0].exists) {
      console.log('\n✅ bundle_id column added to creator_content table');
    }

    // Check if category was added to creator_content
    const categoryCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'creator_content' AND column_name = 'category'
      );
    `);

    if (categoryCheck.rows[0].exists) {
      console.log('✅ category column added to creator_content table');
    }

    console.log('\n🎉 Bulk photo upload feature is now ready to use!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    console.error('\nError details:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
