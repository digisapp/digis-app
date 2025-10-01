const express = require('express');
const router = express.Router();
const metricsCollector = require('../utils/metrics-collector');
const { authenticateToken } = require('../middleware/auth');

// Prometheus metrics endpoint (no auth for scraping)
router.get('/prometheus', async (req, res) => {
  try {
    res.set('Content-Type', 'text/plain');
    const metrics = await metricsCollector.getPrometheusMetrics();
    res.send(metrics);
  } catch (error) {
    console.error('Error getting Prometheus metrics:', error);
    res.status(500).send('Error collecting metrics');
  }
});

// JSON metrics endpoint (requires auth)
router.get('/json', authenticateToken, async (req, res) => {
  try {
    const metrics = await metricsCollector.getJSONMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error getting JSON metrics:', error);
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
});

// Database metrics
router.get('/database', authenticateToken, async (req, res) => {
  try {
    const metrics = await metricsCollector.collectDatabaseMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error collecting database metrics:', error);
    res.status(500).json({ error: 'Failed to collect database metrics' });
  }
});

// Business metrics
router.get('/business', authenticateToken, async (req, res) => {
  try {
    const metrics = await metricsCollector.collectBusinessMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error collecting business metrics:', error);
    res.status(500).json({ error: 'Failed to collect business metrics' });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const db = require('../utils/db');
    
    // Check database connection
    const dbCheck = await db.query('SELECT 1');
    
    // Check Supabase connection
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data, error } = await supabase.from('users').select('count').limit(1);
    
    if (error) throw error;
    
    res.json({
      status: 'healthy',
      timestamp: new Date(),
      checks: {
        database: 'ok',
        supabase: 'ok',
        memory: process.memoryUsage(),
        uptime: process.uptime()
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date()
    });
  }
});

// Readiness check
router.get('/ready', async (req, res) => {
  try {
    const db = require('../utils/db');
    await db.query('SELECT 1');
    res.json({ ready: true });
  } catch (error) {
    res.status(503).json({ ready: false, error: error.message });
  }
});

// Liveness check
router.get('/live', (req, res) => {
  res.json({ alive: true, timestamp: new Date() });
});

module.exports = router;