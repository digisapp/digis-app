const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables if available
try {
  require('dotenv').config();
} catch (e) {
  console.log('No .env file found, using environment variables');
}

async function runMigration() {
  // Get database URL from environment
  const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in environment variables');
    process.exit(1);
  }

  // Create connection pool
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : false
  });

  let client;

  try {
    // Get a client from the pool
    client = await pool.connect();
    console.log('✅ Connected to database');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '202_drop_decimals_enforce_cents.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split the migration into individual statements
    // Handle DO blocks and other multi-line statements properly
    const statements = [];
    let currentStatement = '';
    let inDOBlock = false;

    migrationSQL.split('\n').forEach(line => {
      const trimmedLine = line.trim();

      // Skip comments and empty lines
      if (trimmedLine.startsWith('--') || trimmedLine === '') {
        return;
      }

      currentStatement += line + '\n';

      // Check if we're entering or in a DO block
      if (trimmedLine.startsWith('DO $$')) {
        inDOBlock = true;
      }

      // Check if we're ending a DO block
      if (inDOBlock && trimmedLine === 'END$$;') {
        statements.push(currentStatement.trim());
        currentStatement = '';
        inDOBlock = false;
        return;
      }

      // For regular statements, check for semicolon at the end
      if (!inDOBlock && trimmedLine.endsWith(';')) {
        statements.push(currentStatement.trim());
        currentStatement = '';
      }
    });

    // Begin transaction
    await client.query('BEGIN');
    console.log('🔄 Starting migration in transaction...\n');

    let statementCount = 0;
    for (const statement of statements) {
      if (statement) {
        try {
          // Show a preview of the statement
          const preview = statement.substring(0, 60).replace(/\n/g, ' ');
          console.log(`Executing: ${preview}...`);

          await client.query(statement);
          statementCount++;
        } catch (error) {
          console.error(`\n❌ Error executing statement:`);
          console.error(`Statement: ${statement.substring(0, 100)}...`);
          console.error(`Error: ${error.message}`);

          // Rollback on error
          await client.query('ROLLBACK');
          console.log('🔄 Transaction rolled back');
          throw error;
        }
      }
    }

    // Commit the transaction
    await client.query('COMMIT');
    console.log(`\n✅ Migration completed successfully!`);
    console.log(`📊 Executed ${statementCount} SQL statements`);

    // Verify the changes
    console.log('\n🔍 Verifying migration results...');

    // Check if old columns were dropped
    const checkColumns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('price_per_min', 'creator_rate', 'voice_rate', 'stream_rate')
    `);

    if (checkColumns.rows.length === 0) {
      console.log('✅ Old decimal columns successfully dropped from users table');
    } else {
      console.log('⚠️ Some old columns still exist:', checkColumns.rows.map(r => r.column_name));
    }

    // Check constraints
    const checkConstraints = await client.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name IN ('users', 'sessions', 'payments')
      AND constraint_type = 'CHECK'
      AND constraint_name LIKE '%cents%'
    `);

    console.log(`✅ ${checkConstraints.rows.length} CHECK constraints added for cents columns`);

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    // Release the client
    if (client) {
      client.release();
    }

    // Close the pool
    await pool.end();
    console.log('\n🔄 Database connection closed');
  }
}

// Run the migration
runMigration().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});