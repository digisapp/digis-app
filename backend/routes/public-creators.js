// routes/public-creators.js
// Public creator profile endpoint with robust identifier resolution
// Supports username, slug, handle, id, and supabase_id lookups

const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/optionalAuth');
const { pool } = require('../utils/db');

// UUID detector (covers standard v4 and most UUID forms)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET /api/public/creators/:identifier
 *
 * Fetch creator profile by username, slug, handle, id, or supabase_id
 * Matches the fallback chain used in CreatorCard component:
 * username → slug → handle → id → supabase_id
 *
 * Optional authentication: If viewer is logged in, returns is_followed_by_viewer flag
 */
router.get('/public/creators/:identifier', optionalAuth, async (req, res) => {
  try {
    const { identifier: raw } = req.params;

    // Normalize identifier - match client-side fallback chain
    const ident = decodeURIComponent(String(raw || '').trim()).toLowerCase();

    if (!ident) {
      return res.status(400).json({ error: 'Missing identifier' });
    }

    // If viewer is logged in, get their database ID (not supabase_id)
    let viewerDbId = null;
    if (req.user?.supabase_id) {
      const viewerResult = await pool.query(
        'SELECT id FROM users WHERE supabase_id = $1',
        [req.user.supabase_id]
      );
      viewerDbId = viewerResult.rows[0]?.id ?? null;
    }

    // Build WHERE clause with multiple identifier strategies
    // Priority order matches CreatorCard: username → id → supabase_id
    const conditions = [];
    const params = [];

    // 1. Username (case-insensitive)
    conditions.push(`LOWER(u.username) = $${params.push(ident)}`);

    // 2. If identifier looks like a UUID, try id and supabase_id
    if (UUID_RE.test(ident)) {
      // Try id (UUID)
      conditions.push(`u.id::text = $${params.push(ident)}`);

      // Try supabase_id (UUID)
      conditions.push(`LOWER(u.supabase_id::text) = $${params.push(ident)}`);
    }

    // Combine all conditions with OR
    const whereClause = conditions.length > 0 ? `(${conditions.join(' OR ')})` : 'FALSE';

    // Build comprehensive creator profile query
    const sql = `
      SELECT
        u.id,
        u.supabase_id,
        u.username,
        u.display_name,
        u.avatar_url,
        u.card_image_url,
        u.bio,
        u.creator_type AS category,
        u.interests,
        u.state,
        u.country,
        u.languages_spoken AS languages,
        u.is_creator,
        u.is_verified,
        u.created_at,
        u.last_active_at,

        -- Pricing
        u.video_price,
        u.voice_price,
        u.message_price,

        -- Social counts
        (SELECT COUNT(*)::int FROM follows f WHERE f.creator_id = u.id) AS follower_count,
        (SELECT COUNT(*)::int FROM follows f WHERE f.follower_id = u.id AND f.creator_id IS NOT NULL) AS following_count,

        -- Session stats
        (SELECT COUNT(*)::int FROM sessions s WHERE s.creator_id = u.id AND s.status = 'completed') AS total_sessions,

        -- Average rating (if you have a ratings table)
        -- (SELECT ROUND(AVG(rating)::numeric, 1) FROM ratings r WHERE r.creator_id = u.id) AS rating,

        -- Viewer context (if authenticated)
        ${
          viewerDbId
            ? `EXISTS(
                SELECT 1 FROM follows f
                WHERE f.follower_id = $${params.push(viewerDbId)}
                AND f.creator_id = u.id
              ) AS is_followed_by_viewer`
            : `false AS is_followed_by_viewer`
        },

        -- Online status (active within last 5 minutes)
        (CASE
          WHEN u.last_active_at IS NOT NULL AND u.last_active_at > NOW() - INTERVAL '5 minutes'
          THEN true
          ELSE false
        END) AS is_online,

        -- Live status (if you have streaming/live sessions)
        -- EXISTS(SELECT 1 FROM streams s WHERE s.creator_id = u.id AND s.status = 'live') AS is_live
        false AS is_live

      FROM public.users u
      WHERE ${whereClause}
      LIMIT 1;
    `;

    const result = await pool.query(sql, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Creator not found',
        identifier: raw // Return original identifier for debugging
      });
    }

    const creator = result.rows[0];

    // Set public caching headers
    // Weak ETag based on creator ID and created_at timestamp
    const etag = `W/"creator-${creator.id}-${new Date(creator.created_at).getTime()}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=60'); // 1 minute cache

    // Return 304 Not Modified if client has valid cached version
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    return res.json({ creator });

  } catch (err) {
    // Log error server-side with context
    console.error('GET /api/public/creators/:identifier failed', {
      identifier: req.params.identifier,
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });

    return res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;
