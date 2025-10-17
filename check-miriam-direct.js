const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.lpphsjowsivjtcmafxnj:JWiYM6v3bq4Imaot@db.lpphsjowsivjtcmafxnj.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function checkMiriam() {
  try {
    const result = await pool.query(`
      SELECT id, supabase_id, email, username, display_name, is_creator, role, created_at
      FROM users
      WHERE username ILIKE '%miriam%' OR email ILIKE '%miriam%' OR display_name ILIKE '%miriam%'
      LIMIT 5
    `);

    console.log('Found users:', result.rows);
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkMiriam();
