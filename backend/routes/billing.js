const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const { meterCallBlock, pauseCall, resumeCall, meterAllActiveCalls } = require('../services/billing');
const { logger } = require('../utils/secureLogger');

// Client-driven control signals (used by MobileVideoStream onBillingStateChange)
router.post('/billing/:callId/active', authenticateToken, async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.user.supabase_id;

    // Verify user is part of this call
    const callCheck = await pool.query(
      'SELECT creator_id, fan_id, status FROM calls WHERE id = $1',
      [callId]
    );

    if (callCheck.rows.length === 0) {
      return res.status(404).json({ error: 'CALL_NOT_FOUND' });
    }

    const call = callCheck.rows[0];

    if (call.creator_id !== userId && call.fan_id !== userId) {
      return res.status(403).json({ error: 'UNAUTHORIZED' });
    }

    // Resume metering if paused
    if (call.status === 'paused') {
      const result = await resumeCall(callId);

      logger.info('Billing activated (resumed)', { callId, userId });

      return res.json({
        success: result.success,
        status: 'active',
        message: 'Billing resumed'
      });
    }

    res.json({
      success: true,
      status: call.status,
      message: 'Billing is active'
    });

  } catch (error) {
    logger.error('Error activating billing:', error);
    res.status(500).json({ error: 'BILLING_ACTIVATION_FAILED', message: error.message });
  }
});

router.post('/billing/:callId/pause', authenticateToken, async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.user.supabase_id;

    // Verify user is part of this call
    const callCheck = await pool.query(
      'SELECT creator_id, fan_id, status FROM calls WHERE id = $1',
      [callId]
    );

    if (callCheck.rows.length === 0) {
      return res.status(404).json({ error: 'CALL_NOT_FOUND' });
    }

    const call = callCheck.rows[0];

    if (call.creator_id !== userId && call.fan_id !== userId) {
      return res.status(403).json({ error: 'UNAUTHORIZED' });
    }

    const result = await pauseCall(callId);

    logger.info('Billing paused', { callId, userId });

    res.json({
      success: result.success,
      status: 'paused',
      message: 'Billing paused'
    });

  } catch (error) {
    logger.error('Error pausing billing:', error);
    res.status(500).json({ error: 'BILLING_PAUSE_FAILED', message: error.message });
  }
});

router.post('/billing/:callId/stop', authenticateToken, async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.user.supabase_id;

    // Verify user is part of this call
    const callCheck = await pool.query(
      'SELECT creator_id, fan_id FROM calls WHERE id = $1',
      [callId]
    );

    if (callCheck.rows.length === 0) {
      return res.status(404).json({ error: 'CALL_NOT_FOUND' });
    }

    const call = callCheck.rows[0];

    if (call.creator_id !== userId && call.fan_id !== userId) {
      return res.status(403).json({ error: 'UNAUTHORIZED' });
    }

    // End the call
    await pool.query(
      `UPDATE calls SET status = 'ended', ended_at = NOW() WHERE id = $1`,
      [callId]
    );

    logger.info('Billing stopped (call ended)', { callId, userId });

    res.json({
      success: true,
      status: 'ended',
      message: 'Billing stopped, call ended'
    });

  } catch (error) {
    logger.error('Error stopping billing:', error);
    res.status(500).json({ error: 'BILLING_STOP_FAILED', message: error.message });
  }
});

// Server-side metering webhook (called by cron job every 30s)
router.post('/billing/meter', async (req, res) => {
  try {
    const { callId, secret } = req.body;

    // Verify webhook secret
    if (secret !== process.env.BILLING_WEBHOOK_SECRET) {
      logger.warn('Invalid billing webhook secret');
      return res.status(403).json({ error: 'UNAUTHORIZED' });
    }

    if (callId) {
      // Meter specific call
      const result = await meterCallBlock(callId);

      return res.json({
        success: result.success,
        callId,
        ...result
      });
    } else {
      // Meter all active calls
      const result = await meterAllActiveCalls();

      return res.json({
        success: true,
        ...result
      });
    }

  } catch (error) {
    logger.error('Error in metering webhook:', error);
    res.status(500).json({ error: 'METER_FAILED', message: error.message });
  }
});

// Get billing history for a call
router.get('/billing/calls/:callId/history', authenticateToken, async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.user.supabase_id;

    // Verify user is part of this call
    const callCheck = await pool.query(
      'SELECT creator_id, fan_id FROM calls WHERE id = $1',
      [callId]
    );

    if (callCheck.rows.length === 0) {
      return res.status(404).json({ error: 'CALL_NOT_FOUND' });
    }

    const call = callCheck.rows[0];

    if (call.creator_id !== userId && call.fan_id !== userId) {
      return res.status(403).json({ error: 'UNAUTHORIZED' });
    }

    // Get billing events for this call
    const events = await pool.query(
      `SELECT * FROM billing_events
       WHERE subject_type = 'call' AND subject_id = $1
       ORDER BY created_at ASC`,
      [callId]
    );

    res.json({
      success: true,
      callId,
      events: events.rows
    });

  } catch (error) {
    logger.error('Error fetching billing history:', error);
    res.status(500).json({ error: 'FETCH_HISTORY_FAILED', message: error.message });
  }
});

// Get billing stats for a user
router.get('/billing/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { period = '30d' } = req.query;

    let dateFilter = "created_at >= NOW() - INTERVAL '30 days'";
    if (period === '7d') {
      dateFilter = "created_at >= NOW() - INTERVAL '7 days'";
    } else if (period === '24h') {
      dateFilter = "created_at >= NOW() - INTERVAL '24 hours'";
    } else if (period === 'all') {
      dateFilter = '1=1';
    }

    // Total spent (for fans)
    const spentResult = await pool.query(
      `SELECT
        COUNT(*) as transaction_count,
        SUM(ABS(delta_tokens)) as total_spent
       FROM billing_events
       WHERE user_id = $1 AND delta_tokens < 0 AND ${dateFilter}`,
      [userId]
    );

    // Total earned (for creators)
    const earnedResult = await pool.query(
      `SELECT
        COUNT(*) as transaction_count,
        SUM(delta_tokens) as total_earned
       FROM billing_events
       WHERE user_id = $1 AND delta_tokens > 0 AND ${dateFilter}`,
      [userId]
    );

    // Breakdown by reason
    const breakdownResult = await pool.query(
      `SELECT
        reason,
        COUNT(*) as count,
        SUM(ABS(delta_tokens)) as total
       FROM billing_events
       WHERE user_id = $1 AND ${dateFilter}
       GROUP BY reason
       ORDER BY total DESC`,
      [userId]
    );

    res.json({
      success: true,
      period,
      spent: spentResult.rows[0],
      earned: earnedResult.rows[0],
      breakdown: breakdownResult.rows
    });

  } catch (error) {
    logger.error('Error fetching billing stats:', error);
    res.status(500).json({ error: 'FETCH_STATS_FAILED', message: error.message });
  }
});

module.exports = router;
