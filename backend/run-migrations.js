const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Priority migrations that should be run in order
const priorityMigrations = [
  '001_initial_schema.sql',
  '004_supabase_auth_migration.sql',
  '006_supabase_functions.sql',
  '010_create_creator_payouts.sql',
  'add_indexes.sql',
  '202_drop_decimals_enforce_cents.sql'
];

async function runMigrations() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting database migration process...\n');

    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        success BOOLEAN DEFAULT true,
        error_message TEXT
      )
    `);
    console.log('✅ Migrations tracking table ready');

    // Get list of already executed migrations
    const executedResult = await client.query('SELECT filename FROM migrations WHERE success = true');
    const executedMigrations = new Set(executedResult.rows.map(r => r.filename));
    console.log(`📊 Found ${executedMigrations.size} already executed migrations\n`);

    // Read all migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    let migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    // Reorder to run priority migrations first
    const priorityFiles = [];
    const otherFiles = [];

    for (const file of migrationFiles) {
      if (priorityMigrations.includes(file)) {
        priorityFiles.push(file);
      } else {
        otherFiles.push(file);
      }
    }

    migrationFiles = [...priorityFiles.sort(), ...otherFiles.sort()];

    console.log(`📁 Found ${migrationFiles.length} migration files`);
    console.log(`🎯 Will run priority migrations first: ${priorityFiles.length} files\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // Run each migration
    for (const file of migrationFiles) {
      if (executedMigrations.has(file)) {
        console.log(`⏭️  Skipping ${file} (already executed)`);
        skipCount++;
        continue;
      }

      console.log(`\n🔄 Running migration: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        // Begin transaction for this migration
        await client.query('BEGIN');

        // Split by semicolon but be careful with functions/procedures
        const statements = sql
          .split(/;\s*$/gm)
          .filter(s => s.trim())
          .map(s => s.trim() + ';');

        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i];
          if (!statement.trim() || statement.trim() === ';') continue;

          // Skip comments
          if (statement.trim().startsWith('--')) continue;

          try {
            await client.query(statement);
          } catch (stmtError) {
            // Ignore certain expected errors
            if (stmtError.message.includes('already exists') ||
                stmtError.message.includes('does not exist') && statement.includes('DROP')) {
              console.log(`   ⚠️  Non-critical: ${stmtError.message.substring(0, 60)}...`);
            } else {
              throw stmtError;
            }
          }
        }

        // Record successful migration
        await client.query(
          'INSERT INTO migrations (filename, success) VALUES ($1, $2) ON CONFLICT (filename) DO UPDATE SET executed_at = CURRENT_TIMESTAMP, success = $2',
          [file, true]
        );

        await client.query('COMMIT');
        console.log(`   ✅ Successfully executed ${file}`);
        successCount++;

      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`   ❌ Error in ${file}: ${error.message}`);

        // Record failed migration
        await client.query(
          'INSERT INTO migrations (filename, success, error_message) VALUES ($1, $2, $3) ON CONFLICT (filename) DO UPDATE SET executed_at = CURRENT_TIMESTAMP, success = $2, error_message = $3',
          [file, false, error.message]
        );

        errorCount++;

        // Continue with next migration instead of stopping
        console.log(`   ⚠️  Continuing with next migration...`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(50));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`⏭️  Skipped: ${skipCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`📁 Total: ${migrationFiles.length}`);
    console.log('='.repeat(50));

    // Verify critical tables exist
    console.log('\n🔍 Verifying critical tables...');
    const criticalTables = ['users', 'sessions', 'payments', 'tokens', 'user_tokens', 'creator_payouts'];
    for (const table of criticalTables) {
      const result = await client.query(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)",
        [table]
      );
      const exists = result.rows[0].exists;
      console.log(`   ${exists ? '✅' : '❌'} ${table}`);
    }

    console.log('\n✨ Migration process complete!');

  } catch (error) {
    console.error('💥 Fatal error during migration:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();