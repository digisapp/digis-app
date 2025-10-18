const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../utils/db');
const { logger } = require('../utils/secureLogger');
const crypto = require('crypto');
const router = express.Router();

// GET /api/fans/me - Fan views their own profile and privacy settings
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        supabase_id, username, display_name, profile_pic_url, bio,
        fan_privacy_visibility, fan_allow_dm, fan_allow_calls,
        fan_share_token, fan_share_token_expires_at, fan_allow_search
      FROM users
      WHERE supabase_id = $1`,
      [req.user.supabase_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Profile not found',
        timestamp: new Date().toISOString()
      });
    }

    const profile = result.rows[0];

    res.json({
      id: profile.supabase_id,
      username: profile.username,
      displayName: profile.display_name,
      avatarUrl: profile.profile_pic_url,
      bio: profile.bio,
      visibility: profile.fan_privacy_visibility || 'private',
      allowDm: profile.fan_allow_dm || 'interacted',
      allowCalls: profile.fan_allow_calls || 'interacted',
      allowSearch: profile.fan_allow_search || false,
      shareToken: profile.fan_share_token,
      shareTokenExpiresAt: profile.fan_share_token_expires_at
    });
  } catch (error) {
    logger.error('Error fetching fan profile:', error);
    res.status(500).json({
      error: 'Failed to fetch profile',
      timestamp: new Date().toISOString()
    });
  }
});

// PATCH /api/fans/me - Fan updates their privacy settings
router.patch('/me', authenticateToken, async (req, res) => {
  const {
    visibility,
    allowDm,
    allowCalls,
    allowSearch
  } = req.body;

  try {
    const updates = [];
    const values = [req.user.supabase_id];
    let paramCount = 1;

    if (visibility !== undefined) {
      paramCount++;
      updates.push(`fan_privacy_visibility = $${paramCount}`);
      values.push(visibility);
    }

    if (allowDm !== undefined) {
      paramCount++;
      updates.push(`fan_allow_dm = $${paramCount}`);
      values.push(allowDm);
    }

    if (allowCalls !== undefined) {
      paramCount++;
      updates.push(`fan_allow_calls = $${paramCount}`);
      values.push(allowCalls);
    }

    if (allowSearch !== undefined) {
      paramCount++;
      updates.push(`fan_allow_search = $${paramCount}`);
      values.push(allowSearch);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No updates provided',
        timestamp: new Date().toISOString()
      });
    }

    const result = await pool.query(
      `UPDATE users
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE supabase_id = $1
       RETURNING
         supabase_id, fan_privacy_visibility, fan_allow_dm,
         fan_allow_calls, fan_allow_search`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Profile not found',
        timestamp: new Date().toISOString()
      });
    }

    const updated = result.rows[0];

    logger.info('Fan privacy settings updated:', {
      fanId: req.user.supabase_id,
      updates: Object.keys(req.body)
    });

    res.json({
      success: true,
      visibility: updated.fan_privacy_visibility,
      allowDm: updated.fan_allow_dm,
      allowCalls: updated.fan_allow_calls,
      allowSearch: updated.fan_allow_search
    });
  } catch (error) {
    logger.error('Error updating fan privacy settings:', error);
    res.status(500).json({
      error: 'Failed to update privacy settings',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/fans/share/enable - Generate shareable link
router.post('/share/enable', authenticateToken, async (req, res) => {
  try {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await pool.query(
      `UPDATE users
       SET fan_share_token = $1,
           fan_share_token_expires_at = $2,
           updated_at = NOW()
       WHERE supabase_id = $3`,
      [token, expiresAt, req.user.supabase_id]
    );

    logger.info('Share link enabled for fan:', {
      fanId: req.user.supabase_id,
      expiresAt
    });

    res.json({
      success: true,
      token,
      expiresAt,
      shareUrl: `/c/${token}`
    });
  } catch (error) {
    logger.error('Error enabling share link:', error);
    res.status(500).json({
      error: 'Failed to enable share link',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/fans/share/disable - Revoke shareable link
router.post('/share/disable', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      `UPDATE users
       SET fan_share_token = NULL,
           fan_share_token_expires_at = NULL,
           updated_at = NOW()
       WHERE supabase_id = $1`,
      [req.user.supabase_id]
    );

    logger.info('Share link disabled for fan:', {
      fanId: req.user.supabase_id
    });

    res.json({
      success: true,
      message: 'Share link disabled'
    });
  } catch (error) {
    logger.error('Error disabling share link:', error);
    res.status(500).json({
      error: 'Failed to disable share link',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/fans/share/:token - Public endpoint for share card (noindex)
router.get('/share/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const result = await pool.query(
      `SELECT
        username, display_name, profile_pic_url, bio
      FROM users
      WHERE fan_share_token = $1
        AND fan_share_token_expires_at > NOW()
        AND fan_privacy_visibility = 'link'`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Share link not found or expired',
        timestamp: new Date().toISOString()
      });
    }

    const fan = result.rows[0];

    // Set noindex header
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');

    res.json({
      username: fan.username,
      displayName: fan.display_name,
      avatarUrl: fan.profile_pic_url,
      bio: fan.bio
    });
  } catch (error) {
    logger.error('Error fetching share card:', error);
    res.status(500).json({
      error: 'Failed to fetch share card',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/fans/:fanId - Creator views fan mini-profile (creator-scoped)
router.get('/:fanId', authenticateToken, async (req, res) => {
  const { fanId } = req.params;
  const creatorId = req.user.supabase_id;

  try {
    // Check if requester is creator or admin
    const requesterCheck = await pool.query(
      'SELECT is_creator, is_super_admin FROM users WHERE supabase_id = $1',
      [creatorId]
    );

    const isCreator = requesterCheck.rows[0]?.is_creator;
    const isAdmin = requesterCheck.rows[0]?.is_super_admin;

    // Check if fan is viewing their own profile
    const isOwner = creatorId === fanId;

    if (!isOwner && !isCreator && !isAdmin) {
      return res.status(403).json({
        error: 'Only creators can view fan profiles',
        timestamp: new Date().toISOString()
      });
    }

    // Get fan profile
    const fanResult = await pool.query(
      `SELECT
        supabase_id, username, display_name, profile_pic_url,
        fan_privacy_visibility, fan_allow_dm, fan_allow_calls
      FROM users
      WHERE supabase_id = $1`,
      [fanId]
    );

    if (fanResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Fan not found',
        timestamp: new Date().toISOString()
      });
    }

    const fan = fanResult.rows[0];

    // If owner or admin, return full profile
    if (isOwner || isAdmin) {
      return res.json({
        id: fan.supabase_id,
        username: fan.username,
        displayName: fan.display_name,
        avatarUrl: fan.profile_pic_url,
        visibility: fan.fan_privacy_visibility,
        allowDm: fan.fan_allow_dm,
        allowCalls: fan.fan_allow_calls
      });
    }

    // For creators, check relationship and visibility
    const hasRelationship = await pool.query(
      'SELECT creator_has_relationship($1, $2) as has_rel',
      [creatorId, fanId]
    );

    const canView =
      fan.fan_privacy_visibility === 'creators' ||
      (fan.fan_privacy_visibility === 'private' && hasRelationship.rows[0].has_rel);

    if (!canView) {
      return res.status(403).json({
        error: 'This fan profile is private',
        timestamp: new Date().toISOString()
      });
    }

    // Check messaging and calling permissions
    const canMessage = await pool.query(
      'SELECT can_creator_message_fan($1, $2) as can_message',
      [creatorId, fanId]
    );

    const canCall = await pool.query(
      'SELECT can_creator_call_fan($1, $2) as can_call',
      [creatorId, fanId]
    );

    // Return sanitized profile for creator
    res.json({
      id: fan.supabase_id,
      displayName: fan.display_name,
      avatarUrl: fan.profile_pic_url,
      permissions: {
        canMessage: canMessage.rows[0].can_message,
        canCall: canCall.rows[0].can_call
      }
    });
  } catch (error) {
    logger.error('Error fetching fan profile:', error);
    res.status(500).json({
      error: 'Failed to fetch fan profile',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/fans/:fanId/relationship - Check if creator has relationship with fan
router.get('/:fanId/relationship', authenticateToken, async (req, res) => {
  const { fanId } = req.params;
  const creatorId = req.user.supabase_id;

  try {
    const result = await pool.query(
      `SELECT
        relation_type,
        last_interaction_at,
        created_at
      FROM creator_fan_relationships
      WHERE creator_id = $1 AND fan_id = $2
      ORDER BY last_interaction_at DESC`,
      [creatorId, fanId]
    );

    res.json({
      hasRelationship: result.rows.length > 0,
      relationships: result.rows.map(r => ({
        type: r.relation_type,
        lastInteraction: r.last_interaction_at,
        since: r.created_at
      }))
    });
  } catch (error) {
    logger.error('Error checking relationship:', error);
    res.status(500).json({
      error: 'Failed to check relationship',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
