const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Get all available experiences
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    
    // Get experiences with participant count
    const query = await pool.query(`
      SELECT 
        e.*,
        COUNT(DISTINCT ep.user_id) as current_participants,
        CASE 
          WHEN ep2.user_id IS NOT NULL THEN true 
          ELSE false 
        END as user_joined
      FROM creator_experiences e
      LEFT JOIN experience_participants ep ON e.id = ep.experience_id
      LEFT JOIN experience_participants ep2 ON e.id = ep2.experience_id AND ep2.user_id = $1
      WHERE e.status = 'approved' AND e.is_active = true
      GROUP BY e.id, ep2.user_id
      ORDER BY e.date ASC
    `, [userId]);
    
    res.json({
      success: true,
      experiences: query.rows
    });
    
  } catch (error) {
    console.error('Error fetching experiences:', error);
    res.status(500).json({ error: 'Failed to fetch experiences' });
  }
});

// Submit a new experience proposal
router.post('/submit', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const userId = req.user.supabase_id;
    const {
      title,
      description,
      location,
      proposedDate,
      duration,
      estimatedCost,
      maxParticipants,
      minParticipants,
      targetAudience,
      activities,
      requirements,
      whySpecial,
      coHosts
    } = req.body;
    
    // Validate creator status
    const creatorCheck = await client.query(
      'SELECT is_creator FROM users WHERE supabase_id = $1',
      [userId]
    );
    
    if (!creatorCheck.rows[0]?.is_creator) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only creators can submit experiences' });
    }
    
    // Create experience submission
    const experienceId = uuidv4();
    await client.query(`
      INSERT INTO creator_experience_submissions (
        id, submitter_id, title, description, location,
        proposed_date, duration, estimated_cost, max_participants,
        min_participants, target_audience, activities, requirements,
        why_special, co_hosts, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'pending', NOW())
    `, [
      experienceId,
      userId,
      title,
      description,
      location,
      proposedDate,
      duration,
      parseInt(estimatedCost),
      parseInt(maxParticipants),
      parseInt(minParticipants) || null,
      targetAudience,
      JSON.stringify(activities),
      JSON.stringify(requirements),
      whySpecial,
      JSON.stringify(coHosts)
    ]);
    
    // Create notification for admins
    await client.query(`
      INSERT INTO notifications (
        id, recipient_id, type, title, message, data, created_at
      ) 
      SELECT 
        $1, supabase_id, 'experience_submission', $2, $3, $4, NOW()
      FROM users 
      WHERE role = 'admin'
    `, [
      uuidv4(),
      'New Experience Submission',
      `${req.user.display_name} submitted "${title}" for review`,
      JSON.stringify({ submissionId: experienceId, title })
    ]);
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'Experience submitted for review',
      submissionId: experienceId
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error submitting experience:', error);
    res.status(500).json({ error: 'Failed to submit experience' });
  } finally {
    client.release();
  }
});

// Join an experience
router.post('/:experienceId/join', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const userId = req.user.supabase_id;
    const { experienceId } = req.params;
    
    // Get experience details
    const experienceQuery = await client.query(
      'SELECT * FROM creator_experiences WHERE id = $1 AND status = \'approved\' AND is_active = true',
      [experienceId]
    );
    
    if (experienceQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Experience not found' });
    }
    
    const experience = experienceQuery.rows[0];
    
    // Check if already joined
    const participantCheck = await client.query(
      'SELECT id FROM experience_participants WHERE experience_id = $1 AND user_id = $2',
      [experienceId, userId]
    );
    
    if (participantCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Already joined this experience' });
    }
    
    // Check participant limit
    const participantCount = await client.query(
      'SELECT COUNT(*) as count FROM experience_participants WHERE experience_id = $1',
      [experienceId]
    );
    
    if (participantCount.rows[0].count >= experience.max_participants) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Experience is full' });
    }
    
    // Check token balance
    const balanceQuery = await client.query(
      'SELECT balance FROM token_balances WHERE supabase_user_id = $1',
      [userId]
    );
    
    if (!balanceQuery.rows[0] || balanceQuery.rows[0].balance < experience.token_cost) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient token balance' });
    }
    
    // Deduct tokens
    await client.query(
      'UPDATE token_balances SET balance = balance - $1 WHERE supabase_user_id = $2',
      [experience.token_cost, userId]
    );
    
    // Add participant
    await client.query(`
      INSERT INTO experience_participants (
        id, experience_id, user_id, token_cost, joined_at
      ) VALUES ($1, $2, $3, $4, NOW())
    `, [uuidv4(), experienceId, userId, experience.token_cost]);
    
    // Create token transaction
    await client.query(`
      INSERT INTO token_transactions (
        id, user_id, transaction_type, amount, description,
        related_id, related_type, created_at
      ) VALUES ($1, $2, 'experience_join', $3, $4, $5, 'experience', NOW())
    `, [
      uuidv4(),
      userId,
      -experience.token_cost,
      `Joined experience: ${experience.title}`,
      experienceId
    ]);
    
    // Create notification
    await client.query(`
      INSERT INTO notifications (
        id, recipient_id, type, title, message, created_at
      ) VALUES ($1, $2, 'experience_joined', $3, $4, NOW())
    `, [
      uuidv4(),
      userId,
      'Experience Joined!',
      `You've successfully joined ${experience.title}. Check your email for more details.`
    ]);
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'Successfully joined experience'
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error joining experience:', error);
    res.status(500).json({ error: 'Failed to join experience' });
  } finally {
    client.release();
  }
});

// Get user's joined experiences
router.get('/my-experiences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    
    const query = await pool.query(`
      SELECT 
        e.*,
        ep.joined_at,
        ep.token_cost as paid_amount
      FROM experience_participants ep
      JOIN creator_experiences e ON e.id = ep.experience_id
      WHERE ep.user_id = $1
      ORDER BY e.date ASC
    `, [userId]);
    
    res.json({
      success: true,
      experiences: query.rows
    });
    
  } catch (error) {
    console.error('Error fetching user experiences:', error);
    res.status(500).json({ error: 'Failed to fetch experiences' });
  }
});

// Admin: Get pending experience submissions
router.get('/admin/submissions', authenticateToken, async (req, res) => {
  try {
    // Check admin status
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const query = await pool.query(`
      SELECT 
        es.*,
        u.display_name as submitter_name,
        u.username as submitter_username
      FROM creator_experience_submissions es
      JOIN users u ON u.supabase_id = es.submitter_id
      WHERE es.status = 'pending'
      ORDER BY es.created_at DESC
    `);
    
    res.json({
      success: true,
      submissions: query.rows
    });
    
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// Admin: Approve/Reject experience submission
router.post('/admin/submissions/:submissionId/:action', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    // Check admin status
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    await client.query('BEGIN');
    
    const { submissionId, action } = req.params;
    const { feedback, tokenCost } = req.body;
    
    if (!['approve', 'reject'].includes(action)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    // Get submission details
    const submissionQuery = await client.query(
      'SELECT * FROM creator_experience_submissions WHERE id = $1',
      [submissionId]
    );
    
    if (submissionQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    const submission = submissionQuery.rows[0];
    
    if (action === 'approve') {
      // Create approved experience
      const experienceId = uuidv4();
      await client.query(`
        INSERT INTO creator_experiences (
          id, title, description, location, date, duration,
          token_cost, max_participants, min_participants,
          category, perks, requirements, status, organizer_id,
          created_at, deadline, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'approved', $13, NOW(), $14, true)
      `, [
        experienceId,
        submission.title,
        submission.description,
        submission.location,
        submission.proposed_date,
        submission.duration,
        tokenCost || submission.estimated_cost,
        submission.max_participants,
        submission.min_participants,
        'creator_led',
        submission.activities,
        submission.requirements,
        submission.submitter_id,
        new Date(submission.proposed_date).setDate(new Date(submission.proposed_date).getDate() - 14) // 2 weeks before
      ]);
      
      // Update submission status
      await client.query(
        'UPDATE creator_experience_submissions SET status = $1, reviewed_at = NOW(), reviewer_id = $2, feedback = $3 WHERE id = $4',
        ['approved', req.user.supabase_id, feedback, submissionId]
      );
      
      // Notify submitter
      await client.query(`
        INSERT INTO notifications (
          id, recipient_id, type, title, message, created_at
        ) VALUES ($1, $2, 'experience_approved', $3, $4, NOW())
      `, [
        uuidv4(),
        submission.submitter_id,
        'Experience Approved!',
        `Your experience "${submission.title}" has been approved and is now live!`
      ]);
      
    } else {
      // Reject submission
      await client.query(
        'UPDATE creator_experience_submissions SET status = $1, reviewed_at = NOW(), reviewer_id = $2, feedback = $3 WHERE id = $4',
        ['rejected', req.user.supabase_id, feedback, submissionId]
      );
      
      // Notify submitter
      await client.query(`
        INSERT INTO notifications (
          id, recipient_id, type, title, message, created_at
        ) VALUES ($1, $2, 'experience_rejected', $3, $4, NOW())
      `, [
        uuidv4(),
        submission.submitter_id,
        'Experience Update',
        `Your experience "${submission.title}" needs some adjustments. Check your email for feedback.`
      ]);
    }
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: `Experience ${action}ed successfully`
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing experience submission:', error);
    res.status(500).json({ error: 'Failed to process experience submission' });
  } finally {
    client.release();
  }
});

module.exports = router;