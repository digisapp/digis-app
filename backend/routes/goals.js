const express = require('express');
// Supabase removed - using Supabase
const { Pool } = require('pg');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Create or update stream goal
router.post('/stream/:streamId', authenticateToken, async (req, res) => {
  try {
    const { streamId } = req.params;
    const { goalAmount, description, category = 'tokens' } = req.body;
    const creatorId = req.user.supabase_id;

    if (!goalAmount || goalAmount <= 0) {
      return res.status(400).json({ error: 'Valid goal amount is required' });
    }

    // Verify user is creator of the stream
    const streamQuery = await pool.query(
      'SELECT creator_id FROM sessions WHERE id = $1 AND status = $2',
      [streamId, 'active']
    );

    if (streamQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Active stream not found' });
    }

    const streamCreatorId = streamQuery.rows[0].creator_id;
    if (streamCreatorId !== creatorId) {
      return res.status(403).json({ error: 'Not authorized to modify this stream goal' });
    }

    // Upsert goal
    const goalQuery = await pool.query(`
      INSERT INTO stream_goals (stream_id, creator_id, goal_amount, description, category, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (stream_id) 
      DO UPDATE SET 
        goal_amount = EXCLUDED.goal_amount,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        updated_at = NOW()
      RETURNING *
    `, [streamId, creatorId, goalAmount, description, category]);

    const goal = goalQuery.rows[0];

    // Get current progress
    const progressQuery = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as current_amount
      FROM token_transactions 
      WHERE session_id = $1 AND type = 'tip' AND status = 'completed'
    `, [streamId]);

    const currentAmount = parseFloat(progressQuery.rows[0].current_amount) || 0;

    // Broadcast goal update to stream viewers
    const io = req.app.get('io');
    if (io) {
// TODO: Replace with Ably publish
//       io.to(`stream_${streamId}`).emit('goalUpdated', {
        goal: {
          id: goal.id,
          goalAmount: parseFloat(goal.goal_amount),
          currentAmount,
          description: goal.description,
          category: goal.category,
          progressPercentage: Math.min((currentAmount / parseFloat(goal.goal_amount)) * 100, 100),
          isReached: currentAmount >= parseFloat(goal.goal_amount)
        }
      });
    }

    res.json({
      success: true,
      goal: {
        id: goal.id,
        streamId: goal.stream_id,
        goalAmount: parseFloat(goal.goal_amount),
        currentAmount,
        description: goal.description,
        category: goal.category,
        progressPercentage: Math.min((currentAmount / parseFloat(goal.goal_amount)) * 100, 100),
        isReached: currentAmount >= parseFloat(goal.goal_amount),
        createdAt: goal.created_at,
        updatedAt: goal.updated_at
      }
    });

  } catch (error) {
    console.error('❌ Error creating/updating stream goal:', error);
    res.status(500).json({ error: 'Failed to create/update stream goal' });
  }
});

// Get stream goal and progress
router.get('/stream/:streamId', authenticateToken, async (req, res) => {
  try {
    const { streamId } = req.params;

    // Get goal
    const goalQuery = await pool.query(
      'SELECT * FROM stream_goals WHERE stream_id = $1',
      [streamId]
    );

    if (goalQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found for this stream' });
    }

    const goal = goalQuery.rows[0];

    // Get current progress
    const progressQuery = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as current_amount,
             COUNT(*) as tip_count
      FROM token_transactions 
      WHERE session_id = $1 AND type = 'tip' AND status = 'completed'
    `, [streamId]);

    const progress = progressQuery.rows[0];
    const currentAmount = parseFloat(progress.current_amount) || 0;
    const tipCount = parseInt(progress.tip_count) || 0;

    // Get recent tips for goal progress
    const recentTipsQuery = await pool.query(`
      SELECT tt.amount, tt.created_at, u.username, u.profile_pic_url
      FROM token_transactions tt
      JOIN users u ON tt.user_id::text = u.id::text
      WHERE tt.session_id = $1 AND tt.type = 'tip' AND tt.status = 'completed'
      ORDER BY tt.created_at DESC
      LIMIT 10
    `, [streamId]);

    const recentTips = recentTipsQuery.rows.map(tip => ({
      amount: parseFloat(tip.amount),
      username: tip.username,
      profilePic: tip.profile_pic_url,
      timestamp: tip.created_at
    }));

    res.json({
      success: true,
      goal: {
        id: goal.id,
        streamId: goal.stream_id,
        goalAmount: parseFloat(goal.goal_amount),
        currentAmount,
        description: goal.description,
        category: goal.category,
        progressPercentage: Math.min((currentAmount / parseFloat(goal.goal_amount)) * 100, 100),
        isReached: currentAmount >= parseFloat(goal.goal_amount),
        tipCount,
        recentTips,
        createdAt: goal.created_at,
        updatedAt: goal.updated_at
      }
    });

  } catch (error) {
    console.error('❌ Error fetching stream goal:', error);
    res.status(500).json({ error: 'Failed to fetch stream goal' });
  }
});

// Update goal progress (called when tips are received)
router.post('/stream/:streamId/progress', authenticateToken, async (req, res) => {
  try {
    const { streamId } = req.params;
    const { tipAmount, tipperUsername } = req.body;

    // Get goal
    const goalQuery = await pool.query(
      'SELECT * FROM stream_goals WHERE stream_id = $1',
      [streamId]
    );

    if (goalQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found for this stream' });
    }

    const goal = goalQuery.rows[0];

    // Get updated progress
    const progressQuery = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as current_amount
      FROM token_transactions 
      WHERE session_id = $1 AND type = 'tip' AND status = 'completed'
    `, [streamId]);

    const currentAmount = parseFloat(progressQuery.rows[0].current_amount) || 0;
    const wasGoalReached = currentAmount >= parseFloat(goal.goal_amount);

    // Broadcast progress update to stream viewers
    const io = req.app.get('io');
    if (io) {
// TODO: Replace with Ably publish
//       io.to(`stream_${streamId}`).emit('goalProgress', {
        tipAmount,
        tipperUsername,
        currentAmount,
        goalAmount: parseFloat(goal.goal_amount),
        progressPercentage: Math.min((currentAmount / parseFloat(goal.goal_amount)) * 100, 100),
        isReached: wasGoalReached,
        justReached: wasGoalReached && (currentAmount - tipAmount) < parseFloat(goal.goal_amount)
      });
    }

    // If goal just reached, award achievement
    if (wasGoalReached && (currentAmount - tipAmount) < parseFloat(goal.goal_amount)) {
      try {
        // Award goal achievement to creator
        await pool.query(`
          INSERT INTO achievements (user_id, type, title, description, points, metadata, created_at)
          VALUES ($1, 'goal_reached', 'Goal Achieved!', 'Reached stream goal of ' || $2 || ' tokens', 100, 
                  json_build_object('goalAmount', $2, 'streamId', $3), NOW())
        `, [goal.creator_id, goal.goal_amount, streamId]);
      } catch (achievementError) {
        console.log('Note: Could not award achievement (achievements table may not exist yet)');
      }
    }

    res.json({
      success: true,
      progress: {
        currentAmount,
        goalAmount: parseFloat(goal.goal_amount),
        progressPercentage: Math.min((currentAmount / parseFloat(goal.goal_amount)) * 100, 100),
        isReached: wasGoalReached
      }
    });

  } catch (error) {
    console.error('❌ Error updating goal progress:', error);
    res.status(500).json({ error: 'Failed to update goal progress' });
  }
});

// Get creator's goal history
router.get('/creator/:creatorId/history', authenticateToken, async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const goalsQuery = await pool.query(`
      SELECT sg.*, s.start_time, s.end_time, s.status as stream_status,
             COALESCE(
               (SELECT SUM(tt.amount) 
                FROM token_transactions tt 
                WHERE tt.session_id = sg.stream_id AND tt.type = 'tip' AND tt.status = 'completed'), 
               0
             ) as final_amount
      FROM stream_goals sg
      JOIN sessions s ON sg.stream_id = s.id
      WHERE sg.creator_id = $1
      ORDER BY sg.created_at DESC
      LIMIT $2 OFFSET $3
    `, [creatorId, limit, offset]);

    const goals = goalsQuery.rows.map(goal => ({
      id: goal.id,
      streamId: goal.stream_id,
      goalAmount: parseFloat(goal.goal_amount),
      finalAmount: parseFloat(goal.final_amount),
      description: goal.description,
      category: goal.category,
      progressPercentage: Math.min((parseFloat(goal.final_amount) / parseFloat(goal.goal_amount)) * 100, 100),
      isReached: parseFloat(goal.final_amount) >= parseFloat(goal.goal_amount),
      streamStatus: goal.stream_status,
      streamStart: goal.start_time,
      streamEnd: goal.end_time,
      createdAt: goal.created_at
    }));

    // Get statistics
    const statsQuery = await pool.query(`
      SELECT 
        COUNT(*) as total_goals,
        COUNT(CASE WHEN 
          (SELECT COALESCE(SUM(tt.amount), 0) 
           FROM token_transactions tt 
           WHERE tt.session_id = sg.stream_id AND tt.type = 'tip' AND tt.status = 'completed') 
          >= sg.goal_amount THEN 1 END) as goals_reached,
        AVG(sg.goal_amount) as avg_goal_amount,
        AVG(
          (SELECT COALESCE(SUM(tt.amount), 0) 
           FROM token_transactions tt 
           WHERE tt.session_id = sg.stream_id AND tt.type = 'tip' AND tt.status = 'completed')
        ) as avg_final_amount
      FROM stream_goals sg
      WHERE sg.creator_id = $1
    `, [creatorId]);

    const stats = statsQuery.rows[0];

    res.json({
      success: true,
      goals,
      stats: {
        totalGoals: parseInt(stats.total_goals),
        goalsReached: parseInt(stats.goals_reached),
        successRate: stats.total_goals > 0 ? Math.round((stats.goals_reached / stats.total_goals) * 100) : 0,
        avgGoalAmount: parseFloat(stats.avg_goal_amount) || 0,
        avgFinalAmount: parseFloat(stats.avg_final_amount) || 0
      },
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: parseInt(stats.total_goals)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching goal history:', error);
    res.status(500).json({ error: 'Failed to fetch goal history' });
  }
});

// Delete stream goal
router.delete('/stream/:streamId', authenticateToken, async (req, res) => {
  try {
    const { streamId } = req.params;
    const creatorId = req.user.supabase_id;

    // Verify ownership
    const goalQuery = await pool.query(
      'SELECT * FROM stream_goals WHERE stream_id = $1 AND creator_id = $2',
      [streamId, creatorId]
    );

    if (goalQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found or not authorized' });
    }

    await pool.query('DELETE FROM stream_goals WHERE stream_id = $1 AND creator_id = $2', 
                     [streamId, creatorId]);

    // Broadcast goal removal to stream viewers
    const io = req.app.get('io');
    if (io) {
// TODO: Replace with Ably publish
//       io.to(`stream_${streamId}`).emit('goalRemoved');
    }

    res.json({
      success: true,
      message: 'Stream goal deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting stream goal:', error);
    res.status(500).json({ error: 'Failed to delete stream goal' });
  }
});

module.exports = router;