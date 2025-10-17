const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

/**
 * POST /api/client-log
 *
 * Receives client-side error logs from error boundaries for debugging.
 * No authentication required during investigation (can be added later).
 *
 * Logs are written to backend/logs/client-errors.log
 */
router.post('/', async (req, res) => {
  try {
    const { route, message, error, stack, componentStack, timestamp, isHook310, errorNumber, userAgent, url } = req.body;

    // Log to backend with structured format
    logger.error('CLIENT_ERROR', {
      route,
      message,
      error,
      isHook310,
      errorNumber,
      timestamp,
      url,
      userAgent,
      // Include stack traces in separate fields for better readability
      jsStack: stack,
      componentStack: componentStack
    });

    // If it's a hook error, log with special marker for easy filtering
    if (isHook310) {
      logger.error(`🚨 HOOK_ERROR_310 in route: ${route}`);
      logger.error(`Component stack: ${componentStack}`);
    }

    // Return success immediately (don't make client wait)
    res.status(200).json({ logged: true });
  } catch (error) {
    // Don't fail the request even if logging fails
    logger.error('Failed to log client error:', error);
    res.status(200).json({ logged: false, error: 'Failed to log' });
  }
});

module.exports = router;
