/**
 * Internal Payout Cron Endpoint
 *
 * Secured endpoint for triggering twice-monthly payout runs.
 * Called by QStash, Cloud Scheduler, or other cron systems.
 *
 * Security: Requires CRON_SECRET_KEY in X-Cron-Secret header
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../../utils/db');
const { logger } = require('../../utils/secureLogger');
const { config } = require('../../config/payout-config');
const { determinePayoutCycle } = require('../../utils/payout-policy');
const stripeConnect = require('../../services/stripe-connect');

/**
 * Middleware: Authenticate cron requests
 */
const authenticateCron = (req, res, next) => {
  const cronSecret = req.headers[config.security.cronHeaderName.toLowerCase()];

  if (!config.security.cronSecret) {
    logger.warn('Cron endpoint accessed but CRON_SECRET_KEY not configured');
    return res.status(503).json({
      error: 'Cron endpoint not configured',
      message: 'CRON_SECRET_KEY must be set in environment'
    });
  }

  if (!cronSecret || cronSecret !== config.security.cronSecret) {
    logger.warn('Unauthorized cron request', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

/**
 * POST /internal/payouts/run
 *
 * Trigger a payout cycle run
 *
 * Body:
 *   {
 *     "cycleDate": "2025-10-15" (optional, defaults to today)
 *   }
 */
router.post('/run', authenticateCron, async (req, res) => {
  const requestId = req.requestId || 'unknown';
  const { cycleDate: requestedCycleDate } = req.body || {};

  try {
    // Determine cycle date
    let cycleInfo;
    if (requestedCycleDate) {
      const date = new Date(requestedCycleDate);
      cycleInfo = determinePayoutCycle(date);
    } else {
      cycleInfo = determinePayoutCycle();
    }

    const { cycleDate, periodStart, periodEnd } = cycleInfo;

    logger.info('Payout cycle triggered', {
      requestId,
      cycleDate,
      periodStart,
      periodEnd,
      triggeredBy: 'cron'
    });

    // Check if cycle already exists
    const existingRun = await pool.query(
      `SELECT id, status FROM payout_runs WHERE cycle_date = $1`,
      [cycleDate]
    );

    if (existingRun.rows.length > 0) {
      const existing = existingRun.rows[0];
      if (existing.status === 'running') {
        return res.status(409).json({
          error: 'Run already in progress',
          runId: existing.id,
          cycleDate
        });
      }
      if (existing.status === 'succeeded') {
        return res.json({
          message: 'Run already completed',
          runId: existing.id,
          cycleDate,
          status: 'succeeded'
        });
      }
      // If failed or partial, allow re-run
    }

    // Create or update run record
    const runResult = await pool.query(
      `INSERT INTO payout_runs (cycle_date, status, started_at)
       VALUES ($1, 'pending', NOW())
       ON CONFLICT (cycle_date) DO UPDATE
       SET status = 'pending', started_at = NOW()
       RETURNING id`,
      [cycleDate]
    );

    const runId = runResult.rows[0].id;

    // Trigger Inngest function (if available) or process inline
    const inngestAvailable = process.env.INNGEST_EVENT_KEY;

    if (inngestAvailable) {
      try {
        const { inngest } = require('../../inngest/client');
        await inngest.send({
          name: 'payout.scheduled',
          data: {
            runId,
            cycleDate,
            periodStart,
            periodEnd,
            dayOfMonth: new Date(cycleDate).getDate()
          }
        });

        logger.info('Payout run triggered via Inngest', {
          requestId,
          runId,
          cycleDate
        });

        res.json({
          success: true,
          message: 'Payout run triggered',
          runId,
          cycleDate,
          method: 'inngest'
        });
      } catch (inngestError) {
        logger.error('Failed to trigger Inngest', {
          requestId,
          error: inngestError.message
        });
        // Fall back to inline processing
        processPayoutsInline(runId, cycleDate, periodStart, periodEnd, res);
      }
    } else {
      // Process inline (for non-serverless environments)
      processPayoutsInline(runId, cycleDate, periodStart, periodEnd, res);
    }

  } catch (error) {
    logger.error('Payout cycle trigger failed', {
      requestId,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      error: 'Failed to trigger payout cycle',
      message: error.message
    });
  }
});

/**
 * Process payouts inline (fallback for non-Inngest environments)
 */
async function processPayoutsInline(runId, cycleDate, periodStart, periodEnd, res) {
  try {
    await pool.query(
      `UPDATE payout_runs SET status = 'running' WHERE id = $1`,
      [runId]
    );

    // Import and run the payout processor
    const { processPendingPayouts } = require('../../services/stripe-connect');

    // Send immediate response
    res.json({
      success: true,
      message: 'Payout run started (processing inline)',
      runId,
      cycleDate,
      method: 'inline'
    });

    // Process in background (don't await for HTTP response)
    setImmediate(async () => {
      try {
        const result = await processPendingPayouts();

        await pool.query(
          `UPDATE payout_runs
           SET status = $1, finished_at = NOW()
           WHERE id = $2`,
          [result.failed > 0 ? 'partial' : 'succeeded', runId]
        );

        logger.info('Payout run completed', {
          runId,
          cycleDate,
          ...result
        });
      } catch (processError) {
        await pool.query(
          `UPDATE payout_runs
           SET status = 'failed', finished_at = NOW()
           WHERE id = $1`,
          [runId]
        );

        logger.error('Payout processing failed', {
          runId,
          error: processError.message
        });
      }
    });

  } catch (error) {
    logger.error('Inline payout processing failed', {
      runId,
      error: error.message
    });
    throw error;
  }
}

/**
 * GET /internal/payouts/status/:runId
 *
 * Check status of a payout run
 */
router.get('/status/:runId', authenticateCron, async (req, res) => {
  try {
    const { runId } = req.params;

    const result = await pool.query(
      `SELECT
        pr.*,
        COUNT(cp.id) as total_payouts,
        SUM(CASE WHEN cp.status = 'paid' THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN cp.status = 'failed' THEN 1 ELSE 0 END) as failed_count,
        SUM(CASE WHEN cp.status = 'processing' THEN 1 ELSE 0 END) as processing_count,
        SUM(cp.net_payout_amount) as total_amount
       FROM payout_runs pr
       LEFT JOIN creator_payouts cp ON cp.run_id = pr.id
       WHERE pr.id = $1
       GROUP BY pr.id`,
      [runId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Failed to fetch run status', {
      runId: req.params.runId,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

/**
 * GET /internal/payouts/health
 *
 * Health check for payout system
 */
router.get('/health', authenticateCron, async (req, res) => {
  try {
    // Check recent runs
    const recentRuns = await pool.query(
      `SELECT cycle_date, status, created_at
       FROM payout_runs
       ORDER BY cycle_date DESC
       LIMIT 5`
    );

    // Check for stuck runs (running > 1 hour)
    const stuckRuns = await pool.query(
      `SELECT id, cycle_date, started_at
       FROM payout_runs
       WHERE status = 'running'
         AND started_at < NOW() - INTERVAL '1 hour'`
    );

    // Check failed payouts needing retry
    const failedPayouts = await pool.query(
      `SELECT COUNT(*) as count
       FROM creator_payouts
       WHERE status = 'failed'
         AND created_at > NOW() - INTERVAL '7 days'`
    );

    res.json({
      healthy: stuckRuns.rows.length === 0,
      recentRuns: recentRuns.rows,
      stuckRuns: stuckRuns.rows,
      failedPayoutsLast7Days: parseInt(failedPayouts.rows[0].count),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Payout health check failed', { error: error.message });
    res.status(500).json({ error: 'Health check failed' });
  }
});

module.exports = router;
