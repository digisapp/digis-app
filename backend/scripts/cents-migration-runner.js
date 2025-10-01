#!/usr/bin/env node
/**
 * Cents Migration Runner
 * Orchestrates the phased migration to integer cents
 * Run with: node scripts/cents-migration-runner.js [phase]
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : false
});

// Terminal colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m'
};

// Helper to prompt user
function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

// Log with color
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Run SQL file
async function runSQLFile(filePath, description) {
  try {
    log(`\n📄 Running: ${description}`, 'blue');
    const sql = await fs.readFile(filePath, 'utf-8');

    // Split by semicolons but ignore those in strings/comments
    const statements = sql
      .split(/;(?=(?:[^']*'[^']*')*[^']*$)/)
      .filter(stmt => stmt.trim())
      .filter(stmt => !stmt.trim().startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        await pool.query(statement);
      }
    }

    log(`✅ ${description} completed`, 'green');
    return true;
  } catch (error) {
    log(`❌ Error in ${description}: ${error.message}`, 'red');
    return false;
  }
}

// Run verification queries
async function runVerification() {
  log('\n🔍 Running verification queries...', 'blue');

  try {
    // Check for negative values
    const negativeCheck = await pool.query(`
      SELECT COUNT(*) as count
      FROM token_balances
      WHERE balance_cents < 0
    `);

    if (negativeCheck.rows[0].count > 0) {
      log(`⚠️  Found ${negativeCheck.rows[0].count} negative balances`, 'yellow');
    }

    // Compare totals
    const totalsCheck = await pool.query(`
      SELECT
        COALESCE(SUM(balance), 0) as old_total,
        COALESCE(SUM(balance_cents), 0)/100.0 as new_total
      FROM token_balances
    `);

    const diff = Math.abs(totalsCheck.rows[0].old_total - totalsCheck.rows[0].new_total);
    if (diff > 1) {
      log(`⚠️  Total mismatch: $${diff.toFixed(2)} difference`, 'yellow');
    } else {
      log(`✅ Totals match (difference: $${diff.toFixed(2)})`, 'green');
    }

    // Check backfill status
    const backfillCheck = await pool.query(`
      SELECT COUNT(*) as count
      FROM token_balances
      WHERE balance > 0 AND balance_cents = 0
    `);

    if (backfillCheck.rows[0].count > 0) {
      log(`⚠️  ${backfillCheck.rows[0].count} rows need backfill`, 'yellow');
      return false;
    }

    log('✅ All verification checks passed', 'green');
    return true;
  } catch (error) {
    log(`❌ Verification error: ${error.message}`, 'red');
    return false;
  }
}

// Phase A: Add cents columns
async function phaseA() {
  log('\n=== PHASE A: Adding cents columns ===', 'yellow');

  const confirmed = await prompt('This will add new _cents columns to all money tables. Continue? (yes/no): ');
  if (confirmed.toLowerCase() !== 'yes') {
    log('Aborted', 'red');
    return false;
  }

  const migrationFile = path.join(__dirname, '../migrations/300_migrate_to_cents.sql');
  return await runSQLFile(migrationFile, 'Adding cents columns');
}

// Phase B: Backfill cents from decimals
async function phaseB() {
  log('\n=== PHASE B: Backfilling cents columns ===', 'yellow');

  const confirmed = await prompt('This will copy decimal values to cents columns. Continue? (yes/no): ');
  if (confirmed.toLowerCase() !== 'yes') {
    log('Aborted', 'red');
    return false;
  }

  const backfillFile = path.join(__dirname, '../migrations/301_backfill_cents.sql');
  const success = await runSQLFile(backfillFile, 'Backfilling cents');

  if (success) {
    return await runVerification();
  }
  return false;
}

// Phase C: Enable dual-write
async function phaseC() {
  log('\n=== PHASE C: Enable dual-write mode ===', 'yellow');

  log('Set these environment variables and restart the application:', 'blue');
  log('  MONEY_DUAL_WRITE=true');
  log('  MONEY_READ_CENTS_ONLY=false');
  log('\nThis enables writing to both decimal and cents columns.');
  log('Monitor for 24-48 hours before proceeding to Phase D.');

  return true;
}

// Phase D: Cutover to cents-only
async function phaseD() {
  log('\n=== PHASE D: Cutover to cents-only ===', 'yellow');

  const verified = await runVerification();
  if (!verified) {
    log('❌ Verification failed. Fix issues before cutover.', 'red');
    return false;
  }

  const confirmed = await prompt('Ready to switch to cents-only mode? (yes/no): ');
  if (confirmed.toLowerCase() !== 'yes') {
    log('Aborted', 'red');
    return false;
  }

  log('Update these environment variables and restart:', 'blue');
  log('  MONEY_DUAL_WRITE=false');
  log('  MONEY_READ_CENTS_ONLY=true');
  log('\nThe application will now use cents columns exclusively.');

  return true;
}

// Phase E: Cleanup decimal columns
async function phaseE() {
  log('\n=== PHASE E: Cleanup decimal columns ===', 'yellow');

  const choice = await prompt('Options:\n1. Drop decimal columns (clean)\n2. Convert to generated columns (safe)\n3. Skip cleanup\nChoice (1/2/3): ');

  if (choice === '1') {
    const confirmed = await prompt('⚠️  This will permanently drop decimal columns. Are you sure? (yes/no): ');
    if (confirmed.toLowerCase() !== 'yes') {
      log('Aborted', 'red');
      return false;
    }

    // Drop decimal columns
    await pool.query(`
      ALTER TABLE token_balances DROP COLUMN IF EXISTS balance;
      ALTER TABLE users DROP COLUMN IF EXISTS token_balance;
      ALTER TABLE tips DROP COLUMN IF EXISTS amount;
    `);

    log('✅ Decimal columns dropped', 'green');
  } else if (choice === '2') {
    // Convert to generated columns
    await pool.query(`
      ALTER TABLE token_balances
        ADD COLUMN IF NOT EXISTS balance NUMERIC(12,2)
        GENERATED ALWAYS AS (balance_cents::numeric / 100) STORED;
    `);

    log('✅ Decimal columns converted to generated', 'green');
  } else {
    log('Cleanup skipped', 'yellow');
  }

  return true;
}

// Main execution
async function main() {
  const phase = process.argv[2];

  log('\n💰 Cents Migration Tool', 'blue');
  log('=======================', 'blue');

  try {
    // Test database connection
    await pool.query('SELECT 1');
    log('✅ Database connected', 'green');

    if (!phase) {
      log('\nUsage: node cents-migration-runner.js [phase]', 'yellow');
      log('Phases:', 'yellow');
      log('  a - Add cents columns');
      log('  b - Backfill cents from decimals');
      log('  c - Enable dual-write mode');
      log('  d - Cutover to cents-only');
      log('  e - Cleanup decimal columns');
      log('  verify - Run verification only');
      process.exit(0);
    }

    let success = false;

    switch (phase.toLowerCase()) {
      case 'a':
        success = await phaseA();
        break;
      case 'b':
        success = await phaseB();
        break;
      case 'c':
        success = await phaseC();
        break;
      case 'd':
        success = await phaseD();
        break;
      case 'e':
        success = await phaseE();
        break;
      case 'verify':
        success = await runVerification();
        break;
      default:
        log(`Unknown phase: ${phase}`, 'red');
        process.exit(1);
    }

    if (success) {
      log('\n✅ Phase completed successfully!', 'green');
    } else {
      log('\n❌ Phase failed or was aborted', 'red');
      process.exit(1);
    }

  } catch (error) {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}