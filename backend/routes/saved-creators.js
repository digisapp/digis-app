const express = require('express');
const router = express.Router();
const { query } = require('../utils/db');
const { authenticateToken } = require('../middleware/auth');
const { param, body, validationResult } = require('express-validator');
const logger = require('../utils/logger');

// Get all saved creators for the authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(`
      SELECT
        sc.id,
        sc.creator_id,
        sc.saved_at,
        sc.notes,
        sc.notification_enabled,
        u.username,
        u.display_name,
        u.avatar_url,
        u.bio,
        u.is_verified,
        u.is_online,
        u.creator_type,
        u.video_call_rate,
        u.voice_call_rate,
        u.text_message_price,
        (SELECT COUNT(*) FROM follows WHERE followed_id = sc.creator_id) as follower_count
      FROM saved_creators sc
      INNER JOIN users u ON u.supabase_id = sc.creator_id
      WHERE sc.user_id = $1
      ORDER BY sc.saved_at DESC
    `, [userId]);

    res.json({
      success: true,
      savedCreators: result.rows
    });
  } catch (error) {
    logger.error('Error fetching saved creators:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch saved creators'
    });
  }
});

// Check if a creator is saved
router.get('/check/:creatorId',
  authenticateToken,
  param('creatorId').isUUID(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user.id;
      const { creatorId } = req.params;

      const result = await query(`
        SELECT id, notes, notification_enabled, saved_at
        FROM saved_creators
        WHERE user_id = $1 AND creator_id = $2
      `, [userId, creatorId]);

      res.json({
        success: true,
        isSaved: result.rows.length > 0,
        savedData: result.rows[0] || null
      });
    } catch (error) {
      logger.error('Error checking saved status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check saved status'
      });
    }
});

// Save/bookmark a creator
router.post('/',
  authenticateToken,
  body('creatorId').isUUID(),
  body('notes').optional().isString().trim(),
  body('notificationEnabled').optional().isBoolean(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user.id;
      const { creatorId, notes = '', notificationEnabled = false } = req.body;

      // Check if creator exists
      const creatorCheck = await query(
        'SELECT supabase_id FROM users WHERE supabase_id = $1 AND is_creator = true',
        [creatorId]
      );

      if (creatorCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Creator not found'
        });
      }

      // Check if already saved
      const existingCheck = await query(
        'SELECT id FROM saved_creators WHERE user_id = $1 AND creator_id = $2',
        [userId, creatorId]
      );

      if (existingCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Creator already saved'
        });
      }

      // Save the creator
      const result = await query(`
        INSERT INTO saved_creators (user_id, creator_id, notes, notification_enabled)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [userId, creatorId, notes, notificationEnabled]);

      logger.info(`User ${userId} saved creator ${creatorId}`);

      res.status(201).json({
        success: true,
        message: 'Creator saved successfully',
        savedCreator: result.rows[0]
      });
    } catch (error) {
      logger.error('Error saving creator:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to save creator'
      });
    }
});

// Update saved creator (notes, notifications)
router.put('/:creatorId',
  authenticateToken,
  param('creatorId').isUUID(),
  body('notes').optional().isString().trim(),
  body('notificationEnabled').optional().isBoolean(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user.id;
      const { creatorId } = req.params;
      const { notes, notificationEnabled } = req.body;

      // Build update query dynamically
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (notes !== undefined) {
        updates.push(`notes = $${paramCount++}`);
        values.push(notes);
      }

      if (notificationEnabled !== undefined) {
        updates.push(`notification_enabled = $${paramCount++}`);
        values.push(notificationEnabled);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No updates provided'
        });
      }

      values.push(userId, creatorId);

      const result = await query(`
        UPDATE saved_creators
        SET ${updates.join(', ')}
        WHERE user_id = $${paramCount} AND creator_id = $${paramCount + 1}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Saved creator not found'
        });
      }

      res.json({
        success: true,
        message: 'Saved creator updated',
        savedCreator: result.rows[0]
      });
    } catch (error) {
      logger.error('Error updating saved creator:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update saved creator'
      });
    }
});

// Remove a saved creator
router.delete('/:creatorId',
  authenticateToken,
  param('creatorId').isUUID(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user.id;
      const { creatorId } = req.params;

      const result = await query(
        'DELETE FROM saved_creators WHERE user_id = $1 AND creator_id = $2 RETURNING id',
        [userId, creatorId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Saved creator not found'
        });
      }

      logger.info(`User ${userId} removed saved creator ${creatorId}`);

      res.json({
        success: true,
        message: 'Creator removed from saved list'
      });
    } catch (error) {
      logger.error('Error removing saved creator:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove saved creator'
      });
    }
});

// Get creators with notifications enabled (for notification service)
router.get('/notifications-enabled', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(`
      SELECT
        sc.creator_id,
        u.username,
        u.display_name
      FROM saved_creators sc
      INNER JOIN users u ON u.supabase_id = sc.creator_id
      WHERE sc.user_id = $1 AND sc.notification_enabled = true
    `, [userId]);

    res.json({
      success: true,
      creators: result.rows
    });
  } catch (error) {
    logger.error('Error fetching creators with notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch creators with notifications enabled'
    });
  }
});

module.exports = router;