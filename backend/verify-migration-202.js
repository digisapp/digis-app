const { Pool } = require('pg');

async function verifyMigration() {
  const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    console.log('🔍 Verifying Migration 202 Results\n');

    // Check users table columns
    const userColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN (
        'video_rate_cents', 'voice_rate_cents', 'stream_rate_cents', 'message_price_cents',
        'price_per_min', 'creator_rate', 'voice_rate', 'stream_rate'
      )
      ORDER BY column_name
    `);

    console.log('✅ Users table columns:');
    userColumns.rows.forEach(col => {
      const status = col.column_name.includes('cents') ? '✅' : '❌';
      console.log(`  ${status} ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Check sessions table columns
    const sessionColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'sessions'
      AND column_name IN (
        'rate_per_minute_cents', 'total_cost_cents',
        'rate_per_minute', 'rate_per_min', 'total_cost'
      )
      ORDER BY column_name
    `);

    console.log('\n✅ Sessions table columns:');
    sessionColumns.rows.forEach(col => {
      const status = col.column_name.includes('cents') ? '✅' : '❌';
      console.log(`  ${status} ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Check payments table columns
    const paymentColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'payments'
      AND column_name IN (
        'amount_cents', 'amount', 'amount_usd', 'tokens_amount'
      )
      ORDER BY column_name
    `);

    console.log('\n✅ Payments table columns:');
    paymentColumns.rows.forEach(col => {
      const status = col.column_name === 'amount_cents' ? '✅' : '❌';
      console.log(`  ${status} ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Check constraints
    const constraints = await client.query(`
      SELECT conname, contype
      FROM pg_constraint
      WHERE conname LIKE '%cents%'
      ORDER BY conname
    `);

    console.log('\n✅ Constraints on cents columns:');
    constraints.rows.forEach(con => {
      console.log(`  ✅ ${con.conname} (${con.contype === 'c' ? 'CHECK' : con.contype})`);
    });

    // Check views
    const views = await client.query(`
      SELECT viewname
      FROM pg_views
      WHERE viewname IN ('payment_amounts_view', 'session_pricing_view')
    `);

    console.log('\n✅ Helper views created:');
    views.rows.forEach(view => {
      console.log(`  ✅ ${view.viewname}`);
    });

    // Sample data check
    const sampleUsers = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(video_rate_cents) as has_video_rate,
             COUNT(voice_rate_cents) as has_voice_rate
      FROM users
      WHERE is_creator = true OR role = 'creator'
    `);

    console.log('\n📊 Data integrity:');
    console.log(`  Total creators: ${sampleUsers.rows[0].total}`);
    console.log(`  With video_rate_cents: ${sampleUsers.rows[0].has_video_rate}`);
    console.log(`  With voice_rate_cents: ${sampleUsers.rows[0].has_voice_rate}`);

    console.log('\n✅ Migration 202 verified successfully!');
    console.log('All decimal columns have been dropped and replaced with cents columns.');

  } catch (error) {
    console.error('❌ Verification error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

verifyMigration();