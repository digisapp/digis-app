#!/usr/bin/env node
/**
 * Run Performance Migration using Node.js pg library
 * Adds indexes to speed up active sessions query from 79s to <100ms
 */

const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL not found in .env file');
  console.error('Please set DATABASE_URL in backend/.env');
  process.exit(1);
}

console.log('🔍 Database URL found (masked):', DATABASE_URL.replace(/:([^@]+)@/, ':****@'));

const migrationFile = path.join(__dirname, 'migrations', 'add-sessions-performance-indexes.sql');

if (!fs.existsSync(migrationFile)) {
  console.error('❌ ERROR: Migration file not found:', migrationFile);
  process.exit(1);
}

console.log('📄 Migration file:', migrationFile);
console.log('');
console.log('🚀 Running migration...');
console.log('   This will create indexes to speed up session queries');
console.log('   Expected improvement: 79 seconds → <100ms (790x faster)');
console.log('');

// Read the migration SQL
const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

// Create a connection pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Supabase requires SSL
  }
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('✅ Connected to database');
    console.log('');

    // Split SQL into individual statements (by semicolon)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Running ${statements.length} SQL statements...`);
    console.log('');

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];

      // Skip comments
      if (stmt.startsWith('--') || stmt.length === 0) continue;

      // Extract first few words for logging
      const preview = stmt.substring(0, 60).replace(/\s+/g, ' ') + '...';
      console.log(`[${i + 1}/${statements.length}] ${preview}`);

      try {
        await client.query(stmt);
        console.log('     ✅ Success');
      } catch (error) {
        // Check if it's a "already exists" error (which is OK)
        if (error.message.includes('already exists')) {
          console.log('     ⚠️  Already exists (skipping)');
        } else {
          console.error('     ❌ Failed:', error.message);
          throw error;
        }
      }
      console.log('');
    }

    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('📊 Verifying indexes were created...');

    // Verify indexes
    const indexCheck = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'sessions'
      AND indexname LIKE 'idx_sessions_%'
      ORDER BY indexname;
    `);

    console.log(`   Found ${indexCheck.rows.length} indexes on sessions table:`);
    indexCheck.rows.forEach(row => {
      console.log(`   - ${row.indexname}`);
    });

    console.log('');
    console.log('🎉 All done!');
    console.log('');
    console.log('Next: Test query performance with:');
    console.log('   SELECT COUNT(*) FROM sessions WHERE status = \'active\';');
    console.log('   (Should complete in <100ms, was 79,000ms)');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
