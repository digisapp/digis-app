const express = require('express');
const crypto = require('crypto');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const { updateUserBalance } = require('../utils/socket');
const { logger } = require('../utils/secureLogger');
const { observability, analyticsClient } = require('../utils/supabase-admin-v2');
const { GIFT_CATALOG, getGiftById } = require('../utils/giftCatalog');
const { updateUserTier } = require('../utils/gifterTiers');
const {
  getNextPayoutDate,
  getAvailableBalance,
  createWithdrawalRequest,
  cancelWithdrawalRequest,
  PAYOUT_CONFIG
} = require('../utils/payout-scheduler');
const router = express.Router();

const TOKEN_VALUE = 0.05; // $0.05 per token
const MINIMUM_PAYOUT_TOKENS = 1000; // $50 equivalent
const PURCHASE_RATE_LIMIT = 5; // Max 5 purchases per minute
const TOKEN_PRICES = {
  500: 5.94,
  1000: 10.33,
  2000: 18.57,
  5000: 41.47,
  10000: 77.16,
  20000: 144.57,
  50000: 334.12,
  100000: 632.49
};

// Rate limiting for purchases
const purchaseLimiter = require('express-rate-limit')({
  windowMs: 60 * 1000, // 1 minute
  max: PURCHASE_RATE_LIMIT,
  message: {
    error: 'Too many purchase attempts. Please try again later.',
    timestamp: () => new Date().toISOString()
  },
  keyGenerator: (req) => req.user.supabase_id
});

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Tokens route working',
    tokenValue: TOKEN_VALUE,
    stripe: 'Connected',
    environment: {
      hasStripeKey: !!process.env.STRIPE_SECRET_KEY
    },
    timestamp: new Date().toISOString()
  });
});

// Get wallet data (alias for frontend compatibility)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id || req.user.id;
    
    // Get token balance from users table
    const balanceResult = await pool.query(
      `SELECT token_balance as balance
       FROM users
       WHERE supabase_id = $1`,
      [userId]
    );
    
    if (balanceResult.rows.length === 0) {
      return res.json({
        tokens: 0,
        balance: 0,
        total_purchased: 0,
        total_spent: 0,
        total_earned: 0
      });
    }
    
    const balance = balanceResult.rows[0];
    
    res.json({
      tokens: parseFloat(balance.balance || 0),
      balance: parseFloat(balance.balance || 0),
      total_balance: parseFloat(balance.balance || 0),
      total_purchased: parseFloat(balance.total_purchased || 0),
      total_spent: parseFloat(balance.total_spent || 0),
      total_earned: parseFloat(balance.total_earned || 0)
    });
    
  } catch (error) {
    logger.error('Error fetching wallet data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch wallet data',
      timestamp: new Date().toISOString()
    });
  }
});

// Get token balance
router.get('/balance', authenticateToken, async (req, res) => {
  try {
    const balanceResult = await pool.query(
      `SELECT token_balance as balance FROM users WHERE supabase_id = $1`,
      [req.user.supabase_id]
    );

    const balance = balanceResult.rows.length > 0 ? balanceResult.rows[0].balance : 0;
    const usdEstimate = balance * TOKEN_VALUE;

    res.json({
      success: true,
      balance: parseInt(balance),
      usdEstimate: parseFloat(usdEstimate.toFixed(2)),
      tokenValue: TOKEN_VALUE,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Token balance fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch token balance',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get available token packages
router.get('/packages', authenticateToken, async (req, res) => {
  try {
    const packages = Object.entries(TOKEN_PRICES).map(([tokens, price]) => ({
      tokens: parseInt(tokens),
      price: parseFloat(price),
      popular: parseInt(tokens) === 2000, // Mark 2000 tokens as popular
      bonus: parseInt(tokens) >= 5000 ? 0.05 : 0, // 5% bonus for large packages
      value: `$${(parseInt(tokens) * TOKEN_VALUE).toFixed(2)}` // Show actual value
    }));

    res.json({
      success: true,
      packages,
      tokenValue: TOKEN_VALUE,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching token packages:', error);
    res.status(500).json({
      error: 'Failed to fetch token packages',
      timestamp: new Date().toISOString()
    });
  }
});

// Get virtual gifts catalog
router.get('/catalog', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, emoji, cost, rarity FROM virtual_gifts WHERE is_active = TRUE ORDER BY cost ASC'
    );
    
    // If no gifts in database, return default catalog
    if (result.rows.length === 0) {
      const defaultGifts = [
        { id: 'heart', name: 'Heart', emoji: '❤️', cost: 5, rarity: 'common' },
        { id: 'thumbs-up', name: 'Thumbs Up', emoji: '👍', cost: 10, rarity: 'common' },
        { id: 'clap', name: 'Clap', emoji: '👏', cost: 15, rarity: 'common' },
        { id: 'fire', name: 'Fire', emoji: '🔥', cost: 20, rarity: 'common' },
        { id: 'star', name: 'Star', emoji: '⭐', cost: 25, rarity: 'common' },
        { id: 'cake', name: 'Cake', emoji: '🎂', cost: 30, rarity: 'common' },
        { id: 'diamond', name: 'Diamond', emoji: '💎', cost: 50, rarity: 'rare' },
        { id: 'ring', name: 'Ring', emoji: '💍', cost: 75, rarity: 'rare' },
        { id: 'crown', name: 'Crown', emoji: '👑', cost: 100, rarity: 'rare' },
        { id: 'gold-bar', name: 'Gold Bar', emoji: '🥇', cost: 150, rarity: 'rare' },
        { id: 'trophy', name: 'Trophy', emoji: '🏆', cost: 200, rarity: 'epic' },
        { id: 'rocket', name: 'Rocket', emoji: '🚀', cost: 250, rarity: 'epic' },
        { id: 'champagne', name: 'Champagne', emoji: '🍾', cost: 300, rarity: 'legendary' },
        { id: 'sports-car', name: 'Sports Car', emoji: '🏎️', cost: 500, rarity: 'legendary' },
        { id: 'yacht', name: 'Yacht', emoji: '🛥️', cost: 750, rarity: 'legendary' },
        { id: 'mansion', name: 'Mansion', emoji: '🏰', cost: 1000, rarity: 'legendary' },
        { id: 'private-jet', name: 'Private Jet', emoji: '✈️', cost: 1500, rarity: 'legendary' },
        { id: 'island', name: 'Private Island', emoji: '🏝️', cost: 2500, rarity: 'legendary' }
      ];
      return res.json(defaultGifts);
    }
    
    // Map 'mythic' rarity for frontend compatibility
    const gifts = result.rows.map(gift => ({
      ...gift,
      rarity: gift.cost > 1000 ? 'mythic' : gift.rarity
    }));
    
    res.json(gifts);
  } catch (error) {
    logger.error('❌ Gift catalog fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch gift catalog', 
      details: error.message 
    });
  }
});

// Quick purchase for small amounts
router.post('/quick-purchase', authenticateToken, async (req, res) => {
  const span = observability.createSpan('token_quick_purchase', {
    userId: req.user.supabase_id,
    tokenAmount: req.body.tokenAmount
  });
  
  const { tokenAmount, paymentMethodId } = req.body;

  if (!tokenAmount || !paymentMethodId) {
    span.addEvent('validation_failed', { reason: 'missing_fields' });
    span.end();
    return res.status(400).json({
      error: 'Missing required fields: tokenAmount, paymentMethodId',
      timestamp: new Date().toISOString()
    });
  }

  if (!Number.isInteger(tokenAmount) || tokenAmount < 1 || tokenAmount > 1000) {
    span.addEvent('validation_failed', { reason: 'invalid_amount' });
    span.end();
    return res.status(400).json({
      error: 'Quick purchase limited to 1-1000 tokens',
      timestamp: new Date().toISOString()
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Use retry for database query
    const userResult = await retry(() => client.query(
      'SELECT id FROM users WHERE supabase_id = $1',
      [req.user.supabase_id]
    ));

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    const amountUsd = tokenAmount * TOKEN_VALUE; // Direct calculation for quick purchases

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amountUsd * 100),
      currency: 'usd',
      payment_method: paymentMethodId,
      confirmation_method: 'manual',
      confirm: true,
      return_url: process.env.FRONTEND_URL || 'http://localhost:3000',
      description: `Quick purchase of ${tokenAmount} tokens`,
      metadata: {
        userId: req.user.supabase_id,
        tokenAmount,
        isQuickPurchase: true
      }
    });

    let status = paymentIntent.status === 'succeeded' ? 'completed' :
                 paymentIntent.status === 'requires_action' ? 'requires_action' :
                 paymentIntent.status === 'requires_payment_method' ? 'failed' : 'pending';

    const transactionResult = await client.query(
      `INSERT INTO token_transactions (user_id, type, tokens, amount_usd, stripe_payment_intent_id, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [req.user.supabase_id, 'quick_purchase', tokenAmount, amountUsd, paymentIntent.id, status]
    );

    if (status === 'completed') {
      const balanceResult = await client.query(
        `INSERT INTO token_balances (user_id, balance, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET balance = token_balances.balance + $2, updated_at = NOW()
         RETURNING balance`,
        [req.user.supabase_id, tokenAmount]
      );
      
      // Emit real-time balance update
      const newBalance = balanceResult.rows[0].balance;
      updateUserBalance(req.user.supabase_id, newBalance);
      
      // Track successful purchase
      span.addEvent('purchase_completed', { 
        tokens: tokenAmount, 
        amountUsd,
        newBalance 
      });
      
      // Track metrics
      observability.trackMetric('tokens_purchased', tokenAmount, 'count', {
        userId: req.user.supabase_id,
        purchaseType: 'quick'
      });
      
      observability.trackMetric('revenue', amountUsd, 'usd', {
        source: 'quick_purchase'
      });
      
      // Write to analytics bucket
      await analyticsClient.writeAnalytics(
        'payments',
        'purchases',
        'quick_purchases',
        {
          user_id: req.user.supabase_id,
          tokens: tokenAmount,
          amount_usd: amountUsd,
          payment_intent_id: paymentIntent.id,
          timestamp: new Date().toISOString()
        }
      );
    }

    await client.query('COMMIT');
    span.addEvent('transaction_committed');
    span.end();

    res.json({
      success: true,
      transaction: transactionResult.rows[0],
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        client_secret: paymentIntent.client_secret
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    
    span.addEvent('error', { message: error.message });
    span.end();
    
    observability.logEvent('error', 'Quick purchase failed', {
      error: error.message,
      userId: req.user.supabase_id,
      tokenAmount
    });
    
    logger.error('❌ Quick purchase error:', error);
    res.status(500).json({
      error: 'Failed to process quick purchase',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (client) client.release();
  }
});

// Purchase tokens
router.post('/purchase', authenticateToken, purchaseLimiter, async (req, res) => {
  const { tokenAmount, paymentMethodId } = req.body;

  if (!tokenAmount || !paymentMethodId) {
    return res.status(400).json({
      error: 'Missing required fields: tokenAmount, paymentMethodId',
      timestamp: new Date().toISOString()
    });
  }

  if (!TOKEN_PRICES[tokenAmount]) {
    return res.status(400).json({
      error: 'Invalid token amount',
      validAmounts: Object.keys(TOKEN_PRICES),
      timestamp: new Date().toISOString()
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Use retry for database query
    const userResult = await retry(() => client.query(
      'SELECT id FROM users WHERE supabase_id = $1',
      [req.user.supabase_id]
    ));

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    const amountUsd = TOKEN_PRICES[tokenAmount];
    const bonusTokens = tokenAmount >= 5000 ? Math.floor(tokenAmount * 0.05) : 0;
    const totalTokens = tokenAmount + bonusTokens;

    // Use retry for Stripe API call with idempotency key
    const paymentIntent = await retry(() => stripe.paymentIntents.create({
      amount: Math.round(amountUsd * 100),
      currency: 'usd',
      payment_method: paymentMethodId,
      confirmation_method: 'manual',
      confirm: true,
      return_url: process.env.FRONTEND_URL || 'http://localhost:3000',
      description: `Purchase of ${tokenAmount} tokens${bonusTokens ? ` + ${bonusTokens} bonus` : ''}`,
      metadata: {
        userId: req.user.supabase_id,
        tokenAmount,
        bonusTokens
      },
      idempotencyKey: crypto.randomBytes(16).toString('hex') // Add idempotency key
    }));

    let status = paymentIntent.status === 'succeeded' ? 'completed' :
                 paymentIntent.status === 'requires_action' ? 'requires_action' :
                 paymentIntent.status === 'requires_payment_method' ? 'failed' : 'pending';

    const transactionResult = await client.query(
      `INSERT INTO token_transactions (user_id, type, tokens, amount_usd, bonus_tokens, stripe_payment_intent_id, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [req.user.supabase_id, 'purchase', tokenAmount, amountUsd, bonusTokens, paymentIntent.id, status]
    );

    if (status === 'completed') {
      await client.query(
        `INSERT INTO token_balances (user_id, balance, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET balance = token_balances.balance + $2, updated_at = NOW()`,
        [req.user.supabase_id, totalTokens]
      );

      await client.query(
        `UPDATE users SET last_purchase_amount = $1, updated_at = NOW()
         WHERE supabase_id = $2`,
        [tokenAmount, req.user.supabase_id]
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      transaction: transactionResult.rows[0],
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        client_secret: paymentIntent.client_secret
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    logger.error('❌ Token purchase error:', error);
    res.status(500).json({
      error: 'Failed to process token purchase',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (client) client.release();
  }
});

// Send tip
router.post('/tip', authenticateToken, async (req, res) => {
  const { creatorId, tokenAmount, channel } = req.body;

  if (!creatorId || !tokenAmount || !channel) {
    return res.status(400).json({
      error: 'Missing required fields: creatorId, tokenAmount, channel',
      timestamp: new Date().toISOString()
    });
  }

  if (!Number.isInteger(tokenAmount) || tokenAmount < 1) {
    return res.status(400).json({
      error: 'Token amount must be a positive integer',
      timestamp: new Date().toISOString()
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const userResult = await client.query(
      `SELECT id, auto_refill_enabled, auto_refill_package, last_purchase_amount 
       FROM users WHERE supabase_id = $1`,
      [req.user.supabase_id]
    );

    const creatorResult = await client.query(
      `SELECT id FROM users WHERE supabase_id = $1 AND is_creator = TRUE`,
      [creatorId]
    );

    if (userResult.rows.length === 0 || creatorResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'User or creator not found',
        timestamp: new Date().toISOString()
      });
    }

    const balanceResult = await client.query(
      `SELECT balance FROM token_balances WHERE user_id = $1`,
      [req.user.supabase_id]
    );

    let balance = balanceResult.rows.length > 0 ? balanceResult.rows[0].balance : 0;

    if (balance < tokenAmount) {
      const autoRefillEnabled = userResult.rows[0].auto_refill_enabled;
      const autoRefillPackage = userResult.rows[0].auto_refill_package || userResult.rows[0].last_purchase_amount;

      if (autoRefillEnabled && autoRefillPackage && TOKEN_PRICES[autoRefillPackage]) {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(TOKEN_PRICES[autoRefillPackage] * 100),
          currency: 'usd',
          payment_method_types: ['card'],
          description: `Auto-refill of ${autoRefillPackage} tokens`,
          metadata: {
            userId: req.user.supabase_id,
            tokenAmount: autoRefillPackage,
            isAutoRefill: true
          }
        });

        if (paymentIntent.status === 'succeeded') {
          const bonusTokens = autoRefillPackage >= 5000 ? Math.floor(autoRefillPackage * 0.05) : 0;
          await client.query(
            `INSERT INTO token_balances (user_id, balance, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (user_id)
             DO UPDATE SET balance = token_balances.balance + $2, updated_at = NOW()`,
            [req.user.supabase_id, autoRefillPackage + bonusTokens]
          );

          await client.query(
            `INSERT INTO token_transactions (user_id, type, tokens, amount_usd, bonus_tokens, stripe_payment_intent_id, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
            [req.user.supabase_id, 'purchase', autoRefillPackage, TOKEN_PRICES[autoRefillPackage], bonusTokens, paymentIntent.id, 'completed']
          );

          balance += autoRefillPackage + bonusTokens;
        } else {
          await client.query('ROLLBACK');
          return res.status(402).json({
            error: 'Auto-refill payment failed',
            currentBalance: balance,
            requiredTokens: tokenAmount,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        await client.query('ROLLBACK');
        return res.status(402).json({
          error: 'Insufficient token balance',
          currentBalance: balance,
          requiredTokens: tokenAmount,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Update sender's balance
    const senderBalanceResult = await client.query(
      `UPDATE token_balances 
       SET balance = balance - $1, updated_at = NOW()
       WHERE user_id = $2
       RETURNING balance`,
      [tokenAmount, req.user.supabase_id]
    );

    // Update recipient's balance
    const recipientBalanceResult = await client.query(
      `INSERT INTO token_balances (user_id, balance, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET balance = token_balances.balance + $2, updated_at = NOW()
       RETURNING balance`,
      [creatorId, tokenAmount]
    );
    
    // Emit real-time balance updates
    const senderNewBalance = senderBalanceResult.rows[0].balance;
    const recipientNewBalance = recipientBalanceResult.rows[0].balance;
    updateUserBalance(req.user.supabase_id, senderNewBalance);
    updateUserBalance(creatorId, recipientNewBalance);

    const usdValue = tokenAmount * TOKEN_VALUE;

    await client.query(
      `INSERT INTO token_transactions (user_id, type, tokens, amount_usd, status, created_at, channel)
       VALUES ($1, 'tip', $2, $3, 'completed', NOW(), $4)`,
      [req.user.supabase_id, -tokenAmount, usdValue, channel]
    );

    await client.query(
      `INSERT INTO token_transactions (user_id, type, tokens, amount_usd, status, created_at, channel)
       VALUES ($1, 'tip', $2, $3, 'completed', NOW(), $4)`,
      [creatorId, tokenAmount, usdValue, channel]
    );

    await client.query(
      `UPDATE users SET total_earnings = total_earnings + $1, updated_at = NOW()
       WHERE supabase_id = $2`,
      [usdValue, creatorId]
    );

    // Record earnings for payout system
    await client.query(
      `INSERT INTO creator_earnings (creator_id, earning_type, source_id, tokens_earned, usd_value, description, fan_id)
       VALUES ($1, 'tip', $2, $3, $4, $5, $6)`,
      [creatorId, `tip_${Date.now()}`, tokenAmount, usdValue, `Tip received in ${channel}`, req.user.supabase_id]
    );

    await client.query('COMMIT');

    const message = {
      type: 'cmd',
      action: 'tip_notification',
      data: {
        senderId: req.user.supabase_id,
        creatorId,
        tokenAmount,
        usdValue,
        channel,
        timestamp: new Date().toISOString()
      }
    };

    res.json({
      success: true,
      tokensDeducted: tokenAmount,
      usdValue,
      creatorId,
      channel,
      message,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    logger.error('❌ Tip processing error:', error);
    res.status(500).json({
      error: 'Failed to process tip',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (client) client.release();
  }
});

// Process call deductions
router.post('/calls/deduct', authenticateToken, async (req, res) => {
  const { sessionId, tokenAmount } = req.body;

  if (!sessionId || !tokenAmount) {
    return res.status(400).json({
      error: 'Missing required fields: sessionId, tokenAmount',
      timestamp: new Date().toISOString()
    });
  }

  if (!Number.isInteger(tokenAmount) || tokenAmount < 1) {
    return res.status(400).json({
      error: 'Token amount must be a positive integer',
      timestamp: new Date().toISOString()
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const sessionResult = await client.query(
      `SELECT creator_id, fan_id FROM sessions WHERE id = $1 AND fan_id = (SELECT id FROM users WHERE supabase_id = $2)`,
      [sessionId, req.user.supabase_id]
    );

    if (sessionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Session not found or unauthorized',
        timestamp: new Date().toISOString()
      });
    }

    const creatorResult = await client.query(
      `SELECT supabase_id FROM users WHERE supabase_id = $1`,
      [sessionResult.rows[0].creator_id]
    );

    const balanceResult = await client.query(
      `SELECT balance FROM token_balances WHERE user_id = $1`,
      [req.user.supabase_id]
    );

    let balance = balanceResult.rows.length > 0 ? balanceResult.rows[0].balance : 0;

    if (balance < tokenAmount) {
      const userResult = await client.query(
        `SELECT auto_refill_enabled, auto_refill_package, last_purchase_amount 
         FROM users WHERE supabase_id = $1`,
        [req.user.supabase_id]
      );

      const autoRefillEnabled = userResult.rows[0].auto_refill_enabled;
      const autoRefillPackage = userResult.rows[0].auto_refill_package || userResult.rows[0].last_purchase_amount;

      if (autoRefillEnabled && autoRefillPackage && TOKEN_PRICES[autoRefillPackage]) {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(TOKEN_PRICES[autoRefillPackage] * 100),
          currency: 'usd',
          payment_method_types: ['card'],
          description: `Auto-refill of ${autoRefillPackage} tokens`,
          metadata: {
            userId: req.user.supabase_id,
            tokenAmount: autoRefillPackage,
            isAutoRefill: true
          }
        });

        if (paymentIntent.status === 'succeeded') {
          const bonusTokens = autoRefillPackage >= 5000 ? Math.floor(autoRefillPackage * 0.05) : 0;
          await client.query(
            `INSERT INTO token_balances (user_id, balance, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (user_id)
             DO UPDATE SET balance = token_balances.balance + $2, updated_at = NOW()`,
            [req.user.supabase_id, autoRefillPackage + bonusTokens]
          );

          await client.query(
            `INSERT INTO token_transactions (user_id, type, tokens, amount_usd, bonus_tokens, stripe_payment_intent_id, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
            [req.user.supabase_id, 'purchase', autoRefillPackage, TOKEN_PRICES[autoRefillPackage], bonusTokens, paymentIntent.id, 'completed']
          );

          balance += autoRefillPackage + bonusTokens;
        } else {
          await client.query('ROLLBACK');
          return res.status(402).json({
            error: 'Auto-refill payment failed',
            currentBalance: balance,
            requiredTokens: tokenAmount,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        await client.query('ROLLBACK');
        return res.status(402).json({
          error: 'Insufficient token balance',
          currentBalance: balance,
          requiredTokens: tokenAmount,
          timestamp: new Date().toISOString()
        });
      }
    }

    await client.query(
      `UPDATE token_balances 
       SET balance = balance - $1, updated_at = NOW()
       WHERE user_id = $2`,
      [tokenAmount, req.user.supabase_id]
    );

    await client.query(
      `INSERT INTO token_balances (user_id, balance, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET balance = token_balances.balance + $2, updated_at = NOW()`,
      [creatorResult.rows[0].supabase_id, tokenAmount]
    );

    const usdValue = tokenAmount * TOKEN_VALUE;

    await client.query(
      `INSERT INTO token_transactions (user_id, type, tokens, amount_usd, status, created_at)
       VALUES ($1, 'call', $2, $3, 'completed', NOW())`,
      [req.user.supabase_id, -tokenAmount, usdValue]
    );

    await client.query(
      `INSERT INTO token_transactions (user_id, type, tokens, amount_usd, status, created_at)
       VALUES ($1, 'call', $2, $3, 'completed', NOW())`,
      [creatorResult.rows[0].supabase_id, tokenAmount, usdValue]
    );

    await client.query(
      `UPDATE users SET total_earnings = total_earnings + $1, updated_at = NOW()
       WHERE supabase_id = $2`,
      [usdValue, creatorResult.rows[0].supabase_id]
    );

    await client.query('COMMIT');

    const message = {
      type: 'cmd',
      action: 'balance_update',
      data: {
        userId: req.user.supabase_id,
        balance: balance - tokenAmount,
        tokensDeducted: tokenAmount,
        sessionId,
        timestamp: new Date().toISOString()
      }
    };

    res.json({
      success: true,
      tokensDeducted: tokenAmount,
      usdValue,
      sessionId,
      message,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    logger.error('❌ Call deduction error:', error);
    res.status(error.status || 500).json({
      error: error.status === 402 ? 'Insufficient token balance' : 'Failed to process call deduction',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (client) client.release();
  }
});

// Get gift catalog
router.get('/catalog', authenticateToken, async (req, res) => {
  try {
    res.json(GIFT_CATALOG);
  } catch (error) {
    logger.error('Error fetching gift catalog:', error);
    res.status(500).json({ error: 'Failed to fetch gift catalog' });
  }
});

// Get transaction history
router.get('/transactions', authenticateToken, async (req, res) => {
  const { limit = 50, offset = 0 } = req.query;

  try {
    const result = await pool.query(
      `SELECT * FROM token_transactions 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [req.user.supabase_id, limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM token_transactions WHERE user_id = $1`,
      [req.user.supabase_id]
    );

    res.json({
      success: true,
      transactions: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Transaction history error:', error);
    res.status(500).json({
      error: 'Failed to fetch transaction history',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get analytics data
router.get('/analytics/:type', authenticateToken, async (req, res) => {
  const { type } = req.params;
  const { range = '30d' } = req.query;
  
  // Validate and sanitize input parameters
  const allowedRanges = ['7d', '30d', '90d'];
  const validRange = allowedRanges.includes(range) ? range : '30d';
  const days = validRange === '7d' ? 7 : validRange === '90d' ? 90 : 30;
  
  // Validate type parameter
  const allowedTypes = ['fan', 'creator'];
  if (!allowedTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid analytics type' });
  }
  
  try {
    // Use parameterized queries to prevent SQL injection
    const daily = await pool.query(
      `SELECT DATE(created_at) as date, SUM(tokens) as tokens, COUNT(*) as transactions
       FROM token_transactions WHERE user_id = $1 AND created_at >= NOW() - INTERVAL $2
       GROUP BY DATE(created_at) ORDER BY date DESC`,
      [req.user.supabase_id, `${days} days`]
    );
    
    const byType = await pool.query(
      `SELECT type, SUM(tokens) as tokens FROM token_transactions
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL $2
       GROUP BY type`,
      [req.user.supabase_id, `${days} days`]
    );
    
    const topCreators = type === 'fan' ? await pool.query(
      `SELECT u.supabase_id as name, SUM(t.tokens) as tokens
       FROM token_transactions t JOIN users u ON t.user_id = u.supabase_id
       WHERE t.user_id != $1 AND t.type IN ('tip', 'call') AND t.created_at >= NOW() - INTERVAL $2
       GROUP BY u.supabase_id ORDER BY tokens DESC LIMIT 5`,
      [req.user.supabase_id, `${days} days`]
    ) : [];
    res.json({
      daily: daily.rows,
      byType: byType.rows.reduce((acc, row) => ({ ...acc, [row.type]: row.tokens }), {}),
      topCreators: topCreators.rows,
      summary: {
        totalTokens: daily.rows.reduce((sum, row) => sum + parseInt(row.tokens), 0),
        totalUsd: daily.rows.reduce((sum, row) => sum + parseFloat(row.amount_usd || 0), 0),
        avgPerDay: daily.rows.length ? daily.rows.reduce((sum, row) => sum + parseInt(row.tokens), 0) / daily.rows.length : 0,
        transactions: daily.rows.reduce((sum, row) => sum + parseInt(row.transactions), 0),
      },
    });
  } catch (error) {
    logger.error('❌ Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics', details: error.message });
  }
});

// Smart Auto-refill with ML predictions
router.get('/analytics/predict-refill', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT id, auto_refill_enabled, auto_refill_package, last_purchase_amount FROM users WHERE supabase_id = $1',
      [req.user.supabase_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    // Enhanced spending analysis with multiple timeframes
    const spendingData = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        EXTRACT(HOUR FROM created_at) as hour,
        EXTRACT(DOW FROM created_at) as day_of_week,
        SUM(CASE WHEN tokens > 0 THEN tokens ELSE 0 END) as spent_tokens,
        SUM(CASE WHEN tokens < 0 THEN ABS(tokens) ELSE 0 END) as earned_tokens,
        COUNT(*) as transactions,
        type,
        channel
      FROM token_transactions 
      WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '60 days'
      GROUP BY DATE(created_at), EXTRACT(HOUR FROM created_at), EXTRACT(DOW FROM created_at), type, channel
      ORDER BY date DESC, hour DESC
    `, [req.user.supabase_id]);

    const currentBalance = await pool.query(
      'SELECT balance FROM token_balances WHERE user_id = $1',
      [req.user.supabase_id]
    );

    const balance = currentBalance.rows.length > 0 ? currentBalance.rows[0].balance : 0;

    // Get creator interaction patterns
    const creatorPatterns = await pool.query(`
      SELECT 
        channel,
        COUNT(*) as session_count,
        AVG(tokens) as avg_spend,
        MAX(created_at) as last_interaction
      FROM token_transactions 
      WHERE user_id = $1 
        AND type IN ('tip', 'call')
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY channel
      ORDER BY session_count DESC
      LIMIT 5
    `, [req.user.supabase_id]);

    if (spendingData.rows.length === 0) {
      return res.json({
        success: true,
        prediction: {
          daysUntilEmpty: null,
          recommendedRefill: 1000,
          confidence: 'low',
          triggers: [],
          riskLevel: 'low'
        },
        currentBalance: balance,
        timestamp: new Date().toISOString()
      });
    }

    // Advanced ML-like predictions
    const spentOnly = spendingData.rows.filter(row => row.spent_tokens > 0);
    const totalSpent = spentOnly.reduce((sum, day) => sum + parseInt(day.spent_tokens), 0);
    const avgDailySpending = totalSpent / Math.max(spentOnly.length, 1);
    
    // Pattern analysis
    const weekdaySpending = spentOnly.filter(row => row.day_of_week >= 1 && row.day_of_week <= 5);
    const weekendSpending = spentOnly.filter(row => row.day_of_week === 0 || row.day_of_week === 6);
    const peakHours = spentOnly.filter(row => row.hour >= 18 && row.hour <= 23);
    
    const weekdayAvg = weekdaySpending.reduce((sum, day) => sum + parseInt(day.spent_tokens), 0) / Math.max(weekdaySpending.length, 1);
    const weekendAvg = weekendSpending.reduce((sum, day) => sum + parseInt(day.spent_tokens), 0) / Math.max(weekendSpending.length, 1);
    const peakHourAvg = peakHours.reduce((sum, day) => sum + parseInt(day.spent_tokens), 0) / Math.max(peakHours.length, 1);

    // Seasonal trends (simplified)
    const recentSpending = spentOnly.slice(0, 7).reduce((sum, day) => sum + parseInt(day.spent_tokens), 0) / 7;
    const trend = recentSpending > avgDailySpending ? 'increasing' : 'decreasing';
    const trendMultiplier = trend === 'increasing' ? 1.3 : 0.8;

    // Smart predictions
    const predictedDailySpending = avgDailySpending * trendMultiplier;
    const daysUntilEmpty = predictedDailySpending > 0 ? Math.floor(balance / predictedDailySpending) : null;

    // Dynamic refill recommendations
    const weeklySpending = predictedDailySpending * 7;
    let recommendedRefill = 1000;
    let urgency = 'low';

    if (weeklySpending > 10000) {
      recommendedRefill = 20000;
      urgency = 'high';
    } else if (weeklySpending > 5000) {
      recommendedRefill = 10000;
      urgency = 'medium';
    } else if (weeklySpending > 2000) {
      recommendedRefill = 5000;
      urgency = 'medium';
    } else if (weeklySpending > 1000) {
      recommendedRefill = 2000;
      urgency = 'low';
    } else if (weeklySpending > 500) {
      recommendedRefill = 1000;
      urgency = 'low';
    } else {
      recommendedRefill = 500;
      urgency = 'low';
    }

    // Smart triggers
    const triggers = [];
    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay();

    // Low balance trigger
    if (balance < predictedDailySpending * 2) {
      triggers.push({
        type: 'low_balance',
        message: 'Balance running low for your spending pattern',
        severity: 'high',
        recommendedAction: `Refill ${recommendedRefill} tokens`
      });
    }

    // Peak hour trigger
    if (currentHour >= 18 && currentHour <= 23 && balance < peakHourAvg * 1.5) {
      triggers.push({
        type: 'peak_hour',
        message: 'Peak engagement hours ahead - low balance detected',
        severity: 'medium',
        recommendedAction: 'Quick refill recommended'
      });
    }

    // Weekend trigger
    if ((currentDay === 5 || currentDay === 6) && balance < weekendAvg * 2) {
      triggers.push({
        type: 'weekend_prep',
        message: 'Weekend approaching - ensure adequate balance',
        severity: 'medium',
        recommendedAction: `Prepare with ${Math.ceil(weekendAvg * 3)} tokens`
      });
    }

    // Favorite creator trigger
    const favoriteCreator = creatorPatterns.rows[0];
    if (favoriteCreator && balance < favoriteCreator.avg_spend * 2) {
      triggers.push({
        type: 'favorite_creator',
        message: `Low balance for sessions with ${favoriteCreator.channel}`,
        severity: 'medium',
        recommendedAction: 'Refill for upcoming sessions'
      });
    }

    // Risk assessment
    let riskLevel = 'low';
    if (daysUntilEmpty <= 1) riskLevel = 'critical';
    else if (daysUntilEmpty <= 3) riskLevel = 'high';
    else if (daysUntilEmpty <= 7) riskLevel = 'medium';

    // Confidence calculation
    const variance = spentOnly.reduce((sum, day) => {
      const diff = parseInt(day.spent_tokens) - avgDailySpending;
      return sum + (diff * diff);
    }, 0) / spentOnly.length;
    
    const confidence = variance < avgDailySpending ? 'high' : 
                      variance < avgDailySpending * 2 ? 'medium' : 'low';

    res.json({
      success: true,
      prediction: {
        daysUntilEmpty,
        avgDailySpending: Math.round(predictedDailySpending),
        recommendedRefill,
        confidence,
        weeklySpending: Math.round(weeklySpending),
        trend,
        urgency,
        triggers,
        riskLevel
      },
      patterns: {
        weekdayAvg: Math.round(weekdayAvg),
        weekendAvg: Math.round(weekendAvg),
        peakHourAvg: Math.round(peakHourAvg),
        favoriteCreators: creatorPatterns.rows
      },
      currentBalance: balance,
      spendingHistory: spentOnly.slice(0, 30).map(row => ({
        date: row.date,
        tokens: parseInt(row.spent_tokens),
        transactions: parseInt(row.transactions),
        hour: parseInt(row.hour),
        dayOfWeek: parseInt(row.day_of_week)
      })),
      autoRefillSettings: {
        enabled: userResult.rows[0].auto_refill_enabled,
        package: userResult.rows[0].auto_refill_package,
        lastPurchase: userResult.rows[0].last_purchase_amount
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Smart refill prediction error:', error);
    res.status(500).json({
      error: 'Failed to generate smart refill prediction',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get creator earnings summary (bi-monthly payout system)
router.get('/earnings', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT is_creator FROM users WHERE supabase_id = $1',
      [req.user.supabase_id]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].is_creator) {
      return res.status(403).json({
        error: 'Only creators can view earnings',
        timestamp: new Date().toISOString()
      });
    }

    // Get earnings summary using database function
    const summaryResult = await pool.query(
      'SELECT * FROM get_creator_earnings_summary($1)',
      [req.user.supabase_id]
    );

    const summary = summaryResult.rows[0];
    const nextPayoutDate = getNextPayoutDate();

    res.json({
      success: true,
      earnings: {
        totalEarned: parseInt(summary.total_earned || 0),
        totalPaidOut: parseInt(summary.total_paid_out || 0),
        availableBalance: parseInt(summary.available_balance || 0),
        bufferedEarnings: parseInt(summary.buffered_earnings || 0),
        pendingWithdrawals: parseInt(summary.pending_withdrawals || 0)
      },
      payoutSchedule: {
        nextPayoutDate: nextPayoutDate.toISOString().split('T')[0],
        lastPayoutDate: summary.last_payout_date,
        payoutDays: PAYOUT_CONFIG.PAYOUT_DAYS,
        minimumWithdrawal: PAYOUT_CONFIG.MIN_PAYOUT_AMOUNT,
        chargebackBuffer: `${PAYOUT_CONFIG.CHARGEBACK_BUFFER_DAYS} days`
      },
      usdValues: {
        availableUsd: parseFloat((summary.available_balance * TOKEN_VALUE).toFixed(2)),
        bufferedUsd: parseFloat((summary.buffered_earnings * TOKEN_VALUE).toFixed(2)),
        pendingUsd: parseFloat((summary.pending_withdrawals * TOKEN_VALUE).toFixed(2))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Earnings summary error:', error);
    res.status(500).json({
      error: 'Failed to fetch earnings summary',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Request withdrawal (bi-monthly payout system)
router.post('/request-withdrawal', authenticateToken, async (req, res) => {
  const { tokenAmount, metadata = {} } = req.body;

  if (!Number.isInteger(tokenAmount) || tokenAmount < PAYOUT_CONFIG.MIN_PAYOUT_AMOUNT) {
    return res.status(400).json({
      error: `Minimum withdrawal is ${PAYOUT_CONFIG.MIN_PAYOUT_AMOUNT} tokens ($${PAYOUT_CONFIG.MIN_PAYOUT_AMOUNT * TOKEN_VALUE})`,
      timestamp: new Date().toISOString()
    });
  }

  try {
    const result = await createWithdrawalRequest(req.user.supabase_id, tokenAmount, metadata);

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        details: result.details,
        timestamp: new Date().toISOString()
      });
    }

    logger.info(`✅ Withdrawal request created: ${req.user.supabase_id}, ${tokenAmount} tokens`);

    res.json({
      success: true,
      request: {
        id: result.request.id,
        amount: result.request.amount,
        amountUsd: result.request.amount_usd,
        payoutDate: result.payoutDate,
        status: result.request.status
      },
      message: result.message,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Withdrawal request error:', error);
    res.status(500).json({
      error: 'Failed to create withdrawal request',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get withdrawal requests
router.get('/withdrawal-requests', authenticateToken, async (req, res) => {
  const { status = 'all', limit = 50, offset = 0 } = req.query;

  try {
    const userResult = await pool.query(
      'SELECT is_creator FROM users WHERE supabase_id = $1',
      [req.user.supabase_id]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].is_creator) {
      return res.status(403).json({
        error: 'Only creators can view withdrawal requests',
        timestamp: new Date().toISOString()
      });
    }

    let query = `
      SELECT * FROM withdrawal_requests
      WHERE creator_id = $1
    `;
    const params = [req.user.supabase_id];

    if (status !== 'all') {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      requests: result.rows.map(row => ({
        id: row.id,
        amount: parseInt(row.amount),
        amountUsd: parseFloat(row.amount_usd),
        payoutDate: row.payout_date,
        status: row.status,
        createdAt: row.created_at,
        processedAt: row.processed_at,
        stripeTransferId: row.stripe_transfer_id,
        errorMessage: row.error_message
      })),
      total: result.rows.length,
      limit: parseInt(limit),
      offset: parseInt(offset),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Withdrawal requests fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch withdrawal requests',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Cancel withdrawal request (only before payout date)
router.delete('/withdrawal-requests/:requestId', authenticateToken, async (req, res) => {
  const { requestId } = req.params;

  try {
    const result = await cancelWithdrawalRequest(parseInt(requestId), req.user.supabase_id);

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }

    logger.info(`Withdrawal request cancelled: ${requestId} by ${req.user.supabase_id}`);

    res.json({
      success: true,
      request: {
        id: result.request.id,
        status: result.request.status,
        amount: result.request.amount,
        cancelledAt: result.request.updated_at
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Withdrawal cancellation error:', error);
    res.status(500).json({
      error: 'Failed to cancel withdrawal request',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Legacy payout endpoint (deprecated - kept for backward compatibility)
router.post('/payout', authenticateToken, async (req, res) => {
  const { tokenAmount } = req.body;

  logger.warn('⚠️ Legacy /payout endpoint called - use /request-withdrawal instead');

  if (!Number.isInteger(tokenAmount) || tokenAmount < MINIMUM_PAYOUT_TOKENS) {
    return res.status(400).json({
      error: `Token amount must be at least ${MINIMUM_PAYOUT_TOKENS} tokens ($50)`,
      timestamp: new Date().toISOString()
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const userResult = await client.query(
      `SELECT id, is_creator FROM users WHERE supabase_id = $1`,
      [req.user.supabase_id]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].is_creator) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: 'Only creators can request payouts',
        timestamp: new Date().toISOString()
      });
    }

    const balanceResult = await pool.query(
      `SELECT balance FROM token_balances WHERE user_id = $1`,
      [req.user.supabase_id]
    );

    const balance = balanceResult.rows.length > 0 ? balanceResult.rows[0].balance : 0;

    if (balance < tokenAmount) {
      await client.query('ROLLBACK');
      return res.status(402).json({
        error: 'Insufficient token balance for payout',
        currentBalance: balance,
        requestedTokens: tokenAmount,
        timestamp: new Date().toISOString()
      });
    }

    const payoutAmount = tokenAmount * TOKEN_VALUE;

    const payout = await stripe.payouts.create({
      amount: Math.round(payoutAmount * 100),
      currency: 'usd',
      description: `Payout for ${tokenAmount} tokens to creator ${req.user.supabase_id}`,
      metadata: {
        creatorId: req.user.supabase_id,
        tokenAmount
      }
    });

    await client.query(
      `UPDATE token_balances
       SET balance = balance - $1, updated_at = NOW()
       WHERE user_id = $2`,
      [tokenAmount, req.user.supabase_id]
    );

    await client.query(
      `INSERT INTO payouts (creator_id, tokens_redeemed, payout_amount, status, stripe_payout_id, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [req.user.supabase_id, tokenAmount, payoutAmount, 'pending', payout.id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      payout: {
        id: payout.id,
        amount: payoutAmount,
        tokens: tokenAmount,
        status: payout.status
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    logger.error('❌ Payout error:', error);
    res.status(500).json({
      error: 'Failed to process payout',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (client) client.release();
  }
});

// Get payout history
router.get('/payout/history', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      `SELECT id, is_creator FROM users WHERE supabase_id = $1`,
      [req.user.supabase_id]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].is_creator) {
      return res.status(403).json({
        error: 'Only creators can view payout history',
        timestamp: new Date().toISOString()
      });
    }

    const payoutResult = await pool.query(
      `SELECT * FROM payouts WHERE creator_id = $1 ORDER BY created_at DESC`,
      [req.user.supabase_id]
    );

    res.json({
      success: true,
      payouts: payoutResult.rows,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Payout history error:', error);
    res.status(500).json({
      error: 'Failed to fetch payout history',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Update smart auto-refill settings
router.patch('/settings/auto-refill', authenticateToken, async (req, res) => {
  const { 
    autoRefillEnabled, 
    autoRefillPackage, 
    smartRefillEnabled = false,
    refillThreshold = 100,
    peakHourRefill = false,
    weekendRefill = false,
    favoriteCreatorRefill = false
  } = req.body;

  if (autoRefillEnabled === undefined) {
    return res.status(400).json({
      error: 'Missing required field: autoRefillEnabled',
      timestamp: new Date().toISOString()
    });
  }

  if (autoRefillPackage && !TOKEN_PRICES[autoRefillPackage]) {
    return res.status(400).json({
      error: 'Invalid auto-refill package',
      validPackages: Object.keys(TOKEN_PRICES),
      timestamp: new Date().toISOString()
    });
  }

  try {
    const result = await pool.query(
      `UPDATE users SET 
         auto_refill_enabled = $1, 
         auto_refill_package = $2,
         smart_refill_enabled = $3,
         refill_threshold = $4,
         peak_hour_refill = $5,
         weekend_refill = $6,
         favorite_creator_refill = $7,
         updated_at = NOW()
       WHERE supabase_id = $8
       RETURNING auto_refill_enabled, auto_refill_package, smart_refill_enabled, 
                 refill_threshold, peak_hour_refill, weekend_refill, favorite_creator_refill`,
      [autoRefillEnabled, autoRefillPackage || 0, smartRefillEnabled, refillThreshold, 
       peakHourRefill, weekendRefill, favoriteCreatorRefill, req.user.supabase_id]
    );

    res.json({
      success: true,
      settings: result.rows[0],
      message: smartRefillEnabled ? 'Smart auto-refill enabled with intelligent triggers' : 'Auto-refill settings updated',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Smart auto-refill settings update error:', error);
    res.status(500).json({
      error: 'Failed to update auto-refill settings',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Smart auto-refill trigger endpoint
router.post('/smart-refill/trigger', authenticateToken, async (req, res) => {
  const { triggerType, sessionId } = req.body;

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Get user settings and current balance
    const userResult = await client.query(
      `SELECT id, auto_refill_enabled, smart_refill_enabled, auto_refill_package, 
              last_purchase_amount, refill_threshold, peak_hour_refill, 
              weekend_refill, favorite_creator_refill 
       FROM users WHERE supabase_id = $1`,
      [req.user.supabase_id]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    const user = userResult.rows[0];

    if (!user.auto_refill_enabled || !user.smart_refill_enabled) {
      await client.query('ROLLBACK');
      return res.json({
        success: false,
        message: 'Smart auto-refill not enabled',
        timestamp: new Date().toISOString()
      });
    }

    const balanceResult = await client.query(
      `SELECT balance FROM token_balances WHERE user_id = $1`,
      [req.user.supabase_id]
    );

    const currentBalance = balanceResult.rows.length > 0 ? balanceResult.rows[0].balance : 0;

    // Get smart predictions
    const predictionResponse = await fetch(
      `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/tokens/analytics/predict-refill`,
      {
        headers: {
          'Authorization': req.headers.authorization
        }
      }
    );

    let shouldRefill = false;
    let refillAmount = user.auto_refill_package || user.last_purchase_amount || 1000;
    let reason = '';

    if (predictionResponse.ok) {
      const prediction = await predictionResponse.json();
      
      // Check various trigger conditions
      switch (triggerType) {
        case 'low_balance':
          shouldRefill = currentBalance < user.refill_threshold;
          reason = 'Balance below threshold';
          break;
          
        case 'peak_hour':
          if (user.peak_hour_refill) {
            const currentHour = new Date().getHours();
            shouldRefill = (currentHour >= 18 && currentHour <= 23) && 
                          currentBalance < (prediction.patterns?.peakHourAvg || 100) * 1.5;
            reason = 'Peak hours with low balance';
          }
          break;
          
        case 'weekend_prep':
          if (user.weekend_refill) {
            const currentDay = new Date().getDay();
            shouldRefill = (currentDay === 5 || currentDay === 6) && 
                          currentBalance < (prediction.patterns?.weekendAvg || 100) * 2;
            reason = 'Weekend preparation';
          }
          break;
          
        case 'favorite_creator':
          if (user.favorite_creator_refill && prediction.patterns?.favoriteCreators?.length > 0) {
            const favoriteAvg = prediction.patterns.favoriteCreators[0].avg_spend;
            shouldRefill = currentBalance < favoriteAvg * 2;
            reason = 'Favorite creator session preparation';
          }
          break;
          
        case 'smart_prediction':
          shouldRefill = prediction.prediction?.riskLevel === 'high' || 
                        prediction.prediction?.riskLevel === 'critical';
          refillAmount = prediction.prediction?.recommendedRefill || refillAmount;
          reason = 'Smart prediction triggered';
          break;
      }
    } else {
      // Fallback to simple threshold check
      shouldRefill = currentBalance < user.refill_threshold;
      reason = 'Threshold-based refill';
    }

    if (!shouldRefill) {
      await client.query('ROLLBACK');
      return res.json({
        success: false,
        message: 'Refill conditions not met',
        currentBalance,
        triggerType,
        timestamp: new Date().toISOString()
      });
    }

    // Execute smart refill
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(TOKEN_PRICES[refillAmount] * 100),
      currency: 'usd',
      payment_method_types: ['card'],
      description: `Smart auto-refill: ${refillAmount} tokens (${reason})`,
      metadata: {
        userId: req.user.supabase_id,
        tokenAmount: refillAmount,
        isSmartRefill: true,
        triggerType,
        reason
      }
    });

    if (paymentIntent.status === 'succeeded') {
      const bonusTokens = refillAmount >= 5000 ? Math.floor(refillAmount * 0.05) : 0;
      const totalTokens = refillAmount + bonusTokens;

      // Add tokens to balance
      await client.query(
        `INSERT INTO token_balances (user_id, balance, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET balance = token_balances.balance + $2, updated_at = NOW()`,
        [req.user.supabase_id, totalTokens]
      );

      // Record transaction
      await client.query(
        `INSERT INTO token_transactions (user_id, type, tokens, amount_usd, bonus_tokens, 
         stripe_payment_intent_id, status, smart_refill_trigger, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [req.user.supabase_id, 'smart_refill', refillAmount, TOKEN_PRICES[refillAmount], 
         bonusTokens, paymentIntent.id, 'completed', triggerType]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        refillExecuted: true,
        tokensAdded: totalTokens,
        newBalance: currentBalance + totalTokens,
        reason,
        triggerType,
        paymentIntentId: paymentIntent.id,
        timestamp: new Date().toISOString()
      });
    } else {
      await client.query('ROLLBACK');
      res.status(402).json({
        error: 'Smart refill payment failed',
        paymentStatus: paymentIntent.status,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    logger.error('❌ Smart refill trigger error:', error);
    res.status(500).json({
      error: 'Failed to execute smart refill',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (client) client.release();
  }
});

// Token gifting system
router.post('/gift', authenticateToken, async (req, res) => {
  const { 
    recipientId, 
    tokenAmount, 
    message = '', 
    giftType = 'standard',
    giftId,
    giftName,
    giftEmoji,
    channel 
  } = req.body;

  if (!recipientId || !tokenAmount) {
    return res.status(400).json({
      error: 'Missing required fields: recipientId, tokenAmount',
      timestamp: new Date().toISOString()
    });
  }

  if (!Number.isInteger(tokenAmount) || tokenAmount < 1) {
    return res.status(400).json({
      error: 'Token amount must be a positive integer',
      timestamp: new Date().toISOString()
    });
  }

  if (tokenAmount > 10000) {
    return res.status(400).json({
      error: 'Maximum gift amount is 10,000 tokens',
      timestamp: new Date().toISOString()
    });
  }

  if (recipientId === req.user.supabase_id) {
    return res.status(400).json({
      error: 'Cannot gift tokens to yourself',
      timestamp: new Date().toISOString()
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Verify sender and recipient exist
    const senderResult = await client.query(
      'SELECT id, display_name FROM users WHERE supabase_id = $1',
      [req.user.supabase_id]
    );

    const recipientResult = await client.query(
      'SELECT id, display_name, gift_notifications FROM users WHERE supabase_id = $1',
      [recipientId]
    );

    if (senderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Sender not found',
        timestamp: new Date().toISOString()
      });
    }

    if (recipientResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Recipient not found',
        timestamp: new Date().toISOString()
      });
    }

    // Check sender's balance
    const balanceResult = await client.query(
      'SELECT balance FROM token_balances WHERE user_id = $1',
      [req.user.supabase_id]
    );

    const senderBalance = balanceResult.rows.length > 0 ? balanceResult.rows[0].balance : 0;

    if (senderBalance < tokenAmount) {
      await client.query('ROLLBACK');
      return res.status(402).json({
        error: 'Insufficient token balance',
        currentBalance: senderBalance,
        requiredTokens: tokenAmount,
        timestamp: new Date().toISOString()
      });
    }

    // No platform fee - creators get 100%
    const platformFee = 0;
    const netTokens = tokenAmount;

    // Deduct tokens from sender
    await client.query(
      `UPDATE token_balances 
       SET balance = balance - $1, updated_at = NOW()
       WHERE user_id = $2`,
      [tokenAmount, req.user.supabase_id]
    );

    // Add tokens to recipient
    await client.query(
      `INSERT INTO token_balances (user_id, balance, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET balance = token_balances.balance + $2, updated_at = NOW()`,
      [recipientId, netTokens]
    );

    // Record gift transaction
    const transactionId = crypto.randomUUID();
    
    // Store gift metadata in JSON format
    const giftMetadata = {
      giftId: giftId || null,
      giftName: giftName || null,
      giftEmoji: giftEmoji || null,
      giftType: giftType,
      channel: channel || null
    };
    
    await client.query(
      `INSERT INTO token_gifts (id, sender_id, recipient_id, token_amount, net_tokens, 
       platform_fee, message, gift_type, status, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed', $9, NOW())
       RETURNING *`,
      [transactionId, req.user.supabase_id, recipientId, tokenAmount, netTokens, platformFee, message, giftType, JSON.stringify(giftMetadata)]
    );

    // Record transactions for both users
    await client.query(
      `INSERT INTO token_transactions (user_id, type, tokens, amount_usd, status, gift_id, metadata, created_at)
       VALUES ($1, 'gift_sent', $2, $3, 'completed', $4, $5, NOW())`,
      [req.user.supabase_id, -tokenAmount, tokenAmount * TOKEN_VALUE, transactionId, JSON.stringify(giftMetadata)]
    );

    await client.query(
      `INSERT INTO token_transactions (user_id, type, tokens, amount_usd, status, gift_id, metadata, created_at)
       VALUES ($1, 'gift_received', $2, $3, 'completed', $4, $5, NOW())`,
      [recipientId, netTokens, netTokens * TOKEN_VALUE, transactionId, JSON.stringify(giftMetadata)]
    );

    await client.query('COMMIT');

    // Send notification if enabled
    if (recipientResult.rows[0].gift_notifications) {
      // This would integrate with your notification system
      logger.info(`🎁 Gift notification: ${senderResult.rows[0].display_name} sent ${tokenAmount} tokens to ${recipientResult.rows[0].display_name}`);
    }

    res.json({
      success: true,
      giftId: transactionId,
      tokensGifted: tokenAmount,
      netTokensReceived: netTokens,
      platformFee,
      recipient: {
        id: recipientId,
        name: recipientResult.rows[0].display_name
      },
      giftMetadata: {
        giftId: giftId,
        giftName: giftName,
        giftEmoji: giftEmoji,
        giftType: giftType,
        channel: channel
      },
      message,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    logger.error('❌ Token gift error:', error);
    res.status(500).json({
      error: 'Failed to process token gift',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (client) client.release();
  }
});

// Get gift history
router.get('/gifts', authenticateToken, async (req, res) => {
  const { type = 'all', limit = 50, offset = 0 } = req.query;

  try {
    let query = `
      SELECT 
        g.*,
        s.display_name as sender_name,
        r.display_name as recipient_name
      FROM token_gifts g
      LEFT JOIN users s ON g.sender_id = s.supabase_id
      LEFT JOIN users r ON g.recipient_id = r.supabase_id
      WHERE (g.sender_id = $1 OR g.recipient_id = $1)
    `;

    const params = [req.user.supabase_id];

    if (type === 'sent') {
      query += ' AND g.sender_id = $1';
    } else if (type === 'received') {
      query += ' AND g.recipient_id = $1';
    }

    query += ' ORDER BY g.created_at DESC LIMIT $2 OFFSET $3';
    params.push(limit, offset);

    const result = await pool.query(query, params);

    const gifts = result.rows.map(row => ({
      id: row.id,
      senderName: row.sender_name,
      recipientName: row.recipient_name,
      tokenAmount: row.token_amount,
      netTokens: row.net_tokens,
      platformFee: row.platform_fee,
      message: row.message,
      giftType: row.gift_type,
      status: row.status,
      createdAt: row.created_at,
      isSent: row.sender_id === req.user.supabase_id,
      isReceived: row.recipient_id === req.user.supabase_id
    }));

    res.json({
      success: true,
      gifts,
      total: gifts.length,
      limit: parseInt(limit),
      offset: parseInt(offset),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ Gift history error:', error);
    res.status(500).json({
      error: 'Failed to fetch gift history',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Create gift card (prepaid gift)
router.post('/gift-card', authenticateToken, async (req, res) => {
  const { tokenAmount, message = '', expiresInDays = 30 } = req.body;

  if (!tokenAmount || !Number.isInteger(tokenAmount) || tokenAmount < 1) {
    return res.status(400).json({
      error: 'Invalid token amount',
      timestamp: new Date().toISOString()
    });
  }

  if (tokenAmount > 50000) {
    return res.status(400).json({
      error: 'Maximum gift card amount is 50,000 tokens',
      timestamp: new Date().toISOString()
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Check sender's balance
    const balanceResult = await client.query(
      'SELECT balance FROM token_balances WHERE user_id = $1',
      [req.user.supabase_id]
    );

    const senderBalance = balanceResult.rows.length > 0 ? balanceResult.rows[0].balance : 0;

    if (senderBalance < tokenAmount) {
      await client.query('ROLLBACK');
      return res.status(402).json({
        error: 'Insufficient token balance',
        currentBalance: senderBalance,
        requiredTokens: tokenAmount,
        timestamp: new Date().toISOString()
      });
    }

    // Generate unique gift card code
    const giftCardCode = crypto.randomBytes(8).toString('hex').toUpperCase();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Deduct tokens from sender
    await client.query(
      `UPDATE token_balances 
       SET balance = balance - $1, updated_at = NOW()
       WHERE user_id = $2`,
      [tokenAmount, req.user.supabase_id]
    );

    // Create gift card
    await client.query(
      `INSERT INTO gift_cards (code, creator_id, token_amount, message, expires_at, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'active', NOW())
       RETURNING *`,
      [giftCardCode, req.user.supabase_id, tokenAmount, message, expiresAt]
    );

    // Record transaction
    await client.query(
      `INSERT INTO token_transactions (user_id, type, tokens, amount_usd, status, gift_card_code, created_at)
       VALUES ($1, 'gift_card_created', $2, $3, 'completed', $4, NOW())`,
      [req.user.supabase_id, -tokenAmount, tokenAmount * TOKEN_VALUE, giftCardCode]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      giftCardCode,
      tokenAmount,
      message,
      expiresAt,
      redeemUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/redeem/${giftCardCode}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    logger.error('❌ Gift card creation error:', error);
    res.status(500).json({
      error: 'Failed to create gift card',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (client) client.release();
  }
});

// Redeem gift card
router.post('/redeem-gift-card', authenticateToken, async (req, res) => {
  const { giftCardCode } = req.body;

  if (!giftCardCode) {
    return res.status(400).json({
      error: 'Missing gift card code',
      timestamp: new Date().toISOString()
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Find and validate gift card
    const giftCardResult = await client.query(
      `SELECT * FROM gift_cards 
       WHERE code = $1 AND status = 'active' AND expires_at > NOW()`,
      [giftCardCode.toUpperCase()]
    );

    if (giftCardResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Invalid or expired gift card code',
        timestamp: new Date().toISOString()
      });
    }

    const giftCard = giftCardResult.rows[0];

    if (giftCard.creator_id === req.user.supabase_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Cannot redeem your own gift card',
        timestamp: new Date().toISOString()
      });
    }

    // Add tokens to user's balance
    await client.query(
      `INSERT INTO token_balances (user_id, balance, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET balance = token_balances.balance + $2, updated_at = NOW()`,
      [req.user.supabase_id, giftCard.token_amount]
    );

    // Mark gift card as redeemed
    await client.query(
      `UPDATE gift_cards 
       SET status = 'redeemed', redeemed_by = $1, redeemed_at = NOW()
       WHERE code = $2`,
      [req.user.supabase_id, giftCardCode.toUpperCase()]
    );

    // Record transaction
    await client.query(
      `INSERT INTO token_transactions (user_id, type, tokens, amount_usd, status, gift_card_code, created_at)
       VALUES ($1, 'gift_card_redeemed', $2, $3, 'completed', $4, NOW())`,
      [req.user.supabase_id, giftCard.token_amount, giftCard.token_amount * TOKEN_VALUE, giftCardCode]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      tokensReceived: giftCard.token_amount,
      message: giftCard.message,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    logger.error('❌ Gift card redemption error:', error);
    res.status(500).json({
      error: 'Failed to redeem gift card',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (client) client.release();
  }
});

// Savings account feature has been removed for simplicity
// All tokens are now in a single balance that can be used for any purchase

module.exports = router;