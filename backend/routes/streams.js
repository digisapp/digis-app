const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const { idempotency } = require('../middleware/idempotency');
const { v4: uuidv4 } = require('uuid');

// Check access for private stream
router.get('/streams/:streamId/access', authenticateToken, async (req, res) => {
  try {
    const { streamId } = req.params;
    const userId = req.user.supabase_id;

    // Check if stream is public or private
    const streamResult = await pool.query(
      'SELECT type FROM streams WHERE id = $1',
      [streamId]
    );

    if (streamResult.rows.length === 0) {
      return res.status(404).json({ error: 'STREAM_NOT_FOUND', hasAccess: false });
    }

    const stream = streamResult.rows[0];

    // Public streams are always accessible
    if (stream.type === 'public') {
      return res.json({ hasAccess: true, reason: 'public_stream' });
    }

    // Check if user has purchased a ticket
    const ticketResult = await pool.query(
      'SELECT id FROM stream_tickets WHERE stream_id = $1 AND user_id = $2',
      [streamId, userId]
    );

    const hasAccess = ticketResult.rows.length > 0;

    res.json({
      hasAccess,
      reason: hasAccess ? 'ticket_purchased' : 'no_ticket'
    });

  } catch (error) {
    console.error('Error checking stream access:', error);
    res.status(500).json({ error: 'ACCESS_CHECK_FAILED', hasAccess: false });
  }
});

// Buy a ticket with tokens (tokens-only)
router.post('/streams/:streamId/tickets/checkout',
  authenticateToken,
  idempotency({ prefix: 'ticket', ttlSec: 24 * 60 * 60 }),
  async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { streamId } = req.params;
    const userId = req.user.supabase_id;
    let { priceTokens } = req.body;

    // Get stream details
    const streamResult = await client.query(
      'SELECT * FROM streams WHERE id = $1',
      [streamId]
    );

    if (streamResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'STREAM_NOT_FOUND' });
    }

    const stream = streamResult.rows[0];

    // Use stream's ticket price if not provided
    if (!priceTokens) {
      priceTokens = stream.ticket_price_tokens;
    }

    if (!priceTokens || priceTokens <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'INVALID_PRICE' });
    }

    // Check if already purchased
    const existingTicket = await client.query(
      'SELECT id FROM stream_tickets WHERE stream_id = $1 AND user_id = $2',
      [streamId, userId]
    );

    if (existingTicket.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'TICKET_ALREADY_PURCHASED', ticketId: existingTicket.rows[0].id });
    }

    // Check user's token balance
    const walletResult = await client.query(
      'SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE',
      [userId]
    );

    if (walletResult.rows.length === 0) {
      // Create wallet if it doesn't exist
      await client.query(
        'INSERT INTO wallets (user_id, balance) VALUES ($1, 0)',
        [userId]
      );
    }

    const balance = walletResult.rows[0]?.balance || 0;

    if (balance < priceTokens) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'INSUFFICIENT_TOKENS',
        required: priceTokens,
        current: balance,
        shortfall: priceTokens - balance
      });
    }

    // Deduct tokens from user
    await client.query(
      'UPDATE wallets SET balance = balance - $1, lifetime_spent = lifetime_spent + $1 WHERE user_id = $2',
      [priceTokens, userId]
    );

    // Creator gets 100% (Digis margin comes from token sales, not spending)
    const creatorCut = priceTokens;
    const platformFee = 0;

    await client.query(
      'UPDATE wallets SET balance = balance + $1, lifetime_earned = lifetime_earned + $1 WHERE user_id = $2',
      [creatorCut, stream.creator_id]
    );

    // Create ticket record
    const ticketResult = await client.query(
      `INSERT INTO stream_tickets (stream_id, user_id, price_tokens)
       VALUES ($1, $2, $3) RETURNING id`,
      [streamId, userId, priceTokens]
    );

    const ticketId = ticketResult.rows[0].id;

    // Record billing events
    await client.query(
      `INSERT INTO billing_events (subject_type, subject_id, user_id, delta_tokens, reason, metadata)
       VALUES ('ticket', $1, $2, $3, 'ticket', $4)`,
      [ticketId, userId, -priceTokens, JSON.stringify({ stream_id: streamId, creator_id: stream.creator_id })]
    );

    await client.query(
      `INSERT INTO billing_events (subject_type, subject_id, user_id, delta_tokens, reason, metadata)
       VALUES ('ticket', $1, $2, $3, 'payout', $4)`,
      [ticketId, stream.creator_id, creatorCut, JSON.stringify({ stream_id: streamId, platform_fee: 0, fan_id: userId })]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      ticketId,
      priceTokens,
      newBalance: balance - priceTokens
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error purchasing ticket:', error);
    res.status(500).json({ error: 'CHECKOUT_FAILED', message: error.message });
  } finally {
    client.release();
  }
});

// Create a new stream
router.post('/streams/create', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id;
    const { type = 'public', title, description, category, ticketPrice = 0 } = req.body;

    // Verify user is a creator
    const creatorCheck = await pool.query(
      'SELECT is_creator FROM users WHERE supabase_id = $1',
      [creatorId]
    );

    if (creatorCheck.rows.length === 0 || !creatorCheck.rows[0].is_creator) {
      return res.status(403).json({ error: 'ONLY_CREATORS_CAN_STREAM' });
    }

    // Generate unique channel
    const channel = `stream_${crypto.randomBytes(9).toString('base64url')}`;

    // Create stream
    const result = await pool.query(
      `INSERT INTO streams (
        creator_id, type, channel, title, description, category, ticket_price_tokens, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled') RETURNING *`,
      [creatorId, type, channel, title, description, category, type === 'private' ? ticketPrice : 0]
    );

    res.json({
      success: true,
      stream: result.rows[0]
    });

  } catch (error) {
    console.error('Error creating stream:', error);
    res.status(500).json({ error: 'CREATE_STREAM_FAILED', message: error.message });
  }
});

// Start a stream (update status to live)
router.post('/streams/:streamId/start', authenticateToken, async (req, res) => {
  try {
    const { streamId } = req.params;
    const userId = req.user.supabase_id;

    // Verify ownership
    const streamCheck = await pool.query(
      'SELECT creator_id FROM streams WHERE id = $1',
      [streamId]
    );

    if (streamCheck.rows.length === 0) {
      return res.status(404).json({ error: 'STREAM_NOT_FOUND' });
    }

    if (streamCheck.rows[0].creator_id !== userId) {
      return res.status(403).json({ error: 'UNAUTHORIZED' });
    }

    // Update status to live
    const result = await pool.query(
      `UPDATE streams SET status = 'live', started_at = NOW() WHERE id = $1 RETURNING *`,
      [streamId]
    );

    res.json({
      success: true,
      stream: result.rows[0]
    });

  } catch (error) {
    console.error('Error starting stream:', error);
    res.status(500).json({ error: 'START_STREAM_FAILED', message: error.message });
  }
});

// End a stream
router.post('/streams/:streamId/end', authenticateToken, async (req, res) => {
  try {
    const { streamId } = req.params;
    const userId = req.user.supabase_id;

    // Verify ownership
    const streamCheck = await pool.query(
      'SELECT creator_id FROM streams WHERE id = $1',
      [streamId]
    );

    if (streamCheck.rows.length === 0) {
      return res.status(404).json({ error: 'STREAM_NOT_FOUND' });
    }

    if (streamCheck.rows[0].creator_id !== userId) {
      return res.status(403).json({ error: 'UNAUTHORIZED' });
    }

    // Update status to ended
    const result = await pool.query(
      `UPDATE streams SET status = 'ended', ended_at = NOW() WHERE id = $1 RETURNING *`,
      [streamId]
    );

    res.json({
      success: true,
      stream: result.rows[0]
    });

  } catch (error) {
    console.error('Error ending stream:', error);
    res.status(500).json({ error: 'END_STREAM_FAILED', message: error.message });
  }
});

// Get stream details
router.get('/streams/:streamId', async (req, res) => {
  try {
    const { streamId } = req.params;

    const result = await pool.query(
      `SELECT
        s.*,
        u.username as creator_username,
        u.display_name as creator_display_name,
        u.profile_pic_url as creator_profile_pic,
        (SELECT COUNT(*) FROM stream_tickets WHERE stream_id = s.id) as tickets_sold
       FROM streams s
       JOIN users u ON s.creator_id = u.supabase_id
       WHERE s.id = $1`,
      [streamId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'STREAM_NOT_FOUND' });
    }

    res.json({
      success: true,
      stream: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching stream:', error);
    res.status(500).json({ error: 'FETCH_STREAM_FAILED', message: error.message });
  }
});

// Get creator's streams
router.get('/creators/:creatorId/streams', async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { status, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT
        s.*,
        u.username as creator_username,
        u.display_name as creator_display_name,
        u.profile_pic_url as creator_profile_pic,
        (SELECT COUNT(*) FROM stream_tickets WHERE stream_id = s.id) as tickets_sold
      FROM streams s
      JOIN users u ON s.creator_id = u.supabase_id
      WHERE s.creator_id = $1
    `;

    const params = [creatorId];
    let paramCount = 2;

    if (status) {
      query += ` AND s.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    query += ` ORDER BY s.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    res.json({
      success: true,
      streams: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Error fetching creator streams:', error);
    res.status(500).json({ error: 'FETCH_STREAMS_FAILED', message: error.message });
  }
});

module.exports = router;
