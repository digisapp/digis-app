const { pool } = require('../utils/db');

async function updateCommissionRate() {
  try {
    console.log('Updating platform commission rate to 20%...');
    
    // Check if shop_settings table has the column
    const columnCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'shop_settings' 
        AND column_name = 'platform_commission_rate'
      )
    `);
    
    if (columnCheck.rows[0].exists) {
      // Update existing rate
      await pool.query(`
        UPDATE shop_settings 
        SET platform_commission_rate = 20.00
      `);
      console.log('✅ Updated existing commission rate to 20%');
    } else {
      // Add column with 20% default
      await pool.query(`
        ALTER TABLE shop_settings
        ADD COLUMN IF NOT EXISTS platform_commission_rate DECIMAL(5,2) DEFAULT 20.00
      `);
      console.log('✅ Added commission rate column with 20% default');
    }
    
    // Update comment
    await pool.query(`
      COMMENT ON COLUMN shop_orders.platform_fee_tokens IS 'Platform commission in token equivalent (20% for USD purchases)'
    `);
    
    await pool.query(`
      COMMENT ON COLUMN shop_orders.platform_fee_usd IS 'Platform commission in USD (20% of sale)'
    `);
    
    console.log('✅ Commission rate update complete!');
    console.log('\n📊 New Commission Structure:');
    console.log('   • Platform Fee: 20% (down from 30%)');
    console.log('   • Creator Share: 80% (up from 70%)');
    console.log('   • $1 USD sale = 16 tokens to creator (up from 14)');
    console.log('   • $100 USD sale = 1,600 tokens to creator (up from 1,400)');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateCommissionRate();