// Run messaging system migration
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function runMigration() {
  // Use Supabase client instead of pg Pool
  const supabase = createClient(
    process.env.SUPABASE_URL || 'https://lpphsjowsivjtcmafxnj.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    console.log('🚀 Running Messaging System Migration...');
    console.log('📊 Database:', process.env.DATABASE_URL.split('@')[1]);

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
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
