const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Payments route working',
    stripe: 'Connected',
    timestamp: new Date().toISOString(),
    environment: {
      hasStripeKey: !!process.env.STRIPE_SECRET_KEY
    }
  });
});

// Create payment intent
router.post('/create-payment', authenticateToken, async (req, res) => {
  const { paymentMethodId, amount, sessionId, isTip, creatorId, description } = req.body;
  
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

  let client;
  
  try {
    // Get client from pool
    client = await pool.connect();
    
    // Start transaction
    await client.query('BEGIN');

    let actualSessionId = null;
    let creatorUser = null;
    let fanUser = null;

    // Get or create user records
    const fanResult = await client.query(
      'SELECT id FROM users WHERE supabase_id = $1',
      [req.user.supabase_id]
    );

    if (fanResult.rows.length === 0) {
      // Create user record if it doesn't exist
      const newFanResult = await client.query(
        'INSERT INTO users (id, is_creator) VALUES ($1::uuid, $2) RETURNING id',
        [req.user.supabase_id, false]
      );
      fanUser = newFanResult.rows[0];
    } else {
      fanUser = fanResult.rows[0];
    }

    // Handle session creation for non-tip payments
    if (!isTip && creatorId) {
      console.log('🔄 Creating session for non-tip payment');
      
      const creatorResult = await client.query(
        'SELECT id FROM users WHERE id = $1',
        [creatorId]
      );

      if (creatorResult.rows.length === 0) {
        throw new Error('Creator not found');
      }

      creatorUser = creatorResult.rows[0];

      // Create session
      const sessionResult = await client.query(
        `INSERT INTO sessions (creator_id, fan_id, start_time, type) 
         VALUES ($1, $2, NOW(), 'video') 
         RETURNING id`,
        [creatorUser.id, fanUser.id]
      );

      actualSessionId = sessionResult.rows[0].id;
      console.log('✅ Session created with ID:', actualSessionId);
    }

    // Create payment intent with Stripe
    console.log('🔄 Creating Stripe payment intent...');
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      payment_method: paymentMethodId,
      confirmation_method: 'manual',
      confirm: true,
      return_url: process.env.FRONTEND_URL || 'http://localhost:3000',
      description: description || `${isTip ? 'Tip' : 'Payment'} - ${amount} USD`,
      metadata: {
        sessionId: actualSessionId ? actualSessionId.toString() : 'tip',
        isTip: isTip ? 'true' : 'false',
        userId: req.user.supabase_id,
        creatorId: creatorId ? creatorId.toString() : '',
        fanId: fanUser.id.toString()
      }
    });
    
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

    // Save payment record to database
    const paymentRecord = await client.query(
      `INSERT INTO payments (session_id, amount, tip, status, stripe_payment_intent_id, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW()) 
       RETURNING *`,
      [
        actualSessionId, // Will be null for tips
        amount, 
        isTip ? amount : 0,
        paymentStatus,
        paymentIntent.id
      ]
    );
    
    console.log('✅ Payment saved to database:', {
      id: paymentRecord.rows[0].id,
      amount: paymentRecord.rows[0].amount,
      status: paymentRecord.rows[0].status
    });

    // Update user stats
    if (paymentStatus === 'completed') {
      // Update creator earnings
      if (creatorUser) {
        await client.query(
          'UPDATE users SET total_earnings = COALESCE(total_earnings, 0) + $1, total_sessions = COALESCE(total_sessions, 0) + 1 WHERE id = $2',
          [amount, creatorUser.id]
        );
      }

      // Update fan spending
      await client.query(
        'UPDATE users SET total_spent = COALESCE(total_spent, 0) + $1 WHERE id = $2',
        [amount, fanUser.id]
      );
    }

    // Commit transaction
    await client.query('COMMIT');
    
    console.log('✅ Payment transaction completed successfully');
    
    res.json({ 
      success: true,
      payment: {
        id: paymentRecord.rows[0].id,
        amount: amount,
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

// Get payment history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    // Get user ID
    const userResult = await pool.query(
      'SELECT id FROM users WHERE supabase_id = $1',
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
         SELECT 1 FROM users WHERE id = $1
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
         SELECT 1 FROM users WHERE id = $1
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
    const userId = req.user.supabase_id || req.user.id || req.user.uid;
    
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

// Webhook endpoint for Stripe
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
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
      'SELECT id, is_creator FROM users WHERE supabase_id = $1',
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
    const userId = req.user.supabase_id || req.user.id || req.user.uid;
    
    if (!userId) {
      return res.status(400).json({
        error: 'User ID not found',
        timestamp: new Date().toISOString()
      });
    }
    
    const userResult = await pool.query(
      'SELECT id, is_creator, bank_account, auto_withdraw_enabled FROM users WHERE supabase_id = $1 OR id = $2',
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
      'SELECT id, is_creator, bank_account FROM users WHERE supabase_id = $1',
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
    
    // Get all creators with auto-withdrawal enabled
    const creatorsResult = await client.query(
      `SELECT id, id::text as user_id, total_earnings, withdrawn_amount, bank_account 
       FROM users 
       WHERE is_creator = true 
         AND auto_withdraw_enabled = true 
         AND bank_account IS NOT NULL`
    );
    
    const processedWithdrawals = [];
    
    for (const creator of creatorsResult.rows) {
      try {
        await client.query('BEGIN');
        
        const totalEarnings = parseFloat(creator.total_earnings || 0);
        const withdrawnAmount = parseFloat(creator.withdrawn_amount || 0);
        const availableBalance = totalEarnings - withdrawnAmount;
        
        // Only process if balance is above minimum threshold ($50)
        if (availableBalance >= 50) {
          // Create withdrawal record
          const withdrawalResult = await client.query(
            `INSERT INTO withdrawals (
              creator_id, 
              amount, 
              status, 
              account_details,
              requested_at,
              notes
            ) VALUES ($1, $2, $3, $4, NOW(), $5) 
            RETURNING *`,
            [
              creator.id,
              availableBalance,
              'processing',
              creator.bank_account,
              'Automatic withdrawal - scheduled'
            ]
          );
          
          // Update withdrawn amount
          await client.query(
            'UPDATE users SET withdrawn_amount = COALESCE(withdrawn_amount, 0) + $1 WHERE id = $2',
            [availableBalance, creator.id]
          );
          
          await client.query('COMMIT');
          
          processedWithdrawals.push({
            creatorId: creator.id,
            amount: availableBalance,
            withdrawalId: withdrawalResult.rows[0].id
          });
          
          console.log(`✅ Auto-withdrawal processed for creator ${creator.id}: $${availableBalance}`);
        } else {
          await client.query('ROLLBACK');
          console.log(`⏭️ Skipping creator ${creator.id}: balance too low ($${availableBalance})`);
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
    const userId = req.user.supabase_id || req.user.id || req.user.uid;
    
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