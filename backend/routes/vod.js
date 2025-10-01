const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../utils/db');
const { getUserId } = require('../utils/auth-helpers');
const { getNumericConfig, CONFIG_KEYS } = require('../utils/config');
const crypto = require('crypto');

// Get VOD (replay) details with pricing and access info
router.get('/recording/:recordingId', authenticateToken, async (req, res) => {
  try {
    const { recordingId } = req.params;
    const userId = getUserId(req);

    // Get recording details
    const recordingQuery = `
      SELECT 
        sr.*,
        s.title as stream_title,
        s.description as stream_description,
        s.thumbnail_url,
        u.display_name as creator_name,
        u.username as creator_username,
        u.profile_pic_url as creator_avatar,
        (
          SELECT COUNT(*) 
          FROM vod_purchases 
          WHERE recording_id = sr.id
        ) as total_purchases,
        sr.view_count
      FROM stream_recordings sr
      JOIN streams s ON sr.stream_id = s.id
      JOIN users u ON sr.creator_id = u.supabase_id
      WHERE sr.id = $1
    `;

    const recordingResult = await pool.query(recordingQuery, [recordingId]);
    
    if (recordingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    const recording = recordingResult.rows[0];

    // Check user's access to this VOD
    const accessQuery = `SELECT * FROM check_vod_access($1, $2)`;
    const accessResult = await pool.query(accessQuery, [userId, recordingId]);
    const access = accessResult.rows[0];

    res.json({
      recording: {
        ...recording,
        price_in_tokens: recording.price_in_tokens || 50
      },
      access: {
        has_access: access.has_access,
        is_purchased: access.is_purchased,
        is_expired: access.is_expired,
        expires_at: access.expires_at
      }
    });

  } catch (error) {
    console.error('Error fetching VOD details:', error);
    res.status(500).json({ error: 'Failed to fetch VOD details' });
  }
});

// Purchase VOD access
router.post('/purchase/:recordingId', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const { recordingId } = req.params;
    const userId = getUserId(req);
    const idempotencyKey = req.headers['x-idempotency-key'] || crypto.randomUUID();

    await client.query('BEGIN');

    // Get recording details and check if already purchased
    const checkQuery = `
      SELECT 
        sr.id,
        sr.price_in_tokens,
        sr.is_free,
        sr.creator_id,
        vp.id as purchase_id,
        vp.expires_at,
        vp.expires_at > NOW() as is_valid
      FROM stream_recordings sr
      LEFT JOIN vod_purchases vp ON vp.recording_id = sr.id AND vp.user_id = $2
      WHERE sr.id = $1
    `;

    const checkResult = await client.query(checkQuery, [recordingId, userId]);
    
    if (checkResult.rows.length === 0) {
      throw new Error('Recording not found');
    }

    const recording = checkResult.rows[0];

    // Check if VOD is free
    if (recording.is_free) {
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: 'This VOD is free to watch',
        access: {
          has_access: true,
          is_free: true
        }
      });
    }

    // Check if already has valid access
    if (recording.purchase_id && recording.is_valid) {
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: 'You already have access to this VOD',
        access: {
          has_access: true,
          expires_at: recording.expires_at
        }
      });
    }

    // Get VOD price from recording or use default from config
    const defaultPrice = await getNumericConfig(CONFIG_KEYS.VOD_DEFAULT_PRICE, 50);
    const vodPrice = recording.price_in_tokens || defaultPrice;

    // Check user's token balance
    const balanceQuery = 'SELECT balance FROM token_balances WHERE user_id = $1 FOR UPDATE';
    const balanceResult = await client.query(balanceQuery, [userId]);
    
    if (!balanceResult.rows[0]) {
      throw new Error('Token balance not found');
    }

    const tokenBalance = parseFloat(balanceResult.rows[0].balance) || 0;
    
    if (tokenBalance < vodPrice) {
      throw new Error(`Insufficient tokens. You need ${vodPrice} tokens but only have ${tokenBalance}`);
    }

    // Deduct tokens
    await client.query(
      'UPDATE token_balances SET balance = balance - $1 WHERE user_id = $2',
      [vodPrice, userId]
    );

    // Get expiry hours from config
    const expiryHours = await getNumericConfig(CONFIG_KEYS.VOD_PURCHASE_EXPIRY_HOURS, 48);

    // Create VOD purchase with idempotency protection
    const purchaseQuery = `
      INSERT INTO vod_purchases (user_id, recording_id, tokens_paid, expires_at, idempotency_key)
      VALUES ($1, $2, $3, NOW() + INTERVAL '${expiryHours} hours', $4)
      ON CONFLICT (user_id, recording_id)
      DO UPDATE SET
        tokens_paid = EXCLUDED.tokens_paid,
        purchased_at = NOW(),
        expires_at = NOW() + INTERVAL '${expiryHours} hours',
        watch_count = 0,
        updated_at = NOW()
      WHERE vod_purchases.idempotency_key != $4  -- Only update if different idempotency key
      RETURNING *
    `;

    const purchaseResult = await client.query(purchaseQuery, [userId, recordingId, vodPrice, idempotencyKey]);
    const purchase = purchaseResult.rows[0];

    // Record token transaction
    await client.query(
      `INSERT INTO token_transactions 
       (user_id, type, amount, description, balance_after)
       VALUES ($1, 'vod_purchase', $2, $3, $4)`,
      [userId, -vodPrice, `VOD purchase: ${recordingId}`, tokenBalance - vodPrice]
    );

    // Update creator earnings (creator gets 100% of VOD revenue)
    // Digis makes money on the token purchase margin, not on creator earnings
    const creatorShare = vodPrice; // 100% to creator
    await client.query(
      `UPDATE creator_earnings 
       SET vod_earnings = COALESCE(vod_earnings, 0) + $1,
           total_earnings = COALESCE(total_earnings, 0) + $1,
           updated_at = NOW()
       WHERE creator_id = $2`,
      [creatorShare, recording.creator_id]
    );

    // Add to creator's token balance (100% of the tokens)
    await client.query(
      `UPDATE token_balances 
       SET balance = balance + $1 
       WHERE user_id = $2`,
      [creatorShare, recording.creator_id]
    );

    // Increment purchase count on recording
    await client.query(
      'UPDATE stream_recordings SET view_count = COALESCE(view_count, 0) + 1 WHERE id = $1',
      [recordingId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'VOD access purchased successfully',
      purchase: {
        id: purchase.id,
        expires_at: purchase.expires_at,
        tokens_paid: vodPrice
      },
      access: {
        has_access: true,
        expires_at: purchase.expires_at
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error purchasing VOD:', error);
    res.status(400).json({ 
      error: error.message || 'Failed to purchase VOD access' 
    });
  } finally {
    client.release();
  }
});

// Get user's VOD purchases
router.get('/my-purchases', authenticateToken, async (req, res) => {
  try {
    const userId = getUserId(req);

    const query = `
      SELECT 
        vp.*,
        sr.duration_seconds,
        sr.thumbnail_url as recording_thumbnail,
        s.title as stream_title,
        s.description as stream_description,
        s.thumbnail_url as stream_thumbnail,
        u.display_name as creator_name,
        u.username as creator_username,
        u.profile_pic_url as creator_avatar,
        vp.expires_at > NOW() as is_valid
      FROM vod_purchases vp
      JOIN stream_recordings sr ON vp.recording_id = sr.id
      JOIN streams s ON sr.stream_id = s.id
      JOIN users u ON sr.creator_id = u.supabase_id
      WHERE vp.user_id = $1
      ORDER BY vp.purchased_at DESC
    `;

    const result = await pool.query(query, [userId]);

    res.json({
      purchases: result.rows.map(purchase => ({
        ...purchase,
        has_access: purchase.is_valid,
        days_remaining: purchase.is_valid 
          ? Math.ceil((new Date(purchase.expires_at) - new Date()) / (1000 * 60 * 60 * 24))
          : 0
      }))
    });

  } catch (error) {
    console.error('Error fetching VOD purchases:', error);
    res.status(500).json({ error: 'Failed to fetch VOD purchases' });
  }
});

// Update watch count when user watches VOD
router.post('/watch/:recordingId', authenticateToken, async (req, res) => {
  try {
    const { recordingId } = req.params;
    const userId = getUserId(req);

    // Check access first
    const accessQuery = `SELECT * FROM check_vod_access($1, $2)`;
    const accessResult = await pool.query(accessQuery, [userId, recordingId]);
    const access = accessResult.rows[0];

    if (!access.has_access) {
      return res.status(403).json({ 
        error: 'No access to this VOD',
        access: access
      });
    }

    // Update watch count and last watched time
    await pool.query(
      `UPDATE vod_purchases 
       SET watch_count = watch_count + 1,
           last_watched_at = NOW()
       WHERE user_id = $1 AND recording_id = $2`,
      [userId, recordingId]
    );

    res.json({ success: true });

  } catch (error) {
    console.error('Error updating watch count:', error);
    res.status(500).json({ error: 'Failed to update watch count' });
  }
});

module.exports = router;