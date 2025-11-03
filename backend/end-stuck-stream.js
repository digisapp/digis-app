require('dotenv').config({ path: '.env.production' });
const { Pool } = require('pg');

async function endStuckStream() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 Looking for stuck live streams...\n');

    // Find all live streams
    const liveStreams = await pool.query(`
      SELECT id, creator_id, title, channel, started_at,
             EXTRACT(EPOCH FROM (NOW() - started_at))/60 as minutes_live
      FROM streams
      WHERE status = 'live'
      ORDER BY started_at DESC;
    `);

    console.log(`Found ${liveStreams.rows.length} live stream(s):\n`);
    liveStreams.rows.forEach((stream, i) => {
      console.log(`${i + 1}. Stream ID: ${stream.id}`);
      console.log(`   Title: ${stream.title}`);
      console.log(`   Channel: ${stream.channel}`);
      console.log(`   Started: ${stream.started_at}`);
      console.log(`   Duration: ${Math.round(stream.minutes_live)} minutes\n`);
    });

    if (liveStreams.rows.length === 0) {
      console.log('✅ No stuck streams found!');
      await pool.end();
      return;
    }

    // End all stuck streams
    console.log('🔧 Ending all stuck streams...\n');

    const result = await pool.query(`
      UPDATE streams
      SET status = 'ended',
          ended_at = NOW(),
          duration = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
      WHERE status = 'live'
      RETURNING id, title;
    `);

    console.log(`✅ Ended ${result.rows.length} stream(s):`);
    result.rows.forEach((stream, i) => {
      console.log(`${i + 1}. ${stream.title} (${stream.id})`);
    });

    console.log('\n🎉 All streams cleaned up! You can now go live again.');

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

endStuckStream();
