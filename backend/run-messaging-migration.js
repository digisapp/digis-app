// Run messaging system migration
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function runMigration() {
  // Use pg Pool for raw SQL execution with proper SSL config for Supabase pooler
  const isLocal = process.env.DATABASE_URL?.includes('localhost');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isLocal ? false : {
      rejectUnauthorized: false
    },
    // Connection timeout settings
    connectionTimeoutMillis: 10000,
    query_timeout: 30000,
  });

  try {
    console.log('🚀 Running Messaging System Migration...');
    const dbUrl = process.env.DATABASE_URL || '';
    const dbHost = dbUrl.split('@')[1]?.split(':')[0] || 'unknown';
    console.log('📊 Database:', dbHost);

    // Read migration file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', '016_create_messaging_system.sql'),
      'utf8'
    );

    // Run migration
    console.log('📝 Executing migration...');
    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!');

    // Test the tables
    console.log('\n🧪 Testing tables...');
    const result = await pool.query(`
      SELECT
        'conversations' as table_name,
        COUNT(*) as count
      FROM conversations
      UNION ALL
      SELECT 'messages', COUNT(*) FROM messages
      UNION ALL
      SELECT 'typing_indicators', COUNT(*) FROM typing_indicators
      UNION ALL
      SELECT 'message_reactions', COUNT(*) FROM message_reactions
      UNION ALL
      SELECT 'message_reports', COUNT(*) FROM message_reports
    `);

    console.log('\n📊 Table counts:');
    result.rows.forEach(row => {
      console.log(`  ${row.table_name}: ${row.count}`);
    });

    console.log('\n✅ All tests passed!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.message.includes('already exists')) {
      console.log('\n⚠️  Tables already exist - this is OK!');
      console.log('Checking if functions exist...');

      try {
        // Test if functions exist
        const funcTest = await pool.query(`
          SELECT proname FROM pg_proc
          WHERE proname IN ('get_unread_count', 'get_or_create_conversation', 'mark_messages_as_read')
        `);
        console.log(`\n✅ Found ${funcTest.rows.length} migration functions`);
        funcTest.rows.forEach(row => console.log(`  - ${row.proname}`));
      } catch (testError) {
        console.error('Error testing functions:', testError.message);
      }
    } else {
      console.error(error);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

runMigration();
