/**
 * Anti-Fraud Middleware
 *
 * Practical fraud prevention focusing on the highest-risk scenarios:
 * 1. Velocity limits (prevent rapid token drain)
 * 2. Daily spend caps (limit blast radius of compromised accounts)
 * 3. New account restrictions (prevent stolen card → instant cashout)
 * 4. Suspicious pattern detection (buy→tip→cashout loops)
 *
 * Design Philosophy:
 * - Block obvious fraud (>99% malicious)
 * - Allow legitimate edge cases with manual review
 * - Low false positive rate (don't block real users)
 */

const { pool } = require('../utils/db');
const { logger } = require('../utils/secureLogger');

// Configuration
const LIMITS = {
  // Spend limits (tokens per time period)
  HOURLY_SPEND_LIMIT: 10000,      // $500 worth per hour
  DAILY_SPEND_LIMIT: 50000,       // $2,500 worth per day

  // Velocity limits (actions per time period)
  TIPS_PER_HOUR: 20,               // Max 20 tips/hour (legitimate use case)
  GIFTS_PER_HOUR: 10,              // Max 10 gifts/hour
  PURCHASES_PER_HOUR: 5,           // Max 5 purchases/hour

  // Payout restrictions
  MIN_ACCOUNT_AGE_FOR_PAYOUT: 72,  // 72 hours (3 days)
  MIN_EARNING_HISTORY: 48,         // Must have earnings >48h old

  // Pattern detection
  CASHOUT_VELOCITY_WINDOW: 24,    // Hours to check buy→cashout pattern
  SUSPICIOUS_CASHOUT_RATIO: 0.9,  // >90% of tokens earned go to cashout

  // Auto-block thresholds
  MAX_FAILED_PURCHASES: 3,         // Block after 3 failed purchases/hour
};

/**
 * Check if user has exceeded hourly spend limit
 */
async function checkHourlySpendLimit(userId, additionalSpend = 0) {
  const result = await pool.query(`
    SELECT COALESCE(SUM(ABS(tokens)), 0) AS spent
    FROM token_transactions
    WHERE user_id = $1
      AND tokens < 0
      AND type IN ('tip', 'gift_sent', 'call')
      AND created_at >= NOW() - INTERVAL '1 hour'
      AND status = 'completed'
  `, [userId]);

  const spent = parseInt(result.rows[0].spent);
  const total = spent + additionalSpend;

  if (total > LIMITS.HOURLY_SPEND_LIMIT) {
    return {
      allowed: false,
      reason: 'hourly_limit_exceeded',
      limit: LIMITS.HOURLY_SPEND_LIMIT,
      current: spent,
      attempted: additionalSpend,
      message: `Hourly spend limit reached (${spent}/${LIMITS.HOURLY_SPEND_LIMIT} tokens). Try again in an hour.`
    };
  }

  return { allowed: true, spent, limit: LIMITS.HOURLY_SPEND_LIMIT };
}

/**
 * Check if user has exceeded daily spend limit
 */
async function checkDailySpendLimit(userId, additionalSpend = 0) {
  const result = await pool.query(`
    SELECT COALESCE(SUM(ABS(tokens)), 0) AS spent
    FROM token_transactions
    WHERE user_id = $1
      AND tokens < 0
      AND type IN ('tip', 'gift_sent', 'call', 'payout')
      AND created_at >= NOW() - INTERVAL '24 hours'
      AND status = 'completed'
  `, [userId]);

  const spent = parseInt(result.rows[0].spent);
  const total = spent + additionalSpend;

  if (total > LIMITS.DAILY_SPEND_LIMIT) {
    return {
      allowed: false,
      reason: 'daily_limit_exceeded',
      limit: LIMITS.DAILY_SPEND_LIMIT,
      current: spent,
      attempted: additionalSpend,
      message: `Daily spend limit reached (${spent}/${LIMITS.DAILY_SPEND_LIMIT} tokens). Limit resets in 24 hours.`
    };
  }

  return { allowed: true, spent, limit: LIMITS.DAILY_SPEND_LIMIT };
}

/**
 * Check velocity limits (number of actions per hour)
 */
async function checkVelocityLimit(userId, actionType) {
  const typeMap = {
    'tip': { limit: LIMITS.TIPS_PER_HOUR, types: ['tip'] },
    'gift': { limit: LIMITS.GIFTS_PER_HOUR, types: ['gift_sent'] },
    'purchase': { limit: LIMITS.PURCHASES_PER_HOUR, types: ['purchase', 'quick_purchase'] }
  };

  const config = typeMap[actionType];
  if (!config) return { allowed: true };

  const result = await pool.query(`
    SELECT COUNT(*) AS count
    FROM token_transactions
    WHERE user_id = $1
      AND type = ANY($2)
      AND created_at >= NOW() - INTERVAL '1 hour'
  `, [userId, config.types]);

  const count = parseInt(result.rows[0].count);

  if (count >= config.limit) {
    return {
      allowed: false,
      reason: `${actionType}_velocity_exceeded`,
      limit: config.limit,
      current: count,
      message: `Too many ${actionType} actions. Max ${config.limit} per hour.`
    };
  }

  return { allowed: true, count, limit: config.limit };
}

/**
 * Check if account is old enough for payout
 */
async function checkPayoutEligibility(userId, payoutAmount) {
  const result = await pool.query(`
    SELECT
      u.created_at,
      EXTRACT(EPOCH FROM (NOW() - u.created_at))/3600 AS account_age_hours,
      MIN(t.created_at) AS first_earning,
      EXTRACT(EPOCH FROM (NOW() - MIN(t.created_at)))/3600 AS earning_age_hours
    FROM users u
    LEFT JOIN token_transactions t
      ON t.user_id = u.supabase_id
      AND t.tokens > 0
      AND t.type IN ('tip', 'call', 'gift_received')
    WHERE u.supabase_id = $1
    GROUP BY u.created_at
  `, [userId]);

  if (result.rows.length === 0) {
    return {
      allowed: false,
      reason: 'user_not_found',
      message: 'User not found'
    };
  }

  const { account_age_hours, first_earning, earning_age_hours } = result.rows[0];

  // Check minimum account age
  if (account_age_hours < LIMITS.MIN_ACCOUNT_AGE_FOR_PAYOUT) {
    return {
      allowed: false,
      reason: 'account_too_new',
      accountAge: account_age_hours,
      requiredAge: LIMITS.MIN_ACCOUNT_AGE_FOR_PAYOUT,
      message: `Account must be at least ${LIMITS.MIN_ACCOUNT_AGE_FOR_PAYOUT} hours old for payouts. Current age: ${Math.floor(account_age_hours)} hours.`
    };
  }

  // Check if user has earning history
  if (!first_earning) {
    return {
      allowed: false,
      reason: 'no_earning_history',
      message: 'No earning history found. Complete at least one paid session before requesting payout.'
    };
  }

  // Check minimum earning age (prevent instant cashout)
  if (earning_age_hours < LIMITS.MIN_EARNING_HISTORY) {
    return {
      allowed: false,
      reason: 'earnings_too_recent',
      earningAge: earning_age_hours,
      requiredAge: LIMITS.MIN_EARNING_HISTORY,
      message: `Earnings must age for ${LIMITS.MIN_EARNING_HISTORY} hours before payout. Earliest payout: ${Math.floor(LIMITS.MIN_EARNING_HISTORY - earning_age_hours)} hours from now.`
    };
  }

  return {
    allowed: true,
    accountAge: account_age_hours,
    earningAge: earning_age_hours
  };
}

/**
 * Detect suspicious cashout patterns
 * Pattern: User receives tokens → immediately cashes out (money mule behavior)
 */
async function checkCashoutPattern(userId, payoutAmount) {
  const result = await pool.query(`
    WITH recent_activity AS (
      SELECT
        SUM(CASE WHEN tokens > 0 THEN tokens ELSE 0 END) AS total_earned,
        SUM(CASE WHEN tokens < 0 AND type = 'payout' THEN ABS(tokens) ELSE 0 END) AS total_cashed_out,
        COUNT(DISTINCT CASE WHEN tokens > 0 THEN DATE(created_at) END) AS earning_days,
        COUNT(DISTINCT CASE WHEN type = 'payout' THEN DATE(created_at) END) AS payout_days
      FROM token_transactions
      WHERE user_id = $1
        AND created_at >= NOW() - INTERVAL '${LIMITS.CASHOUT_VELOCITY_WINDOW} hours'
    )
    SELECT
      total_earned,
      total_cashed_out,
      earning_days,
      payout_days,
      CASE
        WHEN total_earned > 0 THEN (total_cashed_out::float / total_earned::float)
        ELSE 0
      END AS cashout_ratio
    FROM recent_activity
  `, [userId]);

  const { total_earned, total_cashed_out, earning_days, payout_days, cashout_ratio } = result.rows[0];

  // Red flag: >90% of earnings immediately cashed out
  if (cashout_ratio > LIMITS.SUSPICIOUS_CASHOUT_RATIO && total_earned > 1000) {
    await createFraudAlert(userId, 'suspicious_cashout_pattern', {
      totalEarned: total_earned,
      totalCashedOut: total_cashed_out,
      cashoutRatio: cashout_ratio,
      earningDays: earning_days,
      payoutDays: payout_days,
      attemptedPayout: payoutAmount
    });

    return {
      allowed: false,
      reason: 'suspicious_cashout_pattern',
      requiresReview: true,
      cashoutRatio,
      message: 'Payout flagged for review. Support will contact you within 24 hours.'
    };
  }

  return { allowed: true, cashoutRatio };
}

/**
 * Check for rapid purchase failures (stolen card testing)
 */
async function checkFailedPurchases(userId) {
  const result = await pool.query(`
    SELECT COUNT(*) AS failed_count
    FROM token_transactions
    WHERE user_id = $1
      AND type IN ('purchase', 'quick_purchase')
      AND status = 'failed'
      AND created_at >= NOW() - INTERVAL '1 hour'
  `, [userId]);

  const failedCount = parseInt(result.rows[0].failed_count);

  if (failedCount >= LIMITS.MAX_FAILED_PURCHASES) {
    await createFraudAlert(userId, 'excessive_failed_purchases', {
      failedCount,
      timeWindow: '1 hour'
    });

    return {
      allowed: false,
      reason: 'excessive_failed_purchases',
      failedCount,
      message: 'Multiple failed purchase attempts detected. Account temporarily restricted. Contact support.'
    };
  }

  return { allowed: true, failedCount };
}

/**
 * Create fraud alert for manual review
 */
async function createFraudAlert(userId, alertType, details) {
  try {
    await pool.query(`
      INSERT INTO fraud_alerts (user_id, alert_type, details, status, created_at)
      VALUES ($1, $2, $3, 'pending', NOW())
      ON CONFLICT (user_id, alert_type)
      WHERE status = 'pending'
      DO UPDATE SET
        details = $3,
        updated_at = NOW()
    `, [userId, alertType, JSON.stringify(details)]);

    logger.warn(`🚨 Fraud alert created: ${alertType} for user ${userId}`, details);
  } catch (error) {
    logger.error('Failed to create fraud alert:', error);
  }
}

/**
 * Express middleware: Check spend limits before processing
 */
async function checkSpendLimits(req, res, next) {
  try {
    const userId = req.user?.supabase_id;
    if (!userId) return next();

    const tokenAmount = parseInt(req.body.tokenAmount || req.body.tokens || 0);
    if (tokenAmount <= 0) return next();

    // Check hourly limit
    const hourlyCheck = await checkHourlySpendLimit(userId, tokenAmount);
    if (!hourlyCheck.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        details: hourlyCheck,
        timestamp: new Date().toISOString()
      });
    }

    // Check daily limit
    const dailyCheck = await checkDailySpendLimit(userId, tokenAmount);
    if (!dailyCheck.allowed) {
      return res.status(429).json({
        error: 'Daily limit exceeded',
        details: dailyCheck,
        timestamp: new Date().toISOString()
      });
    }

    // Attach limits info to request for logging
    req.fraudCheck = {
      hourlySpent: hourlyCheck.spent,
      dailySpent: dailyCheck.spent
    };

    next();
  } catch (error) {
    logger.error('Fraud check middleware error:', error);
    // Fail open (don't block on error, but log it)
    next();
  }
}

/**
 * Express middleware: Check velocity limits
 */
async function checkVelocity(actionType) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.supabase_id;
      if (!userId) return next();

      const velocityCheck = await checkVelocityLimit(userId, actionType);
      if (!velocityCheck.allowed) {
        return res.status(429).json({
          error: 'Action rate limit exceeded',
          details: velocityCheck,
          timestamp: new Date().toISOString()
        });
      }

      next();
    } catch (error) {
      logger.error('Velocity check error:', error);
      next();
    }
  };
}

/**
 * Express middleware: Verify payout eligibility
 */
async function verifyPayoutEligibility(req, res, next) {
  try {
    const userId = req.user?.supabase_id;
    const payoutAmount = parseInt(req.body.tokenAmount || 0);

    if (!userId || payoutAmount <= 0) return next();

    // Check account age and earning history
    const eligibilityCheck = await checkPayoutEligibility(userId, payoutAmount);
    if (!eligibilityCheck.allowed) {
      return res.status(403).json({
        error: 'Payout not allowed',
        details: eligibilityCheck,
        timestamp: new Date().toISOString()
      });
    }

    // Check for suspicious cashout patterns
    const patternCheck = await checkCashoutPattern(userId, payoutAmount);
    if (!patternCheck.allowed) {
      return res.status(403).json({
        error: 'Payout requires review',
        details: patternCheck,
        timestamp: new Date().toISOString()
      });
    }

    req.payoutCheck = {
      accountAge: eligibilityCheck.accountAge,
      earningAge: eligibilityCheck.earningAge,
      cashoutRatio: patternCheck.cashoutRatio
    };

    next();
  } catch (error) {
    logger.error('Payout eligibility check error:', error);
    // Fail closed (block payout on error)
    res.status(500).json({
      error: 'Unable to verify payout eligibility',
      message: 'Please try again or contact support',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Check for purchase fraud patterns
 */
async function checkPurchaseFraud(req, res, next) {
  try {
    const userId = req.user?.supabase_id;
    if (!userId) return next();

    const failureCheck = await checkFailedPurchases(userId);
    if (!failureCheck.allowed) {
      return res.status(403).json({
        error: 'Account restricted',
        details: failureCheck,
        timestamp: new Date().toISOString()
      });
    }

    next();
  } catch (error) {
    logger.error('Purchase fraud check error:', error);
    next();
  }
}

module.exports = {
  // Middleware
  checkSpendLimits,
  checkVelocity,
  verifyPayoutEligibility,
  checkPurchaseFraud,

  // Direct functions (for programmatic use)
  checkHourlySpendLimit,
  checkDailySpendLimit,
  checkVelocityLimit,
  checkPayoutEligibility,
  checkCashoutPattern,
  checkFailedPurchases,
  createFraudAlert,

  // Configuration
  LIMITS
};
