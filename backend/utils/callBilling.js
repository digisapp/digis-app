/**
 * Server-Authoritative Call Billing
 *
 * Implements per-minute billing with:
 * - No negative balances (call ends when funds run out)
 * - Idempotent billing (can't bill same minute twice)
 * - Atomic transactions (all-or-nothing)
 * - Full audit trail
 */

const db = require('./db');
const logger = require('./logger');
const { publishToChannel } = require('./ably-adapter');

/**
 * Bill a single minute for an active call
 *
 * @param {number} callId - Call ID to bill
 * @param {number} minuteToBill - Which minute to bill (1-based)
 * @returns {Object} { success, insufficientFunds, callEnded, details }
 */
async function billCallMinute(callId, minuteToBill) {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    logger.info('💰 Billing call minute:', { callId, minuteToBill });

    // Step 1: Atomically claim this minute (prevents double-billing)
    const claimResult = await client.query(
      `UPDATE calls
       SET last_billed_minute = last_billed_minute + 1,
           updated_at = NOW()
       WHERE id = $1
         AND status = 'active'
         AND last_billed_minute = $2 - 1
       RETURNING
         id,
         creator_id,
         fan_id,
         rate_tokens_per_min,
         billing_group_id,
         channel,
         last_billed_minute,
         started_at`,
      [callId, minuteToBill]
    );

    // If no rows returned, either:
    // - Call already ended
    // - Minute already billed
    // - Call doesn't exist
    if (claimResult.rows.length === 0) {
      await client.query('ROLLBACK');

      // Check if call exists and status
      const statusCheck = await db.query(
        'SELECT id, status, last_billed_minute FROM calls WHERE id = $1',
        [callId]
      );

      if (statusCheck.rows.length === 0) {
        logger.warn('Call not found:', { callId });
        return { success: false, error: 'CALL_NOT_FOUND' };
      }

      const call = statusCheck.rows[0];
      if (call.status !== 'active') {
        logger.info('Call already ended:', { callId, status: call.status });
        return { success: false, error: 'CALL_ENDED' };
      }

      if (call.last_billed_minute >= minuteToBill) {
        logger.info('Minute already billed:', { callId, minuteToBill, lastBilled: call.last_billed_minute });
        return { success: false, error: 'ALREADY_BILLED' };
      }

      logger.warn('Failed to claim minute (race condition?):', { callId, minuteToBill });
      return { success: false, error: 'CLAIM_FAILED' };
    }

    const call = claimResult.rows[0];
    const tokensPerMin = call.rate_tokens_per_min;
    const billingGroupId = call.billing_group_id;

    logger.info('Minute claimed successfully:', {
      callId,
      minuteToBill,
      tokensPerMin,
      fanId: call.fan_id,
      creatorId: call.creator_id
    });

    // Step 2: Check fan's balance and deduct tokens
    const fanDeductResult = await client.query(
      `UPDATE token_balances
       SET balance = balance - $1,
           total_spent = total_spent + $1,
           last_transaction_at = NOW(),
           updated_at = NOW()
       WHERE user_id = $2
         AND balance >= $1
       RETURNING balance, total_spent`,
      [tokensPerMin, call.fan_id]
    );

    // If 0 rows updated → insufficient funds
    if (fanDeductResult.rows.length === 0) {
      logger.warn('⚠️ Insufficient funds - ending call:', {
        callId,
        fanId: call.fan_id,
        tokensNeeded: tokensPerMin
      });

      // Get current balance for logging
      const balanceCheck = await client.query(
        'SELECT balance FROM token_balances WHERE user_id = $1',
        [call.fan_id]
      );
      const currentBalance = balanceCheck.rows[0]?.balance || 0;

      // Mark call as ended due to insufficient funds
      await client.query(
        `UPDATE calls
         SET status = 'ended',
             ended_at = NOW(),
             end_reason = 'insufficient_funds',
             updated_at = NOW()
         WHERE id = $1`,
        [callId]
      );

      await client.query('COMMIT');

      // Notify client immediately
      try {
        await publishToChannel(`call:${call.channel}`, 'call:insufficient_funds', {
          callId,
          minuteBilled: minuteToBill - 1, // We billed up to this minute
          fanBalance: currentBalance,
          tokensNeeded: tokensPerMin,
          message: 'Call ended - insufficient tokens'
        });
      } catch (notifyError) {
        logger.error('Failed to send insufficient funds notification:', notifyError);
      }

      return {
        success: false,
        insufficientFunds: true,
        callEnded: true,
        details: {
          minuteBilled: minuteToBill - 1,
          fanBalance: currentBalance,
          tokensNeeded: tokensPerMin
        }
      };
    }

    const fanNewBalance = fanDeductResult.rows[0].balance;
    const fanOldBalance = fanNewBalance + tokensPerMin;

    logger.info('✅ Fan tokens deducted:', {
      fanId: call.fan_id,
      tokensDeducted: tokensPerMin,
      oldBalance: fanOldBalance,
      newBalance: fanNewBalance
    });

    // Step 3: Credit creator
    const creatorCreditResult = await client.query(
      `UPDATE token_balances
       SET balance = balance + $1,
           total_earned = total_earned + $1,
           last_transaction_at = NOW(),
           updated_at = NOW()
       WHERE user_id = $2
       RETURNING balance, total_earned`,
      [tokensPerMin, call.creator_id]
    );

    if (creatorCreditResult.rows.length === 0) {
      logger.error('Creator not found in token_balances:', { creatorId: call.creator_id });
      await client.query('ROLLBACK');
      return { success: false, error: 'CREATOR_NOT_FOUND' };
    }

    const creatorNewBalance = creatorCreditResult.rows[0].balance;
    const creatorOldBalance = creatorNewBalance - tokensPerMin;

    logger.info('✅ Creator tokens credited:', {
      creatorId: call.creator_id,
      tokensCredited: tokensPerMin,
      oldBalance: creatorOldBalance,
      newBalance: creatorNewBalance
    });

    // Step 4: Log fan transaction (debit)
    await client.query(
      `INSERT INTO token_transactions (
        transaction_id, user_id, type, amount,
        balance_before, balance_after, description,
        group_id, created_at
      )
      VALUES ($1, $2, 'spend', $3, $4, $5, $6, $7, NOW())`,
      [
        `call_${callId}_min_${minuteToBill}_fan`,
        call.fan_id,
        tokensPerMin,
        fanOldBalance,
        fanNewBalance,
        `Call minute ${minuteToBill}`,
        billingGroupId
      ]
    );

    // Step 5: Log creator transaction (credit)
    await client.query(
      `INSERT INTO token_transactions (
        transaction_id, user_id, type, amount,
        balance_before, balance_after, description,
        group_id, created_at
      )
      VALUES ($1, $2, 'earn', $3, $4, $5, $6, $7, NOW())`,
      [
        `call_${callId}_min_${minuteToBill}_creator`,
        call.creator_id,
        tokensPerMin,
        creatorOldBalance,
        creatorNewBalance,
        `Call minute ${minuteToBill} earnings`,
        billingGroupId
      ]
    );

    // Commit transaction
    await client.query('COMMIT');

    logger.info('💰 Minute billed successfully:', {
      callId,
      minuteToBill,
      tokensCharged: tokensPerMin,
      fanBalance: fanNewBalance,
      creatorBalance: creatorNewBalance
    });

    // Notify client of successful billing (non-blocking)
    try {
      await publishToChannel(`call:${call.channel}`, 'call:minute_billed', {
        callId,
        minuteBilled: minuteToBill,
        tokensCharged: tokensPerMin,
        fanBalance: fanNewBalance,
        nextBillingIn: 60 // seconds
      });
    } catch (notifyError) {
      logger.error('Failed to send billing notification:', notifyError);
      // Non-fatal - billing already completed
    }

    return {
      success: true,
      minuteBilled: minuteToBill,
      tokensCharged: tokensPerMin,
      fanBalance: fanNewBalance,
      creatorBalance: creatorNewBalance
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('💥 Error billing call minute:', {
      callId,
      minuteToBill,
      error: error.message,
      stack: error.stack
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Process all active calls for billing
 * Called by cron job every minute
 *
 * @returns {Object} { processed, billed, insufficient, errors }
 */
async function processActiveCallsBilling() {
  const startTime = Date.now();
  logger.info('🔄 Starting active calls billing cycle...');

  try {
    // Find all active calls that need billing
    const activeCallsResult = await db.query(
      `SELECT
         id,
         started_at,
         last_billed_minute,
         rate_tokens_per_min,
         last_heartbeat_at,
         channel,
         creator_id,
         fan_id
       FROM calls
       WHERE status = 'active'
         AND started_at IS NOT NULL
       ORDER BY started_at ASC`
    );

    const activeCalls = activeCallsResult.rows;
    logger.info(`Found ${activeCalls.length} active calls to check`);

    const results = {
      processed: 0,
      billed: 0,
      insufficient: 0,
      timedOut: 0,
      errors: []
    };

    for (const call of activeCalls) {
      try {
        results.processed++;

        // Check for timeout (no heartbeat in 120 seconds)
        const secondsSinceHeartbeat = call.last_heartbeat_at
          ? Math.floor((Date.now() - new Date(call.last_heartbeat_at).getTime()) / 1000)
          : 999999; // If never received heartbeat, consider it timed out

        if (secondsSinceHeartbeat > 120) {
          logger.warn('📵 Call timed out (no heartbeat):', {
            callId: call.id,
            secondsSinceHeartbeat,
            lastHeartbeat: call.last_heartbeat_at
          });

          // Calculate elapsed minutes for final billing
          const elapsedSeconds = Math.floor((Date.now() - new Date(call.started_at).getTime()) / 1000);
          const elapsedMinutes = Math.ceil(elapsedSeconds / 60);
          const minutesToBill = elapsedMinutes - call.last_billed_minute;

          // Bill any remaining minutes
          for (let i = 1; i <= minutesToBill; i++) {
            const minuteNum = call.last_billed_minute + i;
            const billResult = await billCallMinute(call.id, minuteNum);

            if (billResult.success) {
              results.billed++;
            } else if (billResult.insufficientFunds) {
              results.insufficient++;
              break; // Stop billing this call
            }
          }

          // Mark call as timed out
          await db.query(
            `UPDATE calls
             SET status = 'ended',
                 ended_at = NOW(),
                 end_reason = 'timeout',
                 duration_seconds = $1,
                 updated_at = NOW()
             WHERE id = $2 AND status = 'active'`,
            [elapsedSeconds, call.id]
          );

          results.timedOut++;

          // Notify both parties
          try {
            await publishToChannel(`call:${call.channel}`, 'call:timeout', {
              callId: call.id,
              reason: 'No heartbeat received for 120 seconds',
              durationSeconds: elapsedSeconds,
              billedMinutes: call.last_billed_minute + (minutesToBill - (billResult.insufficientFunds ? 1 : 0))
            });
          } catch (notifyError) {
            logger.error('Failed to send timeout notification:', notifyError);
          }

          continue;
        }

        // Calculate which minute we should be billing
        const elapsedSeconds = Math.floor((Date.now() - new Date(call.started_at).getTime()) / 1000);
        const currentMinute = Math.floor(elapsedSeconds / 60) + 1; // 1-based
        const nextMinuteToBill = call.last_billed_minute + 1;

        // Only bill if we've passed into the next minute
        if (currentMinute >= nextMinuteToBill) {
          logger.info('📊 Call needs billing:', {
            callId: call.id,
            elapsedSeconds,
            currentMinute,
            lastBilled: call.last_billed_minute,
            nextToBill: nextMinuteToBill
          });

          const billResult = await billCallMinute(call.id, nextMinuteToBill);

          if (billResult.success) {
            results.billed++;
          } else if (billResult.insufficientFunds) {
            results.insufficient++;
          } else if (billResult.error && billResult.error !== 'ALREADY_BILLED') {
            results.errors.push({
              callId: call.id,
              error: billResult.error
            });
          }
        }

      } catch (error) {
        logger.error('Error processing call billing:', {
          callId: call.id,
          error: error.message
        });
        results.errors.push({
          callId: call.id,
          error: error.message
        });
      }
    }

    const duration = Date.now() - startTime;
    logger.info('✅ Billing cycle complete:', {
      duration: `${duration}ms`,
      ...results
    });

    return results;

  } catch (error) {
    logger.error('💥 Fatal error in billing cycle:', error);
    throw error;
  }
}

/**
 * Bill final partial minute when call ends
 * Only bills if there's a partial minute not yet billed
 *
 * @param {number} callId - Call ID
 * @returns {Object} Billing result
 */
async function billFinalPartialMinute(callId) {
  try {
    // Get call details
    const callResult = await db.query(
      `SELECT
         id,
         started_at,
         ended_at,
         last_billed_minute,
         rate_tokens_per_min,
         status
       FROM calls
       WHERE id = $1`,
      [callId]
    );

    if (callResult.rows.length === 0) {
      return { success: false, error: 'CALL_NOT_FOUND' };
    }

    const call = callResult.rows[0];

    if (!call.started_at || !call.ended_at) {
      return { success: false, error: 'MISSING_TIMESTAMPS' };
    }

    // Calculate total elapsed minutes
    const elapsedSeconds = Math.floor((new Date(call.ended_at) - new Date(call.started_at)) / 1000);
    const totalMinutes = Math.ceil(elapsedSeconds / 60);

    // Check if there's a partial minute to bill
    if (totalMinutes > call.last_billed_minute) {
      logger.info('Billing final partial minute:', {
        callId,
        totalMinutes,
        lastBilled: call.last_billed_minute
      });

      return await billCallMinute(callId, call.last_billed_minute + 1);
    }

    logger.info('No partial minute to bill:', {
      callId,
      totalMinutes,
      lastBilled: call.last_billed_minute
    });

    return { success: true, noBillingNeeded: true };

  } catch (error) {
    logger.error('Error billing final partial minute:', error);
    throw error;
  }
}

module.exports = {
  billCallMinute,
  processActiveCallsBilling,
  billFinalPartialMinute
};
