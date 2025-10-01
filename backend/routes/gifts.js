const express = require('express');
const { pool } = require('../utils/db');
const { authenticateToken, requireCreator } = require('../middleware/auth');
// const { v4: uuidv4 } = require('uuid'); // TODO: Use when implementing gift IDs
const router = express.Router();

// Get all available gifts
router.get('/catalog', authenticateToken, async (req, res) => {
  try {
    const { category, rarity } = req.query;
    
    let query = `
      SELECT 
        gift_id,
        name,
        description,
        icon_url,
        animation_url,
        token_cost,
        category,
        rarity
      FROM virtual_gifts
      WHERE is_active = true
    `;
    
    const params = [];
    
    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    
    if (rarity) {
      params.push(rarity);
      query += ` AND rarity = $${params.length}`;
    }
    
    query += ' ORDER BY token_cost ASC';
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      gifts: result.rows
    });
    
  } catch (error) {
    console.error('Get gift catalog error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch gift catalog'
    });
  }
});

// Send a gift to a creator
router.post('/send', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { 
      creatorId, 
      giftId, 
      quantity = 1, 
      message = '', 
      streamId = null,
      sessionId = null,
      isAnonymous = false 
    } = req.body;
    
    const userId = req.user.supabase_id;
    
    // Validate input
    if (!creatorId || !giftId || quantity < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid gift parameters'
      });
    }
    
    // Get fan's database ID
    const fanResult = await client.query(
      'SELECT id FROM users WHERE supabase_id = $1',
      [userId]
    );
    
    if (fanResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    const fanId = fanResult.rows[0].id;
    
    // Call the stored procedure to process the gift
    const result = await client.query(
      'SELECT * FROM process_gift_send($1, $2, $3, $4, $5, $6, $7, $8)',
      [fanId, creatorId, giftId, quantity, message, streamId, sessionId, isAnonymous]
    );
    
    const { success, sent_id, new_balance, error_message } = result.rows[0];
    
    if (!success) {
      return res.status(400).json({
        success: false,
        error: error_message,
        current_balance: new_balance
      });
    }
    
    // Get gift details for response
    const giftResult = await client.query(
      `SELECT 
        gs.*,
        vg.name as gift_name,
        vg.icon_url,
        vg.animation_url,
        vg.rarity,
        u.username as creator_username,
        u.display_name as creator_display_name
       FROM gifts_sent gs
       JOIN virtual_gifts vg ON gs.gift_id = vg.gift_id
       JOIN users u ON gs.creator_id = u.id
       WHERE gs.sent_id = $1`,
      [sent_id]
    );
    
    res.json({
      success: true,
      gift: giftResult.rows[0],
      new_balance
    });
    
  } catch (error) {
    console.error('Send gift error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send gift'
    });
  } finally {
    client.release();
  }
});

// Get gifts sent by user
router.get('/sent', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { limit = 50, offset = 0 } = req.query;
    
    // Get user's database ID
    const userResult = await pool.query(
      'SELECT id FROM users WHERE supabase_id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    const fanId = userResult.rows[0].id;
    
    const result = await pool.query(
      `SELECT 
        gs.*,
        vg.name as gift_name,
        vg.icon_url,
        vg.animation_url,
        vg.token_cost,
        vg.category,
        vg.rarity,
        u.username as creator_username,
        u.display_name as creator_display_name,
        u.profile_pic_url as creator_profile_pic
       FROM gifts_sent gs
       JOIN virtual_gifts vg ON gs.gift_id = vg.gift_id
       JOIN users u ON gs.creator_id = u.id
       WHERE gs.fan_id = $1
       ORDER BY gs.created_at DESC
       LIMIT $2 OFFSET $3`,
      [fanId, limit, offset]
    );
    
    res.json({
      success: true,
      gifts: result.rows,
      count: result.rows.length
    });
    
  } catch (error) {
    console.error('Get sent gifts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sent gifts'
    });
  }
});

// Get gifts received by creator
router.get('/received', authenticateToken, requireCreator, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { limit = 50, offset = 0, period = 'all' } = req.query;
    
    // Get creator's database ID
    const creatorResult = await pool.query(
      'SELECT id FROM users WHERE supabase_id = $1',
      [userId]
    );
    
    const creatorId = creatorResult.rows[0].id;
    
    // Build date filter
    let dateFilter = '';
    if (period === '24h') {
      dateFilter = "AND gs.created_at >= NOW() - INTERVAL '24 hours'";
    } else if (period === '7d') {
      dateFilter = "AND gs.created_at >= NOW() - INTERVAL '7 days'";
    } else if (period === '30d') {
      dateFilter = "AND gs.created_at >= NOW() - INTERVAL '30 days'";
    }
    
    const result = await pool.query(
      `SELECT 
        gs.*,
        vg.name as gift_name,
        vg.icon_url,
        vg.animation_url,
        vg.token_cost,
        vg.category,
        vg.rarity,
        CASE 
          WHEN gs.is_anonymous THEN NULL 
          ELSE u.username 
        END as fan_username,
        CASE 
          WHEN gs.is_anonymous THEN NULL 
          ELSE u.display_name 
        END as fan_display_name,
        CASE 
          WHEN gs.is_anonymous THEN NULL 
          ELSE u.profile_pic_url 
        END as fan_profile_pic
       FROM gifts_sent gs
       JOIN virtual_gifts vg ON gs.gift_id = vg.gift_id
       LEFT JOIN users u ON gs.fan_id = u.id
       WHERE gs.creator_id = $1 ${dateFilter}
       ORDER BY gs.created_at DESC
       LIMIT $2 OFFSET $3`,
      [creatorId, limit, offset]
    );
    
    // Get statistics
    const statsResult = await pool.query(
      `SELECT 
        COUNT(*) as total_gifts,
        SUM(amount) as total_amount,
        COUNT(DISTINCT CASE WHEN NOT is_anonymous THEN fan_id END) as unique_fans
       FROM gifts_sent
       WHERE creator_id = $1 ${dateFilter}`,
      [creatorId]
    );
    
    res.json({
      success: true,
      gifts: result.rows,
      count: result.rows.length,
      stats: statsResult.rows[0]
    });
    
  } catch (error) {
    console.error('Get received gifts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch received gifts'
    });
  }
});

// Get gift statistics for a creator
router.get('/stats/:creatorId', authenticateToken, async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { period = '30d' } = req.query;
    
    // Build date filter
    let dateFilter = "created_at >= NOW() - INTERVAL '30 days'";
    if (period === '7d') {
      dateFilter = "created_at >= NOW() - INTERVAL '7 days'";
    } else if (period === '24h') {
      dateFilter = "created_at >= NOW() - INTERVAL '24 hours'";
    } else if (period === 'all') {
      dateFilter = '1=1';
    }
    
    // Get overall statistics
    const statsResult = await pool.query(
      `SELECT 
        COUNT(*) as total_gifts_received,
        SUM(amount) as total_tokens_earned,
        AVG(amount) as average_gift_value,
        MAX(amount) as highest_gift_value,
        COUNT(DISTINCT fan_id) as unique_gifters,
        COUNT(DISTINCT gift_id) as unique_gift_types
       FROM gifts_sent
       WHERE creator_id = $1 AND ${dateFilter}`,
      [creatorId]
    );
    
    // Get most popular gifts
    const popularGiftsResult = await pool.query(
      `SELECT 
        vg.gift_id,
        vg.name,
        vg.icon_url,
        vg.token_cost,
        vg.rarity,
        COUNT(*) as times_received,
        SUM(gs.quantity) as total_quantity,
        SUM(gs.amount) as total_value
       FROM gifts_sent gs
       JOIN virtual_gifts vg ON gs.gift_id = vg.gift_id
       WHERE gs.creator_id = $1 AND gs.${dateFilter}
       GROUP BY vg.gift_id, vg.name, vg.icon_url, vg.token_cost, vg.rarity
       ORDER BY times_received DESC
       LIMIT 10`,
      [creatorId]
    );
    
    // Get top gifters (non-anonymous only)
    const topGiftersResult = await pool.query(
      `SELECT 
        u.username,
        u.display_name,
        u.profile_pic_url,
        COUNT(*) as gift_count,
        SUM(gs.amount) as total_spent
       FROM gifts_sent gs
       JOIN users u ON gs.fan_id = u.id
       WHERE gs.creator_id = $1 
         AND gs.${dateFilter}
         AND gs.is_anonymous = false
       GROUP BY u.id, u.username, u.display_name, u.profile_pic_url
       ORDER BY total_spent DESC
       LIMIT 10`,
      [creatorId]
    );
    
    res.json({
      success: true,
      stats: statsResult.rows[0],
      popular_gifts: popularGiftsResult.rows,
      top_gifters: topGiftersResult.rows,
      period
    });
    
  } catch (error) {
    console.error('Get gift stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch gift statistics'
    });
  }
});

// Get/Update creator gift settings
router.get('/settings', authenticateToken, requireCreator, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    
    // Get creator's database ID
    const creatorResult = await pool.query(
      'SELECT id FROM users WHERE supabase_id = $1',
      [userId]
    );
    
    const creatorId = creatorResult.rows[0].id;
    
    // Get or create settings
    const result = await pool.query(
      `INSERT INTO creator_gift_settings (creator_id)
       VALUES ($1)
       ON CONFLICT (creator_id) DO UPDATE
       SET updated_at = NOW()
       RETURNING *`,
      [creatorId]
    );
    
    res.json({
      success: true,
      settings: result.rows[0]
    });
    
  } catch (error) {
    console.error('Get gift settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch gift settings'
    });
  }
});

router.put('/settings', authenticateToken, requireCreator, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const {
      giftsEnabled,
      minGiftAmount,
      giftMessageMaxLength,
      showGiftAlerts,
      alertMinAmount
    } = req.body;
    
    // Get creator's database ID
    const creatorResult = await pool.query(
      'SELECT id FROM users WHERE supabase_id = $1',
      [userId]
    );
    
    const creatorId = creatorResult.rows[0].id;
    
    // Update settings
    const result = await pool.query(
      `UPDATE creator_gift_settings
       SET 
         gifts_enabled = COALESCE($2, gifts_enabled),
         min_gift_amount = COALESCE($3, min_gift_amount),
         gift_message_max_length = COALESCE($4, gift_message_max_length),
         show_gift_alerts = COALESCE($5, show_gift_alerts),
         alert_min_amount = COALESCE($6, alert_min_amount),
         updated_at = NOW()
       WHERE creator_id = $1
       RETURNING *`,
      [
        creatorId,
        giftsEnabled,
        minGiftAmount,
        giftMessageMaxLength,
        showGiftAlerts,
        alertMinAmount
      ]
    );
    
    res.json({
      success: true,
      settings: result.rows[0]
    });
    
  } catch (error) {
    console.error('Update gift settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update gift settings'
    });
  }
});

module.exports = router;