#!/usr/bin/env node

/**
 * Apply ALL critical database fixes in sequence
 * Run with: node backend/scripts/apply-all-critical-fixes.js
 *
 * Migrations applied:
 * 1. 200_fix_identity_mismatch.sql - Adds supabase_id, role, cents columns
 * 2. 201_stripe_webhook_dedupe.sql - Adds webhook deduplication table
 * 3. 202_drop_decimals_enforce_cents.sql - (OPTIONAL) Drops decimal columns
 */

const { pool } = require('../utils/db');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function runMigration(migrationFile, description) {
  const client = await pool.connect();

  try {
    console.log(chalk.blue(`\n🔧 Applying: ${description}`));
    console.log(chalk.gray(`   File: ${migrationFile}`));

    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations', migrationFile);
    if (!fs.existsSync(migrationPath)) {
      console.log(chalk.yellow(`   ⚠️ Migration file not found, skipping`));
      return false;
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Start transaction
    await client.query('BEGIN');

    // Apply the migration
    await client.query(migrationSQL);

    // Commit transaction
    await client.query('COMMIT');

    console.log(chalk.green(`   ✅ ${description} - Applied successfully!`));
    return true;

  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');

    if (error.code === '42P07') { // duplicate_table
      console.log(chalk.yellow(`   ⚠️ Already applied (table exists)`));
      return true;
    } else if (error.code === '42701') { // duplicate_column
      console.log(chalk.yellow(`   ⚠️ Already applied (column exists)`));
      return true;
    } else {
      console.error(chalk.red(`   ❌ Error: ${error.message}`));
      return false;
    }
  } finally {
    client.release();
  }
}

async function checkMigrationStatus() {
  const client = await pool.connect();

  try {
    console.log(chalk.cyan('\n📊 Checking current database status...'));

    // Check if supabase_id exists
    const { rows: supabaseIdCheck } = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'supabase_id'
    `);

    // Check if role column exists
    const { rows: roleCheck } = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'role'
    `);

    // Check if cents columns exist
    const { rows: centsCheck } = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'video_rate_cents'
    `);

    // Check if webhook table exists
    const { rows: webhookCheck } = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_name = 'stripe_webhook_events'
    `);

    // Check if decimal columns still exist
    const { rows: decimalCheck } = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name IN ('price_per_min', 'creator_rate', 'video_price')
    `);

    console.log(chalk.gray('   Current status:'));
    console.log(`   • supabase_id column: ${supabaseIdCheck[0].count > 0 ? chalk.green('✓ exists') : chalk.red('✗ missing')}`);
    console.log(`   • role column: ${roleCheck[0].count > 0 ? chalk.green('✓ exists') : chalk.red('✗ missing')}`);
    console.log(`   • cents columns: ${centsCheck[0].count > 0 ? chalk.green('✓ exists') : chalk.red('✗ missing')}`);
    console.log(`   • webhook dedup table: ${webhookCheck[0].count > 0 ? chalk.green('✓ exists') : chalk.red('✗ missing')}`);
    console.log(`   • decimal columns: ${decimalCheck[0].count > 0 ? chalk.yellow('⚠ still present') : chalk.green('✓ removed')}`);

    return {
      hasIdentityFix: supabaseIdCheck[0].count > 0 && roleCheck[0].count > 0,
      hasCentsColumns: centsCheck[0].count > 0,
      hasWebhookTable: webhookCheck[0].count > 0,
      hasDecimalColumns: decimalCheck[0].count > 0
    };

  } finally {
    client.release();
  }
}

async function main() {
  console.log(chalk.magenta.bold('\n🚀 Digis Platform - Critical Database Fixes'));
  console.log(chalk.gray('─'.repeat(60)));

  try {
    // Check current status
    const status = await checkMigrationStatus();

    // Track what needs to be applied
    const migrations = [];

    if (!status.hasIdentityFix || !status.hasCentsColumns) {
      migrations.push({
        file: '200_fix_identity_mismatch.sql',
        description: 'Identity mismatch fixes (supabase_id, role, cents columns)',
        required: true
      });
    }

    if (!status.hasWebhookTable) {
      migrations.push({
        file: '201_stripe_webhook_dedupe.sql',
        description: 'Stripe webhook deduplication',
        required: true
      });
    }

    // Phase 2 migration is optional
    if (status.hasCentsColumns && status.hasDecimalColumns) {
      migrations.push({
        file: '202_drop_decimals_enforce_cents.sql',
        description: 'Drop decimal columns (DESTRUCTIVE)',
        required: false
      });
    }

    if (migrations.length === 0) {
      console.log(chalk.green('\n✅ All critical fixes are already applied!'));
      process.exit(0);
    }

    // Show what will be applied
    console.log(chalk.yellow(`\n📋 Migrations to apply (${migrations.length}):`));
    migrations.forEach((m, i) => {
      const icon = m.required ? '🔴' : '🟡';
      console.log(`   ${i + 1}. ${icon} ${m.description}`);
    });

    // Confirm
    const answer = await askQuestion(chalk.cyan('\nProceed with migrations? (yes/no): '));
    if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
      console.log(chalk.yellow('\n⚠️ Migration cancelled by user'));
      process.exit(0);
    }

    // Apply required migrations
    let successCount = 0;
    for (const migration of migrations.filter(m => m.required)) {
      const success = await runMigration(migration.file, migration.description);
      if (success) successCount++;
    }

    // Ask about optional migrations
    const optionalMigrations = migrations.filter(m => !m.required);
    if (optionalMigrations.length > 0) {
      console.log(chalk.yellow('\n⚠️ Optional migrations available:'));

      for (const migration of optionalMigrations) {
        console.log(chalk.yellow(`\n   ${migration.description}`));
        console.log(chalk.red('   WARNING: This will DROP columns and is irreversible!'));

        const answer = await askQuestion(chalk.cyan('   Apply this migration? (yes/no): '));
        if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
          const success = await runMigration(migration.file, migration.description);
          if (success) successCount++;
        } else {
          console.log(chalk.gray('   Skipped'));
        }
      }
    }

    // Final verification
    console.log(chalk.cyan('\n🔍 Running final verification...'));
    const finalStatus = await checkMigrationStatus();

    // Summary
    console.log(chalk.gray('\n' + '─'.repeat(60)));
    console.log(chalk.green.bold(`✅ Migration Summary:`));
    console.log(`   • Migrations applied: ${successCount}`);
    console.log(`   • Identity fix: ${finalStatus.hasIdentityFix ? chalk.green('✓') : chalk.red('✗')}`);
    console.log(`   • Webhook dedup: ${finalStatus.hasWebhookTable ? chalk.green('✓') : chalk.red('✗')}`);
    console.log(`   • Using cents: ${finalStatus.hasCentsColumns ? chalk.green('✓') : chalk.red('✗')}`);

    if (finalStatus.hasIdentityFix && finalStatus.hasWebhookTable && finalStatus.hasCentsColumns) {
      console.log(chalk.green.bold('\n🎉 All critical fixes applied successfully!'));

      console.log(chalk.cyan('\n📝 Next steps:'));
      console.log('   1. Restart the backend server to use new columns');
      console.log('   2. Run verification: node backend/scripts/verify-identity-and-balance.js <SUPABASE_ID>');
      console.log('   3. Check logs for any column-related errors');
      console.log('   4. Once stable, consider running migration 202 to drop decimal columns');
    } else {
      console.log(chalk.yellow('\n⚠️ Some migrations may need manual attention'));
    }

  } catch (error) {
    console.error(chalk.red('\n💥 Fatal error:'), error.message);
    console.error(chalk.gray('Full error:'), error);
    process.exit(1);
  } finally {
    rl.close();
    await pool.end();
  }
}

// Run the migrations
main()
  .then(() => {
    console.log(chalk.green('\n✨ Process completed'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('\n💥 Unexpected error:'), error);
    process.exit(1);
  });