/**
 * Vercel Cron Routes
 *
 * Replaces node-cron jobs with Vercel Cron endpoints.
 * These routes are called by Vercel's cron scheduler.
 *
 * SECURITY: Verify cron requests come from Vercel using authorization header
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../../utils/secureLogger');

/**
 * Middleware to verify cron requests come from Vercel
 *
 * Vercel sends Authorization: Bearer <secret> header
 * Set VERCEL_CRON_SECRET in environment variables
 */
function verifyCronRequest(req, res, next) {
  const authHeader = req.headers.authorization;

  // In development, allow without auth
  if (process.env.NODE_ENV === 'development') {
    logger.warn('Cron request in development mode - skipping auth');
    return next();
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.error('Cron request missing authorization header');
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const token = authHeader.slice(7); // Remove 'Bearer '
  const expectedToken = process.env.VERCEL_CRON_SECRET;

  if (!expectedToken) {
    logger.error('VERCEL_CRON_SECRET not configured');
    return res.status(500).json({ success: false, error: 'Server misconfigured' });
  }

  if (token !== expectedToken) {
    logger.error('Invalid cron authorization token');
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  next();
}

// Apply auth middleware to all cron routes
router.use(verifyCronRequest);

/**
 * Payout processing (1st and 15th of month, 2 AM UTC)
 *
 * Cron: 0 2 1,15 * *
 */
router.post('/payouts', async (req, res) => {
  logger.info('Cron job started: payouts');

  try {
    const payoutProcessor = require('../../jobs/payout-processor');
    const result = await payoutProcessor.processScheduledPayouts();

    logger.info('Cron job completed: payouts', { result });
    res.json({ success: true, result });
  } catch (error) {
    logger.error('Cron job failed: payouts', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Retry failed payouts (daily at 10 AM UTC)
 *
 * Cron: 0 10 * * *
 */
router.post('/payout-retry', async (req, res) => {
  logger.info('Cron job started: payout-retry');

  try {
    const payoutProcessor = require('../../jobs/payout-processor');
    const result = await payoutProcessor.retryFailedPayouts();

    logger.info('Cron job completed: payout-retry', { result });
    res.json({ success: true, result });
  } catch (error) {
    logger.error('Cron job failed: payout-retry', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Daily loyalty perks (10 AM UTC)
 *
 * Cron: 0 10 * * *
 */
router.post('/loyalty-perks-daily', async (req, res) => {
  logger.info('Cron job started: loyalty-perks-daily');

  try {
    const loyaltyPerkDelivery = require('../../jobs/loyalty-perk-delivery');
    const result = await loyaltyPerkDelivery.processDailyPerks();

    logger.info('Cron job completed: loyalty-perks-daily', { result });
    res.json({ success: true, result });
  } catch (error) {
    logger.error('Cron job failed: loyalty-perks-daily', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Weekly loyalty perks (Mondays, 10 AM UTC)
 *
 * Cron: 0 10 * * 1
 */
router.post('/loyalty-perks-weekly', async (req, res) => {
  logger.info('Cron job started: loyalty-perks-weekly');

  try {
    const loyaltyPerkDelivery = require('../../jobs/loyalty-perk-delivery');
    const result = await loyaltyPerkDelivery.processWeeklyPerks();

    logger.info('Cron job completed: loyalty-perks-weekly', { result });
    res.json({ success: true, result });
  } catch (error) {
    logger.error('Cron job failed: loyalty-perks-weekly', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Monthly loyalty perks (1st of month, midnight UTC)
 *
 * Cron: 0 0 1 * *
 */
router.post('/loyalty-perks-monthly', async (req, res) => {
  logger.info('Cron job started: loyalty-perks-monthly');

  try {
    const loyaltyPerkDelivery = require('../../jobs/loyalty-perk-delivery');
    const result = await loyaltyPerkDelivery.processMonthlyPerks();

    logger.info('Cron job completed: loyalty-perks-monthly', { result });
    res.json({ success: true, result });
  } catch (error) {
    logger.error('Cron job failed: loyalty-perks-monthly', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Stream activity check (every 5 minutes)
 *
 * Cron: */5 * * * *
 */
router.post('/stream-activity-check', async (req, res) => {
  logger.info('Cron job started: stream-activity-check');

  try {
    const streamActivityMonitor = require('../../utils/stream-activity-monitor');
    const result = await streamActivityMonitor.checkInactiveStreams();

    logger.info('Cron job completed: stream-activity-check', { result });
    res.json({ success: true, result });
  } catch (error) {
    logger.error('Cron job failed: stream-activity-check', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Cleanup tasks (hourly)
 *
 * Cron: 0 * * * *
 */
router.post('/cleanup', async (req, res) => {
  logger.info('Cron job started: cleanup');

  try {
    // Add cleanup logic here (old sessions, expired tokens, etc.)
    const result = {
      sessionsDeleted: 0,
      tokensExpired: 0,
    };

    logger.info('Cron job completed: cleanup', { result });
    res.json({ success: true, result });
  } catch (error) {
    logger.error('Cron job failed: cleanup', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
