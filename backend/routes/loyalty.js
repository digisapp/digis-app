const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const loyaltyService = require('../utils/loyalty-service');
const { pool } = require('../utils/db');
const logger = require('../utils/logger');

// Get user's combined badges (loyalty + subscription)
router.get('/badges/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { creatorId } = req.query;
    
    const badges = await loyaltyService.getUserBadges(userId, creatorId);
    
    res.json({
      success: true,
      badges: badges[0] || null
    });
  } catch (error) {
    logger.error('Error fetching badges:', error);
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

// Get all loyalty badges for a user
router.get('/user/:userId/all', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await pool.query(
      `SELECT 
        lb.*,
        c.username as creator_username,
        c.display_name as creator_display_name,
        c.profile_pic_url as creator_profile_pic
      FROM loyalty_badges lb
      JOIN users c ON lb.creator_id = c.id
      WHERE lb.user_id = $1
      ORDER BY lb.total_spend DESC`,
      [userId]
    );
    
    res.json({
      success: true,
      loyaltyBadges: result.rows
    });
  } catch (error) {
    logger.error('Error fetching all loyalty badges:', error);
    res.status(500).json({ error: 'Failed to fetch loyalty badges' });
  }
});

// Get top supporters for a creator
router.get('/creator/:creatorId/top-supporters', async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { limit = 10 } = req.query;
    
    const topSupporters = await loyaltyService.getTopSupporters(creatorId, parseInt(limit));
    
    res.json({
      success: true,
      topSupporters
    });
  } catch (error) {
    logger.error('Error fetching top supporters:', error);
    res.status(500).json({ error: 'Failed to fetch top supporters' });
  }
});

// Track interaction and update loyalty
router.post('/track-interaction', authenticateToken, async (req, res) => {
  try {
    const { creatorId, amount = 0, interactionType } = req.body;
    const userId = req.user.supabase_id;

    // Validate amount is positive
    if (amount < 0) {
      return res.status(400).json({
        error: 'Amount must be a positive value'
      });
    }
    
    const badge = await loyaltyService.trackInteraction(
      userId, 
      creatorId, 
      amount, 
      interactionType
    );
    
    res.json({
      success: true,
      badge
    });
  } catch (error) {
    logger.error('Error tracking interaction:', error);
    res.status(500).json({ error: 'Failed to track interaction' });
  }
});

// Get combined perks for a user
router.get('/perks/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { creatorId } = req.query;
    
    // Get loyalty perks
    const loyaltyResult = await pool.query(
      `SELECT perks FROM loyalty_badges 
       WHERE user_id = $1 AND creator_id = $2`,
      [userId, creatorId]
    );
    
    // Get subscription perks
    const subscriptionResult = await pool.query(
      `SELECT mt.perks, mt.session_discount_percent, mt.tokens_included
       FROM memberships m
       JOIN membership_tiers mt ON m.tier_id = mt.id
       WHERE m.user_id = $1 AND m.creator_id = $2 AND m.status = 'active'`,
      [userId, creatorId]
    );
    
    const loyaltyPerks = loyaltyResult.rows[0]?.perks || [];
    const subscriptionPerks = subscriptionResult.rows[0]?.perks || [];
    
    // Calculate combined discount
    const loyaltyBadge = await pool.query(
      `SELECT level FROM loyalty_badges WHERE user_id = $1 AND creator_id = $2`,
      [userId, creatorId]
    );
    
    const combinedDiscount = loyaltyService.calculateCombinedDiscount(
      loyaltyBadge.rows[0]?.level || 'bronze',
      subscriptionResult.rows[0]?.session_discount_percent || 0
    );
    
    res.json({
      success: true,
      perks: {
        loyalty: loyaltyPerks,
        subscription: subscriptionPerks,
        combined: [...new Set([...loyaltyPerks, ...subscriptionPerks])],
        totalDiscount: combinedDiscount,
        tokensIncluded: subscriptionResult.rows[0]?.tokens_included || 0
      }
    });
  } catch (error) {
    logger.error('Error fetching perks:', error);
    res.status(500).json({ error: 'Failed to fetch perks' });
  }
});

// Get perk delivery history
router.get('/perks/history/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await pool.query(
      `SELECT 
        pd.*,
        c.username as creator_username,
        c.display_name as creator_display_name
      FROM perk_deliveries pd
      LEFT JOIN users c ON pd.creator_id = c.id
      WHERE pd.user_id = $1
      ORDER BY pd.created_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    
    res.json({
      success: true,
      deliveries: result.rows
    });
  } catch (error) {
    logger.error('Error fetching perk history:', error);
    res.status(500).json({ error: 'Failed to fetch perk history' });
  }
});

// Manually deliver a perk (creator action)
router.post('/perks/deliver', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;
    const { userId, perkType, deliveryData } = req.body;
    
    // Verify requester is a creator
    const creatorCheck = await pool.query(
      'SELECT is_creator FROM users WHERE id = $1',
      [creatorId]
    );
    
    if (!creatorCheck.rows[0]?.is_creator) {
      return res.status(403).json({ error: 'Creator access required' });
    }
    
    // Deliver the perk
    await pool.query(
      `INSERT INTO perk_deliveries 
       (user_id, creator_id, perk_type, status, delivery_data, delivered_at)
       VALUES ($1, $2, $3, 'delivered', $4, CURRENT_TIMESTAMP)`,
      [userId, creatorId, perkType, JSON.stringify(deliveryData)]
    );
    
    // Notify the user
// Socket.io removed - using Ably
//     const io = require('../utils/socket').getIO();
// TODO: Replace with Ably publish
//     io.to(`user:${userId}`).emit('perk_delivered', {
      type: perkType,
      data: deliveryData,
      creatorId
    });
    
    res.json({
      success: true,
      message: 'Perk delivered successfully'
    });
  } catch (error) {
    logger.error('Error delivering perk:', error);
    res.status(500).json({ error: 'Failed to deliver perk' });
  }
});

// Get loyalty statistics for creator dashboard
router.get('/creator/:creatorId/stats', authenticateToken, async (req, res) => {
  try {
    const { creatorId } = req.params;
    
    // Verify requester is the creator
    if (req.user.supabase_id !== creatorId) {
      const creatorCheck = await pool.query(
        'SELECT is_creator FROM users WHERE id = $1',
        [req.user.supabase_id]
      );
      
      if (!creatorCheck.rows[0]?.is_creator) {
        return res.status(403).json({ error: 'Creator access required' });
      }
    }
    
    // Get loyalty distribution
    const distribution = await pool.query(
      `SELECT 
        level,
        COUNT(*) as count,
        SUM(total_spend) as total_spend
      FROM loyalty_badges
      WHERE creator_id = $1
      GROUP BY level`,
      [creatorId]
    );
    
    // Get subscription + loyalty combo stats
    const comboStats = await pool.query(
      `SELECT 
        lb.level as loyalty_level,
        mt.name as subscription_tier,
        COUNT(*) as count
      FROM loyalty_badges lb
      JOIN memberships m ON lb.user_id = m.user_id AND lb.creator_id = m.creator_id
      JOIN membership_tiers mt ON m.tier_id = mt.id
      WHERE lb.creator_id = $1 AND m.status = 'active'
      GROUP BY lb.level, mt.name`,
      [creatorId]
    );
    
    // Get recent upgrades
    const recentUpgrades = await pool.query(
      `SELECT 
        lb.user_id,
        lb.level,
        lb.updated_at,
        u.username,
        u.display_name
      FROM loyalty_badges lb
      JOIN users u ON lb.user_id = u.id
      WHERE lb.creator_id = $1 
        AND lb.updated_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
      ORDER BY lb.updated_at DESC
      LIMIT 10`,
      [creatorId]
    );
    
    res.json({
      success: true,
      stats: {
        distribution: distribution.rows,
        comboStats: comboStats.rows,
        recentUpgrades: recentUpgrades.rows,
        totalLoyalFans: distribution.rows.reduce((sum, row) => sum + parseInt(row.count), 0)
      }
    });
  } catch (error) {
    logger.error('Error fetching loyalty stats:', error);
    res.status(500).json({ error: 'Failed to fetch loyalty stats' });
  }
});

module.exports = router;