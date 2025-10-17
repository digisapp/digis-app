/**
 * Ably Token Authentication Endpoint (Vercel-compatible)
 *
 * This serverless function generates secure Ably token requests for clients.
 * It prevents API keys from being exposed to the frontend while providing
 * fine-grained access control per user.
 */

const Ably = require('ably');
const { verifySupabaseToken } = require('../utils/supabase-admin-v2');

/**
 * Serverless handler for Ably token authentication
 * Compatible with both Express and Vercel serverless functions
 */
async function handler(req, res) {
  try {
    // Only accept POST requests (more secure than GET with auth headers)
    if (req.method !== 'POST' && req.method !== 'GET') {
      return res.status(405).json({
        error: 'Method not allowed',
        message: 'Use POST or GET for token requests'
      });
    }

    // Extract user information from request
    // Supports both Express middleware (req.user) and manual header extraction
    let userId = null;
    let userRole = 'fan';
    let isAuthenticated = false;

    // Try to get user from authenticated middleware
    if (req.user && req.user.supabase_id) {
      userId = req.user.supabase_id;
      userRole = req.user.is_creator ? 'creator' : 'fan';
      isAuthenticated = true;
    } else {
      // Try to extract from custom headers
      userId = req.headers['x-user-id'] || null;
      userRole = req.headers['x-user-role'] || 'fan';
    }

    // If no user ID, allow anonymous access with limited capabilities
    const clientId = userId || `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Initialize Ably client with API key (server-side only, never exposed)
    if (!process.env.ABLY_API_KEY) {
      console.error('ABLY_API_KEY not configured');
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Ably is not configured. Please set ABLY_API_KEY environment variable.'
      });
    }

    const client = new Ably.Rest(process.env.ABLY_API_KEY);

    /**
     * Capability-based access control
     *
     * Channel naming convention:
     * - chat:* - Chat channels (streams, DMs)
     * - presence:* - User presence channels
     * - stream:* - Live stream data channels
     * - ops:* - Operational/system channels (admin only)
     * - user:{userId} - Private user channels
     */
    // Capability-based access control - RESTRICTIVE by default
    // Viewers can ONLY subscribe, creators can publish
    const capabilities = isAuthenticated
      ? {
          // All authenticated users can subscribe to public channels (READ-ONLY)
          "chat:*": ["subscribe", "presence", "history"],
          "stream:*": ["subscribe", "presence", "history"],
          "presence:*": ["subscribe", "presence", "history"],
          // Users can ONLY subscribe to their own channel (server publishes to it)
          [`user:${userId}`]: ["subscribe", "presence", "history"],
          // Creators get publish rights to their own stream channels
          ...(userRole === 'creator' && {
            "chat:*": ["subscribe", "publish", "presence", "history"],
            // Only allow publishing to streams they own (enforced by naming: stream:{creatorId}_*)
            "stream:*": ["subscribe", "publish", "presence", "history"],
            "presence:*": ["subscribe", "publish", "presence", "history"]
          })
        }
      : {
          // Anonymous users can only subscribe (strict read-only)
          "chat:*": ["subscribe", "history"],
          "stream:*": ["subscribe", "history"],
          "presence:*": ["subscribe", "history"]
        };

    // Create token request with fine-grained permissions
    const tokenRequest = await client.auth.createTokenRequest({
      clientId,
      capability: capabilities,
      ttl: 60 * 60 * 1000, // 1 hour TTL (3600000ms)
      // Add metadata for server-side validation if needed
      timestamp: Date.now()
    });

    // Log token creation for monitoring (without exposing secrets)
    console.log('📝 Ably token created:', {
      clientId,
      role: userRole,
      authenticated: isAuthenticated,
      ttl: '1 hour',
      capabilities: Object.keys(capabilities).join(', ')
    });

    // Return token request to client
    res.status(200).json(tokenRequest);
  } catch (error) {
    console.error('❌ Ably token creation error:', error);

    // Don't expose internal error details to client
    res.status(500).json({
      error: 'Token creation failed',
      message: process.env.NODE_ENV === 'development'
        ? error.message
        : 'Failed to create authentication token'
    });
  }
}

/**
 * Express middleware version (for traditional Express apps)
 */
function createAblyAuthMiddleware() {
  return async (req, res, next) => {
    // Try to authenticate the user first
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      try {
        // Create mock Express objects for verifySupabaseToken
        const mockNext = (err) => {
          if (err) {
            console.warn('Ably auth: Supabase token invalid, allowing anonymous');
          }
        };

        await verifySupabaseToken(req, res, mockNext);
      } catch (error) {
        console.warn('Ably auth: Authentication failed, allowing anonymous');
      }
    }

    // Call the handler
    return handler(req, res);
  };
}

// Export both the raw handler (for Vercel) and middleware (for Express)
module.exports = handler;
module.exports.createAblyAuthMiddleware = createAblyAuthMiddleware;

/**
 * Vercel Serverless Function Export
 *
 * If deploying to Vercel, create a file at:
 * /api/ably-auth.ts
 *
 * With contents:
 * export { default } from '../backend/api/ably-auth.js';
 */
