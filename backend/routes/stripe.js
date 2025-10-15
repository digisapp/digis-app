const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../utils/db');
const stripeConnect = require('../services/stripe-connect');

// Middleware to check if user is a creator
const requireCreator = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT is_creator, role FROM users WHERE supabase_id = $1 OR id = $1',
      [req.user.supabase_id || req.user.id]
    );

    if (!result.rows[0] || (!result.rows[0].is_creator && result.rows[0].role !== 'creator' && result.rows[0].role !== 'admin')) {
      return res.status(403).json({ error: 'Creator access required' });
    }

    next();
  } catch (error) {
    console.error('Error checking creator status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/stripe/account-link
 * Generate Stripe Connect account onboarding/update link
 * Used by PayoutSettings.js to set up or update banking information
 */
router.post('/account-link', authenticateToken, requireCreator, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;
    const { return_url, refresh_url } = req.body;

    if (!return_url || !refresh_url) {
      return res.status(400).json({ error: 'return_url and refresh_url are required' });
    }

    // Get or create Stripe account
    let accountQuery = await pool.query(
      'SELECT stripe_account_id FROM creator_stripe_accounts WHERE creator_id = $1',
      [creatorId]
    );

    let stripeAccountId;

    if (accountQuery.rows.length === 0 || !accountQuery.rows[0].stripe_account_id) {
      // Create new Stripe Connect account
      const userQuery = await pool.query(
        'SELECT email, country FROM users WHERE supabase_id = $1',
        [creatorId]
      );

      if (!userQuery.rows[0]) {
        return res.status(404).json({ error: 'User not found' });
      }

      const { accountId } = await stripeConnect.createConnectedAccount(
        creatorId,
        userQuery.rows[0]
      );
      stripeAccountId = accountId;
    } else {
      stripeAccountId = accountQuery.rows[0].stripe_account_id;
    }

    // Generate account link
    const accountLink = await stripeConnect.createAccountLink(
      stripeAccountId,
      refresh_url,
      return_url
    );

    res.json({
      url: accountLink.url,
      expires_at: accountLink.expires_at
    });
  } catch (error) {
    console.error('Error creating Stripe account link:', error);
    res.status(500).json({ error: 'Failed to create account link' });
  }
});

/**
 * GET /api/stripe/payouts
 * Get payout history from Stripe for the connected account
 * Used by PayoutSettings.js to display payout activity
 */
router.get('/payouts', authenticateToken, requireCreator, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;
    const { limit = 50 } = req.query;

    // Get Stripe account ID
    const accountQuery = await pool.query(
      'SELECT stripe_account_id FROM creator_stripe_accounts WHERE creator_id = $1',
      [creatorId]
    );

    if (accountQuery.rows.length === 0 || !accountQuery.rows[0].stripe_account_id) {
      return res.json({ payouts: [] });
    }

    const stripeAccountId = accountQuery.rows[0].stripe_account_id;

    // Fetch payout history from Stripe
    const { payouts, hasMore } = await stripeConnect.getPayoutHistory(stripeAccountId, {
      limit: parseInt(limit)
    });

    res.json({
      payouts,
      hasMore
    });
  } catch (error) {
    console.error('Error fetching Stripe payouts:', error);
    res.status(500).json({ error: 'Failed to fetch payout history' });
  }
});

/**
 * GET /api/stripe/balance
 * Get available balance from Stripe connected account
 */
router.get('/balance', authenticateToken, requireCreator, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;

    // Get Stripe account ID
    const accountQuery = await pool.query(
      'SELECT stripe_account_id FROM creator_stripe_accounts WHERE creator_id = $1',
      [creatorId]
    );

    if (accountQuery.rows.length === 0 || !accountQuery.rows[0].stripe_account_id) {
      return res.json({ available: [], pending: [] });
    }

    const stripeAccountId = accountQuery.rows[0].stripe_account_id;

    // Fetch balance from Stripe
    const balance = await stripeConnect.getAccountBalance(stripeAccountId);

    res.json(balance);
  } catch (error) {
    console.error('Error fetching Stripe balance:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

module.exports = router;
