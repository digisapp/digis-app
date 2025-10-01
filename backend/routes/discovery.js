const express = require('express');
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get recommended creators based on user activity and preferences
router.get('/creators', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { limit = 10, offset = 0, category } = req.query;

    // Get user's interaction history for personalization
    const interactionQuery = `
      SELECT DISTINCT creator_id 
      FROM (
        SELECT creator_id FROM sessions WHERE fan_id = $1
        UNION
        SELECT creator_id FROM tips WHERE user_id = $1
        UNION
        SELECT creator_id FROM follows WHERE follower_id = $1
      ) interactions
      LIMIT 20
    `;
    
    const interactionResult = await pool.query(interactionQuery, [userId]);
    const interactedCreatorIds = interactionResult.rows.map(r => r.creator_id);

    // Build recommendation query
    let recommendationQuery = `
      WITH creator_stats AS (
        SELECT 
          u.supabase_id,
          u.username,
          u.display_name,
          u.profile_pic_url,
          u.bio,
          u.video_price,
          u.voice_price,
          u.creator_type,
          u.availability_status,
          u.is_verified,
          COUNT(DISTINCT f.follower_id) as follower_count,
          COUNT(DISTINCT s.session_id) as total_sessions,
          COALESCE(AVG(sr.rating), 0) as avg_rating,
          COUNT(DISTINCT c.id) as content_count,
          MAX(s.created_at) as last_active
        FROM users u
        LEFT JOIN follows f ON u.supabase_id = f.creator_id
        LEFT JOIN sessions s ON u.supabase_id = s.creator_id
        LEFT JOIN session_ratings sr ON s.session_id = sr.session_id
        LEFT JOIN content c ON u.supabase_id = c.creator_id AND c.is_published = true
        WHERE u.is_creator = true 
          AND u.is_suspended = false
          AND u.profile_blocked = false
          ${category ? 'AND u.creator_type = $3' : ''}
          ${interactedCreatorIds.length > 0 ? `AND u.supabase_id NOT IN (${interactedCreatorIds.map((_, i) => `$${i + 4}`).join(',')})` : ''}
        GROUP BY u.supabase_id
      )
      SELECT 
        *,
        -- Recommendation score based on various factors
        (
          (follower_count * 0.3) +
          (total_sessions * 0.2) +
          (avg_rating * 20) +
          (content_count * 0.1) +
          (CASE WHEN availability_status = 'online' THEN 50 ELSE 0 END) +
          (CASE WHEN is_verified THEN 30 ELSE 0 END) +
          (CASE 
            WHEN last_active > NOW() - INTERVAL '1 day' THEN 40
            WHEN last_active > NOW() - INTERVAL '7 days' THEN 20
            WHEN last_active > NOW() - INTERVAL '30 days' THEN 10
            ELSE 0
          END)
        ) as recommendation_score
      FROM creator_stats
      ORDER BY recommendation_score DESC, follower_count DESC
      LIMIT $1 OFFSET $2
    `;

    const queryParams = [limit, offset];
    if (category) queryParams.push(category);
    if (interactedCreatorIds.length > 0) {
      queryParams.push(...interactedCreatorIds);
    }

    const result = await pool.query(recommendationQuery, queryParams);

    res.json({
      success: true,
      creators: result.rows.map(creator => ({
        id: creator.supabase_id,
        username: creator.username,
        displayName: creator.display_name,
        avatar: creator.profile_pic_url,
        bio: creator.bio,
        videoPrice: parseFloat(creator.video_price || 0),
        voicePrice: parseFloat(creator.voice_price || 0),
        creatorType: creator.creator_type,
        isOnline: creator.availability_status === 'online',
        isVerified: creator.is_verified,
        stats: {
          followers: parseInt(creator.follower_count || 0),
          rating: parseFloat(creator.avg_rating || 0),
          sessions: parseInt(creator.total_sessions || 0),
          content: parseInt(creator.content_count || 0)
        },
        recommendationScore: parseFloat(creator.recommendation_score || 0)
      })),
      hasMore: result.rows.length === parseInt(limit),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching recommended creators:', error);
    res.status(500).json({ 
      error: 'Failed to fetch recommendations',
      timestamp: new Date().toISOString()
    });
  }
});

// Get trending creators
router.get('/trending', authenticateToken, async (req, res) => {
  try {
    const { limit = 20, period = '7d' } = req.query;
    
    const periodMap = {
      '24h': '1 day',
      '7d': '7 days',
      '30d': '30 days'
    };
    
    const interval = periodMap[period] || '7 days';

    const query = `
      WITH trending_stats AS (
        SELECT 
          u.supabase_id,
          u.username,
          u.display_name,
          u.profile_pic_url,
          u.bio,
          u.creator_type,
          u.is_verified,
          u.availability_status,
          COUNT(DISTINCT f.follower_id) FILTER (WHERE f.created_at > NOW() - INTERVAL '${interval}') as new_followers,
          COUNT(DISTINCT s.session_id) FILTER (WHERE s.created_at > NOW() - INTERVAL '${interval}') as recent_sessions,
          COUNT(DISTINCT t.id) FILTER (WHERE t.created_at > NOW() - INTERVAL '${interval}') as recent_tips,
          COUNT(DISTINCT c.id) FILTER (WHERE c.created_at > NOW() - INTERVAL '${interval}') as new_content,
          COUNT(DISTINCT f.follower_id) as total_followers
        FROM users u
        LEFT JOIN follows f ON u.supabase_id = f.creator_id
        LEFT JOIN sessions s ON u.supabase_id = s.creator_id
        LEFT JOIN tips t ON u.supabase_id = t.creator_id
        LEFT JOIN content c ON u.supabase_id = c.creator_id AND c.is_published = true
        WHERE u.is_creator = true 
          AND u.is_suspended = false
          AND u.profile_blocked = false
        GROUP BY u.supabase_id
        HAVING COUNT(DISTINCT f.follower_id) FILTER (WHERE f.created_at > NOW() - INTERVAL '${interval}') > 0
      )
      SELECT 
        *,
        -- Trending score calculation
        (
          (new_followers * 10) +
          (recent_sessions * 5) +
          (recent_tips * 3) +
          (new_content * 2) +
          (CASE WHEN is_verified THEN 20 ELSE 0 END)
        ) as trending_score
      FROM trending_stats
      ORDER BY trending_score DESC, new_followers DESC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);

    res.json({
      success: true,
      trending: result.rows.map(creator => ({
        id: creator.supabase_id,
        username: creator.username,
        displayName: creator.display_name,
        avatar: creator.profile_pic_url,
        bio: creator.bio,
        creatorType: creator.creator_type,
        isVerified: creator.is_verified,
        isOnline: creator.availability_status === 'online',
        stats: {
          newFollowers: parseInt(creator.new_followers || 0),
          recentSessions: parseInt(creator.recent_sessions || 0),
          recentTips: parseInt(creator.recent_tips || 0),
          newContent: parseInt(creator.new_content || 0),
          totalFollowers: parseInt(creator.total_followers || 0)
        },
        trendingScore: parseFloat(creator.trending_score || 0)
      })),
      period,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching trending creators:', error);
    res.status(500).json({ 
      error: 'Failed to fetch trending creators',
      timestamp: new Date().toISOString()
    });
  }
});

// Get creator categories
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        creator_type as category,
        COUNT(*) as creator_count,
        COUNT(*) FILTER (WHERE availability_status = 'online') as online_count
      FROM users
      WHERE is_creator = true 
        AND is_suspended = false
        AND creator_type IS NOT NULL
      GROUP BY creator_type
      ORDER BY creator_count DESC
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      categories: result.rows.map(cat => ({
        name: cat.category,
        displayName: cat.category.charAt(0).toUpperCase() + cat.category.slice(1).replace(/_/g, ' '),
        creatorCount: parseInt(cat.creator_count || 0),
        onlineCount: parseInt(cat.online_count || 0)
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ 
      error: 'Failed to fetch categories',
      timestamp: new Date().toISOString()
    });
  }
});

// Search creators
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q, category, minPrice, maxPrice, isOnline, limit = 20, offset = 0 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ 
        error: 'Search query must be at least 2 characters',
        timestamp: new Date().toISOString()
      });
    }

    let query = `
      SELECT 
        u.supabase_id,
        u.username,
        u.display_name,
        u.profile_pic_url,
        u.bio,
        u.video_price,
        u.voice_price,
        u.creator_type,
        u.availability_status,
        u.is_verified,
        COUNT(DISTINCT f.follower_id) as follower_count,
        COALESCE(AVG(sr.rating), 0) as avg_rating
      FROM users u
      LEFT JOIN follows f ON u.supabase_id = f.creator_id
      LEFT JOIN sessions s ON u.supabase_id = s.creator_id
      LEFT JOIN session_ratings sr ON s.session_id = sr.session_id
      WHERE u.is_creator = true 
        AND u.is_suspended = false
        AND u.profile_blocked = false
        AND (
          u.username ILIKE $1 OR 
          u.display_name ILIKE $1 OR 
          u.bio ILIKE $1
        )
    `;

    const queryParams = [`%${q}%`];
    let paramIndex = 2;

    if (category) {
      query += ` AND u.creator_type = $${paramIndex}`;
      queryParams.push(category);
      paramIndex++;
    }

    if (minPrice) {
      query += ` AND (u.video_price >= $${paramIndex} OR u.voice_price >= $${paramIndex})`;
      queryParams.push(parseFloat(minPrice));
      paramIndex++;
    }

    if (maxPrice) {
      query += ` AND (u.video_price <= $${paramIndex} OR u.voice_price <= $${paramIndex})`;
      queryParams.push(parseFloat(maxPrice));
      paramIndex++;
    }

    if (isOnline === 'true') {
      query += ` AND u.availability_status = 'online'`;
    }

    query += `
      GROUP BY u.supabase_id
      ORDER BY 
        CASE 
          WHEN u.username ILIKE $1 THEN 1
          WHEN u.display_name ILIKE $1 THEN 2
          ELSE 3
        END,
        follower_count DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);

    res.json({
      success: true,
      results: result.rows.map(creator => ({
        id: creator.supabase_id,
        username: creator.username,
        displayName: creator.display_name,
        avatar: creator.profile_pic_url,
        bio: creator.bio,
        videoPrice: parseFloat(creator.video_price || 0),
        voicePrice: parseFloat(creator.voice_price || 0),
        creatorType: creator.creator_type,
        isOnline: creator.availability_status === 'online',
        isVerified: creator.is_verified,
        stats: {
          followers: parseInt(creator.follower_count || 0),
          rating: parseFloat(creator.avg_rating || 0)
        }
      })),
      query: q,
      hasMore: result.rows.length === parseInt(limit),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error searching creators:', error);
    res.status(500).json({ 
      error: 'Failed to search creators',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
