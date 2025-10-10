const express = require('express');
const router = express.Router();

/**
 * Meta endpoint - Returns deployment information
 * Use this to verify which code is actually running in production
 */
router.get('/meta', (req, res) => {
  res.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_SHA || 'unknown',
    commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE || 'unknown',
    branch: process.env.VERCEL_GIT_COMMIT_REF || 'unknown',
    deployedAt: process.env.VERCEL_DEPLOYMENT_TIME || new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    vercelUrl: process.env.VERCEL_URL || 'local',
    timestamp: new Date().toISOString(),
    // Include a marker so we know the fix is deployed
    hasSessionsOptimization: true,
    hasMetricsFlag: process.env.METRICS_ENABLED !== undefined
  });
});

module.exports = router;
