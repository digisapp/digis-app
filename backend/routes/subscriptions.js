const express = require('express');
const { Pool } = require('pg');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Get creator's subscription plans
router.get('/creator/:creatorId/plans', authenticateToken, async (req, res) => {
  try {
    const { creatorId } = req.params;

    const plansQuery = await pool.query(`
      SELECT 
        sp.*,
        u.username as creator_username,
        COUNT(cs.id) as subscriber_count
      FROM subscription_plans sp
      JOIN users u ON sp.creator_id = u.id
      LEFT JOIN creator_subscriptions cs ON sp.id = cs.plan_id AND cs.status = 'active'
      WHERE sp.creator_id = $1 AND sp.is_active = true
      GROUP BY sp.id, u.username
      ORDER BY sp.price ASC
    `, [creatorId]);

    res.json({
      success: true,
      plans: plansQuery.rows.map(plan => ({
        id: plan.id,
        creatorId: plan.creator_id,
        creatorUsername: plan.creator_username,
        name: plan.name,
        description: plan.description,
        price: parseFloat(plan.price),
        billingInterval: plan.billing_interval,
        features: plan.features,
        subscriberCount: parseInt(plan.subscriber_count),
        isActive: plan.is_active,
        createdAt: plan.created_at
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching subscription plans:', error);
    res.status(500).json({ error: 'Failed to fetch subscription plans' });
  }
});

// Create a new subscription plan (creator only)
router.post('/plans', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;
    const { name, description, price, billingInterval, features, perks } = req.body;

    // Verify user is a creator
    const creatorQuery = await pool.query(
      'SELECT is_creator FROM users WHERE supabase_id = $1',
      [creatorId]
    );

    if (creatorQuery.rows.length === 0 || !creatorQuery.rows[0].is_creator) {
      return res.status(403).json({ error: 'Creator access required' });
    }

    // Create Stripe product and price
    const stripeProduct = await stripe.products.create({
      name: `${name} - Subscription`,
      description: description,
      metadata: {
        creator_id: creatorId,
        plan_type: 'creator_subscription'
      }
    });

    const stripePrice = await stripe.prices.create({
      product: stripeProduct.id,
      unit_amount: Math.round(price * 100), // Convert to cents
      currency: 'usd',
      recurring: {
        interval: billingInterval // 'month' or 'year'
      },
      metadata: {
        creator_id: creatorId
      }
    });

    // Save plan to database
    const planQuery = await pool.query(`
      INSERT INTO subscription_plans 
      (creator_id, name, description, price, billing_interval, features, perks, stripe_product_id, stripe_price_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      creatorId, name, description, price, billingInterval, 
      JSON.stringify(features), JSON.stringify(perks),
      stripeProduct.id, stripePrice.id
    ]);

    const plan = planQuery.rows[0];

    res.json({
      success: true,
      message: 'Subscription plan created successfully',
      plan: {
        id: plan.id,
        creatorId: plan.creator_id,
        name: plan.name,
        description: plan.description,
        price: parseFloat(plan.price),
        billingInterval: plan.billing_interval,
        features: plan.features,
        perks: plan.perks,
        stripeProductId: plan.stripe_product_id,
        stripePriceId: plan.stripe_price_id
      }
    });

  } catch (error) {
    console.error('❌ Error creating subscription plan:', error);
    res.status(500).json({ error: 'Failed to create subscription plan' });
  }
});

// Subscribe to a creator's plan
router.post('/subscribe', authenticateToken, async (req, res) => {
  try {
    const subscriberId = req.user.supabase_id;
    const { planId, paymentMethodId } = req.body;

    // Get plan details
    const planQuery = await pool.query(`
      SELECT sp.*, u.username as creator_username
      FROM subscription_plans sp
      JOIN users u ON sp.creator_id = u.id
      WHERE sp.id = $1 AND sp.is_active = true
    `, [planId]);

    if (planQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Subscription plan not found' });
    }

    const plan = planQuery.rows[0];

    // Check if user is already subscribed
    const existingSubQuery = await pool.query(`
      SELECT id FROM creator_subscriptions 
      WHERE subscriber_id = $1 AND plan_id = $2 AND status = 'active'
    `, [subscriberId, planId]);

    if (existingSubQuery.rows.length > 0) {
      return res.status(400).json({ error: 'Already subscribed to this plan' });
    }

    // Get or create Stripe customer
    const userQuery = await pool.query(
      'SELECT email, stripe_customer_id FROM users WHERE supabase_id = $1',
      [subscriberId]
    );

    let customerId = userQuery.rows[0]?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userQuery.rows[0]?.email,
        metadata: {
          supabase_id: subscriberId
        }
      });

      customerId = customer.id;

      // Update user with Stripe customer ID
      await pool.query(
        'UPDATE users SET stripe_customer_id = $1 WHERE supabase_id = $2',
        [customerId, subscriberId]
      );
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    // Create subscription in Stripe
    const stripeSubscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{
        price: plan.stripe_price_id,
      }],
      default_payment_method: paymentMethodId,
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        creator_id: plan.creator_id,
        subscriber_id: subscriberId,
        plan_id: planId
      }
    });

    // Save subscription to database
    const subscriptionQuery = await pool.query(`
      INSERT INTO creator_subscriptions 
      (subscriber_id, creator_id, plan_id, stripe_subscription_id, status, current_period_start, current_period_end)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      subscriberId, 
      plan.creator_id, 
      planId, 
      stripeSubscription.id,
      stripeSubscription.status,
      new Date(stripeSubscription.current_period_start * 1000),
      new Date(stripeSubscription.current_period_end * 1000)
    ]);

    // Create notification for creator
    await pool.query(`
      INSERT INTO notifications (recipient_id, type, title, content, created_at)
      VALUES ($1, 'new_subscriber', 'New Subscriber!', 
              $2, NOW())
    `, [
      plan.creator_id,
      `${userQuery.rows[0]?.username || 'Someone'} just subscribed to your ${plan.name} plan!`
    ]);

    res.json({
      success: true,
      message: 'Successfully subscribed!',
      subscription: {
        id: subscriptionQuery.rows[0].id,
        planName: plan.name,
        creatorUsername: plan.creator_username,
        status: stripeSubscription.status,
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000)
      },
      clientSecret: stripeSubscription.latest_invoice.payment_intent.client_secret
    });

  } catch (error) {
    console.error('❌ Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// Get user's subscriptions
router.get('/my-subscriptions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;

    const subscriptionsQuery = await pool.query(`
      SELECT 
        cs.*,
        sp.name as plan_name,
        sp.description as plan_description,
        sp.price,
        sp.billing_interval,
        sp.features,
        sp.perks,
        u.username as creator_username,
        u.profile_pic_url as creator_profile_pic
      FROM creator_subscriptions cs
      JOIN subscription_plans sp ON cs.plan_id = sp.id
      JOIN users u ON cs.creator_id = u.id
      WHERE cs.subscriber_id = $1
      ORDER BY cs.created_at DESC
    `, [userId]);

    res.json({
      success: true,
      subscriptions: subscriptionsQuery.rows.map(sub => ({
        id: sub.id,
        planId: sub.plan_id,
        planName: sub.plan_name,
        planDescription: sub.plan_description,
        price: parseFloat(sub.price),
        billingInterval: sub.billing_interval,
        features: sub.features,
        perks: sub.perks,
        creatorId: sub.creator_id,
        creatorUsername: sub.creator_username,
        creatorProfilePic: sub.creator_profile_pic,
        status: sub.status,
        currentPeriodStart: sub.current_period_start,
        currentPeriodEnd: sub.current_period_end,
        createdAt: sub.created_at
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching user subscriptions:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// Cancel subscription
router.post('/cancel/:subscriptionId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { subscriptionId } = req.params;
    const { cancelAtPeriodEnd = true } = req.body;

    // Get subscription details
    const subQuery = await pool.query(`
      SELECT cs.*, sp.name as plan_name, u.username as creator_username
      FROM creator_subscriptions cs
      JOIN subscription_plans sp ON cs.plan_id = sp.id
      JOIN users u ON cs.creator_id = u.id
      WHERE cs.id = $1 AND cs.subscriber_id = $2
    `, [subscriptionId, userId]);

    if (subQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const subscription = subQuery.rows[0];

    // Cancel in Stripe
    const stripeSubscription = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      {
        cancel_at_period_end: cancelAtPeriodEnd
      }
    );

    // Update database
    const newStatus = cancelAtPeriodEnd ? 'cancel_at_period_end' : 'canceled';
    await pool.query(`
      UPDATE creator_subscriptions 
      SET status = $1, canceled_at = NOW()
      WHERE id = $2
    `, [newStatus, subscriptionId]);

    // Notify creator
    await pool.query(`
      INSERT INTO notifications (recipient_id, type, title, content, created_at)
      VALUES ($1, 'subscription_canceled', 'Subscription Canceled', 
              $2, NOW())
    `, [
      subscription.creator_id,
      `A subscriber canceled their ${subscription.plan_name} subscription.`
    ]);

    res.json({
      success: true,
      message: cancelAtPeriodEnd 
        ? 'Subscription will be canceled at the end of the current period'
        : 'Subscription canceled immediately',
      subscription: {
        id: subscriptionId,
        status: newStatus,
        canceledAt: new Date()
      }
    });

  } catch (error) {
    console.error('❌ Error canceling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Get creator's subscribers
router.get('/my-subscribers', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;

    // Verify user is a creator
    const creatorQuery = await pool.query(
      'SELECT is_creator FROM users WHERE supabase_id = $1',
      [creatorId]
    );

    if (creatorQuery.rows.length === 0 || !creatorQuery.rows[0].is_creator) {
      return res.status(403).json({ error: 'Creator access required' });
    }

    const subscribersQuery = await pool.query(`
      SELECT 
        cs.*,
        sp.name as plan_name,
        sp.price,
        sp.billing_interval,
        u.username as subscriber_username,
        u.profile_pic_url as subscriber_profile_pic,
        u.email as subscriber_email
      FROM creator_subscriptions cs
      JOIN subscription_plans sp ON cs.plan_id = sp.id
      JOIN users u ON cs.subscriber_id::text = u.id::text
      WHERE cs.creator_id = $1 AND cs.status IN ('active', 'cancel_at_period_end')
      ORDER BY cs.created_at DESC
    `, [creatorId]);

    // Get subscription stats
    const statsQuery = await pool.query(`
      SELECT 
        COUNT(*) as total_subscribers,
        SUM(sp.price) as monthly_recurring_revenue,
        COUNT(*) FILTER (WHERE cs.status = 'active') as active_subscribers,
        COUNT(*) FILTER (WHERE cs.status = 'cancel_at_period_end') as canceling_subscribers
      FROM creator_subscriptions cs
      JOIN subscription_plans sp ON cs.plan_id = sp.id
      WHERE cs.creator_id = $1 AND cs.status IN ('active', 'cancel_at_period_end')
    `, [creatorId]);

    const stats = statsQuery.rows[0];

    res.json({
      success: true,
      subscribers: subscribersQuery.rows.map(sub => ({
        id: sub.id,
        subscriberId: sub.subscriber_id,
        subscriberUsername: sub.subscriber_username,
        subscriberProfilePic: sub.subscriber_profile_pic,
        subscriberEmail: sub.subscriber_email,
        planId: sub.plan_id,
        planName: sub.plan_name,
        price: parseFloat(sub.price),
        billingInterval: sub.billing_interval,
        status: sub.status,
        currentPeriodStart: sub.current_period_start,
        currentPeriodEnd: sub.current_period_end,
        createdAt: sub.created_at
      })),
      stats: {
        totalSubscribers: parseInt(stats.total_subscribers) || 0,
        monthlyRecurringRevenue: parseFloat(stats.monthly_recurring_revenue) || 0,
        activeSubscribers: parseInt(stats.active_subscribers) || 0,
        cancelingSubscribers: parseInt(stats.canceling_subscribers) || 0
      }
    });

  } catch (error) {
    console.error('❌ Error fetching subscribers:', error);
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

// Update subscription plan
router.put('/plans/:planId', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;
    const { planId } = req.params;
    const { name, description, features, perks, isActive } = req.body;

    // Verify creator owns this plan
    const planQuery = await pool.query(
      'SELECT * FROM subscription_plans WHERE id = $1 AND creator_id = $2',
      [planId, creatorId]
    );

    if (planQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Plan not found or access denied' });
    }

    // Update plan
    const updatedPlanQuery = await pool.query(`
      UPDATE subscription_plans 
      SET name = $1, description = $2, features = $3, perks = $4, is_active = $5, updated_at = NOW()
      WHERE id = $6 AND creator_id = $7
      RETURNING *
    `, [name, description, JSON.stringify(features), JSON.stringify(perks), isActive, planId, creatorId]);

    const plan = updatedPlanQuery.rows[0];

    // Update Stripe product if needed
    if (name !== plan.name || description !== plan.description) {
      await stripe.products.update(plan.stripe_product_id, {
        name: `${name} - Subscription`,
        description: description
      });
    }

    res.json({
      success: true,
      message: 'Subscription plan updated successfully',
      plan: {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        features: plan.features,
        perks: plan.perks,
        isActive: plan.is_active
      }
    });

  } catch (error) {
    console.error('❌ Error updating subscription plan:', error);
    res.status(500).json({ error: 'Failed to update subscription plan' });
  }
});

// Get creator's subscription tiers (alias for CreatorStudio)
router.get('/creator-tiers', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id || req.user.uid;
    
    // Get user's database ID
    const userQuery = await pool.query(
      'SELECT id, is_creator FROM users WHERE supabase_id = $1',
      [userId]
    );
    
    if (userQuery.rows.length === 0 || !userQuery.rows[0].is_creator) {
      return res.status(403).json({ 
        error: 'Creator access required',
        timestamp: new Date().toISOString()
      });
    }
    
    const creatorId = userQuery.rows[0].id;
    
    const tiersQuery = await pool.query(`
      SELECT 
        sp.*,
        COUNT(cs.id) as subscriber_count
      FROM subscription_plans sp
      LEFT JOIN creator_subscriptions cs ON sp.id = cs.plan_id AND cs.status = 'active'
      WHERE sp.creator_id = $1
      GROUP BY sp.id
      ORDER BY sp.price ASC
    `, [creatorId]);
    
    res.json({
      success: true,
      tiers: tiersQuery.rows.map(tier => ({
        id: tier.id,
        name: tier.name,
        description: tier.description,
        price: parseFloat(tier.price),
        billingInterval: tier.billing_interval,
        features: tier.features,
        perks: tier.perks,
        subscriberCount: parseInt(tier.subscriber_count),
        isActive: tier.is_active,
        createdAt: tier.created_at,
        updatedAt: tier.updated_at
      })),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error fetching creator tiers:', error);
    res.status(500).json({ 
      error: 'Failed to fetch subscription tiers',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get creator's subscribers list
router.get('/subscribers', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id || req.user.uid;
    
    // Get user's database ID
    const userQuery = await pool.query(
      'SELECT id, is_creator FROM users WHERE supabase_id = $1',
      [userId]
    );
    
    if (userQuery.rows.length === 0 || !userQuery.rows[0].is_creator) {
      return res.status(403).json({ 
        error: 'Creator access required',
        timestamp: new Date().toISOString()
      });
    }
    
    const creatorId = userQuery.rows[0].id;
    
    const subscribersQuery = await pool.query(`
      SELECT 
        cs.*,
        u.username as subscriber_username,
        u.display_name as subscriber_display_name,
        u.profile_pic_url as subscriber_profile_pic,
        u.email as subscriber_email,
        sp.name as plan_name,
        sp.price as plan_price
      FROM creator_subscriptions cs
      JOIN users u ON cs.subscriber_id = u.id
      JOIN subscription_plans sp ON cs.plan_id = sp.id
      WHERE cs.creator_id = $1 AND cs.status = 'active'
      ORDER BY cs.created_at DESC
    `, [creatorId]);
    
    res.json({
      success: true,
      subscribers: subscribersQuery.rows.map(sub => ({
        id: sub.id,
        subscriberId: sub.subscriber_id,
        username: sub.subscriber_username,
        displayName: sub.subscriber_display_name,
        profilePicUrl: sub.subscriber_profile_pic,
        email: sub.subscriber_email,
        planId: sub.plan_id,
        planName: sub.plan_name,
        planPrice: parseFloat(sub.plan_price),
        status: sub.status,
        subscribedAt: sub.created_at,
        nextBillingDate: sub.next_billing_date,
        cancelledAt: sub.cancelled_at
      })),
      totalCount: subscribersQuery.rows.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error fetching subscribers:', error);
    res.status(500).json({ 
      error: 'Failed to fetch subscribers',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;