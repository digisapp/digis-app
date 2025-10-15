/**
 * Creator Payout Intent API Endpoints
 *
 * Allows creators to opt-in to payouts on a per-cycle basis.
 * Creators must click "Release Funds" to be included in the next payout run.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const pool = require('../utils/db');
const { nextCycleDate, formatCycleDate, getPayoutWindow, getEffectiveCycleDate } = require('../utils/cycle-utils');
const { config } = require('../config/payout-config');

/**
 * POST /api/creator-payouts/intent
 *
 * Set "Release Funds" for the next payout cycle.
 * Creates or updates a pending intent for the creator.
 *
 * @returns {Object} - { success, intent, payoutWindow }
 */
router.post('/intent', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; // From authenticateToken middleware

    // Compute effective cycle date (accounts for cutoff time)
    // If clicking after cutoff on a run day, targets next cycle
    const effectiveCycle = getEffectiveCycleDate(new Date(), config.payout.cutoffHourUTC);
    const cycleDate = formatCycleDate(effectiveCycle);

    // Insert or update intent (idempotent via UPSERT)
    const result = await pool.query(
      `INSERT INTO creator_payout_intents (user_id, cycle_date, status, created_at, updated_at)
       VALUES ($1, $2, 'pending', NOW(), NOW())
       ON CONFLICT (user_id, cycle_date)
       DO UPDATE SET
         status = 'pending',
         updated_at = NOW()
       WHERE creator_payout_intents.status != 'consumed'
       RETURNING *`,
      [userId, cycleDate]
    );

    if (result.rows.length === 0) {
      // Intent already consumed (payout already processed)
      return res.status(409).json({
        success: false,
        error: 'Payout for this cycle has already been processed',
        message: 'This payout cycle has already run. Your next opportunity is the following cycle.',
      });
    }

    const intent = result.rows[0];

    // Get payout window info for UI display
    const payoutWindow = getPayoutWindow();

    res.json({
      success: true,
      intent: {
        id: intent.id,
        cycle_date: intent.cycle_date,
        status: intent.status,
        created_at: intent.created_at,
        updated_at: intent.updated_at,
      },
      payoutWindow: {
        nextCycle: payoutWindow.nextCycleFormatted,
        daysUntil: payoutWindow.daysUntil,
        description: payoutWindow.description,
        displayText: payoutWindow.displayText,
      },
      message: `You will be included in the payout on ${payoutWindow.description}`,
    });
  } catch (error) {
    console.error('[Intent API] Error creating payout intent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set payout intent',
      message: 'An error occurred while setting your payout preference. Please try again.',
    });
  }
});

/**
 * DELETE /api/creator-payouts/intent
 *
 * Cancel "Release Funds" before the payout run.
 * Marks the pending intent as canceled.
 *
 * Query params:
 * - cycle_date (optional): specific cycle to cancel. Defaults to next cycle.
 *
 * @returns {Object} - { success, message }
 */
router.delete('/intent', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { cycle_date } = req.query;

    // Default to next cycle if not specified
    const targetCycleDate = cycle_date || formatCycleDate(nextCycleDate());

    // Update intent to canceled (only if pending)
    const result = await pool.query(
      `UPDATE creator_payout_intents
       SET status = 'canceled', updated_at = NOW()
       WHERE user_id = $1
         AND cycle_date = $2
         AND status = 'pending'
       RETURNING *`,
      [userId, targetCycleDate]
    );

    if (result.rows.length === 0) {
      // No pending intent found
      return res.status(404).json({
        success: false,
        error: 'No pending intent found',
        message: 'You do not have a pending payout request for this cycle, or it has already been processed.',
      });
    }

    const intent = result.rows[0];

    res.json({
      success: true,
      intent: {
        id: intent.id,
        cycle_date: intent.cycle_date,
        status: intent.status,
        updated_at: intent.updated_at,
      },
      message: `Your payout request for ${intent.cycle_date} has been canceled. Your funds will remain in your account.`,
    });
  } catch (error) {
    console.error('[Intent API] Error canceling payout intent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel payout intent',
      message: 'An error occurred while canceling your payout request. Please try again.',
    });
  }
});

/**
 * GET /api/creator-payouts/intent
 *
 * Check current payout intent status.
 * Returns info about current cycle and next cycle intents.
 *
 * @returns {Object} - { hasIntent, currentIntent, nextCycleInfo }
 */
router.get('/intent', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get next cycle date
    const nextCycle = nextCycleDate();
    const nextCycleFormatted = formatCycleDate(nextCycle);

    // Check for existing intent for next cycle
    const result = await pool.query(
      `SELECT * FROM creator_payout_intents
       WHERE user_id = $1 AND cycle_date = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, nextCycleFormatted]
    );

    const payoutWindow = getPayoutWindow();

    if (result.rows.length === 0) {
      // No intent set
      return res.json({
        hasIntent: false,
        currentIntent: null,
        nextCycleInfo: {
          cycleDate: nextCycleFormatted,
          daysUntil: payoutWindow.daysUntil,
          description: payoutWindow.description,
          displayText: payoutWindow.displayText,
        },
        message: 'You have not requested a payout for the next cycle. Click "Release Funds" to opt in.',
      });
    }

    const intent = result.rows[0];

    res.json({
      hasIntent: true,
      currentIntent: {
        id: intent.id,
        cycle_date: intent.cycle_date,
        status: intent.status,
        created_at: intent.created_at,
        updated_at: intent.updated_at,
      },
      nextCycleInfo: {
        cycleDate: nextCycleFormatted,
        daysUntil: payoutWindow.daysUntil,
        description: payoutWindow.description,
        displayText: payoutWindow.displayText,
      },
      message:
        intent.status === 'pending'
          ? `You will receive a payout on ${payoutWindow.description}`
          : intent.status === 'consumed'
          ? 'Your payout for this cycle has been processed'
          : 'Your payout request has been canceled',
    });
  } catch (error) {
    console.error('[Intent API] Error fetching payout intent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payout intent',
      message: 'An error occurred while fetching your payout status. Please try again.',
    });
  }
});

module.exports = router;
