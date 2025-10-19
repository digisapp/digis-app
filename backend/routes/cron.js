/**
 * Cron Job Endpoints
 *
 * These endpoints are called by scheduled tasks (Vercel Cron, QStash, etc)
 * Protected by secret token to prevent unauthorized access
 */

const router = require('express').Router();
const logger = require('../utils/logger');
const { processActiveCallsBilling } = require('../utils/callBilling');

/**
 * Verify cron secret token
 * Set CRON_SECRET in environment variables
 */
function verifyCronSecret(req, res, next) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET || 'development_cron_secret';

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Missing authorization header',
      message: 'Cron endpoints require Bearer token'
    });
  }

  const token = authHeader.substring(7); // Remove 'Bearer '

  if (token !== cronSecret) {
    logger.warn('Invalid cron secret attempt', {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    return res.status(403).json({
      error: 'Invalid cron secret',
      message: 'Unauthorized access to cron endpoint'
    });
  }

  next();
}

/**
 * POST /api/cron/bill-active-calls
 *
 * Process all active calls for per-minute billing
 * Should be called every 60 seconds by cron scheduler
 *
 * Authorization: Bearer <CRON_SECRET>
 */
router.post('/bill-active-calls', verifyCronSecret, async (req, res) => {
  const startTime = Date.now();

  try {
    logger.info('🕐 Cron job started: bill-active-calls');

    const results = await processActiveCallsBilling();

    const duration = Date.now() - startTime;

    logger.info('✅ Cron job completed: bill-active-calls', {
      duration: `${duration}ms`,
      ...results
    });

    res.json({
      success: true,
      job: 'bill-active-calls',
      timestamp: new Date().toISOString(),
      duration,
      results
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('💥 Cron job failed: bill-active-calls', {
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`
    });

    res.status(500).json({
      success: false,
      job: 'bill-active-calls',
      error: error.message,
      timestamp: new Date().toISOString(),
      duration
    });
  }
});

/**
 * GET /api/cron/health
 *
 * Health check for cron endpoints
 * No authorization required
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'cron-jobs',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    endpoints: [
      {
        path: '/api/cron/bill-active-calls',
        method: 'POST',
        frequency: 'Every 60 seconds',
        auth: 'Bearer token required'
      }
    ]
  });
});

module.exports = router;
