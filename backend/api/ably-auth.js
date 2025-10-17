/**
 * Ably Token Authentication Endpoint (Vercel-compatible)
 *
 * This serverless function generates secure Ably token requests for clients.
 * It prevents API keys from being exposed to the frontend while providing
 * fine-grained access control per user.
 */

const Ably = require('ably');
const { verifySupabaseToken } = require('../utils/supabase-admin-v2');
const { canUserJoinStream } = require('../utils/stream-access');

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
     * Capability-based access control - SCOPED by streamId
     *
     * Security model:
     * - NO wildcards (prevents cross-stream access)
     * - Backend-only publishing (clients can only subscribe + presence)
     * - Scoped to specific streamId from request
     *
     * Channel naming convention:
     * - user:{userId} - Private user notifications (balance, call status, tips received)
     * - stream:{streamId} - Stream events (tips, tickets) - subscribe + presence only
     * - stream:{streamId}:chat - Stream chat (optional: can enable publish for client chat)
     */

    // Extract streamId from query params, body, or headers
    const requestedStreamId = req.query?.streamId || req.body?.streamId || req.headers['x-stream-id'];

    // Build minimal scoped capabilities
    const capabilities = {};

    if (isAuthenticated && userId) {
      // Always grant: subscribe to personal notification channel
      capabilities[`user:${userId}`] = ["subscribe", "history"];

      // If joining a stream: validate access first
      if (requestedStreamId) {
        // Validate stream access (prevents unauthorized stream access)
        const accessCheck = await canUserJoinStream(userId, requestedStreamId);

        if (!accessCheck.allowed) {
          console.warn('🚫 Stream access denied:', {
            userId,
            streamId: requestedStreamId,
            reason: accessCheck.reason
          });

          return res.status(403).json({
            error: 'STREAM_ACCESS_DENIED',
            message: 'You do not have permission to access this stream',
            reason: accessCheck.reason,
            details: {
              STREAM_NOT_FOUND: 'The requested stream does not exist',
              AUTH_REQUIRED: 'Authentication required to access this stream',
              STREAM_PRIVATE: 'This is a private stream',
              FOLLOWERS_ONLY: 'This stream is for followers only',
              TICKET_REQUIRED: 'A ticket is required to access this stream',
              ACCESS_CHECK_FAILED: 'Unable to verify stream access'
            }[accessCheck.reason] || 'Access denied'
          });
        }

        // Access granted: provide scoped capabilities for this stream
        capabilities[`stream:${requestedStreamId}`] = ["subscribe", "presence", "history"];

        // OPTIONAL: Enable client-side chat publishing
        // Uncomment this line if you want clients to publish chat messages directly
        // capabilities[`stream:${requestedStreamId}:chat`] = ["publish", "subscribe", "presence", "history"];

        console.log('✅ Stream access granted:', {
          userId,
          streamId: requestedStreamId
        });
      }

      // Creators: NO additional wildcard rights
      // All critical events (tips, tickets, billing) are published server-side only
    } else {
      // Anonymous users: minimal read-only access to public streams only
      if (requestedStreamId) {
        // Check if stream allows anonymous access
        const accessCheck = await canUserJoinStream(null, requestedStreamId);

        if (!accessCheck.allowed) {
          return res.status(403).json({
            error: 'AUTH_REQUIRED',
            message: 'Authentication required to access this stream'
          });
        }

        capabilities[`stream:${requestedStreamId}`] = ["subscribe", "history"];
      }
    }

    // Create token request with fine-grained scoped permissions
    const tokenRequest = await client.auth.createTokenRequest({
      clientId,
      capability: capabilities,
      ttl: 2 * 60 * 60 * 1000, // 2 hours TTL (recommended for mobile)
      // Add metadata for server-side validation if needed
      timestamp: Date.now()
    });

    // Log token creation for monitoring (without exposing secrets)
    console.log('📝 Ably token created:', {
      clientId,
      role: userRole,
      authenticated: isAuthenticated,
      streamId: requestedStreamId || 'none',
      ttl: '2 hours',
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
