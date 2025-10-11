#!/usr/bin/env node
/**
 * Run Performance Migration
 * Adds indexes to speed up active sessions query from 79s to <100ms
 */

const { exec } = require('child_process');
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

const psqlCommand = `psql "${DATABASE_URL}" -f "${migrationFile}"`;

exec(psqlCommand, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Migration failed:', error.message);
    if (stderr) {
      console.error('Error details:', stderr);
    }
    process.exit(1);
  }

  console.log(stdout);

  if (stderr && !stderr.includes('NOTICE')) {
    console.warn('⚠️  Warnings:', stderr);
  }

  console.log('');
  console.log('✅ Migration completed successfully!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Verify the improvement:');
  console.log('   psql "$DATABASE_URL" -c "EXPLAIN ANALYZE SELECT COUNT(*) FROM sessions WHERE status = \'active\';"');
  console.log('');
  console.log('2. Expected output: Execution time should be <100ms');
});
