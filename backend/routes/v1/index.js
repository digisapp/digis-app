const express = require('express');
const router = express.Router();

// Import all v1 routes
const authRoutes = require('../auth');
const userRoutes = require('../users');
const tokenRoutes = require('../tokens');
const paymentRoutes = require('../payments');
const agoraRoutes = require('../agora');
const subscriptionRoutes = require('../subscriptions');
const creatorRoutes = require('../creators');

// Mount v1 routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/tokens', tokenRoutes);
router.use('/payments', paymentRoutes);
router.use('/agora', agoraRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/creators', creatorRoutes);

// v1 specific endpoints
router.get('/status', (req, res) => {
  res.json({
    version: 'v1',
    status: 'active',
    endpoints: [
      '/auth',
      '/users', 
      '/tokens',
      '/payments',
      '/agora',
      '/subscriptions',
      '/creators'
    ]
  });
});

module.exports = router;