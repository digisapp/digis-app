const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
// Supabase removed - using Supabase

// Get all offers for a creator (public endpoint for fans)
router.get('/creator/:creatorId', async (req, res) => {
  try {
    const { creatorId } = req.params;
    
    const query = `
      SELECT 
        o.*,
        u.username as creator_username,
        u.profile_pic_url as creator_profile_pic,
        COUNT(DISTINCT op.id) as total_purchases,
        COUNT(DISTINCT CASE WHEN op.status = 'completed' THEN op.id END) as completed_purchases
      FROM creator_offers o
      JOIN users u ON o.creator_id = u.id
      LEFT JOIN offer_purchases op ON o.id = op.offer_id
      WHERE o.creator_id = $1 AND o.active = true
      GROUP BY o.id, u.username, u.profile_pic_url
      ORDER BY o.display_order ASC, o.created_at DESC
    `;
    
    const result = await pool.query(query, [creatorId]);
    
    const offers = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      priceTokens: row.price_tokens,
      deliveryTime: row.delivery_time,
      maxQuantity: row.max_quantity,
      remainingQuantity: row.max_quantity ? row.max_quantity - row.completed_purchases : null,
      creatorUsername: row.creator_username,
      creatorProfilePic: row.creator_profile_pic,
      totalPurchases: row.total_purchases,
      completedPurchases: row.completed_purchases,
      createdAt: row.created_at
    }));
    
    res.json({
      success: true,
      offers: offers,
      totalOffers: offers.length
    });
    
  } catch (error) {
    console.error('Error fetching creator offers:', error);
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

// Get active offers for a creator (public endpoint)
router.get('/creator/:creatorId/active', async (req, res) => {
  try {
    const { creatorId } = req.params;
    
    const query = `
      SELECT 
        co.*,
        u.username,
        u.profile_pic_url,
        u.display_name
      FROM creator_offers co
      JOIN users u ON co.creator_id = u.supabase_id
      WHERE co.creator_id = $1 
        AND co.is_active = true
      ORDER BY co.created_at DESC
    `;
    
    const result = await pool.query(query, [creatorId]);
    
    res.json({
      success: true,
      offers: result.rows
    });
  } catch (error) {
    console.error('Error fetching active creator offers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active offers'
    });
  }
});

// Get my offers (for creators)
router.get('/my-offers', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id || req.user.id || req.user.uid;
    
    if (!userId) {
      return res.status(400).json({
        error: 'User ID not found',
        timestamp: new Date().toISOString()
      });
    }
    
    // Check if user is a creator
    const userQuery = 'SELECT id, supabase_id, is_creator FROM users WHERE supabase_id = $1 OR id::text = $2';
    const userResult = await pool.query(userQuery, [userId, userId]);
    
    if (userResult.rows.length === 0 || !userResult.rows[0].is_creator) {
      return res.status(403).json({ error: 'Only creators can manage offers' });
    }
    
    const creatorId = userResult.rows[0].id;
    
    const query = `
      SELECT 
        o.*,
        COUNT(DISTINCT op.id) as total_purchases,
        COUNT(DISTINCT CASE WHEN op.status = 'completed' THEN op.id END) as completed_purchases,
        SUM(CASE WHEN op.status = 'completed' THEN op.tokens_paid ELSE 0 END) as total_earnings
      FROM creator_offers o
      LEFT JOIN offer_purchases op ON o.id = op.offer_id
      WHERE o.creator_id = $1
      GROUP BY o.id
      ORDER BY o.display_order ASC, o.created_at DESC
    `;
    
    const result = await pool.query(query, [creatorId]);
    
    const offers = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      priceTokens: row.price_tokens,
      deliveryTime: row.delivery_time,
      maxQuantity: row.max_quantity,
      active: row.active,
      displayOrder: row.display_order,
      totalPurchases: parseInt(row.total_purchases) || 0,
      completedPurchases: parseInt(row.completed_purchases) || 0,
      totalEarnings: parseInt(row.total_earnings) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json({
      success: true,
      offers: offers
    });
    
  } catch (error) {
    console.error('Error fetching my offers:', error);
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

// Create a new offer (both routes for compatibility)
router.post('/', authenticateToken, createOffer);
router.post('/create', authenticateToken, createOffer);

async function createOffer(req, res) {
  try {
    const creatorId = req.user.id;
    const { title, description, category, priceTokens, deliveryTime, maxQuantity } = req.body;
    
    // Validate input
    if (!title || !priceTokens) {
      return res.status(400).json({ error: 'Title and price are required' });
    }
    
    if (priceTokens < 1 || priceTokens > 1000000) {
      return res.status(400).json({ error: 'Price must be between 1 and 1,000,000 tokens' });
    }
    
    // Check if user is a creator
    const userQuery = 'SELECT is_creator FROM users WHERE id = $1';
    const userResult = await pool.query(userQuery, [creatorId]);
    
    if (userResult.rows.length === 0 || !userResult.rows[0].is_creator) {
      return res.status(403).json({ error: 'Only creators can create offers' });
    }
    
    // Get current max display order
    const orderQuery = 'SELECT MAX(display_order) as max_order FROM creator_offers WHERE creator_id = $1';
    const orderResult = await pool.query(orderQuery, [creatorId]);
    const displayOrder = (orderResult.rows[0].max_order || 0) + 1;
    
    // Create offer
    const insertQuery = `
      INSERT INTO creator_offers (
        creator_id, title, description, category, 
        price_tokens, delivery_time, max_quantity, display_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const values = [
      creatorId,
      title.trim(),
      description ? description.trim() : null,
      category || 'General',
      priceTokens,
      deliveryTime || null,
      maxQuantity || null,
      displayOrder
    ];
    
    const result = await pool.query(insertQuery, values);
    const offer = result.rows[0];
    
    res.status(201).json({
      success: true,
      offer: {
        id: offer.id,
        title: offer.title,
        description: offer.description,
        category: offer.category,
        priceTokens: offer.price_tokens,
        deliveryTime: offer.delivery_time,
        maxQuantity: offer.max_quantity,
        active: offer.active,
        displayOrder: offer.display_order,
        createdAt: offer.created_at
      }
    });
    
  } catch (error) {
    console.error('Error creating offer:', error);
    res.status(500).json({ error: 'Failed to create offer' });
  }
}

// Update an offer
router.put('/:offerId', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.id;
    const { offerId } = req.params;
    const { title, description, category, priceTokens, deliveryTime, maxQuantity, active } = req.body;
    
    // Check ownership
    const ownerQuery = 'SELECT creator_id FROM creator_offers WHERE id = $1';
    const ownerResult = await pool.query(ownerQuery, [offerId]);
    
    if (ownerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }
    
    if (ownerResult.rows[0].creator_id !== creatorId) {
      return res.status(403).json({ error: 'You can only update your own offers' });
    }
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title.trim());
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description ? description.trim() : null);
    }
    if (category !== undefined) {
      updates.push(`category = $${paramCount++}`);
      values.push(category);
    }
    if (priceTokens !== undefined) {
      if (priceTokens < 1 || priceTokens > 1000000) {
        return res.status(400).json({ error: 'Price must be between 1 and 1,000,000 tokens' });
      }
      updates.push(`price_tokens = $${paramCount++}`);
      values.push(priceTokens);
    }
    if (deliveryTime !== undefined) {
      updates.push(`delivery_time = $${paramCount++}`);
      values.push(deliveryTime);
    }
    if (maxQuantity !== undefined) {
      updates.push(`max_quantity = $${paramCount++}`);
      values.push(maxQuantity);
    }
    if (active !== undefined) {
      updates.push(`active = $${paramCount++}`);
      values.push(active);
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(offerId);
    
    const updateQuery = `
      UPDATE creator_offers 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result = await pool.query(updateQuery, values);
    const offer = result.rows[0];
    
    res.json({
      success: true,
      offer: {
        id: offer.id,
        title: offer.title,
        description: offer.description,
        category: offer.category,
        priceTokens: offer.price_tokens,
        deliveryTime: offer.delivery_time,
        maxQuantity: offer.max_quantity,
        active: offer.active,
        updatedAt: offer.updated_at
      }
    });
    
  } catch (error) {
    console.error('Error updating offer:', error);
    res.status(500).json({ error: 'Failed to update offer' });
  }
});

// Delete an offer
router.delete('/:offerId', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.id;
    const { offerId } = req.params;
    
    // Check ownership and if there are pending purchases
    const checkQuery = `
      SELECT 
        o.creator_id,
        COUNT(op.id) as pending_purchases
      FROM creator_offers o
      LEFT JOIN offer_purchases op ON o.id = op.offer_id AND op.status IN ('pending', 'in_progress')
      WHERE o.id = $1
      GROUP BY o.creator_id
    `;
    
    const checkResult = await pool.query(checkQuery, [offerId]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }
    
    if (checkResult.rows[0].creator_id !== creatorId) {
      return res.status(403).json({ error: 'You can only delete your own offers' });
    }
    
    if (checkResult.rows[0].pending_purchases > 0) {
      return res.status(400).json({ error: 'Cannot delete offer with pending purchases' });
    }
    
    // Soft delete by setting active to false
    await pool.query('UPDATE creator_offers SET active = false WHERE id = $1', [offerId]);
    
    res.json({
      success: true,
      message: 'Offer deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting offer:', error);
    res.status(500).json({ error: 'Failed to delete offer' });
  }
});

// Purchase an offer
router.post('/:offerId/purchase', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const buyerId = req.user.id;
    const { offerId } = req.params;
    const { notes } = req.body;
    
    // Get offer details and check availability
    const offerQuery = `
      SELECT 
        o.*,
        COUNT(op.id) FILTER (WHERE op.status = 'completed') as completed_purchases
      FROM creator_offers o
      LEFT JOIN offer_purchases op ON o.id = op.offer_id
      WHERE o.id = $1 AND o.active = true
      GROUP BY o.id
    `;
    
    const offerResult = await client.query(offerQuery, [offerId]);
    
    if (offerResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Offer not found or not active' });
    }
    
    const offer = offerResult.rows[0];
    
    // Check if offer has reached max quantity
    if (offer.max_quantity && offer.completed_purchases >= offer.max_quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This offer is no longer available' });
    }
    
    // Check buyer's token balance
    const balanceQuery = 'SELECT balance FROM token_balances WHERE user_id = $1';
    const balanceResult = await client.query(balanceQuery, [buyerId]);
    
    if (balanceResult.rows.length === 0 || balanceResult.rows[0].balance < offer.price_tokens) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient token balance' });
    }
    
    // Create purchase record
    const purchaseQuery = `
      INSERT INTO offer_purchases (
        offer_id, buyer_id, creator_id, tokens_paid, notes
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    
    const purchaseValues = [offerId, buyerId, offer.creator_id, offer.price_tokens, notes];
    const purchaseResult = await client.query(purchaseQuery, purchaseValues);
    const purchaseId = purchaseResult.rows[0].id;
    
    // Deduct tokens from buyer
    await client.query(
      'UPDATE token_balances SET balance = balance - $1 WHERE user_id = $2',
      [offer.price_tokens, buyerId]
    );
    
    // Add tokens to creator
    await client.query(`
      INSERT INTO token_balances (user_id, balance) 
      VALUES ($1, $2)
      ON CONFLICT (user_id) 
      DO UPDATE SET balance = token_balances.balance + $2
    `, [offer.creator_id, offer.price_tokens]);
    
    // Record token transaction
    await client.query(`
      INSERT INTO token_transactions (
        user_id, amount, transaction_type, 
        description, related_purchase_id
      ) VALUES 
      ($1, $2, 'offer_purchase', $3, $4),
      ($5, $6, 'offer_sale', $7, $4)
    `, [
      buyerId, -offer.price_tokens, 
      `Purchased offer: ${offer.title}`, purchaseId,
      offer.creator_id, offer.price_tokens,
      `Sold offer: ${offer.title}`
    ]);
    
    // Create notification for creator
    await client.query(`
      INSERT INTO notifications (
        user_id, type, title, message, data
      ) VALUES ($1, 'offer_purchase', $2, $3, $4)
    `, [
      offer.creator_id,
      'New Offer Purchase!',
      `Someone purchased your "${offer.title}" offer for ${offer.price_tokens} tokens`,
      JSON.stringify({ offerId, purchaseId, buyerId })
    ]);
    
    await client.query('COMMIT');
    
    // Get buyer info for response
    const buyerQuery = 'SELECT username FROM users WHERE id = $1';
    const buyerResult = await pool.query(buyerQuery, [buyerId]);
    
    res.json({
      success: true,
      purchase: {
        id: purchaseId,
        offerId: offerId,
        offerTitle: offer.title,
        tokensPaid: offer.price_tokens,
        status: 'pending',
        deliveryTime: offer.delivery_time,
        buyerUsername: buyerResult.rows[0]?.username || 'Unknown'
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error purchasing offer:', error);
    res.status(500).json({ error: 'Failed to purchase offer' });
  } finally {
    client.release();
  }
});

// Get purchase history for a user
router.get('/purchases', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { role } = req.query; // 'buyer' or 'creator'
    
    let query;
    if (role === 'creator') {
      query = `
        SELECT 
          op.*,
          o.title as offer_title,
          o.description as offer_description,
          o.category as offer_category,
          u.username as buyer_username,
          u.profile_pic_url as buyer_profile_pic
        FROM offer_purchases op
        JOIN creator_offers o ON op.offer_id = o.id
        JOIN users u ON op.buyer_id::text = u.id::text
        WHERE op.creator_id = $1
        ORDER BY op.created_at DESC
        LIMIT 50
      `;
    } else {
      query = `
        SELECT 
          op.*,
          o.title as offer_title,
          o.description as offer_description,
          o.category as offer_category,
          o.delivery_time as offer_delivery_time,
          u.username as creator_username,
          u.profile_pic_url as creator_profile_pic
        FROM offer_purchases op
        JOIN creator_offers o ON op.offer_id = o.id
        JOIN users u ON op.creator_id = u.id
        WHERE op.buyer_id = $1
        ORDER BY op.created_at DESC
        LIMIT 50
      `;
    }
    
    const result = await pool.query(query, [userId]);
    
    const purchases = result.rows.map(row => ({
      id: row.id,
      offerId: row.offer_id,
      offerTitle: row.offer_title,
      offerDescription: row.offer_description,
      offerCategory: row.offer_category,
      tokensPaid: row.tokens_paid,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      ...(role === 'creator' ? {
        buyerUsername: row.buyer_username,
        buyerProfilePic: row.buyer_profile_pic
      } : {
        creatorUsername: row.creator_username,
        creatorProfilePic: row.creator_profile_pic,
        deliveryTime: row.offer_delivery_time
      })
    }));
    
    res.json({
      success: true,
      purchases: purchases
    });
    
  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
});

// Update purchase status (for creators)
router.put('/purchase/:purchaseId/status', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.id;
    const { purchaseId } = req.params;
    const { status } = req.body;
    
    // Validate status
    const validStatuses = ['in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    // Check ownership
    const checkQuery = 'SELECT creator_id, buyer_id, status as current_status FROM offer_purchases WHERE id = $1';
    const checkResult = await pool.query(checkQuery, [purchaseId]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase not found' });
    }
    
    if (checkResult.rows[0].creator_id !== creatorId) {
      return res.status(403).json({ error: 'You can only update your own sales' });
    }
    
    // Update status
    const updateQuery = `
      UPDATE offer_purchases 
      SET status = $1, updated_at = NOW(), 
          completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await pool.query(updateQuery, [status, purchaseId]);
    
    // Notify buyer of status change
    await pool.query(`
      INSERT INTO notifications (
        user_id, type, title, message, data
      ) VALUES ($1, 'offer_status_update', $2, $3, $4)
    `, [
      checkResult.rows[0].buyer_id,
      'Offer Status Updated',
      `Your offer purchase status has been updated to: ${status}`,
      JSON.stringify({ purchaseId, status })
    ]);
    
    res.json({
      success: true,
      purchase: {
        id: result.rows[0].id,
        status: result.rows[0].status,
        updatedAt: result.rows[0].updated_at,
        completedAt: result.rows[0].completed_at
      }
    });
    
  } catch (error) {
    console.error('Error updating purchase status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

module.exports = router;