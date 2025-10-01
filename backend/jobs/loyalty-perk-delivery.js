const cron = require('node-cron');
const { pool } = require('../utils/db');
const loyaltyService = require('../utils/loyalty-service');
const logger = require('../utils/logger');
const { getIO } = require('../utils/socket');

/**
 * Automated Perk Delivery System
 * Runs various scheduled jobs to deliver perks based on loyalty levels
 */

class LoyaltyPerkDeliveryJob {
  constructor() {
    this.jobs = [];
  }

  /**
   * Initialize all cron jobs
   */
  start() {
    logger.info('Starting Loyalty Perk Delivery Jobs...');

    // Daily perks for Diamond members (every day at 10 AM)
    this.jobs.push(
      cron.schedule('0 10 * * *', () => {
        this.deliverDailyDiamondPerks();
      }, {
        timezone: 'America/New_York'
      })
    );

    // Weekly perks for Gold members (every Monday at 10 AM)
    this.jobs.push(
      cron.schedule('0 10 * * 1', () => {
        this.deliverWeeklyGoldPerks();
      }, {
        timezone: 'America/New_York'
      })
    );

    // Monthly loyalty bonus tokens (1st of each month at midnight)
    this.jobs.push(
      cron.schedule('0 0 1 * *', () => {
        this.deliverMonthlyLoyaltyTokens();
      }, {
        timezone: 'America/New_York'
      })
    );

    // Check for badge upgrades (every hour)
    this.jobs.push(
      cron.schedule('0 * * * *', () => {
        this.checkAndUpgradeBadges();
      })
    );

    // Deliver milestone rewards (every 6 hours)
    this.jobs.push(
      cron.schedule('0 */6 * * *', () => {
        this.deliverMilestoneRewards();
      })
    );

    logger.info('Loyalty Perk Delivery Jobs started successfully');
  }

  /**
   * Stop all cron jobs
   */
  stop() {
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    logger.info('Loyalty Perk Delivery Jobs stopped');
  }

  /**
   * Deliver daily perks to Diamond level members
   */
  async deliverDailyDiamondPerks() {
    const client = await pool.connect();
    
    try {
      logger.info('Starting daily Diamond perks delivery...');
      
      // Get all Diamond level members
      const diamondMembers = await client.query(`
        SELECT DISTINCT
          lb.user_id,
          lb.creator_id,
          lb.total_spend,
          lb.support_duration_days,
          u.username,
          u.email,
          c.username as creator_username
        FROM loyalty_badges lb
        JOIN users u ON lb.user_id = u.id
        LEFT JOIN users c ON lb.creator_id = c.id
        WHERE lb.level = 'diamond'
          AND lb.is_active = true
      `);

      for (const member of diamondMembers.rows) {
        await this.deliverPerk(
          member.user_id,
          member.creator_id,
          'daily_diamond',
          {
            type: 'exclusive_content',
            message: 'Your daily Diamond member exclusive content is ready!',
            tokens: 10, // Bonus tokens
            content: {
              accessLevel: 'diamond_only',
              validFor: 24 * 60 * 60 * 1000 // 24 hours
            }
          }
        );
      }

      logger.info(`Daily Diamond perks delivered to ${diamondMembers.rows.length} members`);
      
    } catch (error) {
      logger.error('Error delivering daily Diamond perks:', error);
    } finally {
      client.release();
    }
  }

  /**
   * Deliver weekly perks to Gold level members
   */
  async deliverWeeklyGoldPerks() {
    const client = await pool.connect();
    
    try {
      logger.info('Starting weekly Gold perks delivery...');
      
      const goldMembers = await client.query(`
        SELECT DISTINCT
          lb.user_id,
          lb.creator_id,
          u.username,
          c.username as creator_username
        FROM loyalty_badges lb
        JOIN users u ON lb.user_id = u.id
        LEFT JOIN users c ON lb.creator_id = c.id
        WHERE lb.level IN ('gold', 'diamond')
          AND lb.is_active = true
      `);

      for (const member of goldMembers.rows) {
        await this.deliverPerk(
          member.user_id,
          member.creator_id,
          'weekly_gold',
          {
            type: 'special_access',
            message: 'Your weekly Gold member benefits are available!',
            tokens: 5, // Bonus tokens
            content: {
              accessLevel: 'gold_plus',
              features: ['priority_booking', 'exclusive_content'],
              validFor: 7 * 24 * 60 * 60 * 1000 // 7 days
            }
          }
        );
      }

      logger.info(`Weekly Gold perks delivered to ${goldMembers.rows.length} members`);
      
    } catch (error) {
      logger.error('Error delivering weekly Gold perks:', error);
    } finally {
      client.release();
    }
  }

  /**
   * Deliver monthly loyalty bonus tokens
   */
  async deliverMonthlyLoyaltyTokens() {
    const client = await pool.connect();
    
    try {
      logger.info('Starting monthly loyalty token distribution...');
      
      await client.query('BEGIN');
      
      // Get all active loyalty members with their levels
      const loyaltyMembers = await client.query(`
        SELECT 
          lb.user_id,
          lb.creator_id,
          lb.level,
          lb.total_spend,
          lb.support_duration_days,
          u.username
        FROM loyalty_badges lb
        JOIN users u ON lb.user_id = u.id
        WHERE lb.is_active = true
          AND lb.level != 'none'
        ORDER BY lb.level DESC, lb.total_spend DESC
      `);

      const tokenBonus = {
        diamond: 100,
        gold: 50,
        silver: 25,
        bronze: 10
      };

      for (const member of loyaltyMembers.rows) {
        const bonusTokens = tokenBonus[member.level] || 0;
        
        if (bonusTokens > 0) {
          // Add tokens to user balance
          await client.query(
            `UPDATE users 
             SET token_balance = token_balance + $1 
             WHERE id = $2`,
            [bonusTokens, member.user_id]
          );
          
          // Record transaction
          await client.query(
            `INSERT INTO token_transactions 
             (user_id, amount, type, description, created_at)
             VALUES ($1, $2, 'loyalty_bonus', $3, NOW())`,
            [
              member.user_id,
              bonusTokens,
              `Monthly ${member.level} loyalty bonus`
            ]
          );
          
          // Record perk delivery
          await this.deliverPerk(
            member.user_id,
            member.creator_id,
            'monthly_tokens',
            {
              type: 'token_bonus',
              message: `Your monthly ${member.level} loyalty bonus: ${bonusTokens} tokens!`,
              tokens: bonusTokens
            }
          );
        }
      }

      await client.query('COMMIT');
      
      logger.info(`Monthly loyalty tokens distributed to ${loyaltyMembers.rows.length} members`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error distributing monthly loyalty tokens:', error);
    } finally {
      client.release();
    }
  }

  /**
   * Check and upgrade badges based on spending and time
   */
  async checkAndUpgradeBadges() {
    const client = await pool.connect();
    
    try {
      logger.info('Checking for badge upgrades...');
      
      // Get all active badges that might need upgrading
      const badges = await client.query(`
        SELECT 
          lb.*,
          u.username,
          c.username as creator_username
        FROM loyalty_badges lb
        JOIN users u ON lb.user_id = u.id
        LEFT JOIN users c ON lb.creator_id = c.id
        WHERE lb.is_active = true
      `);

      let upgradeCount = 0;
      
      for (const badge of badges.rows) {
        const oldLevel = badge.level;
        const newLevel = loyaltyService.calculateBadgeLevel(
          badge.total_spend,
          badge.support_duration_days
        );
        
        if (newLevel !== oldLevel) {
          // Upgrade the badge
          await client.query(
            `UPDATE loyalty_badges 
             SET level = $1, updated_at = NOW() 
             WHERE id = $2`,
            [newLevel, badge.id]
          );
          
          // Deliver upgrade notification and perks
          await this.deliverPerk(
            badge.user_id,
            badge.creator_id,
            'badge_upgrade',
            {
              type: 'badge_upgrade',
              message: `Congratulations! Your loyalty badge has been upgraded from ${oldLevel} to ${newLevel}!`,
              oldLevel,
              newLevel,
              rewards: this.getUpgradeRewards(newLevel)
            }
          );
          
          upgradeCount++;
          
          // Notify via socket
          const io = getIO();
          if (io) {
            io.to(`user:${badge.user_id}`).emit('loyalty_upgraded', {
              creatorId: badge.creator_id,
              oldLevel,
              newLevel,
              perks: loyaltyService.getLoyaltyPerks(newLevel)
            });
          }
        }
      }
      
      if (upgradeCount > 0) {
        logger.info(`Upgraded ${upgradeCount} loyalty badges`);
      }
      
    } catch (error) {
      logger.error('Error checking badge upgrades:', error);
    } finally {
      client.release();
    }
  }

  /**
   * Deliver milestone rewards
   */
  async deliverMilestoneRewards() {
    const client = await pool.connect();
    
    try {
      logger.info('Checking for milestone rewards...');
      
      const milestones = [
        { days: 30, tokens: 20, type: '1_month' },
        { days: 90, tokens: 50, type: '3_months' },
        { days: 180, tokens: 100, type: '6_months' },
        { days: 365, tokens: 200, type: '1_year' }
      ];
      
      for (const milestone of milestones) {
        // Find users who just hit this milestone
        const eligibleUsers = await client.query(`
          SELECT 
            lb.user_id,
            lb.creator_id,
            lb.support_duration_days,
            u.username
          FROM loyalty_badges lb
          JOIN users u ON lb.user_id = u.id
          WHERE lb.support_duration_days = $1
            AND lb.is_active = true
            AND NOT EXISTS (
              SELECT 1 FROM perk_deliveries pd
              WHERE pd.user_id = lb.user_id
                AND pd.creator_id = lb.creator_id
                AND pd.perk_type = $2
            )
        `, [milestone.days, `milestone_${milestone.type}`]);
        
        for (const user of eligibleUsers.rows) {
          await this.deliverPerk(
            user.user_id,
            user.creator_id,
            `milestone_${milestone.type}`,
            {
              type: 'milestone_reward',
              message: `Milestone reached! ${milestone.days} days of support - ${milestone.tokens} bonus tokens!`,
              tokens: milestone.tokens,
              milestone: milestone.type
            }
          );
          
          // Add bonus tokens
          await client.query(
            `UPDATE users 
             SET token_balance = token_balance + $1 
             WHERE id = $2`,
            [milestone.tokens, user.user_id]
          );
        }
        
        if (eligibleUsers.rows.length > 0) {
          logger.info(`Delivered ${milestone.type} milestone rewards to ${eligibleUsers.rows.length} users`);
        }
      }
      
    } catch (error) {
      logger.error('Error delivering milestone rewards:', error);
    } finally {
      client.release();
    }
  }

  /**
   * Deliver a perk to a user
   */
  async deliverPerk(userId, creatorId, perkType, deliveryData) {
    try {
      await pool.query(
        `INSERT INTO perk_deliveries 
         (user_id, creator_id, perk_type, delivery_data, status, delivered_at)
         VALUES ($1, $2, $3, $4, 'delivered', NOW())`,
        [userId, creatorId, perkType, JSON.stringify(deliveryData)]
      );
      
      // Send in-app notification
      await pool.query(
        `INSERT INTO notifications 
         (recipient_id, type, title, content, data, created_at)
         VALUES ($1, 'perk_delivery', $2, $3, $4, NOW())`,
        [
          userId,
          'Loyalty Perk Delivered!',
          deliveryData.message,
          JSON.stringify({ perkType, ...deliveryData })
        ]
      );
      
      // Send socket notification
      const io = getIO();
      if (io) {
        io.to(`user:${userId}`).emit('perk_delivered', {
          type: perkType,
          message: deliveryData.message,
          data: deliveryData
        });
      }
      
    } catch (error) {
      logger.error(`Error delivering perk ${perkType} to user ${userId}:`, error);
    }
  }

  /**
   * Get rewards for badge upgrade
   */
  getUpgradeRewards(level) {
    const rewards = {
      silver: {
        tokens: 25,
        perks: ['Silver badge display', 'Monthly bonus tokens', 'Priority support']
      },
      gold: {
        tokens: 50,
        perks: ['Gold badge display', 'Weekly exclusive content', 'VIP support', 'Special discounts']
      },
      diamond: {
        tokens: 100,
        perks: ['Diamond badge display', 'Daily exclusive content', 'Maximum discounts', 'VIP creator access', 'Special events']
      }
    };
    
    return rewards[level] || { tokens: 0, perks: [] };
  }
}

// Create singleton instance
const loyaltyPerkDeliveryJob = new LoyaltyPerkDeliveryJob();

module.exports = loyaltyPerkDeliveryJob;