#!/usr/bin/env node

/**
 * Run Firebase Removal Migration
 *
 * This script runs the 999_complete_firebase_removal.sql migration
 * using the Node.js PostgreSQL client.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function runMigration() {
  console.log('🔥 Starting Firebase Removal Migration...');
  console.log('========================================\n');

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL environment variable is not set');
    console.error('Please set it in your .env file or export it');
    process.exit(1);
  }

  // Create database connection pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Test connection
    console.log('📡 Testing database connection...');
    const testResult = await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful\n');

    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '999_complete_firebase_removal.sql');
    console.log('📋 Reading migration file:', migrationPath);

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('✅ Migration file loaded\n');

    // Confirm before proceeding
    console.log('⚠️  WARNING: This migration will:');
    console.log('   1. Remove all firebase_uid references');
    console.log('   2. Migrate all data to use supabase_id (UUID)');
    console.log('   3. Drop firebase_uid column from users table\n');

    // Run migration
    console.log('🔄 Running Firebase Removal Migration...');
    console.log('--------------------------------------\n');

    const result = await pool.query(migrationSQL);

    console.log('\n✅ Migration completed successfully!\n');

    // Verify - check for remaining firebase columns
    console.log('🔍 Verifying migration...');
    console.log('--------------------------------------');

    const verifyResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM information_schema.columns
      WHERE column_name LIKE '%firebase%'
    `);

    const firebaseColumnsRemaining = parseInt(verifyResult.rows[0].count);

    if (firebaseColumnsRemaining === 0) {
      console.log('✅ No Firebase columns remaining');
    } else {
      console.log(`⚠️  Found ${firebaseColumnsRemaining} Firebase-related columns`);
      const columnsResult = await pool.query(`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE column_name LIKE '%firebase%'
      `);
      console.log('Firebase columns still present:');
      console.table(columnsResult.rows);
    }

    console.log('\n✅ Migration Complete!');
    console.log('========================================\n');
    console.log('Next steps:');
    console.log('1. Test your application thoroughly');
    console.log('2. Monitor for any errors in production');
    console.log('3. Check that creator stats, followers, and subscribers work correctly\n');

  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error('Error:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.position) {
      console.error('Error position:', error.position);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
runMigration();
