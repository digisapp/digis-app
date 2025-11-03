#!/usr/bin/env node
/**
 * Migration script to ensure role column consistency
 * Run with: node run-role-migration.js
 */

const { pool } = require('./utils/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🔄 Starting role consistency migration...');

  try {
    // Read the SQL migration file
    const sqlPath = path.join(__dirname, 'migrations', 'ensure_role_consistency.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the migration
    const result = await pool.query(sql);

    console.log('✅ Migration completed successfully!');

    // Query to show the final distribution
    const stats = await pool.query(`
      SELECT
        role,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
      FROM users
      GROUP BY role
      ORDER BY role
    `);

    console.log('\n📊 Final role distribution:');
    console.table(stats.rows);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
