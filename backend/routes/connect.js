const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../utils/db');

// Middleware to check if user is a creator
const requireCreator = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT is_creator FROM users WHERE uid = $1',
      [req.user.supabase_id]
    );
    
    if (!result.rows[0] || !result.rows[0].is_creator) {
      return res.status(403).json({ error: 'Creator access required' });
    }
    
    next();
  } catch (error) {
    console.error('Error checking creator status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get creator's Connect profile
router.get('/profile', authenticateToken, requireCreator, async (req, res) => {
  try {
    const { uid } = req.user;
    
    const query = `
      SELECT 
        cp.*,
        u.display_name,
        u.avatar_url,
        u.city,
        u.state,
        u.country
      FROM creator_connect_profiles cp
      JOIN users u ON u.uid = cp.creator_id
      WHERE cp.creator_id = $1
    `;
    
    const result = await pool.query(query, [uid]);
    
    if (result.rows.length === 0) {
      // Return default profile if none exists
      return res.json({
        creator_id: uid,
        specialties: [],
        collaboration_interests: [],
        experience_level: 'Beginner',
        show_success_metrics: true,
        bio: null,
        available_for_collab: true,
        available_for_mentorship: false,
        available_for_travel: true
      });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching Connect profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update creator's Connect profile
router.put('/profile', authenticateToken, requireCreator, async (req, res) => {
  try {
    const { uid } = req.user;
    const {
      specialties,
      collaboration_interests,
      experience_level,
      show_success_metrics,
      bio,
      available_for_collab,
      available_for_mentorship,
      available_for_travel
    } = req.body;
    
    const query = `
      INSERT INTO creator_connect_profiles (
        creator_id, specialties, collaboration_interests, experience_level,
        show_success_metrics, bio, available_for_collab, available_for_mentorship,
        available_for_travel
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (creator_id) DO UPDATE SET
        specialties = $2,
        collaboration_interests = $3,
        experience_level = $4,
        show_success_metrics = $5,
        bio = $6,
        available_for_collab = $7,
        available_for_mentorship = $8,
        available_for_travel = $9,
        updated_at = NOW()
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      uid,
      specialties || [],
      collaboration_interests || [],
      experience_level || 'Beginner',
      show_success_metrics !== false,
      bio,
      available_for_collab !== false,
      available_for_mentorship || false,
      available_for_travel !== false
    ]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating Connect profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Discover creators
router.get('/discover', authenticateToken, requireCreator, async (req, res) => {
  try {
    const { category, search, page = 1, limit = 12 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT 
        u.uid,
        u.display_name,
        u.avatar_url,
        u.city,
        u.state,
        u.country,
        u.is_verified,
        cp.specialties,
        cp.collaboration_interests,
        cp.experience_level,
        cp.bio,
        cp.available_for_collab,
        cp.available_for_mentorship,
        cp.available_for_travel,
        COALESCE(AVG(r.rating), 0) as avg_rating,
        COUNT(DISTINCT f.follower_id) as follower_count
      FROM users u
      LEFT JOIN creator_connect_profiles cp ON cp.creator_id = u.uid
      LEFT JOIN reviews r ON r.reviewed_id = u.uid
      LEFT JOIN followers f ON f.creator_id = u.uid
      WHERE u.is_creator = true AND u.uid != $1
    `;
    
    const params = [req.user.supabase_id];
    let paramIndex = 2;
    
    if (search) {
      query += ` AND (
        u.display_name ILIKE $${paramIndex} OR
        cp.bio ILIKE $${paramIndex} OR
        $${paramIndex} = ANY(cp.specialties) OR
        $${paramIndex} = ANY(cp.collaboration_interests)
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    if (category && category !== 'all') {
      query += ` AND $${paramIndex} = ANY(cp.specialties)`;
      params.push(category);
      paramIndex++;
    }
    
    query += ` GROUP BY u.uid, cp.creator_id, cp.specialties, cp.collaboration_interests, 
               cp.experience_level, cp.bio, cp.available_for_collab, 
               cp.available_for_mentorship, cp.available_for_travel`;
    query += ` ORDER BY follower_count DESC, avg_rating DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      creators: result.rows,
      page: parseInt(page),
      hasMore: result.rows.length === parseInt(limit)
    });
  } catch (error) {
    console.error('Error discovering creators:', error);
    res.status(500).json({ error: 'Failed to discover creators' });
  }
});

// Get collaborations
router.get('/collaborations', authenticateToken, requireCreator, async (req, res) => {
  try {
    const { status = 'active', category, type, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT 
        c.*,
        u.display_name as creator_name,
        u.avatar_url as creator_avatar,
        COUNT(ca.id) as application_count
      FROM collaborations c
      JOIN users u ON u.uid = c.creator_id
      LEFT JOIN collaboration_applications ca ON ca.collaboration_id = c.id
      WHERE c.status = $1
    `;
    
    const params = [status];
    let paramIndex = 2;
    
    if (category) {
      query += ` AND c.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    
    if (type) {
      query += ` AND c.collaboration_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    
    query += ` GROUP BY c.id, u.display_name, u.avatar_url`;
    query += ` ORDER BY c.created_at DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      collaborations: result.rows,
      page: parseInt(page),
      hasMore: result.rows.length === parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching collaborations:', error);
    res.status(500).json({ error: 'Failed to fetch collaborations' });
  }
});

// Create collaboration
router.post('/collaborations', authenticateToken, requireCreator, async (req, res) => {
  try {
    const { uid } = req.user;
    const {
      title,
      description,
      category,
      collaboration_type,
      requirements,
      max_participants
    } = req.body;
    
    const query = `
      INSERT INTO collaborations (
        creator_id, title, description, category, collaboration_type,
        requirements, max_participants
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      uid,
      title,
      description,
      category,
      collaboration_type,
      requirements || [],
      max_participants || 1
    ]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating collaboration:', error);
    res.status(500).json({ error: 'Failed to create collaboration' });
  }
});

// Apply to collaboration
router.post('/collaborations/:id/apply', authenticateToken, requireCreator, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { uid } = req.user;
    const { id } = req.params;
    const { message } = req.body;
    
    await client.query('BEGIN');
    
    // Check if collaboration exists and is active
    const collabResult = await client.query(
      'SELECT * FROM collaborations WHERE id = $1 AND status = $2',
      [id, 'active']
    );
    
    if (collabResult.rows.length === 0) {
      throw new Error('Collaboration not found or not active');
    }
    
    // Check if already applied
    const existingApp = await client.query(
      'SELECT id FROM collaboration_applications WHERE collaboration_id = $1 AND applicant_id = $2',
      [id, uid]
    );
    
    if (existingApp.rows.length > 0) {
      throw new Error('Already applied to this collaboration');
    }
    
    // Create application
    const appResult = await client.query(
      `INSERT INTO collaboration_applications (collaboration_id, applicant_id, message)
       VALUES ($1, $2, $3) RETURNING *`,
      [id, uid, message]
    );
    
    await client.query('COMMIT');
    
    res.json(appResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error applying to collaboration:', error);
    res.status(400).json({ error: error.message || 'Failed to apply' });
  } finally {
    client.release();
  }
});

// Get creator trips
router.get('/trips', authenticateToken, requireCreator, async (req, res) => {
  try {
    const { status = 'planning', page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    const query = `
      SELECT 
        t.*,
        u.display_name as organizer_name,
        u.avatar_url as organizer_avatar,
        COUNT(tp.id) as participant_count
      FROM creator_trips t
      JOIN users u ON u.uid = t.organizer_id
      LEFT JOIN trip_participants tp ON tp.trip_id = t.id AND tp.status = 'confirmed'
      WHERE t.status = $1 AND t.end_date >= CURRENT_DATE
      GROUP BY t.id, u.display_name, u.avatar_url
      ORDER BY t.start_date ASC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [status, limit, offset]);
    
    res.json({
      trips: result.rows,
      page: parseInt(page),
      hasMore: result.rows.length === parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching trips:', error);
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

// Create trip
router.post('/trips', authenticateToken, requireCreator, async (req, res) => {
  try {
    const { uid } = req.user;
    const {
      destination,
      start_date,
      end_date,
      description,
      content_focus,
      estimated_cost,
      max_participants,
      activities
    } = req.body;
    
    const query = `
      INSERT INTO creator_trips (
        organizer_id, destination, start_date, end_date, description,
        content_focus, estimated_cost, max_participants, activities
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      uid,
      destination,
      start_date,
      end_date,
      description,
      content_focus,
      estimated_cost,
      max_participants || 10,
      activities || []
    ]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating trip:', error);
    res.status(500).json({ error: 'Failed to create trip' });
  }
});

// Join trip
router.post('/trips/:id/join', authenticateToken, requireCreator, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { uid } = req.user;
    const { id } = req.params;
    
    await client.query('BEGIN');
    
    // Check trip availability
    const tripResult = await client.query(
      `SELECT t.*, COUNT(tp.id) as current_participants
       FROM creator_trips t
       LEFT JOIN trip_participants tp ON tp.trip_id = t.id AND tp.status = 'confirmed'
       WHERE t.id = $1 AND t.status IN ('planning', 'confirmed')
       GROUP BY t.id`,
      [id]
    );
    
    if (tripResult.rows.length === 0) {
      throw new Error('Trip not found or not available');
    }
    
    const trip = tripResult.rows[0];
    if (trip.current_participants >= trip.max_participants) {
      throw new Error('Trip is full');
    }
    
    // Add participant
    const participantResult = await client.query(
      `INSERT INTO trip_participants (trip_id, participant_id, status)
       VALUES ($1, $2, 'interested')
       ON CONFLICT (trip_id, participant_id) DO UPDATE SET status = 'interested'
       RETURNING *`,
      [id, uid]
    );
    
    await client.query('COMMIT');
    
    res.json(participantResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error joining trip:', error);
    res.status(400).json({ error: error.message || 'Failed to join trip' });
  } finally {
    client.release();
  }
});

// Get mentors
router.get('/mentors', authenticateToken, requireCreator, async (req, res) => {
  try {
    const { expertise, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT 
        mp.*,
        u.display_name as mentor_name,
        u.avatar_url as mentor_avatar,
        u.is_verified,
        COALESCE(AVG(r.rating), 0) as avg_rating,
        COUNT(DISTINCT m.id) as total_mentees
      FROM mentorship_profiles mp
      JOIN users u ON u.uid = mp.mentor_id
      LEFT JOIN reviews r ON r.reviewed_id = mp.mentor_id
      LEFT JOIN mentorships m ON m.mentor_id = mp.mentor_id AND m.status = 'active'
      WHERE mp.is_active = true
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (expertise) {
      query += ` AND mp.expertise ILIKE $${paramIndex}`;
      params.push(`%${expertise}%`);
      paramIndex++;
    }
    
    query += ` GROUP BY mp.id, u.display_name, u.avatar_url, u.is_verified`;
    query += ` ORDER BY avg_rating DESC, total_mentees DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      mentors: result.rows,
      page: parseInt(page),
      hasMore: result.rows.length === parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching mentors:', error);
    res.status(500).json({ error: 'Failed to fetch mentors' });
  }
});

// Request mentorship
router.post('/mentorship/request', authenticateToken, requireCreator, async (req, res) => {
  try {
    const { uid } = req.user;
    const { mentor_id } = req.body;
    
    const query = `
      INSERT INTO mentorships (mentor_id, mentee_id, status)
      VALUES ($1, $2, 'pending')
      ON CONFLICT (mentor_id, mentee_id) DO NOTHING
      RETURNING *
    `;
    
    const result = await pool.query(query, [mentor_id, uid]);
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Mentorship request already exists' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error requesting mentorship:', error);
    res.status(500).json({ error: 'Failed to request mentorship' });
  }
});

// Get forum topics
router.get('/forums/topics', authenticateToken, requireCreator, async (req, res) => {
  try {
    const { category_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT 
        t.*,
        u.display_name as author_name,
        u.avatar_url as author_avatar,
        c.name as category_name,
        c.color as category_color,
        COUNT(r.id) as reply_count,
        MAX(r.created_at) as last_activity
      FROM forum_topics t
      JOIN users u ON u.uid = t.author_id
      JOIN forum_categories c ON c.id = t.category_id
      LEFT JOIN forum_replies r ON r.topic_id = t.id
      WHERE t.is_locked = false
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (category_id) {
      query += ` AND t.category_id = $${paramIndex}`;
      params.push(category_id);
      paramIndex++;
    }
    
    query += ` GROUP BY t.id, u.display_name, u.avatar_url, c.name, c.color`;
    query += ` ORDER BY t.is_pinned DESC, COALESCE(MAX(r.created_at), t.created_at) DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      topics: result.rows,
      page: parseInt(page),
      hasMore: result.rows.length === parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching forum topics:', error);
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

// Create forum topic
router.post('/forums/topics', authenticateToken, requireCreator, async (req, res) => {
  try {
    const { uid } = req.user;
    const { category_id, title, content } = req.body;
    
    const query = `
      INSERT INTO forum_topics (category_id, author_id, title, content)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const result = await pool.query(query, [category_id, uid, title, content]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating forum topic:', error);
    res.status(500).json({ error: 'Failed to create topic' });
  }
});

module.exports = router;