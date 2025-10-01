const cron = require('node-cron');
const payoutProcessor = require('./payout-processor');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/cron.log' }),
    new winston.transports.Console()
  ]
});

// Schedule payout processing for 1st and 15th of each month at 2 AM UTC
const schedulePayouts = () => {
  // Run on 1st of month at 2 AM
  cron.schedule('0 2 1 * *', async () => {
    logger.info('Running scheduled payout processing for 1st of month');
    try {
      await payoutProcessor.processScheduledPayouts();
    } catch (error) {
      logger.error('Scheduled payout processing failed', { error: error.message });
    }
  }, {
    scheduled: true,
    timezone: "UTC"
  });

  // Run on 15th of month at 2 AM
  cron.schedule('0 2 15 * *', async () => {
    logger.info('Running scheduled payout processing for 15th of month');
    try {
      await payoutProcessor.processScheduledPayouts();
    } catch (error) {
      logger.error('Scheduled payout processing failed', { error: error.message });
    }
  }, {
    scheduled: true,
    timezone: "UTC"
  });

  logger.info('Payout processing scheduled for 1st and 15th of each month at 2 AM UTC');
};

// Schedule daily retry of failed payouts at 10 AM UTC
const scheduleRetries = () => {
  cron.schedule('0 10 * * *', async () => {
    logger.info('Running daily retry of failed payouts');
    try {
      await payoutProcessor.retryFailedPayouts();
    } catch (error) {
      logger.error('Failed payout retry failed', { error: error.message });
    }
  }, {
    scheduled: true,
    timezone: "UTC"
  });

  logger.info('Failed payout retry scheduled daily at 10 AM UTC');
};

// Schedule hourly account status updates
const scheduleAccountUpdates = () => {
  cron.schedule('0 * * * *', async () => {
    logger.info('Running hourly account status updates');
    try {
      await payoutProcessor.updateAccountStatuses();
    } catch (error) {
      logger.error('Account status update failed', { error: error.message });
    }
  }, {
    scheduled: true,
    timezone: "UTC"
  });

  logger.info('Account status updates scheduled hourly');
};

// Initialize all scheduled jobs
const initializeScheduledJobs = () => {
  logger.info('Initializing scheduled jobs');
  
  schedulePayouts();
  scheduleRetries();
  scheduleAccountUpdates();
  
  logger.info('All scheduled jobs initialized');
};

module.exports = {
  initializeScheduledJobs,
  schedulePayouts,
  scheduleRetries,
  scheduleAccountUpdates
};