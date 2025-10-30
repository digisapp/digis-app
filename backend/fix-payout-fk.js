#!/usr/bin/env node
/**
 * Fix creator_payout_intents foreign key constraint
 *
 * Adds ON UPDATE CASCADE to allow updating users.supabase_id during account merging
 */

require('dotenv').config();
const { Pool } = require('pg');

async function fixForeignKey() {
  console.log('🔧 Fixing creator_payout_intents foreign key constraint...\n');

  // Use direct connection (not pooler) for DDL operations
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in environment');
    process.exit(1);
  }

  // Check if using pooler
  if (connectionString.includes('pooler.supabase.com')) {
    console.error('❌ Cannot run DDL operations through pooler');
    console.error('   Please use direct connection or run in Supabase SQL Editor');
    console.error('\n   SQL to run:\n');
    console.log(sqlCommand);
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 30000 // 30 second timeout
  });

  const sqlCommand = `
-- Drop existing constraint
ALTER TABLE creator_payout_intents
  DROP CONSTRAINT IF EXISTS fk_creator_payout_intents_user;

-- Recreate with ON UPDATE CASCADE
DO $$
BEGIN
  -- Check if users table uses supabase_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'supabase_id'
  ) THEN
    -- Add FK with both ON DELETE CASCADE and ON UPDATE CASCADE
    EXECUTE 'ALTER TABLE creator_payout_intents
             ADD CONSTRAINT fk_creator_payout_intents_user
             FOREIGN KEY (user_id) REFERENCES users(supabase_id)
             ON DELETE CASCADE ON UPDATE CASCADE';
    RAISE NOTICE 'Added FK referencing users(supabase_id) with ON UPDATE CASCADE';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    -- Add FK with both ON DELETE CASCADE and ON UPDATE CASCADE
    EXECUTE 'ALTER TABLE creator_payout_intents
             ADD CONSTRAINT fk_creator_payout_intents_user
             FOREIGN KEY (user_id) REFERENCES users(id)
             ON DELETE CASCADE ON UPDATE CASCADE';
    RAISE NOTICE 'Added FK referencing users(id) with ON UPDATE CASCADE';
  ELSE
    RAISE EXCEPTION 'Could not find suitable users column (id or supabase_id)';
  END IF;
END $$;
`;

  try {
    console.log('Connecting to database...');
    await pool.query('SELECT 1'); // Test connection
    console.log('✅ Connected\n');

    console.log('Executing SQL...');
    const result = await pool.query(sqlCommand);
    console.log('✅ SQL executed successfully\n');

    if (result.notices) {
      result.notices.forEach(notice => console.log('📝', notice.message));
    }

    console.log('\n✅ Foreign key constraint fixed!');
    console.log('   Now users.supabase_id can be updated without FK violations\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.detail) console.error('   Detail:', error.detail);
    if (error.hint) console.error('   Hint:', error.hint);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixForeignKey();
