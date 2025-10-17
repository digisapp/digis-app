const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.lpphsjowsivjtcmafxnj:JWiYM6v3bq4Imaot@db.lpphsjowsivjtcmafxnj.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    console.log('🔍 Searching for Miriam in database...\n');

    const result = await pool.query(`
      SELECT
        id,
        supabase_id,
        email,
        username,
        display_name,
        is_creator,
        role,
        creator_type,
        is_super_admin,
        email_verified,
        created_at
      FROM users
      WHERE username ILIKE '%miriam%'
         OR email ILIKE '%miriam%'
         OR display_name ILIKE '%miriam%'
      LIMIT 10
    `);

    if (result.rows.length === 0) {
      console.log('❌ No users found matching "Miriam"');
      console.log('\nChecking if supabase_id column exists...');

      const columns = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `);

      console.log('\n📋 Users table columns:');
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.log(`✅ Found ${result.rows.length} user(s) matching "Miriam":\n`);

      result.rows.forEach((user, index) => {
        console.log(`User ${index + 1}:`);
        console.log(`  ID: ${user.id}`);
        console.log(`  Supabase ID: ${user.supabase_id || 'NOT SET'}`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Username: ${user.username}`);
        console.log(`  Display Name: ${user.display_name || 'N/A'}`);
        console.log(`  Is Creator: ${user.is_creator}`);
        console.log(`  Role: ${user.role || 'N/A'}`);
        console.log(`  Creator Type: ${user.creator_type || 'N/A'}`);
        console.log(`  Is Admin: ${user.is_super_admin}`);
        console.log(`  Email Verified: ${user.email_verified}`);
        console.log(`  Created: ${user.created_at}`);
        console.log('');
      });

      // Check canonical role computation
      result.rows.forEach((user, index) => {
        const isCreator = user.is_creator === true ||
                         user.role === 'creator' ||
                         user.creator_type != null;
        const isAdmin = user.is_super_admin === true ||
                       user.role === 'admin';

        console.log(`User ${index + 1} - Canonical Role:`);
        console.log(`  is_creator (computed): ${isCreator}`);
        console.log(`  is_admin (computed): ${isAdmin}`);
        console.log('');
      });
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
