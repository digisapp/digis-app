const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../utils/db');
const { logger } = require('../utils/secureLogger');
const router = express.Router();

/**
 * Create Stripe Connect Express account for creator
 * POST /api/stripe-connect/create-account
 */
router.post('/create-account', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT is_creator, email, username FROM users WHERE supabase_id = $1',
      [req.user.supabase_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!userResult.rows[0].is_creator) {
      return res.status(403).json({
        error: 'Only approved creators can create payout accounts'
      });
    }

    // Check if account already exists
    if (userResult.rows[0].stripe_connect_account_id) {
      return res.json({
        success: true,
        accountId: userResult.rows[0].stripe_connect_account_id,
        alreadyExists: true
      });
    }

    // Create Stripe Connect Express account
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US', // TODO: Make this configurable based on creator location
      email: userResult.rows[0].email,
      capabilities: {
        transfers: { requested: true }
      },
      metadata: {
        creator_id: req.user.supabase_id,
        username: userResult.rows[0].username
      }
    });

    // Store account ID
    await pool.query(
      'UPDATE users SET stripe_connect_account_id = $1, updated_at = NOW() WHERE supabase_id = $2',
      [account.id, req.user.supabase_id]
    );

    logger.info(`✅ Stripe Connect account created for creator ${req.user.supabase_id}: ${account.id}`);

    res.json({
      success: true,
      accountId: account.id,
      alreadyExists: false
    });
  } catch (error) {
    logger.error('❌ Stripe Connect account creation error:', error);
    res.status(500).json({
      error: 'Failed to create payout account',
      details: error.message
    });
  }
});

/**
 * Generate onboarding link for creator to complete bank account setup
 * POST /api/stripe-connect/onboarding-link
 */
router.post('/onboarding-link', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT stripe_connect_account_id, is_creator FROM users WHERE supabase_id = $1',
      [req.user.supabase_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!userResult.rows[0].is_creator) {
      return res.status(403).json({ error: 'Only creators can access payout settings' });
    }

    const accountId = userResult.rows[0].stripe_connect_account_id;
    if (!accountId) {
      return res.status(404).json({
        error: 'No Connect account found. Please create an account first.',
        action: 'create_account'
      });
    }

    // Generate account onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.FRONTEND_URL}/creator/settings?setup=failed`,
      return_url: `${process.env.FRONTEND_URL}/creator/settings?setup=complete`,
      type: 'account_onboarding'
    });

    logger.info(`🔗 Onboarding link generated for creator ${req.user.supabase_id}`);

    res.json({
      success: true,
      url: accountLink.url,
      expiresAt: accountLink.expires_at
    });
  } catch (error) {
    logger.error('❌ Stripe onboarding link generation error:', error);
    res.status(500).json({
      error: 'Failed to generate onboarding link',
      details: error.message
    });
  }
});

/**
 * Get account status and details
 * GET /api/stripe-connect/account-status
 */
router.get('/account-status', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT stripe_connect_account_id, is_creator FROM users WHERE supabase_id = $1',
      [req.user.supabase_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!userResult.rows[0].is_creator) {
      return res.status(403).json({ error: 'Only creators can view payout status' });
    }

    const accountId = userResult.rows[0].stripe_connect_account_id;
    if (!accountId) {
      return res.json({
        success: true,
        connected: false,
        accountId: null,
        status: 'not_created'
      });
    }

    // Get account details from Stripe
    const account = await stripe.accounts.retrieve(accountId);

    const isComplete = account.details_submitted &&
                      account.charges_enabled &&
                      account.payouts_enabled;

    res.json({
      success: true,
      connected: isComplete,
      accountId: account.id,
      status: isComplete ? 'complete' : 'incomplete',
      details: {
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        currentlyDue: account.requirements?.currently_due || [],
        country: account.country,
        defaultCurrency: account.default_currency
      }
    });
  } catch (error) {
    logger.error('❌ Stripe account status check error:', error);
    res.status(500).json({
      error: 'Failed to check account status',
      details: error.message
    });
  }
});

/**
 * Generate login link for creators to access their Stripe Express dashboard
 * POST /api/stripe-connect/dashboard-link
 */
router.post('/dashboard-link', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT stripe_connect_account_id, is_creator FROM users WHERE supabase_id = $1',
      [req.user.supabase_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!userResult.rows[0].is_creator) {
      return res.status(403).json({ error: 'Only creators can access payout dashboard' });
    }

    const accountId = userResult.rows[0].stripe_connect_account_id;
    if (!accountId) {
      return res.status(404).json({
        error: 'No Connect account found',
        action: 'create_account'
      });
    }

    // Generate login link to Stripe Express dashboard
    const loginLink = await stripe.accounts.createLoginLink(accountId);

    logger.info(`🔗 Dashboard link generated for creator ${req.user.supabase_id}`);

    res.json({
      success: true,
      url: loginLink.url
    });
  } catch (error) {
    logger.error('❌ Stripe dashboard link generation error:', error);
    res.status(500).json({
      error: 'Failed to generate dashboard link',
      details: error.message
    });
  }
});

/**
 * Disconnect Stripe Connect account (for testing or user request)
 * DELETE /api/stripe-connect/disconnect
 */
router.delete('/disconnect', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT stripe_connect_account_id, is_creator FROM users WHERE supabase_id = $1',
      [req.user.supabase_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!userResult.rows[0].is_creator) {
      return res.status(403).json({ error: 'Only creators can disconnect payout accounts' });
    }

    const accountId = userResult.rows[0].stripe_connect_account_id;
    if (!accountId) {
      return res.json({
        success: true,
        message: 'No account to disconnect'
      });
    }

    // Delete the Stripe Connect account
    await stripe.accounts.del(accountId);

    // Remove from database
    await pool.query(
      'UPDATE users SET stripe_connect_account_id = NULL, updated_at = NOW() WHERE supabase_id = $1',
      [req.user.supabase_id]
    );

    logger.info(`🔌 Stripe Connect account disconnected for creator ${req.user.supabase_id}`);

    res.json({
      success: true,
      message: 'Payout account disconnected successfully'
    });
  } catch (error) {
    logger.error('❌ Stripe account disconnect error:', error);
    res.status(500).json({
      error: 'Failed to disconnect account',
      details: error.message
    });
  }
});

module.exports = router;
