/**
 * Inngest Event Trigger Endpoint
 *
 * Allows triggering Inngest events via HTTP (for QStash Cron or manual triggers)
 *
 * POST /api/inngest/trigger
 * Body: { name: "event.name", data: {...} }
 */

const { inngest } = require('../inngest/client');
const { logger } = require('../utils/secureLogger');

async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, data } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Event name is required' });
    }

    // Send event to Inngest
    const eventId = await inngest.send({
      name,
      data: data || {},
    });

    logger.info('Inngest event triggered', {
      eventName: name,
      eventId,
      triggeredBy: req.user?.id || 'system',
    });

    res.status(200).json({
      success: true,
      eventId,
      eventName: name,
    });
  } catch (error) {
    logger.error('Failed to trigger Inngest event', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: 'Failed to trigger event',
      message: error.message,
    });
  }
}

module.exports = handler;
