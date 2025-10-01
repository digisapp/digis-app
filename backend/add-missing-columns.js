require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function addMissingColumns() {
  const client = await pool.connect();

  try {
    console.log('🔧 Adding all missing columns to database...\n');

    // All missing columns for users table
    const userColumns = [
      'profile_blocked BOOLEAN DEFAULT false',
      'email_verified BOOLEAN DEFAULT false',
      'rating NUMERIC(2,1) DEFAULT 0.0',
      'total_reviews INTEGER DEFAULT 0',
      'response_time INTEGER DEFAULT 0',
      'acceptance_rate INTEGER DEFAULT 100',
      'specialties TEXT[]',
      'languages_spoken TEXT[]',
      'education TEXT',
      'work_experience TEXT',
      'certifications TEXT[]',
      'hourly_rate INTEGER DEFAULT 0',
      'minimum_call_duration INTEGER DEFAULT 5',
      'instant_call_enabled BOOLEAN DEFAULT true',
      'scheduled_call_enabled BOOLEAN DEFAULT true',
      'chat_enabled BOOLEAN DEFAULT true',
      'video_intro_url TEXT',
      'gallery_images TEXT[]',
      'featured BOOLEAN DEFAULT false',
      'trending BOOLEAN DEFAULT false',
      'new_creator BOOLEAN DEFAULT true',
      'last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP',
      'total_minutes INTEGER DEFAULT 0',
      'average_call_duration INTEGER DEFAULT 0',
      'repeat_client_rate INTEGER DEFAULT 0',
      'completion_rate INTEGER DEFAULT 100',
      'refund_rate INTEGER DEFAULT 0',
      'dispute_rate INTEGER DEFAULT 0',
      'suspension_reason TEXT',
      'suspension_date TIMESTAMP WITH TIME ZONE',
      'reinstatement_date TIMESTAMP WITH TIME ZONE',
      'notes TEXT',
      'internal_rating INTEGER DEFAULT 0',
      'risk_score INTEGER DEFAULT 0',
      'payment_hold BOOLEAN DEFAULT false',
      'payout_method TEXT DEFAULT \'stripe\'',
      'payout_frequency TEXT DEFAULT \'weekly\'',
      'next_payout_date DATE',
      'lifetime_earnings NUMERIC(10,2) DEFAULT 0',
      'current_balance NUMERIC(10,2) DEFAULT 0',
      'pending_balance NUMERIC(10,2) DEFAULT 0',
      'total_payouts INTEGER DEFAULT 0',
      'last_payout_date DATE',
      'last_payout_amount NUMERIC(10,2) DEFAULT 0'
    ];

    console.log('📝 Adding columns to users table...');
    for (const colDef of userColumns) {
      const colName = colDef.split(' ')[0];
      try {
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${colDef}`);
        console.log(`   ✅ ${colName}`);
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(`   ⏭️  ${colName} (already exists)`);
        } else {
          console.log(`   ❌ ${colName}: ${err.message}`);
        }
      }
    }

    // Create user_tokens table if it doesn't exist
    console.log('\n📝 Creating user_tokens table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        balance INTEGER DEFAULT 0,
        total_purchased INTEGER DEFAULT 0,
        total_spent INTEGER DEFAULT 0,
        total_earned INTEGER DEFAULT 0,
        bonus_tokens INTEGER DEFAULT 0,
        last_purchase_date TIMESTAMP WITH TIME ZONE,
        last_purchase_amount INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ user_tokens table created');

    // Create indexes for user_tokens
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_tokens_user_id ON user_tokens(user_id)');
    console.log('   ✅ Index created on user_tokens');

    // Ensure every user has a token record
    await client.query(`
      INSERT INTO user_tokens (user_id, balance)
      SELECT id, COALESCE(token_balance, 0)
      FROM users
      WHERE id NOT IN (SELECT user_id FROM user_tokens WHERE user_id IS NOT NULL)
    `);
    console.log('   ✅ Token records created for existing users');

    // Create session_quality table if missing
    console.log('\n📝 Creating session_quality table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS session_quality (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
        quality_score INTEGER DEFAULT 5,
        connection_quality INTEGER DEFAULT 5,
        audio_quality INTEGER DEFAULT 5,
        video_quality INTEGER DEFAULT 5,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ session_quality table created');

    // List all columns to verify
    const columns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('profile_blocked', 'email_verified', 'rating', 'video_price', 'stream_price', 'message_price', 'is_suspended')
      ORDER BY column_name
    `);

    console.log('\n✅ Critical columns verified:');
    columns.rows.forEach(col => {
      console.log(`   ✓ ${col.column_name} (${col.data_type})`);
    });

    // Check if user_tokens table exists
    const tokenTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'user_tokens'
      )
    `);
    console.log(`\n✅ user_tokens table exists: ${tokenTable.rows[0].exists}`);

    console.log('\n✨ All missing columns and tables added successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

addMissingColumns();