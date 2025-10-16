const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');

// Get comprehensive earnings analytics including VOD
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { period = 'month', startDate, endDate } = req.query;
    
    // Check if user is a creator
    const userResult = await pool.query(
      'SELECT is_creator, display_name FROM users WHERE supabase_id = $1',
      [userId]
    );
    
    if (!userResult.rows[0]?.is_creator) {
      return res.status(403).json({ error: 'Only creators can view earnings analytics' });
    }
    
    // Calculate date range
    let dateFilter = '';
    const params = [userId];
    
    const now = new Date();
    let periodStart, periodEnd;
    
    if (startDate && endDate) {
      periodStart = new Date(startDate);
      periodEnd = new Date(endDate);
    } else {
      switch(period) {
        case 'today':
          periodStart = new Date(now.setHours(0,0,0,0));
          periodEnd = new Date(now.setHours(23,59,59,999));
          break;
        case 'week':
          periodStart = new Date(now.setDate(now.getDate() - 7));
          periodEnd = new Date();
          break;
        case 'month':
        default:
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
      }
    }
    
    params.push(periodStart, periodEnd);
    dateFilter = 'AND created_at BETWEEN $2 AND $3';
    
    // Get total earnings summary - simplified version without optional tables
    const summaryQuery = `
      WITH all_earnings AS (
        -- Tips (only if table exists)
        SELECT 'tips' as type, amount, created_at
        FROM tips
        WHERE creator_id = $1 ${dateFilter}

        UNION ALL

        -- Video call earnings
        SELECT 'video_calls' as type, COALESCE(total_amount, 0) as amount, created_at
        FROM sessions
        WHERE creator_supabase_id = $1
          AND type = 'video'
          AND status = 'completed' ${dateFilter}

        UNION ALL

        -- Voice call earnings
        SELECT 'voice_calls' as type, COALESCE(total_amount, 0) as amount, created_at
        FROM sessions
        WHERE creator_supabase_id = $1
          AND type = 'voice'
          AND status = 'completed' ${dateFilter}
      )
      SELECT
        COUNT(*) as total_transactions,
        COALESCE(SUM(amount), 0) as total_earnings,
        COALESCE(AVG(amount), 0) as average_earning,
        COALESCE(MAX(amount), 0) as highest_earning,
        COUNT(DISTINCT DATE(created_at)) as active_days
      FROM all_earnings
    `;

    const summaryResult = await pool.query(summaryQuery, params);
    
    // Get earnings breakdown by type - simplified
    const breakdownQuery = `
      SELECT
        type,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total
      FROM (
        -- Tips
        SELECT 'tips' as type, amount
        FROM tips
        WHERE creator_id = $1 ${dateFilter}

        UNION ALL

        -- Video calls
        SELECT 'videoCalls' as type, COALESCE(total_amount, 0) as amount
        FROM sessions
        WHERE creator_supabase_id = $1
          AND type = 'video'
          AND status = 'completed' ${dateFilter}

        UNION ALL

        -- Voice calls
        SELECT 'voiceCalls' as type, COALESCE(total_amount, 0) as amount
        FROM sessions
        WHERE creator_supabase_id = $1
          AND type = 'voice'
          AND status = 'completed' ${dateFilter}
      ) as earnings_breakdown
      GROUP BY type
    `;

    const breakdownResult = await pool.query(breakdownQuery, params);
    
    // Format breakdown data
    const breakdown = {
      tips: 0,
      videoCalls: 0,
      voiceCalls: 0,
      messages: 0,
      vod: 0, // NEW
      content: 0,
      liveStreams: 0,
      gifts: 0
    };
    
    breakdownResult.rows.forEach(row => {
      breakdown[row.type] = parseFloat(row.total || 0);
    });

    // Format response - simplified without VOD details
    const response = {
      summary: {
        totalEarnings: parseFloat(summaryResult.rows[0]?.total_earnings || 0),
        totalTransactions: parseInt(summaryResult.rows[0]?.total_transactions || 0),
        averageEarning: parseFloat(summaryResult.rows[0]?.average_earning || 0),
        highestEarning: parseFloat(summaryResult.rows[0]?.highest_earning || 0),
        activeDays: parseInt(summaryResult.rows[0]?.active_days || 0)
      },
      breakdown,
      periodEarnings: {
        today: period === 'today' ? parseFloat(summaryResult.rows[0]?.total_earnings || 0) : 0,
        week: period === 'week' ? parseFloat(summaryResult.rows[0]?.total_earnings || 0) : 0,
        month: period === 'month' ? parseFloat(summaryResult.rows[0]?.total_earnings || 0) : 0
      }
    };

    res.json(response);
    
  } catch (error) {
    console.error('Error fetching earnings analytics:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Failed to fetch earnings analytics',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get VOD-specific analytics
router.get('/vod-analytics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { period = '30d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch(period) {
      case '7d':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case '30d':
        startDate = new Date(now.setDate(now.getDate() - 30));
        break;
      case '90d':
        startDate = new Date(now.setDate(now.getDate() - 90));
        break;
      default:
        startDate = new Date(now.setDate(now.getDate() - 30));
    }
    
    // Get VOD statistics
    const vodStatsQuery = `
      SELECT 
        COUNT(DISTINCT vp.id) as total_purchases,
        COUNT(DISTINCT sr.id) as unique_vods_sold,
        SUM(vp.tokens_paid) as total_tokens_earned,
        AVG(vp.tokens_paid) as average_price,
        MAX(vp.tokens_paid) as highest_sale,
        COUNT(DISTINCT vp.user_id) as unique_buyers
      FROM vod_purchases vp
      JOIN stream_recordings sr ON vp.recording_id = sr.id
      WHERE sr.creator_id = $1 
        AND vp.purchased_at >= $2
    `;
    
    const statsResult = await pool.query(vodStatsQuery, [userId, startDate]);
    
    // Get top performing VODs
    const topVODsQuery = `
      SELECT 
        sr.id,
        sr.title,
        sr.price_in_tokens,
        sr.duration_seconds,
        sr.created_at as recorded_date,
        COUNT(vp.id) as purchase_count,
        SUM(vp.tokens_paid) as total_earnings,
        MAX(vp.purchased_at) as last_purchase
      FROM stream_recordings sr
      LEFT JOIN vod_purchases vp ON sr.id = vp.recording_id
      WHERE sr.creator_id = $1 
        AND (vp.purchased_at >= $2 OR vp.purchased_at IS NULL)
      GROUP BY sr.id, sr.title, sr.price_in_tokens, sr.duration_seconds, sr.created_at
      ORDER BY total_earnings DESC NULLS LAST
      LIMIT 10
    `;
    
    const topVODsResult = await pool.query(topVODsQuery, [userId, startDate]);
    
    res.json({
      stats: statsResult.rows[0],
      topVODs: topVODsResult.rows,
      period
    });
    
  } catch (error) {
    console.error('Error fetching VOD analytics:', error);
    res.status(500).json({ error: 'Failed to fetch VOD analytics' });
  }
});

module.exports = router;