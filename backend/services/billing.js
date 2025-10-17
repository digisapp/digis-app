const { pool } = require('../utils/db');
const { logger } = require('../utils/secureLogger');

// Billing block duration (30 seconds)
const BLOCK_SECONDS = 30;

/**
 * Meter one billing block for an active call (every 30 seconds)
 * Charges the fan and credits the creator
 */
async function meterCallBlock(callId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get call details with lock
    const callResult = await client.query(
      'SELECT * FROM calls WHERE id = $1 FOR UPDATE',
      [callId]
    );

    if (callResult.rows.length === 0) {
      await client.query('ROLLBACK');
      logger.warn('Call not found for metering', { callId });
      return { success: false, reason: 'CALL_NOT_FOUND' };
    }

    const call = callResult.rows[0];

    // Only meter active calls
    if (call.status !== 'active') {
      await client.query('ROLLBACK');
      logger.info('Call not active, skipping metering', { callId, status: call.status });
      return { success: false, reason: 'CALL_NOT_ACTIVE', status: call.status };
    }

    // Calculate block cost based on rate per minute
    const blockCost = Math.ceil((call.rate_tokens_per_min / 60) * BLOCK_SECONDS);

    // Get fan's wallet with lock
    const fanWallet = await client.query(
      'SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE',
      [call.fan_id]
    );

    if (fanWallet.rows.length === 0) {
      await client.query('ROLLBACK');
      logger.error('Fan wallet not found', { fanId: call.fan_id, callId });
      return { success: false, reason: 'WALLET_NOT_FOUND' };
    }

    const fanBalance = fanWallet.rows[0].balance;

    // Check if fan has sufficient funds
    if (fanBalance < blockCost) {
      // Insufficient funds - end the call
      await client.query(
        `UPDATE calls SET status = 'ended', ended_at = NOW() WHERE id = $1`,
        [callId]
      );

      await client.query('COMMIT');

      logger.warn('Insufficient funds, call ended', {
        callId,
        fanId: call.fan_id,
        balance: fanBalance,
        required: blockCost
      });

      return {
        success: false,
        reason: 'INSUFFICIENT_FUNDS',
        balance: fanBalance,
        required: blockCost,
        callEnded: true
      };
    }

    // Deduct from fan
    await client.query(
      'UPDATE wallets SET balance = balance - $1, lifetime_spent = lifetime_spent + $1 WHERE user_id = $2',
      [blockCost, call.fan_id]
    );

    // Creator gets 100% (Digis margin comes from token sales, not spending)
    const creatorCut = blockCost;
    const platformFee = 0;

    // Credit creator
    await client.query(
      'UPDATE wallets SET balance = balance + $1, lifetime_earned = lifetime_earned + $1 WHERE user_id = $2',
      [creatorCut, call.creator_id]
    );

    // Record billing events
    await client.query(
      `INSERT INTO billing_events (subject_type, subject_id, user_id, delta_tokens, reason, metadata)
       VALUES ('call', $1, $2, $3, 'ppm', $4)`,
      [
        callId,
        call.fan_id,
        -blockCost,
        JSON.stringify({
          block_seconds: BLOCK_SECONDS,
          rate_per_min: call.rate_tokens_per_min,
          creator_id: call.creator_id
        })
      ]
    );

    await client.query(
      `INSERT INTO billing_events (subject_type, subject_id, user_id, delta_tokens, reason, metadata)
       VALUES ('call', $1, $2, $3, 'payout', $4)`,
      [
        callId,
        call.creator_id,
        creatorCut,
        JSON.stringify({
          block_seconds: BLOCK_SECONDS,
          platform_fee: 0, // No fee - creators get 100%
          fan_id: call.fan_id
        })
      ]
    );

    // Update call stats
    await client.query(
      `UPDATE calls
       SET billed_seconds = billed_seconds + $1,
           total_cost_tokens = total_cost_tokens + $2
       WHERE id = $3`,
      [BLOCK_SECONDS, blockCost, callId]
    );

    await client.query('COMMIT');

    logger.info('Call block metered successfully', {
      callId,
      blockCost,
      creatorCut,
      platformFee,
      billedSeconds: call.billed_seconds + BLOCK_SECONDS
    });

    return {
      success: true,
      blockCost,
      creatorCut,
      platformFee,
      newBalance: fanBalance - blockCost,
      billedSeconds: call.billed_seconds + BLOCK_SECONDS
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error metering call block:', error, { callId });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Pause a call (stop metering temporarily)
 */
async function pauseCall(callId) {
  try {
    const result = await pool.query(
      `UPDATE calls SET status = 'paused' WHERE id = $1 AND status = 'active' RETURNING *`,
      [callId]
    );

    if (result.rows.length === 0) {
      return { success: false, reason: 'CALL_NOT_FOUND_OR_NOT_ACTIVE' };
    }

    logger.info('Call paused', { callId });

    return { success: true, call: result.rows[0] };
  } catch (error) {
    logger.error('Error pausing call:', error, { callId });
    throw error;
  }
}

/**
 * Resume a paused call
 */
async function resumeCall(callId) {
  try {
    const result = await pool.query(
      `UPDATE calls SET status = 'active' WHERE id = $1 AND status = 'paused' RETURNING *`,
      [callId]
    );

    if (result.rows.length === 0) {
      return { success: false, reason: 'CALL_NOT_FOUND_OR_NOT_PAUSED' };
    }

    logger.info('Call resumed', { callId });

    return { success: true, call: result.rows[0] };
  } catch (error) {
    logger.error('Error resuming call:', error, { callId });
    throw error;
  }
}

/**
 * Get all active calls that need metering
 */
async function getActiveCallsForMetering() {
  try {
    const result = await pool.query(
      `SELECT id, creator_id, fan_id, rate_tokens_per_min, billed_seconds, started_at
       FROM calls
       WHERE status = 'active'
       AND started_at <= NOW() - INTERVAL '${BLOCK_SECONDS} seconds'
       ORDER BY started_at ASC`
    );

    return result.rows;
  } catch (error) {
    logger.error('Error getting active calls for metering:', error);
    throw error;
  }
}

/**
 * Run metering job for all active calls
 * This should be called by a cron job or background worker every 30 seconds
 */
async function meterAllActiveCalls() {
  try {
    const activeCalls = await getActiveCallsForMetering();

    logger.info(`Metering ${activeCalls.length} active calls`);

    const results = [];

    for (const call of activeCalls) {
      try {
        const result = await meterCallBlock(call.id);
        results.push({ callId: call.id, ...result });
      } catch (error) {
        logger.error('Error metering individual call:', error, { callId: call.id });
        results.push({ callId: call.id, success: false, error: error.message });
      }
    }

    return {
      success: true,
      metered: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };

  } catch (error) {
    logger.error('Error in meterAllActiveCalls:', error);
    throw error;
  }
}

module.exports = {
  meterCallBlock,
  pauseCall,
  resumeCall,
  getActiveCallsForMetering,
  meterAllActiveCalls,
  BLOCK_SECONDS
};
