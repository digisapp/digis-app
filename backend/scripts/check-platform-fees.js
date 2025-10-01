const { pool } = require('../utils/db');

async function checkPlatformFees() {
  try {
    console.log('Checking platform fee columns...');
    
    // Check if columns exist
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'shop_orders' 
      AND column_name IN ('platform_fee_tokens', 'platform_fee_usd', 'creator_net_tokens')
      ORDER BY column_name
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Platform fee columns found:');
      result.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.log('❌ Platform fee columns not found. Running migration...');
      
      // Add the columns
      await pool.query(`
        ALTER TABLE shop_orders 
        ADD COLUMN IF NOT EXISTS platform_fee_tokens INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS platform_fee_usd DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS creator_net_tokens INTEGER
      `);
      
      console.log('✅ Platform fee columns added successfully');
    }
    
    // Check if platform_earnings table exists
    const tableResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'platform_earnings'
      )
    `);
    
    if (tableResult.rows[0].exists) {
      console.log('✅ platform_earnings table exists');
    } else {
      console.log('❌ platform_earnings table not found. Creating...');
      
      await pool.query(`
        CREATE TABLE IF NOT EXISTS platform_earnings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          order_id UUID REFERENCES shop_orders(id) ON DELETE CASCADE,
          earning_type VARCHAR(50) NOT NULL,
          amount_usd DECIMAL(10,2),
          amount_tokens INTEGER,
          creator_id UUID REFERENCES users(supabase_id),
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_platform_earnings_type ON platform_earnings(earning_type);
        CREATE INDEX IF NOT EXISTS idx_platform_earnings_created ON platform_earnings(created_at);
      `);
      
      console.log('✅ platform_earnings table created successfully');
    }
    
    console.log('\n✅ Platform fee setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkPlatformFees();