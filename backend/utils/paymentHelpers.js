/**
 * Payment Helper Utilities
 * Provides idempotency, deduplication, and cents handling for Stripe payments
 */

const crypto = require('crypto');
const { Pool } = require('pg');

// Initialize database pool (use existing pool in production)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : false
});

/**
 * Generate stable idempotency key for Stripe API calls
 * Uses logical operation ID without timestamp for true idempotency
 * @param {string} userId - User's supabase_id
 * @param {string} operation - Operation type (e.g., 'payment_intent', 'refund')
 * @param {number} amountCents - Amount in cents
 * @param {string} [sessionId] - Session/request ID for stability
 * @returns {string} Idempotency key
 */
function generateIdempotencyKey(userId, operation, amountCents, sessionId = '') {
  // Use stable components without timestamp for true idempotency
  const components = [
    userId,
    operation,
    amountCents.toString(),
    sessionId || 'default'
  ].filter(Boolean).join(':');

  // Create a hash for safety (Stripe has a 255 char limit)
  const hash = crypto.createHash('sha256').update(components).digest('hex');
  return `${operation}_${hash.substring(0, 48)}`;
}

/**
 * Generate idempotency key with time window
 * For operations that should be unique within a time period
 * @param {string} userId - User's supabase_id
 * @param {string} operation - Operation type
 * @param {number} amountCents - Amount in cents
 * @param {number} windowMinutes - Time window in minutes
 * @returns {string} Idempotency key
 */
function generateTimeWindowedIdempotencyKey(userId, operation, amountCents, windowMinutes = 5) {
  const timestamp = Math.floor(Date.now() / 1000);
  const window = Math.floor(timestamp / (windowMinutes * 60));

  const components = [
    userId,
    operation,
    amountCents.toString(),
    `window_${window}`
  ].join(':');

  const hash = crypto.createHash('sha256').update(components).digest('hex');
  return `${operation}_${hash.substring(0, 48)}`;
}

/**
 * Check if webhook event has already been processed
 * @param {string} stripeEventId - Stripe event ID
 * @returns {Promise<boolean>} True if already processed
 */
async function isWebhookEventProcessed(stripeEventId) {
  try {
    const result = await pool.query(
      'SELECT id FROM stripe_webhook_events WHERE stripe_event_id = $1',
      [stripeEventId]
    );
    return result.rowCount > 0;
  } catch (error) {
    console.error('Error checking webhook event:', error);
    throw error;
  }
}

/**
 * Record webhook event for deduplication
 * @param {Object} event - Stripe event object
 * @returns {Promise<boolean>} True if newly inserted, false if duplicate
 */
async function recordWebhookEvent(event) {
  try {
    const result = await pool.query(
      `INSERT INTO stripe_webhook_events (stripe_event_id, type, payload, status)
       VALUES ($1, $2, $3, 'processing')
       ON CONFLICT (stripe_event_id) DO NOTHING
       RETURNING id`,
      [event.id, event.type, JSON.stringify(event)]
    );

    return result.rowCount > 0;
  } catch (error) {
    console.error('Error recording webhook event:', error);
    throw error;
  }
}

/**
 * Mark webhook event as processed
 * @param {string} stripeEventId - Stripe event ID
 * @param {string} status - Status ('completed' or 'failed')
 * @param {string} [errorMessage] - Error message if failed
 */
async function markWebhookEventProcessed(stripeEventId, status, errorMessage = null) {
  try {
    await pool.query(
      `UPDATE stripe_webhook_events
       SET status = $2,
           processed_at = NOW(),
           error_message = $3,
           processing_result = $2
       WHERE stripe_event_id = $1`,
      [stripeEventId, status, errorMessage]
    );
  } catch (error) {
    console.error('Error marking webhook as processed:', error);
    throw error;
  }
}

/**
 * Convert decimal dollars to integer cents
 * @param {number|string} dollars - Dollar amount
 * @returns {number} Amount in cents
 */
function dollarsToCents(dollars) {
  const amount = typeof dollars === 'string' ? parseFloat(dollars) : dollars;
  if (isNaN(amount) || amount < 0) {
    throw new Error('Invalid dollar amount');
  }
  return Math.round(amount * 100);
}

/**
 * Convert integer cents to decimal dollars
 * @param {number} cents - Amount in cents
 * @returns {number} Amount in dollars
 */
function centsToDollars(cents) {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error('Invalid cents amount');
  }
  return cents / 100;
}

/**
 * Validate and sanitize amount in cents
 * @param {number} amountCents - Amount to validate
 * @param {Object} options - Validation options
 * @returns {number} Validated amount in cents
 */
function validateAmountCents(amountCents, options = {}) {
  const {
    min = 50, // Stripe minimum is 50 cents
    max = 99999900, // Stripe maximum is $999,999
    allowZero = false
  } = options;

  // Convert to number if string
  const amount = Number(amountCents);

  // Validate
  if (!Number.isInteger(amount)) {
    throw new Error('Amount must be an integer (cents)');
  }

  if (!allowZero && amount === 0) {
    throw new Error('Amount cannot be zero');
  }

  if (amount < 0) {
    throw new Error('Amount cannot be negative');
  }

  if (amount < min) {
    throw new Error(`Amount must be at least ${min} cents ($${min/100})`);
  }

  if (amount > max) {
    throw new Error(`Amount cannot exceed ${max} cents ($${max/100})`);
  }

  return amount;
}

/**
 * Create payment intent with idempotency
 * @param {Object} stripe - Stripe instance
 * @param {Object} params - Payment parameters
 * @returns {Promise<Object>} Payment intent
 */
async function createPaymentIntentWithIdempotency(stripe, params) {
  const {
    userId,
    amountCents,
    currency = 'usd',
    metadata = {},
    description,
    customerEmail,
    sessionId = null // Optional session ID for stable idempotency
  } = params;

  // Validate amount
  const validatedAmount = validateAmountCents(amountCents);

  // Generate stable idempotency key without timestamp
  const idempotencyKey = generateIdempotencyKey(
    userId,
    'payment_intent',
    validatedAmount,
    sessionId || metadata.order_id || metadata.purchase_id
  );

  try {
    // Create payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: validatedAmount,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        ...metadata,
        user_id: userId,
        source: 'digis_platform',
        idempotency_key: idempotencyKey
      },
      description,
      receipt_email: customerEmail
    }, {
      idempotencyKey
    });

    // Record in database
    await pool.query(
      `INSERT INTO payments (
        id, payment_id, user_id, amount_cents, currency, status,
        metadata, stripe_payment_intent_id, stripe_client_secret,
        idempotency_key, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        updated_at = NOW()`,
      [
        paymentIntent.id,
        paymentIntent.id,
        userId,
        validatedAmount,
        currency,
        'pending',
        JSON.stringify(metadata),
        paymentIntent.id,
        paymentIntent.client_secret,
        idempotencyKey
      ]
    );

    return paymentIntent;
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
}

/**
 * Process webhook event with deduplication
 * @param {Object} event - Stripe event
 * @param {Function} handler - Event handler function
 * @returns {Promise<Object>} Handler result
 */
async function processWebhookWithDeduplication(event, handler) {
  // Check if already processed
  const isProcessed = await isWebhookEventProcessed(event.id);
  if (isProcessed) {
    console.log(`Webhook event ${event.id} already processed, skipping`);
    return { status: 'skipped', reason: 'duplicate' };
  }

  // Record the event
  const isNew = await recordWebhookEvent(event);
  if (!isNew) {
    console.log(`Webhook event ${event.id} is being processed by another worker`);
    return { status: 'skipped', reason: 'concurrent_processing' };
  }

  try {
    // Process the event
    const result = await handler(event);

    // Mark as completed
    await markWebhookEventProcessed(event.id, 'completed');

    return { status: 'completed', result };
  } catch (error) {
    // Mark as failed
    await markWebhookEventProcessed(event.id, 'failed', error.message);

    throw error;
  }
}

/**
 * Get payment by idempotency key
 * @param {string} idempotencyKey - Idempotency key
 * @returns {Promise<Object|null>} Payment record or null
 */
async function getPaymentByIdempotencyKey(idempotencyKey) {
  try {
    const result = await pool.query(
      'SELECT * FROM payments WHERE idempotency_key = $1',
      [idempotencyKey]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching payment by idempotency key:', error);
    throw error;
  }
}

/**
 * Clean up old webhook events
 * @param {number} daysToKeep - Number of days to keep events
 * @returns {Promise<number>} Number of deleted records
 */
async function cleanupOldWebhookEvents(daysToKeep = 30) {
  try {
    const result = await pool.query(
      `DELETE FROM stripe_webhook_events
       WHERE received_at < NOW() - INTERVAL '${daysToKeep} days'
         AND status = 'completed'
         AND type NOT IN (
           'payment_intent.succeeded',
           'payment_intent.failed',
           'charge.dispute.created',
           'charge.dispute.updated'
         )
       RETURNING id`
    );

    console.log(`Cleaned up ${result.rowCount} old webhook events`);
    return result.rowCount;
  } catch (error) {
    console.error('Error cleaning up webhook events:', error);
    throw error;
  }
}

module.exports = {
  generateIdempotencyKey,
  generateTimeWindowedIdempotencyKey,
  isWebhookEventProcessed,
  recordWebhookEvent,
  markWebhookEventProcessed,
  dollarsToCents,
  centsToDollars,
  validateAmountCents,
  createPaymentIntentWithIdempotency,
  processWebhookWithDeduplication,
  getPaymentByIdempotencyKey,
  cleanupOldWebhookEvents
};