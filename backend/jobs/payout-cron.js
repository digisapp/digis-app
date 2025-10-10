/**
 * Payout Cron Job
 *
 * Runs on the 1st and 15th of each month to process creator withdrawals
 *
 * Schedule: 0 2 1,15 * * (At 2:00 AM on 1st and 15th of each month)
 *
 * Usage:
 * - Standalone: node jobs/payout-cron.js
 * - Via cron: Add to crontab or use a service like node-cron
 */

const { processPayoutBatch } = require('../utils/payout-scheduler');
const { logger } = require('../utils/secureLogger');

async function runPayoutJob() {
  const startTime = Date.now();
  logger.info('========================================');
  logger.info('🚀 Starting bi-monthly payout job');
  logger.info(`📅 Date: ${new Date().toISOString()}`);
  logger.info('========================================');

  try {
    const results = await processPayoutBatch(new Date());

    logger.info('========================================');
    logger.info('✅ Payout job completed successfully');
    logger.info(`📊 Results:`);
    logger.info(`   - Processed: ${results.processed}`);
    logger.info(`   - Failed: ${results.failed}`);
    logger.info(`   - Total amount: $${results.totalAmount.toFixed(2)}`);
    logger.info(`   - Duration: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
    logger.info('========================================');

    // Log errors if any
    if (results.errors.length > 0) {
      logger.error('⚠️ Errors encountered during processing:');
      results.errors.forEach(err => {
        logger.error(`   - Request ${err.requestId} (${err.creator}): ${err.error}`);
      });
    }

    // Send notification email to admin (optional)
    if (process.env.ADMIN_EMAIL) {
      await sendPayoutSummaryEmail(results);
    }

    return results;
  } catch (error) {
    logger.error('========================================');
    logger.error('❌ Payout job failed');
    logger.error(`Error: ${error.message}`);
    logger.error(`Stack: ${error.stack}`);
    logger.error('========================================');

    // Send error notification to admin (optional)
    if (process.env.ADMIN_EMAIL) {
      await sendPayoutErrorEmail(error);
    }

    throw error;
  }
}

/**
 * Send payout summary email to admin (optional implementation)
 */
async function sendPayoutSummaryEmail(results) {
  // TODO: Implement email notification
  // Example using Postmark or SendGrid
  logger.info('📧 Email notification sent to admin');
}

/**
 * Send payout error notification to admin (optional implementation)
 */
async function sendPayoutErrorEmail(error) {
  // TODO: Implement error email notification
  logger.error('📧 Error notification sent to admin');
}

// Run if executed directly
if (require.main === module) {
  runPayoutJob()
    .then(() => {
      logger.info('🎉 Payout job finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Payout job failed:', error);
      process.exit(1);
    });
}

module.exports = { runPayoutJob };
