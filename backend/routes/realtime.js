const express = require('express');
const router = express.Router();
const Ably = require('ably');
const { verifySupabaseToken } = require('../middleware/auth');
const { logger } = require('../utils/secureLogger');

/**
 * @swagger
 * /realtime/ably/token:
 *   post:
 *     summary: Generate Ably token for authenticated user (client should use authUrl, not expose keys)
 *     description: |
 *       Returns server-signed Ably token for real-time features.
 *       Prevents exposing ABLY_API_KEY to browser.
 *       Frontend should configure Ably client with: authUrl: '/api/v1/realtime/ably/token'
 *     tags: [Realtime]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               clientId:
 *                 type: string
 *                 description: Optional client identifier (defaults to user ID)
 *               capability:
 *                 type: object
 *                 description: Optional channel capabilities (defaults to user's channels)
 *     responses:
 *       200:
 *         description: Ably token generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 *                   description: Ably token string
 *                 expires:
 *                   type: number
 *                   description: Token expiration timestamp (ms)
 *                 clientId:
 *                   type: string
 *                   description: Client identifier
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Failed to generate token
 */
router.post('/ably/token', verifySupabaseToken, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    // Verify Ably is configured
    if (!process.env.ABLY_API_KEY) {
      logger.error('ABLY_API_KEY not configured');
      return res.status(500).json({
        success: false,
        error: 'Realtime service not configured'
      });
    }

    // Initialize Ably REST client
    const ably = new Ably.Rest(process.env.ABLY_API_KEY);

    // Define user-specific channel capabilities
    // Allow user to:
    // - Subscribe to their own user channel (user:{userId})
    // - Subscribe to public channels (streams, global)
    // - Publish to streams they're participating in
    const capability = req.body?.capability || {
      [`user:${userId}`]: ['subscribe', 'presence'],
      'stream:*': ['subscribe', 'presence'],
      'global': ['subscribe'],
      'public:*': ['subscribe']
    };

    // Generate token request with user ID as clientId
    const tokenParams = {
      clientId: req.body?.clientId || userId,
      capability: JSON.stringify(capability),
      ttl: 60 * 60 * 1000 // 1 hour
    };

    // Create token request
    const tokenRequest = await ably.auth.createTokenRequest(tokenParams);

    logger.info('Ably token generated', {
      userId,
      clientId: tokenRequest.clientId,
      ttl: tokenParams.ttl
    });

    return res.json({
      success: true,
      token: tokenRequest,
      expires: Date.now() + tokenParams.ttl,
      clientId: tokenRequest.clientId
    });

  } catch (error) {
    logger.error('Failed to generate Ably token', {
      error: error.message,
      userId: req.user?.id
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to generate realtime token',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /realtime/health:
 *   get:
 *     summary: Check realtime service health
 *     tags: [Realtime]
 *     responses:
 *       200:
 *         description: Realtime service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 status:
 *                   type: string
 *                 configured:
 *                   type: boolean
 */
router.get('/health', (req, res) => {
  const configured = !!process.env.ABLY_API_KEY;

  return res.json({
    success: true,
    status: configured ? 'healthy' : 'not_configured',
    configured
  });
});

module.exports = router;
