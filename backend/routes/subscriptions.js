const express = require('express');
const router = express.Router();

// Placeholder for subscription routes
// This functionality has been moved to subscription-tiers.js

router.get('/', (req, res) => {
  res.status(301).json({
    message: 'Subscriptions API has been migrated',
    newEndpoint: '/api/v1/subscription-tiers'
  });
});

module.exports = router;