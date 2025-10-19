const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../utils/db');

// Token to USD conversion rate
const TOKEN_RATE = 0.05;

// Default subscription price if not set (500 tokens)
const DEFAULT_PRICE = 500;

// Minimum subscription price (100 tokens)
const MIN_PRICE = 100;

// Get creator's subscription tiers (main route)
router.get('/creator/:creatorId', authenticateToken, async (req, res) => {
  try {
    const { creatorId } = req.params;

    // Get pricing for creator from users table
    const pricingResult = await db.query(
      `SELECT
        subscription_price,
        text_message_price as message_price,
        video_message_price as video_call_price,
        audio_message_price as voice_call_price
       FROM users
       WHERE supabase_id = $1 OR id = $1`,
      [creatorId]
    );

    if (pricingResult.rows.length === 0) {
      return res.json({
        subscription: {
          price: DEFAULT_PRICE,
          usd: DEFAULT_PRICE * TOKEN_RATE,
          isDefault: true
        },
        message: {
          price: 10,
          usd: 10 * TOKEN_RATE
        },
        videoCall: {
          price: 100,
          usd: 100 * TOKEN_RATE
        },
        voiceCall: {
          price: 50,
          usd: 50 * TOKEN_RATE
        }
      });
    }

    const creator = pricingResult.rows[0];
    res.json({
      subscription: {
        price: creator.subscription_price || DEFAULT_PRICE,
        usd: (creator.subscription_price || DEFAULT_PRICE) * TOKEN_RATE,
        isDefault: false
      },
      message: {
        price: creator.message_price || 10,
        usd: (creator.message_price || 10) * TOKEN_RATE
      },
      videoCall: {
        price: creator.video_call_price || 100,
        usd: (creator.video_call_price || 100) * TOKEN_RATE
      },
      voiceCall: {
        price: creator.voice_call_price || 50,
        usd: (creator.voice_call_price || 50) * TOKEN_RATE
      }
    });
  } catch (error) {
    console.error('Error fetching subscription tiers:', error);
    res.status(500).json({ error: 'Failed to fetch subscription tiers' });
  }
});

// Get creator's subscription price
router.get('/creator/:creatorId/price', authenticateToken, async (req, res) => {
  try {
    const { creatorId } = req.params;

    // Get pricing for creator from users table
    const pricingResult = await db.query(
      `SELECT subscription_price
       FROM users
       WHERE supabase_id = $1 OR id = $1`,
      [creatorId]
    );

    if (pricingResult.rows.length === 0) {
      return res.json({
        price: DEFAULT_PRICE,
        usd: DEFAULT_PRICE * TOKEN_RATE,
        isDefault: true
      });
    }

    const price = pricingResult.rows[0].subscription_price || DEFAULT_PRICE;
    res.json({
      price: price,
      usd: price * TOKEN_RATE,
      isDefault: false
    });
  } catch (error) {
    console.error('Error fetching subscription price:', error);
    res.status(500).json({ error: 'Failed to fetch subscription price' });
  }
});

// Update creator's subscription price
router.put('/creator/price', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.id;
    const { price } = req.body;

    // Validate price (minimum 100 tokens)
    if (!price || price < MIN_PRICE) {
      return res.status(400).json({ error: `Price must be at least ${MIN_PRICE} tokens` });
    }

    // Update creator's subscription price in users table
    const result = await db.query(
      `UPDATE users
       SET subscription_price = $1, updated_at = CURRENT_TIMESTAMP
       WHERE supabase_id = $2 OR id = $2
       RETURNING subscription_price`,
      [price, creatorId]
    );

    if (result.rows.length > 0) {
      res.json({
        success: true,
        price: result.rows[0].subscription_price
      });
    }
  } catch (error) {
    console.error('Error updating subscription price:', error);
    res.status(500).json({ error: 'Failed to update subscription price' });
  }
});

// Subscribe to a creator
router.post('/subscribe', authenticateToken, async (req, res) => {
  try {
    const fanId = req.user.id;
    const { creatorId } = req.body;

    // Get subscription price from users table
    const priceResult = await db.query(
      `SELECT subscription_price FROM users WHERE supabase_id = $1 OR id = $1`,
      [creatorId]
    );

    const price = priceResult.rows[0]?.subscription_price || DEFAULT_PRICE;

    // Check if user has enough tokens
    const balanceResult = await db.query(
      'SELECT balance FROM token_balances WHERE user_id = $1',
      [fanId]
    );

    if (!balanceResult.rows[0] || balanceResult.rows[0].balance < price) {
      return res.status(400).json({ error: 'Insufficient tokens' });
    }

    // Check for existing subscription
    const existingResult = await db.query(
      `SELECT id FROM subscriptions
       WHERE fan_id = $1 AND creator_id = $2 AND status = 'active'`,
      [fanId, creatorId]
    );

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: 'Already subscribed to this creator' });
    }

    // Create new subscription
    await db.query(
      `INSERT INTO subscriptions (fan_id, creator_id, price, status)
       VALUES ($1, $2, $3, 'active')`,
      [fanId, creatorId, price]
    );

    // Deduct tokens for first month
    await db.query(
      `UPDATE token_balances
       SET balance = balance - $1
       WHERE user_id = $2`,
      [price, fanId]
    );

    // Log transaction
    await db.query(
      `INSERT INTO token_transactions
       (user_id, amount, type, description, metadata)
       VALUES ($1, $2, 'subscription', $3, $4)`,
      [fanId, -price, `Monthly subscription to creator`, { creatorId }]
    );

    res.json({
      success: true,
      message: 'Successfully subscribed',
      price
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// Get subscriber's status for a creator
router.get('/status/:creatorId', authenticateToken, async (req, res) => {
  try {
    const { creatorId } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `SELECT id, created_at, price, expires_at
       FROM subscriptions
       WHERE fan_id = $1 AND creator_id = $2 AND status = 'active'`,
      [userId, creatorId]
    );

    if (result.rows.length === 0) {
      return res.json({ isSubscribed: false });
    }

    const subscription = result.rows[0];
    const now = new Date();
    const expiresAt = subscription.expires_at ? new Date(subscription.expires_at) : null;

    res.json({
      isSubscribed: !expiresAt || expiresAt > now,
      subscribedAt: subscription.created_at,
      expiresAt: subscription.expires_at,
      price: subscription.price
    });
  } catch (error) {
    console.error('Error checking subscription status:', error);
    res.status(500).json({ error: 'Failed to check subscription status' });
  }
});

// Get creator's subscribers
router.get('/my-subscribers', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.id;

    // Get subscribers
    const subscribersResult = await db.query(
      `SELECT
        s.id,
        s.fan_id,
        s.price,
        s.created_at as subscribed_at,
        u.username,
        u.profile_pic_url
       FROM subscriptions s
       JOIN users u ON u.id = s.fan_id
       WHERE s.creator_id = $1 AND s.status = 'active'
       ORDER BY s.created_at DESC`,
      [creatorId]
    );

    // Calculate monthly revenue
    const totalSubscribers = subscribersResult.rows.length;
    const monthlyRevenue = subscribersResult.rows.reduce((total, sub) => total + (sub.price || 0), 0);

    res.json({
      subscribers: subscribersResult.rows,
      stats: {
        totalSubscribers,
        monthlyRevenue
      }
    });
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

// Cancel subscription
router.delete('/cancel/:creatorId', authenticateToken, async (req, res) => {
  try {
    const { creatorId } = req.params;
    const fanId = req.user.id;

    const result = await db.query(
      `UPDATE subscriptions
       SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
       WHERE fan_id = $1 AND creator_id = $2 AND status = 'active'
       RETURNING id`,
      [fanId, creatorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    res.json({
      success: true,
      message: 'Subscription cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Get subscription price for frontend
router.get('/price', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id || req.user.id;

    // Get current price from users table
    const result = await db.query(
      `SELECT subscription_price FROM users WHERE supabase_id = $1 OR id = $1`,
      [userId]
    );

    const price = result.rows[0]?.subscription_price || DEFAULT_PRICE;

    res.json({
      price,
      usd: price * TOKEN_RATE
    });
  } catch (error) {
    console.error('Error fetching price:', error);
    res.status(500).json({ error: 'Failed to fetch price' });
  }
});

// Update subscription price (simplified endpoint)
router.put('/price', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id || req.user.id;
    const { price } = req.body;

    if (!price || price < MIN_PRICE) {
      return res.status(400).json({ error: `Price must be at least ${MIN_PRICE} tokens` });
    }

    // Update subscription_price in users table
    const result = await db.query(
      `UPDATE users
       SET subscription_price = $1, updated_at = CURRENT_TIMESTAMP
       WHERE supabase_id = $2 OR id = $2
       RETURNING subscription_price`,
      [price, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      price: result.rows[0].subscription_price
    });
  } catch (error) {
    console.error('Error updating price:', error);
    res.status(500).json({ error: 'Failed to update price' });
  }
});

module.exports = router;