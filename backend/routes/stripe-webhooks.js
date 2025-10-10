const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const stripeConnect = require('../services/stripe-connect');
const { pool, withTransaction } = require('../utils/db');
const { isStripeEventDuplicate } = require('../lib/redis');

/**
 * Stripe Webhook Event Allowlist
 * Only these event types will be processed - all others are ignored
 * This prevents unexpected events from causing issues
 */
const ALLOWED_EVENTS = new Set([
  // Payment lifecycle
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
  'payment_intent.requires_action',

  // Charge events
  'charge.succeeded',
  'charge.failed',
  'charge.refunded',

  // Customer events
  'customer.created',
  'customer.updated',
  'customer.deleted',

  // Payout events (for creator earnings)
  'payout.created',
  'payout.paid',
  'payout.failed',

  // Subscription events (if using)
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',

  // Dispute handling
  'charge.dispute.created',
  'charge.dispute.updated',
  'charge.dispute.closed'
]);

// Stripe webhook endpoint (raw body required)
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify webhook signature (prevents tampering)
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);

    // Enforce narrow timestamp tolerance (5 minutes max)
    const eventAge = Date.now() - (event.created * 1000);
    if (eventAge > 300000) { // 5 minutes in ms
      console.warn(`Webhook event too old: ${event.id} (${eventAge}ms)`);
      return res.status(400).send('Webhook event timestamp too old');
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Event allowlist check - ignore unknown event types
  if (!ALLOWED_EVENTS.has(event.type)) {
    console.log(`Ignored unhandled event type: ${event.type}`);
    return res.json({ received: true, message: 'Event type not handled' });
  }

  // Check for idempotency with Redis first (faster)
  try {
    const isDuplicate = await isStripeEventDuplicate(event.id);
    if (isDuplicate) {
      console.log(`Webhook duplicate detected (Redis): ${event.id} (${event.type})`);
      return res.json({
        received: true,
        message: 'Already processed (Redis)',
        duplicate: true
      });
    }
  } catch (redisError) {
    console.error('Redis idempotency check failed:', redisError);
    // Fall back to database check
  }

  // Database idempotency check as fallback
  try {
    const idempotencyCheck = await pool.query(
      'SELECT event_id, processing_status FROM processed_webhooks WHERE event_id = $1 AND webhook_source = $2',
      [event.id, 'stripe']
    );

    if (idempotencyCheck.rows.length > 0) {
      console.log(`Webhook already processed (DB): ${event.id} (${event.type})`);
      return res.json({
        received: true,
        message: 'Already processed',
        status: idempotencyCheck.rows[0].processing_status
      });
    }
  } catch (error) {
    console.error('Database idempotency check failed:', error);
    // Continue processing even if check fails (safer than blocking)
  }

  // Process the webhook within a transaction
  let processingError = null;
  let processingStatus = 'success';

  try {
    await withTransaction(async (client) => {
      // Record the webhook as being processed
      await client.query(
        `INSERT INTO processed_webhooks
        (event_id, event_type, webhook_source, payload, processing_status)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (event_id, webhook_source) DO NOTHING`,
        [event.id, event.type, 'stripe', event, 'processing']
      );

      // Handle the actual webhook event
      await stripeConnect.handleWebhook(event);

      // Update status to success
      await client.query(
        `UPDATE processed_webhooks
        SET processing_status = $1, processed_at = CURRENT_TIMESTAMP
        WHERE event_id = $2 AND webhook_source = $3`,
        ['success', event.id, 'stripe']
      );
    });

    console.log('Webhook processed successfully:', event.type, event.id);
    res.json({ received: true, status: 'success' });

  } catch (error) {
    processingError = error.message;
    processingStatus = 'failed';

    console.error('Webhook processing failed:', error);

    // Record the failure
    try {
      await pool.query(
        `INSERT INTO processed_webhooks
        (event_id, event_type, webhook_source, payload, processing_status, processing_error)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (event_id, webhook_source)
        DO UPDATE SET
          processing_status = $5,
          processing_error = $6,
          processed_at = CURRENT_TIMESTAMP`,
        [event.id, event.type, 'stripe', event, processingStatus, processingError]
      );
    } catch (dbError) {
      console.error('Failed to record webhook failure:', dbError);
    }

    // Return 200 to Stripe to prevent retries for permanent failures
    // Return 500 only for temporary failures that should be retried
    const isRetryable = error.message?.includes('connection') ||
                       error.message?.includes('timeout');

    if (isRetryable) {
      res.status(500).json({ error: 'Temporary failure, please retry' });
    } else {
      // Permanent failure - acknowledge receipt but log the error
      res.json({ received: true, status: 'failed', error: processingError });
    }
  }
});

module.exports = router;