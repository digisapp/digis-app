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
      console.log('Creator access denied for user:', req.user.supabase_id, 'is_creator:', result.rows[0]?.is_creator, 'role:', result.rows[0]?.role);
      return res.status(403).json({ error: 'Creator access required' });
    }
    
    next();
  } catch (error) {
    console.error('Error checking creator status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get payout dashboard data
router.get('/dashboard', authenticateToken, requireCreator, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;

    // Get dashboard data
    const dashboardQuery = `
      SELECT
        u.token_balance as available_balance,
        u.total_earnings,
        0 as pending_payout,
        0 as lifetime_payouts,
        0 as current_month_earnings,
        0 as last_month_earnings
      FROM users u
      WHERE u.supabase_id = $1
    `;
    const dashboardResult = await pool.query(dashboardQuery, [creatorId]);

    // Get recent payouts - check if table exists and has data
    let recentPayouts = { rows: [] };
    try {
      const recentPayoutsQuery = `
        SELECT
          id,
          amount,
          status,
          created_at,
          updated_at
        FROM creator_payouts
        WHERE creator_id = $1
        ORDER BY created_at DESC
        LIMIT 10
      `;
      recentPayouts = await pool.query(recentPayoutsQuery, [creatorId]);
    } catch (error) {
      console.log('Creator payouts table may not have all columns, using empty result');
      recentPayouts = { rows: [] };
    }

    // Get recent earnings
    const recentEarningsQuery = `
      SELECT 
        ce.*,
        u.display_name as fan_name,
        u.avatar_url as fan_avatar
      FROM creator_earnings ce
      LEFT JOIN users u ON u.uid = ce.fan_id
      WHERE ce.creator_id = $1
      ORDER BY ce.earned_at DESC
      LIMIT 20
    `;
    const recentEarnings = await pool.query(recentEarningsQuery, [creatorId]);

    // Get next payout date
    const today = new Date();
    let nextPayoutDate;
    if (today.getDate() <= 15) {
      nextPayoutDate = new Date(today.getFullYear(), today.getMonth(), 15);
    } else {
      nextPayoutDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    }

    res.json({
      dashboard: dashboardResult.rows[0] || {
        pending_tokens: 0,
        pending_usd: 0,
        lifetime_earnings_usd: 0,
        total_payouts: 0,
        can_receive_payouts: false
      },
      recentPayouts: recentPayouts.rows,
      recentEarnings: recentEarnings.rows,
      nextPayoutDate: nextPayoutDate.toISOString().split('T')[0]
    });
  } catch (error) {
    console.error('Error fetching payout dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch payout dashboard' });
  }
});

// Get or create Stripe Connect account
router.get('/stripe-account', authenticateToken, requireCreator, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;

    // Check if account exists in creator_stripe_accounts table
    const accountQuery = `
      SELECT
        csa.stripe_account_id,
        csa.account_status,
        csa.charges_enabled,
        csa.payouts_enabled,
        csa.details_submitted,
        csa.country,
        csa.currency,
        u.email,
        u.display_name
      FROM creator_stripe_accounts csa
      JOIN users u ON u.supabase_id = csa.creator_id
      WHERE csa.creator_id = $1
    `;
    const accountResult = await pool.query(accountQuery, [creatorId]);

    if (accountResult.rows.length > 0) {
      const account = accountResult.rows[0];

      // Update status from Stripe
      if (account.stripe_account_id) {
        const status = await stripeConnect.updateAccountStatus(account.stripe_account_id);

        return res.json({
          hasAccount: true,
          account: {
            ...account,
            ...status
          }
        });
      }
    }

    res.json({
      hasAccount: false,
      account: null
    });
  } catch (error) {
    console.error('Error fetching Stripe account:', error);
    res.status(500).json({ error: 'Failed to fetch Stripe account' });
  }
});

// Create Stripe Connect account and get onboarding link
router.post('/stripe-account/create', authenticateToken, requireCreator, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;

    // Get creator data
    const userQuery = 'SELECT email, country FROM users WHERE uid = $1';
    const userResult = await pool.query(userQuery, [creatorId]);
    
    if (!userResult.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userResult.rows[0];

    // Create connected account
    const { accountId } = await stripeConnect.createConnectedAccount(creatorId, userData);

    // Generate onboarding link
    const returnUrl = `${process.env.FRONTEND_URL}/creator/payouts/onboarding-complete`;
    const refreshUrl = `${process.env.FRONTEND_URL}/creator/payouts/onboarding-refresh`;
    
    const accountLink = await stripeConnect.createAccountLink(
      accountId,
      refreshUrl,
      returnUrl
    );

    res.json({
      success: true,
      onboardingUrl: accountLink.url
    });
  } catch (error) {
    console.error('Error creating Stripe account:', error);
    res.status(500).json({ error: 'Failed to create Stripe account' });
  }
});

// Get payout settings
router.get('/settings', authenticateToken, requireCreator, async (req, res) => {
  try {
    // Return default settings for now
    return res.json({
      payout_enabled: true,
      minimum_payout_amount: 50.00,
      payout_schedule: 'biweekly',
      tax_form_submitted: false,
      creator_id: req.user.supabase_id
    });
  } catch (error) {
    console.error('Error fetching payout settings:', error);
    res.status(500).json({ error: 'Failed to fetch payout settings' });
  }
});

// Update payout settings
router.put('/settings', authenticateToken, requireCreator, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;
    const {
      payout_enabled,
      minimum_payout_amount,
      payout_schedule
    } = req.body;

    // Validate minimum payout amount
    if (minimum_payout_amount && minimum_payout_amount < 50) {
      return res.status(400).json({ error: 'Minimum payout amount must be at least $50' });
    }

    const query = `
      INSERT INTO creator_payout_settings 
      (creator_id, payout_enabled, minimum_payout_amount, payout_schedule)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (creator_id) DO UPDATE SET
        payout_enabled = EXCLUDED.payout_enabled,
        minimum_payout_amount = EXCLUDED.minimum_payout_amount,
        payout_schedule = EXCLUDED.payout_schedule,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await pool.query(query, [
      creatorId,
      payout_enabled !== false,
      minimum_payout_amount || 50.00,
      payout_schedule || 'biweekly'
    ]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating payout settings:', error);
    res.status(500).json({ error: 'Failed to update payout settings' });
  }
});

// Get payout history
router.get('/history', authenticateToken, requireCreator, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        p.*,
        COUNT(ce.id) as transaction_count
      FROM creator_payouts p
      LEFT JOIN creator_earnings ce ON ce.payout_id = p.id
      WHERE p.creator_id = $1
    `;
    
    const params = [creatorId];
    let paramIndex = 2;

    if (status) {
      query += ` AND p.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += `
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) FROM creator_payouts WHERE creator_id = $1
      ${status ? `AND status = $2` : ''}
    `;
    const countParams = status ? [creatorId, status] : [creatorId];
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      payouts: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(countResult.rows[0].count / limit)
    });
  } catch (error) {
    console.error('Error fetching payout history:', error);
    res.status(500).json({ error: 'Failed to fetch payout history' });
  }
});

// Get earnings breakdown for a specific payout
router.get('/payouts/:payoutId/earnings', authenticateToken, requireCreator, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;
    const { payoutId } = req.params;

    // Verify payout belongs to creator
    const payoutCheck = await pool.query(
      'SELECT id FROM creator_payouts WHERE id = $1 AND creator_id = $2',
      [payoutId, creatorId]
    );

    if (payoutCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Payout not found' });
    }

    // Get earnings breakdown
    const query = `
      SELECT 
        ce.*,
        u.display_name as fan_name,
        u.avatar_url as fan_avatar
      FROM creator_earnings ce
      LEFT JOIN users u ON u.uid = ce.fan_id
      WHERE ce.payout_id = $1
      ORDER BY ce.earned_at DESC
    `;

    const result = await pool.query(query, [payoutId]);

    res.json({
      earnings: result.rows
    });
  } catch (error) {
    console.error('Error fetching payout earnings:', error);
    res.status(500).json({ error: 'Failed to fetch payout earnings' });
  }
});

// Get notifications
router.get('/notifications', authenticateToken, requireCreator, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;

    const query = `
      SELECT * FROM payout_notifications 
      WHERE creator_id = $1 
      ORDER BY created_at DESC 
      LIMIT 50
    `;

    const result = await pool.query(query, [creatorId]);

    res.json({
      notifications: result.rows
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.put('/notifications/:id/read', authenticateToken, requireCreator, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE payout_notifications 
       SET is_read = true 
       WHERE id = $1 AND creator_id = $2
       RETURNING *`,
      [id, creatorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// Manual payout request (for testing)
router.post('/request-payout', authenticateToken, requireCreator, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;

    // Check if can receive payouts
    const canReceiveQuery = 'SELECT can_creator_receive_payouts($1) as can_receive';
    const canReceiveResult = await pool.query(canReceiveQuery, [creatorId]);

    if (!canReceiveResult.rows[0].can_receive) {
      return res.status(400).json({
        error: 'You cannot receive payouts. Please complete your Stripe account setup.'
      });
    }

    // Get pending balance
    const balanceQuery = 'SELECT * FROM get_creator_pending_balance($1)';
    const balanceResult = await pool.query(balanceQuery, [creatorId]);

    const { total_tokens, total_usd } = balanceResult.rows[0];

    if (total_usd < 50) {
      return res.status(400).json({
        error: `Minimum payout amount is $50. Current balance: $${total_usd}`
      });
    }

    // Create manual payout
    const today = new Date();
    const payoutResult = await pool.query(
      `INSERT INTO creator_payouts
       (creator_id, payout_period_start, payout_period_end, tokens_earned,
        usd_amount, platform_fee_amount, net_payout_amount, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING *`,
      [
        creatorId,
        new Date(today.getFullYear(), today.getMonth(), 1),
        today,
        total_tokens,
        total_usd,
        total_usd * 0.20,
        total_usd * 0.80
      ]
    );

    // Link earnings to payout
    await pool.query(
      `UPDATE creator_earnings
       SET payout_id = $1
       WHERE creator_id = $2 AND payout_id IS NULL`,
      [payoutResult.rows[0].id, creatorId]
    );

    res.json({
      success: true,
      payout: payoutResult.rows[0],
      message: 'Manual payout request created. It will be processed within 24 hours.'
    });
  } catch (error) {
    console.error('Error creating manual payout:', error);
    res.status(500).json({ error: 'Failed to create payout request' });
  }
});

module.exports = router;