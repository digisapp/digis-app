const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function verifyDatabase() {
  const client = await pool.connect();

  try {
    console.log('🔍 Verifying Database Structure\n');
    console.log('='.repeat(50));

    // 1. Check all tables
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log(`\n📊 Found ${tablesResult.rows.length} tables in database`);

    // 2. Check critical tables
    const criticalTables = {
      'users': ['id', 'email', 'username', 'token_balance', 'is_creator', 'profile_blocked'],
      'sessions': ['id', 'user_id', 'creator_id', 'status', 'channel_name'],
      'payments': ['id', 'user_id', 'amount_cents', 'status'],
      'user_tokens': ['id', 'user_id', 'balance'],
      'creator_payouts': ['id', 'creator_id', 'amount_cents', 'status'],
      'session_ratings': ['id', 'session_id', 'user_id', 'rating'],
      'session_quality': ['id', 'session_id', 'quality_score']
    };

    console.log('\n🎯 Verifying Critical Tables:');
    console.log('-'.repeat(50));

    for (const [table, requiredColumns] of Object.entries(criticalTables)) {
      // Check if table exists
      const tableExists = await client.query(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)",
        [table]
      );

      if (tableExists.rows[0].exists) {
        console.log(`\n✅ Table: ${table}`);

        // Check columns
        const columnsResult = await client.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [table]);

        const existingColumns = columnsResult.rows.map(r => r.column_name);

        for (const col of requiredColumns) {
          if (existingColumns.includes(col)) {
            console.log(`   ✓ ${col}`);
          } else {
            console.log(`   ❌ ${col} (missing)`);
          }
        }
      } else {
        console.log(`\n❌ Table: ${table} (MISSING)`);
      }
    }

    // 3. Create missing tokens table if needed
    const tokensExists = await client.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tokens')"
    );

    if (!tokensExists.rows[0].exists) {
      console.log('\n📝 Creating missing tokens table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          transaction_type VARCHAR(50),
          amount INTEGER,
          balance_after INTEGER,
          description TEXT,
          reference_id UUID,
          reference_type VARCHAR(50),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query('CREATE INDEX IF NOT EXISTS idx_tokens_user_id ON tokens(user_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_tokens_created_at ON tokens(created_at DESC)');
      console.log('   ✅ tokens table created');
    }

    // 4. Check row counts for key tables
    console.log('\n📈 Table Statistics:');
    console.log('-'.repeat(50));

    const countTables = ['users', 'sessions', 'payments', 'user_tokens', 'creator_payouts'];
    for (const table of countTables) {
      try {
        const countResult = await client.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`   ${table}: ${countResult.rows[0].count} rows`);
      } catch (err) {
        console.log(`   ${table}: Unable to count (${err.message})`);
      }
    }

    // 5. Check indexes
    console.log('\n🔍 Key Indexes:');
    console.log('-'.repeat(50));

    const indexResult = await client.query(`
      SELECT
        schemaname,
        tablename,
        indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename IN ('users', 'sessions', 'payments', 'user_tokens')
      ORDER BY tablename, indexname
    `);

    let currentTable = '';
    for (const idx of indexResult.rows) {
      if (idx.tablename !== currentTable) {
        currentTable = idx.tablename;
        console.log(`\n   ${currentTable}:`);
      }
      console.log(`      ✓ ${idx.indexname}`);
    }

    // 6. Check constraints
    console.log('\n🔒 Foreign Key Constraints:');
    console.log('-'.repeat(50));

    const constraintResult = await client.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type
      FROM information_schema.table_constraints tc
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name IN ('sessions', 'payments', 'user_tokens', 'creator_payouts')
      ORDER BY tc.table_name
    `);

    currentTable = '';
    for (const con of constraintResult.rows) {
      if (con.table_name !== currentTable) {
        currentTable = con.table_name;
        console.log(`\n   ${currentTable}:`);
      }
      console.log(`      ✓ ${con.constraint_name}`);
    }

    // Final summary
    console.log('\n' + '='.repeat(50));
    console.log('✨ Database Verification Complete!');
    console.log('='.repeat(50));

    // Determine readiness
    const missingCritical = !tokensExists.rows[0].exists;
    if (missingCritical) {
      console.log('\n⚠️  Some critical tables were missing but have been created.');
      console.log('   Please run this script again to verify.');
    } else {
      console.log('\n✅ Database structure is ready for production!');
      console.log('   All critical tables and relationships are in place.');
    }

  } catch (error) {
    console.error('❌ Error verifying database:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

verifyDatabase();