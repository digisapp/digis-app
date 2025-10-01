#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../utils/db');

async function verifyPayoutTables() {
  console.log('🔍 Verifying payout tables...');
  
  const client = await pool.connect();
  
  try {
    // Check if all tables exist
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'creator_stripe_accounts',
        'creator_bank_accounts',
        'creator_payouts',
        'creator_earnings',
        'creator_payout_settings',
        'payout_notifications'
      )
      ORDER BY table_name
    `;
    
    const tables = await client.query(tablesQuery);
    console.log('✅ Payout tables found:', tables.rows.map(r => r.table_name));
    
    // Check if functions exist
    const functionsQuery = `
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name IN (
        'get_creator_pending_balance',
        'can_creator_receive_payouts',
        'generate_scheduled_payouts',
        'update_creator_token_balance'
      )
      ORDER BY routine_name
    `;
    
    const functions = await client.query(functionsQuery);
    console.log('✅ Payout functions found:', functions.rows.map(r => r.routine_name));
    
    // Check if view exists
    const viewQuery = `
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public' 
      AND table_name = 'creator_payout_dashboard'
    `;
    
    const views = await client.query(viewQuery);
    console.log('✅ Payout views found:', views.rows.map(r => r.table_name));
    
    // Test function
    console.log('\n🧪 Testing payout functions...');
    
    // Get a test creator
    const testCreator = await client.query(
      'SELECT uid FROM users WHERE is_creator = true LIMIT 1'
    );
    
    if (testCreator.rows.length > 0) {
      const creatorId = testCreator.rows[0].uid;
      console.log('Using test creator:', creatorId);
      
      // Test get_creator_pending_balance
      const balance = await client.query(
        'SELECT * FROM get_creator_pending_balance($1)',
        [creatorId]
      );
      console.log('Pending balance:', balance.rows[0]);
      
      // Test can_creator_receive_payouts
      const canReceive = await client.query(
        'SELECT can_creator_receive_payouts($1) as can_receive',
        [creatorId]
      );
      console.log('Can receive payouts:', canReceive.rows[0].can_receive);
    }
    
    console.log('\n🎉 Payout system verification complete!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run verification
verifyPayoutTables()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });