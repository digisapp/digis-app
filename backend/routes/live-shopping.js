const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../utils/db');
const { validationResult } = require('express-validator');

// Get products for a stream
router.get('/streams/:streamId/products', async (req, res) => {
  const { streamId } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT 
        sp.*,
        si.name,
        si.description,
        si.price,
        si.image_url,
        si.stock_quantity,
        si.category,
        fs.sale_price,
        fs.discount_percentage as flash_discount,
        fs.ends_at as flash_ends_at,
        fs.sold_quantity as flash_sold,
        fs.max_quantity as flash_max
      FROM stream_products sp
      JOIN shop_items si ON sp.product_id = si.id
      LEFT JOIN flash_sales fs ON fs.stream_id = sp.stream_id 
        AND fs.product_id = sp.product_id 
        AND fs.ends_at > NOW()
      WHERE sp.stream_id = $1
      ORDER BY sp.featured DESC, sp.display_order ASC
    `, [streamId]);
    
    res.json({
      success: true,
      products: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching stream products:', error);
    res.status(500).json({ error: 'Failed to fetch stream products' });
  }
});

// Add product to stream (creator only)
router.post('/streams/:streamId/products', authenticateToken, async (req, res) => {
  const { streamId } = req.params;
  const { productId, featured = false, discountPercentage = 0 } = req.body;
  const userId = req.user.supabase_id;
  
  try {
    // Verify the user owns the stream
    const streamCheck = await pool.query(
      'SELECT creator_id FROM streams WHERE id = $1',
      [streamId]
    );
    
    if (streamCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Stream not found' });
    }
    
    if (streamCheck.rows[0].creator_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to modify this stream' });
    }
    
    // Verify the product exists and belongs to the creator
    const productCheck = await pool.query(
      'SELECT * FROM shop_items WHERE id = $1 AND creator_id = $2',
      [productId, userId]
    );
    
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found or unauthorized' });
    }
    
    // Add product to stream
    const result = await pool.query(`
      INSERT INTO stream_products (
        stream_id, product_id, featured, discount_percentage, display_order
      ) VALUES ($1, $2, $3, $4, (
        SELECT COALESCE(MAX(display_order), 0) + 1 
        FROM stream_products 
        WHERE stream_id = $1
      ))
      ON CONFLICT (stream_id, product_id) 
      DO UPDATE SET 
        featured = EXCLUDED.featured,
        discount_percentage = EXCLUDED.discount_percentage,
        featured_at = CASE WHEN EXCLUDED.featured THEN NOW() ELSE stream_products.featured_at END
      RETURNING *
    `, [streamId, productId, featured, discountPercentage]);
    
    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
// TODO: Replace with Ably publish
//       io.to(`stream:${streamId}`).emit('product:added', {
        // streamId,
        // product: {
          // ...productCheck.rows[0],
          // ...result.rows[0]
        // }
      // });
    }
    
    res.json({
      success: true,
      product: result.rows[0]
    });
  } catch (error) {
    console.error('Error adding product to stream:', error);
    res.status(500).json({ error: 'Failed to add product to stream' });
  }
});

// Remove product from stream
router.delete('/streams/:streamId/products/:productId', authenticateToken, async (req, res) => {
  const { streamId, productId } = req.params;
  const userId = req.user.supabase_id;
  
  try {
    // Verify ownership
    const streamCheck = await pool.query(
      'SELECT creator_id FROM streams WHERE id = $1 AND creator_id = $2',
      [streamId, userId]
    );
    
    if (streamCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    await pool.query(
      'DELETE FROM stream_products WHERE stream_id = $1 AND product_id = $2',
      [streamId, productId]
    );
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
// TODO: Replace with Ably publish
//       io.to(`stream:${streamId}`).emit('product:removed', {
        // streamId,
        // productId
      // });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing product from stream:', error);
    res.status(500).json({ error: 'Failed to remove product' });
  }
});

// Feature/unfeature a product
router.put('/streams/:streamId/products/:productId/feature', authenticateToken, async (req, res) => {
  const { streamId, productId } = req.params;
  const { featured } = req.body;
  const userId = req.user.supabase_id;
  
  try {
    // Verify ownership
    const streamCheck = await pool.query(
      'SELECT creator_id FROM streams WHERE id = $1 AND creator_id = $2',
      [streamId, userId]
    );
    
    if (streamCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // If featuring, unfeature all other products first
    if (featured) {
      await pool.query(
        'UPDATE stream_products SET featured = false WHERE stream_id = $1',
        [streamId]
      );
    }
    
    const result = await pool.query(`
      UPDATE stream_products 
      SET featured = $1, featured_at = CASE WHEN $1 THEN NOW() ELSE featured_at END
      WHERE stream_id = $2 AND product_id = $3
      RETURNING *
    `, [featured, streamId, productId]);
    
    // Also update the stream's featured product
    if (featured) {
      await pool.query(
        'UPDATE streams SET featured_product_id = $1 WHERE id = $2',
        [productId, streamId]
      );
    }
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
// TODO: Replace with Ably publish
//       io.to(`stream:${streamId}`).emit('product:featured', {
        // streamId,
        // productId,
        // featured
      // });
    }
    
    // Log showcase event
    await pool.query(`
      INSERT INTO product_showcase_events (stream_id, product_id, event_type, event_data)
      VALUES ($1, $2, 'showcased', $3)
    `, [streamId, productId, JSON.stringify({ featured })]);
    
    res.json({
      success: true,
      product: result.rows[0]
    });
  } catch (error) {
    console.error('Error featuring product:', error);
    res.status(500).json({ error: 'Failed to feature product' });
  }
});

// Create flash sale
router.post('/flash-sales', authenticateToken, async (req, res) => {
  const { streamId, productId, discountPercentage, durationMinutes, maxQuantity } = req.body;
  const userId = req.user.supabase_id;

  // Validate input parameters
  if (!streamId || !productId || !discountPercentage || !durationMinutes) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (discountPercentage <= 0 || discountPercentage > 100) {
    return res.status(400).json({ error: 'Discount percentage must be between 1 and 100' });
  }

  if (durationMinutes <= 0 || durationMinutes > 1440) { // Max 24 hours
    return res.status(400).json({ error: 'Duration must be between 1 and 1440 minutes' });
  }

  if (maxQuantity && maxQuantity <= 0) {
    return res.status(400).json({ error: 'Max quantity must be positive' });
  }

  try {
    // Verify ownership and get product details
    const verifyQuery = await pool.query(`
      SELECT s.creator_id, si.price, si.name
      FROM streams s
      JOIN shop_items si ON si.creator_id = s.creator_id
      WHERE s.id = $1 AND si.id = $2 AND s.creator_id = $3
    `, [streamId, productId, userId]);
    
    if (verifyQuery.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized or product not found' });
    }
    
    const { price: originalPrice, name: productName } = verifyQuery.rows[0];
    const salePrice = Math.floor(originalPrice * (1 - discountPercentage / 100));
    const endsAt = new Date(Date.now() + durationMinutes * 60000);
    
    // Create flash sale
    const result = await pool.query(`
      INSERT INTO flash_sales (
        stream_id, product_id, original_price, sale_price, 
        discount_percentage, duration_minutes, max_quantity, ends_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [streamId, productId, originalPrice, salePrice, discountPercentage, durationMinutes, maxQuantity, endsAt]);
    
    // Update stream_products to mark as flash sale
    await pool.query(`
      UPDATE stream_products 
      SET flash_sale = true, flash_sale_ends_at = $1
      WHERE stream_id = $2 AND product_id = $3
    `, [endsAt, streamId, productId]);
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
// TODO: Replace with Ably publish
//       io.to(`stream:${streamId}`).emit('flash:sale:started', {
        // streamId,
        // productId,
        // productName,
        // originalPrice,
        // salePrice,
        // discountPercentage,
        // endsAt,
        // maxQuantity
      // });
    }
    
    res.json({
      success: true,
      flashSale: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating flash sale:', error);
    res.status(500).json({ error: 'Failed to create flash sale' });
  }
});

// Purchase product during stream
router.post('/live-purchases', authenticateToken, async (req, res) => {
  const { streamId, productId, quantity } = req.body;
  const buyerId = req.user.supabase_id;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get product details with row-level lock to prevent concurrent stock issues
    const productQuery = await client.query(`
      SELECT
        si.*,
        sp.discount_percentage,
        fs.sale_price,
        fs.max_quantity,
        fs.sold_quantity,
        fs.ends_at as flash_ends_at
      FROM shop_items si
      JOIN stream_products sp ON sp.product_id = si.id
      LEFT JOIN flash_sales fs ON fs.product_id = si.id
        AND fs.stream_id = sp.stream_id
        AND fs.ends_at > NOW()
      WHERE si.id = $1 AND sp.stream_id = $2
      FOR UPDATE OF si  -- Lock the shop_items row to prevent concurrent stock updates
    `, [productId, streamId]);
    
    if (productQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found in this stream' });
    }
    
    const product = productQuery.rows[0];
    
    // Check stock
    if (product.stock_quantity !== null && product.stock_quantity < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient stock' });
    }
    
    // Check flash sale limits
    if (product.flash_ends_at && product.max_quantity) {
      if (product.sold_quantity + quantity > product.max_quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Flash sale quantity limit exceeded' });
      }
    }
    
    // Calculate price
    let pricePerItem = product.price;
    let purchaseType = 'standard';
    let discountApplied = 0;
    
    if (product.sale_price && product.flash_ends_at) {
      pricePerItem = product.sale_price;
      purchaseType = 'flash_sale';
      discountApplied = product.discount_percentage;
    } else if (product.discount_percentage > 0) {
      pricePerItem = Math.floor(product.price * (1 - product.discount_percentage / 100));
      discountApplied = product.discount_percentage;
    }
    
    const totalPrice = pricePerItem * quantity;
    
    // Check buyer's token balance
    const balanceQuery = await client.query(
      'SELECT token_balance FROM users WHERE id = $1',
      [buyerId]
    );
    
    if (balanceQuery.rows[0].token_balance < totalPrice) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient tokens' });
    }
    
    // Deduct tokens from buyer
    await client.query(
      'UPDATE users SET token_balance = token_balance - $1 WHERE id = $2',
      [totalPrice, buyerId]
    );
    
    // Add tokens to creator (minus platform fee)
    const platformFee = Math.floor(totalPrice * 0.2); // 20% platform fee
    const creatorEarnings = totalPrice - platformFee;
    
    await client.query(
      'UPDATE users SET token_balance = token_balance + $1 WHERE id = $2',
      [creatorEarnings, product.creator_id]
    );
    
    // Create purchase record
    const purchaseResult = await client.query(`
      INSERT INTO live_purchases (
        stream_id, buyer_id, product_id, quantity, 
        price_tokens, discount_applied, purchase_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [streamId, buyerId, productId, quantity, totalPrice, discountApplied, purchaseType]);
    
    // Update product stock
    if (product.stock_quantity !== null) {
      await client.query(
        'UPDATE shop_items SET stock_quantity = stock_quantity - $1 WHERE id = $2',
        [quantity, productId]
      );
    }
    
    // Update flash sale sold quantity with proper locking (already locked in SELECT)
    if (purchaseType === 'flash_sale') {
      await client.query(
        'UPDATE flash_sales SET sold_quantity = sold_quantity + $1 WHERE product_id = $2 AND stream_id = $3 AND is_active = true',
        [quantity, productId, streamId]
      );
    }
    
    // Update stream total sales
    await client.query(
      'UPDATE streams SET total_sales = total_sales + $1 WHERE id = $2',
      [totalPrice, streamId]
    );
    
    // Log purchase event
    await client.query(`
      INSERT INTO product_showcase_events (stream_id, product_id, event_type, viewer_id, event_data)
      VALUES ($1, $2, 'purchased', $3, $4)
    `, [streamId, productId, buyerId, JSON.stringify({ quantity, price: totalPrice })]);
    
    // Create token transaction records
    await client.query(`
      INSERT INTO token_transactions (user_id, amount, transaction_type, description, metadata)
      VALUES 
        ($1, $2, 'purchase', $3, $4),
        ($5, $6, 'sale', $7, $8)
    `, [
      buyerId, -totalPrice, `Purchased ${product.name} during live stream`, 
      JSON.stringify({ streamId, productId, quantity }),
      product.creator_id, creatorEarnings, `Sold ${product.name} during live stream`,
      JSON.stringify({ streamId, productId, quantity, buyerId })
    ]);
    
    await client.query('COMMIT');
    
    // Get buyer info for notification
    const buyerInfo = await pool.query(
      'SELECT username, display_name FROM users WHERE id = $1',
      [buyerId]
    );
    
    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      // Notify everyone in the stream
// TODO: Replace with Ably publish
//       io.to(`stream:${streamId}`).emit('product:purchased', {
        // streamId,
        // productId,
        // productName: product.name,
        // buyer: buyerInfo.rows[0].display_name || buyerInfo.rows[0].username,
        // quantity,
        // price: totalPrice,
        // purchaseType
      // });
      
      // Update product stock for everyone
// TODO: Replace with Ably publish
//       io.to(`stream:${streamId}`).emit('product:stock:updated', {
        // productId,
        // newStock: product.stock_quantity ? product.stock_quantity - quantity : null
      // });
    }
    
    res.json({
      success: true,
      purchase: purchaseResult.rows[0],
      totalPrice,
      newBalance: balanceQuery.rows[0].token_balance - totalPrice
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing live purchase:', error);
    res.status(500).json({ error: 'Failed to process purchase' });
  } finally {
    client.release();
  }
});

// Get live purchase feed for a stream
router.get('/streams/:streamId/purchases', async (req, res) => {
  const { streamId } = req.params;
  const { limit = 20 } = req.query;
  
  try {
    const result = await pool.query(`
      SELECT 
        lp.*,
        u.username as buyer_username,
        u.display_name as buyer_name,
        u.profile_pic_url as buyer_avatar,
        si.name as product_name,
        si.image_url as product_image
      FROM live_purchases lp
      JOIN users u ON lp.buyer_id = u.id
      JOIN shop_items si ON lp.product_id = si.id
      WHERE lp.stream_id = $1
      ORDER BY lp.purchased_at DESC
      LIMIT $2
    `, [streamId, limit]);
    
    res.json({
      success: true,
      purchases: result.rows
    });
  } catch (error) {
    console.error('Error fetching live purchases:', error);
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
});

// Create shopping poll/interaction
router.post('/shopping-interactions', authenticateToken, async (req, res) => {
  const { streamId, interactionType, productId, question, options, expiresInMinutes = 5 } = req.body;
  const creatorId = req.user.supabase_id;
  
  try {
    // Verify stream ownership
    const streamCheck = await pool.query(
      'SELECT id FROM streams WHERE id = $1 AND creator_id = $2',
      [streamId, creatorId]
    );
    
    if (streamCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60000);
    
    const result = await pool.query(`
      INSERT INTO shopping_interactions (
        stream_id, creator_id, interaction_type, product_id, 
        question, options, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [streamId, creatorId, interactionType, productId, question, JSON.stringify(options), expiresAt]);
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
// TODO: Replace with Ably publish
//       io.to(`stream:${streamId}`).emit('shopping:interaction:created', {
        // interaction: result.rows[0]
      // });
    }
    
    res.json({
      success: true,
      interaction: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating shopping interaction:', error);
    res.status(500).json({ error: 'Failed to create interaction' });
  }
});

// Respond to shopping interaction
router.post('/shopping-interactions/:interactionId/respond', authenticateToken, async (req, res) => {
  const { interactionId } = req.params;
  const { response } = req.body;
  const viewerId = req.user.supabase_id;
  
  try {
    // Check if interaction is still active
    const interactionCheck = await pool.query(
      'SELECT * FROM shopping_interactions WHERE id = $1 AND active = true AND expires_at > NOW()',
      [interactionId]
    );
    
    if (interactionCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Interaction expired or not found' });
    }
    
    const interaction = interactionCheck.rows[0];
    
    // Insert response (upsert to allow changing vote)
    await pool.query(`
      INSERT INTO shopping_interaction_responses (interaction_id, viewer_id, response)
      VALUES ($1, $2, $3)
      ON CONFLICT (interaction_id, viewer_id)
      DO UPDATE SET response = EXCLUDED.response, responded_at = NOW()
    `, [interactionId, viewerId, response]);
    
    // Get updated response counts
    const responseCounts = await pool.query(`
      SELECT response, COUNT(*) as count
      FROM shopping_interaction_responses
      WHERE interaction_id = $1
      GROUP BY response
    `, [interactionId]);
    
    // Emit socket event with updated counts
    const io = req.app.get('io');
    if (io) {
// TODO: Replace with Ably publish
//       io.to(`stream:${interaction.stream_id}`).emit('shopping:interaction:updated', {
        // interactionId,
        // responses: responseCounts.rows
      // });
    }
    
    res.json({
      success: true,
      responses: responseCounts.rows
    });
  } catch (error) {
    console.error('Error responding to interaction:', error);
    res.status(500).json({ error: 'Failed to respond' });
  }
});

// Get stream shopping analytics
router.get('/streams/:streamId/shopping-analytics', authenticateToken, async (req, res) => {
  const { streamId } = req.params;
  const userId = req.user.supabase_id;
  
  try {
    // Verify ownership
    const streamCheck = await pool.query(
      'SELECT creator_id, total_sales FROM streams WHERE id = $1',
      [streamId]
    );
    
    if (streamCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Stream not found' });
    }
    
    if (streamCheck.rows[0].creator_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Get analytics data
    const [salesData, topProducts, showcaseEvents] = await Promise.all([
      // Total sales and purchase count
      pool.query(`
        SELECT 
          COUNT(*) as total_purchases,
          SUM(price_tokens) as total_revenue,
          AVG(price_tokens) as avg_purchase_value,
          COUNT(DISTINCT buyer_id) as unique_buyers
        FROM live_purchases
        WHERE stream_id = $1
      `, [streamId]),
      
      // Top selling products
      pool.query(`
        SELECT 
          si.name,
          si.image_url,
          COUNT(*) as sales_count,
          SUM(lp.quantity) as total_quantity,
          SUM(lp.price_tokens) as total_revenue
        FROM live_purchases lp
        JOIN shop_items si ON lp.product_id = si.id
        WHERE lp.stream_id = $1
        GROUP BY si.id, si.name, si.image_url
        ORDER BY total_revenue DESC
        LIMIT 5
      `, [streamId]),
      
      // Showcase engagement
      pool.query(`
        SELECT 
          event_type,
          COUNT(*) as count
        FROM product_showcase_events
        WHERE stream_id = $1
        GROUP BY event_type
      `, [streamId])
    ]);
    
    res.json({
      success: true,
      analytics: {
        totalSales: streamCheck.rows[0].total_sales,
        ...salesData.rows[0],
        topProducts: topProducts.rows,
        engagement: showcaseEvents.rows
      }
    });
  } catch (error) {
    console.error('Error fetching shopping analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;