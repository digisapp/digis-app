const express = require('express');
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const { publishToChannel } = require('../utils/ably-adapter');
const router = express.Router();

// Middleware
router.use(authenticateToken);

/**
 * Create a new poll
 * POST /api/polls/create
 */
router.post('/create', async (req, res) => {
  try {
    const { channelId, question, options, duration = 300 } = req.body;
    const creatorId = req.user.supabase_id;

    // Validate input
    if (!channelId || !question || !options || options.length < 2) {
      return res.status(400).json({ 
        error: 'Invalid poll data. Need channelId, question, and at least 2 options' 
      });
    }

    // Verify creator owns the stream
    const streamQuery = await pool.query(
      'SELECT stream_id FROM streams WHERE stream_id = $1 AND creator_id = $2 AND status = $3',
      [channelId, creatorId, 'live']
    );

    if (streamQuery.rows.length === 0) {
      return res.status(403).json({ error: 'Stream not found or you are not the creator' });
    }

    const pollId = uuidv4();
    const expiresAt = new Date(Date.now() + duration * 1000);

    // Create poll
    const pollQuery = await pool.query(
      `INSERT INTO polls (poll_id, creator_id, channel_id, question, options, duration, expires_at, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW())
       RETURNING *`,
      [pollId, creatorId, channelId, question, JSON.stringify(options), duration, expiresAt]
    );

    const poll = {
      ...pollQuery.rows[0],
      options: options.map((opt, index) => ({
        id: index,
        text: opt,
        votes: 0
      })),
      totalVotes: 0
    };

    // Emit to stream viewers via WebSocket
    const io = req.app.get('io');
    if (io) {
try {
  await publishToChannel(`stream:${channelId}`, 'poll_created', {
    poll,
    channelId
  });
} catch (ablyError) {
  logger.error('Failed to publish poll_created to Ably:', ablyError.message);
}
    }

    res.json({ success: true, poll });
  } catch (error) {
    console.error('Error creating poll:', error);
    res.status(500).json({ error: 'Failed to create poll' });
  }
});

/**
 * Vote on a poll
 * POST /api/polls/vote
 */
router.post('/vote', async (req, res) => {
  try {
    const { pollId, optionIndex } = req.body;
    const userId = req.user.supabase_id;

    // Validate input
    if (!pollId || optionIndex === undefined || optionIndex < 0) {
      return res.status(400).json({ error: 'Invalid vote data' });
    }

    // Check if already voted
    const existingVote = await pool.query(
      'SELECT * FROM poll_votes WHERE poll_id = $1 AND user_id = $2',
      [pollId, userId]
    );

    if (existingVote.rows.length > 0) {
      return res.status(400).json({ error: 'Already voted on this poll' });
    }

    // Check if poll is active
    const poll = await pool.query(
      'SELECT * FROM polls WHERE poll_id = $1 AND status = $2',
      [pollId, 'active']
    );

    if (poll.rows.length === 0) {
      return res.status(404).json({ error: 'Poll not found or already closed' });
    }

    // Check if poll expired
    if (new Date(poll.rows[0].expires_at) < new Date()) {
      await pool.query(
        'UPDATE polls SET status = $1 WHERE poll_id = $2',
        ['expired', pollId]
      );
      return res.status(400).json({ error: 'Poll has expired' });
    }

    // Validate option index
    const options = poll.rows[0].options;
    if (optionIndex >= options.length) {
      return res.status(400).json({ error: 'Invalid option index' });
    }

    // Record vote
    await pool.query(
      `INSERT INTO poll_votes (poll_id, user_id, option_index, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [pollId, userId, optionIndex]
    );

    // Get updated vote counts
    const votesQuery = await pool.query(
      `SELECT option_index, COUNT(*) as votes
       FROM poll_votes
       WHERE poll_id = $1
       GROUP BY option_index`,
      [pollId]
    );

    const totalVotes = votesQuery.rows.reduce((sum, row) => sum + parseInt(row.votes), 0);
    const results = options.map((opt, index) => ({
      id: index,
      text: opt,
      votes: parseInt(votesQuery.rows.find(v => v.option_index === index)?.votes || 0)
    }));

    // Update poll results (trigger will handle this too)
    await pool.query(
      'UPDATE polls SET total_votes = $1, results = $2 WHERE poll_id = $3',
      [totalVotes, JSON.stringify(votesQuery.rows), pollId]
    );

    // Emit update to stream viewers
    const io = req.app.get('io');
    if (io) {
try {
  await publishToChannel(`stream:${poll.rows[0].channel_id}`, 'poll_updated', {
    pollId,
    results,
    totalVotes
  });
} catch (ablyError) {
  logger.error('Failed to publish poll_updated to Ably:', ablyError.message);
}
    }

    res.json({ success: true, results, totalVotes });
  } catch (error) {
    console.error('Error voting:', error);
    res.status(500).json({ error: 'Failed to record vote' });
  }
});

/**
 * End a poll manually
 * POST /api/polls/end
 */
router.post('/end', async (req, res) => {
  try {
    const { pollId } = req.body;
    const creatorId = req.user.supabase_id;

    // Verify creator owns the poll
    const poll = await pool.query(
      'SELECT * FROM polls WHERE poll_id = $1 AND creator_id = $2 AND status = $3',
      [pollId, creatorId, 'active']
    );

    if (poll.rows.length === 0) {
      return res.status(404).json({ error: 'Poll not found or not authorized' });
    }

    // Close the poll
    await pool.query(
      'UPDATE polls SET status = $1, updated_at = NOW() WHERE poll_id = $2',
      ['closed', pollId]
    );

    // Get final results
    const votesQuery = await pool.query(
      `SELECT option_index, COUNT(*) as votes
       FROM poll_votes
       WHERE poll_id = $1
       GROUP BY option_index`,
      [pollId]
    );

    const totalVotes = votesQuery.rows.reduce((sum, row) => sum + parseInt(row.votes), 0);
    const options = poll.rows[0].options;
    const finalResults = options.map((opt, index) => ({
      id: index,
      text: opt,
      votes: parseInt(votesQuery.rows.find(v => v.option_index === index)?.votes || 0)
    }));

    // Emit close event
    const io = req.app.get('io');
    if (io) {
try {
  await publishToChannel(`stream:${poll.rows[0].channel_id}`, 'poll_closed', {
    pollId,
    finalResults,
    totalVotes
  });
} catch (ablyError) {
  logger.error('Failed to publish poll_closed to Ably:', ablyError.message);
}
    }

    res.json({ success: true, finalResults, totalVotes });
  } catch (error) {
    console.error('Error ending poll:', error);
    res.status(500).json({ error: 'Failed to end poll' });
  }
});

/**
 * Get active polls for a stream
 * GET /api/polls/stream/:streamId
 */
router.get('/stream/:streamId', async (req, res) => {
  try {
    const { streamId } = req.params;

    const pollsQuery = await pool.query(
      `SELECT p.*, 
              (SELECT COUNT(*) FROM poll_votes pv WHERE pv.poll_id = p.poll_id) as total_votes,
              (SELECT COUNT(*) FROM poll_votes pv WHERE pv.poll_id = p.poll_id AND pv.user_id = $1) as user_voted
       FROM polls p
       WHERE p.channel_id = $2 
       AND p.status = 'active'
       ORDER BY p.created_at DESC`,
      [req.user.supabase_id, streamId]
    );

    // Format polls with vote counts
    const polls = await Promise.all(pollsQuery.rows.map(async (poll) => {
      const votesQuery = await pool.query(
        `SELECT option_index, COUNT(*) as votes
         FROM poll_votes
         WHERE poll_id = $1
         GROUP BY option_index`,
        [poll.poll_id]
      );

      const options = poll.options.map((opt, index) => ({
        id: index,
        text: opt,
        votes: parseInt(votesQuery.rows.find(v => v.option_index === index)?.votes || 0)
      }));

      return {
        ...poll,
        options,
        hasVoted: poll.user_voted > 0
      };
    }));

    res.json({ success: true, polls });
  } catch (error) {
    console.error('Error fetching polls:', error);
    res.status(500).json({ error: 'Failed to fetch polls' });
  }
});

/**
 * Get poll results
 * GET /api/polls/:pollId/results
 */
router.get('/:pollId/results', async (req, res) => {
  try {
    const { pollId } = req.params;

    const pollQuery = await pool.query(
      'SELECT * FROM polls WHERE poll_id = $1',
      [pollId]
    );

    if (pollQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    const poll = pollQuery.rows[0];

    // Get vote counts
    const votesQuery = await pool.query(
      `SELECT option_index, COUNT(*) as votes
       FROM poll_votes
       WHERE poll_id = $1
       GROUP BY option_index`,
      [pollId]
    );

    const totalVotes = votesQuery.rows.reduce((sum, row) => sum + parseInt(row.votes), 0);
    const results = poll.options.map((opt, index) => ({
      id: index,
      text: opt,
      votes: parseInt(votesQuery.rows.find(v => v.option_index === index)?.votes || 0),
      percentage: totalVotes > 0 ? 
        Math.round((parseInt(votesQuery.rows.find(v => v.option_index === index)?.votes || 0) / totalVotes) * 100) : 0
    }));

    // Check if user voted
    const userVoteQuery = await pool.query(
      'SELECT option_index FROM poll_votes WHERE poll_id = $1 AND user_id = $2',
      [pollId, req.user.supabase_id]
    );

    res.json({ 
      success: true, 
      poll: {
        ...poll,
        results,
        totalVotes,
        hasVoted: userVoteQuery.rows.length > 0,
        userVote: userVoteQuery.rows[0]?.option_index
      }
    });
  } catch (error) {
    console.error('Error fetching poll results:', error);
    res.status(500).json({ error: 'Failed to fetch poll results' });
  }
});

module.exports = router;