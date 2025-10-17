const { pool } = require('./db');
const { logger } = require('./logger');
const { publishToChannel } = require('./ably-adapter');
// Socket.io removed - using Ably
// const { getIO } = require('./socket');
const loyaltyService = require('./loyalty-service');

class ChallengeService {
  /**
   * Track progress on a challenge
   */
  async trackProgress(userId, creatorId, challengeType, incrementValue = 1) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get active challenges for this type
      const challenges = await client.query(
        `SELECT c.*, cp.current_value, cp.completed
         FROM loyalty_challenges c
         LEFT JOIN challenge_progress cp ON c.id = cp.challenge_id AND cp.user_id = $1
         WHERE c.challenge_type = $2 
           AND c.is_active = true
           AND (c.creator_id = $3 OR c.creator_id IS NULL)
           AND (cp.completed IS NULL OR cp.completed = false)`,
        [userId, challengeType, creatorId]
      );
      
      for (const challenge of challenges.rows) {
        const currentValue = (challenge.current_value || 0) + incrementValue;
        const completed = currentValue >= challenge.target_value;
        
        // Update or create progress
        await client.query(
          `INSERT INTO challenge_progress 
           (user_id, challenge_id, creator_id, current_value, completed, completed_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (user_id, challenge_id)
           DO UPDATE SET 
             current_value = $4,
             completed = $5,
             completed_at = $6,
             updated_at = CURRENT_TIMESTAMP`,
          [
            userId,
            challenge.id,
            creatorId,
            currentValue,
            completed,
            completed ? new Date() : null
          ]
        );
        
        // If completed, deliver rewards
        if (completed && !challenge.completed) {
          await this.deliverChallengeRewards(
            userId,
            creatorId,
            challenge
          );
        }
      }
      
      await client.query('COMMIT');
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error tracking challenge progress:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Deliver rewards for completed challenge
   */
  async deliverChallengeRewards(userId, creatorId, challenge) {
    try {
      // Add loyalty points
      await pool.query(
        `UPDATE loyalty_badges 
         SET loyalty_points = loyalty_points + $1,
             challenges_completed = challenges_completed + 1
         WHERE user_id = $2 AND creator_id = $3`,
        [challenge.reward_points, userId, creatorId]
      );
      
      // Add bonus tokens if any
      if (challenge.reward_tokens > 0) {
        await pool.query(
          `UPDATE users 
           SET token_balance = token_balance + $1 
           WHERE id = $2`,
          [challenge.reward_tokens, userId]
        );
        
        // Record transaction
        await pool.query(
          `INSERT INTO token_transactions 
           (user_id, amount, type, description, created_at)
           VALUES ($1, $2, 'challenge_reward', $3, NOW())`,
          [userId, challenge.reward_tokens, `Completed: ${challenge.name}`]
        );
      }
      
      // Send notifications
      try {
        await publishToChannel(`user:${userId}`, 'challenge_completed', {
          challengeId: challenge.id,
          name: challenge.name,
          rewards: {
            points: challenge.reward_points,
            tokens: challenge.reward_tokens
          },
          message: `🎉 Challenge completed: ${challenge.name}!`
        });
      } catch (ablyError) {
        logger.error('Failed to publish challenge_completed to Ably:', ablyError.message);
      }

      // Create notification
      await pool.query(
        `INSERT INTO notifications 
         (recipient_id, type, title, content, data, created_at)
         VALUES ($1, 'challenge_completed', $2, $3, $4, NOW())`,
        [
          userId,
          'Challenge Completed!',
          `You've completed "${challenge.name}" and earned ${challenge.reward_points} loyalty points!`,
          JSON.stringify({
            challengeId: challenge.id,
            rewards: {
              points: challenge.reward_points,
              tokens: challenge.reward_tokens
            }
          })
        ]
      );
      
      logger.info(`User ${userId} completed challenge ${challenge.id}`);
      
    } catch (error) {
      logger.error('Error delivering challenge rewards:', error);
      throw error;
    }
  }
  
  /**
   * Get user's challenge progress
   */
  async getUserChallenges(userId, creatorId = null) {
    try {
      const query = creatorId
        ? `SELECT 
            c.*,
            cp.current_value,
            cp.completed,
            cp.completed_at,
            CASE 
              WHEN cp.completed THEN 100
              ELSE ROUND((COALESCE(cp.current_value, 0)::DECIMAL / c.target_value) * 100, 2)
            END as progress_percent
          FROM loyalty_challenges c
          LEFT JOIN challenge_progress cp ON c.id = cp.challenge_id AND cp.user_id = $1
          WHERE c.is_active = true
            AND (c.creator_id = $2 OR c.creator_id IS NULL)
          ORDER BY cp.completed ASC, progress_percent DESC`
        : `SELECT 
            c.*,
            cp.current_value,
            cp.completed,
            cp.completed_at,
            CASE 
              WHEN cp.completed THEN 100
              ELSE ROUND((COALESCE(cp.current_value, 0)::DECIMAL / c.target_value) * 100, 2)
            END as progress_percent
          FROM loyalty_challenges c
          LEFT JOIN challenge_progress cp ON c.id = cp.challenge_id AND cp.user_id = $1
          WHERE c.is_active = true
            AND c.creator_id IS NULL
          ORDER BY cp.completed ASC, progress_percent DESC`;
      
      const params = creatorId ? [userId, creatorId] : [userId];
      const result = await pool.query(query, params);
      
      return result.rows.map(challenge => ({
        id: challenge.id,
        name: challenge.name,
        description: challenge.description,
        type: challenge.challenge_type,
        target: challenge.target_value,
        current: challenge.current_value || 0,
        completed: challenge.completed || false,
        completedAt: challenge.completed_at,
        progress: parseFloat(challenge.progress_percent) || 0,
        rewards: {
          points: challenge.reward_points,
          tokens: challenge.reward_tokens
        }
      }));
      
    } catch (error) {
      logger.error('Error getting user challenges:', error);
      throw error;
    }
  }
  
  /**
   * Create custom challenge for a creator
   */
  async createCreatorChallenge(creatorId, challengeData) {
    try {
      const result = await pool.query(
        `INSERT INTO loyalty_challenges 
         (creator_id, name, description, challenge_type, target_value, 
          reward_points, reward_tokens, is_active, end_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
         RETURNING *`,
        [
          creatorId,
          challengeData.name,
          challengeData.description,
          challengeData.type,
          challengeData.target,
          challengeData.rewardPoints,
          challengeData.rewardTokens || 0,
          challengeData.endDate || null
        ]
      );
      
      // Notify all fans
      try {
        await publishToChannel(`creator:${creatorId}:fans`, 'new_challenge', {
          challenge: result.rows[0],
          message: `New challenge available: ${challengeData.name}`
        });
      } catch (ablyError) {
        logger.error('Failed to publish new_challenge to Ably:', ablyError.message);
      }

      return result.rows[0];
      
    } catch (error) {
      logger.error('Error creating creator challenge:', error);
      throw error;
    }
  }
  
  /**
   * Check for milestone achievements
   */
  async checkMilestones(userId, creatorId) {
    try {
      const loyalty = await pool.query(
        `SELECT * FROM loyalty_badges 
         WHERE user_id = $1 AND creator_id = $2`,
        [userId, creatorId]
      );
      
      if (loyalty.rows.length === 0) return;
      
      const supportDays = loyalty.rows[0].support_duration_days;
      const milestones = [
        { days: 180, type: '6_months', tokens: 100, message: '6 months of support!' },
        { days: 365, type: '1_year', tokens: 200, message: '1 year anniversary!' },
        { days: 730, type: '2_years', tokens: 500, message: '2 years of loyalty!' }
      ];
      
      for (const milestone of milestones) {
        if (supportDays >= milestone.days) {
          // Check if already achieved
          const existing = await pool.query(
            `SELECT * FROM retention_milestones 
             WHERE user_id = $1 AND creator_id = $2 AND milestone_type = $3`,
            [userId, creatorId, milestone.type]
          );
          
          if (existing.rows.length === 0) {
            // Record milestone
            await pool.query(
              `INSERT INTO retention_milestones 
               (user_id, creator_id, milestone_type, reward_data)
               VALUES ($1, $2, $3, $4)`,
              [
                userId,
                creatorId,
                milestone.type,
                JSON.stringify({
                  tokens: milestone.tokens,
                  message: milestone.message
                })
              ]
            );
            
            // Deliver rewards
            await this.deliverMilestoneReward(userId, creatorId, milestone);
          }
        }
      }
      
    } catch (error) {
      logger.error('Error checking milestones:', error);
      throw error;
    }
  }
  
  /**
   * Deliver milestone rewards
   */
  async deliverMilestoneReward(userId, creatorId, milestone) {
    try {
      // Add bonus tokens
      await pool.query(
        `UPDATE users 
         SET token_balance = token_balance + $1 
         WHERE id = $2`,
        [milestone.tokens, userId]
      );
      
      // Record transaction
      await pool.query(
        `INSERT INTO token_transactions 
         (user_id, amount, type, description, created_at)
         VALUES ($1, $2, 'milestone_reward', $3, NOW())`,
        [userId, milestone.tokens, milestone.message]
      );
      
      // Send notification
      try {
        await publishToChannel(`user:${userId}`, 'milestone_achieved', {
          type: milestone.type,
          message: milestone.message,
          rewards: { tokens: milestone.tokens }
        });
      } catch (ablyError) {
        logger.error('Failed to publish milestone_achieved to Ably:', ablyError.message);
      }

      // Notify creator
      try {
        await publishToChannel(`user:${creatorId}`, 'fan_milestone', {
          fanId: userId,
          milestone: milestone.type,
          message: `A fan reached ${milestone.message}`
        });
      } catch (ablyError) {
        logger.error('Failed to publish fan_milestone to Ably:', ablyError.message);
      }

      logger.info(`User ${userId} achieved ${milestone.type} milestone with creator ${creatorId}`);
      
    } catch (error) {
      logger.error('Error delivering milestone reward:', error);
      throw error;
    }
  }
}

// Create singleton instance
const challengeService = new ChallengeService();

module.exports = challengeService;