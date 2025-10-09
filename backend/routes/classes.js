const express = require('express');
const { pool } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const { logger: sharedLogger } = require('../utils/secureLogger');
const { sendClassEnrollmentConfirmationEmail } = require('../services/emailService');
const router = express.Router();

// Use shared logger instead of creating a new one (serverless-friendly)
const logger = sharedLogger;

// Get enrolled classes for a user
router.get('/enrolled', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    
    const result = await pool.query(
      'SELECT class_id FROM class_enrollments WHERE user_id = $1',
      [userId]
    );
    
    const enrolledClassIds = result.rows.map(row => row.class_id);
    
    res.json({ enrolledClassIds });
    logger.info(`Fetched enrolled classes for user ${userId}`, { count: enrolledClassIds.length });
    
  } catch (error) {
    logger.error('Error fetching enrolled classes:', error);
    res.status(500).json({ error: 'Failed to fetch enrolled classes' });
  }
});

// Get classes with filtering
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, category, search, creatorId } = req.query;
    
    let query = `
      SELECT 
        c.*,
        u.username as creator_username,
        u.display_name as creator_display_name,
        u.profile_pic_url as creator_avatar,
        u.total_earnings,
        COALESCE(AVG(cr.rating), 0) as creator_rating,
        COUNT(DISTINCT cr.id) as review_count,
        COUNT(DISTINCT ce.user_id) as current_participants
      FROM classes c
      JOIN users u ON c.creator_id = u.id
      LEFT JOIN class_reviews cr ON c.creator_id = cr.creator_id
      LEFT JOIN class_enrollments ce ON c.id = ce.class_id
      WHERE c.created_at >= $1 AND c.created_at <= $2
    `;
    
    const params = [startDate || new Date().toISOString(), endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()];
    let paramIndex = 2;
    
    if (category) {
      query += ` AND c.category = $${++paramIndex}`;
      params.push(category);
    }
    
    if (search) {
      query += ` AND (c.title ILIKE $${++paramIndex} OR c.description ILIKE $${++paramIndex} OR u.display_name ILIKE $${++paramIndex})`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }
    
    if (creatorId) {
      query += ` AND c.creator_id = $${++paramIndex}`;
      params.push(creatorId);
    }
    
    query += `
      GROUP BY c.id, u.username, u.display_name, u.profile_pic_url, u.total_earnings
      ORDER BY c.created_at ASC
    `;
    
    const result = await pool.query(query, params);
    
    const classes = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      startTime: row.created_at,
      duration: row.duration_minutes,
      maxParticipants: row.max_participants,
      currentParticipants: parseInt(row.current_participants),
      tokenPrice: parseFloat(row.token_price),
      tags: row.tags || [],
      coverImage: row.cover_image_url,
      isLive: row.is_live,
      creator: {
        id: row.creator_id,
        username: row.creator_username,
        displayName: row.creator_display_name || row.creator_username,
        avatar: row.creator_avatar,
        rating: parseFloat(row.creator_rating) || 0,
        reviewCount: parseInt(row.review_count) || 0
      }
    }));
    
    res.json({ classes });
    logger.info(`Fetched ${classes.length} classes`, { query: req.query });
    
  } catch (error) {
    logger.error('Error fetching classes:', error);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// Create a new class (creators only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const {
      title,
      description,
      category,
      startTime,
      duration,
      maxParticipants,
      tokenPrice,
      tags,
      requirements,
      whatToExpect,
      coverImage,
      creator
    } = req.body;
    
    // Verify user is a creator
    const userResult = await pool.query('SELECT is_creator FROM users WHERE supabase_id = $1', [userId]);
    if (!userResult.rows[0] || !userResult.rows[0].is_creator) {
      return res.status(403).json({ error: 'Only creators can schedule classes' });
    }
    
    // Use the user ID directly as creator ID
    const creatorId = userId;
    
    const query = `
      INSERT INTO classes (
        creator_id, title, description, category, start_time, 
        duration_minutes, max_participants, token_price, tags, 
        requirements, what_to_expect, cover_image_url, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      creatorId, title, description, category, startTime,
      duration, maxParticipants, tokenPrice, JSON.stringify(tags),
      requirements || '', whatToExpect || '', coverImage || null
    ]);
    
    const newClass = result.rows[0];

    // Auto-sync to creator's calendar
    try {
      const startDateTime = new Date(newClass.start_time);
      const scheduledDate = startDateTime.toISOString().split('T')[0];
      const scheduledTime = startDateTime.toTimeString().split(' ')[0].substring(0, 5);

      await pool.query(`
        INSERT INTO calendar_events (
          creator_id,
          event_type,
          title,
          description,
          scheduled_date,
          scheduled_time,
          duration_minutes,
          status,
          reference_id,
          reference_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        creatorId,
        'class',
        newClass.title,
        newClass.description,
        scheduledDate,
        scheduledTime,
        newClass.duration_minutes,
        'scheduled',
        newClass.id,
        'class'
      ]);

      logger.info(`Class synced to creator calendar: ${newClass.id}`);
    } catch (calendarError) {
      logger.error('Error syncing class to calendar:', calendarError);
      // Don't fail class creation if calendar sync fails
    }

    res.status(201).json({
      success: true,
      class: {
        id: newClass.id,
        title: newClass.title,
        description: newClass.description,
        category: newClass.category,
        startTime: newClass.start_time,
        duration: newClass.duration_minutes,
        maxParticipants: newClass.max_participants,
        currentParticipants: 0,
        tokenPrice: parseFloat(newClass.token_price),
        tags: newClass.tags || [],
        requirements: newClass.requirements,
        whatToExpect: newClass.what_to_expect,
        coverImage: newClass.cover_image_url,
        isLive: false,
        creator: creator || {
          id: userId,
          username: req.user.email?.split('@')[0] || 'creator',
          displayName: req.user.name || req.user.email?.split('@')[0] || 'Creator',
          avatar: req.user.picture,
          rating: 0,
          reviewCount: 0
        }
      }
    });

    logger.info(`Class created: ${newClass.id}`, { creatorId, title });
    
  } catch (error) {
    logger.error('Error creating class:', error);
    res.status(500).json({ error: 'Failed to create class' });
  }
});

// Join a class
router.post('/:classId/join', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const userId = req.user.supabase_id;
    const { classId } = req.params;
    const { tokenAmount } = req.body;
    
    // Get user's database ID and token balance
    const userResult = await client.query(
      'SELECT id, id::text as user_id FROM users WHERE supabase_id = $1',
      [userId]
    );
    
    if (!userResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userDbId = userResult.rows[0].id;
    
    // Get current token balance
    const balanceResult = await client.query(
      'SELECT balance FROM token_balances WHERE user_id = $1',
      [userDbId]
    );
    
    const currentBalance = balanceResult.rows[0] ? parseFloat(balanceResult.rows[0].balance) : 0;
    
    if (currentBalance < tokenAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient token balance' });
    }
    
    // Check if class exists and has space
    const classResult = await client.query(`
      SELECT c.*, COUNT(cp.user_id) as current_participants
      FROM classes c
      LEFT JOIN class_participants cp ON c.id = cp.class_id
      WHERE c.id = $1
      GROUP BY c.id
    `, [classId]);
    
    if (!classResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Class not found' });
    }
    
    const classData = classResult.rows[0];
    const currentParticipants = parseInt(classData.current_participants);
    
    if (currentParticipants >= classData.max_participants) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Class is full' });
    }
    
    // Check if user already joined
    const existingParticipant = await client.query(
      'SELECT id FROM class_participants WHERE class_id = $1 AND user_id = $2',
      [classId, userDbId]
    );
    
    if (existingParticipant.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Already joined this class' });
    }
    
    // Deduct tokens
    await client.query(`
      INSERT INTO token_balances (user_id, balance, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET balance = $2, updated_at = NOW()
    `, [userDbId, currentBalance - tokenAmount]);
    
    // Record transaction
    await client.query(`
      INSERT INTO token_transactions (user_id, amount, type, description, created_at)
      VALUES ($1, $2, 'debit', $3, NOW())
    `, [userDbId, tokenAmount, `Joined class: ${classData.title}`]);
    
    // Add user to class participants
    await client.query(`
      INSERT INTO class_participants (class_id, user_id, status, joined_at)
      VALUES ($1, $2, 'joined', NOW())
    `, [classId, userDbId]);

    // Auto-sync to user's calendar
    try {
      const startDateTime = new Date(classData.start_time);
      const scheduledDate = startDateTime.toISOString().split('T')[0];
      const scheduledTime = startDateTime.toTimeString().split(' ')[0].substring(0, 5);

      // Get creator info
      const creatorResult = await client.query(
        'SELECT username, display_name FROM users WHERE id = $1',
        [classData.creator_id]
      );
      const creatorName = creatorResult.rows[0]?.display_name || creatorResult.rows[0]?.username || 'Instructor';

      await client.query(`
        INSERT INTO calendar_events (
          creator_id,
          fan_id,
          event_type,
          title,
          description,
          scheduled_date,
          scheduled_time,
          duration_minutes,
          status,
          reference_id,
          reference_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        classData.creator_id,
        userId,
        'class',
        classData.title,
        `Class with ${creatorName}`,
        scheduledDate,
        scheduledTime,
        classData.duration_minutes,
        'scheduled',
        classId,
        'class_enrollment'
      ]);

      logger.info(`Class enrollment synced to calendar for user ${userId}`);
    } catch (calendarError) {
      logger.error('Error syncing enrollment to calendar:', calendarError);
      // Don't fail enrollment if calendar sync fails
    }

    await client.query('COMMIT');

    // Send confirmation email
    try {
      // Get user details for the email
      const userResult = await client.query(
        'SELECT email, username, display_name FROM users WHERE id = $1',
        [userDbId]
      );

      if (userResult.rows[0]) {
        const userEmail = userResult.rows[0].email;
        const userName = userResult.rows[0].display_name || userResult.rows[0].username || 'Student';

        // Get creator name
        const creatorResult = await client.query(
          'SELECT username, display_name FROM users WHERE id = $1',
          [classData.creator_id]
        );
        const creatorName = creatorResult.rows[0]?.display_name || creatorResult.rows[0]?.username || 'Instructor';

        // Prepare class details for email
        const classDetails = {
          title: classData.title,
          startTime: classData.start_time,
          duration: classData.duration,
          creatorName: creatorName,
          tokenPrice: tokenAmount,
          description: classData.description,
          category: classData.category
        };

        // Send the email asynchronously (don't wait for it)
        sendClassEnrollmentConfirmationEmail(userEmail, userName, classDetails)
          .then(() => {
            logger.info(`Class enrollment confirmation email sent to ${userEmail}`);
          })
          .catch((error) => {
            logger.error('Failed to send class enrollment email:', error);
            // Don't fail the enrollment if email fails
          });
      }
    } catch (emailError) {
      logger.error('Error preparing enrollment email:', emailError);
      // Don't fail the enrollment if email preparation fails
    }

    res.json({
      success: true,
      message: 'Successfully joined class',
      newBalance: currentBalance - tokenAmount
    });

    logger.info(`User ${userId} joined class ${classId}`, { tokenAmount });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error joining class:', error);
    res.status(500).json({ error: 'Failed to join class' });
  } finally {
    client.release();
  }
});

// Get class participants (creators only)
router.get('/:classId/participants', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { classId } = req.params;
    
    // Verify user is the creator of this class
    const classResult = await pool.query(`
      SELECT c.* FROM classes c
      JOIN users u ON c.creator_id = u.id
      WHERE c.id = $1 AND u.id = $2
    `, [classId, userId]);
    
    if (!classResult.rows[0]) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const participants = await pool.query(`
      SELECT u.display_name, u.username, u.profile_pic_url, cp.joined_at
      FROM class_participants cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.class_id = $1
      ORDER BY cp.joined_at ASC
    `, [classId]);
    
    res.json({ participants: participants.rows });
    
  } catch (error) {
    logger.error('Error fetching class participants:', error);
    res.status(500).json({ error: 'Failed to fetch participants' });
  }
});

// Update class (creators only)
router.put('/:classId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { classId } = req.params;
    const {
      title,
      description,
      category,
      startTime,
      duration,
      maxParticipants,
      tokenPrice,
      tags
    } = req.body;
    
    // Verify user is the creator of this class
    const classResult = await pool.query(`
      SELECT c.* FROM classes c
      JOIN users u ON c.creator_id = u.id
      WHERE c.id = $1 AND u.id = $2
    `, [classId, userId]);
    
    if (!classResult.rows[0]) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const query = `
      UPDATE classes SET
        title = $1, description = $2, category = $3, start_time = $4,
        duration_minutes = $5, max_participants = $6, token_price = $7,
        tags = $8, updated_at = NOW()
      WHERE id = $9
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      title, description, category, startTime,
      duration, maxParticipants, tokenPrice, JSON.stringify(tags), classId
    ]);
    
    const updatedClass = result.rows[0];
    
    res.json({
      success: true,
      class: {
        id: updatedClass.id,
        title: updatedClass.title,
        description: updatedClass.description,
        category: updatedClass.category,
        startTime: updatedClass.start_time,
        duration: updatedClass.duration_minutes,
        maxParticipants: updatedClass.max_participants,
        tokenPrice: parseFloat(updatedClass.token_price),
        tags: updatedClass.tags || []
      }
    });
    
    logger.info(`Class updated: ${classId}`, { title });
    
  } catch (error) {
    logger.error('Error updating class:', error);
    res.status(500).json({ error: 'Failed to update class' });
  }
});

// Delete class (creators only)
router.delete('/:classId', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const userId = req.user.supabase_id;
    const { classId } = req.params;
    
    // Verify user is the creator of this class
    const classResult = await client.query(`
      SELECT c.* FROM classes c
      JOIN users u ON c.creator_id = u.id
      WHERE c.id = $1 AND u.id = $2
    `, [classId, userId]);
    
    if (!classResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get participants to refund tokens
    const participants = await client.query(`
      SELECT cp.user_id, c.token_price
      FROM class_participants cp
      JOIN classes c ON cp.class_id = c.id
      WHERE cp.class_id = $1
    `, [classId]);
    
    // Refund tokens to participants
    for (const participant of participants.rows) {
      const tokenPrice = parseFloat(participant.token_price);
      
      // Add tokens back
      await client.query(`
        INSERT INTO token_balances (user_id, balance, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET balance = token_balances.balance + $2, updated_at = NOW()
      `, [participant.user_id, tokenPrice]);
      
      // Record refund transaction
      await client.query(`
        INSERT INTO token_transactions (user_id, amount, type, description, created_at)
        VALUES ($1, $2, 'credit', $3, NOW())
      `, [participant.user_id, tokenPrice, `Refund for cancelled class`]);
    }
    
    // Delete participants
    await client.query('DELETE FROM class_participants WHERE class_id = $1', [classId]);

    // Remove from calendars (mark as cancelled instead of deleting)
    await client.query(`
      UPDATE calendar_events
      SET status = 'cancelled', updated_at = NOW()
      WHERE reference_id = $1 AND reference_type IN ('class', 'class_enrollment')
    `, [classId]);

    // Delete class
    await client.query('DELETE FROM classes WHERE id = $1', [classId]);

    await client.query('COMMIT');
    
    res.json({ success: true, message: 'Class cancelled and participants refunded' });
    
    logger.info(`Class deleted: ${classId}`, { participantCount: participants.rows.length });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error deleting class:', error);
    res.status(500).json({ error: 'Failed to delete class' });
  } finally {
    client.release();
  }
});

// Submit a review for a class
router.post('/:classId/reviews', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { classId } = req.params;
    const { rating, review } = req.body;
    
    // Verify user attended this class
    const participantCheck = await pool.query(
      'SELECT * FROM class_participants WHERE class_id = $1 AND user_id = $2',
      [classId, userId]
    );
    
    if (!participantCheck.rows[0]) {
      return res.status(403).json({ error: 'You must attend a class to review it' });
    }
    
    // Check if user already reviewed this class
    const existingReview = await pool.query(
      'SELECT * FROM class_reviews WHERE class_id = $1 AND user_id = $2',
      [classId, userId]
    );
    
    if (existingReview.rows[0]) {
      return res.status(400).json({ error: 'You have already reviewed this class' });
    }
    
    // Get creator ID from class
    const classInfo = await pool.query(
      'SELECT creator_id FROM classes WHERE id = $1',
      [classId]
    );
    
    if (!classInfo.rows[0]) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Insert review
    const result = await pool.query(
      `INSERT INTO class_reviews (class_id, user_id, creator_id, rating, review, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [classId, userId, classInfo.rows[0].creator_id, rating, review]
    );
    
    res.status(201).json({ success: true, review: result.rows[0] });
    logger.info(`Review submitted for class ${classId} by user ${userId}`, { rating });
    
  } catch (error) {
    logger.error('Error submitting review:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// Get reviews for a class
router.get('/:classId/reviews', async (req, res) => {
  try {
    const { classId } = req.params;
    
    const reviews = await pool.query(
      `SELECT 
        cr.*,
        u.username,
        u.display_name,
        u.profile_pic_url
      FROM class_reviews cr
      JOIN users u ON cr.user_id = u.supabase_id
      WHERE cr.class_id = $1
      ORDER BY cr.created_at DESC`,
      [classId]
    );
    
    res.json({ reviews: reviews.rows });
    
  } catch (error) {
    logger.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Get enrolled classes for a user
router.get('/enrolled/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const enrolledClasses = await pool.query(`
      SELECT 
        c.*,
        u.username as creator_name,
        u.profile_pic_url as creator_avatar,
        ce.created_at as enrolled_at,
        ce.status as enrollment_status
      FROM class_enrollments ce
      JOIN classes c ON ce.class_id = c.id
      JOIN users u ON c.creator_id = u.id
      WHERE ce.user_id = $1
      ORDER BY c.created_at ASC
    `, [userId]);
    
    res.json({ 
      success: true,
      classes: enrolledClasses.rows 
    });
    
  } catch (error) {
    logger.error('Error fetching enrolled classes:', error);
    res.status(500).json({ error: 'Failed to fetch enrolled classes' });
  }
});

// Get classes hosted by a creator
router.get('/hosting/:creatorId', authenticateToken, async (req, res) => {
  try {
    const { creatorId } = req.params;
    
    const hostedClasses = await pool.query(`
      SELECT 
        c.*,
        COUNT(ce.id) as enrolled_count
      FROM classes c
      LEFT JOIN class_enrollments ce ON c.id = ce.class_id
      WHERE c.creator_id = $1
      GROUP BY c.id
      ORDER BY c.created_at ASC
    `, [creatorId]);
    
    res.json({ 
      success: true,
      classes: hostedClasses.rows 
    });
    
  } catch (error) {
    logger.error('Error fetching hosted classes:', error);
    res.status(500).json({ error: 'Failed to fetch hosted classes' });
  }
});

module.exports = router;