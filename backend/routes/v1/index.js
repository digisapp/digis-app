const express = require('express');
const router = express.Router();

// Import all v1 routes
const authRoutes = require('../auth');
const userRoutes = require('../users');
const tokenRoutes = require('../tokens');
const paymentRoutes = require('../payments');
const agoraRoutes = require('../agora');
const subscriptionRoutes = require('../enhanced-subscriptions');
const creatorRoutes = require('../creators');
const streamingRoutes = require('../streaming');
const streamChatRoutes = require('../stream-chat');
const streamFeaturesRoutes = require('../stream-features');

// Mount v1 routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/tokens', tokenRoutes);
router.use('/payments', paymentRoutes);
router.use('/agora', agoraRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/creators', creatorRoutes);
router.use('/streaming', streamingRoutes);
router.use('/stream-chat', streamChatRoutes);
router.use('/stream-features', streamFeaturesRoutes);

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
      '/creators',
      '/streaming',
      '/stream-chat',
      '/stream-features'
    ]
  });
});

module.exports = router;