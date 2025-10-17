const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const { publishToChannel } = require('../utils/ably-adapter');
// Socket.io removed - using Ably
// const { getIO } = require('../utils/socket');

// Create poll
router.post('/poll', authenticateToken, async (req, res) => {
  try {
    const { channel, question, options, duration = 60 } = req.body;
    const creatorId = req.user.supabase_id;
    
    // Verify user is the stream creator
    const authCheck = await db.query(
      'SELECT is_creator FROM users WHERE supabase_id = $1',
      [creatorId]
    );
    
    if (!authCheck.rows[0]?.is_creator) {
      return res.status(403).json({ error: 'Only creators can create polls' });
    }
    
    // Create poll
    const pollResult = await db.query(
      `INSERT INTO stream_polls (channel, creator_id, question, options, duration, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '%s seconds', NOW())
       RETURNING *`,
      [channel, creatorId, question, JSON.stringify(options), duration, duration]
    );
    
    const poll = pollResult.rows[0];
    
    // Initialize vote counts
    const votes = {};
    options.forEach((opt, idx) => {
      votes[idx] = 0;
    });
    
    poll.votes = votes;
    poll.totalVotes = 0;

    // Emit poll to stream
    try {
      await publishToChannel(`stream:${channel}`, 'poll-created', {
        poll
      });
    } catch (ablyError) {
      console.error('Failed to publish poll-created to Ably:', ablyError.message);
    }

    // Set timer to close poll
    setTimeout(async () => {
      await db.query(
        'UPDATE stream_polls SET is_active = false WHERE id = $1',
        [poll.id]
      );

      try {
        await publishToChannel(`stream:${channel}`, 'poll-ended', {
          pollId: poll.id
        });
      } catch (ablyError) {
        console.error('Failed to publish poll-ended to Ably:', ablyError.message);
      }
    }, duration * 1000);
    
    res.json({ success: true, poll });
  } catch (error) {
    console.error('Error creating poll:', error);
    res.status(500).json({ error: 'Failed to create poll' });
  }
});

// Vote on poll
router.post('/poll/:pollId/vote', authenticateToken, async (req, res) => {
  const client = await db.connect();
  
  try {
    const { pollId } = req.params;
    const { optionIndex } = req.body;
    const userId = req.user.supabase_id;
    
    await client.query('BEGIN');
    
    // Check if poll exists and is active
    const pollResult = await client.query(
      'SELECT * FROM stream_polls WHERE id = $1 AND is_active = true FOR UPDATE',
      [pollId]
    );
    
    if (pollResult.rows.length === 0) {
      throw new Error('Poll not found or expired');
    }
    
    const poll = pollResult.rows[0];
    
    // Check if user already voted
    const voteCheck = await client.query(
      'SELECT id FROM poll_votes WHERE poll_id = $1 AND user_id = $2',
      [pollId, userId]
    );
    
    if (voteCheck.rows.length > 0) {
      throw new Error('Already voted');
    }
    
    // Record vote
    await client.query(
      'INSERT INTO poll_votes (poll_id, user_id, option_index) VALUES ($1, $2, $3)',
      [pollId, userId, optionIndex]
    );
    
    // Update vote counts
    const voteCounts = await client.query(
      'SELECT option_index, COUNT(*) as count FROM poll_votes WHERE poll_id = $1 GROUP BY option_index',
      [pollId]
    );
    
    await client.query('COMMIT');
    
    // Prepare vote data
    const votes = {};
    const options = JSON.parse(poll.options);
    options.forEach((_, idx) => {
      votes[idx] = 0;
    });
    
    let totalVotes = 0;
    voteCounts.rows.forEach(row => {
      votes[row.option_index] = parseInt(row.count);
      totalVotes += parseInt(row.count);
    });
    
    // Emit vote update
    try {
      await publishToChannel(`stream:${poll.channel}`, 'poll-update', {
        pollId,
        votes,
        totalVotes
      });
    } catch (ablyError) {
      console.error('Failed to publish poll-update to Ably:', ablyError.message);
    }

    res.json({ success: true, votes, totalVotes });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error voting:', error);
    res.status(500).json({ error: error.message || 'Failed to vote' });
  } finally {
    client.release();
  }
});

// Send virtual gift
router.post('/gift', authenticateToken, async (req, res) => {
  const client = await db.connect();
  
  try {
    const { channel, creatorId, giftType, quantity = 1 } = req.body;
    const senderId = req.user.supabase_id;
    
    await client.query('BEGIN');
    
    // Gift prices (in tokens)
    const giftPrices = {
      heart: 1,
      rose: 5,
      diamond: 10,
      crown: 25,
      rocket: 50,
      mansion: 100
    };
    
    const price = giftPrices[giftType] || 1;
    const totalCost = price * quantity;
    
    // Check sender balance
    const balanceResult = await client.query(
      'SELECT token_balance FROM users WHERE supabase_id = $1 FOR UPDATE',
      [senderId]
    );
    
    if (balanceResult.rows[0].token_balance < totalCost) {
      throw new Error('Insufficient tokens');
    }
    
    // Deduct from sender
    await client.query(
      'UPDATE users SET token_balance = token_balance - $1 WHERE supabase_id = $2',
      [totalCost, senderId]
    );
    
    // Add to creator (80% after platform fee)
    const creatorAmount = Math.floor(totalCost * 0.8);
    await client.query(
      'UPDATE users SET token_balance = token_balance + $1 WHERE supabase_id = $2',
      [creatorAmount, creatorId]
    );
    
    // Record transaction
    await client.query(
      `INSERT INTO gift_transactions (sender_id, recipient_id, channel, gift_type, quantity, tokens_spent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [senderId, creatorId, channel, giftType, quantity, totalCost]
    );
    
    // Update stream analytics
    await client.query(
      `UPDATE stream_analytics 
       SET gifts_received = gifts_received + $1,
           gift_revenue = gift_revenue + $2
       WHERE channel = $3`,
      [quantity, creatorAmount, channel]
    );
    
    await client.query('COMMIT');
    
    // Get sender info
    const senderResult = await db.query(
      'SELECT display_name, profile_pic_url FROM users WHERE supabase_id = $1',
      [senderId]
    );

    // Emit gift animation
    try {
      await publishToChannel(`stream:${channel}`, 'gift-received', {
        sender: senderResult.rows[0].display_name,
        giftType,
        quantity,
        totalValue: totalCost
      });
    } catch (ablyError) {
      console.error('Failed to publish gift-received to Ably:', ablyError.message);
    }

    // Notify creator
    try {
      await publishToChannel(`user:${creatorId}`, 'gift-notification', {
        sender: senderResult.rows[0].display_name,
        giftType,
        quantity,
        earnings: creatorAmount
      });
    } catch (ablyError) {
      console.error('Failed to publish gift-notification to Ably:', ablyError.message);
    }

    res.json({ 
      success: true,
      newBalance: balanceResult.rows[0].token_balance - totalCost
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error sending gift:', error);
    res.status(500).json({ error: error.message || 'Failed to send gift' });
  } finally {
    client.release();
  }
});

// Send tip
router.post('/tip', authenticateToken, async (req, res) => {
  const client = await db.connect();
  
  try {
    const { channel, creatorId, amount, message } = req.body;
    const senderId = req.user.supabase_id;
    
    if (amount < 1) {
      return res.status(400).json({ error: 'Minimum tip is 1 token' });
    }
    
    await client.query('BEGIN');
    
    // Check sender balance
    const balanceResult = await client.query(
      'SELECT token_balance FROM users WHERE supabase_id = $1 FOR UPDATE',
      [senderId]
    );
    
    if (balanceResult.rows[0].token_balance < amount) {
      throw new Error('Insufficient tokens');
    }
    
    // Deduct from sender
    await client.query(
      'UPDATE users SET token_balance = token_balance - $1 WHERE supabase_id = $2',
      [amount, senderId]
    );
    
    // Add to creator (90% for tips)
    const creatorAmount = Math.floor(amount * 0.9);
    await client.query(
      'UPDATE users SET token_balance = token_balance + $1 WHERE supabase_id = $2',
      [creatorAmount, creatorId]
    );
    
    // Record transaction
    await client.query(
      `INSERT INTO tip_transactions (sender_id, recipient_id, channel, amount, message, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [senderId, creatorId, channel, amount, message]
    );
    
    // Update stream analytics
    await client.query(
      `UPDATE stream_analytics 
       SET tips_received = tips_received + 1,
           tip_revenue = tip_revenue + $1
       WHERE channel = $2`,
      [creatorAmount, channel]
    );
    
    await client.query('COMMIT');
    
    // Get sender info
    const senderResult = await db.query(
      'SELECT display_name, profile_pic_url FROM users WHERE supabase_id = $1',
      [senderId]
    );

    // Emit tip notification
    try {
      await publishToChannel(`stream:${channel}`, 'tip-received', {
        sender: senderResult.rows[0].display_name,
        amount,
        message
      });
    } catch (ablyError) {
      console.error('Failed to publish tip-received to Ably:', ablyError.message);
    }

    // Notify creator
    try {
      await publishToChannel(`user:${creatorId}`, 'tip-notification', {
        sender: senderResult.rows[0].display_name,
        amount,
        message,
        earnings: creatorAmount
      });
    } catch (ablyError) {
      console.error('Failed to publish tip-notification to Ably:', ablyError.message);
    }

    res.json({ 
      success: true,
      newBalance: balanceResult.rows[0].token_balance - amount
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error sending tip:', error);
    res.status(500).json({ error: error.message || 'Failed to send tip' });
  } finally {
    client.release();
  }
});

// Get stream analytics
router.get('/analytics/:channel', authenticateToken, async (req, res) => {
  try {
    const { channel } = req.params;
    const userId = req.user.supabase_id;
    
    // Check if user is the stream creator
    const authCheck = await db.query(
      `SELECT 1 FROM streams 
       WHERE channel = $1 AND creator_id = $2`,
      [channel, userId]
    );
    
    if (authCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized to view analytics' });
    }
    
    // Get or create analytics
    let analyticsResult = await db.query(
      'SELECT * FROM stream_analytics WHERE channel = $1',
      [channel]
    );
    
    if (analyticsResult.rows.length === 0) {
      // Create default analytics
      analyticsResult = await db.query(
        `INSERT INTO stream_analytics 
         (channel, viewer_count, peak_viewers, messages_sent, gifts_received, 
          gift_revenue, tips_received, tip_revenue, new_followers, engagement_rate)
         VALUES ($1, 0, 0, 0, 0, 0, 0, 0, 0, 0)
         RETURNING *`,
        [channel]
      );
    }
    
    const analytics = analyticsResult.rows[0];
    
    // Get activity feed
    const activityResult = await db.query(
      `SELECT 'gift' as type, sender_id, gift_type as detail, tokens_spent as value, created_at
       FROM gift_transactions 
       WHERE channel = $1
       UNION ALL
       SELECT 'tip' as type, sender_id, message as detail, amount as value, created_at
       FROM tip_transactions
       WHERE channel = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [channel]
    );
    
    res.json({
      success: true,
      analytics,
      activity: activityResult.rows
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;