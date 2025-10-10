const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { pool } = require('../utils/db');
const { logger } = require('../utils/secureLogger');
const { creditTokens, isProviderEventProcessed } = require('../utils/ledger');
const router = express.Router();

// Middleware to capture raw body for Stripe webhook verification
const getRawBody = (req, res, next) => {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', chunk => {
    data += chunk;
  });
  req.on('end', () => {
    req.rawBody = data;
    next();
  });
};

// Stripe webhook endpoint
router.post('/stripe', getRawBody, async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  logger.info('🔄 Stripe webhook received:', {
    hasSignature: !!sig,
    hasSecret: !!endpointSecret,
    bodyLength: req.rawBody?.length || 0,
    timestamp: new Date().toISOString()
  });

  if (!endpointSecret) {
    logger.error('❌ STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  if (!sig) {
    logger.error('❌ No Stripe signature found in headers');
    return res.status(400).json({ error: 'No signature found' });
  }

  let event;
  
  try {
    // Verify the webhook signature
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    logger.info('✅ Webhook signature verified:', event.type);
  } catch (err) {
    logger.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  // Check for duplicate event (idempotency)
  const eventRecord = await checkEventDuplication(event);
  if (eventRecord.isDuplicate) {
    logger.info(`⏭️  Skipping duplicate event: ${event.id}`);
    return res.json({ received: true, type: event.type, duplicate: true });
  }

  // Handle the event
  try {
    await handleStripeEvent(event);
    await recordEventProcessed(event);
    logger.info('✅ Webhook event processed successfully:', event.type);
    res.json({ received: true, type: event.type });
  } catch (error) {
    logger.error('❌ Error processing webhook event:', error);
    // Mark event as failed for retry
    await recordEventFailed(event, error);
    res.status(500).json({ error: 'Failed to process webhook event' });
  }
});

// Handle different Stripe event types
const handleStripeEvent = async (event) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(client, event.data.object);
        break;
        
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(client, event.data.object);
        break;
        
      case 'payment_intent.requires_action':
        await handlePaymentIntentRequiresAction(client, event.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(client, event.data.object);
        break;
        
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(client, event.data.object);
        break;
        
      case 'customer.subscription.created':
        await handleSubscriptionCreated(client, event.data.object);
        break;
        
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(client, event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(client, event.data.object);
        break;
        
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(client, event.data.object);
        break;
        
      case 'charge.dispute.created':
        await handleChargeDisputeCreated(client, event.data.object);
        break;
        
      default:
        logger.info(`ℹ️ Unhandled event type: ${event.type}`);
    }
    
    await client.query('COMMIT');
    logger.info(`✅ Event ${event.type} processed successfully`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`❌ Error processing event ${event.type}:`, error);
    throw error;
  } finally {
    client.release();
  }
};

// Handle successful payment intent
const handlePaymentIntentSucceeded = async (client, paymentIntent) => {
  logger.info('💰 Payment succeeded:', paymentIntent.id);

  const { id, amount, metadata } = paymentIntent;
  const { user_id, session_id, tokens, tokenAmount, bonusTokens, is_tip } = metadata || {};

  // Check if already processed using provider_event_id
  const alreadyProcessed = await isProviderEventProcessed(id);
  if (alreadyProcessed.processed) {
    logger.info(`⏭️  Payment ${id} already processed, skipping`);
    return;
  }

  // Update payment record
  await client.query(
    `UPDATE payments
     SET status = 'completed', updated_at = NOW()
     WHERE stripe_payment_intent_id = $1`,
    [id]
  );

  // Handle token purchase with atomic ledger operation
  if ((tokens || tokenAmount) && user_id) {
    const finalTokenAmount = parseInt(tokens || tokenAmount);
    const bonus = parseInt(bonusTokens || 0);
    const totalTokens = finalTokenAmount + bonus;

    // Use atomic credit operation with idempotency
    await creditTokens({
      userId: user_id,
      tokens: totalTokens,
      type: metadata.isQuickPurchase ? 'quick_purchase' :
            metadata.isAutoRefill ? 'auto_refill' :
            metadata.isSmartRefill ? 'smart_refill' : 'purchase',
      amountUsd: amount / 100,
      providerEventId: id, // This prevents duplicate processing
      stripePaymentIntentId: id,
      source: 'stripe',
      metadata: {
        bonusTokens: bonus,
        originalAmount: finalTokenAmount,
        ...metadata
      }
    });

    logger.info(`✅ Added ${totalTokens} tokens (${finalTokenAmount} + ${bonus} bonus) for user ${user_id}`);
  }

  // Handle session payment
  if (session_id) {
    await client.query(
      `UPDATE sessions
       SET status = 'paid', updated_at = NOW()
       WHERE id = $1`,
      [session_id]
    );

    logger.info(`✅ Marked session ${session_id} as paid`);
  }

  // Handle tip
  if (is_tip === 'true' && user_id) {
    await client.query(
      `UPDATE users
       SET total_earnings = total_earnings + $1, updated_at = NOW()
       WHERE supabase_id = $2`,
      [amount / 100, user_id]
    );

    logger.info(`✅ Added tip of $${amount / 100} to user ${user_id}`);
  }
};

// Handle failed payment intent
const handlePaymentIntentFailed = async (client, paymentIntent) => {
  logger.info('❌ Payment failed:', paymentIntent.id);
  
  await client.query(
    `UPDATE payments 
     SET status = 'failed', updated_at = NOW() 
     WHERE stripe_payment_intent_id = $1`,
    [paymentIntent.id]
  );
  
  // Update token transaction if it exists
  await client.query(
    `UPDATE token_transactions 
     SET status = 'failed', updated_at = NOW() 
     WHERE stripe_payment_intent_id = $1`,
    [paymentIntent.id]
  );
};

// Handle payment intent that requires action
const handlePaymentIntentRequiresAction = async (client, paymentIntent) => {
  logger.info('⚠️ Payment requires action:', paymentIntent.id);
  
  await client.query(
    `UPDATE payments 
     SET status = 'requires_action', updated_at = NOW() 
     WHERE stripe_payment_intent_id = $1`,
    [paymentIntent.id]
  );
};

// Handle successful invoice payment
const handleInvoicePaymentSucceeded = async (client, invoice) => {
  logger.info('📄 Invoice payment succeeded:', invoice.id);
  
  // Handle subscription-related logic here
  if (invoice.subscription) {
    await client.query(
      `UPDATE subscriptions 
       SET status = 'active', updated_at = NOW() 
       WHERE stripe_subscription_id = $1`,
      [invoice.subscription]
    );
  }
};

// Handle failed invoice payment
const handleInvoicePaymentFailed = async (client, invoice) => {
  logger.info('❌ Invoice payment failed:', invoice.id);
  
  if (invoice.subscription) {
    await client.query(
      `UPDATE subscriptions 
       SET status = 'past_due', updated_at = NOW() 
       WHERE stripe_subscription_id = $1`,
      [invoice.subscription]
    );
  }
};

// Handle subscription created
const handleSubscriptionCreated = async (client, subscription) => {
  logger.info('📅 Subscription created:', subscription.id);
  
  const { id, customer, metadata } = subscription;
  const { user_id, creator_id } = metadata || {};
  
  if (user_id && creator_id) {
    await client.query(
      `INSERT INTO subscriptions (user_id, creator_id, stripe_subscription_id, status, created_at)
       VALUES ($1, $2, $3, 'active', NOW())
       ON CONFLICT (user_id, creator_id) 
       DO UPDATE SET 
         stripe_subscription_id = $3,
         status = 'active',
         updated_at = NOW()`,
      [user_id, creator_id, id]
    );
  }
};

// Handle subscription updated
const handleSubscriptionUpdated = async (client, subscription) => {
  logger.info('📅 Subscription updated:', subscription.id);
  
  await client.query(
    `UPDATE subscriptions 
     SET status = $1, updated_at = NOW() 
     WHERE stripe_subscription_id = $2`,
    [subscription.status, subscription.id]
  );
};

// Handle subscription deleted
const handleSubscriptionDeleted = async (client, subscription) => {
  logger.info('📅 Subscription deleted:', subscription.id);
  
  await client.query(
    `UPDATE subscriptions 
     SET status = 'cancelled', updated_at = NOW() 
     WHERE stripe_subscription_id = $1`,
    [subscription.id]
  );
};

// Handle completed checkout session
const handleCheckoutSessionCompleted = async (client, session) => {
  logger.info('🛒 Checkout session completed:', session.id);
  
  const { id, payment_intent, metadata } = session;
  const { user_id, tokens, session_id } = metadata || {};
  
  // Link checkout session to payment intent if needed
  if (payment_intent && user_id) {
    await client.query(
      `UPDATE payments 
       SET stripe_checkout_session_id = $1, updated_at = NOW() 
       WHERE stripe_payment_intent_id = $2`,
      [id, payment_intent]
    );
  }
};

// Handle charge dispute created
const handleChargeDisputeCreated = async (client, dispute) => {
  logger.info('⚠️ Charge dispute created:', dispute.id);
  
  const { id, charge, amount } = dispute;
  
  // Create fraud alert
  await client.query(
    `INSERT INTO fraud_alerts (user_id, alert_type, details, created_at)
     VALUES (NULL, 'chargeback', $1, NOW())`,
    [JSON.stringify({ dispute_id: id, charge_id: charge, amount: amount })]
  );
  
  // Update payment status
  await client.query(
    `UPDATE payments 
     SET status = 'disputed', updated_at = NOW() 
     WHERE stripe_charge_id = $1`,
    [charge]
  );
};

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'webhooks',
    timestamp: new Date().toISOString(),
    environment: {
      hasStripeSecret: !!process.env.STRIPE_SECRET_KEY,
      hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET
    }
  });
});

// Test webhook endpoint (for development)
router.post('/test', async (req, res) => {
  logger.info('🧪 Test webhook received:', req.body);

  try {
    // Simulate webhook processing
    await new Promise(resolve => setTimeout(resolve, 100));

    res.json({
      received: true,
      body: req.body,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Test webhook error:', error);
    res.status(500).json({ error: 'Test webhook failed' });
  }
});

/**
 * Event Deduplication Helpers
 * Prevents duplicate webhook processing using stripe_webhook_events table
 */

// Check if webhook event has already been processed
async function checkEventDuplication(event) {
  try {
    const result = await pool.query(
      `SELECT id, status, processed_at
       FROM stripe_webhook_events
       WHERE event_id = $1
       LIMIT 1`,
      [event.id]
    );

    if (result.rows.length > 0) {
      const record = result.rows[0];
      return {
        isDuplicate: true,
        status: record.status,
        processedAt: record.processed_at
      };
    }

    return { isDuplicate: false };
  } catch (error) {
    // If table doesn't exist yet, assume not duplicate
    if (error.code === '42P01') {
      logger.warn('stripe_webhook_events table does not exist, creating it...');
      await createWebhookEventsTable();
      return { isDuplicate: false };
    }
    throw error;
  }
}

// Record that event has been processed successfully
async function recordEventProcessed(event) {
  try {
    await pool.query(
      `INSERT INTO stripe_webhook_events (event_id, event_type, status, processed_at, payload, created_at)
       VALUES ($1, $2, 'processed', NOW(), $3, NOW())
       ON CONFLICT (event_id) DO UPDATE
       SET status = 'processed', processed_at = NOW()`,
      [event.id, event.type, JSON.stringify(event)]
    );
  } catch (error) {
    logger.error('Failed to record processed event:', error);
  }
}

// Record that event processing failed
async function recordEventFailed(event, error) {
  try {
    await pool.query(
      `INSERT INTO stripe_webhook_events (event_id, event_type, status, error_message, payload, created_at)
       VALUES ($1, $2, 'failed', $3, $4, NOW())
       ON CONFLICT (event_id) DO UPDATE
       SET status = 'failed', error_message = $3, updated_at = NOW()`,
      [event.id, event.type, error.message, JSON.stringify(event)]
    );
  } catch (err) {
    logger.error('Failed to record failed event:', err);
  }
}

// Create webhook events table if it doesn't exist
async function createWebhookEventsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stripe_webhook_events (
        id SERIAL PRIMARY KEY,
        event_id VARCHAR(255) UNIQUE NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
        processed_at TIMESTAMPTZ,
        error_message TEXT,
        payload JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON stripe_webhook_events(event_id);
      CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON stripe_webhook_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON stripe_webhook_events(status);
      CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON stripe_webhook_events(created_at DESC);

      COMMENT ON TABLE stripe_webhook_events IS
        'Idempotency table for Stripe webhook events - prevents duplicate processing';
    `);
    logger.info('✅ Created stripe_webhook_events table');
  } catch (error) {
    logger.error('Failed to create stripe_webhook_events table:', error);
  }
}

module.exports = router;