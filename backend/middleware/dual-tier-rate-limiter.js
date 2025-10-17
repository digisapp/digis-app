/**
 * Dual-Tier Rate Limiter (Burst + Sustained)
 *
 * Implements two-bucket rate limiting:
 * - BURST bucket: Short window (e.g., 10 req/sec) for sudden traffic spikes
 * - SUSTAINED bucket: Longer window (e.g., 100 req/min) to prevent sustained abuse
 *
 * Benefits:
 * - Legitimate users can burst briefly without being blocked
 * - Abusive users are caught by sustained limits
 * - X-RateLimit-* headers help clients back off gracefully
 *
 * Usage:
 * ```js
 * router.post('/tips/send',
 *   authenticateToken,
 *   dualTierRateLimit({
 *     name: 'tips',
 *     burst: { limit: 10, windowSec: 1 },
 *     sustained: { limit: 100, windowSec: 60 }
 *   }),
 *   handler
 * );
 * ```
 */

const { redis } = require('../utils/redis');

/**
 * Generate a windowed bucket key
 * Window resets every `windowSec` seconds
 */
function bucketKey(name, id, windowSec) {
  const env = process.env.NODE_ENV || 'development';
  const now = Math.floor(Date.now() / 1000);
  const window = Math.floor(now / windowSec);
  return `rl:${env}:${name}:${id}:${window}`;
}

/**
 * Consume a token from a bucket
 * Returns { used, remaining, ok }
 */
async function consumeToken(tokenKey, limit, windowSec) {
  try {
    // Atomic increment
    const used = await redis.incr(tokenKey);

    // Set TTL on first hit (cleanup old buckets automatically)
    if (used === 1) {
      await redis.expire(tokenKey, windowSec + 5); // +5 sec buffer
    }

    const remaining = Math.max(0, limit - used);
    const ok = used <= limit;

    return { used, remaining, ok };
  } catch (error) {
    console.error('[dualTierRateLimit] Redis error:', error.message);
    // Fail-open: allow request on Redis failure
    return { used: 0, remaining: limit, ok: true };
  }
}

/**
 * Dual-tier rate limiter middleware
 *
 * @param {Object} options
 * @param {string} options.name - Bucket name (e.g., 'tips', 'streaming')
 * @param {Object} options.burst - Burst limits { limit, windowSec }
 * @param {Object} options.sustained - Sustained limits { limit, windowSec }
 * @param {Function} options.identifierFn - Custom identifier function (default: userId or IP)
 * @returns {Function} Express middleware
 */
function dualTierRateLimit(options = {}) {
  const {
    name = 'api',
    burst = { limit: 10, windowSec: 1 },
    sustained = { limit: 100, windowSec: 60 },
    identifierFn = null
  } = options;

  return async function (req, res, next) {
    try {
      // Get identifier (userId preferred, fallback to IP)
      const id = identifierFn
        ? identifierFn(req)
        : req.user?.supabase_id || req.user?.id || req.ip || 'anonymous';

      const baseKey = `${name}:${id}`;

      // Check burst bucket first
      const burstKey = bucketKey(baseKey, 'burst', burst.windowSec);
      const b = await consumeToken(burstKey, burst.limit, burst.windowSec);

      // Check sustained bucket
      const sustainedKey = bucketKey(baseKey, 'sustained', sustained.windowSec);
      const s = await consumeToken(sustainedKey, sustained.limit, sustained.windowSec);

      // Expose headers so clients can adapt
      res.setHeader('X-RateLimit-Burst-Limit', burst.limit);
      res.setHeader('X-RateLimit-Burst-Remaining', b.remaining);
      res.setHeader('X-RateLimit-Sustained-Limit', sustained.limit);
      res.setHeader('X-RateLimit-Sustained-Remaining', s.remaining);

      // If either bucket is exhausted, reject
      if (!b.ok) {
        console.warn(`[dualTierRateLimit] Burst limit exceeded: ${name} ${id} (${b.used}/${burst.limit})`);
        return res.status(429).json({
          success: false,
          error: 'RATE_LIMITED',
          message: `Burst limit exceeded. Please slow down.`,
          retryAfter: burst.windowSec,
          limits: {
            burst: { used: b.used, limit: burst.limit, window: `${burst.windowSec}s` },
            sustained: { used: s.used, limit: sustained.limit, window: `${sustained.windowSec}s` }
          }
        });
      }

      if (!s.ok) {
        console.warn(`[dualTierRateLimit] Sustained limit exceeded: ${name} ${id} (${s.used}/${sustained.limit})`);
        return res.status(429).json({
          success: false,
          error: 'RATE_LIMITED',
          message: `Sustained rate limit exceeded. Please try again in ${sustained.windowSec} seconds.`,
          retryAfter: sustained.windowSec,
          limits: {
            burst: { used: b.used, limit: burst.limit, window: `${burst.windowSec}s` },
            sustained: { used: s.used, limit: sustained.limit, window: `${sustained.windowSec}s` }
          }
        });
      }

      // Log warnings when approaching limits (< 10% remaining)
      if (b.remaining < burst.limit * 0.1 || s.remaining < sustained.limit * 0.1) {
        console.warn(`[dualTierRateLimit] Approaching limit: ${name} ${id} - burst: ${b.remaining}/${burst.limit}, sustained: ${s.remaining}/${sustained.limit}`);
      }

      next();
    } catch (error) {
      // Fail-open: if middleware crashes, don't block legitimate requests
      console.error('[dualTierRateLimit] Middleware error:', error.message);
      next();
    }
  };
}

/**
 * Preset rate limiters for common use cases
 */
const presets = {
  /**
   * Tips endpoint: Allow bursts but prevent spam
   * 10/sec burst, 100/min sustained
   */
  tips: () => dualTierRateLimit({
    name: 'tips',
    burst: { limit: 10, windowSec: 1 },
    sustained: { limit: 100, windowSec: 60 }
  }),

  /**
   * Streaming endpoints: High throughput with burst protection
   * 20/sec burst, 300/min sustained
   */
  streaming: () => dualTierRateLimit({
    name: 'streaming',
    burst: { limit: 20, windowSec: 1 },
    sustained: { limit: 300, windowSec: 60 }
  }),

  /**
   * Chat messages: Moderate bursts, prevent flood
   * 5/sec burst, 60/min sustained
   */
  chat: () => dualTierRateLimit({
    name: 'chat',
    burst: { limit: 5, windowSec: 1 },
    sustained: { limit: 60, windowSec: 60 }
  }),

  /**
   * API calls: Generous burst, reasonable sustained
   * 30/sec burst, 500/min sustained
   */
  api: () => dualTierRateLimit({
    name: 'api',
    burst: { limit: 30, windowSec: 1 },
    sustained: { limit: 500, windowSec: 60 }
  }),

  /**
   * Uploads: Low burst, strict sustained
   * 3/sec burst, 20/min sustained
   */
  upload: () => dualTierRateLimit({
    name: 'upload',
    burst: { limit: 3, windowSec: 1 },
    sustained: { limit: 20, windowSec: 60 }
  }),

  /**
   * Auth endpoints: Very strict
   * 2/sec burst, 10/min sustained
   */
  auth: () => dualTierRateLimit({
    name: 'auth',
    burst: { limit: 2, windowSec: 1 },
    sustained: { limit: 10, windowSec: 60 }
  }),
};

module.exports = {
  dualTierRateLimit,
  presets
};
