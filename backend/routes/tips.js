const express = require('express');
const { pool } = require('../utils/db');
const { authenticateToken, requireTokens } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Send a tip to a creator (Pro Monetization)
router.post('/send', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const { toCreatorId, amountTokens, message = '', context = {} } = req.body;
    const fromUserId = req.user.supabase_id;
    const tipperId = fromUserId; // Keep compatibility
    const creatorId = toCreatorId || req.body.creatorId;
    const amount = amountTokens || req.body.amount;
    
    // Validate input
    if (!creatorId || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tip parameters'
      });
    }

    // Start transaction
    await client.query('BEGIN');

    // Get tipper info
    const tipperResult = await client.query(
      'SELECT id, username, display_name FROM users WHERE supabase_id = $1',
      [tipperId]
    );

    if (tipperResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Tipper not found'
      });
    }

    const tipperDbId = tipperResult.rows[0].id;
    const tipperInfo = tipperResult.rows[0];

    // Get creator info
    const creatorResult = await client.query(
      'SELECT id, supabase_id, username, display_name, is_creator FROM users WHERE supabase_id = $1',
      [creatorId]
    );

    if (creatorResult.rows.length === 0 || !creatorResult.rows[0].is_creator) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Creator not found or user is not a creator'
      });
    }

    const creatorInfo = creatorResult.rows[0];

    // Check tipper's balance (use standardized user_id column)
    const balanceResult = await client.query(
      'SELECT balance FROM token_balances WHERE user_id = $1',
      [tipperId]
    );

    const balance = balanceResult.rows[0]?.balance || 0;

    if (balance < amount) {
      await client.query('ROLLBACK');
      return res.status(402).json({
        success: false,
        error: 'Insufficient token balance',
        current_balance: balance,
        required_amount: amount
      });
    }

    // Generate tip ID
    const tipId = `tip_${Date.now()}_${uuidv4()}`;

    // Deduct from tipper's balance (use standardized user_id column)
    await client.query(
      'UPDATE token_balances SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2',
      [amount, tipperId]
    );

    // Add to creator's balance (use standardized user_id column)
    await client.query(
      'UPDATE token_balances SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2',
      [amount, creatorInfo.supabase_id]
    );

    // Record the tip (use standardized tipper_id column)
    const tipResult = await client.query(
      `INSERT INTO tips (tip_id, tipper_id, creator_id, amount, message, session_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [tipId, tipperId, creatorId, amount, message, sessionId]
    );

    // Record token transaction for tipper (use standardized user_id column)
    await client.query(
      `INSERT INTO token_transactions (
        transaction_id, user_id, type, amount, balance_after,
        description, reference_id, reference_type, created_at
      ) VALUES (
        $1, $2, 'tip_sent', $3, $4, $5, $6, 'tip', NOW()
      )`,
      [
        `txn_${Date.now()}_${uuidv4()}`,
        tipperId,
        -amount,
        balance - amount,
        `Tip sent to @${creatorInfo.username}`,
        tipId
      ]
    );

    // Record token transaction for creator (use standardized user_id column)
    const creatorBalanceResult = await client.query(
      'SELECT balance FROM token_balances WHERE user_id = $1',
      [creatorInfo.supabase_id]
    );
    const creatorNewBalance = creatorBalanceResult.rows[0]?.balance || amount;

    await client.query(
      `INSERT INTO token_transactions (
        transaction_id, user_id, type, amount, balance_after,
        description, reference_id, reference_type, created_at
      ) VALUES (
        $1, $2, 'tip_received', $3, $4, $5, $6, 'tip', NOW()
      )`,
      [
        `txn_${Date.now()}_${uuidv4()}`,
        creatorInfo.supabase_id,
        amount,
        creatorNewBalance,
        `Tip received from @${tipperInfo.username}`,
        tipId
      ]
    );

    // Create notification for creator
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, data, created_at, is_read)
       VALUES ($1, 'tip_received', $2, $3, $4, NOW(), false)`,
      [
        creatorId,
        'You received a tip!',
        `${tipperInfo.username} sent you ${amount} tokens${message ? ': "' + message + '"' : ''}`,
        JSON.stringify({
          tipId,
          tipperId: tipperDbId,
          tipperUsername: tipperInfo.username,
          amount,
          message
        })
      ]
    );

    // Record in tips table if it exists (Pro Monetization)
    try {
      await client.query(
        `INSERT INTO tips (from_user_id, to_creator_id, amount_tokens, message, context_type, context_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [fromUserId, creatorInfo.supabase_id, amount, message, context.type || null, context.id || null]
      );
    } catch (e) {
      // Table might not exist yet, continue
      console.log('Tips table not available yet:', e.message);
    }

    // Update stream stats if applicable
    if (context.streamId) {
      try {
        await client.query(
          'UPDATE streams SET total_tips = total_tips + $1 WHERE id = $2',
          [amount, context.streamId]
        );
      } catch (e) {
        console.log('Streams table not available yet:', e.message);
      }
    }

    await client.query('COMMIT');

    // Broadcast tip event via Ably for live overlay (Pro Monetization)
    try {
      const Ably = require('ably');
      const ablyApiKey = process.env.ABLY_API_KEY;

      if (ablyApiKey && context.channel) {
        const ablyClient = new Ably.Rest(ablyApiKey);
        const channel = ablyClient.channels.get(`stream:${context.channel}`);

        await channel.publish('tip:new', {
          tipId,
          amountTokens: amount,
          fromUsername: tipperInfo.username,
          fromUserId,
          toCreatorId: creatorInfo.supabase_id,
          message: message || null,
          timestamp: new Date().toISOString(),
          ...context
        });

        console.log(`Tip broadcasted via Ably to stream:${context.channel}`);
      }
    } catch (ablyError) {
      console.error('Ably broadcast error:', ablyError);
      // Don't fail the request if Ably fails
    }

    res.json({
      success: true,
      tip: tipResult.rows[0],
      new_balance: balance - amount,
      tipId,
      amountTokens: amount,
      creatorCut: amount,     // 100% to creator
      platformFee: 0          // Digis margin comes only from token sales
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Tip error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process tip'
    });
  } finally {
    client.release();
  }
});

// Get tips sent by user
router.get('/sent', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { limit = 50, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT 
        t.*,
        u.username as creator_username,
        u.display_name as creator_display_name,
        u.profile_pic_url as creator_profile_pic,
        s.session_type,
        s.duration_minutes as session_duration
       FROM tips t
       JOIN users u ON t.creator_id = u.id
       LEFT JOIN sessions s ON t.session_id = s.id
       WHERE t.supabase_tipper_id = $1
       ORDER BY t.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({
      success: true,
      tips: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Get sent tips error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sent tips'
    });
  }
});

// Get tips received by creator
router.get('/received', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    
    // Check if user is a creator
    const userResult = await pool.query(
      'SELECT id, is_creator FROM users WHERE supabase_id = $1',
      [userId]
    );

    if (!userResult.rows[0]?.is_creator) {
      return res.status(403).json({
        success: false,
        error: 'Only creators can view received tips'
      });
    }

    const creatorId = userResult.rows[0].id;
    const { limit = 50, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT 
        t.*,
        u.username as tipper_username,
        u.display_name as tipper_display_name,
        u.profile_pic_url as tipper_profile_pic,
        s.session_type,
        s.duration_minutes as session_duration
       FROM tips t
       JOIN users u ON t.supabase_tipper_id = u.supabase_id
       LEFT JOIN sessions s ON t.session_id = s.id
       WHERE t.creator_id = $1
       ORDER BY t.created_at DESC
       LIMIT $2 OFFSET $3`,
      [creatorId, limit, offset]
    );

    // Get total tips received
    const totalResult = await pool.query(
      'SELECT COUNT(*) as count, SUM(amount) as total FROM tips WHERE creator_id = $1',
      [creatorId]
    );

    res.json({
      success: true,
      tips: result.rows,
      count: result.rows.length,
      total_tips: totalResult.rows[0].count || 0,
      total_amount: totalResult.rows[0].total || 0
    });

  } catch (error) {
    console.error('Get received tips error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch received tips'
    });
  }
});

// Get tip statistics for a creator
router.get('/stats/:creatorId', authenticateToken, async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { period = '30d' } = req.query;

    // Calculate date range
    let dateFilter = "created_at >= NOW() - INTERVAL '30 days'";
    if (period === '7d') {
      dateFilter = "created_at >= NOW() - INTERVAL '7 days'";
    } else if (period === '24h') {
      dateFilter = "created_at >= NOW() - INTERVAL '24 hours'";
    } else if (period === 'all') {
      dateFilter = '1=1';
    }

    // Get tip statistics
    const statsResult = await pool.query(
      `SELECT 
        COUNT(*) as total_tips,
        SUM(amount) as total_amount,
        AVG(amount) as average_tip,
        MAX(amount) as largest_tip,
        COUNT(DISTINCT supabase_tipper_id) as unique_tippers
       FROM tips
       WHERE creator_id = $1 AND ${dateFilter}`,
      [creatorId]
    );

    // Get top tippers
    const topTippersResult = await pool.query(
      `SELECT 
        u.username,
        u.display_name,
        u.profile_pic_url,
        COUNT(*) as tip_count,
        SUM(t.amount) as total_amount
       FROM tips t
       JOIN users u ON t.supabase_tipper_id = u.supabase_id
       WHERE t.creator_id = $1 AND ${dateFilter}
       GROUP BY u.id, u.username, u.display_name, u.profile_pic_url
       ORDER BY total_amount DESC
       LIMIT 5`,
      [creatorId]
    );

    res.json({
      success: true,
      stats: statsResult.rows[0],
      top_tippers: topTippersResult.rows,
      period
    });

  } catch (error) {
    console.error('Get tip stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tip statistics'
    });
  }
});

module.exports = router;