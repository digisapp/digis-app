const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function createSessionRatingsTable() {
  const client = await pool.connect();

  try {
    console.log('Creating session_ratings table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS session_ratings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        review TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Creating indexes...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_session_ratings_creator_id ON session_ratings(creator_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_session_ratings_user_id ON session_ratings(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_session_ratings_session_id ON session_ratings(session_id)');

    console.log('Enabling RLS...');
    await client.query('ALTER TABLE session_ratings ENABLE ROW LEVEL SECURITY');

    console.log('✅ session_ratings table created successfully!');
  } catch (err) {
    console.error('Error creating table:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

createSessionRatingsTable();