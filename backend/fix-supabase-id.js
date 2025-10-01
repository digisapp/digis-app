require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function fixSupabaseId() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Checking for supabase_id column...');
    
    // Check if column exists
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'supabase_id'
    `);
    
    if (checkResult.rows.length === 0) {
      console.log('📝 Adding supabase_id column...');
      
      // Add the column
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_id UUID');
      
      // Update existing records to use the id as supabase_id
      await client.query('UPDATE users SET supabase_id = id WHERE supabase_id IS NULL');
      
      // Make it NOT NULL
      await client.query('ALTER TABLE users ALTER COLUMN supabase_id SET NOT NULL');
      
      // Add unique constraint
      await client.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'users_supabase_id_unique'
          ) THEN
            ALTER TABLE users ADD CONSTRAINT users_supabase_id_unique UNIQUE (supabase_id);
          END IF;
        END $$;
      `);
      
      // Create index
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON users(supabase_id)
      `);
      
      console.log('✅ supabase_id column added successfully');
    } else {
      console.log('ℹ️ supabase_id column already exists');
    }
    
    // Verify the column
    const verifyResult = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'supabase_id'
    `);
    
    console.log('📊 Column details:', verifyResult.rows[0]);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixSupabaseId();