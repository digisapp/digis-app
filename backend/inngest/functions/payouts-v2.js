/**
 * Production-Ready Payout Workflow Functions (Inngest v2)
 *
 * Architecture: Queue-based, idempotent, scalable payout processing
 * - Vercel Cron triggers batch creation (lightweight)
 * - Inngest handles actual processing (durable, retriable)
 * - Chunking + concurrency limits prevent API rate limits
 * - Idempotency keys prevent duplicate payments
 * - Strict ledger consistency with FOR UPDATE locks
 *
 * Database Schema: Uses payout_batches + payout_items tables
 */

const { inngest } = require('../client');
const { pool } = require('../../utils/db');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const crypto = require('crypto');
const { logger } = require('../../utils/secureLogger');

// Configuration
const CHUNK_SIZE = 25; // Process 25 creators per chunk
const CHARGEBACK_HOLD_DAYS = 7; // 7-day anti-fraud hold
const MIN_PAYOUT_THRESHOLD = 1000; // 1000 tokens = $50 USD
const TOKEN_TO_USD_RATE = parseFloat(process.env.TOKEN_TO_USD_RATE || '0.05');

/**
 * Create Payout Batch (Triggered by Vercel Cron)
 *
 * Event: "payout.create-batch"
 * Triggered by: Vercel Cron on 1st and 15th at 2 AM
 *
 * This is the ONLY function the cron calls - it's fast and just queues work.
 */
const createPayoutBatch = inngest.createFunction(
  {
    id: 'create-payout-batch',
    name: 'Create Payout Batch',
    retries: 3,
  },
  { event: 'payout.create-batch' },
  async ({ event, step }) => {
    const { cutoffAt, scheduleType = 'bi_monthly' } = event.data;

    // Step 1: Create batch hash for idempotency
    const batch = await step.run('create-batch-record', async () => {
      const cutoff = cutoffAt || new Date(Date.now() - CHARGEBACK_HOLD_DAYS * 24 * 60 * 60 * 1000);
      const batchHash = crypto
        .createHash('sha256')
        .update(`${cutoff.toISOString()}:${scheduleType}`)
        .digest('hex');

      try {
        // Try to insert batch (fails if hash already exists = idempotent)
        const result = await pool.query(
          `INSERT INTO payout_batches (batch_hash, cutoff_at, schedule_type, status)
           VALUES ($1, $2, $3, 'queued')
           ON CONFLICT (batch_hash) DO UPDATE SET updated_at = NOW()
           RETURNING id, batch_hash, cutoff_at`,
          [batchHash, cutoff, scheduleType]
        );

        logger.info('Payout batch created', {
          batchId: result.rows[0].id,
          batchHash,
          cutoffAt: cutoff,
          scheduleType,
        });

        return result.rows[0];
      } catch (error) {
        if (error.code === '23505') {
          // Duplicate - this batch already exists, that's OK
          const existing = await pool.query(
            'SELECT id, batch_hash, cutoff_at FROM payout_batches WHERE batch_hash = $1',
            [batchHash]
          );
          logger.info('Batch already exists (idempotent)', { batchHash });
          return existing.rows[0];
        }
        throw error;
      }
    });

    // Step 2: Get eligible creators
    const eligibleCreators = await step.run('get-eligible-creators', async () => {
      const result = await pool.query(
        'SELECT * FROM get_eligible_creators_for_payout($1, $2)',
        [batch.cutoff_at, MIN_PAYOUT_THRESHOLD]
      );

      logger.info('Found eligible creators', {
        batchId: batch.id,
        count: result.rows.length,
      });

      return result.rows;
    });

    // Step 3: Create payout items (chunked)
    const itemsCreated = await step.run('create-payout-items', async () => {
      let created = 0;

      for (const creator of eligibleCreators) {
        const idempotencyKey = `${batch.id}:${creator.creator_id}`;

        try {
          await pool.query(
            `INSERT INTO payout_items (
              batch_id,
              creator_id,
              amount_tokens,
              amount_usd,
              idempotency_key,
              status
            ) VALUES ($1, $2, $3, $4, $5, 'pending')
            ON CONFLICT (idempotency_key) DO NOTHING`,
            [
              batch.id,
              creator.creator_id,
              creator.available_balance,
              (creator.available_balance * TOKEN_TO_USD_RATE).toFixed(2),
              idempotencyKey,
            ]
          );
          created++;
        } catch (error) {
          logger.error('Failed to create payout item', {
            creatorId: creator.creator_id,
            error: error.message,
          });
        }
      }

      // Update batch total items
      await pool.query(
        'UPDATE payout_batches SET total_items = $1, status = \'processing\', started_at = NOW() WHERE id = $2',
        [created, batch.id]
      );

      return created;
    });

    // Step 4: Enqueue processing tasks (chunked)
    const chunks = Math.ceil(itemsCreated / CHUNK_SIZE);

    for (let i = 0; i < chunks; i++) {
      await step.sendEvent(`enqueue-chunk-${i}`, {
        name: 'payout.process-chunk',
        data: {
          batchId: batch.id,
          chunkIndex: i,
          chunkSize: CHUNK_SIZE,
        },
      });
    }

    logger.info('Payout batch queued for processing', {
      batchId: batch.id,
      itemsCreated,
      chunks,
    });

    return {
      success: true,
      batchId: batch.id,
      batchHash: batch.batch_hash,
      itemsCreated,
      chunks,
    };
  }
);

/**
 * Process Payout Chunk (Worker Function)
 *
 * Event: "payout.process-chunk"
 * Processes a chunk of payout items (max 25 creators)
 */
const processPayoutChunk = inngest.createFunction(
  {
    id: 'process-payout-chunk',
    name: 'Process Payout Chunk',
    retries: 5,
    concurrency: {
      limit: 5, // Max 5 chunks processing concurrently
      key: 'event.data.batchId',
    },
  },
  { event: 'payout.process-chunk' },
  async ({ event, step }) => {
    const { batchId, chunkIndex, chunkSize } = event.data;

    // Step 1: Fetch chunk of pending payout items
    const items = await step.run('fetch-chunk', async () => {
      const result = await pool.query(
        `SELECT * FROM payout_items
         WHERE batch_id = $1 AND status = 'pending'
         ORDER BY created_at ASC
         LIMIT $2 OFFSET $3`,
        [batchId, chunkSize, chunkIndex * chunkSize]
      );

      return result.rows;
    });

    logger.info('Processing payout chunk', {
      batchId,
      chunkIndex,
      itemCount: items.length,
    });

    // Step 2: Process each payout item
    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
    };

    for (const item of items) {
      const payoutResult = await step.run(`payout-${item.id}`, async () => {
        return await processPayoutItem(item);
      });

      results.processed++;
      if (payoutResult.success) {
        results.succeeded++;
      } else {
        results.failed++;
      }
    }

    // Step 3: Check if batch is complete
    await step.run('check-batch-completion', async () => {
      const batchStatus = await pool.query(
        `SELECT total_items, processed_items, successful_items, failed_items
         FROM payout_batches WHERE id = $1`,
        [batchId]
      );

      const batch = batchStatus.rows[0];

      if (batch.processed_items >= batch.total_items) {
        // Mark batch as completed
        await pool.query(
          `UPDATE payout_batches
           SET status = 'completed', completed_at = NOW()
           WHERE id = $1`,
          [batchId]
        );

        logger.info('Payout batch completed', {
          batchId,
          ...batch,
        });
      }
    });

    return {
      success: true,
      batchId,
      chunkIndex,
      ...results,
    };
  }
);

/**
 * Process Individual Payout Item
 *
 * Handles the full payout flow with idempotency and ledger consistency
 */
async function processPayoutItem(item) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Lock the payout item for update
    const lockResult = await client.query(
      `UPDATE payout_items
       SET status = 'processing', started_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [item.id]
    );

    if (lockResult.rows.length === 0) {
      // Already processed by another worker
      await client.query('ROLLBACK');
      return { success: true, skipped: true, reason: 'Already processed' };
    }

    // 2. Get creator's Stripe account
    const creatorResult = await client.query(
      'SELECT stripe_connect_account_id FROM users WHERE supabase_id = $1',
      [item.creator_id]
    );

    const stripeAccountId = creatorResult.rows[0]?.stripe_connect_account_id;

    if (!stripeAccountId) {
      throw new Error('Creator has no Stripe Connect account');
    }

    // 3. Create Stripe transfer with idempotency key
    const transfer = await stripe.transfers.create(
      {
        amount: Math.round(item.amount_usd * 100), // Convert to cents
        currency: 'usd',
        destination: stripeAccountId,
        description: `Payout for batch ${item.batch_id}`,
        metadata: {
          batch_id: item.batch_id,
          payout_item_id: item.id,
          creator_id: item.creator_id,
        },
      },
      {
        idempotencyKey: item.idempotency_key,
      }
    );

    // 4. Update payout item with success
    await client.query(
      `UPDATE payout_items
       SET status = 'completed',
           provider_payout_id = $1,
           completed_at = NOW()
       WHERE id = $2`,
      [transfer.id, item.id]
    );

    // 5. Create ledger entry (withdrawal_completed)
    await client.query(
      `INSERT INTO token_transactions (
        user_id, tokens, type, status, description, metadata, created_at
      ) VALUES ($1, $2, 'withdrawal_completed', 'completed', $3, $4, NOW())`,
      [
        item.creator_id,
        -item.amount_tokens,
        `Payout to Stripe (${item.amount_usd} USD)`,
        JSON.stringify({ payout_item_id: item.id, stripe_transfer_id: transfer.id }),
      ]
    );

    await client.query('COMMIT');

    logger.info('Payout item processed successfully', {
      itemId: item.id,
      creatorId: item.creator_id,
      amount: item.amount_usd,
      stripeTransferId: transfer.id,
    });

    return {
      success: true,
      itemId: item.id,
      stripeTransferId: transfer.id,
    };
  } catch (error) {
    await client.query('ROLLBACK');

    // Update payout item with failure
    const retryCount = (item.retry_count || 0) + 1;
    const shouldRetry = retryCount < (item.max_retries || 3);

    await pool.query(
      `UPDATE payout_items
       SET status = $1,
           retry_count = $2,
           error_code = $3,
           error_message = $4
       WHERE id = $5`,
      [
        shouldRetry ? 'retrying' : 'failed',
        retryCount,
        error.code || 'UNKNOWN',
        error.message,
        item.id,
      ]
    );

    logger.error('Payout item failed', {
      itemId: item.id,
      creatorId: item.creator_id,
      error: error.message,
      retryCount,
      willRetry: shouldRetry,
    });

    return {
      success: false,
      itemId: item.id,
      error: error.message,
      retryCount,
    };
  } finally {
    client.release();
  }
}

/**
 * Retry Failed Payouts
 *
 * Event: "payout.retry-failed"
 * Triggered by: Daily schedule or manual
 */
const retryFailedPayouts = inngest.createFunction(
  {
    id: 'retry-failed-payouts',
    name: 'Retry Failed Payouts',
    retries: 3,
  },
  { event: 'payout.retry-failed' },
  async ({ event, step }) => {
    // Fetch items in 'retrying' status
    const items = await step.run('fetch-retrying-items', async () => {
      const result = await pool.query(
        `SELECT * FROM payout_items
         WHERE status = 'retrying'
           AND retry_count < max_retries
           AND created_at > NOW() - INTERVAL '7 days'
         ORDER BY created_at ASC
         LIMIT 50`
      );

      return result.rows;
    });

    logger.info('Retrying failed payouts', { count: items.length });

    const results = { succeeded: 0, failed: 0 };

    for (const item of items) {
      const retryResult = await step.run(`retry-${item.id}`, async () => {
        return await processPayoutItem(item);
      });

      if (retryResult.success) {
        results.succeeded++;
      } else {
        results.failed++;
      }
    }

    logger.info('Retry completed', results);
    return results;
  }
);

module.exports = {
  createPayoutBatch,
  processPayoutChunk,
  retryFailedPayouts,
};
