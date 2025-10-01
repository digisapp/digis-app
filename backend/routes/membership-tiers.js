const express = require('express');
const { Pool } = require('pg');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { usdToTokens, tokensToUsd, calculateCreatorEarnings } = require('../config/tokenConfig');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Create membership tier
router.post('/tiers', [
  body('name').isLength({ min: 3, max: 50 }),
  body('description').optional().isLength({ max: 300 }),
  body('price').isFloat({ min: 0 }),
  body('benefits').isArray().notEmpty(),
  body('tierLevel').isInt({ min: 1, max: 10 }),
  body('color').optional().isHexColor()
], authenticateToken, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const creatorId = req.user.supabase_id;
    const { 
      name, 
      description, 
      price, 
      benefits, 
      tierLevel, 
      color,
      tokensIncluded = 0,
      sessionDiscountPercent = 0,
      exclusiveContent = false,
      prioritySupport = false,
      customEmojis = false,
      badgeIcon
    } = req.body;

    // Verify user is a creator
    const creatorQuery = await pool.query(
      'SELECT is_creator FROM users WHERE supabase_id = $1',
      [creatorId]
    );

    if (creatorQuery.rows.length === 0 || !creatorQuery.rows[0].is_creator) {
      return res.status(403).json({ error: 'Creator access required' });
    }

    // Check if tier level already exists for this creator
    const existingTierQuery = await pool.query(
      'SELECT id FROM membership_tiers WHERE creator_id = $1 AND tier_level = $2',
      [creatorId, tierLevel]
    );

    if (existingTierQuery.rows.length > 0) {
      return res.status(400).json({ error: 'Tier level already exists for this creator' });
    }

    // Create membership tier
    const tierQuery = await pool.query(`
      INSERT INTO membership_tiers 
      (creator_id, name, description, price, benefits, tier_level, color, 
       tokens_included, session_discount_percent, exclusive_content, 
       priority_support, custom_emojis, badge_icon, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      RETURNING *
    `, [
      creatorId, name, description, price, JSON.stringify(benefits), tierLevel,
      color || '#007bff', tokensIncluded, sessionDiscountPercent,
      exclusiveContent, prioritySupport, customEmojis, badgeIcon
    ]);

    const tier = tierQuery.rows[0];

    res.json({
      success: true,
      tier: {
        id: tier.id,
        creatorId: tier.creator_id,
        name: tier.name,
        description: tier.description,
        price: parseFloat(tier.price),
        benefits: JSON.parse(tier.benefits),
        tierLevel: tier.tier_level,
        color: tier.color,
        tokensIncluded: tier.tokens_included,
        sessionDiscountPercent: tier.session_discount_percent,
        exclusiveContent: tier.exclusive_content,
        prioritySupport: tier.priority_support,
        customEmojis: tier.custom_emojis,
        badgeIcon: tier.badge_icon,
        createdAt: tier.created_at
      }
    });

  } catch (error) {
    console.error('❌ Error creating membership tier:', error);
    res.status(500).json({ error: 'Failed to create membership tier' });
  }
});

// Get creator's membership tiers
router.get('/creator/:creatorId/tiers', async (req, res) => {
  try {
    const { creatorId } = req.params;

    const tiersQuery = await pool.query(`
      SELECT 
        mt.*,
        u.username as creator_username,
        COUNT(m.id) as member_count,
        SUM(CASE WHEN m.status = 'active' THEN 1 ELSE 0 END) as active_members
      FROM membership_tiers mt
      JOIN users u ON mt.creator_id = u.id
      LEFT JOIN memberships m ON mt.id = m.tier_id
      WHERE mt.creator_id = $1 AND mt.is_active = true
      GROUP BY mt.id, u.username
      ORDER BY mt.tier_level ASC
    `, [creatorId]);

    res.json({
      success: true,
      tiers: tiersQuery.rows.map(tier => ({
        id: tier.id,
        creatorId: tier.creator_id,
        creatorUsername: tier.creator_username,
        name: tier.name,
        description: tier.description,
        price: parseFloat(tier.price),
        benefits: JSON.parse(tier.benefits),
        tierLevel: tier.tier_level,
        color: tier.color,
        tokensIncluded: tier.tokens_included,
        sessionDiscountPercent: tier.session_discount_percent,
        exclusiveContent: tier.exclusive_content,
        prioritySupport: tier.priority_support,
        customEmojis: tier.custom_emojis,
        badgeIcon: tier.badge_icon,
        memberCount: parseInt(tier.member_count) || 0,
        activeMembers: parseInt(tier.active_members) || 0,
        isActive: tier.is_active,
        createdAt: tier.created_at
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching membership tiers:', error);
    res.status(500).json({ error: 'Failed to fetch membership tiers' });
  }
});

// Join membership tier
router.post('/join/:tierId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { tierId } = req.params;
    const { paymentMethod = 'tokens' } = req.body;

    // Get tier details
    const tierQuery = await pool.query(`
      SELECT mt.*, u.username as creator_username
      FROM membership_tiers mt
      JOIN users u ON mt.creator_id = u.id
      WHERE mt.id = $1 AND mt.is_active = true
    `, [tierId]);

    if (tierQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Membership tier not found' });
    }

    const tier = tierQuery.rows[0];

    // Check if user is already a member of this tier
    const existingMembershipQuery = await pool.query(`
      SELECT id FROM memberships 
      WHERE user_id = $1 AND tier_id = $2 AND status = 'active'
    `, [userId, tierId]);

    if (existingMembershipQuery.rows.length > 0) {
      return res.status(400).json({ error: 'Already a member of this tier' });
    }

    // Check if user has a higher tier with this creator
    const higherTierQuery = await pool.query(`
      SELECT m.*, mt.tier_level 
      FROM memberships m
      JOIN membership_tiers mt ON m.tier_id = mt.id
      WHERE m.user_id = $1 AND mt.creator_id = $2 AND m.status = 'active' AND mt.tier_level > $3
    `, [userId, tier.creator_id, tier.tier_level]);

    if (higherTierQuery.rows.length > 0) {
      return res.status(400).json({ error: 'You already have a higher tier membership with this creator' });
    }

    const price = parseFloat(tier.price);
    const tokenCost = usdToTokens(price); // Use config for token conversion

    if (paymentMethod === 'tokens') {
      // Check user token balance with row lock to prevent race conditions
      const userQuery = await pool.query(`
        SELECT tb.balance
        FROM token_balances tb
        WHERE tb.user_id = $1
        FOR UPDATE
      `, [userId]);

      if (userQuery.rows.length === 0 || userQuery.rows[0].balance < tokenCost) {
        return res.status(400).json({ 
          error: 'Insufficient token balance',
          required: tokenCost,
          available: userQuery.rows[0]?.balance || 0
        });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Deduct tokens from user
        await client.query(`
          UPDATE token_balances 
          SET balance = balance - $1 
          WHERE user_id = $2
        `, [tokenCost, userId]);

        // Add tokens to creator (100% - no platform fee)
        const creatorEarnings = tokenCost;
        await client.query(`
          INSERT INTO token_balances (user_id, balance)
          VALUES ($1, $2)
          ON CONFLICT (user_id) DO UPDATE SET balance = token_balances.balance + $2
        `, [tier.creator_id, creatorEarnings]);

        // Record earnings for payout system
        const creatorEarningsUsd = tokensToUsd(creatorEarnings); // Use config for token conversion
        await client.query(`
          INSERT INTO creator_earnings (creator_id, earning_type, source_id, tokens_earned, usd_value, description, fan_id)
          VALUES ($1, 'membership', $2, $3, $4, $5, $6)
        `, [tier.creator_id, `membership_${Date.now()}`, creatorEarnings, creatorEarningsUsd, `${tier.name} membership purchase`, userId]);

        // Deactivate any existing lower tier memberships
        await client.query(`
          UPDATE memberships 
          SET status = 'cancelled', ended_at = NOW()
          WHERE user_id = $1 AND tier_id IN (
            SELECT id FROM membership_tiers 
            WHERE creator_id = $2 AND tier_level <= $3
          ) AND status = 'active'
        `, [userId, tier.creator_id, tier.tier_level]);

        // Create new membership
        const membershipQuery = await client.query(`
          INSERT INTO memberships 
          (user_id, tier_id, creator_id, price_paid, payment_method, started_at, 
           tokens_remaining, next_billing_date)
          VALUES ($1, $2, $3, $4, $5, NOW(), $6, NOW() + INTERVAL '1 month')
          RETURNING *
        `, [userId, tierId, tier.creator_id, price, paymentMethod, tier.tokens_included]);

        const membership = membershipQuery.rows[0];

        // Give initial tokens if included in tier
        if (tier.tokens_included > 0) {
          await client.query(`
            INSERT INTO token_balances (user_id, balance)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET balance = token_balances.balance + $2
          `, [userId, tier.tokens_included]);

          // Record token grant transaction
          await client.query(`
            INSERT INTO token_transactions 
            (user_id, type, tokens, amount_usd, status, membership_id, created_at)
            VALUES ($1, 'membership_bonus', $2, $3, 'completed', $4, NOW())
          `, [userId, tier.tokens_included, 0, membership.id]);
        }

        // Record transaction
        await client.query(`
          INSERT INTO token_transactions 
          (user_id, type, tokens, amount_usd, status, membership_id, created_at)
          VALUES ($1, 'membership_purchase', $2, $3, 'completed', $4, NOW())
        `, [userId, -tokenCost, -price, membership.id]);

        // Create notification for creator
        await client.query(`
          INSERT INTO notifications (recipient_id, type, title, content, data, created_at)
          VALUES ($1, 'new_member', 'New Tier Member!', 
                  $2, $3, NOW())
        `, [
          tier.creator_id,
          `Someone just joined your ${tier.name} tier!`,
          JSON.stringify({
            tierId,
            tierName: tier.name,
            membershipId: membership.id,
            userId
          })
        ]);

        // Create notification for user
        await client.query(`
          INSERT INTO notifications (recipient_id, type, title, content, data, created_at)
          VALUES ($1, 'membership_activated', 'Membership Activated!', 
                  $2, $3, NOW())
        `, [
          userId,
          `Welcome to ${tier.creator_username}'s ${tier.name} tier! Your exclusive benefits are now active.`,
          JSON.stringify({
            tierId,
            tierName: tier.name,
            creatorId: tier.creator_id,
            creatorUsername: tier.creator_username,
            benefits: JSON.parse(tier.benefits)
          })
        ]);

        await client.query('COMMIT');

        res.json({
          success: true,
          message: 'Successfully joined membership tier!',
          membership: {
            id: membership.id,
            tierId,
            tierName: tier.name,
            tierLevel: tier.tier_level,
            creatorUsername: tier.creator_username,
            price: price,
            tokensIncluded: tier.tokens_included,
            benefits: JSON.parse(tier.benefits),
            startedAt: membership.started_at,
            nextBillingDate: membership.next_billing_date
          }
        });

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

  } catch (error) {
    console.error('❌ Error joining membership tier:', error);
    res.status(500).json({ error: 'Failed to join membership tier' });
  }
});

// Get user's memberships
router.get('/my-memberships', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;

    const membershipsQuery = await pool.query(`
      SELECT 
        m.*,
        mt.name as tier_name,
        mt.description as tier_description,
        mt.tier_level,
        mt.color as tier_color,
        mt.benefits,
        mt.tokens_included,
        mt.session_discount_percent,
        mt.exclusive_content,
        mt.priority_support,
        mt.custom_emojis,
        mt.badge_icon,
        u.username as creator_username,
        u.profile_pic_url as creator_profile_pic
      FROM memberships m
      JOIN membership_tiers mt ON m.tier_id = mt.id
      JOIN users u ON m.creator_id = u.id
      WHERE m.user_id = $1
      ORDER BY mt.tier_level DESC, m.started_at DESC
    `, [userId]);

    res.json({
      success: true,
      memberships: membershipsQuery.rows.map(membership => ({
        id: membership.id,
        tierId: membership.tier_id,
        tierName: membership.tier_name,
        tierDescription: membership.tier_description,
        tierLevel: membership.tier_level,
        tierColor: membership.tier_color,
        benefits: JSON.parse(membership.benefits),
        tokensIncluded: membership.tokens_included,
        sessionDiscountPercent: membership.session_discount_percent,
        exclusiveContent: membership.exclusive_content,
        prioritySupport: membership.priority_support,
        customEmojis: membership.custom_emojis,
        badgeIcon: membership.badge_icon,
        creatorId: membership.creator_id,
        creatorUsername: membership.creator_username,
        creatorProfilePic: membership.creator_profile_pic,
        status: membership.status,
        pricePaid: parseFloat(membership.price_paid),
        tokensRemaining: membership.tokens_remaining,
        startedAt: membership.started_at,
        endedAt: membership.ended_at,
        nextBillingDate: membership.next_billing_date
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching user memberships:', error);
    res.status(500).json({ error: 'Failed to fetch memberships' });
  }
});

// Get creator's members
router.get('/my-members', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;
    const { tierLevel, status = 'active' } = req.query;

    // Verify user is a creator
    const creatorQuery = await pool.query(
      'SELECT is_creator FROM users WHERE supabase_id = $1',
      [creatorId]
    );

    if (creatorQuery.rows.length === 0 || !creatorQuery.rows[0].is_creator) {
      return res.status(403).json({ error: 'Creator access required' });
    }

    let query = `
      SELECT 
        m.*,
        mt.name as tier_name,
        mt.tier_level,
        mt.color as tier_color,
        u.username as member_username,
        u.profile_pic_url as member_profile_pic,
        u.email as member_email
      FROM memberships m
      JOIN membership_tiers mt ON m.tier_id = mt.id
      JOIN users u ON m.user_id::text = u.id::text
      WHERE m.creator_id = $1
    `;
    const params = [creatorId];
    let paramIndex = 2;

    if (status) {
      query += ` AND m.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (tierLevel) {
      query += ` AND mt.tier_level = $${paramIndex}`;
      params.push(parseInt(tierLevel));
      paramIndex++;
    }

    query += ` ORDER BY mt.tier_level DESC, m.started_at DESC`;

    const membersQuery = await pool.query(query, params);

    // Get membership stats
    const statsQuery = await pool.query(`
      SELECT 
        COUNT(*) as total_members,
        COUNT(*) FILTER (WHERE m.status = 'active') as active_members,
        SUM(m.price_paid) FILTER (WHERE m.status = 'active') as monthly_revenue,
        AVG(mt.tier_level) FILTER (WHERE m.status = 'active') as avg_tier_level
      FROM memberships m
      JOIN membership_tiers mt ON m.tier_id = mt.id
      WHERE m.creator_id = $1
    `, [creatorId]);

    const stats = statsQuery.rows[0];

    res.json({
      success: true,
      members: membersQuery.rows.map(member => ({
        id: member.id,
        userId: member.user_id,
        memberUsername: member.member_username,
        memberProfilePic: member.member_profile_pic,
        memberEmail: member.member_email,
        tierId: member.tier_id,
        tierName: member.tier_name,
        tierLevel: member.tier_level,
        tierColor: member.tier_color,
        status: member.status,
        pricePaid: parseFloat(member.price_paid),
        tokensRemaining: member.tokens_remaining,
        startedAt: member.started_at,
        endedAt: member.ended_at,
        nextBillingDate: member.next_billing_date
      })),
      stats: {
        totalMembers: parseInt(stats.total_members) || 0,
        activeMembers: parseInt(stats.active_members) || 0,
        monthlyRevenue: parseFloat(stats.monthly_revenue) || 0,
        avgTierLevel: parseFloat(stats.avg_tier_level) || 0
      }
    });

  } catch (error) {
    console.error('❌ Error fetching creator members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Cancel membership
router.post('/cancel/:membershipId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { membershipId } = req.params;
    const { reason } = req.body;

    // Get membership details
    const membershipQuery = await pool.query(`
      SELECT m.*, mt.name as tier_name, u.username as creator_username
      FROM memberships m
      JOIN membership_tiers mt ON m.tier_id = mt.id
      JOIN users u ON m.creator_id = u.id
      WHERE m.id = $1 AND m.user_id = $2 AND m.status = 'active'
    `, [membershipId, userId]);

    if (membershipQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Active membership not found' });
    }

    const membership = membershipQuery.rows[0];

    // Cancel membership
    await pool.query(`
      UPDATE memberships 
      SET status = 'cancelled', ended_at = NOW(), cancellation_reason = $1
      WHERE id = $2
    `, [reason, membershipId]);

    // Notify creator
    await pool.query(`
      INSERT INTO notifications (recipient_id, type, title, content, data, created_at)
      VALUES ($1, 'membership_cancelled', 'Member Cancelled', 
              $2, $3, NOW())
    `, [
      membership.creator_id,
      `A member cancelled their ${membership.tier_name} membership.${reason ? ` Reason: ${reason}` : ''}`,
      JSON.stringify({
        membershipId,
        tierId: membership.tier_id,
        tierName: membership.tier_name,
        userId,
        reason
      })
    ]);

    res.json({
      success: true,
      message: 'Membership cancelled successfully'
    });

  } catch (error) {
    console.error('❌ Error cancelling membership:', error);
    res.status(500).json({ error: 'Failed to cancel membership' });
  }
});

// Upgrade membership tier
router.post('/upgrade/:tierId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { tierId } = req.params;
    const { paymentMethod = 'tokens' } = req.body;

    // Get target tier details
    const tierQuery = await pool.query(`
      SELECT mt.*, u.username as creator_username
      FROM membership_tiers mt
      JOIN users u ON mt.creator_id = u.id
      WHERE mt.id = $1 AND mt.is_active = true
    `, [tierId]);

    if (tierQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Target tier not found' });
    }

    const targetTier = tierQuery.rows[0];

    // Get user's current membership with this creator
    const currentMembershipQuery = await pool.query(`
      SELECT m.*, mt.tier_level as current_tier_level, mt.name as current_tier_name
      FROM memberships m
      JOIN membership_tiers mt ON m.tier_id = mt.id
      WHERE m.user_id = $1 AND m.creator_id = $2 AND m.status = 'active'
    `, [userId, targetTier.creator_id]);

    if (currentMembershipQuery.rows.length === 0) {
      return res.status(400).json({ error: 'No active membership found with this creator' });
    }

    const currentMembership = currentMembershipQuery.rows[0];

    if (currentMembership.current_tier_level >= targetTier.tier_level) {
      return res.status(400).json({ error: 'Cannot upgrade to a lower or same tier level' });
    }

    // Calculate upgrade cost (difference between tiers)
    const upgradeCost = parseFloat(targetTier.price) - parseFloat(currentMembership.price_paid);
    const tokenCost = Math.ceil(upgradeCost * 20); // $0.05 per token

    if (paymentMethod === 'tokens' && upgradeCost > 0) {
      // Check user token balance
      const userQuery = await pool.query(`
        SELECT tb.balance 
        FROM token_balances tb
        WHERE tb.user_id = $1
      `, [userId]);

      if (userQuery.rows.length === 0 || userQuery.rows[0].balance < tokenCost) {
        return res.status(400).json({ 
          error: 'Insufficient token balance for upgrade',
          required: tokenCost,
          available: userQuery.rows[0]?.balance || 0
        });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Deduct tokens from user (only if upgrade cost > 0)
        if (upgradeCost > 0) {
          await client.query(`
            UPDATE token_balances 
            SET balance = balance - $1 
            WHERE user_id = $2
          `, [tokenCost, userId]);

          // Add tokens to creator (100% - no platform fee)
          const creatorEarnings = tokenCost;
          await client.query(`
            INSERT INTO token_balances (user_id, balance)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET balance = token_balances.balance + $2
          `, [targetTier.creator_id, creatorEarnings]);

          // Record earnings for payout system
          const creatorEarningsUsd = creatorEarnings * 0.05; // $0.05 per token
          await client.query(`
            INSERT INTO creator_earnings (creator_id, earning_type, source_id, tokens_earned, usd_value, description, fan_id)
            VALUES ($1, 'membership', $2, $3, $4, $5, $6)
          `, [targetTier.creator_id, `membership_upgrade_${Date.now()}`, creatorEarnings, creatorEarningsUsd, `Upgrade to ${targetTier.name} tier`, userId]);

          // Record transaction
          await client.query(`
            INSERT INTO token_transactions 
            (user_id, type, tokens, amount_usd, status, membership_id, created_at)
            VALUES ($1, 'membership_upgrade', $2, $3, 'completed', $4, NOW())
          `, [userId, -tokenCost, -upgradeCost, currentMembership.id]);
        }

        // Update membership to new tier
        await client.query(`
          UPDATE memberships 
          SET tier_id = $1, price_paid = $2, upgraded_at = NOW(),
              tokens_remaining = tokens_remaining + $3
          WHERE id = $4
        `, [tierId, targetTier.price, targetTier.tokens_included, currentMembership.id]);

        // Give upgrade bonus tokens
        if (targetTier.tokens_included > 0) {
          await client.query(`
            INSERT INTO token_balances (user_id, balance)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET balance = token_balances.balance + $2
          `, [userId, targetTier.tokens_included]);

          // Record token grant transaction
          await client.query(`
            INSERT INTO token_transactions 
            (user_id, type, tokens, amount_usd, status, membership_id, created_at)
            VALUES ($1, 'membership_upgrade_bonus', $2, $3, 'completed', $4, NOW())
          `, [userId, targetTier.tokens_included, 0, currentMembership.id]);
        }

        // Notify creator
        await client.query(`
          INSERT INTO notifications (recipient_id, type, title, content, data, created_at)
          VALUES ($1, 'membership_upgraded', 'Member Upgraded!', 
                  $2, $3, NOW())
        `, [
          targetTier.creator_id,
          `A member upgraded from ${currentMembership.current_tier_name} to ${targetTier.name}!`,
          JSON.stringify({
            membershipId: currentMembership.id,
            fromTierId: currentMembership.tier_id,
            fromTierName: currentMembership.current_tier_name,
            toTierId: tierId,
            toTierName: targetTier.name,
            userId
          })
        ]);

        // Notify user
        await client.query(`
          INSERT INTO notifications (recipient_id, type, title, content, data, created_at)
          VALUES ($1, 'membership_upgraded', 'Tier Upgraded!', 
                  $2, $3, NOW())
        `, [
          userId,
          `You've been upgraded to ${targetTier.creator_username}'s ${targetTier.name} tier! Enjoy your new benefits.`,
          JSON.stringify({
            tierId,
            tierName: targetTier.name,
            creatorId: targetTier.creator_id,
            creatorUsername: targetTier.creator_username,
            newBenefits: JSON.parse(targetTier.benefits)
          })
        ]);

        await client.query('COMMIT');

        res.json({
          success: true,
          message: 'Successfully upgraded membership tier!',
          upgrade: {
            fromTier: currentMembership.current_tier_name,
            toTier: targetTier.name,
            upgradeCost: upgradeCost,
            newBenefits: JSON.parse(targetTier.benefits),
            bonusTokens: targetTier.tokens_included
          }
        });

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

  } catch (error) {
    console.error('❌ Error upgrading membership:', error);
    res.status(500).json({ error: 'Failed to upgrade membership' });
  }
});

// Check user's membership benefits for a creator
router.get('/benefits/:creatorId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { creatorId } = req.params;

    const membershipQuery = await pool.query(`
      SELECT 
        m.*,
        mt.name as tier_name,
        mt.tier_level,
        mt.color as tier_color,
        mt.benefits,
        mt.tokens_included,
        mt.session_discount_percent,
        mt.exclusive_content,
        mt.priority_support,
        mt.custom_emojis,
        mt.badge_icon
      FROM memberships m
      JOIN membership_tiers mt ON m.tier_id = mt.id
      WHERE m.user_id = $1 AND m.creator_id = $2 AND m.status = 'active'
      ORDER BY mt.tier_level DESC
      LIMIT 1
    `, [userId, creatorId]);

    if (membershipQuery.rows.length === 0) {
      return res.json({
        success: true,
        hasMembership: false,
        benefits: {
          sessionDiscountPercent: 0,
          exclusiveContent: false,
          prioritySupport: false,
          customEmojis: false,
          tokensRemaining: 0
        }
      });
    }

    const membership = membershipQuery.rows[0];

    res.json({
      success: true,
      hasMembership: true,
      membership: {
        id: membership.id,
        tierName: membership.tier_name,
        tierLevel: membership.tier_level,
        tierColor: membership.tier_color,
        benefits: JSON.parse(membership.benefits),
        tokensRemaining: membership.tokens_remaining,
        startedAt: membership.started_at,
        nextBillingDate: membership.next_billing_date
      },
      benefits: {
        sessionDiscountPercent: membership.session_discount_percent,
        exclusiveContent: membership.exclusive_content,
        prioritySupport: membership.priority_support,
        customEmojis: membership.custom_emojis,
        tokensRemaining: membership.tokens_remaining,
        badgeIcon: membership.badge_icon
      }
    });

  } catch (error) {
    console.error('❌ Error checking membership benefits:', error);
    res.status(500).json({ error: 'Failed to check benefits' });
  }
});

// Update membership tier
router.put('/tiers/:tierId', [
  body('name').optional().isLength({ min: 3, max: 50 }),
  body('description').optional().isLength({ max: 300 }),
  body('price').optional().isFloat({ min: 0 }),
  body('benefits').optional().isArray().notEmpty()
], authenticateToken, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const creatorId = req.user.supabase_id;
    const { tierId } = req.params;
    const { 
      name, 
      description, 
      price, 
      benefits, 
      color,
      tokensIncluded,
      sessionDiscountPercent,
      exclusiveContent,
      prioritySupport,
      customEmojis,
      badgeIcon,
      isActive
    } = req.body;

    // Verify tier ownership
    const tierQuery = await pool.query(
      'SELECT * FROM membership_tiers WHERE id = $1 AND creator_id = $2',
      [tierId, creatorId]
    );

    if (tierQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Tier not found or access denied' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(name);
      paramIndex++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      values.push(description);
      paramIndex++;
    }

    if (price !== undefined) {
      updates.push(`price = $${paramIndex}`);
      values.push(price);
      paramIndex++;
    }

    if (benefits !== undefined) {
      updates.push(`benefits = $${paramIndex}`);
      values.push(JSON.stringify(benefits));
      paramIndex++;
    }

    if (color !== undefined) {
      updates.push(`color = $${paramIndex}`);
      values.push(color);
      paramIndex++;
    }

    if (tokensIncluded !== undefined) {
      updates.push(`tokens_included = $${paramIndex}`);
      values.push(tokensIncluded);
      paramIndex++;
    }

    if (sessionDiscountPercent !== undefined) {
      updates.push(`session_discount_percent = $${paramIndex}`);
      values.push(sessionDiscountPercent);
      paramIndex++;
    }

    if (exclusiveContent !== undefined) {
      updates.push(`exclusive_content = $${paramIndex}`);
      values.push(exclusiveContent);
      paramIndex++;
    }

    if (prioritySupport !== undefined) {
      updates.push(`priority_support = $${paramIndex}`);
      values.push(prioritySupport);
      paramIndex++;
    }

    if (customEmojis !== undefined) {
      updates.push(`custom_emojis = $${paramIndex}`);
      values.push(customEmojis);
      paramIndex++;
    }

    if (badgeIcon !== undefined) {
      updates.push(`badge_icon = $${paramIndex}`);
      values.push(badgeIcon);
      paramIndex++;
    }

    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      values.push(isActive);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(tierId, creatorId);

    const updateQuery = `
      UPDATE membership_tiers 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND creator_id = $${paramIndex + 1}
      RETURNING *
    `;

    const updatedTierQuery = await pool.query(updateQuery, values);
    const updatedTier = updatedTierQuery.rows[0];

    res.json({
      success: true,
      message: 'Membership tier updated successfully',
      tier: {
        id: updatedTier.id,
        name: updatedTier.name,
        description: updatedTier.description,
        price: parseFloat(updatedTier.price),
        benefits: JSON.parse(updatedTier.benefits),
        tierLevel: updatedTier.tier_level,
        color: updatedTier.color,
        tokensIncluded: updatedTier.tokens_included,
        sessionDiscountPercent: updatedTier.session_discount_percent,
        exclusiveContent: updatedTier.exclusive_content,
        prioritySupport: updatedTier.priority_support,
        customEmojis: updatedTier.custom_emojis,
        badgeIcon: updatedTier.badge_icon,
        isActive: updatedTier.is_active,
        updatedAt: updatedTier.updated_at
      }
    });

  } catch (error) {
    console.error('❌ Error updating membership tier:', error);
    res.status(500).json({ error: 'Failed to update membership tier' });
  }
});

module.exports = router;