const express = require('express');
const router = express.Router();
const pool = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');

// Get creator dashboard data
router.get('/creator/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get creator data
    const creatorQuery = await pool.query(
      `SELECT 
        u.*,
        COUNT(DISTINCT f.follower_id) as followers_count,
        COUNT(DISTINCT s.id) as total_sessions,
        COALESCE(SUM(s.total_cost), 0) as total_earnings
      FROM users u
      LEFT JOIN followers f ON f.creator_id = u.id
      LEFT JOIN sessions s ON s.creator_id = u.id
      WHERE u.supabase_id = $1
      GROUP BY u.id`,
      [userId]
    );

    if (creatorQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    const creator = creatorQuery.rows[0];

    // Get recent sessions
    const sessionsQuery = await pool.query(
      `SELECT 
        s.*,
        u.username as fan_username,
        u.profile_pic_url as fan_avatar
      FROM sessions s
      JOIN users u ON u.id = s.fan_id
      WHERE s.creator_id = $1
      ORDER BY s.created_at DESC
      LIMIT 10`,
      [creator.id]
    );

    // Get recent earnings
    const earningsQuery = await pool.query(
      `SELECT 
        DATE(created_at) as date,
        SUM(total_cost) as amount
      FROM sessions
      WHERE creator_id = $1 
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC`,
      [creator.id]
    );

    res.json({
      creator: {
        ...creator,
        followersCount: parseInt(creator.followers_count) || 0,
        totalSessions: parseInt(creator.total_sessions) || 0,
        totalEarnings: parseFloat(creator.total_earnings) || 0
      },
      recentSessions: sessionsQuery.rows,
      recentEarnings: earningsQuery.rows,
      stats: {
        todayEarnings: 0, // TODO: Calculate
        weekEarnings: 0,  // TODO: Calculate
        monthEarnings: parseFloat(creator.total_earnings) || 0
      }
    });
  } catch (error) {
    console.error('Error fetching creator dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

module.exports = router;