/**
 * PostgreSQL RLS Middleware - Sets JWT context for Row Level Security
 *
 * This middleware ensures that RLS policies using auth.uid() work correctly
 * by setting the JWT claims in the PostgreSQL session before each request.
 *
 * Without this, auth.uid() returns NULL → all RLS policies fail → 500 errors
 */

const { pool } = require('../utils/db');
const logger = require('../utils/logger');

/**
 * Middleware to attach a PostgreSQL client with JWT context to each request
 *
 * Usage in routes:
 *   - Use req.pg instead of pool for queries
 *   - Always call await req.pg.query('COMMIT') on success
 *   - Always call await req.pg.query('ROLLBACK') on error
 *
 * @param {Express.Request} req - Express request object (must have req.user set by auth middleware)
 * @param {Express.Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function withPgAndJwt(req, res, next) {
  let client;

  try {
    // Lazily acquire only for routes that need it
    client = await pool.connect();

    // Get the authenticated user's Supabase ID
    const supabaseId = req.user?.supabase_id || req.user?.uid || req.user?.sub;

    // Set JWT claims in the PostgreSQL session for RLS
    const claims = JSON.stringify({
      sub: supabaseId || null,
      role: supabaseId ? 'authenticated' : 'anon'
    });

    await client.query(
      "SELECT set_config('request.jwt.claims', $1, true)",
      [claims]
    );

    // Attach to req
    req.pg = client;

    // Ensure release - single cleanup handler
    const releaseOnce = () => {
      if (client) {
        try {
          client.release();
          client = null; // Prevent double-release
        } catch (_) {}
      }
    };

    res.on('finish', releaseOnce);
    res.on('close', releaseOnce);

    next();
  } catch (err) {
    if (client) {
      try {
        client.release();
      } catch (_) {}
    }
    next(err);
  }
}

/**
 * Helper function to wrap route handlers with automatic transaction management
 *
 * Usage:
 *   router.get('/creators', withTransaction(async (req, res) => {
 *     const { rows } = await req.pg.query('SELECT * FROM users WHERE is_creator = true');
 *     res.json({ creators: rows });
 *   }));
 *
 * @param {Function} handler - Async route handler function
 * @returns {Function} Express route handler with transaction management
 */
function withTransaction(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);

      // Commit transaction if response was successful
      if (req.pg && !res.headersSent) {
        await req.pg.query('COMMIT');
      }
    } catch (error) {
      // Rollback transaction on error
      if (req.pg) {
        try {
          await req.pg.query('ROLLBACK');
        } catch (rollbackError) {
          logger.error('Rollback failed in route handler', {
            error: rollbackError.message
          });
        }
      }

      next(error);
    }
  };
}

/**
 * Middleware for public routes that don't require authentication
 * Sets up PostgreSQL client with empty JWT context
 *
 * Use this for routes that are publicly accessible but might need database access
 */
async function withPgPublic(req, res, next) {
  let client;

  try {
    client = await pool.connect();
    req.pg = client;

    const releaseClient = () => {
      if (client && !client._ended) {
        client.release();
      }
    };

    res.on('finish', releaseClient);
    res.on('close', releaseClient);

    await client.query('BEGIN');
    await client.query("SELECT set_config('request.jwt.claims', '{}', true)", ['{}']);

    next();
  } catch (error) {
    logger.error('Failed to set PostgreSQL context for public route', {
      error: error.message,
      requestId: req.id,
      path: req.path
    });

    if (client && !client._ended) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        logger.error('Rollback failed', { error: rollbackError.message });
      }
      client.release();
    }

    next(error);
  }
}

module.exports = {
  withPgAndJwt,
  withTransaction,
  withPgPublic
};
