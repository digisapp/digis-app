const express = require('express');
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Middleware
router.use(authenticateToken);

/**
 * Get questions for a channel
 * GET /api/questions/:channelId
 */
router.get('/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user.supabase_id;

    // Get questions with vote counts and user's vote
    const questionsQuery = await pool.query(
      `SELECT 
        q.*,
        u.username as user_name,
        u.profile_pic_url as user_avatar,
        COALESCE(
          (SELECT vote_type FROM question_votes 
           WHERE question_id = q.question_id AND user_id = $1),
          'none'
        ) as user_vote,
        (SELECT COUNT(*) FROM question_votes 
         WHERE question_id = q.question_id AND vote_type = 'up') as upvote_count,
        (SELECT COUNT(*) FROM question_votes 
         WHERE question_id = q.question_id AND vote_type = 'down') as downvote_count
       FROM questions q
       JOIN users u ON q.user_id = u.supabase_id
       WHERE q.channel_id = $2
       ORDER BY 
         CASE WHEN q.priority = 'featured' THEN 0
              WHEN q.priority = 'high' THEN 1
              WHEN q.priority = 'normal' THEN 2
              ELSE 3 END,
         q.upvotes DESC,
         q.created_at ASC`,
      [userId, channelId]
    );

    const questions = questionsQuery.rows.map(q => ({
      ...q,
      votes: q.upvote_count - q.downvote_count,
      userVote: q.user_vote
    }));

    res.json({ success: true, questions });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

/**
 * Submit a question
 * POST /api/questions/submit
 */
router.post('/submit', async (req, res) => {
  try {
    const { channelId, question } = req.body;
    const userId = req.user.supabase_id;

    // Validate input
    if (!channelId || !question || question.trim().length < 5) {
      return res.status(400).json({ 
        error: 'Question must be at least 5 characters long' 
      });
    }

    // Verify stream exists and is live
    const streamQuery = await pool.query(
      'SELECT creator_id FROM streams WHERE stream_id = $1 AND status = $2',
      [channelId, 'live']
    );

    if (streamQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Stream not found or not live' });
    }

    const creatorId = streamQuery.rows[0].creator_id;
    const questionId = uuidv4();

    // Create question
    const questionQuery = await pool.query(
      `INSERT INTO questions 
       (question_id, user_id, channel_id, creator_id, question, status, priority, created_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', 'normal', NOW())
       RETURNING *`,
      [questionId, userId, channelId, creatorId, question.trim()]
    );

    // Get user info for the response
    const userQuery = await pool.query(
      'SELECT username, profile_pic_url FROM users WHERE supabase_id = $1',
      [userId]
    );

    const newQuestion = {
      ...questionQuery.rows[0],
      user_name: userQuery.rows[0].username,
      user_avatar: userQuery.rows[0].profile_pic_url,
      votes: 0,
      userVote: 'none'
    };

    // Emit to stream
    const io = req.app.get('io');
    if (io) {
// TODO: Replace with Ably publish
//       io.to(`stream:${channelId}`).emit('question_submitted', newQuestion);
    }

    res.json({ success: true, question: newQuestion });
  } catch (error) {
    console.error('Error submitting question:', error);
    res.status(500).json({ error: 'Failed to submit question' });
  }
});

/**
 * Vote on a question
 * POST /api/questions/vote
 */
router.post('/vote', async (req, res) => {
  try {
    const { questionId, voteType } = req.body;
    const userId = req.user.supabase_id;

    // Validate vote type
    if (!['up', 'down'].includes(voteType)) {
      return res.status(400).json({ error: 'Invalid vote type' });
    }

    // Check if question exists
    const questionQuery = await pool.query(
      'SELECT channel_id FROM questions WHERE question_id = $1',
      [questionId]
    );

    if (questionQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const channelId = questionQuery.rows[0].channel_id;

    // Check existing vote
    const existingVoteQuery = await pool.query(
      'SELECT vote_type FROM question_votes WHERE question_id = $1 AND user_id = $2',
      [questionId, userId]
    );

    if (existingVoteQuery.rows.length > 0) {
      const existingVote = existingVoteQuery.rows[0].vote_type;
      
      if (existingVote === voteType) {
        // Remove vote if clicking the same type
        await pool.query(
          'DELETE FROM question_votes WHERE question_id = $1 AND user_id = $2',
          [questionId, userId]
        );
      } else {
        // Update vote
        await pool.query(
          'UPDATE question_votes SET vote_type = $1 WHERE question_id = $2 AND user_id = $3',
          [voteType, questionId, userId]
        );
      }
    } else {
      // Insert new vote
      await pool.query(
        'INSERT INTO question_votes (question_id, user_id, vote_type, created_at) VALUES ($1, $2, $3, NOW())',
        [questionId, userId, voteType]
      );
    }

    // Get updated vote counts (trigger will update the question table)
    const votesQuery = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM question_votes WHERE question_id = $1 AND vote_type = 'up') as upvotes,
        (SELECT COUNT(*) FROM question_votes WHERE question_id = $1 AND vote_type = 'down') as downvotes`,
      [questionId]
    );

    const votes = votesQuery.rows[0].upvotes - votesQuery.rows[0].downvotes;

    // Emit update
    const io = req.app.get('io');
    if (io) {
// TODO: Replace with Ably publish
//       io.to(`stream:${channelId}`).emit('question_vote_updated', {
        questionId,
        votes,
        upvotes: votesQuery.rows[0].upvotes,
        downvotes: votesQuery.rows[0].downvotes
      });
    }

    res.json({ success: true, votes });
  } catch (error) {
    console.error('Error voting on question:', error);
    res.status(500).json({ error: 'Failed to vote' });
  }
});

/**
 * Answer a question (creator only)
 * POST /api/questions/answer
 */
router.post('/answer', async (req, res) => {
  try {
    const { questionId } = req.body;
    const creatorId = req.user.supabase_id;

    // Verify creator owns the question
    const question = await pool.query(
      'SELECT * FROM questions WHERE question_id = $1 AND creator_id = $2',
      [questionId, creatorId]
    );

    if (question.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found or not authorized' });
    }

    // Mark as answered
    await pool.query(
      'UPDATE questions SET status = $1, answered_at = NOW(), updated_at = NOW() WHERE question_id = $2',
      ['answered', questionId]
    );

    // Emit update
    const io = req.app.get('io');
    if (io) {
// TODO: Replace with Ably publish
//       io.to(`stream:${question.rows[0].channel_id}`).emit('question_answered', {
        questionId,
        answeredAt: new Date()
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error answering question:', error);
    res.status(500).json({ error: 'Failed to answer question' });
  }
});

/**
 * Feature/prioritize a question (creator only)
 * POST /api/questions/prioritize
 */
router.post('/prioritize', async (req, res) => {
  try {
    const { questionId, priority } = req.body;
    const creatorId = req.user.supabase_id;

    // Validate priority
    if (!['low', 'normal', 'high', 'featured'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority level' });
    }

    // Verify creator owns the question
    const question = await pool.query(
      'SELECT channel_id FROM questions WHERE question_id = $1 AND creator_id = $2',
      [questionId, creatorId]
    );

    if (question.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found or not authorized' });
    }

    // Update priority
    await pool.query(
      'UPDATE questions SET priority = $1, updated_at = NOW() WHERE question_id = $2',
      [priority, questionId]
    );

    // Emit update
    const io = req.app.get('io');
    if (io) {
// TODO: Replace with Ably publish
//       io.to(`stream:${question.rows[0].channel_id}`).emit('question_prioritized', {
        questionId,
        priority
      });
    }

    res.json({ success: true, priority });
  } catch (error) {
    console.error('Error prioritizing question:', error);
    res.status(500).json({ error: 'Failed to prioritize question' });
  }
});

/**
 * Delete/ignore a question (creator only)
 * DELETE /api/questions/:questionId
 */
router.delete('/:questionId', async (req, res) => {
  try {
    const { questionId } = req.params;
    const creatorId = req.user.supabase_id;

    // Verify creator owns the question
    const question = await pool.query(
      'SELECT channel_id FROM questions WHERE question_id = $1 AND creator_id = $2',
      [questionId, creatorId]
    );

    if (question.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found or not authorized' });
    }

    // Mark as ignored
    await pool.query(
      'UPDATE questions SET status = $1, updated_at = NOW() WHERE question_id = $2',
      ['ignored', questionId]
    );

    // Emit removal
    const io = req.app.get('io');
    if (io) {
// TODO: Replace with Ably publish
//       io.to(`stream:${question.rows[0].channel_id}`).emit('question_removed', {
        questionId
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

/**
 * Get top questions for a stream (public endpoint for viewers)
 * GET /api/questions/top/:channelId
 */
router.get('/top/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    const questionsQuery = await pool.query(
      `SELECT 
        q.*,
        u.username as user_name,
        u.profile_pic_url as user_avatar
       FROM questions q
       JOIN users u ON q.user_id = u.supabase_id
       WHERE q.channel_id = $1 
       AND q.status IN ('pending', 'featured')
       ORDER BY 
         CASE WHEN q.priority = 'featured' THEN 0 ELSE 1 END,
         q.upvotes DESC,
         q.created_at ASC
       LIMIT $2`,
      [channelId, limit]
    );

    res.json({ 
      success: true, 
      questions: questionsQuery.rows 
    });
  } catch (error) {
    console.error('Error fetching top questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

module.exports = router;