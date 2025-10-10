/**
 * Payout Workflow Functions (Inngest)
 *
 * Multi-step, durable workflow for processing creator payouts.
 * Replaces BullMQ cron jobs with serverless Inngest functions.
 *
 * Features:
 * - Automatic retries with exponential backoff
 * - State persistence across failures
 * - Concurrency limiting to prevent API rate limits
 * - Idempotency via event IDs
 */

const { inngest } = require('../client');
const { pool } = require('../../utils/db');
const stripeConnect = require('../../services/stripe-connect');
const { logger } = require('../../utils/secureLogger');

/**
 * Main Payout Processing Function
 *
 * Triggered by: Scheduled (1st and 15th of month) or manual event
 * Event: "payout.scheduled"
 */
const processPayouts = inngest.createFunction(
  {
    id: 'process-scheduled-payouts',
    name: 'Process Scheduled Payouts',
    retries: 5, // Retry up to 5 times with exponential backoff
    concurrency: {
      limit: 5, // Process max 5 payouts concurrently
      key: 'event.data.payoutDate', // Group by payout date
    },
    // Idempotency: Same event ID = same execution
    idempotency: 'event.data.payoutId',
  },
  { event: 'payout.scheduled' },
  async ({ event, step, logger: stepLogger }) => {
    const { payoutDate, dayOfMonth } = event.data;

    // Step 1: Validate payout day (1st or 15th)
    const isPayoutDay = await step.run('validate-payout-day', async () => {
      if (dayOfMonth !== 1 && dayOfMonth !== 15) {
        stepLogger.info('Not a payout day, skipping', { dayOfMonth });
        return false;
      }
      return true;
    });

    if (!isPayoutDay) {
      return {
        success: true,
        skipped: true,
        reason: 'Not a scheduled payout day',
        dayOfMonth,
      };
    }

    // Step 2: Lock ledger and generate payouts
    const generatedPayouts = await step.run('generate-payouts', async () => {
      const result = await pool.query(
        'SELECT generate_scheduled_payouts($1::DATE) as count',
        [payoutDate]
      );

      const count = result.rows[0].count;
      stepLogger.info('Generated payouts', { count, payoutDate });

      return { count, payoutDate };
    });

    // Step 3: Fetch pending payouts to process
    const payouts = await step.run('fetch-pending-payouts', async () => {
      const result = await pool.query(
        `SELECT
          p.*,
          sa.stripe_account_id,
          u.email,
          u.display_name
         FROM creator_payouts p
         JOIN creator_stripe_accounts sa ON sa.creator_id = p.creator_id
         JOIN users u ON u.supabase_id = p.creator_id
         WHERE p.status = 'pending'
           AND p.payout_period_end::DATE = $1::DATE
           AND sa.payouts_enabled = true
         ORDER BY p.created_at ASC`,
        [payoutDate]
      );

      return result.rows;
    });

    // Step 4: Process each payout (fan-out pattern)
    const results = {
      total: payouts.length,
      processed: 0,
      failed: 0,
      errors: [],
    };

    for (const payout of payouts) {
      // Each payout gets its own sub-step with retry logic
      const payoutResult = await step.run(
        `process-payout-${payout.id}`,
        async () => {
          try {
            // Create Stripe payout
            await stripeConnect.createPayout({
              payoutId: payout.id,
              creatorId: payout.creator_id,
              amount: payout.net_payout_amount,
              stripeAccountId: payout.stripe_account_id,
              periodEnd: payout.payout_period_end,
            });

            stepLogger.info('Payout processed successfully', {
              payoutId: payout.id,
              creatorId: payout.creator_id,
              amount: payout.net_payout_amount,
            });

            return { success: true, payoutId: payout.id };
          } catch (error) {
            stepLogger.error('Payout processing failed', {
              payoutId: payout.id,
              error: error.message,
              stack: error.stack,
            });

            // Mark as failed in database
            await pool.query(
              `UPDATE creator_payouts
               SET status = 'failed',
                   error_message = $1,
                   updated_at = NOW()
               WHERE id = $2`,
              [error.message, payout.id]
            );

            return {
              success: false,
              payoutId: payout.id,
              error: error.message,
            };
          }
        }
      );

      if (payoutResult.success) {
        results.processed++;
      } else {
        results.failed++;
        results.errors.push(payoutResult);
      }
    }

    // Step 5: Send admin notification
    await step.run('send-admin-notification', async () => {
      await pool.query(
        `INSERT INTO admin_logs (log_type, log_data, created_at)
         VALUES ('payout_processing', $1, NOW())`,
        [
          JSON.stringify({
            payoutDate,
            generated: generatedPayouts.count,
            ...results,
          }),
        ]
      );

      stepLogger.info('Payout processing completed', {
        payoutDate,
        generated: generatedPayouts.count,
        ...results,
      });
    });

    return {
      success: true,
      payoutDate,
      generated: generatedPayouts.count,
      ...results,
    };
  }
);

/**
 * Retry Failed Payouts Function
 *
 * Triggered by: Daily schedule or manual event
 * Event: "payout.retry-failed"
 */
const retryFailedPayouts = inngest.createFunction(
  {
    id: 'retry-failed-payouts',
    name: 'Retry Failed Payouts',
    retries: 3,
    concurrency: { limit: 5 },
  },
  { event: 'payout.retry-failed' },
  async ({ event, step, logger: stepLogger }) => {
    // Step 1: Fetch failed payouts from last 7 days
    const failedPayouts = await step.run('fetch-failed-payouts', async () => {
      const result = await pool.query(
        `SELECT
          p.*,
          sa.stripe_account_id,
          u.email,
          u.display_name
         FROM creator_payouts p
         JOIN creator_stripe_accounts sa ON sa.creator_id = p.creator_id
         JOIN users u ON u.supabase_id = p.creator_id
         WHERE p.status = 'failed'
           AND p.created_at > NOW() - INTERVAL '7 days'
           AND sa.payouts_enabled = true
         ORDER BY p.created_at ASC
         LIMIT 50`
      );

      return result.rows;
    });

    stepLogger.info('Found failed payouts to retry', {
      count: failedPayouts.length,
    });

    const results = {
      retried: 0,
      succeeded: 0,
      failed: 0,
    };

    // Step 2: Retry each failed payout
    for (const payout of failedPayouts) {
      const retryResult = await step.run(
        `retry-payout-${payout.id}`,
        async () => {
          try {
            results.retried++;

            await stripeConnect.createPayout({
              payoutId: payout.id,
              creatorId: payout.creator_id,
              amount: payout.net_payout_amount,
              stripeAccountId: payout.stripe_account_id,
              periodEnd: payout.payout_period_end,
            });

            results.succeeded++;
            return { success: true, payoutId: payout.id };
          } catch (error) {
            results.failed++;
            stepLogger.error('Retry failed', {
              payoutId: payout.id,
              error: error.message,
            });
            return { success: false, payoutId: payout.id };
          }
        }
      );
    }

    stepLogger.info('Completed retry of failed payouts', results);
    return results;
  }
);

/**
 * Update Stripe Account Statuses
 *
 * Triggered by: Hourly schedule or manual event
 * Event: "payout.update-account-statuses"
 */
const updateAccountStatuses = inngest.createFunction(
  {
    id: 'update-account-statuses',
    name: 'Update Stripe Account Statuses',
    retries: 3,
    concurrency: { limit: 5 },
  },
  { event: 'payout.update-account-statuses' },
  async ({ event, step, logger: stepLogger }) => {
    // Step 1: Fetch accounts needing updates
    const accounts = await step.run('fetch-accounts', async () => {
      const result = await pool.query(
        `SELECT stripe_account_id
         FROM creator_stripe_accounts
         WHERE stripe_account_id IS NOT NULL
           AND (account_status != 'active'
                OR updated_at < NOW() - INTERVAL '1 day')`
      );

      return result.rows;
    });

    stepLogger.info('Found accounts to update', { count: accounts.length });

    let updated = 0;

    // Step 2: Update each account
    for (const account of accounts) {
      await step.run(`update-account-${account.stripe_account_id}`, async () => {
        try {
          await stripeConnect.updateAccountStatus(account.stripe_account_id);
          updated++;
        } catch (error) {
          stepLogger.error('Failed to update account', {
            accountId: account.stripe_account_id,
            error: error.message,
          });
        }
      });
    }

    stepLogger.info('Account status updates completed', { updated });
    return { total: accounts.length, updated };
  }
);

/**
 * Single Payout Processing Function
 *
 * Triggered by: Manual payout request or withdrawal
 * Event: "payout.process-single"
 */
const processSinglePayout = inngest.createFunction(
  {
    id: 'process-single-payout',
    name: 'Process Single Payout',
    retries: 5,
    idempotency: 'event.data.payoutId',
  },
  { event: 'payout.process-single' },
  async ({ event, step, logger: stepLogger }) => {
    const { payoutId, creatorId, amount, stripeAccountId } = event.data;

    // Step 1: Validate payout request
    await step.run('validate-payout', async () => {
      // Check minimum payout amount
      if (amount < 1000) {
        // $10 minimum
        throw new Error('Minimum payout amount is $10.00');
      }

      // Check creator balance
      const balance = await pool.query(
        'SELECT available_balance FROM creator_earnings WHERE creator_id = $1',
        [creatorId]
      );

      if (!balance.rows[0] || balance.rows[0].available_balance < amount) {
        throw new Error('Insufficient balance');
      }

      stepLogger.info('Payout validated', { payoutId, amount });
    });

    // Step 2: Create payout record
    await step.run('create-payout-record', async () => {
      await pool.query(
        `INSERT INTO creator_payouts (
          id, creator_id, net_payout_amount, status, created_at
        ) VALUES ($1, $2, $3, 'pending', NOW())`,
        [payoutId, creatorId, amount]
      );
    });

    // Step 3: Process Stripe transfer
    await step.run('stripe-transfer', async () => {
      await stripeConnect.createPayout({
        payoutId,
        creatorId,
        amount,
        stripeAccountId,
        periodEnd: new Date(),
      });

      stepLogger.info('Stripe transfer completed', { payoutId });
    });

    // Step 4: Update ledger
    await step.run('update-ledger', async () => {
      await pool.query(
        `UPDATE creator_earnings
         SET available_balance = available_balance - $1,
             total_withdrawn = total_withdrawn + $1,
             updated_at = NOW()
         WHERE creator_id = $2`,
        [amount, creatorId]
      );

      stepLogger.info('Ledger updated', { payoutId, amount });
    });

    return {
      success: true,
      payoutId,
      amount,
      creatorId,
    };
  }
);

module.exports = {
  processPayouts,
  retryFailedPayouts,
  updateAccountStatuses,
  processSinglePayout,
};
