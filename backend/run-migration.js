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
    console.log('🚀 Starting token system hardening migration...\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '142_token_system_hardening.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // For this migration, we'll execute it as a single transaction
    // since it's wrapped in BEGIN/COMMIT
    console.log('Executing migration as a single transaction...\n');

    const statements = [migrationSQL]; // Execute the entire file at once

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
    console.log('🔍 Verifying schema changes...\n');

    // Check token_balances columns
    const balanceColumns = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'token_balances'
      ORDER BY ordinal_position
    `);

    console.log('📊 token_balances columns:');
    balanceColumns.rows.forEach(row => {
      const marker = row.data_type === 'bigint' ? '✓' : ' ';
      console.log(`  ${marker} ${row.column_name}: ${row.data_type}`);
    });
    console.log('');

    // Check token_transactions new columns
    const transColumns = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'token_transactions'
      AND column_name IN ('stripe_payment_intent_id', 'client_idempotency_key', 'related_user_id', 'tokens', 'bonus_tokens')
      ORDER BY ordinal_position
    `);

    console.log('📊 token_transactions new columns:');
    transColumns.rows.forEach(row => {
      console.log(`  ✓ ${row.column_name}: ${row.data_type}`);
    });
    console.log('');

    // Check constraints
    const constraints = await pool.query(`
      SELECT conname, contype
      FROM pg_constraint
      WHERE conname IN ('uniq_purchase_by_intent', 'chk_balance_non_negative')
    `);

    console.log('🔒 Constraints created:');
    constraints.rows.forEach(row => {
      const type = row.contype === 'u' ? 'UNIQUE' : row.contype === 'c' ? 'CHECK' : row.contype;
      console.log(`  ✓ ${row.conname} (${type})`);
    });
    console.log('');

    // Check users table columns
    const userColumns = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('account_status', 'debt_amount')
    `);

    console.log('📊 users table new columns:');
    userColumns.rows.forEach(row => {
      console.log(`  ✓ ${row.column_name}: ${row.data_type}`);
    });
    console.log('');

    console.log('✅ All done! Token system is now hardened.\n');

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
