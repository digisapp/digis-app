/**
 * Get test users for voice call testing
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function getTestUsers() {
  try {
    const result = await pool.query(`
      SELECT id, email, username, role, supabase_id
      FROM users
      WHERE role IN ('creator', 'fan')
      ORDER BY role DESC
      LIMIT 5
    `);

    console.log('\n📋 Test Users:\n');
    result.rows.forEach(user => {
      console.log(`${user.role.toUpperCase()}: ${user.username || user.email}`);
      console.log(`  ID: ${user.id}`);
      console.log(`  Supabase ID: ${user.supabase_id}`);
      console.log(`  Email: ${user.email}\n`);
    });

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

getTestUsers();
