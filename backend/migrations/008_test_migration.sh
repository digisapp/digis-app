#!/bin/bash

# Test script to verify content tables migration
# Usage: ./008_test_migration.sh

echo "Testing content tables migration..."

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL not set in .env"
  exit 1
fi

echo "✓ DATABASE_URL found"

# Test database connection and check tables
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testMigration() {
  try {
    console.log('Connecting to database...');

    const result = await pool.query(\`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('creator_content', 'content_purchases', 'content_likes', 'content_bundles')
      ORDER BY table_name
    \`);

    const tables = result.rows.map(r => r.table_name);
    console.log('\\nFound tables:', tables.length > 0 ? tables.join(', ') : 'NONE');

    const expectedTables = ['creator_content', 'content_purchases', 'content_likes', 'content_bundles'];
    const missingTables = expectedTables.filter(t => !tables.includes(t));

    if (missingTables.length > 0) {
      console.log('\\n❌ Missing tables:', missingTables.join(', '));
      console.log('\\nPlease run the SQL from 008_create_content_tables.sql in Supabase SQL Editor');
    } else {
      console.log('\\n✅ All content tables exist!');

      // Show creator_content schema
      const schema = await pool.query(\`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'creator_content'
        ORDER BY ordinal_position
      \`);

      console.log('\\ncreator_content schema:');
      schema.rows.forEach(r => {
        console.log(\`  - \${r.column_name} (\${r.data_type})\`);
      });
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\\n❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

testMigration();
"

echo ""
echo "Migration test complete!"
