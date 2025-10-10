/**
 * Basic Rate Limiting for Token Operations
 *
 * Ultra-minimal fraud prevention for platforms with:
 * - Manual creator approval
 * - Bi-monthly payout schedule
 * - Request-based withdrawals
 *
 * These limits protect against:
 * - Compromised account abuse (bot drains)
 * - Accidental/buggy client spam
 * - Basic abuse patterns
 *
 * NOT for fraud prevention (your payout schedule handles that)
 */

const { pool } = require('../utils/db');
const { logger } = require('../utils/secureLogger');

const LIMITS = {
  // User protection (prevent account compromise damage)
  HOURLY_SPEND: 10000,     // $500/hour max spend
  DAILY_SPEND: 50000,      // $2,500/day max spend

  // Spam prevention
  TIPS_PER_HOUR: 30,       // Generous for real users
  GIFTS_PER_HOUR: 15,
  PURCHASES_PER_HOUR: 10   // Plenty for legitimate top-ups
};

/**
 * Check hourly/daily spend limits
 * Prevents: Compromised account draining all tokens in minutes
 */
async function checkSpendLimits(req, res, next) {
  try {
    const userId = req.user?.supabase_id;
    const amount = parseInt(req.body.tokenAmount || req.body.tokens || 0);

    if (!userId || amount <= 0) return next();

    // Hourly check
    const hourlyResult = await pool.query(`
      SELECT COALESCE(SUM(ABS(tokens)), 0) AS spent
      FROM token_transactions
      WHERE user_id = $1
        AND tokens < 0
        AND type IN ('tip', 'gift_sent', 'call')
        AND created_at >= NOW() - INTERVAL '1 hour'
        AND status = 'completed'
    `, [userId]);

    const hourlySpent = parseInt(hourlyResult.rows[0].spent);

    if (hourlySpent + amount > LIMITS.HOURLY_SPEND) {
      logger.warn(`Hourly limit exceeded: User ${userId}, spent ${hourlySpent}, attempted ${amount}`);
      return res.status(429).json({
        error: 'Hourly spending limit reached',
        current: hourlySpent,
        limit: LIMITS.HOURLY_SPEND,
        remaining: Math.max(0, LIMITS.HOURLY_SPEND - hourlySpent),
        message: 'You can spend more in an hour. This protects your account.'
      });
    }

    // Daily check
    const dailyResult = await pool.query(`
      SELECT COALESCE(SUM(ABS(tokens)), 0) AS spent
      FROM token_transactions
      WHERE user_id = $1
        AND tokens < 0
        AND type IN ('tip', 'gift_sent', 'call')
        AND created_at >= NOW() - INTERVAL '24 hours'
        AND status = 'completed'
    `, [userId]);

    const dailySpent = parseInt(dailyResult.rows[0].spent);

    if (dailySpent + amount > LIMITS.DAILY_SPEND) {
      logger.warn(`Daily limit exceeded: User ${userId}, spent ${dailySpent}, attempted ${amount}`);
      return res.status(429).json({
        error: 'Daily spending limit reached',
        current: dailySpent,
        limit: LIMITS.DAILY_SPEND,
        remaining: Math.max(0, LIMITS.DAILY_SPEND - dailySpent),
        message: 'Daily limit resets in 24 hours. This protects your account.'
      });
    }

    next();
  } catch (error) {
    logger.error('Spend limit check error:', error);
    next(); // Fail open (don't block on error)
  }
}

/**
 * Check action velocity (prevent spam/bots)
 */
function checkVelocity(actionType) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.supabase_id;
      if (!userId) return next();

      const limits = {
        'tip': { count: LIMITS.TIPS_PER_HOUR, types: ['tip'] },
        'gift': { count: LIMITS.GIFTS_PER_HOUR, types: ['gift_sent'] },
        'purchase': { count: LIMITS.PURCHASES_PER_HOUR, types: ['purchase', 'quick_purchase'] }
      };

      const config = limits[actionType];
      if (!config) return next();

      const result = await pool.query(`
        SELECT COUNT(*) AS count
        FROM token_transactions
        WHERE user_id = $1
          AND type = ANY($2)
          AND created_at >= NOW() - INTERVAL '1 hour'
      `, [userId, config.types]);

      const count = parseInt(result.rows[0].count);

      if (count >= config.count) {
        logger.warn(`Velocity limit exceeded: User ${userId}, ${actionType}, count ${count}`);
        return res.status(429).json({
          error: `Too many ${actionType} actions`,
          current: count,
          limit: config.count,
          message: `Maximum ${config.count} ${actionType}s per hour. Please wait.`
        });
      }

      next();
    } catch (error) {
      logger.error('Velocity check error:', error);
      next(); // Fail open
    }
  };
}

module.exports = {
  checkSpendLimits,
  checkVelocity,
  LIMITS
};
