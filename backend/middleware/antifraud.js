const rateLimit = require('express-rate-limit');
const { pool } = require('../utils/db');

// Advanced rate limiting for tips
const tipRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: async (req) => {
    // Dynamic rate limiting based on user history
    try {
      const recentTips = await pool.query(`
        SELECT COUNT(*) as tip_count 
        FROM token_transactions 
        WHERE user_id = $1 
          AND type = 'tip' 
          AND created_at >= NOW() - INTERVAL '5 minutes'
      `, [req.user.uid]);
      
      const tipCount = parseInt(recentTips.rows[0].tip_count);
      
      // Allow 10 tips for new users, 20 for established users
      return tipCount > 50 ? 5 : tipCount > 100 ? 15 : 10;
    } catch (error) {
      return 5; // Conservative limit on error
    }
  },
  message: {
    error: 'Too many tips sent recently. Please wait before sending more.',
    timestamp: () => new Date().toISOString()
  },
  keyGenerator: (req) => req.user.uid
});

// Fraud detection middleware
const fraudDetection = async (req, res, next) => {
  try {
    const { tokenAmount } = req.body;
    
    // Check for suspiciously large amounts
    if (tokenAmount > 10000) {
      const userHistory = await pool.query(`
        SELECT AVG(tokens) as avg_tip, MAX(tokens) as max_tip
        FROM token_transactions 
        WHERE user_id = $1 AND type = 'tip'
      `, [req.user.uid]);
      
      if (userHistory.rows.length > 0) {
        const avgTip = parseFloat(userHistory.rows[0].avg_tip) || 0;
        const maxTip = parseInt(userHistory.rows[0].max_tip) || 0;
        
        if (tokenAmount > avgTip * 10 && tokenAmount > maxTip * 2) {
          console.warn(`🚨 Suspicious tip amount: ${tokenAmount} tokens from user ${req.user.uid}`);
          
          // Add to fraud log
          await pool.query(`
            INSERT INTO fraud_alerts (user_id, alert_type, details, created_at)
            VALUES ($1, $2, $3, NOW())
          `, [
            req.user.uid, 
            'suspicious_tip', 
            JSON.stringify({ amount: tokenAmount, avgTip, maxTip })
          ]);
          
          return res.status(429).json({
            error: 'This tip amount requires additional verification',
            requiresVerification: true,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
    
    // Check for rapid consecutive tips to same creator
    const recentTipsToCreator = await pool.query(`
      SELECT COUNT(*) as tip_count, SUM(tokens) as total_tokens
      FROM token_transactions tt
      WHERE tt.user_id = $1 
        AND tt.type = 'tip'
        AND tt.created_at >= NOW() - INTERVAL '1 hour'
        AND EXISTS (
          SELECT 1 FROM token_transactions tt2 
          WHERE tt2.user_id = $2 AND tt2.created_at = tt.created_at
        )
    `, [req.user.uid, req.body.creatorId]);
    
    if (recentTipsToCreator.rows.length > 0) {
      const tipCount = parseInt(recentTipsToCreator.rows[0].tip_count);
      const totalTokens = parseInt(recentTipsToCreator.rows[0].total_tokens);
      
      if (tipCount > 20 || totalTokens > 50000) {
        console.warn(`🚨 Excessive tipping detected: ${tipCount} tips, ${totalTokens} tokens from user ${req.user.uid}`);
        
        return res.status(429).json({
          error: 'You have sent many tips to this creator recently. Please wait before sending more.',
          cooldownMinutes: 60,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    next();
  } catch (error) {
    console.error('❌ Fraud detection error:', error);
    next(); // Continue on error to avoid blocking legitimate requests
  }
};

module.exports = { tipRateLimiter, fraudDetection };