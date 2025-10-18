/**
 * Creator Overview Endpoint
 *
 * Provides a unified API endpoint that aggregates all key creator metrics:
 * - Token balances and earnings
 * - Payouts and tips
 * - Sessions and streams
 * - Content and sales
 * - Followers and subscribers
 * - Analytics
 *
 * Uses Upstash Redis for caching to reduce database load
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { getUserId, sanitizeUserForResponse } = require('../utils/auth-helpers');
const cache = require('../utils/upstash-cache');

/**
 * GET /api/v1/creators/overview
 *
 * Query params (optional):
 *   from=ISO8601     Start datetime filter (inclusive)
 *   to=ISO8601       End datetime filter (exclusive)
 *   noCache=true     Bypass cache
 *
 * Auth: Supabase JWT (bearer). Reads supabase_id from JWT claims.
 *
 * Returns: Complete creator metrics snapshot
 */
router.get('/overview', async (req, res) => {
  try {
    // Resolve the authenticated user's canonical ID (supabase_id)
    const supabaseId = getUserId(req);
    if (!supabaseId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    // Resolve internal numeric user id and profile data
    const { rows: userRows } = await pool.query(
      `SELECT
        id, supabase_id, username, display_name, email, is_creator, role,
        creator_token_balance, token_balance,
        video_rate_cents, voice_rate_cents, stream_rate_cents, message_price_cents,
        avatar_url, cover_photo_url, banner_url, card_image_url,
        bio, about_me
       FROM users
       WHERE supabase_id = $1
       LIMIT 1`,
      [supabaseId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found in database'
        }
      });
    }

    const me = userRows[0];
    const dbUserId = me.id; // internal integer ID for FK lookups

    // Time filters (optional)
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;

    // Build time filter SQL
    const buildTimeFilter = (columnName = 'created_at') => {
      const conditions = [];
      const params = [];
      let paramIndex = 0;

      if (from) {
        conditions.push(`${columnName} >= $${++paramIndex}`);
        params.push(from.toISOString());
      }
      if (to) {
        conditions.push(`${columnName} < $${++paramIndex}`);
        params.push(to.toISOString());
      }

      return {
        sql: conditions.length ? ` AND ${conditions.join(' AND ')}` : '',
        params
      };
    };

    const timeFilter = buildTimeFilter();

    // Cache key (include time window for accurate caching)
    const cacheKey = `creator:overview:${supabaseId}:${from ? from.toISOString() : 'all'}:${to ? to.toISOString() : 'all'}`;
    const useCache = !String(req.query.noCache || '').toLowerCase().includes('true');

    // Try cache first
    if (useCache) {
      const cached = await cache.get(cacheKey);
      if (cached) {
        console.log(`[Creator Overview] Cache hit for ${supabaseId}`);
        return res.json(JSON.parse(cached));
      }
    }

    console.log(`[Creator Overview] Cache miss for ${supabaseId}, querying database...`);

    // --- Parallel database queries ----------------------------------------------------
    // Run all queries in parallel for maximum performance
    const queries = {
      // Token balances
      tokenBalance: pool.query(
        `SELECT
          COALESCE(creator_token_balance, 0)::bigint AS creator_balance,
          COALESCE(token_balance, 0)::bigint AS fan_balance
         FROM users WHERE id = $1`,
        [dbUserId]
      ),

      // Earnings aggregates
      earnings: pool.query(
        `SELECT
          COALESCE(SUM(amount_cents), 0)::bigint AS total_cents,
          COUNT(*)::int AS count
         FROM creator_earnings
         WHERE creator_id = $1 ${timeFilter.sql}`,
        [dbUserId, ...timeFilter.params]
      ),

      // Payouts
      payouts: pool.query(
        `SELECT
          COALESCE(SUM(amount_cents), 0)::bigint AS total_cents,
          COUNT(*)::int AS count,
          COUNT(CASE WHEN status = 'pending' THEN 1 END)::int AS pending_count,
          COUNT(CASE WHEN status = 'completed' THEN 1 END)::int AS completed_count
         FROM creator_payouts
         WHERE creator_id = $1 ${timeFilter.sql}`,
        [dbUserId, ...timeFilter.params]
      ),

      // Tips received
      tips: pool.query(
        `SELECT
          COALESCE(SUM(amount_cents), 0)::bigint AS total_cents,
          COUNT(*)::int AS count
         FROM tips
         WHERE creator_id = $1 ${timeFilter.sql}`,
        [dbUserId, ...timeFilter.params]
      ),

      // Payments (purchases from fans)
      payments: pool.query(
        `SELECT
          COALESCE(SUM(amount_cents), 0)::bigint AS total_cents,
          COUNT(*)::int AS count
         FROM payments
         WHERE creator_id = $1 ${timeFilter.sql}`,
        [dbUserId, ...timeFilter.params]
      ),

      // Direct messages
      messages: pool.query(
        `SELECT
          COUNT(*)::int AS sent,
          COUNT(CASE WHEN sender_id = $1 THEN 1 END)::int AS sent_by_me,
          COUNT(CASE WHEN recipient_id = $1 THEN 1 END)::int AS received_by_me
         FROM messages
         WHERE (sender_id = $1 OR recipient_id = $1) ${timeFilter.sql}`,
        [dbUserId, ...timeFilter.params]
      ),

      // Chat messages (in streams)
      chatMessages: pool.query(
        `SELECT COUNT(*)::int AS count
         FROM chat_messages
         WHERE creator_id = $1 ${timeFilter.sql}`,
        [dbUserId, ...timeFilter.params]
      ),

      // PPV (pay-per-view) messages
      ppvMessages: pool.query(
        `SELECT
          COUNT(*)::int AS count,
          COALESCE(SUM(price_cents), 0)::bigint AS total_cents
         FROM ppv_messages
         WHERE creator_id = $1 ${timeFilter.sql}`,
        [dbUserId, ...timeFilter.params]
      ),

      // Video/Voice call sessions
      sessions: pool.query(
        `SELECT
          COUNT(*)::int AS total,
          COALESCE(SUM(duration_seconds), 0)::bigint AS total_seconds,
          COALESCE(SUM(earnings_cents), 0)::bigint AS earnings_cents
         FROM sessions
         WHERE creator_id = $1 ${timeFilter.sql}`,
        [dbUserId, ...timeFilter.params]
      ),

      // Live streaming sessions
      streamSessions: pool.query(
        `SELECT
          COUNT(*)::int AS total,
          COALESCE(SUM(viewer_count), 0)::bigint AS total_viewers,
          COALESCE(SUM(revenue_cents), 0)::bigint AS revenue_cents
         FROM stream_sessions
         WHERE creator_id = $1 ${timeFilter.sql}`,
        [dbUserId, ...timeFilter.params]
      ),

      // Active streams (live now)
      streamsLive: pool.query(
        `SELECT COUNT(*)::int AS count
         FROM streams
         WHERE creator_id = $1 AND status = 'live'`,
        [dbUserId]
      ),

      // Upcoming scheduled streams
      streamsUpcoming: pool.query(
        `SELECT COUNT(*)::int AS count
         FROM streams
         WHERE creator_id = $1 AND status = 'scheduled'`,
        [dbUserId]
      ),

      // Ended streams (replays)
      streamsEnded: pool.query(
        `SELECT COUNT(*)::int AS count
         FROM streams
         WHERE creator_id = $1 AND status = 'ended' ${buildTimeFilter('ended_at').sql}`,
        [dbUserId, ...buildTimeFilter('ended_at').params]
      ),

      // Followers
      followers: pool.query(
        `SELECT COUNT(*)::int AS count
         FROM followers
         WHERE creator_id = $1`,
        [dbUserId]
      ),

      // Active subscribers
      subscribers: pool.query(
        `SELECT
          COUNT(*)::int AS count,
          COUNT(CASE WHEN status = 'active' THEN 1 END)::int AS active_count
         FROM creator_subscriptions
         WHERE creator_id = $1`,
        [dbUserId]
      ),

      // Content uploads
      contentUploads: pool.query(
        `SELECT COUNT(*)::int AS count
         FROM creator_content
         WHERE creator_id = $1 ${timeFilter.sql}`,
        [dbUserId, ...timeFilter.params]
      ),

      // Content sales
      contentSales: pool.query(
        `SELECT
          COUNT(*)::int AS count,
          COALESCE(SUM(amount_cents), 0)::bigint AS total_cents
         FROM content_purchases cp
         JOIN creator_content cc ON cp.content_id = cc.id
         WHERE cc.creator_id = $1 ${buildTimeFilter('cp.created_at').sql}`,
        [dbUserId, ...buildTimeFilter('cp.created_at').params]
      ),

      // Analytics (views, clicks, impressions)
      analytics: pool.query(
        `SELECT
          COALESCE(SUM(views), 0)::bigint AS views,
          COALESCE(SUM(clicks), 0)::bigint AS clicks,
          COALESCE(SUM(impressions), 0)::bigint AS impressions
         FROM creator_analytics
         WHERE creator_id = $1 ${timeFilter.sql}`,
        [dbUserId, ...timeFilter.params]
      ),
    };

    // Execute all queries in parallel
    const results = await Promise.all(Object.values(queries));

    // Destructure results in same order as queries object
    const [
      tokenBalance, earnings, payouts, tips, payments,
      messages, chatMessages, ppvMessages,
      sessions, streamSessions, streamsLive, streamsUpcoming, streamsEnded,
      followers, subscribers, contentUploads, contentSales, analytics
    ] = results;

    // Build response object
    const response = {
      success: true,
      meta: {
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null,
        generatedAt: new Date().toISOString(),
        cached: false
      },
      profile: sanitizeUserForResponse(me),
      pricing: {
        video_rate_cents: Number(me.video_rate_cents || 0),
        voice_rate_cents: Number(me.voice_rate_cents || 0),
        stream_rate_cents: Number(me.stream_rate_cents || 0),
        message_price_cents: Number(me.message_price_cents || 0),
      },
      balances: {
        creator_tokens: Number(tokenBalance.rows[0]?.creator_balance || 0),
        fan_tokens: Number(tokenBalance.rows[0]?.fan_balance || 0),
      },
      earnings: {
        total_cents: Number(earnings.rows[0]?.total_cents || 0),
        count: Number(earnings.rows[0]?.count || 0),
      },
      payouts: {
        total_cents: Number(payouts.rows[0]?.total_cents || 0),
        count: Number(payouts.rows[0]?.count || 0),
        pending_count: Number(payouts.rows[0]?.pending_count || 0),
        completed_count: Number(payouts.rows[0]?.completed_count || 0),
      },
      tips: {
        total_cents: Number(tips.rows[0]?.total_cents || 0),
        count: Number(tips.rows[0]?.count || 0),
      },
      payments: {
        total_cents: Number(payments.rows[0]?.total_cents || 0),
        count: Number(payments.rows[0]?.count || 0),
      },
      messaging: {
        direct_messages: Number(messages.rows[0]?.sent || 0),
        chat_messages: Number(chatMessages.rows[0]?.count || 0),
        ppv_messages: {
          count: Number(ppvMessages.rows[0]?.count || 0),
          total_cents: Number(ppvMessages.rows[0]?.total_cents || 0),
        },
      },
      sessions: {
        total: Number(sessions.rows[0]?.total || 0),
        total_seconds: Number(sessions.rows[0]?.total_seconds || 0),
        earnings_cents: Number(sessions.rows[0]?.earnings_cents || 0),
      },
      streams: {
        live_count: Number(streamsLive.rows[0]?.count || 0),
        upcoming_count: Number(streamsUpcoming.rows[0]?.count || 0),
        ended_count: Number(streamsEnded.rows[0]?.count || 0),
        total_sessions: Number(streamSessions.rows[0]?.total || 0),
        total_viewers: Number(streamSessions.rows[0]?.total_viewers || 0),
        revenue_cents: Number(streamSessions.rows[0]?.revenue_cents || 0),
      },
      relationships: {
        followers: Number(followers.rows[0]?.count || 0),
        subscribers: Number(subscribers.rows[0]?.count || 0),
        active_subscribers: Number(subscribers.rows[0]?.active_count || 0),
      },
      content: {
        uploads: Number(contentUploads.rows[0]?.count || 0),
        sales_count: Number(contentSales.rows[0]?.count || 0),
        sales_cents: Number(contentSales.rows[0]?.total_cents || 0),
      },
      analytics: {
        views: Number(analytics.rows[0]?.views || 0),
        clicks: Number(analytics.rows[0]?.clicks || 0),
        impressions: Number(analytics.rows[0]?.impressions || 0),
      },
    };

    // Cache for 60 seconds (tune as needed based on traffic)
    if (useCache) {
      try {
        await cache.set(cacheKey, JSON.stringify(response), 60);
        console.log(`[Creator Overview] Cached for ${supabaseId}`);
      } catch (cacheError) {
        console.warn('[Creator Overview] Failed to cache:', cacheError.message);
        // Non-fatal - continue without caching
      }
    }

    res.json(response);
  } catch (error) {
    console.error('[Creator Overview] Error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch creator overview',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
});

module.exports = router;
