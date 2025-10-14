/**
 * Background job to expire stale call invitations
 *
 * Runs every 30 seconds to clean up invitations that have passed their expiration time
 * Also updates associated call records to "missed" state
 */

const { pool } = require('../utils/db');
const { logger } = require('../utils/secureLogger');

let intervalId = null;

async function expireStaleInvitations() {
  try {
    // Find all expired pending invitations
    const result = await pool.query(
      `UPDATE call_invitations
       SET state = 'expired',
           responded_at = NOW()
       WHERE state = 'pending'
         AND expires_at < NOW()
       RETURNING id, call_id`
    );

    if (result.rows.length > 0) {
      logger.info('Expired call invitations', {
        count: result.rows.length,
        invitationIds: result.rows.map(r => r.id)
      });

      // Update associated call records to "missed"
      const callIds = result.rows.map(r => r.call_id);

      await pool.query(
        `UPDATE calls
         SET state = 'missed',
             ended_at = NOW(),
             end_reason = 'timeout',
             updated_at = NOW()
         WHERE id = ANY($1)
           AND state = 'ringing'`,
        [callIds]
      );

      logger.info('Updated missed calls', {
        callIds
      });
    }
  } catch (error) {
    logger.error('Error expiring call invitations:', {
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * Start the expiration job
 * Runs every 30 seconds
 */
function start() {
  if (intervalId) {
    logger.warn('Call invitation expiration job already running');
    return;
  }

  // Run immediately on start
  expireStaleInvitations();

  // Then run every 30 seconds
  intervalId = setInterval(expireStaleInvitations, 30000);

  logger.info('Call invitation expiration job started (runs every 30s)');
}

/**
 * Stop the expiration job
 */
function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Call invitation expiration job stopped');
  }
}

module.exports = {
  start,
  stop,
  expireStaleInvitations
};
