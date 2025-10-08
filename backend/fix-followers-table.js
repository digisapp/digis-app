const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:JWiYM6v3bq4Imaot@db.lpphsjowsivjtcmafxnj.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function fixFollowersTable() {
  const client = await pool.connect();
  try {
    console.log('Fixing followers table schema...\n');
    
    // Check if following_id column exists
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'followers' AND column_name = 'following_id'
    `);
    
    if (checkColumn.rows.length === 0) {
      console.log('Adding following_id column...');
      
      // Add following_id column
      await client.query(`
        ALTER TABLE followers 
        ADD COLUMN IF NOT EXISTS following_id UUID REFERENCES users(id) ON DELETE CASCADE
      `);
      
      // Copy data from creator_id to following_id if creator_id exists
      await client.query(`
        UPDATE followers 
        SET following_id = creator_id 
        WHERE following_id IS NULL AND creator_id IS NOT NULL
      `);
      
      console.log('✅ Added following_id column and copied data from creator_id');
    } else {
      console.log('✅ following_id column already exists');
    }
    
    // Add unique constraint if not exists
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'followers_follower_following_unique'
        ) THEN
          ALTER TABLE followers 
          ADD CONSTRAINT followers_follower_following_unique 
          UNIQUE (follower_id, following_id);
        END IF;
      END$$;
    `);
    
    console.log('✅ Unique constraint ensured');
    
    // Verify final schema
    const finalCheck = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'followers'
      ORDER BY ordinal_position
    `);
    
    console.log('\n=== FINAL FOLLOWERS TABLE SCHEMA ===');
    console.table(finalCheck.rows);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixFollowersTable();
