#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { pool } = require('../utils/db');

async function runPayoutMigration() {
  console.log('🔄 Running creator payout migration...');
  
  const client = await pool.connect();
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/010_create_creator_payouts.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Executing migration: 010_create_creator_payouts.sql');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Payout migration completed successfully!');
    
    // Verify tables were created
    const tables = await client.query(`
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
    `);
    
    console.log('📊 Created payout tables:', tables.rows.map(r => r.table_name));
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runPayoutMigration()
  .then(() => {
    console.log('🎉 Payout system database setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });