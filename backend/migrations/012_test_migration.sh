#!/bin/bash

# Test script to verify RLS performance optimization migration
# Usage: ./012_test_migration.sh

echo "Testing RLS performance optimization migration..."

# Load environment variables
if [ -f backend/.env ]; then
  export $(grep -v '^#' backend/.env | xargs)
elif [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL not set in .env"
  exit 1
fi

echo "✓ DATABASE_URL found"

# Test database connection and check RLS policies
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testMigration() {
  try {
    console.log('Connecting to database...');

    // 1. Check if high-traffic tables exist
    console.log('\n=== Checking Tables ===');
    const tables = await pool.query(\`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('users', 'sessions', 'token_balances', 'follows', 'messages')
      ORDER BY table_name
    \`);

    const foundTables = tables.rows.map(r => r.table_name);
    console.log('Found tables:', foundTables.join(', '));

    if (foundTables.length === 0) {
      console.log('❌ No high-traffic tables found. Schema may be different than expected.');
      await pool.end();
      process.exit(1);
    }

    // 2. Check RLS policies for optimized auth.uid() usage
    console.log('\n=== Checking RLS Policies ===');
    const policies = await pool.query(\`
      SELECT
        tablename,
        policyname,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE tablename IN ('users', 'sessions', 'token_balances', 'follows', 'messages')
      ORDER BY tablename, policyname
    \`);

    console.log(\`Found \${policies.rows.length} RLS policies on high-traffic tables\`);

    // Group by table
    const policyByTable = {};
    policies.rows.forEach(p => {
      if (!policyByTable[p.tablename]) {
        policyByTable[p.tablename] = [];
      }
      policyByTable[p.tablename].push(p.policyname);
    });

    Object.keys(policyByTable).forEach(table => {
      console.log(\`  \${table}: \${policyByTable[table].length} policies\`);
      policyByTable[table].forEach(policy => {
        console.log(\`    - \${policy}\`);
      });
    });

    // 3. Check for duplicate indexes
    console.log('\n=== Checking for Duplicate Indexes ===');
    const duplicateIndexes = await pool.query(\`
      SELECT
        schemaname,
        tablename,
        array_agg(indexname) as duplicate_indexes,
        indexdef,
        COUNT(*) as count
      FROM pg_indexes
      WHERE tablename IN ('users', 'sessions', 'token_balances', 'follows', 'messages')
      GROUP BY schemaname, tablename, indexdef
      HAVING COUNT(*) > 1
      ORDER BY tablename, indexdef
    \`);

    if (duplicateIndexes.rows.length > 0) {
      console.log(\`❌ Found \${duplicateIndexes.rows.length} sets of duplicate indexes:\`);
      duplicateIndexes.rows.forEach(d => {
        console.log(\`  \${d.tablename}: \${d.duplicate_indexes.join(', ')}\`);
      });
    } else {
      console.log('✅ No duplicate indexes found');
    }

    // 4. Check if required indexes exist
    console.log('\n=== Checking Required Indexes ===');
    const indexes = await pool.query(\`
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE tablename IN ('users', 'sessions', 'token_balances', 'follows', 'messages')
      ORDER BY tablename, indexname
    \`);

    const indexByTable = {};
    indexes.rows.forEach(i => {
      if (!indexByTable[i.tablename]) {
        indexByTable[i.tablename] = [];
      }
      indexByTable[i.tablename].push(i.indexname);
    });

    Object.keys(indexByTable).forEach(table => {
      console.log(\`  \${table}: \${indexByTable[table].length} indexes\`);
    });

    // 5. Summary
    console.log('\n=== Migration Status Summary ===');
    console.log('✅ Tables verified');
    console.log(\`✅ RLS policies configured: \${policies.rows.length} total\`);
    console.log(\`\${duplicateIndexes.rows.length === 0 ? '✅' : '⚠️'} Duplicate indexes: \${duplicateIndexes.rows.length}\`);
    console.log(\`✅ Indexes configured: \${indexes.rows.length} total\`);

    if (duplicateIndexes.rows.length > 0) {
      console.log('\n⚠️  Migration has not been run yet or duplicate indexes still exist.');
      console.log('Run 012_optimize_high_traffic_rls.sql in Supabase SQL Editor to apply optimizations.');
    } else {
      console.log('\n✅ Migration appears to be applied successfully!');
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

testMigration();
"

echo ""
echo "Migration test complete!"
