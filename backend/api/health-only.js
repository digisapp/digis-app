/**
 * Minimal health check endpoint for debugging Vercel deployment
 * This file bypasses all middleware and initialization to verify basic function execution
 */

const express = require('express');
const app = express();

// Simplest possible health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: 'Minimal health check - no middleware loaded',
    env: {
      nodeVersion: process.version,
      platform: process.platform,
      vercel: !!process.env.VERCEL,
      hasDatabase: !!process.env.DATABASE_URL,
      hasStripe: !!process.env.STRIPE_SECRET_KEY,
      hasAgora: !!process.env.AGORA_APP_ID,
    }
  });
});

// Catch-all
app.get('*', (req, res) => {
  res.json({ message: 'Minimal backend test', path: req.path });
});

module.exports = app;
