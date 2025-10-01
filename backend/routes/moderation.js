const express = require('express');
const { Pool } = require('pg');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Simulated AI Content Moderation Service
// In production, this would integrate with services like OpenAI Moderation API, AWS Comprehend, etc.
class AIContentModerator {
  static async moderateText(text) {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100));

    const flaggedTerms = [
      'spam', 'scam', 'hate', 'harassment', 'inappropriate', 'explicit',
      'violence', 'drugs', 'illegal', 'harmful', 'abuse', 'threat'
    ];

    const toxicPatterns = [
      /\b(?:kill|die|suicide)\b/i,
      /\b(?:hate|racist|sexist)\b/i,
      /\b(?:stupid|idiot|moron)\s+(?:fan|user|person)/i,
      /\b(?:fuck|shit|damn)\s+(?:you|this|that)/i,
      /(?:discord|telegram|whatsapp)\.(?:gg|com|me)/i, // External link spam
      /\b(?:buy|purchase|click|visit)\s+(?:here|now|this)/i // Promotional spam
    ];

    let flaggedReasons = [];
    let confidenceScore = 0;
    let severity = 'low';

    // Check for flagged terms
    const lowerText = text.toLowerCase();
    flaggedTerms.forEach(term => {
      if (lowerText.includes(term)) {
        flaggedReasons.push(`Contains flagged term: ${term}`);
        confidenceScore += 20;
      }
    });

    // Check for toxic patterns
    toxicPatterns.forEach((pattern, index) => {
      if (pattern.test(text)) {
        flaggedReasons.push(`Matches toxic pattern ${index + 1}`);
        confidenceScore += 30;
      }
    });

    // Check for excessive caps (potential shouting/spam)
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (capsRatio > 0.7 && text.length > 10) {
      flaggedReasons.push('Excessive capitalization');
      confidenceScore += 15;
    }

    // Check for repeated characters/words (spam indicator)
    if (/(.)\1{4,}/.test(text) || /\b(\w+)\s+\1\b/gi.test(text)) {
      flaggedReasons.push('Repeated characters or words');
      confidenceScore += 25;
    }

    // Determine severity based on confidence
    if (confidenceScore >= 70) {
      severity = 'high';
    } else if (confidenceScore >= 40) {
      severity = 'medium';
    }

    const isViolation = confidenceScore >= 40;

    return {
      isViolation,
      confidence: Math.min(confidenceScore, 100),
      severity,
      reasons: flaggedReasons,
      categories: this.categorizeViolations(flaggedReasons),
      action: this.recommendAction(confidenceScore, severity),
      timestamp: new Date().toISOString()
    };
  }

  static async moderateImage(imageUrl) {
    // Simulate image moderation (would use AWS Rekognition, Google Vision, etc.)
    await new Promise(resolve => setTimeout(resolve, 200));

    // Basic simulation based on filename/URL patterns
    const inappropriatePatterns = [
      /\b(?:nude|naked|explicit|porn|sex|adult)\b/i,
      /\b(?:violence|weapon|gun|knife)\b/i
    ];

    let flaggedReasons = [];
    let confidenceScore = 0;

    inappropriatePatterns.forEach((pattern, index) => {
      if (pattern.test(imageUrl)) {
        flaggedReasons.push(`Image content violation pattern ${index + 1}`);
        confidenceScore += 60;
      }
    });

    return {
      isViolation: confidenceScore >= 50,
      confidence: confidenceScore,
      severity: confidenceScore >= 70 ? 'high' : 'medium',
      reasons: flaggedReasons,
      categories: ['inappropriate_imagery'],
      action: confidenceScore >= 70 ? 'block' : 'review',
      timestamp: new Date().toISOString()
    };
  }

  static categorizeViolations(reasons) {
    const categories = [];
    
    if (reasons.some(r => r.includes('hate') || r.includes('racist') || r.includes('sexist'))) {
      categories.push('hate_speech');
    }
    if (reasons.some(r => r.includes('threat') || r.includes('violence') || r.includes('kill'))) {
      categories.push('threats_violence');
    }
    if (reasons.some(r => r.includes('spam') || r.includes('repeated') || r.includes('promotional'))) {
      categories.push('spam');
    }
    if (reasons.some(r => r.includes('harassment') || r.includes('abuse'))) {
      categories.push('harassment');
    }
    if (reasons.some(r => r.includes('explicit') || r.includes('inappropriate'))) {
      categories.push('adult_content');
    }

    return categories.length > 0 ? categories : ['general_violation'];
  }

  static recommendAction(confidence, severity) {
    if (confidence >= 80) return 'block';
    if (confidence >= 60) return 'quarantine';
    if (confidence >= 40) return 'review';
    return 'monitor';
  }
}

// Moderate chat message
router.post('/moderate/message', authenticateToken, async (req, res) => {
  try {
    const { messageId, content, channel } = req.body;
    const userId = req.user.supabase_id;

    if (!content) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Run AI moderation
    const moderationResult = await AIContentModerator.moderateText(content);

    // Save moderation result to database
    const moderationQuery = await pool.query(`
      INSERT INTO content_moderation 
      (content_type, content_id, user_id, original_content, moderation_result, 
       is_violation, confidence_score, severity, action_taken, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      'message',
      messageId,
      userId,
      content,
      JSON.stringify(moderationResult),
      moderationResult.isViolation,
      moderationResult.confidence,
      moderationResult.severity,
      moderationResult.action,
      moderationResult.isViolation ? 'flagged' : 'approved'
    ]);

    // Take action based on moderation result
    if (moderationResult.isViolation) {
      if (moderationResult.action === 'block') {
        // Block message immediately
        await pool.query(
          'UPDATE chat_messages SET is_blocked = true, blocked_reason = $1 WHERE id = $2',
          ['AI Moderation: ' + moderationResult.reasons.join(', '), messageId]
        );

        // Create admin notification for severe violations
        if (moderationResult.severity === 'high') {
          await pool.query(`
            INSERT INTO notifications (recipient_id, type, title, content, data, created_at)
            VALUES ('admin', 'moderation_alert', 'High Severity Content Violation', 
                    $1, $2, NOW())
          `, [
            `User ${userId} posted high-severity violating content`,
            JSON.stringify({
              userId,
              messageId,
              channel,
              moderationResult
            })
          ]);
        }
      }

      // Apply user penalties
      await this.applyUserPenalty(userId, moderationResult.severity);
    }

    res.json({
      success: true,
      moderation: {
        id: moderationQuery.rows[0].id,
        isViolation: moderationResult.isViolation,
        confidence: moderationResult.confidence,
        severity: moderationResult.severity,
        action: moderationResult.action,
        reasons: moderationResult.reasons
      }
    });

  } catch (error) {
    console.error('❌ Error moderating message:', error);
    res.status(500).json({ error: 'Failed to moderate content' });
  }
});

// Moderate profile content
router.post('/moderate/profile', authenticateToken, async (req, res) => {
  try {
    const { profileId, bio, username } = req.body;
    const userId = req.user.supabase_id;

    // Moderate bio content
    const bioModeration = bio ? await AIContentModerator.moderateText(bio) : null;
    const usernameModeration = username ? await AIContentModerator.moderateText(username) : null;

    let overallViolation = false;
    let overallConfidence = 0;
    let overallSeverity = 'low';
    let allReasons = [];

    if (bioModeration?.isViolation) {
      overallViolation = true;
      overallConfidence = Math.max(overallConfidence, bioModeration.confidence);
      overallSeverity = bioModeration.severity;
      allReasons.push(...bioModeration.reasons.map(r => `Bio: ${r}`));
    }

    if (usernameModeration?.isViolation) {
      overallViolation = true;
      overallConfidence = Math.max(overallConfidence, usernameModeration.confidence);
      if (usernameModeration.severity === 'high') overallSeverity = 'high';
      allReasons.push(...usernameModeration.reasons.map(r => `Username: ${r}`));
    }

    // Save moderation result
    if (overallViolation) {
      await pool.query(`
        INSERT INTO content_moderation 
        (content_type, content_id, user_id, original_content, moderation_result, 
         is_violation, confidence_score, severity, action_taken, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        'profile',
        profileId,
        userId,
        JSON.stringify({ bio, username }),
        JSON.stringify({ bioModeration, usernameModeration }),
        overallViolation,
        overallConfidence,
        overallSeverity,
        overallConfidence >= 70 ? 'block' : 'review',
        'flagged'
      ]);

      // Block profile updates if severe
      if (overallConfidence >= 70) {
        await pool.query(
          'UPDATE users SET profile_blocked = true, profile_block_reason = $1 WHERE supabase_id = $2',
          ['AI Moderation: ' + allReasons.join(', '), userId]
        );
      }
    }

    res.json({
      success: true,
      moderation: {
        isViolation: overallViolation,
        confidence: overallConfidence,
        severity: overallSeverity,
        reasons: allReasons,
        bioModeration,
        usernameModeration
      }
    });

  } catch (error) {
    console.error('❌ Error moderating profile:', error);
    res.status(500).json({ error: 'Failed to moderate profile' });
  }
});

// Moderate uploaded image/video
router.post('/moderate/media', authenticateToken, async (req, res) => {
  try {
    const { mediaUrl, mediaType, contentId } = req.body;
    const userId = req.user.supabase_id;

    if (!mediaUrl) {
      return res.status(400).json({ error: 'Media URL is required' });
    }

    // Run AI moderation on media
    const moderationResult = mediaType === 'image' 
      ? await AIContentModerator.moderateImage(mediaUrl)
      : await AIContentModerator.moderateText(mediaUrl); // Basic URL-based check for videos

    // Save moderation result
    const moderationQuery = await pool.query(`
      INSERT INTO content_moderation 
      (content_type, content_id, user_id, original_content, moderation_result, 
       is_violation, confidence_score, severity, action_taken, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      mediaType,
      contentId,
      userId,
      mediaUrl,
      JSON.stringify(moderationResult),
      moderationResult.isViolation,
      moderationResult.confidence,
      moderationResult.severity,
      moderationResult.action,
      moderationResult.isViolation ? 'flagged' : 'approved'
    ]);

    // Take action if violation detected
    if (moderationResult.isViolation) {
      if (moderationResult.action === 'block') {
        // Mark media as blocked
        await pool.query(`
          INSERT INTO blocked_content (content_type, content_id, user_id, reason, blocked_at)
          VALUES ($1, $2, $3, $4, NOW())
        `, [mediaType, contentId, userId, 'AI Moderation: ' + moderationResult.reasons.join(', ')]);
      }

      await this.applyUserPenalty(userId, moderationResult.severity);
    }

    res.json({
      success: true,
      moderation: {
        id: moderationQuery.rows[0].id,
        isViolation: moderationResult.isViolation,
        confidence: moderationResult.confidence,
        severity: moderationResult.severity,
        action: moderationResult.action,
        reasons: moderationResult.reasons
      }
    });

  } catch (error) {
    console.error('❌ Error moderating media:', error);
    res.status(500).json({ error: 'Failed to moderate media' });
  }
});

// Get moderation history for admin
router.get('/admin/history', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0, contentType, severity, status } = req.query;

    // Check admin access
    const userQuery = await pool.query(
      'SELECT is_super_admin, role FROM users WHERE supabase_id = $1',
      [req.user.supabase_id]
    );

    if (userQuery.rows.length === 0 || (!userQuery.rows[0].is_super_admin && userQuery.rows[0].role !== 'admin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    let query = `
      SELECT 
        cm.*,
        u.username,
        u.email
      FROM content_moderation cm
      JOIN users u ON cm.user_id::text = u.id::text
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (contentType) {
      query += ` AND cm.content_type = $${paramIndex}`;
      params.push(contentType);
      paramIndex++;
    }

    if (severity) {
      query += ` AND cm.severity = $${paramIndex}`;
      params.push(severity);
      paramIndex++;
    }

    if (status) {
      query += ` AND cm.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY cm.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const moderationHistory = await pool.query(query, params);

    res.json({
      success: true,
      history: moderationHistory.rows.map(record => ({
        id: record.id,
        contentType: record.content_type,
        contentId: record.content_id,
        userId: record.user_id,
        username: record.username,
        email: record.email,
        originalContent: record.original_content,
        moderationResult: record.moderation_result,
        isViolation: record.is_violation,
        confidence: record.confidence_score,
        severity: record.severity,
        actionTaken: record.action_taken,
        status: record.status,
        createdAt: record.created_at
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching moderation history:', error);
    res.status(500).json({ error: 'Failed to fetch moderation history' });
  }
});

// Review flagged content (admin)
router.post('/admin/review/:moderationId', authenticateToken, async (req, res) => {
  try {
    const { moderationId } = req.params;
    const { action, notes } = req.body; // 'approve', 'reject', 'escalate'
    const adminId = req.user.supabase_id;

    // Check admin access
    const userQuery = await pool.query(
      'SELECT is_super_admin, role FROM users WHERE supabase_id = $1',
      [adminId]
    );

    if (userQuery.rows.length === 0 || (!userQuery.rows[0].is_super_admin && userQuery.rows[0].role !== 'admin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Update moderation record
    await pool.query(`
      UPDATE content_moderation 
      SET status = $1, admin_review = $2, reviewed_by = $3, reviewed_at = NOW()
      WHERE id = $4
    `, [
      action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'escalated',
      notes,
      adminId,
      moderationId
    ]);

    res.json({
      success: true,
      message: `Content ${action}ed successfully`
    });

  } catch (error) {
    console.error('❌ Error reviewing content:', error);
    res.status(500).json({ error: 'Failed to review content' });
  }
});

// Apply penalty to user based on violation severity
router.applyUserPenalty = async function(userId, severity) {
  try {
    const userQuery = await pool.query(
      'SELECT moderation_strikes, is_suspended FROM users WHERE supabase_id = $1',
      [userId]
    );

    if (userQuery.rows.length === 0) return;

    const user = userQuery.rows[0];
    let newStrikes = (user.moderation_strikes || 0) + 1;
    let suspensionDays = 0;

    // Determine penalty based on severity and strike count
    if (severity === 'high') {
      newStrikes += 2; // High severity = 3 total strikes
      if (newStrikes >= 3) {
        suspensionDays = 7; // 1 week suspension
      }
    } else if (severity === 'medium') {
      newStrikes += 1; // Medium severity = 2 total strikes
      if (newStrikes >= 5) {
        suspensionDays = 3; // 3 day suspension
      }
    }

    const suspensionEnd = suspensionDays > 0 
      ? new Date(Date.now() + suspensionDays * 24 * 60 * 60 * 1000)
      : null;

    await pool.query(`
      UPDATE users 
      SET moderation_strikes = $1, 
          suspension_end = $2,
          is_suspended = $3
      WHERE supabase_id = $4
    `, [newStrikes, suspensionEnd, suspensionEnd !== null, userId]);

    // Log penalty action
    await pool.query(`
      INSERT INTO user_penalties (user_id, penalty_type, severity, duration_days, reason, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [
      userId,
      suspensionEnd ? 'suspension' : 'warning',
      severity,
      suspensionDays,
      `Automatic penalty for ${severity} severity content violation`
    ]);

  } catch (error) {
    console.error('❌ Error applying user penalty:', error);
  }
};

module.exports = router;