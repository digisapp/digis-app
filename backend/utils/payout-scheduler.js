/**
 * Bi-Monthly Payout Scheduler
 *
 * Handles creator withdrawal requests with automatic payout on 1st and 15th of each month.
 * Includes chargeback protection and balance verification.
 */

const { pool } = require('./db');
const { logger } = require('./secureLogger');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PAYOUT_CONFIG = {
  PAYOUT_DAYS: [1, 15],           // 1st and 15th of month
  MIN_PAYOUT_AMOUNT: 1000,        // 1000 tokens = $50
  CHARGEBACK_BUFFER_DAYS: 7,      // Hold 7 days of earnings for potential chargebacks
  MAX_PENDING_REQUESTS: 3         // Max pending withdrawal requests per creator
};

/**
 * Get next payout date (1st or 15th)
 */
function getNextPayoutDate() {
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let nextDate;

  if (currentDay < 1) {
    nextDate = new Date(currentYear, currentMonth, 1);
  } else if (currentDay < 15) {
    nextDate = new Date(currentYear, currentMonth, 15);
  } else {
    // Next month, 1st
    nextDate = new Date(currentYear, currentMonth + 1, 1);
  }

  return nextDate;
}

/**
 * Get last payout date
 */
function getLastPayoutDate() {
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  if (currentDay >= 15) {
    return new Date(currentYear, currentMonth, 15);
  } else if (currentDay >= 1) {
    return new Date(currentYear, currentMonth, 1);
  } else {
    // Previous month, 15th
    return new Date(currentYear, currentMonth - 1, 15);
  }
}

/**
 * Calculate available balance for creator (excludes recent earnings in chargeback window)
 */
async function getAvailableBalance(creatorId) {
  const chargebackBufferDate = new Date();
  chargebackBufferDate.setDate(chargebackBufferDate.getDate() - PAYOUT_CONFIG.CHARGEBACK_BUFFER_DAYS);

  const result = await pool.query(`
    WITH earnings AS (
      SELECT
        SUM(tokens) FILTER (WHERE created_at < $2) AS safe_earnings,
        SUM(tokens) FILTER (WHERE created_at >= $2) AS buffered_earnings,
        SUM(tokens) AS total_earnings
      FROM token_transactions
      WHERE user_id = $1
        AND tokens > 0
        AND type IN ('tip', 'call', 'gift_received', 'stream_tip')
        AND status = 'completed'
    ),
    chargebacks AS (
      SELECT COALESCE(SUM(ABS(tokens)), 0) AS total_chargebacks
      FROM token_transactions
      WHERE user_id = $1
        AND type = 'chargeback'
        AND status = 'completed'
    ),
    pending_payouts AS (
      SELECT COALESCE(SUM(amount), 0) AS total_pending
      FROM withdrawal_requests
      WHERE creator_id = $1
        AND status = 'pending'
    )
    SELECT
      COALESCE(e.safe_earnings, 0) AS safe_earnings,
      COALESCE(e.buffered_earnings, 0) AS buffered_earnings,
      COALESCE(e.total_earnings, 0) AS total_earnings,
      COALESCE(c.total_chargebacks, 0) AS total_chargebacks,
      COALESCE(pp.total_pending, 0) AS total_pending,
      GREATEST(0, COALESCE(e.safe_earnings, 0) - COALESCE(c.total_chargebacks, 0) - COALESCE(pp.total_pending, 0)) AS available
    FROM earnings e, chargebacks c, pending_payouts pp
  `, [creatorId, chargebackBufferDate]);

  return result.rows[0];
}

/**
 * Create withdrawal request
 */
async function createWithdrawalRequest(creatorId, requestedAmount, metadata = {}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verify creator status
    const creatorCheck = await client.query(
      'SELECT is_creator, email FROM users WHERE supabase_id = $1',
      [creatorId]
    );

    if (creatorCheck.rows.length === 0 || !creatorCheck.rows[0].is_creator) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: 'Only approved creators can request withdrawals'
      };
    }

    // Check minimum amount
    if (requestedAmount < PAYOUT_CONFIG.MIN_PAYOUT_AMOUNT) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: `Minimum withdrawal is ${PAYOUT_CONFIG.MIN_PAYOUT_AMOUNT} tokens ($${PAYOUT_CONFIG.MIN_PAYOUT_AMOUNT * 0.05})`
      };
    }

    // Check pending requests
    const pendingCount = await client.query(
      'SELECT COUNT(*) as count FROM withdrawal_requests WHERE creator_id = $1 AND status = $2',
      [creatorId, 'pending']
    );

    if (parseInt(pendingCount.rows[0].count) >= PAYOUT_CONFIG.MAX_PENDING_REQUESTS) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: `Maximum ${PAYOUT_CONFIG.MAX_PENDING_REQUESTS} pending withdrawal requests allowed`
      };
    }

    // Get available balance
    const balanceInfo = await getAvailableBalance(creatorId);

    if (balanceInfo.available < requestedAmount) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: 'Insufficient available balance',
        details: {
          requested: requestedAmount,
          available: balanceInfo.available,
          buffered: balanceInfo.buffered_earnings,
          bufferReason: `${PAYOUT_CONFIG.CHARGEBACK_BUFFER_DAYS}-day chargeback protection`
        }
      };
    }

    // Create withdrawal request
    const nextPayoutDate = getNextPayoutDate();
    const amountUsd = requestedAmount * 0.05;

    const result = await client.query(`
      INSERT INTO withdrawal_requests (
        creator_id,
        amount,
        amount_usd,
        payout_date,
        status,
        metadata,
        created_at
      ) VALUES ($1, $2, $3, $4, 'pending', $5, NOW())
      RETURNING *
    `, [creatorId, requestedAmount, amountUsd, nextPayoutDate, JSON.stringify(metadata)]);

    await client.query('COMMIT');

    logger.info(`✅ Withdrawal request created: ${creatorId}, ${requestedAmount} tokens, payout on ${nextPayoutDate.toISOString().split('T')[0]}`);

    return {
      success: true,
      request: result.rows[0],
      payoutDate: nextPayoutDate,
      message: `Withdrawal of ${requestedAmount} tokens ($${amountUsd.toFixed(2)}) queued for ${nextPayoutDate.toISOString().split('T')[0]}`
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Withdrawal request error:', error);
    return {
      success: false,
      error: 'Failed to create withdrawal request',
      details: error.message
    };
  } finally {
    client.release();
  }
}

/**
 * Cancel withdrawal request (before payout date)
 */
async function cancelWithdrawalRequest(requestId, creatorId) {
  const result = await pool.query(`
    UPDATE withdrawal_requests
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = $1
      AND creator_id = $2
      AND status = 'pending'
      AND payout_date > NOW()
    RETURNING *
  `, [requestId, creatorId]);

  if (result.rows.length === 0) {
    return {
      success: false,
      error: 'Request not found or cannot be cancelled'
    };
  }

  logger.info(`Withdrawal request cancelled: ${requestId}`);

  return {
    success: true,
    request: result.rows[0]
  };
}

/**
 * Process all pending withdrawals for a payout date (run on 1st and 15th)
 */
async function processPayoutBatch(payoutDate = new Date()) {
  const client = await pool.connect();
  const results = {
    processed: 0,
    failed: 0,
    totalAmount: 0,
    errors: []
  };

  try {
    await client.query('BEGIN');

    // Get all pending requests for this payout date
    const requests = await client.query(`
      SELECT
        wr.*,
        u.email,
        u.username,
        u.stripe_connect_account_id
      FROM withdrawal_requests wr
      JOIN users u ON wr.creator_id = u.supabase_id
      WHERE wr.status = 'pending'
        AND DATE(wr.payout_date) = DATE($1)
      ORDER BY wr.created_at ASC
    `, [payoutDate]);

    logger.info(`Processing ${requests.rows.length} withdrawal requests for ${payoutDate.toISOString().split('T')[0]}`);

    for (const request of requests.rows) {
      try {
        // Final balance check (in case of chargebacks since request was made)
        const currentBalance = await getAvailableBalance(request.creator_id);

        if (currentBalance.available < request.amount) {
          // Mark as failed - insufficient balance
          await client.query(`
            UPDATE withdrawal_requests
            SET status = 'failed',
                error_message = $1,
                processed_at = NOW()
            WHERE id = $2
          `, [
            `Insufficient balance: ${currentBalance.available} available, ${request.amount} requested`,
            request.id
          ]);

          results.failed++;
          results.errors.push({
            requestId: request.id,
            creator: request.email,
            error: 'Insufficient balance'
          });
          continue;
        }

        // Process Stripe payout (or your payment method)
        let payoutResult;
        if (request.stripe_connect_account_id) {
          // Stripe Connect payout
          payoutResult = await stripe.transfers.create({
            amount: Math.round(request.amount_usd * 100), // Convert to cents
            currency: 'usd',
            destination: request.stripe_connect_account_id,
            description: `Digis payout: ${request.amount} tokens`,
            metadata: {
              withdrawal_request_id: request.id,
              creator_id: request.creator_id,
              payout_date: payoutDate.toISOString()
            }
          });
        } else {
          // TODO: Handle other payout methods (bank transfer, PayPal, etc.)
          throw new Error('No payout method configured for creator');
        }

        // Deduct from creator balance
        await client.query(`
          INSERT INTO token_transactions (
            user_id, type, tokens, amount_usd, status,
            stripe_payment_intent_id, metadata, created_at
          ) VALUES ($1, 'payout', $2, $3, 'completed', $4, $5, NOW())
        `, [
          request.creator_id,
          -request.amount,
          request.amount_usd,
          payoutResult.id,
          JSON.stringify({ withdrawal_request_id: request.id })
        ]);

        // Update withdrawal request status
        await client.query(`
          UPDATE withdrawal_requests
          SET status = 'completed',
              stripe_transfer_id = $1,
              processed_at = NOW()
          WHERE id = $2
        `, [payoutResult.id, request.id]);

        results.processed++;
        results.totalAmount += request.amount_usd;

        logger.info(`✅ Payout processed: ${request.email}, $${request.amount_usd}`);

      } catch (error) {
        logger.error(`Failed to process payout for ${request.email}:`, error);

        await client.query(`
          UPDATE withdrawal_requests
          SET status = 'failed',
              error_message = $1,
              processed_at = NOW()
          WHERE id = $2
        `, [error.message, request.id]);

        results.failed++;
        results.errors.push({
          requestId: request.id,
          creator: request.email,
          error: error.message
        });
      }
    }

    await client.query('COMMIT');

    logger.info(`Payout batch complete: ${results.processed} processed, ${results.failed} failed, $${results.totalAmount.toFixed(2)} total`);

    return results;

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Payout batch processing error:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getNextPayoutDate,
  getLastPayoutDate,
  getAvailableBalance,
  createWithdrawalRequest,
  cancelWithdrawalRequest,
  processPayoutBatch,
  PAYOUT_CONFIG
};
