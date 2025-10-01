const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { body, param, query, validationResult } = require('express-validator');
const { pool } = require('../utils/db');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const multer = require('multer');
const { getIO } = require('../utils/socket');
const upload = multer({ 
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// ==========================================
// CREATOR MANAGEMENT ROUTES
// ==========================================

// Initialize shop for creator
router.post('/initialize', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id || req.user.uid;
    
    // Check if user is a creator
    const userCheck = await pool.query(
      'SELECT is_creator FROM users WHERE supabase_id = $1',
      [creatorId]
    );
    
    if (!userCheck.rows[0]?.is_creator) {
      return res.status(403).json({ error: 'Creator access required' });
    }
    
    // Get creator username for shop name
    const creatorInfo = await pool.query(
      'SELECT username FROM users WHERE supabase_id = $1',
      [creatorId]
    );
    const creatorUsername = creatorInfo.rows[0]?.username || 'Creator';
    const shopName = `${creatorUsername} Shop`;
    
    // Initialize shop settings - always enable both payment methods
    const result = await pool.query(
      `INSERT INTO shop_settings (
        creator_id, is_enabled, shop_name, accepts_usd, accepts_tokens
      ) VALUES ($1, true, $2, true, true)
      ON CONFLICT (creator_id) 
      DO UPDATE SET 
        shop_name = $2,
        accepts_usd = true,
        accepts_tokens = true,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [creatorId, shopName]
    );
    
    res.json({
      success: true,
      settings: result.rows[0]
    });
  } catch (error) {
    console.error('Error initializing shop:', error);
    res.status(500).json({ error: 'Failed to initialize shop' });
  }
});

// Get shop settings
router.get('/settings', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id || req.user.uid;
    
    const result = await pool.query(
      'SELECT * FROM shop_settings WHERE creator_id = $1',
      [creatorId]
    );
    
    if (!result.rows[0]) {
      return res.json({ settings: null, shopEnabled: false });
    }
    
    res.json({
      success: true,
      settings: result.rows[0],
      shopEnabled: result.rows[0].is_enabled
    });
  } catch (error) {
    console.error('Error fetching shop settings:', error);
    res.status(500).json({ error: 'Failed to fetch shop settings' });
  }
});

// Update shop settings
router.put('/settings', authenticateToken, [
  body('shopName').optional().isString(),
  body('shopDescription').optional().isString(),
  body('acceptsUsd').optional().isBoolean(),
  body('acceptsTokens').optional().isBoolean(),
  body('policies').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const creatorId = req.user.supabase_id || req.user.uid;
    const { shopDescription, policies } = req.body;
    
    // Get creator username for shop name
    const creatorInfo = await pool.query(
      'SELECT username FROM users WHERE supabase_id = $1',
      [creatorId]
    );
    const creatorUsername = creatorInfo.rows[0]?.username || 'Creator';
    const shopName = `${creatorUsername} Shop`;
    
    const result = await pool.query(
      `UPDATE shop_settings 
      SET 
        shop_name = $2,
        shop_description = COALESCE($3, shop_description),
        accepts_usd = true,
        accepts_tokens = true,
        policies = COALESCE($4, policies),
        updated_at = CURRENT_TIMESTAMP
      WHERE creator_id = $1
      RETURNING *`,
      [creatorId, shopName, shopDescription, policies ? JSON.stringify(policies) : null]
    );
    
    res.json({
      success: true,
      settings: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating shop settings:', error);
    res.status(500).json({ error: 'Failed to update shop settings' });
  }
});

// Get creator's products for live shopping
router.get('/creator/products', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id || req.user.uid;
    const { includeInactive = false } = req.query;
    
    // Check if user is a creator
    const userCheck = await pool.query(
      'SELECT is_creator FROM users WHERE supabase_id = $1',
      [creatorId]
    );
    
    if (!userCheck.rows[0]?.is_creator) {
      return res.status(403).json({ error: 'Creator access required' });
    }
    
    // Fetch creator's products
    const query = includeInactive
      ? `SELECT * FROM shop_items WHERE creator_id = $1 ORDER BY created_at DESC`
      : `SELECT * FROM shop_items WHERE creator_id = $1 AND is_active = true ORDER BY created_at DESC`;
    
    const result = await pool.query(query, [creatorId]);
    
    res.json({
      success: true,
      products: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching creator products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Create shop item
router.post('/items', authenticateToken, [
  body('name').notEmpty().isString(),
  body('description').optional().isString(),
  body('priceUsd').isFloat({ min: 10.00 }).withMessage('Minimum price is $10 USD'),
  body('priceTokens').optional().isInt({ min: 100 }).withMessage('Minimum price is 100 tokens'),
  body('category').optional().isString(),
  body('stockQuantity').optional().isInt(),
  body('isDigital').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    // Ensure token price matches USD price (1:10 ratio)
    const { priceUsd } = req.body;
    const calculatedTokenPrice = Math.round(priceUsd * 10);
    
    // Override provided token price with calculated one
    req.body.priceTokens = calculatedTokenPrice;
    
    const creatorId = req.user.supabase_id || req.user.uid;
    const { 
      name, description, 
      category, stockQuantity, isDigital, images 
    } = req.body;
    const priceTokens = req.body.priceTokens;
    
    const result = await pool.query(
      `INSERT INTO shop_items (
        creator_id, name, description, price_usd, price_tokens,
        category, stock_quantity, is_digital, images, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      RETURNING *`,
      [
        creatorId, name, description, priceUsd, priceTokens,
        category, stockQuantity || -1, isDigital || false, 
        JSON.stringify(images || [])
      ]
    );
    
    res.json({
      success: true,
      item: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating shop item:', error);
    res.status(500).json({ error: 'Failed to create shop item' });
  }
});

// Update shop item
router.put('/items/:itemId', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id || req.user.uid;
    const { itemId } = req.params;
    const updates = req.body;
    
    // Validate minimum price if updating price
    if (updates.priceUsd && updates.priceUsd < 10) {
      return res.status(400).json({ error: 'Minimum price is $10 USD' });
    }
    
    // Auto-calculate token price from USD price
    if (updates.priceUsd) {
      updates.priceTokens = Math.round(updates.priceUsd * 10);
    }
    
    // Verify ownership
    const ownerCheck = await pool.query(
      'SELECT creator_id FROM shop_items WHERE id = $1',
      [itemId]
    );
    
    if (!ownerCheck.rows[0] || ownerCheck.rows[0].creator_id !== creatorId) {
      return res.status(403).json({ error: 'Not authorized to update this item' });
    }
    
    // Build dynamic update query
    const updateFields = [];
    const values = [itemId];
    let paramCount = 2;
    
    Object.entries(updates).forEach(([key, value]) => {
      if (['name', 'description', 'price_usd', 'price_tokens', 'category', 
           'stock_quantity', 'is_digital', 'is_active', 'images'].includes(key)) {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        updateFields.push(`${dbKey} = $${paramCount}`);
        values.push(key === 'images' ? JSON.stringify(value) : value);
        paramCount++;
      }
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    const result = await pool.query(
      `UPDATE shop_items 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *`,
      values
    );
    
    res.json({
      success: true,
      item: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating shop item:', error);
    res.status(500).json({ error: 'Failed to update shop item' });
  }
});

// Delete shop item
router.delete('/items/:itemId', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id || req.user.uid;
    const { itemId } = req.params;
    
    // Soft delete by setting is_active to false
    const result = await pool.query(
      `UPDATE shop_items 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND creator_id = $2
      RETURNING id`,
      [itemId, creatorId]
    );
    
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json({
      success: true,
      message: 'Item deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting shop item:', error);
    res.status(500).json({ error: 'Failed to delete shop item' });
  }
});

// Get creator's shop items (for management)
router.get('/items/manage', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id || req.user.uid;
    const { includeInactive } = req.query;
    
    const query = includeInactive === 'true'
      ? 'SELECT * FROM shop_items WHERE creator_id = $1 ORDER BY created_at DESC'
      : 'SELECT * FROM shop_items WHERE creator_id = $1 AND is_active = true ORDER BY created_at DESC';
    
    const result = await pool.query(query, [creatorId]);
    
    res.json({
      success: true,
      items: result.rows
    });
  } catch (error) {
    console.error('Error fetching shop items:', error);
    res.status(500).json({ error: 'Failed to fetch shop items' });
  }
});

// Get shop orders (creator view)
router.get('/orders', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id || req.user.uid;
    const { status, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        o.*,
        i.name as item_name,
        i.is_digital,
        u.username as buyer_username,
        u.display_name as buyer_display_name
      FROM shop_orders o
      JOIN shop_items i ON o.item_id = i.id
      LEFT JOIN users u ON o.buyer_id = u.supabase_id
      WHERE o.creator_id = $1
    `;
    
    const values = [creatorId];
    let paramCount = 2;
    
    if (status) {
      query += ` AND o.status = $${paramCount}`;
      values.push(status);
      paramCount++;
    }
    
    query += ` ORDER BY o.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);
    
    const result = await pool.query(query, values);
    
    res.json({
      success: true,
      orders: result.rows
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Update order status (for fulfillment)
router.put('/orders/:orderId/status', authenticateToken, [
  body('status').isIn(['processing', 'shipped', 'delivered', 'cancelled'])
], async (req, res) => {
  try {
    const creatorId = req.user.supabase_id || req.user.uid;
    const { orderId } = req.params;
    const { status, trackingInfo, notes } = req.body;
    
    // Verify ownership
    const orderCheck = await pool.query(
      'SELECT creator_id, buyer_email FROM shop_orders WHERE id = $1',
      [orderId]
    );
    
    if (!orderCheck.rows[0] || orderCheck.rows[0].creator_id !== creatorId) {
      return res.status(403).json({ error: 'Not authorized to update this order' });
    }
    
    const result = await pool.query(
      `UPDATE shop_orders
      SET 
        status = $2,
        digital_delivery_info = CASE WHEN $3::jsonb IS NOT NULL THEN $3::jsonb ELSE digital_delivery_info END,
        notes = COALESCE($4, notes),
        completed_at = CASE WHEN $2 = 'delivered' THEN CURRENT_TIMESTAMP ELSE completed_at END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *`,
      [orderId, status, trackingInfo ? JSON.stringify(trackingInfo) : null, notes]
    );
    
    // TODO: Send email notification to buyer about status update
    
    res.json({
      success: true,
      order: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// ==========================================
// PUBLIC ROUTES (No auth required)
// ==========================================

// Get public shop for creator
router.get('/public/:creatorUsername', async (req, res) => {
  try {
    const { creatorUsername } = req.params;
    
    // Get creator and shop info
    const creatorResult = await pool.query(
      `SELECT 
        u.supabase_id, u.username, u.display_name, u.profile_pic_url,
        s.shop_name, s.shop_description, s.banner_image, s.policies,
        s.accepts_usd, s.accepts_tokens, s.is_enabled
      FROM users u
      LEFT JOIN shop_settings s ON u.supabase_id = s.creator_id
      WHERE u.username = $1 AND u.is_creator = true`,
      [creatorUsername]
    );
    
    if (!creatorResult.rows[0]) {
      return res.status(404).json({ error: 'Creator not found' });
    }
    
    const creator = creatorResult.rows[0];
    
    if (!creator.is_enabled) {
      return res.json({
        success: true,
        shopEnabled: false,
        creator: {
          username: creator.username,
          displayName: creator.display_name,
          profilePic: creator.profile_pic_url
        }
      });
    }
    
    // Get shop items
    const itemsResult = await pool.query(
      `SELECT * FROM shop_items 
      WHERE creator_id = $1 AND is_active = true
      ORDER BY category, created_at DESC`,
      [creator.supabase_id]
    );
    
    // Get categories
    const categoriesResult = await pool.query(
      `SELECT DISTINCT category FROM shop_items 
      WHERE creator_id = $1 AND is_active = true AND category IS NOT NULL
      ORDER BY category`,
      [creator.supabase_id]
    );
    
    res.json({
      success: true,
      shopEnabled: true,
      shop: {
        name: creator.shop_name,
        description: creator.shop_description,
        bannerImage: creator.banner_image,
        policies: creator.policies,
        acceptsUsd: creator.accepts_usd,
        acceptsTokens: creator.accepts_tokens
      },
      creator: {
        id: creator.supabase_id,
        username: creator.username,
        displayName: creator.display_name,
        profilePic: creator.profile_pic_url
      },
      items: itemsResult.rows,
      categories: categoriesResult.rows.map(r => r.category)
    });
  } catch (error) {
    console.error('Error fetching public shop:', error);
    res.status(500).json({ error: 'Failed to fetch shop' });
  }
});

// Get public shop items for creator (alternative endpoint)
router.get('/public/:creatorUsername/items', async (req, res) => {
  try {
    const { creatorUsername } = req.params;
    
    // Get creator info
    const creatorResult = await pool.query(
      `SELECT 
        u.supabase_id, u.username, u.display_name,
        s.is_enabled
      FROM users u
      LEFT JOIN shop_settings s ON u.supabase_id = s.creator_id
      WHERE u.username = $1 AND u.is_creator = true`,
      [creatorUsername]
    );
    
    if (!creatorResult.rows[0]) {
      return res.status(404).json({ error: 'Creator not found' });
    }
    
    const creator = creatorResult.rows[0];
    
    if (!creator.is_enabled) {
      return res.json({
        success: true,
        items: []
      });
    }
    
    // Get shop items
    const itemsResult = await pool.query(
      `SELECT 
        id, name, description, price, category, image_url,
        stock_quantity, is_active, is_featured, created_at,
        sales_count
      FROM shop_items 
      WHERE creator_id = $1 AND is_active = true
      ORDER BY is_featured DESC, created_at DESC`,
      [creator.supabase_id]
    );
    
    res.json({
      success: true,
      items: itemsResult.rows
    });
  } catch (error) {
    console.error('Error fetching public shop items:', error);
    res.status(500).json({ error: 'Failed to fetch shop items' });
  }
});

// Get single item details
router.get('/public/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    
    const result = await pool.query(
      `SELECT 
        i.*,
        u.username as creator_username,
        u.display_name as creator_display_name,
        u.profile_pic_url as creator_profile_pic
      FROM shop_items i
      JOIN users u ON i.creator_id = u.supabase_id
      WHERE i.id = $1 AND i.is_active = true`,
      [itemId]
    );
    
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json({
      success: true,
      item: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// ==========================================
// CHECKOUT ROUTES
// ==========================================

// Create Stripe checkout session for USD payment
router.post('/checkout/stripe', optionalAuth, [
  body('itemId').isUUID(),
  body('quantity').isInt({ min: 1 }),
  body('buyerEmail').isEmail(),
  body('buyerName').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { itemId, quantity, buyerEmail, buyerName, shippingAddress } = req.body;
    const buyerId = req.user?.supabase_id || req.user?.uid || null;
    
    // Get item details
    const itemResult = await pool.query(
      `SELECT 
        i.*,
        u.username as creator_username,
        s.usd_to_token_rate
      FROM shop_items i
      JOIN users u ON i.creator_id = u.supabase_id
      LEFT JOIN shop_settings s ON i.creator_id = s.creator_id
      WHERE i.id = $1 AND i.is_active = true`,
      [itemId]
    );
    
    if (!itemResult.rows[0]) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    const item = itemResult.rows[0];
    
    // Check stock
    if (item.stock_quantity !== -1 && item.stock_quantity < quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }
    
    const totalAmount = item.price_usd * quantity;
    // Apply 80/20 split for USD purchases (creator gets 80%, platform gets 20%)
    const totalTokenValue = Math.floor(totalAmount * (item.usd_to_token_rate || 20));
    const creatorTokens = totalTokenValue; // Creator gets 100%
    const platformFeeTokens = 0; // No platform fee
    const platformFeeUSD = 0;
    
    // Create order record
    const orderResult = await pool.query(
      `INSERT INTO shop_orders (
        item_id, creator_id, buyer_id, buyer_email, buyer_name,
        quantity, payment_method, payment_status, amount_usd,
        tokens_credited, creator_net_tokens, platform_fee_tokens, platform_fee_usd,
        shipping_address, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'stripe', 'pending', $7, $8, $9, $10, $11, $12, 'pending')
      RETURNING *`,
      [
        itemId, item.creator_id, buyerId, buyerEmail, buyerName,
        quantity, totalAmount, totalTokenValue, creatorTokens, 
        platformFeeTokens, platformFeeUSD,
        shippingAddress ? JSON.stringify(shippingAddress) : null
      ]
    );
    
    const order = orderResult.rows[0];
    
    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.name,
            description: item.description || `Purchase from ${item.creator_username}`,
            images: item.images?.length > 0 ? [item.images[0]] : [],
            metadata: {
              item_id: itemId,
              creator_id: item.creator_id
            }
          },
          unit_amount: Math.round(item.price_usd * 100) // Convert to cents
        },
        quantity: quantity
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/${item.creator_username}/shop/success?session_id={CHECKOUT_SESSION_ID}&order_id=${order.id}`,
      cancel_url: `${process.env.FRONTEND_URL}/${item.creator_username}/shop`,
      customer_email: buyerEmail,
      metadata: {
        order_id: order.id,
        item_id: itemId,
        creator_id: item.creator_id,
        creator_tokens: creatorTokens.toString(),
        platform_fee_tokens: platformFeeTokens.toString(),
        platform_fee_usd: platformFeeUSD.toString()
      }
    });
    
    // Update order with Stripe session ID
    await pool.query(
      'UPDATE shop_orders SET stripe_session_id = $1 WHERE id = $2',
      [session.id, order.id]
    );
    
    res.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      orderId: order.id
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Process token payment
router.post('/checkout/tokens', authenticateToken, [
  body('itemId').isUUID(),
  body('quantity').isInt({ min: 1 })
], async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { itemId, quantity, shippingAddress } = req.body;
    const buyerId = req.user.supabase_id || req.user.uid;
    
    // Get item details
    const itemResult = await client.query(
      'SELECT * FROM shop_items WHERE id = $1 AND is_active = true FOR UPDATE',
      [itemId]
    );
    
    if (!itemResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found' });
    }
    
    const item = itemResult.rows[0];
    
    if (!item.price_tokens) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This item cannot be purchased with tokens' });
    }
    
    // Check stock
    if (item.stock_quantity !== -1 && item.stock_quantity < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient stock' });
    }
    
    const totalTokens = item.price_tokens * quantity;
    
    // Check buyer's token balance
    const balanceResult = await client.query(
      'SELECT balance FROM token_balances WHERE user_id = $1',
      [buyerId]
    );
    
    if (!balanceResult.rows[0] || balanceResult.rows[0].balance < totalTokens) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient token balance' });
    }
    
    // Deduct tokens from buyer
    await client.query(
      'UPDATE token_balances SET balance = balance - $1 WHERE user_id = $2',
      [totalTokens, buyerId]
    );
    
    // Add tokens to creator
    await client.query(
      `INSERT INTO token_balances (user_id, balance) 
      VALUES ($1, $2)
      ON CONFLICT (user_id) 
      DO UPDATE SET balance = token_balances.balance + $2`,
      [item.creator_id, totalTokens]
    );
    
    // Record token transactions
    await client.query(
      `INSERT INTO token_transactions (user_id, amount, type, description)
      VALUES ($1, $2, 'purchase', $3)`,
      [buyerId, -totalTokens, `Purchase: ${item.name}`]
    );
    
    await client.query(
      `INSERT INTO token_transactions (user_id, amount, type, description)
      VALUES ($1, $2, 'sale', $3)`,
      [item.creator_id, totalTokens, `Sale: ${item.name}`]
    );
    
    // Get buyer info
    const buyerResult = await client.query(
      'SELECT email, username, display_name FROM users WHERE supabase_id = $1',
      [buyerId]
    );
    
    const buyer = buyerResult.rows[0];
    
    // Create order record
    const orderResult = await client.query(
      `INSERT INTO shop_orders (
        item_id, creator_id, buyer_id, buyer_email, buyer_name,
        quantity, payment_method, payment_status, amount_tokens,
        shipping_address, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'tokens', 'completed', $7, $8, 'processing')
      RETURNING *`,
      [
        itemId, item.creator_id, buyerId, buyer.email, 
        buyer.display_name || buyer.username,
        quantity, totalTokens,
        shippingAddress ? JSON.stringify(shippingAddress) : null
      ]
    );
    
    // Update stock if applicable
    if (item.stock_quantity !== -1) {
      await client.query(
        'UPDATE shop_items SET stock_quantity = stock_quantity - $1 WHERE id = $2',
        [quantity, itemId]
      );
    }
    
    // Update sales count
    await client.query(
      'UPDATE shop_items SET sales_count = sales_count + $1 WHERE id = $2',
      [quantity, itemId]
    );
    
    await client.query('COMMIT');
    
    // Send real-time notification to creator for token payment
    const io = getIO();
    if (io) {
      io.to(`creator_${item.creator_id}`).emit('shop_new_order', {
        orderId: orderResult.rows[0].id,
        itemName: item.name,
        quantity: quantity,
        amount: totalCost,
        currency: 'Tokens',
        buyerName: buyer.username || buyer.display_name || 'User',
        buyerEmail: buyer.email,
        timestamp: new Date()
      });
    }
    
    res.json({
      success: true,
      order: orderResult.rows[0],
      message: 'Purchase successful!'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing token payment:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  } finally {
    client.release();
  }
});

// Webhook for Stripe payment completion
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { order_id, item_id, creator_id, creator_tokens, platform_fee_tokens, platform_fee_usd } = session.metadata;
      
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Update order status
        await client.query(
          `UPDATE shop_orders 
          SET payment_status = 'completed', 
              stripe_payment_intent_id = $1,
              status = 'processing',
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2`,
          [session.payment_intent, order_id]
        );
        
        // Credit tokens to creator (70% of value)
        const creatorTokensAmount = parseInt(creator_tokens);
        const platformTokensAmount = parseInt(platform_fee_tokens);
        const platformUSDAmount = parseFloat(platform_fee_usd);
        
        if (creatorTokensAmount > 0) {
          // Credit creator with their 70% share
          await client.query(
            `INSERT INTO token_balances (user_id, balance) 
            VALUES ($1, $2)
            ON CONFLICT (user_id) 
            DO UPDATE SET balance = token_balances.balance + $2`,
            [creator_id, creatorTokensAmount]
          );
          
          await client.query(
            `INSERT INTO token_transactions (user_id, amount, type, description)
            VALUES ($1, $2, 'shop_sale', $3)`,
            [creator_id, creatorTokensAmount, `Shop sale (Order: ${order_id}) - 80% after platform fee`]
          );
          
          // Record platform earnings (20% commission)
          await client.query(
            `INSERT INTO platform_earnings (
              order_id, earning_type, amount_usd, amount_tokens, 
              creator_id, description
            ) VALUES ($1, 'shop_commission', $2, $3, $4, $5)`,
            [
              order_id, 
              platformUSDAmount, 
              platformTokensAmount,
              creator_id,
              `20% marketplace commission on shop sale`
            ]
          );
        }
        
        // Update stock and sales count
        const orderResult = await client.query(
          'SELECT quantity FROM shop_orders WHERE id = $1',
          [order_id]
        );
        
        if (orderResult.rows[0]) {
          const quantity = orderResult.rows[0].quantity;
          
          // Update stock if applicable
          await client.query(
            `UPDATE shop_items 
            SET stock_quantity = CASE 
              WHEN stock_quantity = -1 THEN -1 
              ELSE stock_quantity - $1 
            END,
            sales_count = sales_count + $1
            WHERE id = $2`,
            [quantity, item_id]
          );
        }
        
        await client.query('COMMIT');
        
        // Send real-time notification to creator
        const io = getIO();
        if (io) {
          // Get order details for notification
          const orderDetails = await pool.query(
            `SELECT o.*, i.name as item_name, i.price_usd, i.price_tokens,
                    u.username as buyer_username, u.email as buyer_email
             FROM shop_orders o
             JOIN shop_items i ON o.item_id = i.id
             LEFT JOIN users u ON o.buyer_id = u.id
             WHERE o.id = $1`,
            [order_id]
          );
          
          if (orderDetails.rows[0]) {
            const order = orderDetails.rows[0];
            io.to(`creator_${creator_id}`).emit('shop_new_order', {
              orderId: order.id,
              itemName: order.item_name,
              quantity: order.quantity,
              amount: order.amount_usd || order.amount_tokens,
              netAmount: order.creator_net_tokens || order.amount_tokens, // Net after platform fee
              platformFee: order.platform_fee_tokens || 0,
              currency: order.payment_method === 'usd' ? 'USD' : 'Tokens',
              buyerName: order.buyer_name || order.buyer_username || 'Guest',
              buyerEmail: order.buyer_email,
              timestamp: new Date()
            });
          }
        }
        
        // TODO: Send confirmation email to buyer
        // TODO: Notify creator of new order via email
        
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

// Get order details (for buyer)
router.get('/orders/:orderId', optionalAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.supabase_id || req.user?.uid;
    
    const query = userId
      ? `SELECT o.*, i.name as item_name, i.images, i.is_digital,
         u.username as creator_username, u.display_name as creator_display_name
         FROM shop_orders o
         JOIN shop_items i ON o.item_id = i.id
         JOIN users u ON i.creator_id = u.supabase_id
         WHERE o.id = $1 AND (o.buyer_id = $2 OR o.creator_id = $2)`
      : `SELECT o.order_number, o.status, o.created_at,
         i.name as item_name, u.username as creator_username
         FROM shop_orders o
         JOIN shop_items i ON o.item_id = i.id
         JOIN users u ON i.creator_id = u.supabase_id
         WHERE o.id = $1`;
    
    const values = userId ? [orderId, userId] : [orderId];
    const result = await pool.query(query, values);
    
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json({
      success: true,
      order: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Shop analytics for creator
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const creatorId = req.user.supabase_id || req.user.uid;
    const { period = '30' } = req.query;
    
    const analytics = await pool.query(
      `SELECT 
        COUNT(DISTINCT o.id) as total_orders,
        COUNT(DISTINCT o.buyer_id) as unique_buyers,
        SUM(o.amount_usd) as gross_revenue_usd,
        SUM(o.amount_tokens) as gross_revenue_tokens,
        SUM(o.creator_net_tokens) as net_tokens_earned,
        SUM(o.platform_fee_tokens) as platform_fees_tokens,
        SUM(o.platform_fee_usd) as platform_fees_usd,
        AVG(o.amount_usd) as avg_order_value_usd,
        AVG(o.amount_tokens) as avg_order_value_tokens,
        CASE 
          WHEN SUM(o.amount_usd) > 0 
          THEN 80.00
          ELSE 100 
        END as creator_percentage
      FROM shop_orders o
      WHERE o.creator_id = $1 
        AND o.payment_status = 'completed'
        AND o.created_at >= CURRENT_TIMESTAMP - INTERVAL '${period} days'`,
      [creatorId]
    );
    
    const topItems = await pool.query(
      `SELECT 
        i.id, i.name, i.price_usd, i.price_tokens,
        COUNT(o.id) as order_count,
        SUM(o.quantity) as total_sold
      FROM shop_items i
      LEFT JOIN shop_orders o ON i.id = o.item_id AND o.payment_status = 'completed'
      WHERE i.creator_id = $1
      GROUP BY i.id
      ORDER BY total_sold DESC NULLS LAST
      LIMIT 5`,
      [creatorId]
    );
    
    res.json({
      success: true,
      analytics: analytics.rows[0],
      topItems: topItems.rows,
      period: parseInt(period)
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;