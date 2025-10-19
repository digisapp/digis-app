const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../utils/db');

// Check TV subscription status (including 60-day free trial)
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id || req.user.id || req.user.uid;
    
    if (!userId) {
      return res.status(400).json({
        error: 'User ID not found',
        timestamp: new Date().toISOString()
      });
    }

    // First check if user has active 60-day trial
    const trialQuery = `
      SELECT 
        tv_trial_start_date,
        tv_trial_end_date,
        CASE 
          WHEN tv_trial_end_date > NOW() THEN true
          ELSE false
        END as trial_active,
        GREATEST(0, EXTRACT(DAY FROM (tv_trial_end_date - NOW()))::INTEGER) as trial_days_remaining
      FROM users
      WHERE supabase_id = $1
    `;

    const trialResult = await pool.query(trialQuery, [userId]);
    
    if (trialResult.rows.length > 0 && trialResult.rows[0].trial_active) {
      // User has active 60-day trial
      return res.json({
        hasAccess: true,
        isTrial: true,
        trialDaysRemaining: trialResult.rows[0].trial_days_remaining,
        trialEndDate: trialResult.rows[0].tv_trial_end_date,
        subscription: {
          subscription_type: 'trial',
          status: 'active',
          end_date: trialResult.rows[0].tv_trial_end_date,
          trial_days_remaining: trialResult.rows[0].trial_days_remaining
        },
        isTrialAvailable: false
      });
    }

    // Check if user has active paid subscription
    const subscriptionQuery = `
      SELECT 
        s.*,
        CASE 
          WHEN s.subscription_type = 'trial' THEN 
            GREATEST(0, EXTRACT(DAY FROM (s.end_date - NOW()))::INTEGER)
          ELSE NULL
        END as trial_days_remaining
      FROM tv_subscriptions s
      WHERE s.user_id = $1 
        AND s.status = 'active' 
        AND s.end_date > NOW()
      ORDER BY s.created_at DESC
      LIMIT 1
    `;

    const result = await pool.query(subscriptionQuery, [userId]);
    
    if (result.rows.length > 0) {
      // User has active paid subscription
      res.json({
        hasAccess: true,
        isTrial: false,
        subscription: result.rows[0],
        isTrialAvailable: false
      });
    } else {
      // No active subscription or trial
      res.json({
        hasAccess: false,
        isTrial: false,
        subscription: null,
        isTrialAvailable: false, // 60-day trial is automatic now
        trialExpired: trialResult.rows[0] && trialResult.rows[0].tv_trial_end_date < new Date()
      });
    }
  } catch (error) {
    console.error('Error checking TV subscription status:', error);
    res.status(500).json({ error: 'Failed to check subscription status' });
  }
});

// Start free trial
router.post('/start-trial', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user.supabase_id;

    await client.query('BEGIN');

    // Check if trial already used
    const userQuery = 'SELECT tv_trial_used FROM users WHERE supabase_id = $1 FOR UPDATE';
    const userResult = await client.query(userQuery, [userId]);
    
    if (!userResult.rows[0]) {
      throw new Error('User not found');
    }

    if (userResult.rows[0].tv_trial_used) {
      throw new Error('Free trial already used');
    }

    // Check if user already has active subscription
    const existingSubQuery = `
      SELECT id FROM tv_subscriptions 
      WHERE user_id = $1 AND status = 'active' AND current_period_end > NOW()
    `;
    const existingSub = await client.query(existingSubQuery, [userId]);
    
    if (existingSub.rows.length > 0) {
      throw new Error('You already have an active subscription');
    }

    // Create trial subscription
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7); // 7 day trial

    const insertQuery = `
      INSERT INTO tv_subscriptions 
      (user_id, subscription_type, status, current_period_start, current_period_end, token_amount, auto_renew)
      VALUES ($1, 'trial', 'active', NOW(), $2, 0, false)
      RETURNING *
    `;
    
    const subscriptionResult = await client.query(insertQuery, [userId, endDate]);

    // Mark trial as used
    await client.query('UPDATE users SET tv_trial_used = true WHERE supabase_id = $1', [userId]);

    await client.query('COMMIT');

    res.json({
      success: true,
      subscription: subscriptionResult.rows[0],
      message: 'Your 7-day free trial has started!'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error starting free trial:', error);
    res.status(400).json({ 
      error: error.message || 'Failed to start free trial' 
    });
  } finally {
    client.release();
  }
});

// Purchase monthly subscription
router.post('/subscribe', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  const subscriptionCost = 500; // 500 tokens per month
  
  try {
    const userId = req.user.supabase_id;

    await client.query('BEGIN');

    // Check user's token balance
    const balanceQuery = 'SELECT balance FROM token_balances WHERE user_id = $1 FOR UPDATE';
    const balanceResult = await client.query(balanceQuery, [userId]);
    
    if (!balanceResult.rows[0]) {
      throw new Error('Token balance not found');
    }

    const tokenBalance = parseFloat(balanceResult.rows[0].balance) || 0;
    
    if (tokenBalance < subscriptionCost) {
      throw new Error(`Insufficient tokens. You need ${subscriptionCost} tokens but only have ${tokenBalance}`);
    }

    // Check if user already has active subscription
    const existingSubQuery = `
      SELECT id FROM tv_subscriptions 
      WHERE user_id = $1 AND status = 'active' AND current_period_end > NOW()
    `;
    const existingSub = await client.query(existingSubQuery, [userId]);
    
    if (existingSub.rows.length > 0) {
      throw new Error('You already have an active subscription');
    }

    // Expire any old subscriptions
    await client.query(
      `UPDATE tv_subscriptions 
       SET status = 'expired', updated_at = NOW() 
       WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    // Create monthly subscription
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription

    const insertQuery = `
      INSERT INTO tv_subscriptions 
      (user_id, subscription_type, status, current_period_start, current_period_end, token_amount, auto_renew)
      VALUES ($1, 'monthly', 'active', NOW(), $2, $3, true)
      RETURNING *
    `;
    
    const subscriptionResult = await client.query(insertQuery, [userId, endDate, subscriptionCost]);

    // Deduct tokens
    await client.query(
      'UPDATE token_balances SET balance = balance - $1 WHERE user_id = $2',
      [subscriptionCost, userId]
    );

    // Record transaction
    await client.query(
      `INSERT INTO tv_subscription_transactions 
       (user_id, subscription_id, amount, transaction_type, status)
       VALUES ($1, $2, $3, 'purchase', 'completed')`,
      [userId, subscriptionResult.rows[0].id, subscriptionCost]
    );

    // Record token transaction
    await client.query(
      `INSERT INTO token_transactions 
       (user_id, amount, transaction_type, description, status)
       VALUES ($1, $2, 'tv_subscription', 'Digis TV Monthly Subscription', 'completed')`,
      [userId, -subscriptionCost]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      subscription: subscriptionResult.rows[0],
      newTokenBalance: tokenBalance - subscriptionCost,
      message: 'Successfully subscribed to Digis TV!'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error purchasing subscription:', error);
    res.status(400).json({ 
      error: error.message || 'Failed to purchase subscription' 
    });
  } finally {
    client.release();
  }
});

// Cancel subscription (disable auto-renew)
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;

    const result = await pool.query(
      `UPDATE tv_subscriptions 
       SET auto_renew = false, updated_at = NOW()
       WHERE user_id = $1 AND status = 'active' AND current_period_end > NOW()
       RETURNING *`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    res.json({
      success: true,
      subscription: result.rows[0],
      message: 'Your subscription will not renew after the current period'
    });

  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Get subscription history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;

    const query = `
      SELECT 
        s.*,
        t.amount as transaction_amount,
        t.transaction_type,
        t.created_at as transaction_date
      FROM tv_subscriptions s
      LEFT JOIN tv_subscription_transactions t ON t.subscription_id = s.id
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC
      LIMIT 20
    `;

    const result = await pool.query(query, [userId]);

    res.json({
      subscriptions: result.rows
    });

  } catch (error) {
    console.error('Error fetching subscription history:', error);
    res.status(500).json({ error: 'Failed to fetch subscription history' });
  }
});

module.exports = router;