/**
 * Username Management Routes
 *
 * Handles username availability checks and updates.
 * Ensures Instagram-style unique vanity URLs (digis.cc/miriam)
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { validateUsername, normalizeUsername, getErrorMessage } = require('../utils/usernameValidator');
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/secureLogger');

/**
 * GET /api/public/usernames/availability
 *
 * Check if a username is available for use.
 * This is for UX feedback only - actual claim happens in update endpoint.
 *
 * Query params:
 * - username: The username to check
 *
 * Returns:
 * - available: boolean
 * - reason: 'ok' | 'taken' | 'reserved' | 'invalid_format' | 'quarantined'
 * - message: User-friendly message
 */
router.get('/public/usernames/availability', async (req, res) => {
  try {
    const raw = req.query.username;

    // Validate format first (quick local check)
    const validation = validateUsername(raw);

    if (!validation.ok) {
      return res.status(200).json({
        available: false,
        reason: validation.reason,
        message: validation.message
      });
    }

    const { username } = validation;

    // Check if taken in database (case-insensitive)
    const takenCheck = await pool.query(
      'SELECT 1 FROM public.users WHERE LOWER(username) = LOWER($1) LIMIT 1',
      [username]
    );

    if (takenCheck.rows.length > 0) {
      return res.json({
        available: false,
        reason: 'taken',
        message: 'That username is already taken.'
      });
    }

    // Check if in quarantine (recently released by another user)
    const quarantineCheck = await pool.query(
      `SELECT 1 FROM public.username_quarantine
       WHERE LOWER(username) = LOWER($1)
         AND available_at > NOW()
         AND claimed_at IS NULL
       LIMIT 1`,
      [username]
    );

    if (quarantineCheck.rows.length > 0) {
      return res.json({
        available: false,
        reason: 'quarantined',
        message: 'That username was recently released and is not yet available.'
      });
    }

    // Username is available!
    return res.json({
      available: true,
      reason: 'ok',
      message: 'Username is available!',
      username
    });

  } catch (error) {
    logger.error('Username availability check failed', {
      error: error.message,
      stack: error.stack,
      username: req.query.username
    });

    return res.status(500).json({
      available: false,
      reason: 'error',
      message: 'Error checking username availability. Please try again.'
    });
  }
});

/**
 * PATCH /api/users/me/username
 *
 * Update the authenticated user's username.
 * Enforces:
 * - Format validation
 * - Uniqueness (via DB unique index)
 * - 30-day cooldown between changes
 * - Quarantine check for recently released names
 * - Audit logging
 *
 * Body:
 * - username: New username to claim
 *
 * Returns:
 * - ok: boolean
 * - username: Claimed username
 * - url: Vanity URL (digis.cc/username)
 */
router.patch('/users/me/username', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const raw = req.body.username;
    const userId = req.user.supabase_id; // From auth middleware

    // Validate format first
    const validation = validateUsername(raw);

    if (!validation.ok) {
      return res.status(400).json({
        ok: false,
        error: validation.message,
        reason: validation.reason
      });
    }

    const { username } = validation;

    await client.query('BEGIN');

    // Get current user data
    const userResult = await client.query(
      `SELECT id, username, username_changed_at
       FROM public.users
       WHERE supabase_id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        ok: false,
        error: 'User not found.',
        reason: 'not_found'
      });
    }

    const user = userResult.rows[0];
    const userDbId = user.id;
    const currentUsername = user.username;
    const lastChanged = user.username_changed_at;

    // Check if user is trying to set the same username (no-op)
    if (currentUsername && currentUsername.toLowerCase() === username.toLowerCase()) {
      await client.query('ROLLBACK');
      return res.json({
        ok: true,
        username: currentUsername,
        url: `https://digis.cc/${currentUsername}`,
        message: 'Username unchanged.'
      });
    }

    // Enforce 30-day cooldown (unless this is their first time setting username)
    if (lastChanged && currentUsername) {
      const daysSinceChange = (Date.now() - new Date(lastChanged).getTime()) / (1000 * 60 * 60 * 24);
      const cooldownDays = 30;

      if (daysSinceChange < cooldownDays) {
        const daysRemaining = Math.ceil(cooldownDays - daysSinceChange);
        await client.query('ROLLBACK');

        return res.status(429).json({
          ok: false,
          error: `You can change your username again in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}.`,
          reason: 'cooldown',
          cooldownDays: cooldownDays,
          daysRemaining: daysRemaining
        });
      }
    }

    // Check if username is in quarantine
    const quarantineCheck = await client.query(
      `SELECT available_at
       FROM public.username_quarantine
       WHERE LOWER(username) = LOWER($1)
         AND available_at > NOW()
         AND claimed_at IS NULL
       LIMIT 1`,
      [username]
    );

    if (quarantineCheck.rows.length > 0) {
      const availableDate = new Date(quarantineCheck.rows[0].available_at);
      await client.query('ROLLBACK');

      return res.status(409).json({
        ok: false,
        error: `That username is in quarantine until ${availableDate.toLocaleDateString()}.`,
        reason: 'quarantined',
        availableAt: availableDate.toISOString()
      });
    }

    // Attempt to update username (unique index will prevent duplicates)
    try {
      await client.query(
        `UPDATE public.users
         SET username = $1,
             previous_username = $2,
             username_changed_at = NOW()
         WHERE id = $3`,
        [username, currentUsername, userDbId]
      );
    } catch (updateError) {
      // Unique constraint violation (23505) = username taken
      if (updateError.code === '23505') {
        await client.query('ROLLBACK');

        return res.status(409).json({
          ok: false,
          error: 'That username is already taken.',
          reason: 'taken'
        });
      }

      throw updateError; // Re-throw other errors
    }

    // If user had a previous username, add it to quarantine
    if (currentUsername) {
      await client.query(
        `INSERT INTO public.username_quarantine (username, released_by_user_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [currentUsername, userDbId]
      );
    }

    // Log the change for audit trail
    await client.query(
      `INSERT INTO public.username_changes (user_id, old_username, new_username, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userDbId,
        currentUsername,
        username,
        req.ip || req.connection.remoteAddress,
        req.get('User-Agent') || null
      ]
    );

    await client.query('COMMIT');

    logger.info('Username changed', {
      userId: userDbId,
      oldUsername: currentUsername,
      newUsername: username,
      ip: req.ip
    });

    return res.json({
      ok: true,
      username,
      url: `https://digis.cc/${username}`,
      message: 'Username updated successfully!',
      previousUsername: currentUsername
    });

  } catch (error) {
    await client.query('ROLLBACK');

    logger.error('Username update failed', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.supabase_id,
      requestedUsername: req.body.username
    });

    return res.status(500).json({
      ok: false,
      error: 'Failed to update username. Please try again.',
      reason: 'error'
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/users/me/username/history
 *
 * Get username change history for the authenticated user
 */
router.get('/users/me/username/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;

    // Get user's database ID
    const userResult = await pool.query(
      'SELECT id FROM public.users WHERE supabase_id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'User not found.'
      });
    }

    const userDbId = userResult.rows[0].id;

    // Get change history
    const historyResult = await pool.query(
      `SELECT old_username, new_username, changed_at
       FROM public.username_changes
       WHERE user_id = $1
       ORDER BY changed_at DESC
       LIMIT 20`,
      [userDbId]
    );

    return res.json({
      ok: true,
      history: historyResult.rows
    });

  } catch (error) {
    logger.error('Failed to fetch username history', {
      error: error.message,
      userId: req.user?.supabase_id
    });

    return res.status(500).json({
      ok: false,
      error: 'Failed to fetch history.'
    });
  }
});

module.exports = router;
