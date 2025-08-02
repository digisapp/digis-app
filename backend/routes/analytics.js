const express = require('express');
const { Pool } = require('pg');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Store analytics events from frontend collector
 */
router.post('/events', [
  body('events').isArray().notEmpty(),
  body('sessionMetrics').optional().isObject(),
  body('batchId').isString()
], authenticateToken, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { events, sessionMetrics, batchId } = req.body;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Insert events into analytics_events table
    if (events.length > 0) {
      const eventValues = events.map((event, index) => `(
        $${index * 7 + 1}, $${index * 7 + 2}, $${index * 7 + 3}, 
        $${index * 7 + 4}, $${index * 7 + 5}, $${index * 7 + 6}, $${index * 7 + 7}
      )`).join(', ');

      const eventParams = events.flatMap(event => [
        userId,
        event.sessionId || null,
        event.eventType,
        JSON.stringify(event.data || {}),
        new Date(event.timestamp),
        batchId,
        event.creatorId || userId
      ]);

      const eventQuery = `
        INSERT INTO analytics_events (
          user_id, session_id, event_type, event_data, 
          timestamp, batch_id, creator_id
        ) VALUES ${eventValues}
        ON CONFLICT DO NOTHING
      `;

      await pool.query(eventQuery, eventParams);
    }

    // Store session metrics if provided
    if (sessionMetrics && sessionMetrics.startTime && events[0]?.sessionId) {
      const metricsQuery = `
        INSERT INTO session_metrics (
          session_id, user_id, start_time, end_time, duration,
          quality_metrics, revenue_metrics, technical_metrics, 
          interactions_count, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (session_id) DO UPDATE SET
          end_time = EXCLUDED.end_time,
          duration = EXCLUDED.duration,
          quality_metrics = EXCLUDED.quality_metrics,
          revenue_metrics = EXCLUDED.revenue_metrics,
          technical_metrics = EXCLUDED.technical_metrics,
          interactions_count = EXCLUDED.interactions_count,
          updated_at = NOW()
      `;

      await pool.query(metricsQuery, [
        events[0].sessionId,
        userId,
        new Date(sessionMetrics.startTime),
        sessionMetrics.endTime ? new Date(sessionMetrics.endTime) : null,
        sessionMetrics.duration || 0,
        JSON.stringify(sessionMetrics.quality || {}),
        JSON.stringify(sessionMetrics.revenue || {}),
        JSON.stringify(sessionMetrics.technical || {}),
        sessionMetrics.interactions?.length || 0
      ]);
    }

    // Log successful processing
    console.log(`📊 Processed ${events.length} analytics events for user ${userId}`);

    res.json({
      success: true,
      eventsProcessed: events.length,
      batchId
    });

  } catch (error) {
    console.error('❌ Analytics events storage error:', error);
    res.status(500).json({ error: 'Failed to store analytics events' });
  }
});

// Get creator analytics dashboard data
router.get('/creator/:creatorId', authenticateToken, async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { period = '30', timezone = 'UTC' } = req.query;
    
    // Ensure user can only access their own analytics or is admin
    if (req.user.supabase_id !== creatorId) {
      const userQuery = await pool.query(
        'SELECT is_super_admin, role FROM users WHERE supabase_id = $1',
        [req.user.supabase_id]
      );
      
      if (userQuery.rows.length === 0 || (!userQuery.rows[0].is_super_admin && userQuery.rows[0].role !== 'admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const periodDays = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // Get basic creator stats
    const creatorStats = await pool.query(`
      SELECT 
        u.username,
        u.is_creator,
        u.total_earnings,
        u.total_sessions,
        u.created_at as creator_since,
        (SELECT COUNT(*) FROM followers WHERE creator_id = u.id) as follower_count,
        (SELECT AVG(rating) FROM session_ratings sr 
         JOIN sessions s ON sr.session_id = s.id 
         WHERE s.creator_id = (SELECT id FROM users WHERE supabase_id = u.supabase_id)) as avg_rating
      FROM users u
      WHERE u.supabase_id = $1 AND u.is_creator = true
    `, [creatorId]);

    if (creatorStats.rows.length === 0) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    const creator = creatorStats.rows[0];

    // Get earnings data over time
    const earningsData = await pool.query(`
      SELECT 
        DATE(s.start_time) as date,
        SUM(s.total_amount) as daily_earnings,
        COUNT(*) as session_count,
        AVG(s.duration_minutes) as avg_duration
      FROM sessions s
      JOIN users u ON s.creator_id = u.id
      WHERE u.supabase_id = $1 
        AND s.start_time >= $2
        AND s.status = 'ended'
      GROUP BY DATE(s.start_time)
      ORDER BY date ASC
    `, [creatorId, startDate]);

    // Get session type breakdown
    const sessionTypes = await pool.query(`
      SELECT 
        s.type,
        COUNT(*) as count,
        SUM(s.total_amount) as revenue,
        AVG(s.duration_minutes) as avg_duration
      FROM sessions s
      JOIN users u ON s.creator_id = u.id
      WHERE u.supabase_id = $1 
        AND s.start_time >= $2
        AND s.status = 'ended'
      GROUP BY s.type
    `, [creatorId, startDate]);

    // Get top fans data
    const topFans = await pool.query(`
      SELECT 
        fan.username,
        fan.profile_pic_url,
        COUNT(s.id) as session_count,
        SUM(s.total_amount) as total_spent,
        MAX(s.start_time) as last_session
      FROM sessions s
      JOIN users creator ON s.creator_id = creator.id
      JOIN users fan ON s.member_id = fan.id
      WHERE creator.supabase_id = $1 
        AND s.start_time >= $2
        AND s.status = 'ended'
      GROUP BY fan.id, fan.username, fan.profile_pic_url
      ORDER BY total_spent DESC
      LIMIT 10
    `, [creatorId, startDate]);

    // Get hourly activity pattern
    const hourlyActivity = await pool.query(`
      SELECT 
        EXTRACT(HOUR FROM s.start_time) as hour,
        COUNT(*) as session_count,
        SUM(s.total_amount) as revenue
      FROM sessions s
      JOIN users u ON s.creator_id = u.id
      WHERE u.supabase_id = $1 
        AND s.start_time >= $2
        AND s.status = 'ended'
      GROUP BY EXTRACT(HOUR FROM s.start_time)
      ORDER BY hour
    `, [creatorId, startDate]);

    // Get retention metrics
    const retentionData = await pool.query(`
      WITH fan_sessions AS (
        SELECT 
          s.member_id,
          COUNT(*) as session_count,
          MIN(s.start_time) as first_session,
          MAX(s.start_time) as last_session
        FROM sessions s
        JOIN users u ON s.creator_id = u.id
        WHERE u.supabase_id = $1 
          AND s.start_time >= $2
          AND s.status = 'ended'
        GROUP BY s.member_id
      )
      SELECT 
        COUNT(*) FILTER (WHERE session_count = 1) as one_time_fans,
        COUNT(*) FILTER (WHERE session_count BETWEEN 2 AND 5) as casual_fans,
        COUNT(*) FILTER (WHERE session_count > 5) as loyal_fans,
        AVG(session_count) as avg_sessions_per_fan
      FROM fan_sessions
    `, [creatorId, startDate]);

    // Get recent tips data
    const tipsData = await pool.query(`
      SELECT 
        DATE(tt.created_at) as date,
        COUNT(*) as tip_count,
        SUM(tt.tokens) as total_tokens,
        AVG(tt.tokens) as avg_tip_size
      FROM token_transactions tt
      WHERE tt.user_id = $1 
        AND tt.type = 'tip'
        AND tt.created_at >= $2
      GROUP BY DATE(tt.created_at)
      ORDER BY date ASC
    `, [creatorId, startDate]);

    // Calculate growth metrics
    const previousPeriodStart = new Date(startDate);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - periodDays);

    const growthMetrics = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE s.start_time >= $2 AND s.start_time < $3) as current_sessions,
        COUNT(*) FILTER (WHERE s.start_time >= $4 AND s.start_time < $2) as previous_sessions,
        SUM(s.total_amount) FILTER (WHERE s.start_time >= $2 AND s.start_time < $3) as current_revenue,
        SUM(s.total_amount) FILTER (WHERE s.start_time >= $4 AND s.start_time < $2) as previous_revenue,
        COUNT(DISTINCT s.member_id) FILTER (WHERE s.start_time >= $2 AND s.start_time < $3) as current_unique_fans,
        COUNT(DISTINCT s.member_id) FILTER (WHERE s.start_time >= $4 AND s.start_time < $2) as previous_unique_fans
      FROM sessions s
      JOIN users u ON s.creator_id = u.id
      WHERE u.supabase_id = $1 AND s.status = 'ended'
    `, [creatorId, startDate, new Date(), previousPeriodStart]);

    const growth = growthMetrics.rows[0];
    const sessionGrowth = growth.previous_sessions > 0 
      ? ((growth.current_sessions - growth.previous_sessions) / growth.previous_sessions * 100)
      : 0;
    const revenueGrowth = growth.previous_revenue > 0 
      ? ((parseFloat(growth.current_revenue || 0) - parseFloat(growth.previous_revenue || 0)) / parseFloat(growth.previous_revenue) * 100)
      : 0;
    const fanGrowth = growth.previous_unique_fans > 0 
      ? ((growth.current_unique_fans - growth.previous_unique_fans) / growth.previous_unique_fans * 100)
      : 0;

    res.json({
      success: true,
      analytics: {
        creator: {
          username: creator.username,
          totalEarnings: parseFloat(creator.total_earnings) || 0,
          totalSessions: parseInt(creator.total_sessions) || 0,
          followerCount: parseInt(creator.follower_count) || 0,
          avgRating: parseFloat(creator.avg_rating) || 0,
          creatorSince: creator.creator_since
        },
        earnings: {
          dailyData: earningsData.rows.map(row => ({
            date: row.date,
            earnings: parseFloat(row.daily_earnings) || 0,
            sessions: parseInt(row.session_count) || 0,
            avgDuration: parseFloat(row.avg_duration) || 0
          })),
          totalPeriod: earningsData.rows.reduce((sum, row) => sum + (parseFloat(row.daily_earnings) || 0), 0)
        },
        sessions: {
          typeBreakdown: sessionTypes.rows.map(row => ({
            type: row.type,
            count: parseInt(row.count),
            revenue: parseFloat(row.revenue) || 0,
            avgDuration: parseFloat(row.avg_duration) || 0
          })),
          hourlyActivity: Array.from({length: 24}, (_, hour) => {
            const data = hourlyActivity.rows.find(row => parseInt(row.hour) === hour);
            return {
              hour,
              sessions: data ? parseInt(data.session_count) : 0,
              revenue: data ? parseFloat(data.revenue) : 0
            };
          })
        },
        fans: {
          topFans: topFans.rows.map(row => ({
            username: row.username,
            profilePic: row.profile_pic_url,
            sessionCount: parseInt(row.session_count),
            totalSpent: parseFloat(row.total_spent) || 0,
            lastSession: row.last_session
          })),
          retention: retentionData.rows[0] ? {
            oneTimeFans: parseInt(retentionData.rows[0].one_time_fans) || 0,
            casualFans: parseInt(retentionData.rows[0].casual_fans) || 0,
            loyalFans: parseInt(retentionData.rows[0].loyal_fans) || 0,
            avgSessionsPerFan: parseFloat(retentionData.rows[0].avg_sessions_per_fan) || 0
          } : {}
        },
        tips: {
          dailyData: tipsData.rows.map(row => ({
            date: row.date,
            count: parseInt(row.tip_count),
            tokens: parseInt(row.total_tokens) || 0,
            avgSize: parseFloat(row.avg_tip_size) || 0
          }))
        },
        growth: {
          sessions: sessionGrowth,
          revenue: revenueGrowth,
          uniqueFans: fanGrowth,
          period: `${periodDays} days`
        },
        period: {
          days: periodDays,
          startDate: startDate,
          endDate: new Date()
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching creator analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

// Get platform-wide analytics (admin only)
router.get('/platform', authenticateToken, async (req, res) => {
  try {
    const { period = '30' } = req.query;
    
    // Check admin status
    const userQuery = await pool.query(
      'SELECT is_super_admin, role FROM users WHERE supabase_id = $1',
      [req.user.supabase_id]
    );
    
    if (userQuery.rows.length === 0 || (!userQuery.rows[0].is_super_admin && userQuery.rows[0].role !== 'admin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const periodDays = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // Platform overview stats
    const platformStats = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE is_creator = true) as total_creators,
        COUNT(*) FILTER (WHERE is_creator = false) as total_fans,
        SUM(total_earnings) as platform_revenue,
        AVG(total_earnings) FILTER (WHERE is_creator = true AND total_earnings > 0) as avg_creator_earnings
      FROM users
    `);

    // Session analytics
    const sessionStats = await pool.query(`
      SELECT 
        COUNT(*) as total_sessions,
        SUM(total_amount) as total_revenue,
        AVG(duration_minutes) as avg_duration,
        COUNT(*) FILTER (WHERE type = 'video') as video_sessions,
        COUNT(*) FILTER (WHERE type = 'voice') as voice_sessions,
        COUNT(*) FILTER (WHERE type = 'stream') as stream_sessions
      FROM sessions
      WHERE start_time >= $1 AND status = 'ended'
    `, [startDate]);

    // Daily revenue trends
    const revenueData = await pool.query(`
      SELECT 
        DATE(start_time) as date,
        COUNT(*) as session_count,
        SUM(total_amount) as revenue,
        COUNT(DISTINCT creator_id) as active_creators,
        COUNT(DISTINCT member_id) as active_fans
      FROM sessions
      WHERE start_time >= $1 AND status = 'ended'
      GROUP BY DATE(start_time)
      ORDER BY date ASC
    `, [startDate]);

    // Creator performance distribution
    const creatorPerformance = await pool.query(`
      SELECT 
        CASE 
          WHEN total_earnings = 0 THEN '0'
          WHEN total_earnings < 100 THEN '1-99'
          WHEN total_earnings < 500 THEN '100-499'
          WHEN total_earnings < 1000 THEN '500-999'
          ELSE '1000+'
        END as earnings_range,
        COUNT(*) as creator_count
      FROM users
      WHERE is_creator = true
      GROUP BY earnings_range
      ORDER BY 
        CASE earnings_range
          WHEN '0' THEN 0
          WHEN '1-99' THEN 1
          WHEN '100-499' THEN 2
          WHEN '500-999' THEN 3
          WHEN '1000+' THEN 4
        END
    `);

    res.json({
      success: true,
      analytics: {
        platform: platformStats.rows[0],
        sessions: sessionStats.rows[0],
        revenue: {
          dailyData: revenueData.rows,
          total: revenueData.rows.reduce((sum, row) => sum + (parseFloat(row.revenue) || 0), 0)
        },
        creators: {
          performanceDistribution: creatorPerformance.rows
        },
        period: {
          days: periodDays,
          startDate: startDate,
          endDate: new Date()
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching platform analytics:', error);
    res.status(500).json({ error: 'Failed to fetch platform analytics' });
  }
});

// Get predictive analytics
router.get('/predictions/:creatorId', authenticateToken, async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { period = '30' } = req.query;
    
    // Ensure user can only access their own analytics or is admin
    if (req.user.supabase_id !== creatorId) {
      const userQuery = await pool.query(
        'SELECT is_super_admin, role FROM users WHERE supabase_id = $1',
        [req.user.supabase_id]
      );
      
      if (userQuery.rows.length === 0 || (!userQuery.rows[0].is_super_admin && userQuery.rows[0].role !== 'admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const periodDays = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // Get historical data for predictions
    const historicalData = await pool.query(`
      SELECT 
        DATE(s.start_time) as date,
        COUNT(*) as session_count,
        SUM(s.total_amount) as daily_revenue,
        AVG(s.duration_minutes) as avg_duration,
        COUNT(DISTINCT s.member_id) as unique_fans,
        EXTRACT(DOW FROM s.start_time) as day_of_week,
        EXTRACT(HOUR FROM s.start_time) as hour_of_day
      FROM sessions s
      JOIN users u ON s.creator_id = u.id
      WHERE u.supabase_id = $1 
        AND s.start_time >= $2
        AND s.status = 'ended'
      GROUP BY DATE(s.start_time), EXTRACT(DOW FROM s.start_time), EXTRACT(HOUR FROM s.start_time)
      ORDER BY date ASC
    `, [creatorId, startDate]);

    // Calculate trends and predictions
    const dailyData = {};
    historicalData.rows.forEach(row => {
      const date = row.date.toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = {
          sessions: 0,
          revenue: 0,
          avgDuration: 0,
          uniqueFans: 0,
          hours: []
        };
      }
      dailyData[date].sessions += parseInt(row.session_count);
      dailyData[date].revenue += parseFloat(row.daily_revenue) || 0;
      dailyData[date].avgDuration = parseFloat(row.avg_duration) || 0;
      dailyData[date].uniqueFans += parseInt(row.unique_fans);
      dailyData[date].hours.push({
        hour: parseInt(row.hour_of_day),
        sessions: parseInt(row.session_count)
      });
    });

    const dates = Object.keys(dailyData).sort();
    const revenues = dates.map(date => dailyData[date].revenue);
    const sessions = dates.map(date => dailyData[date].sessions);

    // Simple linear regression for revenue prediction
    const n = revenues.length;
    if (n >= 7) { // Need at least a week of data
      const xSum = dates.reduce((sum, _, i) => sum + i, 0);
      const ySum = revenues.reduce((sum, rev) => sum + rev, 0);
      const xySum = revenues.reduce((sum, rev, i) => sum + (i * rev), 0);
      const x2Sum = dates.reduce((sum, _, i) => sum + (i * i), 0);

      const slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
      const intercept = (ySum - slope * xSum) / n;

      // Predict next 7 days
      const predictions = [];
      for (let i = 1; i <= 7; i++) {
        const predictedRevenue = Math.max(0, slope * (n + i - 1) + intercept);
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + i);
        
        predictions.push({
          date: futureDate.toISOString().split('T')[0],
          predictedRevenue: predictedRevenue,
          confidence: Math.max(0.1, Math.min(0.9, 1 - (Math.abs(slope) / (ySum / n)))) // Simple confidence calculation
        });
      }

      // Calculate best performing hours
      const hourlyPerformance = {};
      historicalData.rows.forEach(row => {
        const hour = parseInt(row.hour_of_day);
        if (!hourlyPerformance[hour]) {
          hourlyPerformance[hour] = { sessions: 0, revenue: 0, count: 0 };
        }
        hourlyPerformance[hour].sessions += parseInt(row.session_count);
        hourlyPerformance[hour].revenue += parseFloat(row.daily_revenue) || 0;
        hourlyPerformance[hour].count += 1;
      });

      const bestHours = Object.entries(hourlyPerformance)
        .map(([hour, data]) => ({
          hour: parseInt(hour),
          avgSessions: data.sessions / data.count,
          avgRevenue: data.revenue / data.count,
          score: (data.sessions + data.revenue) / data.count
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      // Revenue optimization suggestions
      const avgRevenue = revenues.reduce((sum, rev) => sum + rev, 0) / revenues.length;
      const recentAvgRevenue = revenues.slice(-7).reduce((sum, rev) => sum + rev, 0) / Math.min(7, revenues.length);
      const trend = recentAvgRevenue > avgRevenue ? 'increasing' : 'decreasing';

      const optimizationSuggestions = [];
      
      if (trend === 'decreasing') {
        optimizationSuggestions.push({
          type: 'pricing',
          title: 'Consider adjusting your rates',
          description: 'Your recent revenue is declining. Try experimenting with different pricing strategies.',
          impact: 'medium',
          effort: 'low'
        });
      }

      if (bestHours.length > 0) {
        optimizationSuggestions.push({
          type: 'scheduling',
          title: `Schedule more sessions during ${bestHours[0].hour}:00-${bestHours[0].hour + 1}:00`,
          description: `This is your highest performing hour with ${bestHours[0].avgSessions.toFixed(1)} avg sessions and $${bestHours[0].avgRevenue.toFixed(2)} avg revenue.`,
          impact: 'high',
          effort: 'low'
        });
      }

      // Fan retention analysis
      const fanRetentionQuery = await pool.query(`
        SELECT 
          COUNT(DISTINCT s.member_id) as total_unique_fans,
          COUNT(DISTINCT CASE WHEN recent.member_id IS NOT NULL THEN s.member_id END) as returning_fans
        FROM sessions s
        JOIN users u ON s.creator_id = u.id
        LEFT JOIN (
          SELECT DISTINCT member_id 
          FROM sessions s2 
          JOIN users u2 ON s2.creator_id = u2.id
          WHERE u2.supabase_id = $1 
            AND s2.start_time >= NOW() - INTERVAL '7 days'
            AND s2.status = 'ended'
        ) recent ON s.member_id = recent.member_id
        WHERE u.supabase_id = $1 
          AND s.start_time >= $2
          AND s.status = 'ended'
      `, [creatorId, startDate]);

      const retentionData = fanRetentionQuery.rows[0];
      const retentionRate = retentionData.total_unique_fans > 0 
        ? (retentionData.returning_fans / retentionData.total_unique_fans) * 100 
        : 0;

      if (retentionRate < 30) {
        optimizationSuggestions.push({
          type: 'engagement',
          title: 'Improve fan retention',
          description: `Your fan retention rate is ${retentionRate.toFixed(1)}%. Consider offering loyalty rewards or subscription tiers.`,
          impact: 'high',
          effort: 'medium'
        });
      }

      res.json({
        success: true,
        predictions: {
          revenue: {
            next7Days: predictions,
            trend: trend,
            confidence: predictions.length > 0 ? predictions[0].confidence : 0,
            projectedTotal: predictions.reduce((sum, p) => sum + p.predictedRevenue, 0)
          },
          optimization: {
            bestPerformingHours: bestHours,
            suggestions: optimizationSuggestions,
            fanRetention: {
              rate: retentionRate,
              totalUniqueFans: parseInt(retentionData.total_unique_fans) || 0,
              returningFans: parseInt(retentionData.returning_fans) || 0
            }
          },
          insights: {
            dataQuality: n >= 14 ? 'good' : n >= 7 ? 'fair' : 'limited',
            seasonality: this.detectSeasonality(dailyData),
            growthRate: slope > 0 ? ((slope / (avgRevenue || 1)) * 100) : 0
          }
        }
      });

    } else {
      res.json({
        success: true,
        predictions: {
          message: 'Insufficient data for predictions. Need at least 7 days of session history.',
          dataPoints: n,
          requiredDataPoints: 7
        }
      });
    }

  } catch (error) {
    console.error('❌ Error generating predictive analytics:', error);
    res.status(500).json({ error: 'Failed to generate predictions' });
  }
});

// Helper function to detect seasonality patterns
router.detectSeasonality = function(dailyData) {
  const dates = Object.keys(dailyData).sort();
  if (dates.length < 14) return null;

  const dayOfWeekData = {};
  dates.forEach(date => {
    const dayOfWeek = new Date(date).getDay();
    if (!dayOfWeekData[dayOfWeek]) {
      dayOfWeekData[dayOfWeek] = { revenue: 0, sessions: 0, count: 0 };
    }
    dayOfWeekData[dayOfWeek].revenue += dailyData[date].revenue;
    dayOfWeekData[dayOfWeek].sessions += dailyData[date].sessions;
    dayOfWeekData[dayOfWeek].count += 1;
  });

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weeklyPattern = Object.entries(dayOfWeekData).map(([day, data]) => ({
    day: dayNames[parseInt(day)],
    avgRevenue: data.revenue / data.count,
    avgSessions: data.sessions / data.count
  }));

  const bestDay = weeklyPattern.reduce((best, current) => 
    current.avgRevenue > best.avgRevenue ? current : best
  );

  return {
    weeklyPattern,
    bestDay: bestDay.day,
    hasStrongPattern: weeklyPattern.some(day => day.avgRevenue > 0)
  };
};

// Get advanced fan insights
router.get('/fan-insights/:creatorId', authenticateToken, async (req, res) => {
  try {
    const { creatorId } = req.params;
    
    // Ensure user can only access their own analytics
    if (req.user.supabase_id !== creatorId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Fan lifetime value analysis
    const fanLtvQuery = await pool.query(`
      SELECT 
        s.member_id,
        u.username,
        COUNT(*) as session_count,
        SUM(s.total_amount) as total_spent,
        AVG(s.total_amount) as avg_session_value,
        MIN(s.start_time) as first_session,
        MAX(s.start_time) as last_session,
        AVG(s.duration_minutes) as avg_duration,
        EXTRACT(DAYS FROM MAX(s.start_time) - MIN(s.start_time)) as relationship_days
      FROM sessions s
      JOIN users creator ON s.creator_id = creator.id
      JOIN users u ON s.member_id = u.id
      WHERE creator.supabase_id = $1 AND s.status = 'ended'
      GROUP BY s.member_id, u.username
      HAVING COUNT(*) > 0
      ORDER BY total_spent DESC
    `, [creatorId]);

    // Categorize fans
    const fans = fanLtvQuery.rows.map(fan => {
      const totalSpent = parseFloat(fan.total_spent) || 0;
      const sessionCount = parseInt(fan.session_count);
      const relationshipDays = parseInt(fan.relationship_days) || 1;
      
      let category = 'casual';
      if (totalSpent > 100 && sessionCount > 10) category = 'vip';
      else if (totalSpent > 50 || sessionCount > 5) category = 'loyal';
      else if (sessionCount === 1) category = 'new';

      return {
        userId: fan.member_id,
        username: fan.username,
        sessionCount,
        totalSpent,
        avgSessionValue: parseFloat(fan.avg_session_value) || 0,
        avgDuration: parseFloat(fan.avg_duration) || 0,
        firstSession: fan.first_session,
        lastSession: fan.last_session,
        relationshipDays,
        category,
        monthlyValue: relationshipDays > 30 ? (totalSpent / (relationshipDays / 30)) : totalSpent
      };
    });

    // Fan segments analysis
    const segments = {
      new: fans.filter(f => f.category === 'new'),
      casual: fans.filter(f => f.category === 'casual'),
      loyal: fans.filter(f => f.category === 'loyal'),
      vip: fans.filter(f => f.category === 'vip')
    };

    // Churn risk analysis
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const churnRisk = fans.filter(fan => 
      new Date(fan.lastSession) < thirtyDaysAgo && fan.sessionCount > 1
    ).map(fan => ({
      ...fan,
      daysSinceLastSession: Math.floor((new Date() - new Date(fan.lastSession)) / (1000 * 60 * 60 * 24))
    }));

    res.json({
      success: true,
      fanInsights: {
        overview: {
          totalFans: fans.length,
          totalLifetimeValue: fans.reduce((sum, fan) => sum + fan.totalSpent, 0),
          avgLifetimeValue: fans.length > 0 ? fans.reduce((sum, fan) => sum + fan.totalSpent, 0) / fans.length : 0,
          avgSessionsPerFan: fans.length > 0 ? fans.reduce((sum, fan) => sum + fan.sessionCount, 0) / fans.length : 0
        },
        segments: {
          new: { count: segments.new.length, totalValue: segments.new.reduce((sum, f) => sum + f.totalSpent, 0) },
          casual: { count: segments.casual.length, totalValue: segments.casual.reduce((sum, f) => sum + f.totalSpent, 0) },
          loyal: { count: segments.loyal.length, totalValue: segments.loyal.reduce((sum, f) => sum + f.totalSpent, 0) },
          vip: { count: segments.vip.length, totalValue: segments.vip.reduce((sum, f) => sum + f.totalSpent, 0) }
        },
        topFans: fans.slice(0, 10),
        churnRisk: {
          atRiskFans: churnRisk.slice(0, 10),
          totalAtRisk: churnRisk.length,
          averageDaysSinceLastSession: churnRisk.length > 0 
            ? churnRisk.reduce((sum, fan) => sum + fan.daysSinceLastSession, 0) / churnRisk.length 
            : 0
        },
        recommendations: this.generateFanEngagementRecommendations(segments, churnRisk)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching fan insights:', error);
    res.status(500).json({ error: 'Failed to fetch fan insights' });
  }
});

// Generate fan engagement recommendations
router.generateFanEngagementRecommendations = function(segments, churnRisk) {
  const recommendations = [];

  if (segments.new.length > 0) {
    recommendations.push({
      type: 'new_fan_retention',
      title: 'Welcome new fans',
      description: `You have ${segments.new.length} new fans. Consider creating welcome content or offering first-session discounts.`,
      priority: 'high',
      targetSegment: 'new'
    });
  }

  if (segments.vip.length < segments.loyal.length * 0.1) {
    recommendations.push({
      type: 'vip_conversion',
      title: 'Convert loyal fans to VIP',
      description: 'Create exclusive VIP experiences or subscription tiers to convert your loyal fans.',
      priority: 'medium',
      targetSegment: 'loyal'
    });
  }

  if (churnRisk.length > 0) {
    recommendations.push({
      type: 'churn_prevention',
      title: 'Re-engage at-risk fans',
      description: `${churnRisk.length} fans haven't visited in 30+ days. Send personalized messages or special offers.`,
      priority: 'high',
      targetSegment: 'churn_risk'
    });
  }

  if (segments.casual.length > segments.loyal.length * 2) {
    recommendations.push({
      type: 'casual_conversion',
      title: 'Convert casual fans',
      description: 'Many fans only have 1-2 sessions. Create engaging follow-up content or loyalty programs.',
      priority: 'medium',
      targetSegment: 'casual'
    });
  }

  return recommendations;
};

// Get real-time metrics
router.get('/realtime/:creatorId', authenticateToken, async (req, res) => {
  try {
    const { creatorId } = req.params;
    
    // Ensure user can only access their own analytics
    if (req.user.supabase_id !== creatorId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get current active sessions
    const activeSessions = await pool.query(`
      SELECT 
        s.id,
        s.type,
        s.start_time,
        fan.username as fan_username,
        s.price_per_min
      FROM sessions s
      JOIN users creator ON s.creator_id = creator.id
      JOIN users fan ON s.member_id = fan.id
      WHERE creator.supabase_id = $1 AND s.status = 'active'
    `, [creatorId]);

    // Get today's stats
    const todayStats = await pool.query(`
      SELECT 
        COUNT(*) as sessions_today,
        SUM(total_amount) as earnings_today,
        AVG(duration_minutes) as avg_duration_today
      FROM sessions s
      JOIN users u ON s.creator_id = u.id
      WHERE u.supabase_id = $1 
        AND DATE(s.start_time) = CURRENT_DATE
        AND s.status = 'ended'
    `, [creatorId]);

    // Get online followers count
    const onlineFollowersCount = await pool.query(`
      SELECT COUNT(*) as online_followers
      FROM followers f
      JOIN user_online_status uos ON f.follower_id = uos.user_id
      WHERE f.creator_id = $1 AND uos.is_online = true
    `, [creatorId]);

    res.json({
      success: true,
      realtime: {
        activeSessions: activeSessions.rows,
        today: todayStats.rows[0],
        onlineFollowers: parseInt(onlineFollowersCount.rows[0]?.online_followers) || 0,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('❌ Error fetching realtime analytics:', error);
    res.status(500).json({ error: 'Failed to fetch realtime analytics' });
  }
});

module.exports = router;