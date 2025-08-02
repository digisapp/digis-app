const express = require('express');
// Supabase removed - using Supabase
const { Pool } = require('pg');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Challenge definitions
const DAILY_CHALLENGES = {
  LOGIN_STREAK: {
    id: 'daily_login',
    title: 'Daily Explorer',
    description: 'Log in to the platform',
    type: 'login',
    target: 1,
    reward: { tokens: 50, points: 10 },
    icon: '🌅',
    category: 'engagement'
  },
  WATCH_STREAM: {
    id: 'watch_stream',
    title: 'Stream Watcher',
    description: 'Watch a live stream for at least 10 minutes',
    type: 'stream_watch',
    target: 10, // minutes
    reward: { tokens: 100, points: 25 },
    icon: '📺',
    category: 'engagement'
  },
  SEND_MESSAGES: {
    id: 'chat_active',
    title: 'Chat Champion',
    description: 'Send 5 messages in live streams',
    type: 'chat_messages',
    target: 5,
    reward: { tokens: 75, points: 15 },
    icon: '💬',
    category: 'social'
  },
  TIP_CREATOR: {
    id: 'tip_creator',
    title: 'Generous Supporter',
    description: 'Tip any creator at least 100 tokens',
    type: 'tip_amount',
    target: 100,
    reward: { tokens: 50, points: 20 },
    icon: '💰',
    category: 'spending'
  },
  DISCOVER_CREATOR: {
    id: 'discover_creator',
    title: 'Creator Explorer',
    description: 'Visit 3 different creator profiles',
    type: 'profile_visits',
    target: 3,
    reward: { tokens: 75, points: 15 },
    icon: '🔍',
    category: 'discovery'
  }
};

const WEEKLY_CHALLENGES = {
  STREAMING_HOURS: {
    id: 'weekly_stream_hours',
    title: 'Stream Marathon',
    description: 'Watch streams for a total of 5 hours this week',
    type: 'total_watch_time',
    target: 300, // minutes
    reward: { tokens: 500, points: 100 },
    icon: '⏰',
    category: 'engagement'
  },
  CREATOR_DISCOVERY: {
    id: 'weekly_creator_discovery',
    title: 'Creator Connoisseur',
    description: 'Discover and interact with 10 different creators',
    type: 'unique_creators',
    target: 10,
    reward: { tokens: 300, points: 75 },
    icon: '🌟',
    category: 'discovery'
  },
  SPENDING_MILESTONE: {
    id: 'weekly_spending',
    title: 'Big Spender',
    description: 'Spend 1,000 tokens on tips and sessions',
    type: 'total_spending',
    target: 1000,
    reward: { tokens: 200, points: 100 },
    icon: '💎',
    category: 'spending'
  },
  SOCIAL_BUTTERFLY: {
    id: 'weekly_social',
    title: 'Social Butterfly',
    description: 'Send 50 messages and receive 10 responses',
    type: 'social_interaction',
    target: { messages: 50, responses: 10 },
    reward: { tokens: 400, points: 80 },
    icon: '🦋',
    category: 'social'
  },
  LOYALTY_BADGE: {
    id: 'weekly_loyalty',
    title: 'Platform Loyalist',
    description: 'Log in for 5 consecutive days',
    type: 'login_streak',
    target: 5,
    reward: { tokens: 250, points: 50 },
    icon: '🔥',
    category: 'loyalty'
  }
};

// Get available challenges for user
router.get('/available', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { type = 'all' } = req.query;

    const today = new Date().toISOString().split('T')[0];
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const weekStart = startOfWeek.toISOString().split('T')[0];

    // Get user's current challenges
    const currentChallengesQuery = await pool.query(`
      SELECT * FROM user_challenges 
      WHERE user_id = $1 
      AND ((type = 'daily' AND date_assigned >= $2) 
           OR (type = 'weekly' AND date_assigned >= $3))
      AND status IN ('active', 'completed')
    `, [userId, today, weekStart]);

    const userChallenges = currentChallengesQuery.rows;
    const activeChallengeIds = userChallenges.map(c => c.challenge_id);

    // Select daily challenges (3 random ones if none exist for today)
    let dailyChallenges = userChallenges.filter(c => c.type === 'daily');
    if (dailyChallenges.length === 0) {
      const dailyKeys = Object.keys(DAILY_CHALLENGES);
      const selectedDaily = dailyKeys
        .sort(() => 0.5 - Math.random())
        .slice(0, 3)
        .map(key => ({
          ...DAILY_CHALLENGES[key],
          type: 'daily',
          dateAssigned: today,
          status: 'active',
          progress: 0
        }));

      // Insert new daily challenges
      for (const challenge of selectedDaily) {
        await pool.query(`
          INSERT INTO user_challenges (user_id, challenge_id, type, title, description, 
                                     target_value, reward_tokens, reward_points, status, 
                                     date_assigned, progress)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          userId, challenge.id, challenge.type, challenge.title, challenge.description,
          challenge.target, challenge.reward.tokens, challenge.reward.points,
          'active', today, 0
        ]);
      }
      
      dailyChallenges = selectedDaily;
    }

    // Select weekly challenges (2 random ones if none exist for this week)
    let weeklyChallenges = userChallenges.filter(c => c.type === 'weekly');
    if (weeklyChallenges.length === 0) {
      const weeklyKeys = Object.keys(WEEKLY_CHALLENGES);
      const selectedWeekly = weeklyKeys
        .sort(() => 0.5 - Math.random())
        .slice(0, 2)
        .map(key => ({
          ...WEEKLY_CHALLENGES[key],
          type: 'weekly',
          dateAssigned: weekStart,
          status: 'active',
          progress: 0
        }));

      // Insert new weekly challenges
      for (const challenge of selectedWeekly) {
        const targetValue = typeof challenge.target === 'object' 
          ? JSON.stringify(challenge.target) 
          : challenge.target;
          
        await pool.query(`
          INSERT INTO user_challenges (user_id, challenge_id, type, title, description, 
                                     target_value, reward_tokens, reward_points, status, 
                                     date_assigned, progress, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          userId, challenge.id, challenge.type, challenge.title, challenge.description,
          targetValue, challenge.reward.tokens, challenge.reward.points,
          'active', weekStart, 0, JSON.stringify({ target: challenge.target })
        ]);
      }
      
      weeklyChallenges = selectedWeekly;
    }

    const challenges = {
      daily: type === 'all' || type === 'daily' ? dailyChallenges : [],
      weekly: type === 'all' || type === 'weekly' ? weeklyChallenges : []
    };

    res.json({
      success: true,
      challenges,
      summary: {
        totalActive: dailyChallenges.length + weeklyChallenges.length,
        dailyCompleted: dailyChallenges.filter(c => c.status === 'completed').length,
        weeklyCompleted: weeklyChallenges.filter(c => c.status === 'completed').length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching available challenges:', error);
    res.status(500).json({ error: 'Failed to fetch available challenges' });
  }
});

// Update challenge progress
router.post('/progress', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { challengeId, progressIncrement = 1, metadata = {} } = req.body;

    if (!challengeId) {
      return res.status(400).json({ error: 'Challenge ID is required' });
    }

    // Get current challenge
    const challengeQuery = await pool.query(`
      SELECT * FROM user_challenges 
      WHERE user_id = $1 AND challenge_id = $2 AND status = 'active'
      ORDER BY date_assigned DESC LIMIT 1
    `, [userId, challengeId]);

    if (challengeQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Active challenge not found' });
    }

    const challenge = challengeQuery.rows[0];
    const newProgress = challenge.progress + progressIncrement;
    const targetValue = typeof challenge.target_value === 'string' 
      ? JSON.parse(challenge.target_value) 
      : challenge.target_value;
    
    const isCompleted = newProgress >= (typeof targetValue === 'object' ? 
      Math.min(...Object.values(targetValue)) : targetValue);

    // Update progress
    await pool.query(`
      UPDATE user_challenges 
      SET progress = $1, status = $2, completed_at = $3, metadata = $4
      WHERE id = $5
    `, [
      newProgress, 
      isCompleted ? 'completed' : 'active',
      isCompleted ? new Date() : null,
      JSON.stringify({ ...challenge.metadata, ...metadata }),
      challenge.id
    ]);

    // Award rewards if completed
    if (isCompleted && challenge.status !== 'completed') {
      // Add tokens to user balance
      await pool.query(`
        INSERT INTO token_transactions (user_id, type, tokens, description, status, session_id, created_at)
        VALUES ($1, 'challenge_reward', $2, $3, 'completed', NULL, NOW())
      `, [
        userId, 
        challenge.reward_tokens,
        `Challenge completed: ${challenge.title}`
      ]);

      // Update user token balance
      await pool.query(`
        INSERT INTO token_balances (user_id, balance)
        VALUES ($1, $2)
        ON CONFLICT (user_id)
        DO UPDATE SET balance = token_balances.balance + $2, updated_at = NOW()
      `, [userId, challenge.reward_tokens]);

      // Log achievement
      await pool.query(`
        INSERT INTO achievements (user_id, type, title, description, points, metadata, created_at)
        VALUES ($1, 'challenge', $2, $3, $4, $5, NOW())
      `, [
        userId,
        challenge.title,
        `Completed ${challenge.type} challenge: ${challenge.description}`,
        challenge.reward_points,
        JSON.stringify({ 
          challengeId: challenge.challenge_id,
          challengeType: challenge.type,
          tokensEarned: challenge.reward_tokens
        })
      ]);
    }

    res.json({
      success: true,
      challenge: {
        id: challenge.challenge_id,
        title: challenge.title,
        description: challenge.description,
        type: challenge.type,
        progress: newProgress,
        target: targetValue,
        completed: isCompleted,
        reward: {
          tokens: challenge.reward_tokens,
          points: challenge.reward_points
        }
      },
      tokensEarned: isCompleted ? challenge.reward_tokens : 0
    });

  } catch (error) {
    console.error('❌ Error updating challenge progress:', error);
    res.status(500).json({ error: 'Failed to update challenge progress' });
  }
});

// Get user's challenge history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { limit = 50, offset = 0, type } = req.query;

    let whereClause = 'WHERE user_id = $1';
    let params = [userId];
    
    if (type) {
      whereClause += ' AND type = $2';
      params.push(type);
    }

    const challengesQuery = await pool.query(`
      SELECT * FROM user_challenges 
      ${whereClause}
      ORDER BY date_assigned DESC, completed_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    const challenges = challengesQuery.rows.map(challenge => ({
      id: challenge.challenge_id,
      title: challenge.title,
      description: challenge.description,
      type: challenge.type,
      progress: challenge.progress,
      target: typeof challenge.target_value === 'string' 
        ? JSON.parse(challenge.target_value) 
        : challenge.target_value,
      status: challenge.status,
      reward: {
        tokens: challenge.reward_tokens,
        points: challenge.reward_points
      },
      dateAssigned: challenge.date_assigned,
      completedAt: challenge.completed_at,
      metadata: challenge.metadata
    }));

    // Get statistics
    const statsQuery = await pool.query(`
      SELECT 
        COUNT(*) as total_challenges,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_challenges,
        SUM(CASE WHEN status = 'completed' THEN reward_tokens ELSE 0 END) as total_tokens_earned,
        SUM(CASE WHEN status = 'completed' THEN reward_points ELSE 0 END) as total_points_earned,
        COUNT(CASE WHEN type = 'daily' AND status = 'completed' THEN 1 END) as daily_completed,
        COUNT(CASE WHEN type = 'weekly' AND status = 'completed' THEN 1 END) as weekly_completed
      FROM user_challenges 
      WHERE user_id = $1
    `, [userId]);

    const stats = statsQuery.rows[0];

    res.json({
      success: true,
      challenges,
      stats: {
        totalChallenges: parseInt(stats.total_challenges),
        completedChallenges: parseInt(stats.completed_challenges),
        completionRate: stats.total_challenges > 0 ? 
          Math.round((stats.completed_challenges / stats.total_challenges) * 100) : 0,
        totalTokensEarned: parseInt(stats.total_tokens_earned) || 0,
        totalPointsEarned: parseInt(stats.total_points_earned) || 0,
        dailyCompleted: parseInt(stats.daily_completed),
        weeklyCompleted: parseInt(stats.weekly_completed)
      },
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: parseInt(stats.total_challenges)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching challenge history:', error);
    res.status(500).json({ error: 'Failed to fetch challenge history' });
  }
});

// Get challenge leaderboard
router.get('/leaderboard', authenticateToken, async (req, res) => {
  try {
    const { period = 'weekly', limit = 50 } = req.query;

    const timeFilter = period === 'daily' 
      ? "AND date_assigned >= CURRENT_DATE"
      : "AND date_assigned >= DATE_TRUNC('week', CURRENT_DATE)";

    const leaderboardQuery = await pool.query(`
      SELECT 
        CAST(u.id AS text),
        u.username,
        u.profile_pic_url,
        COUNT(uc.id) as challenges_completed,
        SUM(uc.reward_tokens) as tokens_earned,
        SUM(uc.reward_points) as points_earned,
        MAX(uc.completed_at) as last_completion
      FROM users u
      JOIN user_challenges uc ON CAST(u.id AS text) = uc.user_id
      WHERE uc.status = 'completed' ${timeFilter}
      GROUP BY CAST(u.id AS text), u.username, u.profile_pic_url
      ORDER BY challenges_completed DESC, points_earned DESC
      LIMIT $1
    `, [limit]);

    const leaderboard = leaderboardQuery.rows.map((user, index) => ({
      rank: index + 1,
      userId: user.id,
      username: user.username,
      profilePic: user.profile_pic_url,
      challengesCompleted: parseInt(user.challenges_completed),
      tokensEarned: parseInt(user.tokens_earned),
      pointsEarned: parseInt(user.points_earned),
      lastCompletion: user.last_completion
    }));

    res.json({
      success: true,
      leaderboard,
      period,
      total: leaderboard.length
    });

  } catch (error) {
    console.error('❌ Error fetching challenge leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch challenge leaderboard' });
  }
});

module.exports = router;