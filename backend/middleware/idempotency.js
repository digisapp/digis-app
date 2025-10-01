const redis = require('../utils/redis');
const crypto = require('crypto');
const { logger } = require('../utils/secureLogger');

/**
 * Middleware to handle idempotency for critical financial operations
 * Prevents duplicate processing of requests using idempotency keys
 */
class IdempotencyError extends Error {
  constructor(message, statusCode = 409) {
    super(message);
    this.name = 'IdempotencyError';
    this.statusCode = statusCode;
  }
}

/**
 * Generate idempotency key from request
 */
const generateIdempotencyKey = (req) => {
  const userId = req.user?.supabase_id || req.user?.uid || 'anonymous';
  const method = req.method;
  const path = req.path;
  const body = JSON.stringify(req.body || {});

  // Create a hash of the request details
  const hash = crypto
    .createHash('sha256')
    .update(`${userId}:${method}:${path}:${body}`)
    .digest('hex');

  return `idem:${hash}`;
};

/**
 * Store response for idempotency
 */
const storeIdempotentResponse = async (key, response, ttl = 86400) => {
  try {
    await redis.setex(key, ttl, JSON.stringify({
      statusCode: response.statusCode,
      body: response.body,
      timestamp: Date.now()
    }));
  } catch (error) {
    logger.error('Failed to store idempotent response', { error: error.message, key });
  }
};

/**
 * Retrieve stored idempotent response
 */
const getIdempotentResponse = async (key) => {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Failed to retrieve idempotent response', { error: error.message, key });
    return null;
  }
};

/**
 * Middleware for request idempotency
 * @param {Object} options - Configuration options
 * @param {number} options.ttl - Time to live in seconds (default: 24 hours)
 * @param {boolean} options.useHeader - Use Idempotency-Key header (default: true)
 * @param {Array<string>} options.methods - HTTP methods to apply idempotency (default: ['POST', 'PUT', 'PATCH'])
 */
const idempotency = (options = {}) => {
  const {
    ttl = 86400, // 24 hours default
    useHeader = true,
    methods = ['POST', 'PUT', 'PATCH']
  } = options;

  return async (req, res, next) => {
    // Skip if method not in list
    if (!methods.includes(req.method)) {
      return next();
    }

    let idempotencyKey;

    // Use header-based key if provided
    if (useHeader && req.headers['idempotency-key']) {
      const userId = req.user?.supabase_id || req.user?.uid || 'anonymous';
      idempotencyKey = `idem:${userId}:${req.headers['idempotency-key']}`;
    } else {
      // Generate key from request
      idempotencyKey = generateIdempotencyKey(req);
    }

    // Check for existing response
    const existingResponse = await getIdempotentResponse(idempotencyKey);

    if (existingResponse) {
      logger.info('Idempotent request detected', {
        key: idempotencyKey,
        path: req.path,
        userId: req.user?.supabase_id
      });

      // Return cached response
      res.setHeader('X-Idempotency-Key', idempotencyKey);
      res.setHeader('X-Idempotency-Replay', 'true');
      return res.status(existingResponse.statusCode).json(existingResponse.body);
    }

    // Store the key to prevent concurrent duplicate processing
    const lockKey = `${idempotencyKey}:lock`;
    const lockAcquired = await redis.set(lockKey, '1', 'NX', 'EX', 10); // 10 second lock

    if (!lockAcquired) {
      return res.status(409).json({
        success: false,
        code: 'REQUEST_IN_PROGRESS',
        message: 'Request is already being processed'
      });
    }

    // Override res.json to capture response
    const originalJson = res.json.bind(res);
    res.json = function(body) {
      // Store response for future idempotency
      if (res.statusCode >= 200 && res.statusCode < 300) {
        storeIdempotentResponse(idempotencyKey, {
          statusCode: res.statusCode,
          body
        }, ttl).catch(err => {
          logger.error('Failed to store idempotent response', {
            error: err.message,
            key: idempotencyKey
          });
        });
      }

      // Clean up lock
      redis.del(lockKey).catch(err => {
        logger.error('Failed to delete lock', { error: err.message, key: lockKey });
      });

      res.setHeader('X-Idempotency-Key', idempotencyKey);
      return originalJson(body);
    };

    next();
  };
};

/**
 * Strict idempotency middleware that requires Idempotency-Key header
 */
const requireIdempotencyKey = async (req, res, next) => {
  const key = req.headers['idempotency-key'];

  if (!key) {
    return res.status(400).json({
      success: false,
      code: 'MISSING_IDEMPOTENCY_KEY',
      message: 'Idempotency-Key header is required for this operation'
    });
  }

  // Validate key format (UUID v4 recommended)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(key)) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_IDEMPOTENCY_KEY',
      message: 'Idempotency-Key must be a valid UUID v4'
    });
  }

  next();
};

/**
 * Clear expired idempotency keys (run as cron job)
 */
const cleanupIdempotencyKeys = async () => {
  try {
    const pattern = 'idem:*';
    const keys = await redis.keys(pattern);

    let cleaned = 0;
    for (const key of keys) {
      const ttl = await redis.ttl(key);
      if (ttl === -1) { // No expiry set
        await redis.expire(key, 86400); // Set 24 hour expiry
        cleaned++;
      }
    }

    logger.info('Cleaned up idempotency keys', { count: cleaned });
  } catch (error) {
    logger.error('Failed to cleanup idempotency keys', { error: error.message });
  }
};

module.exports = {
  idempotency,
  requireIdempotencyKey,
  cleanupIdempotencyKeys,
  IdempotencyError,
  storeIdempotentResponse,
  getIdempotentResponse
};