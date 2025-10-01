#!/usr/bin/env node

/**
 * Run token_version migration
 */

require('dotenv').config();
const { pool } = require('./utils/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🚀 Running token_version migration...\n');

  const client = await pool.connect();

  try {
    // Read the migration file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', 'ADD_TOKEN_VERSION.sql'),
      'utf8'
    );

    // Run the migration
    await client.query(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('   - Added token_version column to users table');
    console.log('   - Created index for faster lookups');
    console.log('   - Added column comment');

    // Verify the column was added
    const result = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name = 'token_version'
    `);

    if (result.rows.length > 0) {
      console.log('\n✅ Verification successful:');
      console.log('   Column:', result.rows[0].column_name);
      console.log('   Type:', result.rows[0].data_type);
      console.log('   Default:', result.rows[0].column_default);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();