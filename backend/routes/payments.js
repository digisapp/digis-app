const express = require('express');
const crypto = require('crypto');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const { retryDB, retryStripe } = require('../utils/retryHelper');
const router = express.Router();

// Test route
router.get('/test', (_req, res) => {
  res.json({ 
    message: 'Payments route working',
    stripe: 'Connected',
    timestamp: new Date().toISOString(),
    environment: {
      hasStripeKey: !!process.env.STRIPE_SECRET_KEY
    }
  });
});

// Create payment intent - matches frontend endpoint
router.post('/create-intent', authenticateToken, async (req, res) => {
  const { paymentMethodId, amount, sessionId, isTip, creatorId, description } = req.body;

  // Convert amount to cents immediately
  const amountCents = Math.round(amount * 100);
  
  console.log('💳 Payment request received:', { 
    paymentMethodId, 
    amount, 
    sessionId, 
    isTip, 
    creatorId,
    description,
    userId: req.user.supabase_id,
    timestamp: new Date().toISOString()
  });
  
  // Validation
  if (!paymentMethodId || !amount) {
    return res.status(400).json({ 
      error: 'Missing required fields: paymentMethodId and amount',
      timestamp: new Date().toISOString()
    });
  }

  if (amount <= 0 || amount > 10000) {
    return res.status(400).json({
      error: 'Amount must be between $0.01 and $10,000',
      timestamp: new Date().toISOString()
    });
  }

  // Validate amount in cents
  if (amountCents < 50) { // Stripe minimum is $0.50
    return res.status(400).json({
      error: 'Minimum payment amount is $0.50',
      timestamp: new Date().toISOString()
    });
  }

  let client;
  
  try {
    // Get client from pool with retry
    client = await retryDB(() => pool.connect());
    
    // Start transaction
    await retryDB(() => client.query('BEGIN'));

    let actualSessionId = null;
    let creatorUser = null;
    let fanUser = null;

    // Get or create user records with proper UUID casting
    const fanResult = await retryDB(() => client.query(
      'SELECT id, supabase_id FROM users WHERE supabase_id = $1::uuid',
      [req.user.supabase_id]
    ));

    if (fanResult.rows.length === 0) {
      // Create user record if it doesn't exist
      const newFanResult = await retryDB(() => client.query(
        'INSERT INTO users (supabase_id, is_creator) VALUES ($1::uuid, $2) RETURNING id, supabase_id',
        [req.user.supabase_id, false]
      ));
      fanUser = newFanResult.rows[0];
    } else {
      fanUser = fanResult.rows[0];
    }

    // Handle session creation for non-tip payments
    if (!isTip && creatorId) {
      console.log('🔄 Creating session for non-tip payment');
      
      const creatorResult = await retryDB(() => client.query(
        'SELECT id, supabase_id FROM users WHERE supabase_id = $1',
        [creatorId]
      ));

      if (creatorResult.rows.length === 0) {
        throw new Error('Creator not found');
      }

      creatorUser = creatorResult.rows[0];

      // Create session with correct column name (fan_id not fan_id)
      const sessionResult = await retryDB(() => client.query(
        `INSERT INTO sessions (creator_id, fan_id, start_time, type) 
         VALUES ($1, $2, NOW(), 'video') 
         RETURNING id`,
        [creatorUser.id, fanUser.id]
      ));

      actualSessionId = sessionResult.rows[0].id;
      console.log('✅ Session created with ID:', actualSessionId);
    }

    // Create idempotency key to prevent duplicate charges
    const idempotencyKey = crypto.createHash('sha256')
      .update([
        req.user.supabase_id || req.user.uid,
        actualSessionId || 'tip',
        amountCents,
        Math.floor(Date.now() / 8000).toString() // rotates every 8 seconds
      ].join(':'))
      .digest('hex');

    // Create payment intent with Stripe (with retry and idempotency)
    console.log('🔄 Creating Stripe payment intent with idempotency key...');
    const paymentIntent = await retryStripe(() => stripe.paymentIntents.create({
      amount: amountCents, // Already in cents
      currency: 'usd',
      payment_method: paymentMethodId,
      confirmation_method: 'manual',
      confirm: true,
      return_url: process.env.FRONTEND_URL || 'http://localhost:3000',
      description: description || `${isTip ? 'Tip' : 'Payment'} - $${(amountCents/100).toFixed(2)} USD`,
      metadata: {
        sessionId: actualSessionId ? actualSessionId.toString() : 'tip',
        isTip: isTip ? 'true' : 'false',
        userId: req.user.supabase_id,
        creatorId: creatorId ? creatorId.toString() : '',
        memberId: fanUser.id.toString(),
        requestId: req.requestId // Add request ID for tracking
      }
    }, {
      idempotencyKey: idempotencyKey
    }));
    
    console.log('✅ Payment intent created:', {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount
    });

    // Handle different payment statuses
    let paymentStatus = 'pending';
    
    if (paymentIntent.status === 'succeeded') {
      paymentStatus = 'completed';
      console.log('✅ Payment succeeded immediately');
    } else if (paymentIntent.status === 'requires_action') {
      paymentStatus = 'requires_action';
      console.log('⚠️ Payment requires additional action (3D Secure)');
    } else if (paymentIntent.status === 'requires_payment_method') {
      paymentStatus = 'failed';
      console.log('❌ Payment failed - requires new payment method');
    }

    // Save payment record to database with amount in cents
    const paymentRecord = await client.query(
      `INSERT INTO payments (session_id, amount_cents, tip_cents, status, stripe_payment_intent_id, idempotency_key, request_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (idempotency_key) DO UPDATE SET
         status = EXCLUDED.status,
         updated_at = NOW()
       RETURNING *`,
      [
        actualSessionId, // Will be null for tips
        amountCents, // Store in cents
        isTip ? amountCents : 0, // Store tips in cents
        paymentStatus,
        paymentIntent.id,
        idempotencyKey,
        req.requestId
      ]
    );
    
    console.log('✅ Payment saved to database:', {
      id: paymentRecord.rows[0].id,
      amount: paymentRecord.rows[0].amount,
      status: paymentRecord.rows[0].status
    });

    // Update user stats
    if (paymentStatus === 'completed') {
      // Update creator earnings (store in cents)
      if (creatorUser) {
        await client.query(
          'UPDATE users SET total_earnings_cents = COALESCE(total_earnings_cents, 0) + $1, total_sessions = COALESCE(total_sessions, 0) + 1 WHERE id = $2',
          [amountCents, creatorUser.id]
        );
      }

      // Update fan spending (store in cents)
      await client.query(
        'UPDATE users SET total_spent_cents = COALESCE(total_spent_cents, 0) + $1 WHERE id = $2',
        [amountCents, fanUser.id]
      );
    }

    // Commit transaction
    await client.query('COMMIT');
    
    console.log('✅ Payment transaction completed successfully');
    
    res.json({ 
      success: true,
      clientSecret: paymentIntent.client_secret, // For frontend compatibility
      payment: {
        id: paymentRecord.rows[0].id,
        amount: amount, // Keep as dollars for frontend compatibility
        amountCents: amountCents, // Also provide cents
        status: paymentStatus,
        isTip: isTip,
        sessionId: actualSessionId
      },
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        client_secret: paymentIntent.client_secret
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    // Rollback transaction
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('❌ Rollback error:', rollbackError);
      }
    }
    
    console.error('❌ Payment error:', {
      message: error.message,
      code: error.code,
      type: error.type,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // Return user-friendly error messages
    let errorMessage = error.message;
    let statusCode = 500;
    
    if (error.code) {
      switch (error.code) {
        case 'card_declined':
          errorMessage = 'Your card was declined. Please try a different payment method.';
          statusCode = 402;
          break;
        case 'insufficient_funds':
          errorMessage = 'Insufficient funds. Please try a different payment method.';
          statusCode = 402;
          break;
        case 'expired_card':
          errorMessage = 'Your card has expired. Please try a different payment method.';
          statusCode = 402;
          break;
        case 'incorrect_cvc':
          errorMessage = 'Your card security code is incorrect.';
          statusCode = 402;
          break;
        case 'processing_error':
          errorMessage = 'An error occurred while processing your card. Please try again.';
          statusCode = 402;
          break;
        case 'incorrect_number':
          errorMessage = 'Your card number is incorrect.';
          statusCode = 402;
          break;
      }
    }
    
    res.status(statusCode).json({ 
      error: errorMessage,
      code: error.code,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Apple Pay merchant validation
router.post('/apple-pay/validate', authenticateToken, async (req, res) => {
  try {
    const { validationURL } = req.body;
    
    if (!validationURL) {
      return res.status(400).json({ 
        error: 'Validation URL is required',
        timestamp: new Date().toISOString()
      });
    }

    // In production, you would validate with Apple's servers using your merchant certificate
    // For now, return a mock merchant session for development
    if (process.env.NODE_ENV === 'production' && process.env.APPLE_MERCHANT_ID) {
      // TODO: Implement actual Apple Pay merchant validation
      // This requires:
      // 1. Merchant ID certificate from Apple Developer
      // 2. HTTPS request to validationURL with certificate
      // 3. Return the merchant session response
      
      return res.status(501).json({ 
        error: 'Apple Pay merchant validation not implemented',
        message: 'Please configure APPLE_MERCHANT_ID and certificates',
        timestamp: new Date().toISOString()
      });
    }

    // Development mock response
    res.json({
      epochTimestamp: Date.now(),
      expiresAt: Date.now() + 3600000, // 1 hour
      merchantSessionIdentifier: `merchant_session_${Date.now()}`,
      nonce: crypto.randomBytes(16).toString('hex'),
      merchantIdentifier: process.env.APPLE_MERCHANT_ID || 'merchant.com.digis.dev',
      domainName: req.get('host'),
      displayName: 'Digis',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Apple Pay validation error:', error);
    res.status(500).json({ 
      error: 'Failed to validate merchant',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get payment history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    // Get user ID
    const userResult = await pool.query(
      'SELECT id FROM users WHERE supabase_id = $1::uuid',
      [req.user.supabase_id]
    );

    if (userResult.rows.length === 0) {
      return res.json({
        payments: [],
        total: 0,
        timestamp: new Date().toISOString()
      });
    }

    const userId = userResult.rows[0].id;

    // Get payments
    const paymentsResult = await pool.query(
      `SELECT p.*, s.type as session_type, s.start_time, s.end_time,
              creator.id::text as creator_uid, fan.id::text as fan_uid
       FROM payments p
       LEFT JOIN sessions s ON p.session_id = s.id
       LEFT JOIN users creator ON s.creator_id = creator.id
       LEFT JOIN users fan ON s.fan_id = fan.id
       WHERE s.fan_id = $1 OR s.creator_id = $1 OR (p.session_id IS NULL AND EXISTS (
         SELECT 1 FROM users WHERE supabase_id = $1
       ))
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total
       FROM payments p
       LEFT JOIN sessions s ON p.session_id = s.id
       WHERE s.fan_id = $1 OR s.creator_id = $1 OR (p.session_id IS NULL AND EXISTS (
         SELECT 1 FROM users WHERE supabase_id = $1
       ))`,
      [userId]
    );

    res.json({
      payments: paymentsResult.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Payment history error:', error);
    res.status(500).json({
      error: 'Failed to fetch payment history',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get earnings for creators
router.get('/earnings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id || req.user.supabase_id || req.user.uid;
    
    if (!userId) {
      return res.status(400).json({
        error: 'User ID not found',
        timestamp: new Date().toISOString()
      });
    }
    
    const userResult = await pool.query(
      'SELECT id, is_creator FROM users WHERE supabase_id = $1::uuid',
      [userId]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].is_creator) {
      return res.status(403).json({ 
        error: 'Only creators can view earnings',
        timestamp: new Date().toISOString()
      });
    }

    const creatorId = userResult.rows[0].id;

    // Get earnings data
    const earningsResult = await pool.query(
      `SELECT 
         SUM(p.amount) as total_earnings,
         COUNT(p.id) as total_payments,
         COUNT(DISTINCT s.fan_id) as unique_customers,
         AVG(p.amount) as average_payment
       FROM payments p
       LEFT JOIN sessions s ON p.session_id = s.id
       WHERE s.creator_id = $1 AND p.status = 'completed'`,
      [creatorId]
    );

    // Get recent payments
    const recentPaymentsResult = await pool.query(
      `SELECT p.*, s.type as session_type, s.start_time, s.end_time,
              fan.id::text as fan_uid
       FROM payments p
       LEFT JOIN sessions s ON p.session_id = s.id
       LEFT JOIN users fan ON s.fan_id = fan.id
       WHERE s.creator_id = $1 AND p.status = 'completed'
       ORDER BY p.created_at DESC
       LIMIT 20`,
      [creatorId]
    );

    // Get monthly earnings
    const monthlyEarningsResult = await pool.query(
      `SELECT 
         DATE_TRUNC('month', p.created_at) as month,
         SUM(p.amount) as earnings,
         COUNT(p.id) as payment_count
       FROM payments p
       LEFT JOIN sessions s ON p.session_id = s.id
       WHERE s.creator_id = $1 AND p.status = 'completed'
       GROUP BY DATE_TRUNC('month', p.created_at)
       ORDER BY month DESC
       LIMIT 12`,
      [creatorId]
    );

    const earnings = earningsResult.rows[0];
    
    res.json({
      summary: {
        totalEarnings: parseFloat(earnings.total_earnings || 0),
        totalPayments: parseInt(earnings.total_payments || 0),
        uniqueCustomers: parseInt(earnings.unique_customers || 0),
        averagePayment: parseFloat(earnings.average_payment || 0)
      },
      recentPayments: recentPaymentsResult.rows,
      monthlyEarnings: monthlyEarningsResult.rows,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Earnings error:', error);
    res.status(500).json({
      error: 'Failed to fetch earnings',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Webhook endpoint for Stripe (with deduplication)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Deduplicate webhook events to prevent double processing
  try {
    const { rowCount } = await pool.query(
      `INSERT INTO stripe_webhook_events (stripe_event_id, type, payload)
       VALUES ($1, $2, $3)
       ON CONFLICT (stripe_event_id) DO NOTHING`,
      [event.id, event.type, JSON.stringify(event)]
    );

    // If rowCount is 0, this event was already processed
    if (rowCount === 0) {
      console.log('⏭️ Webhook already processed, skipping:', event.id);
      return res.json({ received: true, status: 'duplicate' });
    }
  } catch (dedupeError) {
    console.error('❌ Webhook deduplication error:', dedupeError);
    // Continue processing even if deduplication fails
  }

  // Handle the event
  console.log('🔄 Stripe webhook received:', event.type);

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object;
      console.log('✅ Payment succeeded:', paymentIntent.id);
      
      // Update payment status in database
      pool.query(
        'UPDATE payments SET status = $1 WHERE stripe_payment_intent_id = $2',
        ['completed', paymentIntent.id]
      ).catch(err => console.error('Database update error:', err));
      
      break;
    }
    case 'payment_intent.payment_failed': {
      const failedPayment = event.data.object;
      console.log('❌ Payment failed:', failedPayment.id);
      
      // Update payment status in database
      pool.query(
        'UPDATE payments SET status = $1 WHERE stripe_payment_intent_id = $2',
        ['failed', failedPayment.id]
      ).catch(err => console.error('Database update error:', err));
      
      break;
    }
    default:
      console.log('⚠️ Unhandled event type:', event.type);
  }

  res.json({ received: true });
});

// Refund payment
router.post('/refund', authenticateToken, async (req, res) => {
  const { paymentId, reason } = req.body;

  if (!paymentId) {
    return res.status(400).json({
      error: 'Payment ID is required',
      timestamp: new Date().toISOString()
    });
  }

  try {
    // Get payment record
    const paymentResult = await pool.query(
      'SELECT * FROM payments WHERE id = $1',
      [paymentId]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Payment not found',
        timestamp: new Date().toISOString()
      });
    }

    const payment = paymentResult.rows[0];

    // Create refund with Stripe
    const refund = await stripe.refunds.create({
      payment_intent: payment.stripe_payment_intent_id,
      reason: reason || 'requested_by_customer'
    });

    // Update payment status
    await pool.query(
      'UPDATE payments SET status = $1 WHERE id = $2',
      ['refunded', paymentId]
    );

    console.log('✅ Refund processed:', {
      paymentId,
      refundId: refund.id,
      amount: refund.amount
    });

    res.json({
      success: true,
      refund: {
        id: refund.id,
        amount: refund.amount / 100,
        status: refund.status
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Refund error:', error);
    res.status(500).json({
      error: 'Failed to process refund',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Setup bank account (for creators)
router.post('/bank-account', authenticateToken, async (req, res) => {
  const { accountName, accountNumber, routingNumber, accountType, bankName } = req.body;
  
  console.log('🏦 Bank account setup request:', {
    userId: req.user.supabase_id,
    hasAccountName: !!accountName,
    hasAccountNumber: !!accountNumber,
    hasRoutingNumber: !!routingNumber,
    accountType,
    bankName,
    timestamp: new Date().toISOString()
  });
  
  // Validation
  if (!accountName || !accountNumber || !routingNumber || !accountType || !bankName) {
    return res.status(400).json({
      error: 'All bank account fields are required',
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    // Get creator details
    const userResult = await pool.query(
      'SELECT id, is_creator FROM users WHERE supabase_id = $1::uuid',
      [req.user.supabase_id]
    );
    
    if (userResult.rows.length === 0 || !userResult.rows[0].is_creator) {
      return res.status(403).json({
        error: 'Only creators can setup bank accounts',
        timestamp: new Date().toISOString()
      });
    }
    
    const creatorId = userResult.rows[0].id;
    
    // Store encrypted bank details (in production, use proper encryption)
    const bankDetails = {
      accountName,
      accountNumber: accountNumber.slice(-4).padStart(accountNumber.length, '*'), // Mask account number
      routingNumber,
      accountType,
      bankName,
      lastUpdated: new Date().toISOString()
    };
    
    // Update user's bank details
    await pool.query(
      'UPDATE users SET bank_account = $1, auto_withdraw_enabled = true WHERE id = $2',
      [JSON.stringify(bankDetails), creatorId]
    );
    
    console.log('✅ Bank account setup successful for creator:', creatorId);
    
    res.json({
      success: true,
      message: 'Bank account setup successfully. Auto-withdrawals will occur on the 1st and 15th of each month.',
      bankAccount: {
        accountName,
        accountNumber: bankDetails.accountNumber,
        accountType,
        bankName,
        autoWithdrawEnabled: true
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Bank account setup error:', error);
    res.status(500).json({
      error: 'Failed to setup bank account',
      timestamp: new Date().toISOString()
    });
  }
});

// Get bank account details (for creators)
router.get('/bank-account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id || req.user.supabase_id || req.user.uid;
    
    if (!userId) {
      return res.status(400).json({
        error: 'User ID not found',
        timestamp: new Date().toISOString()
      });
    }
    
    const userResult = await pool.query(
      'SELECT id, is_creator, bank_account, auto_withdraw_enabled FROM users WHERE supabase_id = $1::uuid OR id = $2::integer',
      [userId, userId]
    );
    
    if (userResult.rows.length === 0 || !userResult.rows[0].is_creator) {
      return res.status(403).json({
        error: 'Only creators can view bank account details',
        timestamp: new Date().toISOString()
      });
    }
    
    const creator = userResult.rows[0];
    const bankAccount = creator.bank_account ? JSON.parse(creator.bank_account) : null;
    
    res.json({
      hasBankAccount: !!bankAccount,
      bankAccount: bankAccount,
      autoWithdrawEnabled: creator.auto_withdraw_enabled || false,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Get bank account error:', error);
    res.status(500).json({
      error: 'Failed to fetch bank account details',
      timestamp: new Date().toISOString()
    });
  }
});

// Toggle auto-withdrawal (for creators)
router.put('/auto-withdraw', authenticateToken, async (req, res) => {
  const { enabled } = req.body;
  
  try {
    const userResult = await pool.query(
      'SELECT id, is_creator, bank_account FROM users WHERE supabase_id = $1::uuid',
      [req.user.supabase_id]
    );
    
    if (userResult.rows.length === 0 || !userResult.rows[0].is_creator) {
      return res.status(403).json({
        error: 'Only creators can manage auto-withdrawal',
        timestamp: new Date().toISOString()
      });
    }
    
    if (!userResult.rows[0].bank_account) {
      return res.status(400).json({
        error: 'Please setup your bank account first',
        timestamp: new Date().toISOString()
      });
    }
    
    await pool.query(
      'UPDATE users SET auto_withdraw_enabled = $1 WHERE id = $2',
      [enabled, userResult.rows[0].id]
    );
    
    res.json({
      success: true,
      autoWithdrawEnabled: enabled,
      message: enabled 
        ? 'Auto-withdrawal enabled. Payments will be sent on the 1st and 15th of each month.'
        : 'Auto-withdrawal disabled.',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Toggle auto-withdraw error:', error);
    res.status(500).json({
      error: 'Failed to update auto-withdrawal settings',
      timestamp: new Date().toISOString()
    });
  }
});

// Get withdrawal settings (NEW)
router.get('/withdrawal-settings', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        u.is_creator,
        false as auto_withdraw_enabled,
        0 as reserved_balance,
        u.stripe_account_id,
        null as bank_account,
        null as last_auto_withdraw_date,
        null as next_auto_withdraw_date,
        COALESCE(tb.balance, 0) as current_balance,
        COALESCE(tb.balance, 0) as withdrawable_balance
      FROM users u
      LEFT JOIN token_balances tb ON tb.user_id = u.supabase_id
      WHERE u.supabase_id = $1::uuid`,
      [req.user.supabase_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }
    
    const user = result.rows[0];
    
    if (!user.is_creator) {
      return res.status(403).json({
        error: 'Only creators can access withdrawal settings',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      settings: {
        autoWithdrawEnabled: user.auto_withdraw_enabled || false,
        reservedBalance: parseFloat(user.reserved_balance || 0),
        currentBalance: parseFloat(user.current_balance || 0),
        withdrawableBalance: parseFloat(user.withdrawable_balance || 0),
        hasBankAccount: !!(user.stripe_account_id || user.bank_account),
        lastWithdrawal: user.last_auto_withdraw_date,
        nextWithdrawal: user.next_auto_withdraw_date
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Get withdrawal settings error:', error);
    res.status(500).json({
      error: 'Failed to fetch withdrawal settings',
      timestamp: new Date().toISOString()
    });
  }
});

// Update withdrawal settings including reserved balance (NEW)
router.put('/withdrawal-settings', authenticateToken, async (req, res) => {
  const { autoWithdrawEnabled, reservedBalance } = req.body;
  
  try {
    // Check if user is a creator
    const creatorResult = await pool.query(
      'SELECT id, is_creator, stripe_account_id, bank_account FROM users WHERE supabase_id = $1::uuid',
      [req.user.supabase_id]
    );
    
    if (creatorResult.rows.length === 0 || !creatorResult.rows[0].is_creator) {
      return res.status(403).json({
        error: 'Only creators can manage withdrawal settings',
        timestamp: new Date().toISOString()
      });
    }
    
    const creator = creatorResult.rows[0];
    const hasBankAccount = !!(creator.stripe_account_id || creator.bank_account);
    
    // Check if trying to enable auto-withdrawal without bank account
    if (autoWithdrawEnabled === true && !hasBankAccount) {
      return res.status(400).json({
        error: 'Cannot enable auto-withdrawal without bank account setup',
        needsBankSetup: true,
        timestamp: new Date().toISOString()
      });
    }
    
    // Build update query dynamically
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (autoWithdrawEnabled !== undefined) {
      updates.push(`auto_withdraw_enabled = $${paramIndex++}`);
      params.push(autoWithdrawEnabled);
      
      // If enabling auto-withdrawal, set next withdrawal date
      if (autoWithdrawEnabled === true) {
        const today = new Date();
        const nextDate = new Date();
        
        // Set to next 1st or 15th
        if (today.getDate() < 15) {
          nextDate.setDate(15);
        } else {
          nextDate.setMonth(nextDate.getMonth() + 1);
          nextDate.setDate(1);
        }
        
        updates.push(`next_auto_withdraw_date = $${paramIndex++}`);
        params.push(nextDate);
      } else {
        // Clear next withdrawal date if disabling
        updates.push(`next_auto_withdraw_date = NULL`);
      }
    }
    
    if (reservedBalance !== undefined && reservedBalance !== null) {
      // Validate reserved balance
      if (reservedBalance < 0) {
        return res.status(400).json({
          error: 'Reserved balance cannot be negative',
          timestamp: new Date().toISOString()
        });
      }
      
      updates.push(`reserved_balance = $${paramIndex++}`);
      params.push(reservedBalance);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No settings to update',
        timestamp: new Date().toISOString()
      });
    }
    
    // Add WHERE clause parameter
    params.push(req.user.supabase_id);
    
    // Update settings
    await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE supabase_id = $${paramIndex}::uuid`,
      params
    );
    
    // Get updated settings
    const updatedResult = await pool.query(
      `SELECT 
        u.auto_withdraw_enabled,
        u.reserved_balance,
        u.next_auto_withdraw_date,
        COALESCE(tb.balance, 0) as current_balance,
        GREATEST(0, COALESCE(tb.balance, 0) - COALESCE(u.reserved_balance, 0)) as withdrawable_balance
      FROM users u
      LEFT JOIN token_balances tb ON tb.user_id = u.supabase_id
      WHERE u.supabase_id = $1::uuid`,
      [req.user.supabase_id]
    );
    
    const updated = updatedResult.rows[0];
    
    res.json({
      success: true,
      settings: {
        autoWithdrawEnabled: updated.auto_withdraw_enabled || false,
        reservedBalance: parseFloat(updated.reserved_balance || 0),
        currentBalance: parseFloat(updated.current_balance || 0),
        withdrawableBalance: parseFloat(updated.withdrawable_balance || 0),
        nextWithdrawal: updated.next_auto_withdraw_date
      },
      message: autoWithdrawEnabled === true 
        ? 'Auto-withdrawal enabled. Payments will be sent bi-weekly.'
        : autoWithdrawEnabled === false
        ? 'Auto-withdrawal disabled. Tokens will accumulate in your balance.'
        : 'Withdrawal settings updated.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Update withdrawal settings error:', error);
    res.status(500).json({
      error: 'Failed to update withdrawal settings',
      timestamp: new Date().toISOString()
    });
  }
});

// Process automatic withdrawals (called by cron job)
router.post('/process-auto-withdrawals', async (req, res) => {
  // This should be protected by a secret key or internal-only access
  const { secretKey } = req.body;
  
  if (secretKey !== process.env.CRON_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  console.log('🔄 Processing automatic withdrawals...');
  
  let client;
  
  try {
    client = await pool.connect();
    
    // Get all creators with auto-withdrawal enabled, including reserved balance
    const creatorsResult = await client.query(
      `SELECT 
        u.id, 
        u.supabase_id,
        u.reserved_balance,
        u.bank_account,
        COALESCE(tb.balance, 0) as token_balance
       FROM users u
       LEFT JOIN token_balances tb ON tb.user_id = u.supabase_id
       WHERE u.is_creator = true 
         AND u.auto_withdraw_enabled = true 
         AND u.bank_account IS NOT NULL`
    );
    
    const processedWithdrawals = [];
    
    for (const creator of creatorsResult.rows) {
      try {
        await client.query('BEGIN');
        
        const tokenBalance = parseFloat(creator.token_balance || 0);
        const reservedBalance = parseFloat(creator.reserved_balance || 0);
        const withdrawableBalance = Math.max(0, tokenBalance - reservedBalance);
        
        // Convert tokens to USD (at $0.05 per token)
        const withdrawableUSD = withdrawableBalance * 0.05;
        
        // Only process if withdrawable balance is above minimum threshold ($50)
        if (withdrawableUSD >= 50) {
          // Create withdrawal record
          const withdrawalResult = await client.query(
            `INSERT INTO withdrawals (
              creator_id, 
              amount, 
              tokens_withdrawn,
              status, 
              account_details,
              requested_at,
              notes
            ) VALUES ($1, $2, $3, $4, $5, NOW(), $6) 
            RETURNING *`,
            [
              creator.id,
              withdrawableUSD,
              withdrawableBalance,
              'processing',
              creator.bank_account,
              `Automatic withdrawal - Reserved: ${reservedBalance} tokens`
            ]
          );
          
          // Deduct tokens from balance
          await client.query(
            'UPDATE token_balances SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2',
            [withdrawableBalance, creator.supabase_id]
          );
          
          // Update last withdrawal date
          await client.query(
            'UPDATE users SET last_auto_withdraw_date = NOW() WHERE supabase_id = $1',
            [creator.supabase_id]
          );
          
          await client.query('COMMIT');
          
          processedWithdrawals.push({
            creatorId: creator.id,
            amount: withdrawableUSD,
            tokens: withdrawableBalance,
            withdrawalId: withdrawalResult.rows[0].id
          });
          
          console.log(`✅ Auto-withdrawal processed for creator ${creator.id}: $${withdrawableUSD} (${withdrawableBalance} tokens)`);
        } else {
          await client.query('ROLLBACK');
          console.log(`⏭️ Skipping creator ${creator.id}: withdrawable balance too low ($${withdrawableUSD}, need $50+). Reserved: ${reservedBalance} tokens`);
        }
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ Error processing withdrawal for creator ${creator.id}:`, error);
      }
    }
    
    res.json({
      success: true,
      processedCount: processedWithdrawals.length,
      totalAmount: processedWithdrawals.reduce((sum, w) => sum + w.amount, 0),
      withdrawals: processedWithdrawals,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Auto-withdrawal processing error:', error);
    res.status(500).json({
      error: 'Failed to process automatic withdrawals',
      timestamp: new Date().toISOString()
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Get withdrawal history (for creators)
router.get('/withdrawals', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id || req.user.supabase_id || req.user.uid;
    
    if (!userId) {
      return res.status(400).json({
        error: 'User ID not found',
        timestamp: new Date().toISOString()
      });
    }
    
    const userResult = await pool.query(
      'SELECT id, is_creator FROM users WHERE supabase_id = $1::uuid',
      [userId]
    );
    
    if (userResult.rows.length === 0 || !userResult.rows[0].is_creator) {
      return res.status(403).json({
        error: 'Only creators can view withdrawals',
        timestamp: new Date().toISOString()
      });
    }
    
    const creatorId = userResult.rows[0].id;
    
    // Get withdrawals
    const withdrawalsResult = await pool.query(
      `SELECT id, amount, status, requested_at, processed_at, notes
       FROM withdrawals 
       WHERE creator_id = $1 
       ORDER BY requested_at DESC`,
      [creatorId]
    );
    
    res.json({
      withdrawals: withdrawalsResult.rows,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Get withdrawals error:', error);
    res.status(500).json({
      error: 'Failed to fetch withdrawals',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;