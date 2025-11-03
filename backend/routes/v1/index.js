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
const publicConnectRoutes = require('../public-connect');
const classesRoutes = require('../classes');
const tvSubscriptionRoutes = require('../tv-subscription');
const realtimeRoutes = require('../realtime');
const shopRoutes = require('../shop');
const adminRoutes = require('../admin');
const messagesRoutes = require('../messages');
const subscriptionTiersRoutes = require('../subscription-tiers');
const contentRoutes = require('../content-supabase');

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
router.use('/public', publicConnectRoutes);
router.use('/classes', classesRoutes);
router.use('/tv-subscription', tvSubscriptionRoutes);
router.use('/realtime', realtimeRoutes);
router.use('/shop', shopRoutes);
router.use('/admin', adminRoutes);
router.use('/messages', messagesRoutes);
router.use('/subscription-tiers', subscriptionTiersRoutes);
router.use('/content', contentRoutes);

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
      '/stream-features',
      '/public',
      '/classes',
      '/tv-subscription',
      '/realtime',
      '/shop',
      '/admin'
    ]
  });
});

// Quick introspection endpoint for Vercel debugging
router.get('/_status', (req, res) => {
  res.json({
    ok: true,
    mounted: true,
    message: 'v1 router is loaded and mounted',
    endpoints: ['/auth', '/users', '/tokens', '/payments', '/agora', '/subscriptions', '/creators', '/streaming', '/stream-chat', '/stream-features', '/public', '/classes', '/tv-subscription', '/realtime', '/shop', '/admin'],
    timestamp: new Date().toISOString()
  });
});

module.exports = router;