#!/usr/bin/env node

/**
 * Manual payout processing script
 * Usage: node scripts/process-payouts.js [command]
 * Commands:
 *   generate - Generate payouts for current date
 *   process - Process pending payouts
 *   retry - Retry failed payouts
 *   report - Generate payout report
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../utils/db');
const payoutProcessor = require('../jobs/payout-processor');

const commands = {
  async generate() {
    console.log('🔄 Generating payouts for current period...');
    
    try {
      const today = new Date();
      const result = await pool.query(
        'SELECT generate_scheduled_payouts($1::DATE) as count',
        [today.toISOString().split('T')[0]]
      );
      
      console.log(`✅ Generated ${result.rows[0].count} payouts`);
    } catch (error) {
      console.error('❌ Error generating payouts:', error.message);
      process.exit(1);
    }
  },

  async process() {
    console.log('🔄 Processing pending payouts...');
    
    try {
      const result = await payoutProcessor.processPendingPayouts();
      console.log('✅ Payout processing completed:');
      console.log(`   - Processed: ${result.processed}`);
      console.log(`   - Failed: ${result.failed}`);
      
      if (result.errors.length > 0) {
        console.log('⚠️  Errors:');
        result.errors.forEach(err => {
          console.log(`   - Payout ${err.payoutId}: ${err.error}`);
        });
      }
    } catch (error) {
      console.error('❌ Error processing payouts:', error.message);
      process.exit(1);
    }
  },

  async retry() {
    console.log('🔄 Retrying failed payouts...');
    
    try {
      const result = await payoutProcessor.retryFailedPayouts();
      console.log('✅ Retry completed:');
      console.log(`   - Retried: ${result.retried}`);
      console.log(`   - Succeeded: ${result.succeeded}`);
      console.log(`   - Failed: ${result.failed}`);
    } catch (error) {
      console.error('❌ Error retrying payouts:', error.message);
      process.exit(1);
    }
  },

  async report() {
    console.log('📊 Generating payout report...');
    
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      
      const report = await payoutProcessor.generatePayoutReport(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );
      
      console.log('📈 Payout Report (Last 30 days):');
      console.log(`   - Total Payouts: ${report.total_payouts}`);
      console.log(`   - Paid: ${report.paid_payouts}`);
      console.log(`   - Failed: ${report.failed_payouts}`);
      console.log(`   - Pending: ${report.pending_payouts}`);
      console.log(`   - Total Paid: $${parseFloat(report.total_paid || 0).toFixed(2)}`);
      console.log(`   - Platform Fees: $${parseFloat(report.total_fees || 0).toFixed(2)}`);
      console.log(`   - Average Payout: $${parseFloat(report.avg_payout || 0).toFixed(2)}`);
    } catch (error) {
      console.error('❌ Error generating report:', error.message);
      process.exit(1);
    }
  },

  async help() {
    console.log(`
Digis Creator Payout Processing Script

Usage: node scripts/process-payouts.js [command]

Commands:
  generate    Generate payouts for current period
  process     Process pending payouts
  retry       Retry failed payouts  
  report      Generate payout report
  help        Show this help message

Examples:
  node scripts/process-payouts.js generate
  node scripts/process-payouts.js process
  node scripts/process-payouts.js report
    `);
  }
};

// Main execution
async function main() {
  const command = process.argv[2] || 'help';
  
  if (!commands[command]) {
    console.error(`❌ Unknown command: ${command}`);
    await commands.help();
    process.exit(1);
  }
  
  try {
    await commands[command]();
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();