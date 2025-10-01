const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../utils/db');
const loyaltyService = require('../utils/loyalty-service');
const { logger } = require('../utils/logger');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Subscribe to a tier with dual badge system
router.post('/subscribe', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { tierId, paymentMethodId } = req.body;
    const subscriberId = req.user.supabase_id;
    
    await client.query('BEGIN');
    
    // Get tier details
    const tierQuery = await client.query(
      'SELECT * FROM membership_tiers WHERE id = $1 AND is_active = true',
      [tierId]
    );
    
    if (tierQuery.rows.length === 0) {
      throw new Error('Tier not found');
    }
    
    const tier = tierQuery.rows[0];
    
    // Check existing subscription
    const existingQuery = await client.query(
      `SELECT * FROM memberships 
       WHERE user_id = $1 AND creator_id = $2 AND status = 'active'`,
      [subscriberId, tier.creator_id]
    );
    
    // Cancel existing if upgrading/downgrading
    if (existingQuery.rows.length > 0) {
      await client.query(
        `UPDATE memberships 
         SET status = 'cancelled', ended_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [existingQuery.rows[0].id]
      );
    }
    
    // Create Stripe subscription
    let stripeSubscription = null;
    if (paymentMethodId && paymentMethodId !== 'tokens') {
      const customer = await stripe.customers.create({
        payment_method: paymentMethodId,
        invoice_settings: { default_payment_method: paymentMethodId }
      });
      
      const price = await createOrGetStripePrice(tier);
      
      stripeSubscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: price.id }],
        expand: ['latest_invoice.payment_intent']
      });
    }
    
    // Create membership
    const membershipQuery = await client.query(
      `INSERT INTO memberships 
       (user_id, tier_id, creator_id, price_paid, payment_method, status, 
        stripe_subscription_id, next_billing_date, tokens_remaining, started_at)
       VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        subscriberId,
        tierId,
        tier.creator_id,
        tier.price,
        paymentMethodId === 'tokens' ? 'tokens' : 'stripe',
        stripeSubscription?.id || null,
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        tier.tokens_included || 0
      ]
    );
    
    const membership = membershipQuery.rows[0];
    
    // Track loyalty interaction
    await loyaltyService.trackInteraction(
      subscriberId,
      tier.creator_id,
      parseFloat(tier.price),
      'subscription'
    );
    
    // Get updated badges
    const badges = await loyaltyService.getUserBadges(subscriberId, tier.creator_id);
    
    // Update membership with loyalty level
    await client.query(
      `UPDATE memberships 
       SET loyalty_level = $1, combined_perks = $2 
       WHERE id = $3`,
      [
        badges[0]?.loyalty?.level || 'bronze',
        JSON.stringify(calculateCombinedPerks(tier, badges[0]?.loyalty)),
        membership.id
      ]
    );
    
    // Deliver initial perks
    await deliverSubscriptionPerks(subscriberId, tier.creator_id, tier);
    
    // Grant bonus tokens if included
    if (tier.tokens_included > 0) {
      await client.query(
        `UPDATE users 
         SET token_balance = token_balance + $1 
         WHERE id = $2`,
        [tier.tokens_included, subscriberId]
      );
      
      await client.query(
        `INSERT INTO token_transactions 
         (user_id, amount, type, description, created_at)
         VALUES ($1, $2, 'subscription_bonus', $3, CURRENT_TIMESTAMP)`,
        [subscriberId, tier.tokens_included, `${tier.name} subscription bonus`]
      );
    }
    
    await client.query('COMMIT');
    
    // Send notifications
    const io = require('../utils/socket').getIO();
    io.to(`user:${subscriberId}`).emit('subscription_success', {
      tierId,
      tierName: tier.name,
      badges: badges[0],
      perks: membership.combined_perks
    });
    
    io.to(`user:${tier.creator_id}`).emit('new_subscriber', {
      subscriberId,
      tierName: tier.name,
      loyaltyLevel: badges[0]?.loyalty?.level
    });
    
    res.json({
      success: true,
      membership,
      badges: badges[0],
      message: `Successfully subscribed to ${tier.name}!`
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error subscribing:', error);
    res.status(500).json({ error: 'Failed to subscribe' });
  } finally {
    client.release();
  }
});

// Get subscription with badges
router.get('/status/:creatorId', authenticateToken, async (req, res) => {
  try {
    const { creatorId } = req.params;
    const userId = req.user.supabase_id;
    
    // Get membership
    const membershipQuery = await pool.query(
      `SELECT 
        m.*,
        mt.name as tier_name,
        mt.display_name,
        mt.color,
        mt.badge_icon,
        mt.perks as tier_perks,
        mt.session_discount_percent,
        mt.tokens_included
      FROM memberships m
      JOIN membership_tiers mt ON m.tier_id = mt.id
      WHERE m.user_id = $1 AND m.creator_id = $2 AND m.status = 'active'`,
      [userId, creatorId]
    );
    
    // Get loyalty badges
    const badges = await loyaltyService.getUserBadges(userId, creatorId);
    
    if (membershipQuery.rows.length === 0) {
      return res.json({
        success: true,
        subscribed: false,
        badges: badges[0] || null
      });
    }
    
    const membership = membershipQuery.rows[0];
    
    // Calculate combined benefits
    const combinedDiscount = loyaltyService.calculateCombinedDiscount(
      badges[0]?.loyalty?.level || 'bronze',
      membership.session_discount_percent
    );
    
    res.json({
      success: true,
      subscribed: true,
      membership: {
        ...membership,
        combinedDiscount,
        daysRemaining: Math.floor((new Date(membership.next_billing_date) - new Date()) / (1000 * 60 * 60 * 24))
      },
      badges: badges[0],
      perks: {
        subscription: membership.tier_perks,
        loyalty: badges[0]?.loyalty?.perks || [],
        combined: [...new Set([...(membership.tier_perks || []), ...(badges[0]?.loyalty?.perks || [])])]
      }
    });
    
  } catch (error) {
    logger.error('Error getting subscription status:', error);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

// Get all subscribers with dual badges for creator
router.get('/creator/:creatorId/subscribers', authenticateToken, async (req, res) => {
  try {
    const { creatorId } = req.params;
    
    // Verify requester is the creator
    if (req.user.supabase_id !== creatorId) {
      return res.status(403).json({ error: 'Creator access required' });
    }
    
    const subscribersQuery = await pool.query(
      `SELECT 
        m.*,
        u.username,
        u.display_name,
        u.profile_pic_url,
        mt.name as tier_name,
        mt.display_name as tier_display_name,
        mt.color as tier_color,
        lb.level as loyalty_level,
        lb.total_spend,
        lb.support_duration_days,
        lb.first_interaction_date
      FROM memberships m
      JOIN users u ON m.user_id = u.id
      JOIN membership_tiers mt ON m.tier_id = mt.id
      LEFT JOIN loyalty_badges lb ON m.user_id = lb.user_id AND m.creator_id = lb.creator_id
      WHERE m.creator_id = $1 AND m.status = 'active'
      ORDER BY mt.tier_level DESC, lb.total_spend DESC`,
      [creatorId]
    );
    
    const subscribers = subscribersQuery.rows.map(sub => ({
      ...sub,
      loyaltyEmoji: loyaltyService.getLoyaltyEmoji(sub.loyalty_level),
      subscriptionEmoji: loyaltyService.getSubscriptionEmoji(sub.tier_name),
      isVIP: sub.loyalty_level === 'diamond' || sub.loyalty_level === 'gold',
      combinedValue: parseFloat(sub.price_paid) + parseFloat(sub.total_spend || 0)
    }));
    
    // Get statistics
    const stats = {
      totalSubscribers: subscribers.length,
      monthlyRevenue: subscribers.reduce((sum, sub) => sum + parseFloat(sub.price_paid), 0),
      averageLifetimeValue: subscribers.reduce((sum, sub) => sum + (sub.total_spend || 0), 0) / subscribers.length,
      loyaltyDistribution: {
        diamond: subscribers.filter(s => s.loyalty_level === 'diamond').length,
        gold: subscribers.filter(s => s.loyalty_level === 'gold').length,
        silver: subscribers.filter(s => s.loyalty_level === 'silver').length,
        bronze: subscribers.filter(s => s.loyalty_level === 'bronze').length
      }
    };
    
    res.json({
      success: true,
      subscribers,
      stats
    });
    
  } catch (error) {
    logger.error('Error getting subscribers:', error);
    res.status(500).json({ error: 'Failed to get subscribers' });
  }
});

// Helper functions
async function createOrGetStripePrice(tier) {
  try {
    // Check if price already exists
    const prices = await stripe.prices.list({
      product: tier.stripe_product_id,
      active: true
    });
    
    if (prices.data.length > 0) {
      return prices.data[0];
    }
    
    // Create new product and price
    const product = await stripe.products.create({
      name: `${tier.name} Subscription`,
      metadata: {
        tier_id: tier.id,
        creator_id: tier.creator_id
      }
    });
    
    const price = await stripe.prices.create({
      unit_amount: Math.round(tier.price * 100),
      currency: 'usd',
      recurring: { interval: 'month' },
      product: product.id
    });
    
    // Update tier with Stripe product ID
    await pool.query(
      'UPDATE membership_tiers SET stripe_product_id = $1 WHERE id = $2',
      [product.id, tier.id]
    );
    
    return price;
  } catch (error) {
    logger.error('Error creating Stripe price:', error);
    throw error;
  }
}

function calculateCombinedPerks(tier, loyalty) {
  const tierPerks = tier.perks || [];
  const loyaltyPerks = loyalty?.perks || [];
  
  // Combine and deduplicate perks
  const combined = [...new Set([...tierPerks, ...loyaltyPerks])];
  
  // Add special combined perks for VIP members
  if (loyalty?.level === 'diamond' && tier.tier_level >= 8) {
    combined.push('VIP Creator Access');
    combined.push('Exclusive VIP Events');
  }
  
  return combined;
}

async function deliverSubscriptionPerks(userId, creatorId, tier) {
  const perks = tier.perks || [];
  
  for (const perk of perks) {
    await pool.query(
      `INSERT INTO perk_deliveries 
       (user_id, creator_id, perk_type, status, delivery_data, delivered_at)
       VALUES ($1, $2, 'subscription_perk', 'delivered', $3, CURRENT_TIMESTAMP)`,
      [userId, creatorId, JSON.stringify({ perk, tierName: tier.name })]
    );
  }
  
  // Send notification
  const io = require('../utils/socket').getIO();
  io.to(`user:${userId}`).emit('perks_delivered', {
    type: 'subscription',
    perks,
    message: `Your ${tier.name} perks are now active!`
  });
}

module.exports = router;