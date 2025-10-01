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
    
    // Get total earnings summary including VOD
    const summaryQuery = `
      WITH all_earnings AS (
        -- Tips
        SELECT 'tips' as type, amount, created_at 
        FROM tips 
        WHERE creator_id = $1 ${dateFilter}
        
        UNION ALL
        
        -- Video call earnings
        SELECT 'video_calls' as type, total_amount as amount, created_at 
        FROM sessions 
        WHERE creator_supabase_id = $1 
          AND type = 'video' 
          AND status = 'completed' ${dateFilter}
        
        UNION ALL
        
        -- Voice call earnings  
        SELECT 'voice_calls' as type, total_amount as amount, created_at 
        FROM sessions 
        WHERE creator_supabase_id = $1 
          AND type = 'voice' 
          AND status = 'completed' ${dateFilter}
        
        UNION ALL
        
        -- Message earnings
        SELECT 'messages' as type, 
               CASE 
                 WHEN message_type = 'text' THEN text_message_price
                 WHEN message_type = 'image' THEN image_message_price
                 WHEN message_type = 'audio' THEN audio_message_price
                 WHEN message_type = 'video' THEN video_message_price
                 ELSE 0
               END as amount,
               created_at
        FROM messages
        WHERE recipient_id = $1 
          AND is_paid = true ${dateFilter}
        
        UNION ALL
        
        -- VOD purchases (NEW)
        SELECT 'vod' as type, tokens_paid as amount, purchased_at as created_at
        FROM vod_purchases vp
        JOIN stream_recordings sr ON vp.recording_id = sr.id
        WHERE sr.creator_id = $1 
          AND vp.purchased_at BETWEEN $2 AND $3
        
        UNION ALL
        
        -- Content purchases
        SELECT 'content' as type, price_in_tokens as amount, purchased_at as created_at
        FROM content_purchases cp
        JOIN content c ON cp.content_id = c.id
        WHERE c.creator_id = $1 
          AND cp.purchased_at BETWEEN $2 AND $3
        
        UNION ALL
        
        -- Live streaming earnings
        SELECT 'streaming' as type, tokens_earned as amount, created_at
        FROM stream_analytics
        WHERE creator_id = $1 ${dateFilter}
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
    
    // Get earnings breakdown by type including VOD
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
        SELECT 'videoCalls' as type, total_amount as amount 
        FROM sessions 
        WHERE creator_supabase_id = $1 
          AND type = 'video' 
          AND status = 'completed' ${dateFilter}
        
        UNION ALL
        
        -- Voice calls
        SELECT 'voiceCalls' as type, total_amount as amount 
        FROM sessions 
        WHERE creator_supabase_id = $1 
          AND type = 'voice' 
          AND status = 'completed' ${dateFilter}
        
        UNION ALL
        
        -- Messages
        SELECT 'messages' as type, 
               CASE 
                 WHEN message_type = 'text' THEN text_message_price
                 WHEN message_type = 'image' THEN image_message_price
                 WHEN message_type = 'audio' THEN audio_message_price
                 WHEN message_type = 'video' THEN video_message_price
                 ELSE 0
               END as amount
        FROM messages
        WHERE recipient_id = $1 
          AND is_paid = true ${dateFilter}
        
        UNION ALL
        
        -- VOD purchases (NEW)
        SELECT 'vod' as type, tokens_paid as amount
        FROM vod_purchases vp
        JOIN stream_recordings sr ON vp.recording_id = sr.id
        WHERE sr.creator_id = $1 
          AND vp.purchased_at BETWEEN $2 AND $3
        
        UNION ALL
        
        -- Content
        SELECT 'content' as type, price_in_tokens as amount
        FROM content_purchases cp
        JOIN content c ON cp.content_id = c.id
        WHERE c.creator_id = $1 
          AND cp.purchased_at BETWEEN $2 AND $3
        
        UNION ALL
        
        -- Live streams
        SELECT 'liveStreams' as type, tokens_earned as amount
        FROM stream_analytics
        WHERE creator_id = $1 ${dateFilter}
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
    
    // Get recent VOD purchases for detailed view
    const recentVODQuery = `
      SELECT 
        vp.id,
        vp.tokens_paid,
        vp.purchased_at,
        sr.title as vod_title,
        u.display_name as purchaser_name,
        u.username as purchaser_username
      FROM vod_purchases vp
      JOIN stream_recordings sr ON vp.recording_id = sr.id
      JOIN users u ON vp.user_id = u.supabase_id
      WHERE sr.creator_id = $1 
        AND vp.purchased_at BETWEEN $2 AND $3
      ORDER BY vp.purchased_at DESC
      LIMIT 10
    `;
    
    const recentVODResult = await pool.query(recentVODQuery, params);
    
    // Get period comparisons
    const previousPeriodStart = new Date(periodStart);
    const previousPeriodEnd = new Date(periodEnd);
    const daysDiff = Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24));
    previousPeriodStart.setDate(previousPeriodStart.getDate() - daysDiff);
    previousPeriodEnd.setDate(previousPeriodEnd.getDate() - daysDiff);
    
    const previousPeriodQuery = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM (
        SELECT tokens_paid as amount
        FROM vod_purchases vp
        JOIN stream_recordings sr ON vp.recording_id = sr.id
        WHERE sr.creator_id = $1 
          AND vp.purchased_at BETWEEN $2 AND $3
      ) as prev_period
    `;
    
    const previousResult = await pool.query(previousPeriodQuery, [userId, previousPeriodStart, previousPeriodEnd]);
    const previousVODEarnings = parseFloat(previousResult.rows[0]?.total || 0);
    const currentVODEarnings = breakdown.vod;
    const vodGrowth = previousVODEarnings > 0 
      ? ((currentVODEarnings - previousVODEarnings) / previousVODEarnings * 100).toFixed(1)
      : currentVODEarnings > 0 ? 100 : 0;
    
    // Format response
    const response = {
      summary: {
        totalEarnings: parseFloat(summaryResult.rows[0]?.total_earnings || 0),
        totalTransactions: parseInt(summaryResult.rows[0]?.total_transactions || 0),
        averageEarning: parseFloat(summaryResult.rows[0]?.average_earning || 0),
        highestEarning: parseFloat(summaryResult.rows[0]?.highest_earning || 0),
        activeDays: parseInt(summaryResult.rows[0]?.active_days || 0)
      },
      breakdown,
      vodDetails: {
        totalVODEarnings: breakdown.vod,
        vodPurchaseCount: recentVODResult.rows.length,
        recentPurchases: recentVODResult.rows,
        growth: vodGrowth
      },
      periodEarnings: {
        today: period === 'today' ? parseFloat(summaryResult.rows[0]?.total_earnings || 0) : 0,
        week: period === 'week' ? parseFloat(summaryResult.rows[0]?.total_earnings || 0) : 0,
        month: period === 'month' ? parseFloat(summaryResult.rows[0]?.total_earnings || 0) : 0
      }
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('Error fetching earnings analytics:', error);
    res.status(500).json({ error: 'Failed to fetch earnings analytics' });
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