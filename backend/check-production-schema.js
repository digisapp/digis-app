require('dotenv').config({ path: '.env.production' });
const { Pool } = require('pg');

async function checkSchema() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 Checking production database schema...\n');

    // Check streams table columns
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'streams'
      ORDER BY ordinal_position;
    `);

    console.log('📊 Streams table columns:');
    console.table(columnsResult.rows);

    // Check if specific columns exist
    const hasChannel = columnsResult.rows.some(col => col.column_name === 'channel');
    const hasStreamSettings = columnsResult.rows.some(col => col.column_name === 'stream_settings');

    console.log('\n✅ Column Check:');
    console.log(`  channel: ${hasChannel ? '✓ EXISTS' : '✗ MISSING'}`);
    console.log(`  stream_settings: ${hasStreamSettings ? '✓ EXISTS' : '✗ MISSING'}`);

    if (!hasChannel || !hasStreamSettings) {
      console.log('\n⚠️  REQUIRED COLUMNS ARE MISSING!');
      console.log('Run this to fix:');
      console.log('  node fix-streams-table.js');
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkSchema();
