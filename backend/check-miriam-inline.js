const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.lpphsjowsivjtcmafxnj:JWiYM6v3bq4Imaot@aws-0-us-east-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    const result = await pool.query(`
      SELECT id, supabase_id, email, username, display_name, is_creator, role, creator_type
      FROM users
      WHERE username ILIKE '%miriam%' OR email ILIKE '%miriam%' OR display_name ILIKE '%miriam%'
      LIMIT 5
    `);
    console.log('Found', result.rows.length, 'users');
    console.log(JSON.stringify(result.rows, null, 2));
    await pool.end();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
})();
