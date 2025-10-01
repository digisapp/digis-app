/**
 * Example API Routes with Redis Caching
 * This demonstrates best practices for using Redis with Supabase
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const {
  cache,
  users: usersCache,
  creators: creatorsCache,
  rateLimiter,
  TTL
} = require('../utils/redis');

/**
 * Example 1: Get popular creators with caching
 * Reduces Supabase query load for frequently accessed data
 */
router.get('/popular-creators', async (req, res) => {
  try {
    const cacheKey = 'popular:creators';

    // Check cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        from: 'cache',
        message: 'Served from Redis cache'
      });
    }

    // If not cached, fetch from Supabase
    const result = await pool.query(`
      SELECT
        id, username, display_name, profile_pic_url,
        rating, total_reviews, video_price, stream_price
      FROM users
      WHERE is_creator = true
        AND profile_blocked = false
      ORDER BY rating DESC, total_reviews DESC
      LIMIT 20
    `);

    const creators = result.rows;

    // Cache for 5 minutes (popular data changes less frequently)
    await cache.set(cacheKey, creators, TTL.SHORT);

    res.json({
      success: true,
      data: creators,
      from: 'database',
      message: 'Fetched from database and cached'
    });

  } catch (error) {
    console.error('Error fetching popular creators:', error);
    res.status(500).json({ error: 'Failed to fetch creators' });
  }
});

/**
 * Example 2: Get user stats with intelligent caching
 * Cache user-specific data with appropriate TTL
 */
router.get('/user-stats/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const cacheKey = `stats:${userId}`;

    // Check cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        stats: cached,
        from: 'cache'
      });
    }

    // Fetch various stats from database
    const [tokenStats, sessionStats, followStats] = await Promise.all([
      // Token balance
      pool.query(
        'SELECT balance, total_earned, total_spent FROM token_balances WHERE user_id = $1',
        [userId]
      ),
      // Session count
      pool.query(
        'SELECT COUNT(*) as total_sessions FROM sessions WHERE creator_id = $1 OR fan_id = $1',
        [userId]
      ),
      // Follower count
      pool.query(
        'SELECT COUNT(*) as followers FROM followers WHERE creator_id = $1',
        [userId]
      )
    ]);

    const stats = {
      tokens: tokenStats.rows[0] || { balance: 0, total_earned: 0, total_spent: 0 },
      sessions: parseInt(sessionStats.rows[0]?.total_sessions || 0),
      followers: parseInt(followStats.rows[0]?.followers || 0),
      lastUpdated: new Date().toISOString()
    };

    // Cache for 30 minutes
    await cache.set(cacheKey, stats, TTL.MEDIUM);

    res.json({
      success: true,
      stats,
      from: 'database'
    });

  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * Example 3: Search with rate limiting
 * Prevent abuse while maintaining performance
 */
router.get('/search', async (req, res) => {
  try {
    const { q, type = 'all' } = req.query;
    const ip = req.ip;

    // Rate limit: 30 searches per minute per IP
    const limit = await rateLimiter.check(`search:${ip}`, 30, 60);

    if (!limit.allowed) {
      return res.status(429).json({
        error: 'Too many search requests',
        retryAfter: limit.reset,
        remaining: limit.remaining
      });
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Remaining', limit.remaining);
    res.setHeader('X-RateLimit-Reset', limit.reset);

    // Cache key includes search parameters
    const cacheKey = `search:${type}:${q?.toLowerCase()}`;

    // Check cache for identical searches
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        results: cached,
        from: 'cache'
      });
    }

    // Perform search
    let query;
    if (type === 'creators') {
      query = `
        SELECT id, username, display_name, profile_pic_url, is_creator
        FROM users
        WHERE is_creator = true
          AND (username ILIKE $1 OR display_name ILIKE $1)
        LIMIT 20
      `;
    } else {
      query = `
        SELECT id, username, display_name, profile_pic_url, is_creator
        FROM users
        WHERE username ILIKE $1 OR display_name ILIKE $1
        LIMIT 20
      `;
    }

    const result = await pool.query(query, [`%${q}%`]);

    // Cache search results for 5 minutes
    await cache.set(cacheKey, result.rows, TTL.SHORT);

    res.json({
      success: true,
      results: result.rows,
      from: 'database'
    });

  } catch (error) {
    console.error('Error performing search:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * Example 4: Invalidate cache on update
 * Ensure data consistency
 */
router.put('/creator-settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { video_price, stream_price, bio } = req.body;

    // Update database
    const result = await pool.query(
      `UPDATE users
       SET video_price = $1, stream_price = $2, bio = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [video_price, stream_price, bio, userId]
    );

    const updatedUser = result.rows[0];

    // Invalidate related caches
    await Promise.all([
      usersCache.invalidate(userId),           // User profile cache
      creatorsCache.invalidate(userId),        // Creator profile cache
      cache.del('popular:creators'),           // Popular creators list
      cache.del(`stats:${userId}`)             // User stats
    ]);

    res.json({
      success: true,
      user: updatedUser,
      message: 'Settings updated and cache cleared'
    });

  } catch (error) {
    console.error('Error updating creator settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * Example 5: Batch fetch with multi-caching
 * Efficiently handle multiple data requests
 */
router.post('/batch-users', authenticateToken, async (req, res) => {
  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'Invalid user IDs' });
    }

    // Check cache for each user
    const users = [];
    const uncachedIds = [];

    for (const id of userIds) {
      const cached = await usersCache.get(id);
      if (cached) {
        users.push(cached);
      } else {
        uncachedIds.push(id);
      }
    }

    // Fetch uncached users from database
    if (uncachedIds.length > 0) {
      const result = await pool.query(
        'SELECT * FROM users WHERE id = ANY($1::uuid[])',
        [uncachedIds]
      );

      // Cache each fetched user
      for (const user of result.rows) {
        await usersCache.cache(user.id, user, TTL.MEDIUM);
        users.push(user);
      }
    }

    res.json({
      success: true,
      users,
      stats: {
        total: userIds.length,
        fromCache: userIds.length - uncachedIds.length,
        fromDatabase: uncachedIds.length
      }
    });

  } catch (error) {
    console.error('Error batch fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * Example 6: Real-time data that shouldn't be cached
 * Some data should always be fresh
 */
router.get('/live-stream-viewers/:streamId', async (req, res) => {
  try {
    const { streamId } = req.params;

    // Don't cache real-time viewer counts
    const result = await pool.query(
      `SELECT COUNT(DISTINCT viewer_id) as viewer_count
       FROM stream_viewers
       WHERE stream_id = $1
         AND last_ping > NOW() - INTERVAL '30 seconds'`,
      [streamId]
    );

    res.json({
      success: true,
      viewers: parseInt(result.rows[0]?.viewer_count || 0),
      realtime: true,
      message: 'Real-time data - not cached'
    });

  } catch (error) {
    console.error('Error fetching viewer count:', error);
    res.status(500).json({ error: 'Failed to fetch viewer count' });
  }
});

module.exports = router;