const express = require('express');
const router = express.Router();
const db = require('../utils/db');

// Get public collaborations (no auth required)
router.get('/collaborations', async (req, res) => {
  try {
    // Table doesn't exist yet - return empty array
    res.json({
      success: true,
      collaborations: []
    });
  } catch (error) {
    console.error('Error fetching public collaborations:', error);
    res.status(500).json({ error: 'Failed to fetch collaborations' });
  }
});

// Get public experiences (no auth required)
router.get('/experiences', async (req, res) => {
  try {
    // Table doesn't exist yet - return empty array
    res.json({
      success: true,
      experiences: []
    });
  } catch (error) {
    console.error('Error fetching public experiences:', error);
    res.status(500).json({ error: 'Failed to fetch experiences' });
  }
});

// Get featured creators (no auth required)
router.get('/creators/featured', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        supabase_id as id,
        username,
        display_name,
        bio,
        profile_pic_url,
        COALESCE(creator_rate, voice_rate, stream_rate, 0) as price_per_min,
        is_online,
        is_verified,
        total_sessions,
        total_earnings
      FROM users 
      WHERE is_creator = TRUE 
        AND is_verified = TRUE
      ORDER BY total_sessions DESC, total_earnings DESC
      LIMIT 6
    `);
    
    res.json({
      success: true,
      creators: result.rows
    });
  } catch (error) {
    console.error('Error fetching featured creators:', error);
    res.status(500).json({ error: 'Failed to fetch featured creators' });
  }
});

// Get live streams (no auth required)
router.get('/streams/live', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        s.id,
        s.title,
        s.description,
        s.thumbnail_url,
        s.viewer_count,
        s.started_at,
        u.supabase_id as creator_id,
        u.username as creator_username,
        u.display_name as creator_display_name,
        u.profile_pic_url as creator_avatar
      FROM streams s
      JOIN users u ON s.creator_id = u.id
      WHERE s.status = 'live'
      ORDER BY s.viewer_count DESC
    `);
    
    res.json({
      success: true,
      streams: result.rows
    });
  } catch (error) {
    console.error('Error fetching live streams:', error);
    res.status(500).json({ error: 'Failed to fetch live streams' });
  }
});

// Get upcoming streams (no auth required)
router.get('/streams/upcoming', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        s.id,
        s.title,
        s.description,
        s.thumbnail_url,
        s.started_at as scheduled_at,
        u.supabase_id as creator_id,
        u.username as creator_username,
        u.display_name as creator_display_name,
        u.profile_pic_url as creator_avatar
      FROM streams s
      JOIN users u ON s.creator_id = u.id
      WHERE s.status = 'scheduled'
        AND s.started_at > NOW()
      ORDER BY s.started_at ASC
      LIMIT 10
    `);
    
    res.json({
      success: true,
      streams: result.rows
    });
  } catch (error) {
    console.error('Error fetching upcoming streams:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming streams' });
  }
});

// Get stream replays (no auth required)
router.get('/streams/replays', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        r.id,
        r.title,
        r.description,
        r.thumbnail_url,
        r.duration as duration_seconds,
        r.view_count,
        r.created_at,
        u.supabase_id as creator_id,
        u.username as creator_username,
        u.display_name as creator_display_name,
        u.profile_pic_url as creator_avatar
      FROM stream_recordings r
      JOIN users u ON r.creator_id = u.id
      ORDER BY r.created_at DESC
      LIMIT 20
    `);
    
    res.json({
      success: true,
      replays: result.rows
    });
  } catch (error) {
    console.error('Error fetching stream replays:', error);
    res.status(500).json({ error: 'Failed to fetch stream replays' });
  }
});

module.exports = router;