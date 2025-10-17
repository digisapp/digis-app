const { pool } = require('./db');
const logger = require('./logger');
const { publishToChannel } = require('./ably-adapter');
// Socket.io removed - using Ably
// const { io } = require('./socket');

class LoyaltyService {
  constructor() {
    this.badgeThresholds = {
      platinum: { spend: 2000, days: 730 }, // 2 years or $2000+
      diamond: { spend: 500, days: 180 },
      gold: { spend: 100, days: 90 },
      silver: { spend: 50, days: 30 },
      bronze: { spend: 0, days: 0 }
    };
  }

  /**
   * Track user interaction and update loyalty
   */
  async trackInteraction(userId, creatorId, amount = 0, interactionType = 'view') {
    // Enforce positive values to prevent abuse
    if (amount < 0) {
      throw new Error('Amount must be a positive value');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get or create loyalty badge record
      let badge = await client.query(
        `SELECT * FROM loyalty_badges WHERE user_id = $1 AND creator_id = $2`,
        [userId, creatorId]
      );

      if (badge.rows.length === 0) {
        // Create new loyalty record
        const result = await client.query(
          `INSERT INTO loyalty_badges 
           (user_id, creator_id, total_spend, support_duration_days, first_interaction_date)
           VALUES ($1, $2, $3, 0, CURRENT_TIMESTAMP)
           RETURNING *`,
          [userId, creatorId, amount]
        );
        badge = result;
      } else {
        // Update existing record
        const result = await client.query(
          `UPDATE loyalty_badges 
           SET total_spend = total_spend + $1,
               last_interaction_date = CURRENT_TIMESTAMP
           WHERE user_id = $2 AND creator_id = $3
           RETURNING *`,
          [amount, userId, creatorId]
        );
        badge = result;
      }

      await client.query('COMMIT');

      // Check if badge level changed
      const newLevel = this.calculateBadgeLevel(
        badge.rows[0].total_spend,
        badge.rows[0].support_duration_days
      );

      if (newLevel !== badge.rows[0].level) {
        await this.upgradeBadge(userId, creatorId, newLevel);
      }

      return badge.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error tracking interaction:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Calculate badge level based on spend and duration
   */
  calculateBadgeLevel(totalSpend, supportDays) {
    if (totalSpend >= this.badgeThresholds.platinum.spend || 
        supportDays >= this.badgeThresholds.platinum.days) {
      return 'platinum';
    } else if (totalSpend >= this.badgeThresholds.diamond.spend || 
               supportDays >= this.badgeThresholds.diamond.days) {
      return 'diamond';
    } else if (totalSpend >= this.badgeThresholds.gold.spend || 
               supportDays >= this.badgeThresholds.gold.days) {
      return 'gold';
    } else if (totalSpend >= this.badgeThresholds.silver.spend || 
               supportDays >= this.badgeThresholds.silver.days) {
      return 'silver';
    }
    return 'bronze';
  }

  /**
   * Upgrade user badge and notify
   */
  async upgradeBadge(userId, creatorId, newLevel) {
    try {
      // Update badge level
      await pool.query(
        `UPDATE loyalty_badges 
         SET level = $1, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND creator_id = $3`,
        [newLevel, userId, creatorId]
      );

      // Deliver upgrade perks
      await this.deliverUpgradePerks(userId, creatorId, newLevel);

      // Send notification
      try {
        await publishToChannel(`user:${userId}`, 'loyalty_upgraded', {
          creatorId,
          newLevel,
          message: `Congratulations! You've been upgraded to ${newLevel} status!`,
          perks: this.getLevelPerks(newLevel)
        });
      } catch (ablyError) {
        logger.error('Failed to publish loyalty_upgraded to Ably:', ablyError.message);
      }

      // Notify creator
      try {
        await publishToChannel(`user:${creatorId}`, 'fan_loyalty_upgrade', {
          fanId: userId,
          newLevel,
          message: `A fan has reached ${newLevel} loyalty status!`
        });
      } catch (ablyError) {
        logger.error('Failed to publish fan_loyalty_upgrade to Ably:', ablyError.message);
      }

      logger.info(`User ${userId} upgraded to ${newLevel} for creator ${creatorId}`);
    } catch (error) {
      logger.error('Error upgrading badge:', error);
      throw error;
    }
  }

  /**
   * Get loyalty perks for a level
   */
  getLevelPerks(level) {
    const perks = {
      platinum: [
        '25% maximum discount on all content',
        'VIP direct creator access',
        'Daily exclusive content',
        'Personal video messages monthly',
        'Co-host opportunities',
        'Custom content creation',
        '200 bonus tokens monthly',
        'Exclusive platinum-only events',
        'Profile featured on creator page'
      ],
      diamond: [
        '20% extra discount on all content',
        'Priority response from creator',
        'Exclusive monthly content',
        'Custom shoutouts',
        'Early access to new features',
        '100 bonus tokens monthly'
      ],
      gold: [
        '15% extra discount on all content',
        'Priority in call queues',
        'Weekly exclusive content',
        'Birthday message from creator',
        '50 bonus tokens monthly'
      ],
      silver: [
        '10% extra discount on all content',
        'Early access to new content',
        'Monthly exclusive content',
        '25 bonus tokens monthly'
      ],
      bronze: [
        '5% welcome discount',
        'Community access',
        'New fan appreciation perks'
      ]
    };
    return perks[level] || perks.bronze;
  }

  /**
   * Deliver perks when badge upgrades
   */
  async deliverUpgradePerks(userId, creatorId, level) {
    const perks = this.getLevelPerks(level);
    
    for (const perk of perks) {
      await pool.query(
        `INSERT INTO perk_deliveries 
         (user_id, creator_id, perk_type, status, delivery_data, delivered_at)
         VALUES ($1, $2, $3, 'delivered', $4, CURRENT_TIMESTAMP)`,
        [userId, creatorId, 'loyalty_upgrade', JSON.stringify({ perk, level })]
      );
    }

    // Add bonus tokens if applicable
    const bonusTokens = {
      diamond: 100,
      gold: 50,
      silver: 25,
      bronze: 0
    };

    if (bonusTokens[level] > 0) {
      await pool.query(
        `UPDATE users 
         SET token_balance = token_balance + $1
         WHERE id = $2`,
        [bonusTokens[level], userId]
      );

      // Log token transaction
      await pool.query(
        `INSERT INTO token_transactions 
         (user_id, amount, type, description, created_at)
         VALUES ($1, $2, 'loyalty_bonus', $3, CURRENT_TIMESTAMP)`,
        [userId, bonusTokens[level], `${level} loyalty bonus`]
      );
    }
  }

  /**
   * Get combined badges for a user
   */
  async getUserBadges(userId, creatorId = null) {
    try {
      let query = `
        SELECT 
          lb.*,
          m.tier_id,
          mt.name as subscription_tier,
          mt.display_name as subscription_display_name,
          mt.color as subscription_color,
          mt.badge_icon as subscription_icon,
          m.status as subscription_status,
          u.username,
          u.display_name
        FROM users u
        LEFT JOIN loyalty_badges lb ON u.id = lb.user_id
        LEFT JOIN memberships m ON u.id = m.user_id AND m.status = 'active'
        LEFT JOIN membership_tiers mt ON m.tier_id = mt.id
        WHERE u.id = $1
      `;

      const params = [userId];
      
      if (creatorId) {
        query += ` AND (lb.creator_id = $2 OR lb.creator_id IS NULL)`;
        params.push(creatorId);
      }

      const result = await pool.query(query, params);
      
      return result.rows.map(row => ({
        userId: row.user_id,
        username: row.username,
        displayName: row.display_name,
        loyalty: {
          level: row.level || 'none',
          emoji: this.getLoyaltyEmoji(row.level),
          totalSpend: row.total_spend || 0,
          supportDays: row.support_duration_days || 0,
          perks: row.perks || []
        },
        subscription: row.tier_id ? {
          tier: row.subscription_tier,
          displayName: row.subscription_display_name,
          color: row.subscription_color,
          icon: row.subscription_icon,
          status: row.subscription_status,
          emoji: this.getSubscriptionEmoji(row.subscription_tier)
        } : null
      }));
    } catch (error) {
      logger.error('Error getting user badges:', error);
      return [];
    }
  }

  /**
   * Get loyalty emoji for display
   */
  getLoyaltyEmoji(level) {
    const emojis = {
      diamond: '💎',
      gold: '🥇',
      silver: '🥈',
      bronze: '🥉'
    };
    return emojis[level] || '';
  }

  /**
   * Get subscription emoji based on tier name
   */
  getSubscriptionEmoji(tierName) {
    if (!tierName) return '';
    
    const lowerTier = tierName.toLowerCase();
    if (lowerTier.includes('vip') || lowerTier.includes('premium')) return '👑';
    if (lowerTier.includes('gold')) return '🟨';
    if (lowerTier.includes('silver')) return '🩶';
    if (lowerTier.includes('bronze')) return '🟫';
    return '⭐';
  }

  /**
   * Calculate combined discount
   */
  calculateCombinedDiscount(loyaltyLevel, subscriptionDiscount = 0) {
    const loyaltyDiscounts = {
      diamond: 20,
      gold: 15,
      silver: 10,
      bronze: 5
    };

    const loyaltyDiscount = loyaltyDiscounts[loyaltyLevel] || 0;
    
    // Combined discount (max 50% to maintain profitability)
    return Math.min(50, subscriptionDiscount + loyaltyDiscount);
  }

  /**
   * Get creator's top supporters
   */
  async getTopSupporters(creatorId, limit = 10) {
    try {
      const result = await pool.query(
        `SELECT 
          lb.*,
          u.username,
          u.display_name,
          u.profile_pic_url,
          m.tier_id,
          mt.name as subscription_tier
        FROM loyalty_badges lb
        JOIN users u ON lb.user_id = u.id
        LEFT JOIN memberships m ON lb.user_id = m.user_id AND m.creator_id = lb.creator_id AND m.status = 'active'
        LEFT JOIN membership_tiers mt ON m.tier_id = mt.id
        WHERE lb.creator_id = $1
        ORDER BY lb.total_spend DESC, lb.support_duration_days DESC
        LIMIT $2`,
        [creatorId, limit]
      );

      return result.rows.map((supporter, index) => ({
        rank: index + 1,
        userId: supporter.user_id,
        username: supporter.username,
        displayName: supporter.display_name,
        profilePic: supporter.profile_pic_url,
        loyaltyLevel: supporter.level,
        loyaltyEmoji: this.getLoyaltyEmoji(supporter.level),
        subscriptionTier: supporter.subscription_tier,
        totalSpend: supporter.total_spend,
        supportDays: supporter.support_duration_days,
        isTopSpender: index < 3
      }));
    } catch (error) {
      logger.error('Error getting top supporters:', error);
      return [];
    }
  }

  /**
   * Check and deliver scheduled perks
   */
  async deliverScheduledPerks() {
    try {
      // Daily photo delivery for Diamond members
      const diamondMembers = await pool.query(
        `SELECT DISTINCT lb.user_id, lb.creator_id
         FROM loyalty_badges lb
         JOIN memberships m ON lb.user_id = m.user_id AND lb.creator_id = m.creator_id
         WHERE lb.level = 'diamond' AND m.status = 'active'`
      );

      for (const member of diamondMembers.rows) {
        await this.deliverDailyPerk(member.user_id, member.creator_id, 'daily_exclusive_photo');
      }

      // Weekly content for Gold members
      const goldMembers = await pool.query(
        `SELECT DISTINCT lb.user_id, lb.creator_id
         FROM loyalty_badges lb
         JOIN memberships m ON lb.user_id = m.user_id AND lb.creator_id = m.creator_id
         WHERE lb.level IN ('gold', 'diamond') AND m.status = 'active'`
      );

      for (const member of goldMembers.rows) {
        await this.deliverWeeklyPerk(member.user_id, member.creator_id, 'weekly_exclusive_content');
      }

      logger.info('Scheduled perks delivered successfully');
    } catch (error) {
      logger.error('Error delivering scheduled perks:', error);
    }
  }

  /**
   * Deliver daily perk
   */
  async deliverDailyPerk(userId, creatorId, perkType) {
    // Check if already delivered today
    const existing = await pool.query(
      `SELECT id FROM perk_deliveries 
       WHERE user_id = $1 AND creator_id = $2 AND perk_type = $3
       AND DATE(created_at) = CURRENT_DATE`,
      [userId, creatorId, perkType]
    );

    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO perk_deliveries
         (user_id, creator_id, perk_type, status, delivery_data, delivered_at)
         VALUES ($1, $2, $3, 'delivered', $4, CURRENT_TIMESTAMP)`,
        [userId, creatorId, perkType, JSON.stringify({
          message: 'Your daily exclusive content is ready!',
          url: `/exclusive/${creatorId}/daily`
        })]
      );

      try {
        await publishToChannel(`user:${userId}`, 'perk_delivered', {
          type: perkType,
          message: 'Your daily exclusive content is ready!'
        });
      } catch (ablyError) {
        logger.error('Failed to publish perk_delivered to Ably:', ablyError.message);
      }
    }
  }

  /**
   * Deliver weekly perk
   */
  async deliverWeeklyPerk(userId, creatorId, perkType) {
    // Check if already delivered this week
    const existing = await pool.query(
      `SELECT id FROM perk_deliveries 
       WHERE user_id = $1 AND creator_id = $2 AND perk_type = $3
       AND created_at >= CURRENT_DATE - INTERVAL '7 days'`,
      [userId, creatorId, perkType]
    );

    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO perk_deliveries
         (user_id, creator_id, perk_type, status, delivery_data, delivered_at)
         VALUES ($1, $2, $3, 'delivered', $4, CURRENT_TIMESTAMP)`,
        [userId, creatorId, perkType, JSON.stringify({
          message: 'Your weekly exclusive content is ready!',
          url: `/exclusive/${creatorId}/weekly`
        })]
      );

      try {
        await publishToChannel(`user:${userId}`, 'perk_delivered', {
          type: perkType,
          message: 'Your weekly exclusive content is ready!'
        });
      } catch (ablyError) {
        logger.error('Failed to publish perk_delivered to Ably:', ablyError.message);
      }
    }
  }
}

// Create singleton instance
const loyaltyService = new LoyaltyService();

module.exports = loyaltyService;