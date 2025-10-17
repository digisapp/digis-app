/**
 * Health Check Routes
 *
 * Lightweight endpoints for monitoring backend and database health
 * without performing expensive operations
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../utils/db');

/**
 * GET /healthz
 * Ultra-cheap health check that doesn't touch the database
 * Returns 200 if the backend is responding
 */
router.get('/healthz', (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'digis-backend',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'unknown'
  });
});

/**
 * GET /dbz
 * Database connectivity check with 2s timeout
 * Returns 200 if database is reachable
 */
router.get('/dbz', async (req, res) => {
  const pool = getPool();

  try {
    // Create abort controller for 2s timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    // Simple SELECT 1 query
    const result = await pool.query('SELECT 1 as health');
    clearTimeout(timeout);

    res.status(200).json({
      ok: true,
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      database: 'unavailable',
      error: error.name === 'AbortError' ? 'timeout' : 'connection-failed',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
