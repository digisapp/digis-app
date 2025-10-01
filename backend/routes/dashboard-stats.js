const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');

// Get creator dashboard statistics
router.get('/creator', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    
    // Verify creator status
    const userResult = await db.query(
      'SELECT id, is_creator FROM users WHERE supabase_id = $1',
      [userId]
    );
    
    if (!userResult.rows[0]?.is_creator) {
      return res.status(403).json({ error: 'Creator access required' });
    }
    
    const creatorId = userResult.rows[0].id;
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const weekStart = new Date(now.setDate(now.getDate() - 7));
    
    // Get today's stats
    const todayStatsResult = await db.query(`
      SELECT 
        COALESCE(SUM(p.amount), 0) as earnings,
        COUNT(DISTINCT s.id) as calls,
        COALESCE(SUM(s.duration_minutes), 0) as minutes,
        COUNT(DISTINCT s.fan_id) as unique_fans
      FROM sessions s
      LEFT JOIN payments p ON s.id = p.session_id
      WHERE s.creator_id = $1 
        AND s.created_at >= $2
        AND p.status = 'completed'
    `, [creatorId, todayStart]);
    
    // Get yesterday's earnings for comparison
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayEnd = new Date(todayStart.getTime());
    
    const yesterdayEarningsResult = await db.query(`
      SELECT COALESCE(SUM(p.amount), 0) as earnings
      FROM sessions s
      LEFT JOIN payments p ON s.id = p.session_id
      WHERE s.creator_id = $1 
        AND s.created_at >= $2
        AND s.created_at < $3
        AND p.status = 'completed'
    `, [creatorId, yesterdayStart, yesterdayEnd]);
    
    // Calculate growth
    const todayEarnings = parseFloat(todayStatsResult.rows[0].earnings);
    const yesterdayEarnings = parseFloat(yesterdayEarningsResult.rows[0].earnings);
    const earningsGrowth = yesterdayEarnings > 0 
      ? ((todayEarnings - yesterdayEarnings) / yesterdayEarnings * 100).toFixed(1)
      : 0;
    
    // Get week stats
    const weekStatsResult = await db.query(`
      SELECT 
        COALESCE(SUM(p.amount), 0) as earnings,
        COUNT(DISTINCT s.id) as calls,
        COALESCE(SUM(s.duration_minutes), 0) as minutes
      FROM sessions s
      LEFT JOIN payments p ON s.id = p.session_id
      WHERE s.creator_id = $1 
        AND s.created_at >= $2
        AND p.status = 'completed'
    `, [creatorId, weekStart]);
    
    // Get subscriber/follower stats
    const subscriberStatsResult = await db.query(`
      SELECT 
        COUNT(DISTINCT f.follower_id) as total_followers,
        COUNT(DISTINCT CASE WHEN f.created_at >= $2 THEN f.follower_id END) as new_followers
      FROM followers f
      WHERE f.creator_id = $1
    `, [userId, weekStart]);
    
    // Get fan engagement stats
    const fanEngagementResult = await db.query(`
      SELECT 
        COUNT(DISTINCT CASE WHEN u.last_active >= NOW() - INTERVAL '15 minutes' THEN f.follower_id END) as online_now,
        COUNT(DISTINCT CASE WHEN u.last_active >= $2 THEN f.follower_id END) as active_today,
        COUNT(DISTINCT CASE WHEN u.last_active >= $3 THEN f.follower_id END) as active_this_week
      FROM followers f
      JOIN users u ON f.follower_id = u.supabase_id
      WHERE f.creator_id = $1
    `, [userId, todayStart, weekStart]);
    
    // Get top fans
    const topFansResult = await db.query(`
      SELECT 
        u.supabase_id as id,
        u.username,
        u.display_name,
        u.profile_pic_url as avatar,
        COALESCE(SUM(p.amount), 0) as total_spent,
        COUNT(DISTINCT s.id) as total_calls,
        MAX(s.created_at) as last_active
      FROM sessions s
      JOIN users u ON s.fan_id = u.id
      LEFT JOIN payments p ON s.id = p.session_id
      WHERE s.creator_id = $1
        AND p.status = 'completed'
      GROUP BY u.supabase_id, u.username, u.display_name, u.profile_pic_url
      ORDER BY total_spent DESC
      LIMIT 5
    `, [creatorId]);
    
    // Get recent activities
    const recentActivitiesResult = await db.query(`
      SELECT * FROM (
        SELECT 
          'tip' as type,
          u.display_name as user,
          t.amount,
          t.created_at as time,
          t.message
        FROM tip_transactions t
        JOIN users u ON t.sender_id = u.supabase_id
        WHERE t.recipient_id = $1
        ORDER BY t.created_at DESC
        LIMIT 5
      ) tips
      UNION ALL
      SELECT * FROM (
        SELECT 
          'gift' as type,
          u.display_name as user,
          g.tokens_spent as amount,
          g.created_at as time,
          g.gift_type as message
        FROM gift_transactions g
        JOIN users u ON g.sender_id = u.supabase_id
        WHERE g.recipient_id = $1
        ORDER BY g.created_at DESC
        LIMIT 5
      ) gifts
      ORDER BY time DESC
      LIMIT 10
    `, [userId]);
    
    // Get upcoming sessions
    const upcomingSessionsResult = await db.query(`
      SELECT 
        s.id,
        s.type,
        s.scheduled_time as time,
        s.duration as duration,
        u.display_name as fan,
        u.username as fan_username,
        (s.duration * cr.video_price / 60) as tokens
      FROM scheduled_sessions s
      JOIN users u ON s.fan_id = u.id
      JOIN users cr ON s.creator_id = cr.id
      WHERE s.creator_id = $1
        AND s.scheduled_time >= NOW()
        AND s.status = 'scheduled'
      ORDER BY s.scheduled_time ASC
      LIMIT 5
    `, [creatorId]);
    
    // Format response
    const todayStats = todayStatsResult.rows[0];
    const weekStats = weekStatsResult.rows[0];
    const subscriberStats = subscriberStatsResult.rows[0];
    const fanEngagement = fanEngagementResult.rows[0];
    
    res.json({
      todayStats: {
        earnings: parseFloat(todayStats.earnings || 0),
        calls: parseInt(todayStats.calls || 0),
        minutes: parseInt(todayStats.minutes || 0),
        uniqueFans: parseInt(todayStats.unique_fans || 0),
        earningsGrowth: parseFloat(earningsGrowth || 0)
      },
      weekStats: {
        earnings: parseFloat(weekStats.earnings || 0),
        calls: parseInt(weekStats.calls || 0),
        minutes: parseInt(weekStats.minutes || 0),
        growth: 0 // Calculate if needed
      },
      activeSubscribers: parseInt(subscriberStats.total_followers || 0),
      subscriberGrowth: subscriberStats.new_followers > 0 
        ? (subscriberStats.new_followers / subscriberStats.total_followers * 100).toFixed(1) 
        : 0,
      onlineNow: parseInt(fanEngagement.online_now || 0),
      activeToday: parseInt(fanEngagement.active_today || 0),
      activeThisWeek: parseInt(fanEngagement.active_this_week || 0),
      engagementRate: fanEngagement.active_this_week > 0 && subscriberStats.total_followers > 0
        ? Math.round(fanEngagement.active_this_week / subscriberStats.total_followers * 100)
        : 0,
      topFans: topFansResult.rows.map(fan => ({
        id: fan.id,
        username: fan.username,
        displayName: fan.display_name,
        avatar: fan.avatar,
        totalSpent: parseFloat(fan.total_spent || 0),
        totalCalls: parseInt(fan.total_calls || 0),
        lastActive: fan.last_active,
        isVip: parseFloat(fan.total_spent) > 1000
      })),
      recentActivities: recentActivitiesResult.rows,
      upcomingSessions: upcomingSessionsResult.rows.map(session => ({
        id: session.id,
        type: session.type,
        fan: session.fan,
        fanUsername: session.fan_username,
        time: session.time,
        duration: session.duration,
        tokens: parseFloat(session.tokens || 0)
      }))
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Get fan dashboard statistics
router.get('/fan', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    
    // Get user's recent sessions
    const recentSessionsResult = await db.query(`
      SELECT 
        s.id,
        s.type,
        s.created_at,
        s.duration_minutes,
        c.display_name as creator_name,
        c.username as creator_username,
        c.profile_pic_url as creator_avatar
      FROM sessions s
      JOIN users c ON s.creator_supabase_id = c.supabase_id
      WHERE s.user_supabase_id = $1
      ORDER BY s.created_at DESC
      LIMIT 10
    `, [userId]);
    
    // Get favorite creators
    const favoriteCreatorsResult = await db.query(`
      SELECT 
        c.supabase_id as id,
        c.username,
        c.display_name,
        c.profile_pic_url as avatar,
        c.is_online,
        COUNT(s.id) as session_count
      FROM users c
      JOIN sessions s ON s.creator_supabase_id = c.supabase_id
      WHERE s.user_supabase_id = $1
      GROUP BY c.supabase_id, c.username, c.display_name, c.profile_pic_url, c.is_online
      ORDER BY session_count DESC
      LIMIT 5
    `, [userId]);
    
    // Get spending stats
    const spendingStatsResult = await db.query(`
      SELECT 
        COALESCE(SUM(p.amount), 0) as total_spent,
        COUNT(DISTINCT s.id) as total_sessions,
        AVG(p.amount) as avg_per_session
      FROM sessions s
      JOIN payments p ON s.id = p.session_id
      WHERE s.user_supabase_id = $1
        AND p.status = 'completed'
    `, [userId]);
    
    res.json({
      recentSessions: recentSessionsResult.rows,
      favoriteCreators: favoriteCreatorsResult.rows,
      stats: {
        totalSpent: parseFloat(spendingStatsResult.rows[0]?.total_spent || 0),
        totalSessions: parseInt(spendingStatsResult.rows[0]?.total_sessions || 0),
        avgPerSession: parseFloat(spendingStatsResult.rows[0]?.avg_per_session || 0)
      }
    });
  } catch (error) {
    console.error('Error fetching fan dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

module.exports = router;