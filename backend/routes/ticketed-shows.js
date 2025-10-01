const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { getIO } = require('../utils/socket');

// Announce a ticketed show
router.post('/announce', authenticateToken, async (req, res) => {
  const { 
    streamId, 
    title,
    description,
    tokenPrice, 
    startTime,
    maxTickets,
    earlyBirdPrice,
    earlyBirdDeadline
  } = req.body;
  const creatorId = req.user.supabase_id;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Verify stream exists and belongs to creator
    const streamQuery = await client.query(
      'SELECT * FROM streams WHERE id = $1 AND creator_id = $2 AND status = $3',
      [streamId, creatorId, 'live']
    );
    
    if (streamQuery.rows.length === 0) {
      throw new Error('Active stream not found or you are not the creator');
    }
    
    // Check if show already announced for this stream
    const existingShow = await client.query(
      'SELECT * FROM ticketed_shows WHERE stream_id = $1 AND status IN ($2, $3)',
      [streamId, 'announced', 'started']
    );
    
    if (existingShow.rows.length > 0) {
      throw new Error('A ticketed show is already active for this stream');
    }
    
    // Create the ticketed show
    const show = await client.query(
      `INSERT INTO ticketed_shows (
        stream_id, creator_id, title, description, token_price, 
        status, start_time, max_tickets, early_bird_price, early_bird_deadline
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
      RETURNING *`,
      [
        streamId, creatorId, title || 'Private Show', description || '',
        tokenPrice, 'announced', startTime ? new Date(startTime) : null,
        maxTickets, earlyBirdPrice, earlyBirdDeadline ? new Date(earlyBirdDeadline) : null
      ]
    );
    
    await client.query('COMMIT');
    
    // Emit to all viewers in the stream
    const io = getIO();
    io.to(`stream:${streamId}`).emit('ticketed_show_announced', {
      showId: show.rows[0].id,
      title: show.rows[0].title,
      tokenPrice: show.rows[0].token_price,
      earlyBirdPrice: show.rows[0].early_bird_price,
      startTime: show.rows[0].start_time,
      maxTickets: show.rows[0].max_tickets
    });
    
    logger.info('Ticketed show announced', { 
      showId: show.rows[0].id, 
      creatorId, 
      streamId 
    });
    
    res.json({ 
      success: true, 
      show: show.rows[0] 
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error announcing ticketed show:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to announce ticketed show' 
    });
  } finally {
    client.release();
  }
});

// Buy a ticket for the show
router.post('/buy-ticket', authenticateToken, async (req, res) => {
  const { showId } = req.body;
  const viewerId = req.user.supabase_id;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get show details with lock
    const showQuery = await client.query(
      `SELECT ts.*, s.channel_id 
       FROM ticketed_shows ts
       JOIN streams s ON ts.stream_id = s.id
       WHERE ts.id = $1 AND ts.status IN ($2, $3) 
       FOR UPDATE`,
      [showId, 'announced', 'started']
    );
    
    if (showQuery.rows.length === 0) {
      throw new Error('Show not available for tickets');
    }
    
    const show = showQuery.rows[0];
    
    // Check if already has ticket
    const existingTicket = await client.query(
      'SELECT * FROM show_tickets WHERE show_id = $1 AND viewer_id = $2',
      [showId, viewerId]
    );
    
    if (existingTicket.rows.length > 0) {
      throw new Error('You already have a ticket for this show');
    }
    
    // Check ticket availability
    const availabilityQuery = await client.query(
      'SELECT check_ticket_availability($1) as available',
      [showId]
    );
    
    if (!availabilityQuery.rows[0].available) {
      throw new Error('Show is sold out');
    }
    
    // Get current ticket price (handles early bird)
    const priceQuery = await client.query(
      'SELECT get_current_ticket_price($1) as price',
      [showId]
    );
    
    const ticketPrice = priceQuery.rows[0].price;
    const purchaseType = show.early_bird_deadline && new Date() < new Date(show.early_bird_deadline) 
      ? 'early_bird' 
      : 'regular';
    
    // Check viewer's token balance
    const balanceQuery = await client.query(
      'SELECT token_balance FROM users WHERE supabase_id = $1 FOR UPDATE',
      [viewerId]
    );
    
    if (!balanceQuery.rows[0] || balanceQuery.rows[0].token_balance < ticketPrice) {
      throw new Error('Insufficient tokens');
    }
    
    // Deduct tokens from viewer
    await client.query(
      'UPDATE users SET token_balance = token_balance - $1 WHERE supabase_id = $2',
      [ticketPrice, viewerId]
    );
    
    // Add tokens to creator
    await client.query(
      'UPDATE users SET creator_token_balance = COALESCE(creator_token_balance, 0) + $1 WHERE supabase_id = $2',
      [ticketPrice, show.creator_id]
    );
    
    // Create ticket
    const ticket = await client.query(
      `INSERT INTO show_tickets (show_id, viewer_id, token_price, purchase_type)
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [showId, viewerId, ticketPrice, purchaseType]
    );
    
    // Log token transaction
    await client.query(
      `INSERT INTO token_transactions (user_id, type, amount, description, created_at)
       VALUES ($1, 'ticket_purchase', $2, $3, NOW())`,
      [viewerId, -ticketPrice, `Ticket for ${show.title}`]
    );
    
    await client.query(
      `INSERT INTO token_transactions (user_id, type, amount, description, created_at)
       VALUES ($1, 'ticket_sale', $2, $3, NOW())`,
      [show.creator_id, ticketPrice, `Ticket sale for ${show.title}`]
    );
    
    await client.query('COMMIT');
    
    // Emit socket events
    const io = getIO();
    
    // Notify viewer
    io.to(`user:${viewerId}`).emit('ticket_purchased', {
      showId,
      ticket: ticket.rows[0]
    });
    
    // Notify creator
    io.to(`user:${show.creator_id}`).emit('ticket_sold', {
      viewerId,
      showId,
      price: ticketPrice
    });
    
    // If show already started, allow immediate access
    if (show.status === 'started') {
      io.to(`user:${viewerId}`).emit('join_private_show', {
        showId,
        channelId: show.channel_id
      });
    }
    
    logger.info('Ticket purchased', { 
      showId, 
      viewerId, 
      price: ticketPrice 
    });
    
    res.json({ 
      success: true,
      ticket: ticket.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error buying ticket:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to buy ticket' 
    });
  } finally {
    client.release();
  }
});

// Start private mode for ticketed show
router.post('/start', authenticateToken, async (req, res) => {
  const { showId } = req.body;
  const creatorId = req.user.supabase_id;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get show details
    const showQuery = await client.query(
      `SELECT ts.*, s.channel_id, s.id as stream_id
       FROM ticketed_shows ts
       JOIN streams s ON ts.stream_id = s.id
       WHERE ts.id = $1 AND ts.creator_id = $2 AND ts.status = $3
       FOR UPDATE`,
      [showId, creatorId, 'announced']
    );
    
    if (showQuery.rows.length === 0) {
      throw new Error('Show not found or not in announced state');
    }
    
    const show = showQuery.rows[0];
    
    // Update show status
    await client.query(
      `UPDATE ticketed_shows 
       SET status = $1, private_mode = true, actual_start_time = NOW(), updated_at = NOW()
       WHERE id = $2`,
      ['started', showId]
    );
    
    // Get all ticket holders
    const tickets = await client.query(
      'SELECT viewer_id FROM show_tickets WHERE show_id = $1',
      [showId]
    );
    
    // Update ticket holders' join time
    await client.query(
      'UPDATE show_tickets SET joined_at = NOW() WHERE show_id = $1',
      [showId]
    );
    
    await client.query('COMMIT');
    
    // Emit socket events
    const io = getIO();
    
    // Notify all viewers in stream
    io.to(`stream:${show.stream_id}`).emit('private_mode_started', {
      showId,
      streamId: show.stream_id
    });
    
    // Notify ticket holders to enable video
    for (const ticket of tickets.rows) {
      io.to(`user:${ticket.viewer_id}`).emit('enable_private_video', {
        showId,
        channelId: show.channel_id
      });
    }
    
    // Create announcement
    await client.query(
      `INSERT INTO show_announcements (show_id, message, announcement_type)
       VALUES ($1, $2, $3)`,
      [showId, 'Private show has started!', 'started']
    );
    
    logger.info('Private show started', { 
      showId, 
      creatorId,
      ticketHolders: tickets.rows.length 
    });
    
    res.json({ 
      success: true,
      ticketHolders: tickets.rows.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error starting private show:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to start private show' 
    });
  } finally {
    client.release();
  }
});

// End private show
router.post('/end', authenticateToken, async (req, res) => {
  const { showId } = req.body;
  const creatorId = req.user.supabase_id;
  
  try {
    const result = await pool.query(
      `UPDATE ticketed_shows 
       SET status = $1, end_time = NOW(), updated_at = NOW()
       WHERE id = $2 AND creator_id = $3 AND status = $4
       RETURNING *`,
      ['ended', showId, creatorId, 'started']
    );
    
    if (result.rows.length === 0) {
      throw new Error('Show not found or not in started state');
    }
    
    // Calculate analytics
    const analytics = await pool.query(
      `INSERT INTO show_analytics (show_id, peak_viewers, chat_messages_count)
       VALUES ($1, 
         (SELECT COUNT(*) FROM show_tickets WHERE show_id = $1),
         0
       )`,
      [showId]
    );
    
    // Emit socket event
    const io = getIO();
    io.to(`stream:${result.rows[0].stream_id}`).emit('private_show_ended', {
      showId
    });
    
    logger.info('Private show ended', { showId, creatorId });
    
    res.json({ 
      success: true,
      show: result.rows[0]
    });
  } catch (error) {
    logger.error('Error ending private show:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to end private show' 
    });
  }
});

// Get show details and ticket status
router.get('/:showId/details', authenticateToken, async (req, res) => {
  const { showId } = req.params;
  const viewerId = req.user.supabase_id;
  
  try {
    // Get show details
    const showQuery = await pool.query(
      `SELECT ts.*, 
         u.display_name as creator_name,
         u.profile_pic_url as creator_avatar,
         get_current_ticket_price(ts.id) as current_price,
         check_ticket_availability(ts.id) as tickets_available
       FROM ticketed_shows ts
       JOIN users u ON ts.creator_id = u.supabase_id
       WHERE ts.id = $1`,
      [showId]
    );
    
    if (showQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Show not found' });
    }
    
    // Check if user has ticket
    const ticketQuery = await pool.query(
      'SELECT * FROM show_tickets WHERE show_id = $1 AND viewer_id = $2',
      [showId, viewerId]
    );
    
    // Get ticket count
    const ticketCount = await pool.query(
      'SELECT COUNT(*) as count FROM show_tickets WHERE show_id = $1',
      [showId]
    );
    
    res.json({
      success: true,
      show: showQuery.rows[0],
      hasTicket: ticketQuery.rows.length > 0,
      ticket: ticketQuery.rows[0] || null,
      ticketsSold: parseInt(ticketCount.rows[0].count)
    });
  } catch (error) {
    logger.error('Error fetching show details:', error);
    res.status(500).json({ 
      error: 'Failed to fetch show details' 
    });
  }
});

// Get analytics for creator
router.get('/:showId/analytics', authenticateToken, async (req, res) => {
  const { showId } = req.params;
  const creatorId = req.user.supabase_id;
  
  try {
    // Verify creator owns the show
    const showQuery = await pool.query(
      'SELECT * FROM ticketed_shows WHERE id = $1 AND creator_id = $2',
      [showId, creatorId]
    );
    
    if (showQuery.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Get detailed analytics
    const analytics = await pool.query(
      `SELECT 
         ts.*,
         COUNT(DISTINCT st.viewer_id) as total_buyers,
         SUM(st.token_price) as total_revenue,
         AVG(st.watch_duration) as avg_watch_time,
         COUNT(CASE WHEN st.purchase_type = 'early_bird' THEN 1 END) as early_bird_sales,
         COUNT(CASE WHEN st.purchase_type = 'gift' THEN 1 END) as gifted_tickets,
         json_agg(
           json_build_object(
             'viewer_id', st.viewer_id,
             'purchase_time', st.purchased_at,
             'price_paid', st.token_price,
             'type', st.purchase_type
           ) ORDER BY st.purchased_at DESC
         ) as buyers
       FROM ticketed_shows ts
       LEFT JOIN show_tickets st ON ts.id = st.show_id
       WHERE ts.id = $1
       GROUP BY ts.id`,
      [showId]
    );
    
    res.json({
      success: true,
      analytics: analytics.rows[0]
    });
  } catch (error) {
    logger.error('Error fetching show analytics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch analytics' 
    });
  }
});

// Check if stream has active ticketed show
router.get('/stream/:streamId/active', authenticateToken, async (req, res) => {
  const { streamId } = req.params;
  
  try {
    const show = await pool.query(
      `SELECT * FROM ticketed_shows 
       WHERE stream_id = $1 AND status IN ('announced', 'started')`,
      [streamId]
    );
    
    res.json({
      hasActiveShow: show.rows.length > 0,
      show: show.rows[0] || null
    });
  } catch (error) {
    logger.error('Error checking active show:', error);
    res.status(500).json({ 
      error: 'Failed to check active show' 
    });
  }
});

module.exports = router;