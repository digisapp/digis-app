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
    // Acquire a dedicated client from the pool for this request
    client = await pool.connect();
    req.pg = client;

    // Release client when response finishes or closes
    const releaseClient = () => {
      if (client && !client._ended) {
        client.release();
      }
    };

    res.on('finish', releaseClient);
    res.on('close', releaseClient);

    // Start a transaction for this request
    await client.query('BEGIN');

    // Get the authenticated user's Supabase ID
    const supabaseId = req.user?.supabase_id || req.user?.uid || req.user?.sub;

    if (supabaseId) {
      // Set JWT claims in the PostgreSQL session
      // This makes auth.uid() work in RLS policies
      const claims = JSON.stringify({
        sub: supabaseId,
        role: 'authenticated'
      });

      await client.query(
        "SELECT set_config('request.jwt.claims', $1, true)",
        [claims]
      );

      if (logger.debug) {
        logger.debug('PostgreSQL JWT context set', {
          supabaseId,
          requestId: req.id || req.requestId,
          path: req.path
        });
      }
    } else {
      // No authenticated user - backend service connection
      // Set empty claims - the connection will bypass RLS for service operations
      // This is expected for backend service role operations
      await client.query(
        "SELECT set_config('request.jwt.claims', '{}', true)",
        ['{}']
      );

      if (logger.debug) {
        logger.debug('PostgreSQL JWT context set (service/anonymous)', {
          requestId: req.id || req.requestId,
          path: req.path
        });
      }
    }

    next();
  } catch (error) {
    logger.error('Failed to set PostgreSQL JWT context', {
      error: error.message,
      stack: error.stack,
      requestId: req.id,
      path: req.path
    });

    // Release client on error
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
