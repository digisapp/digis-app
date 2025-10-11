#!/usr/bin/env node
/**
 * Run the sessions performance migration
 */

require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  try {
    console.log('🚀 Starting sessions performance migration...\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add-sessions-performance-indexes.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split by semicolons but keep them (for executing each statement)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let skipCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comments and empty statements
      if (!statement || statement.startsWith('--')) {
        continue;
      }

      // Extract a readable description
      let description = statement.substring(0, 100).replace(/\n/g, ' ');
      if (statement.length > 100) description += '...';

      try {
        console.log(`[${i + 1}/${statements.length}] Executing: ${description}`);

        const startTime = Date.now();
        await pool.query(statement);
        const duration = Date.now() - startTime;

        console.log(`✅ Success (${duration}ms)\n`);
        successCount++;

      } catch (error) {
        // Check if it's a "already exists" error (which is fine)
        if (error.message.includes('already exists') ||
            error.code === '42P07' ||
            error.code === '42710') {
          console.log(`⏭️  Skipped (already exists)\n`);
          skipCount++;
        } else {
          console.error(`❌ Error: ${error.message}\n`);
          throw error;
        }
      }
    }

    console.log('━'.repeat(80));
    console.log('✅ Migration completed successfully!\n');
    console.log(`Summary:`);
    console.log(`  - Statements executed: ${successCount}`);
    console.log(`  - Statements skipped: ${skipCount}`);
    console.log(`  - Total: ${successCount + skipCount}\n`);

    // Run verification query
    console.log('🔍 Verifying indexes...\n');

    const indexCheck = await pool.query(`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'sessions'
        AND indexname LIKE 'idx_sessions%'
      ORDER BY indexname
    `);

    console.log(`Found ${indexCheck.rows.length} performance indexes on sessions table:`);
    indexCheck.rows.forEach(index => {
      console.log(`  ✓ ${index.indexname}`);
    });
    console.log('');

    // Test query performance
    console.log('⚡ Testing query performance...\n');

    const testQueries = [
      {
        name: 'Active sessions (old slow query)',
        sql: "SELECT COUNT(*) as count FROM sessions WHERE status = 'active'"
      },
      {
        name: 'Active sessions (new fast query)',
        sql: "SELECT EXISTS(SELECT 1 FROM sessions WHERE status = 'active' LIMIT 1) as has_active"
      },
      {
        name: 'Sessions in last 24h',
        sql: "SELECT COUNT(*) FROM sessions WHERE created_at > NOW() - INTERVAL '24 hours'"
      }
    ];

    for (const test of testQueries) {
      const startTime = Date.now();
      await pool.query(test.sql);
      const duration = Date.now() - startTime;

      const status = duration < 100 ? '🚀 FAST' : duration < 1000 ? '⚠️  OK' : '🐌 SLOW';
      console.log(`  ${status} ${test.name}: ${duration}ms`);
    }
    console.log('');

    console.log('✅ All done! The slow query issue should be resolved.\n');

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
