// Firebase admin removed - using Supabase
const { RateLimiterRedis } = require('rate-limiter-flexible');
const Redis = require('ioredis');
const winston = require('winston');
const { supabase } = require('../utils/supabase');

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

// Initialize Redis client for rate limiting and session management
const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 3,
});

// Rate limiter for authentication attempts
const authRateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'auth_fail',
  points: 5, // Number of attempts
  duration: 900, // Per 15 minutes
  blockDuration: 900, // Block for 15 minutes
});

// Session store
const sessionStore = {
  async get(sessionId) {
    const data = await redisClient.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  },
  
  async set(sessionId, data, ttl = 3600) {
    await redisClient.setex(
      `session:${sessionId}`,
      ttl,
      JSON.stringify(data)
    );
  },
  
  async delete(sessionId) {
    await redisClient.del(`session:${sessionId}`);
  },
  
  async refresh(sessionId, ttl = 3600) {
    await redisClient.expire(`session:${sessionId}`, ttl);
  }
};

/**
 * Enhanced authentication middleware with multiple strategies
 */
async function authenticate(req, res, next) {
  try {
    // Extract token from various sources
    const token = extractToken(req);
    
    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    // Check if token is blacklisted
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({
        error: 'Token has been revoked',
        code: 'TOKEN_REVOKED'
      });
    }
    
    // Verify Supabase token
    let decodedToken;
    try {
      decodedToken = await supabase.auth.admin.verifyIdToken(token);
    } catch (error) {
      // Log authentication failure
      logger.warn('Supabase token verification failed', {
        error: error.message,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Apply rate limiting on failed auth
      try {
        await authRateLimiter.consume(req.ip);
      } catch (rateLimitError) {
        return res.status(429).json({
          error: 'Too many authentication attempts',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.round(rateLimitError.msBeforeNext / 1000) || 900
        });
      }
      
      return res.status(401).json({
        error: 'Invalid authentication token',
        code: 'INVALID_TOKEN'
      });
    }
    
    // Check if user is active
    const userRecord = await supabase.auth.admin.getUser(decodedToken.uid);
    if (userRecord.disabled) {
      return res.status(403).json({
        error: 'Account has been disabled',
        code: 'ACCOUNT_DISABLED'
      });
    }
    
    // Get or create session
    const sessionId = `${decodedToken.uid}:${req.sessionID || generateSessionId()}`;
    let session = await sessionStore.get(sessionId);
    
    if (!session) {
      session = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      };
      await sessionStore.set(sessionId, session);
    } else {
      // Update last activity
      session.lastActivity = Date.now();
      await sessionStore.set(sessionId, session);
    }
    
    // Attach user info to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      sessionId,
      customClaims: decodedToken.customClaims || {}
    };
    
    // Set security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Log successful authentication
    logger.info('User authenticated', {
      uid: decodedToken.uid,
      sessionId,
      ip: req.ip
    });
    
    next();
  } catch (error) {
    logger.error('Authentication middleware error', error);
    res.status(500).json({
      error: 'Authentication service error',
      code: 'AUTH_SERVICE_ERROR'
    });
  }
}

/**
 * Role-based access control middleware
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    const userRoles = req.user.customClaims.roles || [];
    const hasRole = roles.some(role => userRoles.includes(role));
    
    if (!hasRole) {
      logger.warn('Access denied - insufficient permissions', {
        uid: req.user.uid,
        requiredRoles: roles,
        userRoles
      });
      
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        requiredRoles: roles
      });
    }
    
    next();
  };
}

/**
 * Creator-only middleware
 */
async function requireCreator(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  // Check if user is a creator in the database
  const { executeQuery } = require('../utils/db-enhanced');
  const result = await executeQuery(
    'SELECT is_creator FROM users WHERE supabase_id = $1',
    [req.user.uid]
  );
  
  if (!result.rows[0]?.is_creator) {
    return res.status(403).json({
      error: 'Creator access required',
      code: 'CREATOR_ONLY'
    });
  }
  
  next();
}

/**
 * Session validation middleware
 */
async function validateSession(req, res, next) {
  if (!req.user || !req.user.sessionId) {
    return next();
  }
  
  const session = await sessionStore.get(req.user.sessionId);
  
  if (!session) {
    return res.status(401).json({
      error: 'Session expired',
      code: 'SESSION_EXPIRED'
    });
  }
  
  // Check for session hijacking
  if (session.ip !== req.ip || session.userAgent !== req.get('User-Agent')) {
    logger.warn('Possible session hijacking detected', {
      sessionId: req.user.sessionId,
      originalIp: session.ip,
      currentIp: req.ip
    });
    
    await sessionStore.delete(req.user.sessionId);
    
    return res.status(401).json({
      error: 'Session security violation',
      code: 'SESSION_INVALID'
    });
  }
  
  // Refresh session TTL
  await sessionStore.refresh(req.user.sessionId);
  
  next();
}

/**
 * Extract token from request
 */
function extractToken(req) {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Check cookie
  if (req.cookies && req.cookies.authToken) {
    return req.cookies.authToken;
  }
  
  // Check query parameter (not recommended for production)
  if (process.env.NODE_ENV === 'development' && req.query.token) {
    return req.query.token;
  }
  
  return null;
}

/**
 * Generate session ID
 */
function generateSessionId() {
  return require('crypto').randomBytes(32).toString('hex');
}

/**
 * Logout handler
 */
async function logout(req, res) {
  try {
    if (req.user && req.user.sessionId) {
      await sessionStore.delete(req.user.sessionId);
    }
    
    // Blacklist the token
    const token = extractToken(req);
    if (token) {
      // Token will be blacklisted for 24 hours
      await redisClient.setex(`blacklist:${token}`, 86400, '1');
    }
    
    res.status(200).json({
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout error', error);
    res.status(500).json({
      error: 'Logout failed',
      code: 'LOGOUT_ERROR'
    });
  }
}

module.exports = {
  authenticate,
  requireRole,
  requireCreator,
  validateSession,
  logout,
  sessionStore
};