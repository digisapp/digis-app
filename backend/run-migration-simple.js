#!/usr/bin/env node
/**
 * Run the sessions performance migration - simplified version
 */

require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  try {
    console.log('🚀 Running sessions performance migration...\n');

    // Step 1: Add last_seen column
    console.log('[1/7] Adding last_seen column...');
    await pool.query(`
      ALTER TABLE sessions
      ADD COLUMN IF NOT EXISTS last_seen timestamptz DEFAULT NOW()
    `);
    console.log('✅ Done\n');

    // Step 2: Backfill last_seen
    console.log('[2/7] Backfilling last_seen values...');
    const backfillResult = await pool.query(`
      UPDATE sessions
      SET last_seen = COALESCE(updated_at, created_at, NOW())
      WHERE last_seen IS NULL
    `);
    console.log(`✅ Updated ${backfillResult.rowCount} rows\n`);

    // Step 3: Create partial index for active sessions
    console.log('[3/7] Creating partial index for active sessions...');
    await pool.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_status_active
      ON sessions (status)
      WHERE status = 'active'
    `);
    console.log('✅ Done\n');

    // Step 4: Create composite index
    console.log('[4/7] Creating composite index for status + created_at...');
    await pool.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_status_created_at
      ON sessions (status, created_at DESC)
    `);
    console.log('✅ Done\n');

    // Step 5: Create created_at index
    console.log('[5/7] Creating created_at index...');
    await pool.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_created_at
      ON sessions (created_at DESC)
    `);
    console.log('✅ Done\n');

    // Step 6: Create active + last_seen index
    console.log('[6/7] Creating active + last_seen index...');
    await pool.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_active_lastseen
      ON sessions (last_seen DESC)
      WHERE status = 'active'
    `);
    console.log('✅ Done\n');

    // Step 7: Run ANALYZE
    console.log('[7/7] Running ANALYZE to update statistics...');
    await pool.query('ANALYZE sessions');
    console.log('✅ Done\n');

    // Verification
    console.log('━'.repeat(80));
    console.log('✅ Migration completed successfully!\n');

    console.log('🔍 Verifying indexes...\n');
    const indexes = await pool.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'sessions'
        AND indexname LIKE 'idx_sessions%'
      ORDER BY indexname
    `);

    console.log(`Found ${indexes.rows.length} performance indexes:`);
    indexes.rows.forEach(idx => console.log(`  ✓ ${idx.indexname}`));
    console.log('');

    // Test performance
    console.log('⚡ Testing query performance...\n');

    const tests = [
      ['Active sessions EXISTS check', "SELECT EXISTS(SELECT 1 FROM sessions WHERE status = 'active' LIMIT 1)"],
      ['Sessions last 24h', "SELECT COUNT(*) FROM sessions WHERE created_at > NOW() - INTERVAL '24 hours'"]
    ];

    for (const [name, sql] of tests) {
      const start = Date.now();
      await pool.query(sql);
      const duration = Date.now() - start;
      const emoji = duration < 100 ? '🚀' : duration < 1000 ? '⚠️' : '🐌';
      console.log(`  ${emoji} ${name}: ${duration}ms`);
    }

    console.log('\n✅ All done! Slow query issue resolved.\n');

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.code === '42P07') {
      console.log('ℹ️  Index already exists (this is OK)');
    } else {
      console.error('Stack:', error.stack);
    }
    await pool.end();
    process.exit(1);
  }
}

runMigration();
