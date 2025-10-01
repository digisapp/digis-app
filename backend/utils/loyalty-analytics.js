const { pool } = require('./db');
const { logger } = require('./logger');

class LoyaltyAnalytics {
  /**
   * Calculate churn risk for a user
   */
  async calculateChurnRisk(userId, creatorId) {
    try {
      // Get user's activity data
      const query = await pool.query(
        `SELECT 
          lb.support_duration_days,
          lb.total_spend,
          lb.last_interaction_date,
          lb.level,
          COUNT(DISTINCT DATE(sa.created_at)) as active_days_last_30,
          MAX(sa.created_at) as last_activity,
          AVG(CASE WHEN sa.created_at > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) as recent_activity_rate
        FROM loyalty_badges lb
        LEFT JOIN stream_activity_log sa ON sa.fan_id = lb.user_id
        WHERE lb.user_id = $1 AND lb.creator_id = $2
          AND sa.created_at > NOW() - INTERVAL '30 days'
        GROUP BY lb.support_duration_days, lb.total_spend, lb.last_interaction_date, lb.level`,
        [userId, creatorId]
      );
      
      if (query.rows.length === 0) {
        return { risk: 50, factors: ['No recent activity'] };
      }
      
      const data = query.rows[0];
      let riskScore = 0;
      const factors = [];
      
      // Factor 1: Days since last interaction (40% weight)
      const daysSinceInteraction = Math.floor(
        (Date.now() - new Date(data.last_interaction_date)) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceInteraction > 30) {
        riskScore += 40;
        factors.push('No interaction in 30+ days');
      } else if (daysSinceInteraction > 14) {
        riskScore += 25;
        factors.push('No interaction in 14+ days');
      } else if (daysSinceInteraction > 7) {
        riskScore += 15;
        factors.push('Reduced recent activity');
      }
      
      // Factor 2: Activity frequency decline (30% weight)
      const activityRate = parseFloat(data.recent_activity_rate) || 0;
      if (activityRate < 0.2) {
        riskScore += 30;
        factors.push('Very low activity rate');
      } else if (activityRate < 0.5) {
        riskScore += 15;
        factors.push('Declining activity');
      }
      
      // Factor 3: Loyalty level (20% weight)
      if (data.level === 'bronze') {
        riskScore += 20;
        factors.push('Low loyalty level');
      } else if (data.level === 'silver') {
        riskScore += 10;
      } else if (data.level === 'platinum') {
        riskScore -= 10; // Platinum members are less likely to churn
      }
      
      // Factor 4: Support duration (10% weight)
      if (data.support_duration_days < 30) {
        riskScore += 10;
        factors.push('New fan (< 30 days)');
      } else if (data.support_duration_days > 180) {
        riskScore -= 5; // Long-term supporters are more stable
      }
      
      // Cap risk score between 0-100
      riskScore = Math.max(0, Math.min(100, riskScore));
      
      return {
        risk: riskScore,
        factors,
        classification: this.getChurnRiskLevel(riskScore)
      };
      
    } catch (error) {
      logger.error('Error calculating churn risk:', error);
      return { risk: 50, factors: ['Unable to calculate'] };
    }
  }
  
  /**
   * Predict upgrade probability
   */
  async predictUpgradeProbability(userId, creatorId) {
    try {
      const query = await pool.query(
        `SELECT 
          lb.level,
          lb.total_spend,
          lb.support_duration_days,
          lb.next_tier_progress,
          m.tier_id,
          mt.tier_level,
          COUNT(DISTINCT tt.id) as transaction_count_30d,
          AVG(tt.amount) as avg_transaction_value
        FROM loyalty_badges lb
        LEFT JOIN memberships m ON m.user_id = lb.user_id AND m.creator_id = lb.creator_id
        LEFT JOIN membership_tiers mt ON m.tier_id = mt.id
        LEFT JOIN token_transactions tt ON tt.user_id = lb.user_id 
          AND tt.created_at > NOW() - INTERVAL '30 days'
        WHERE lb.user_id = $1 AND lb.creator_id = $2
        GROUP BY lb.level, lb.total_spend, lb.support_duration_days, 
                 lb.next_tier_progress, m.tier_id, mt.tier_level`,
        [userId, creatorId]
      );
      
      if (query.rows.length === 0) {
        return { probability: 10, factors: ['New user'] };
      }
      
      const data = query.rows[0];
      let probability = 20; // Base probability
      const factors = [];
      
      // Factor 1: Loyalty progression (30% weight)
      const tierProgress = parseFloat(data.next_tier_progress) || 0;
      if (tierProgress > 80) {
        probability += 30;
        factors.push('Close to next loyalty tier');
      } else if (tierProgress > 60) {
        probability += 20;
        factors.push('Good loyalty progression');
      } else if (tierProgress > 40) {
        probability += 10;
      }
      
      // Factor 2: Transaction frequency (25% weight)
      const transactionCount = parseInt(data.transaction_count_30d) || 0;
      if (transactionCount > 10) {
        probability += 25;
        factors.push('High transaction frequency');
      } else if (transactionCount > 5) {
        probability += 15;
        factors.push('Regular transactions');
      } else if (transactionCount > 2) {
        probability += 5;
      }
      
      // Factor 3: Current tier (20% weight)
      const currentTierLevel = parseInt(data.tier_level) || 0;
      if (currentTierLevel === 0) {
        probability += 20;
        factors.push('No subscription yet');
      } else if (currentTierLevel < 5) {
        probability += 10;
        factors.push('Room for tier upgrade');
      }
      
      // Factor 4: Spending trend (15% weight)
      const avgTransactionValue = parseFloat(data.avg_transaction_value) || 0;
      if (avgTransactionValue > 100) {
        probability += 15;
        factors.push('High-value spender');
      } else if (avgTransactionValue > 50) {
        probability += 10;
        factors.push('Medium-value spender');
      } else if (avgTransactionValue > 20) {
        probability += 5;
      }
      
      // Factor 5: Support duration (10% weight)
      if (data.support_duration_days > 90) {
        probability += 10;
        factors.push('Long-term supporter');
      } else if (data.support_duration_days > 30) {
        probability += 5;
        factors.push('Established supporter');
      }
      
      // Cap probability between 0-100
      probability = Math.max(0, Math.min(100, probability));
      
      return {
        probability,
        factors,
        recommendation: this.getUpgradeRecommendation(probability, data)
      };
      
    } catch (error) {
      logger.error('Error predicting upgrade probability:', error);
      return { probability: 20, factors: ['Unable to predict'] };
    }
  }
  
  /**
   * Calculate predicted lifetime value
   */
  async calculatePredictedLTV(userId, creatorId) {
    try {
      const query = await pool.query(
        `SELECT 
          lb.total_spend,
          lb.support_duration_days,
          lb.level,
          AVG(tt.amount) as avg_monthly_spend,
          COUNT(DISTINCT DATE_TRUNC('month', tt.created_at)) as active_months
        FROM loyalty_badges lb
        LEFT JOIN token_transactions tt ON tt.user_id = lb.user_id
        WHERE lb.user_id = $1 AND lb.creator_id = $2
        GROUP BY lb.total_spend, lb.support_duration_days, lb.level`,
        [userId, creatorId]
      );
      
      if (query.rows.length === 0) {
        return { ltv: 0, confidence: 'low' };
      }
      
      const data = query.rows[0];
      const avgMonthlySpend = parseFloat(data.avg_monthly_spend) || 0;
      const currentTotal = parseFloat(data.total_spend) || 0;
      
      // Predict retention based on loyalty level
      const retentionMonths = {
        platinum: 24,
        diamond: 18,
        gold: 12,
        silver: 6,
        bronze: 3
      };
      
      const expectedRetention = retentionMonths[data.level] || 3;
      const predictedFutureSpend = avgMonthlySpend * expectedRetention;
      const predictedLTV = currentTotal + predictedFutureSpend;
      
      // Calculate confidence level
      let confidence = 'low';
      if (data.active_months >= 6) {
        confidence = 'high';
      } else if (data.active_months >= 3) {
        confidence = 'medium';
      }
      
      return {
        ltv: Math.round(predictedLTV),
        currentValue: currentTotal,
        predictedFuture: Math.round(predictedFutureSpend),
        avgMonthlySpend: Math.round(avgMonthlySpend),
        expectedRetentionMonths: expectedRetention,
        confidence
      };
      
    } catch (error) {
      logger.error('Error calculating predicted LTV:', error);
      return { ltv: 0, confidence: 'error' };
    }
  }
  
  /**
   * Get creator analytics dashboard data
   */
  async getCreatorAnalytics(creatorId) {
    try {
      // Get loyalty distribution
      const distribution = await pool.query(
        `SELECT 
          level,
          COUNT(*) as count,
          AVG(total_spend) as avg_spend,
          AVG(support_duration_days) as avg_days
        FROM loyalty_badges
        WHERE creator_id = $1 AND is_active = true
        GROUP BY level
        ORDER BY 
          CASE level
            WHEN 'platinum' THEN 1
            WHEN 'diamond' THEN 2
            WHEN 'gold' THEN 3
            WHEN 'silver' THEN 4
            WHEN 'bronze' THEN 5
            ELSE 6
          END`,
        [creatorId]
      );
      
      // Get upgrade paths
      const upgradePaths = await pool.query(
        `SELECT 
          old_level,
          new_level,
          COUNT(*) as count,
          AVG(days_to_upgrade) as avg_days
        FROM (
          SELECT 
            LAG(level) OVER (PARTITION BY user_id ORDER BY updated_at) as old_level,
            level as new_level,
            EXTRACT(DAY FROM updated_at - LAG(updated_at) OVER (PARTITION BY user_id ORDER BY updated_at)) as days_to_upgrade
          FROM loyalty_badges
          WHERE creator_id = $1
        ) as upgrades
        WHERE old_level IS NOT NULL AND old_level != new_level
        GROUP BY old_level, new_level`,
        [creatorId]
      );
      
      // Get retention metrics
      const retention = await pool.query(
        `SELECT 
          level,
          AVG(CASE WHEN last_interaction_date > NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END) * 100 as retention_30d,
          AVG(CASE WHEN last_interaction_date > NOW() - INTERVAL '60 days' THEN 1 ELSE 0 END) * 100 as retention_60d,
          AVG(CASE WHEN last_interaction_date > NOW() - INTERVAL '90 days' THEN 1 ELSE 0 END) * 100 as retention_90d
        FROM loyalty_badges
        WHERE creator_id = $1 AND is_active = true
        GROUP BY level`,
        [creatorId]
      );
      
      // Get revenue by badge combination
      const revenueByBadge = await pool.query(
        `SELECT 
          lb.level as loyalty_level,
          mt.name as subscription_tier,
          COUNT(DISTINCT lb.user_id) as user_count,
          SUM(lb.total_spend) as total_revenue,
          AVG(lb.total_spend) as avg_revenue_per_user
        FROM loyalty_badges lb
        LEFT JOIN memberships m ON m.user_id = lb.user_id AND m.creator_id = lb.creator_id
        LEFT JOIN membership_tiers mt ON m.tier_id = mt.id
        WHERE lb.creator_id = $1
        GROUP BY lb.level, mt.name
        ORDER BY total_revenue DESC`,
        [creatorId]
      );
      
      return {
        distribution: distribution.rows,
        upgradePaths: upgradePaths.rows,
        retention: retention.rows,
        revenueByBadge: revenueByBadge.rows,
        summary: {
          totalFans: distribution.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
          avgLoyaltyValue: distribution.rows.reduce((sum, row) => sum + parseFloat(row.avg_spend), 0) / distribution.rows.length,
          platinumPercentage: this.calculatePercentage(distribution.rows, 'platinum'),
          diamondPercentage: this.calculatePercentage(distribution.rows, 'diamond')
        }
      };
      
    } catch (error) {
      logger.error('Error getting creator analytics:', error);
      throw error;
    }
  }
  
  /**
   * Store prediction results
   */
  async storePredictions(userId, creatorId, predictions) {
    try {
      await pool.query(
        `INSERT INTO loyalty_predictions 
         (user_id, creator_id, churn_risk_percent, upgrade_probability, 
          predicted_ltv, next_likely_action)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, creator_id)
         DO UPDATE SET 
           churn_risk_percent = $3,
           upgrade_probability = $4,
           predicted_ltv = $5,
           next_likely_action = $6,
           calculated_at = CURRENT_TIMESTAMP`,
        [
          userId,
          creatorId,
          predictions.churnRisk,
          predictions.upgradeProbability,
          predictions.predictedLTV,
          predictions.nextAction
        ]
      );
      
    } catch (error) {
      logger.error('Error storing predictions:', error);
      throw error;
    }
  }
  
  // Helper methods
  getChurnRiskLevel(score) {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }
  
  getUpgradeRecommendation(probability, data) {
    if (probability >= 70) {
      return 'Send personalized upgrade offer';
    } else if (probability >= 50) {
      return 'Highlight benefits of next tier';
    } else if (probability >= 30) {
      return 'Nurture with exclusive content';
    }
    return 'Focus on engagement';
  }
  
  calculatePercentage(distribution, level) {
    const total = distribution.reduce((sum, row) => sum + parseInt(row.count), 0);
    const levelCount = distribution.find(row => row.level === level)?.count || 0;
    return total > 0 ? Math.round((levelCount / total) * 100) : 0;
  }
  
  /**
   * Get next likely action for a user
   */
  async predictNextAction(userId, creatorId) {
    const churnRisk = await this.calculateChurnRisk(userId, creatorId);
    const upgradeProbability = await this.predictUpgradeProbability(userId, creatorId);
    
    if (churnRisk.risk > 70) {
      return 'at_risk_of_leaving';
    } else if (upgradeProbability.probability > 70) {
      return 'likely_to_upgrade';
    } else if (upgradeProbability.probability > 50) {
      return 'considering_upgrade';
    } else {
      return 'stable_engagement';
    }
  }
}

// Create singleton instance
const loyaltyAnalytics = new LoyaltyAnalytics();

module.exports = loyaltyAnalytics;