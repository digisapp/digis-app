const { pool } = require('../utils/db');
const stripeConnect = require('../services/stripe-connect');
const winston = require('winston');

// Configure logger for payout processing
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/payout-processor.log' }),
    new winston.transports.Console()
  ]
});

class PayoutProcessor {
  async processScheduledPayouts() {
    const startTime = new Date();
    logger.info('Starting scheduled payout processing', { startTime });

    try {
      // Generate payouts for current date
      const today = new Date();
      const payoutDate = today.toISOString().split('T')[0];
      
      // Check if we should run payouts today (1st or 15th)
      const dayOfMonth = today.getDate();
      if (dayOfMonth !== 1 && dayOfMonth !== 15) {
        logger.info('Not a payout day, skipping', { dayOfMonth });
        return {
          success: true,
          message: 'Not a scheduled payout day',
          dayOfMonth
        };
      }

      // Generate payouts using database function
      const generateResult = await pool.query(
        'SELECT generate_scheduled_payouts($1::DATE) as count',
        [payoutDate]
      );

      const generatedCount = generateResult.rows[0].count;
      logger.info('Generated payouts', { count: generatedCount });

      // Process the generated payouts
      const processResult = await stripeConnect.processPendingPayouts();
      
      logger.info('Payout processing completed', {
        generated: generatedCount,
        processed: processResult.processed,
        failed: processResult.failed,
        duration: new Date() - startTime
      });

      // Send summary notification to admin
      await this.sendAdminNotification({
        generated: generatedCount,
        processed: processResult.processed,
        failed: processResult.failed,
        errors: processResult.errors
      });

      return {
        success: true,
        generated: generatedCount,
        processed: processResult.processed,
        failed: processResult.failed,
        errors: processResult.errors
      };
    } catch (error) {
      logger.error('Payout processing failed', { error: error.message });
      
      // Send error notification to admin
      await this.sendAdminNotification({
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }

  async sendAdminNotification(data) {
    try {
      // In production, this would send an email or Slack message
      logger.info('Admin notification', data);
      
      // Log to database for admin dashboard
      await pool.query(
        `INSERT INTO admin_logs (log_type, log_data, created_at)
         VALUES ('payout_processing', $1, NOW())`,
        [JSON.stringify(data)]
      );
    } catch (error) {
      logger.error('Failed to send admin notification', { error: error.message });
    }
  }

  // Retry failed payouts
  async retryFailedPayouts() {
    logger.info('Starting retry of failed payouts');

    try {
      // Get failed payouts from the last 7 days
      const failedPayouts = await pool.query(
        `SELECT 
          p.*,
          sa.stripe_account_id,
          u.email,
          u.display_name
         FROM creator_payouts p
         JOIN creator_stripe_accounts sa ON sa.creator_id = p.creator_id
         JOIN users u ON u.uid = p.creator_id
         WHERE p.status = 'failed'
           AND p.created_at > NOW() - INTERVAL '7 days'
           AND sa.payouts_enabled = true
         ORDER BY p.created_at ASC
         LIMIT 50`
      );

      const results = {
        retried: 0,
        succeeded: 0,
        failed: 0
      };

      for (const payout of failedPayouts.rows) {
        try {
          results.retried++;
          
          await stripeConnect.createPayout({
            payoutId: payout.id,
            creatorId: payout.creator_id,
            amount: payout.net_payout_amount,
            stripeAccountId: payout.stripe_account_id,
            periodEnd: payout.payout_period_end
          });
          
          results.succeeded++;
          logger.info('Successfully retried payout', { payoutId: payout.id });
        } catch (error) {
          results.failed++;
          logger.error('Failed to retry payout', { 
            payoutId: payout.id, 
            error: error.message 
          });
        }
      }

      logger.info('Completed retry of failed payouts', results);
      return results;
    } catch (error) {
      logger.error('Error retrying failed payouts', { error: error.message });
      throw error;
    }
  }

  // Check and update Stripe account statuses
  async updateAccountStatuses() {
    logger.info('Starting account status updates');

    try {
      const accounts = await pool.query(
        `SELECT stripe_account_id 
         FROM creator_stripe_accounts 
         WHERE stripe_account_id IS NOT NULL
           AND (account_status != 'active' OR updated_at < NOW() - INTERVAL '1 day')`
      );

      let updated = 0;
      for (const account of accounts.rows) {
        try {
          await stripeConnect.updateAccountStatus(account.stripe_account_id);
          updated++;
        } catch (error) {
          logger.error('Failed to update account status', {
            accountId: account.stripe_account_id,
            error: error.message
          });
        }
      }

      logger.info('Completed account status updates', { updated });
      return { updated };
    } catch (error) {
      logger.error('Error updating account statuses', { error: error.message });
      throw error;
    }
  }

  // Generate payout reports
  async generatePayoutReport(startDate, endDate) {
    try {
      const report = await pool.query(
        `SELECT 
          COUNT(*) as total_payouts,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_payouts,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payouts,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payouts,
          SUM(CASE WHEN status = 'paid' THEN net_payout_amount ELSE 0 END) as total_paid,
          SUM(CASE WHEN status = 'paid' THEN platform_fee_amount ELSE 0 END) as total_fees,
          AVG(CASE WHEN status = 'paid' THEN net_payout_amount END) as avg_payout
         FROM creator_payouts
         WHERE created_at >= $1 AND created_at <= $2`,
        [startDate, endDate]
      );

      return report.rows[0];
    } catch (error) {
      logger.error('Error generating payout report', { error: error.message });
      throw error;
    }
  }
}

// Create singleton instance
const processor = new PayoutProcessor();

// Export for use in cron jobs or manual execution
module.exports = processor;

// Allow direct execution
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'process':
      processor.processScheduledPayouts()
        .then(result => {
          console.log('Payout processing completed:', result);
          process.exit(0);
        })
        .catch(error => {
          console.error('Payout processing failed:', error);
          process.exit(1);
        });
      break;
      
    case 'retry':
      processor.retryFailedPayouts()
        .then(result => {
          console.log('Retry completed:', result);
          process.exit(0);
        })
        .catch(error => {
          console.error('Retry failed:', error);
          process.exit(1);
        });
      break;
      
    case 'update-accounts':
      processor.updateAccountStatuses()
        .then(result => {
          console.log('Account updates completed:', result);
          process.exit(0);
        })
        .catch(error => {
          console.error('Account updates failed:', error);
          process.exit(1);
        });
      break;
      
    default:
      console.log('Usage: node payout-processor.js [process|retry|update-accounts]');
      process.exit(1);
  }
}