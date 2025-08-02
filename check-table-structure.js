const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

async function checkTableStructure() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 Checking table structures...\n');

    // Check users table columns
    const usersColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);

    console.log('📋 USERS table structure:');
    console.log('Column Name | Data Type | Nullable | Default');
    console.log('-'.repeat(60));
    usersColumns.rows.forEach(col => {
      console.log(`${col.column_name.padEnd(20)} | ${col.data_type.padEnd(20)} | ${col.is_nullable.padEnd(8)} | ${col.column_default || 'none'}`);
    });

    // Check if there's an auth.users table
    console.log('\n\n📋 Checking for Supabase auth.users...');
    try {
      const authCheck = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'auth' AND table_name = 'users'
        LIMIT 5
      `);
      console.log('✅ auth.users table exists with columns:', authCheck.rows.map(r => r.column_name).join(', '));
    } catch (err) {
      console.log('❌ Cannot access auth.users table');
    }

    // Check for any triggers on users table
    console.log('\n\n🔧 Checking for triggers on users table...');
    const triggers = await pool.query(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'users'
    `);

    if (triggers.rows.length > 0) {
      console.log('Found triggers:');
      triggers.rows.forEach(t => {
        console.log(`- ${t.trigger_name} (${t.event_manipulation})`);
      });
    } else {
      console.log('❌ No triggers found on users table');
      console.log('⚠️  This might be why auth users aren\'t syncing to the users table');
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
  }
}

checkTableStructure();