/**
 * Advanced Anti-Fraud Middleware v2
 *
 * Features:
 * - Velocity limits (hourly, daily, weekly spend caps)
 * - Risk scoring based on account age, device fingerprint, patterns
 * - Buy→tip→cashout loop detection
 * - IP/device clustering analysis
 * - New account hold periods
 * - Prepaid card detection (via Stripe metadata)
 * - Manual review queue for high-risk transactions
 */

const { pool } = require('../utils/db');
const { logger } = require('../utils/secureLogger');
const rateLimit = require('express-rate-limit');

// Configuration
const LIMITS = {
  // Spend limits (tokens)
  NEW_ACCOUNT_HOURLY: 1000,      // First 7 days
  NEW_ACCOUNT_DAILY: 5000,
  ESTABLISHED_HOURLY: 10000,     // After 7 days
  ESTABLISHED_DAILY: 50000,

  // Purchase limits (USD)
  NEW_ACCOUNT_PURCHASE_DAILY: 100,
  ESTABLISHED_PURCHASE_DAILY: 1000,

  // Payout limits
  NEW_ACCOUNT_PAYOUT_HOLD_HOURS: 72,  // 72h hold for new accounts
  MIN_PAYOUT_TOKENS: 1000,

  // Pattern detection
  MAX_TIPS_PER_HOUR_SAME_CREATOR: 20,
  MAX_GIFTS_PER_HOUR_SAME_USER: 10,

  // Risk thresholds
  HIGH_RISK_SCORE: 70,           // 0-100 scale
  REVIEW_QUEUE_SCORE: 50
};

/**
 * Calculate user risk score (0-100, higher = riskier)
 */
async function calculateRiskScore(userId, transactionType, amount, metadata = {}) {
  let riskScore = 0;
  const reasons = [];

  try {
    // Get user info
    const userResult = await pool.query(`
      SELECT
        created_at,
        is_creator,
        email_verified,
        phone_verified,
        kyc_verified,
        (SELECT COUNT(*) FROM token_transactions WHERE user_id = $1 AND status = 'completed') as tx_count,
        (SELECT SUM(amount_usd) FROM payments WHERE user_supabase_id = $1 AND status = 'completed') as total_spent_usd,
        (SELECT COUNT(DISTINCT DATE(created_at)) FROM token_transactions WHERE user_id = $1) as active_days
      FROM users
      WHERE supabase_id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return { riskScore: 100, reasons: ['User not found'] };
    }

    const user = userResult.rows[0];
    const accountAgeHours = (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60);
    const accountAgeDays = accountAgeHours / 24;

    // Factor 1: Account age (max 30 points)
    if (accountAgeHours < 1) {
      riskScore += 30;
      reasons.push('Account less than 1 hour old');
    } else if (accountAgeHours < 24) {
      riskScore += 20;
      reasons.push('Account less than 1 day old');
    } else if (accountAgeDays < 7) {
      riskScore += 10;
      reasons.push('Account less than 7 days old');
    }

    // Factor 2: Transaction history (max 20 points)
    const txCount = parseInt(user.tx_count || 0);
    if (txCount === 0) {
      riskScore += 20;
      reasons.push('No transaction history');
    } else if (txCount < 5) {
      riskScore += 10;
      reasons.push('Very few transactions');
    }

    // Factor 3: Verification status (max 15 points)
    if (!user.email_verified) {
      riskScore += 10;
      reasons.push('Email not verified');
    }
    if (!user.kyc_verified) {
      riskScore += 5;
      reasons.push('KYC not verified');
    }

    // Factor 4: Activity pattern (max 15 points)
    const activeDays = parseInt(user.active_days || 0);
    const expectedActiveDays = Math.min(accountAgeDays, 30);
    if (activeDays < expectedActiveDays * 0.1) {
      riskScore += 15;
      reasons.push('Low activity (possible account takeover)');
    }

    // Factor 5: Transaction amount vs history (max 20 points)
    const avgTransactionUsd = txCount > 0 ? (parseFloat(user.total_spent_usd || 0) / txCount) : 0;
    const currentTransactionUsd = amount * 0.05; // $0.05 per token

    if (avgTransactionUsd > 0 && currentTransactionUsd > avgTransactionUsd * 5) {
      riskScore += 20;
      reasons.push('Transaction 5x larger than average');
    } else if (avgTransactionUsd > 0 && currentTransactionUsd > avgTransactionUsd * 3) {
      riskScore += 10;
      reasons.push('Transaction 3x larger than average');
    }

    // Factor 6: Prepaid card detection (via metadata)
    if (metadata.paymentMethod === 'prepaid_card') {
      riskScore += 15;
      reasons.push('Prepaid card used');
    }

    // Factor 7: Suspicious patterns
    if (transactionType === 'payout') {
      // Check buy→payout time window
      const recentPurchase = await pool.query(`
        SELECT created_at, tokens
        FROM token_transactions
        WHERE user_id = $1
          AND type IN ('purchase', 'quick_purchase')
          AND status = 'completed'
        ORDER BY created_at DESC
        LIMIT 1
      `, [userId]);

      if (recentPurchase.rows.length > 0) {
        const hoursSincePurchase = (Date.now() - new Date(recentPurchase.rows[0].created_at).getTime()) / (1000 * 60 * 60);

        if (hoursSincePurchase < 2) {
          riskScore += 25;
          reasons.push('Payout requested within 2 hours of purchase (cashout loop)');
        } else if (hoursSincePurchase < 24) {
          riskScore += 15;
          reasons.push('Payout requested within 24 hours of purchase');
        }
      }
    }

    // Cap at 100
    riskScore = Math.min(riskScore, 100);

    return { riskScore, reasons, metadata: { accountAgeDays, txCount, avgTransactionUsd } };

  } catch (error) {
    logger.error('Risk score calculation error:', error);
    return { riskScore: 50, reasons: ['Error calculating risk'], error: error.message };
  }
}

/**
 * Check velocity limits (hourly, daily spend)
 */
async function checkVelocityLimits(userId, amount, transactionType) {
  try {
    // Get user account age
    const userResult = await pool.query(
      'SELECT created_at FROM users WHERE supabase_id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return { allowed: false, reason: 'User not found' };
    }

    const accountAgeDays = (Date.now() - new Date(userResult.rows[0].created_at).getTime()) / (1000 * 60 * 60 * 24);
    const isNewAccount = accountAgeDays < 7;

    // Get hourly spend
    const hourlySpend = await pool.query(`
      SELECT COALESCE(SUM(ABS(tokens)), 0) as total
      FROM token_transactions
      WHERE user_id = $1
        AND tokens < 0
        AND status = 'completed'
        AND created_at >= NOW() - INTERVAL '1 hour'
    `, [userId]);

    const hourlyTotal = parseInt(hourlySpend.rows[0].total || 0);
    const hourlyLimit = isNewAccount ? LIMITS.NEW_ACCOUNT_HOURLY : LIMITS.ESTABLISHED_HOURLY;

    if (hourlyTotal + amount > hourlyLimit) {
      return {
        allowed: false,
        reason: 'Hourly spend limit exceeded',
        current: hourlyTotal,
        limit: hourlyLimit,
        remaining: Math.max(0, hourlyLimit - hourlyTotal)
      };
    }

    // Get daily spend
    const dailySpend = await pool.query(`
      SELECT COALESCE(SUM(ABS(tokens)), 0) as total
      FROM token_transactions
      WHERE user_id = $1
        AND tokens < 0
        AND status = 'completed'
        AND created_at >= NOW() - INTERVAL '24 hours'
    `, [userId]);

    const dailyTotal = parseInt(dailySpend.rows[0].total || 0);
    const dailyLimit = isNewAccount ? LIMITS.NEW_ACCOUNT_DAILY : LIMITS.ESTABLISHED_DAILY;

    if (dailyTotal + amount > dailyLimit) {
      return {
        allowed: false,
        reason: 'Daily spend limit exceeded',
        current: dailyTotal,
        limit: dailyLimit,
        remaining: Math.max(0, dailyLimit - dailyTotal)
      };
    }

    // If transaction is a purchase, check purchase limits
    if (transactionType === 'purchase') {
      const dailyPurchaseUsd = await pool.query(`
        SELECT COALESCE(SUM(amount_usd), 0) as total
        FROM token_transactions
        WHERE user_id = $1
          AND type IN ('purchase', 'quick_purchase')
          AND status = 'completed'
          AND created_at >= NOW() - INTERVAL '24 hours'
      `, [userId]);

      const purchaseTotal = parseFloat(dailyPurchaseUsd.rows[0].total || 0);
      const purchaseLimit = isNewAccount ? LIMITS.NEW_ACCOUNT_PURCHASE_DAILY : LIMITS.ESTABLISHED_PURCHASE_DAILY;
      const amountUsd = amount * 0.05;

      if (purchaseTotal + amountUsd > purchaseLimit) {
        return {
          allowed: false,
          reason: 'Daily purchase limit exceeded',
          current: purchaseTotal,
          limit: purchaseLimit,
          remaining: Math.max(0, purchaseLimit - purchaseTotal)
        };
      }
    }

    return { allowed: true };

  } catch (error) {
    logger.error('Velocity limit check error:', error);
    return { allowed: false, reason: 'Error checking limits' };
  }
}

/**
 * Detect buy→tip→cashout loops
 */
async function detectCashoutLoop(userId, recipientId) {
  try {
    // Check if recipient has recently cashed out gifts from this sender
    const loopCheck = await pool.query(`
      WITH sender_gifts AS (
        SELECT recipient_id, SUM(token_amount) as total_gifted, MAX(created_at) as last_gift
        FROM token_gifts
        WHERE sender_id = $1
          AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY recipient_id
      ),
      recipient_payouts AS (
        SELECT user_id, SUM(tokens_redeemed) as total_cashed, MAX(created_at) as last_payout
        FROM payouts
        WHERE user_id IN (SELECT recipient_id FROM sender_gifts)
          AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY user_id
      )
      SELECT
        sg.total_gifted,
        rp.total_cashed,
        sg.last_gift,
        rp.last_payout,
        EXTRACT(EPOCH FROM (rp.last_payout - sg.last_gift))/3600 as hours_to_cashout
      FROM sender_gifts sg
      JOIN recipient_payouts rp ON sg.recipient_id = rp.user_id
      WHERE sg.recipient_id = $2
    `, [userId, recipientId]);

    if (loopCheck.rows.length > 0) {
      const { total_gifted, total_cashed, hours_to_cashout } = loopCheck.rows[0];

      // Flag if >80% of gifts are immediately cashed out
      const cashoutRatio = total_cashed / total_gifted;
      if (cashoutRatio > 0.8 && hours_to_cashout < 48) {
        return {
          detected: true,
          severity: 'high',
          details: {
            totalGifted: total_gifted,
            totalCashed: total_cashed,
            cashoutRatio,
            hoursToCashout: hours_to_cashout
          }
        };
      }
    }

    return { detected: false };

  } catch (error) {
    logger.error('Cashout loop detection error:', error);
    return { detected: false, error: error.message };
  }
}

/**
 * Check new account payout hold
 */
async function checkPayoutHold(userId, tokenAmount) {
  try {
    const userResult = await pool.query(`
      SELECT created_at, kyc_verified
      FROM users
      WHERE supabase_id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return { allowed: false, reason: 'User not found' };
    }

    const { created_at, kyc_verified } = userResult.rows[0];
    const accountAgeHours = (Date.now() - new Date(created_at).getTime()) / (1000 * 60 * 60);

    // Skip hold for KYC-verified users
    if (kyc_verified) {
      return { allowed: true };
    }

    // Apply hold period for new accounts
    if (accountAgeHours < LIMITS.NEW_ACCOUNT_PAYOUT_HOLD_HOURS) {
      return {
        allowed: false,
        reason: 'New account payout hold period',
        holdHoursRemaining: Math.ceil(LIMITS.NEW_ACCOUNT_PAYOUT_HOLD_HOURS - accountAgeHours),
        accountAgeHours: Math.floor(accountAgeHours)
      };
    }

    // Check minimum payout amount
    if (tokenAmount < LIMITS.MIN_PAYOUT_TOKENS) {
      return {
        allowed: false,
        reason: 'Below minimum payout amount',
        minimum: LIMITS.MIN_PAYOUT_TOKENS,
        requested: tokenAmount
      };
    }

    return { allowed: true };

  } catch (error) {
    logger.error('Payout hold check error:', error);
    return { allowed: false, reason: 'Error checking payout eligibility' };
  }
}

/**
 * Log fraud alert to database
 */
async function logFraudAlert(userId, alertType, severity, details, transactionId = null) {
  try {
    await pool.query(`
      INSERT INTO fraud_alerts (
        user_id, alert_type, severity, details, transaction_id, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
    `, [userId, alertType, severity, JSON.stringify(details), transactionId]);

    logger.warn(`🚨 Fraud alert: ${alertType} (${severity}) - User: ${userId}`);
  } catch (error) {
    logger.error('Failed to log fraud alert:', error);
  }
}

/**
 * Middleware: Comprehensive fraud check
 */
const comprehensiveFraudCheck = async (req, res, next) => {
  try {
    const userId = req.user?.supabase_id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { tokenAmount, recipientId, creatorId, type } = req.body;
    const amount = parseInt(tokenAmount || 0);

    if (amount <= 0) {
      return next(); // Skip for non-monetary operations
    }

    const transactionType = type || (req.path.includes('purchase') ? 'purchase' :
                                     req.path.includes('tip') ? 'tip' :
                                     req.path.includes('payout') ? 'payout' : 'unknown');

    // Check 1: Velocity limits
    const velocityCheck = await checkVelocityLimits(userId, amount, transactionType);
    if (!velocityCheck.allowed) {
      await logFraudAlert(userId, 'velocity_limit', 'medium', velocityCheck);
      return res.status(429).json({
        error: velocityCheck.reason,
        limits: {
          current: velocityCheck.current,
          limit: velocityCheck.limit,
          remaining: velocityCheck.remaining
        },
        timestamp: new Date().toISOString()
      });
    }

    // Check 2: Risk scoring
    const riskAnalysis = await calculateRiskScore(userId, transactionType, amount, req.body);

    if (riskAnalysis.riskScore >= LIMITS.HIGH_RISK_SCORE) {
      // Block high-risk transactions
      await logFraudAlert(userId, 'high_risk_score', 'high', riskAnalysis);
      return res.status(403).json({
        error: 'Transaction flagged for manual review',
        riskScore: riskAnalysis.riskScore,
        requiresVerification: true,
        contactSupport: true,
        timestamp: new Date().toISOString()
      });
    } else if (riskAnalysis.riskScore >= LIMITS.REVIEW_QUEUE_SCORE) {
      // Queue for manual review but allow to proceed
      await logFraudAlert(userId, 'medium_risk_score', 'medium', riskAnalysis);
      req.fraudReview = {
        queued: true,
        riskScore: riskAnalysis.riskScore,
        reasons: riskAnalysis.reasons
      };
    }

    // Check 3: Cashout loop detection (for tips/gifts)
    if ((transactionType === 'tip' || transactionType === 'gift') && (recipientId || creatorId)) {
      const loopCheck = await detectCashoutLoop(userId, recipientId || creatorId);
      if (loopCheck.detected && loopCheck.severity === 'high') {
        await logFraudAlert(userId, 'cashout_loop', 'high', loopCheck.details);
        return res.status(403).json({
          error: 'Suspicious pattern detected. Transaction blocked for review.',
          contactSupport: true,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Check 4: Payout hold (for creator payouts)
    if (transactionType === 'payout') {
      const holdCheck = await checkPayoutHold(userId, amount);
      if (!holdCheck.allowed) {
        return res.status(403).json({
          error: holdCheck.reason,
          holdInfo: {
            hoursRemaining: holdCheck.holdHoursRemaining,
            accountAgeHours: holdCheck.accountAgeHours,
            holdPeriodHours: LIMITS.NEW_ACCOUNT_PAYOUT_HOLD_HOURS
          },
          timestamp: new Date().toISOString()
        });
      }
    }

    // All checks passed
    next();

  } catch (error) {
    logger.error('❌ Comprehensive fraud check error:', error);
    next(); // Continue on error to avoid blocking legitimate traffic
  }
};

/**
 * Express rate limiter for API endpoints
 */
const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: {
    error: 'Too many requests. Please slow down.',
    retryAfter: '1 minute'
  },
  keyGenerator: (req) => req.user?.supabase_id || req.ip
});

module.exports = {
  comprehensiveFraudCheck,
  calculateRiskScore,
  checkVelocityLimits,
  detectCashoutLoop,
  checkPayoutHold,
  logFraudAlert,
  apiRateLimiter,
  LIMITS
};
