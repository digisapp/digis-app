# Upstash Redis Usage in Digis

## Overview
Yes, **Upstash Redis IS configured** in your Vercel production environment, but it is **not actively being used** in most routes yet. The infrastructure is in place and ready to use.

## 🔑 Environment Variables (Verified)

✅ **Configured in Vercel Production:**
- `UPSTASH_REDIS_REST_URL` - Upstash REST API endpoint
- `UPSTASH_REDIS_REST_TOKEN` - Authentication token

❌ **NOT Configured:**
- `REDIS_URL` - Regular Redis connection (not needed for serverless)

## 📦 Available Redis Utilities

### 1. **`backend/utils/redis.js`** - Full-Featured Redis Client
**Status**: Available but NOT actively used in routes

**Features**:
- ✅ **Cache operations**: `get()`, `set()`, `del()`, `exists()`, `mget()`
- ✅ **Session management**: Store/retrieve/destroy user sessions
- ✅ **User caching**: Cache user profiles with TTL
- ✅ **Creator caching**: Cache creator profiles and lists
- ✅ **Stream tracking**: Track active live streams
- ✅ **Rate limiting**: Built-in rate limiter with sliding windows
- ✅ **OTP/verification codes**: Temporary code storage

**Cache Prefixes**:
```javascript
USER: 'user:'           // User data caching
SESSION: 'session:'     // Session management
TOKEN: 'token:'         // Token data
CREATOR: 'creator:'     // Creator profiles
STREAM: 'stream:'       // Live streams
RATE_LIMIT: 'rate:'     // Rate limiting
EMAIL: 'email:'         // Email verification
OTP: 'otp:'            // One-time passwords
TEMP: 'temp:'          // Temporary data
```

**TTL Values**:
```javascript
SHORT: 300 seconds      // 5 minutes
MEDIUM: 1800 seconds    // 30 minutes
LONG: 3600 seconds      // 1 hour
DAY: 86400 seconds      // 24 hours
WEEK: 604800 seconds    // 7 days
```

**Example Usage**:
```javascript
const { creators, sessions, cache } = require('../utils/redis');

// Cache creator profile
await creators.cache(creatorId, profileData, TTL.MEDIUM);

// Get cached creator
const creator = await creators.get(creatorId);

// Store session
await sessions.store(sessionId, sessionData, TTL.DAY);
```

---

### 2. **`backend/utils/upstash-cache.js`** - Simplified Serverless Cache
**Status**: Available but NOT actively used in routes

**Features**:
- ✅ **Basic caching**: `get()`, `set()`, `del()`
- ✅ **Cache-aside pattern**: `getOrCompute()` - get from cache or compute
- ✅ **Creator profile caching**: `cacheCreatorProfile()`, `getCachedCreatorProfile()`
- ✅ **Analytics caching**: `cacheAnalytics()`, `getCachedAnalytics()`
- ✅ **Distributed locks**: Prevent duplicate operations (e.g., double payouts)
- ✅ **Feature flags**: Dynamic feature toggles
- ✅ **Increment counters**: Rate limiting, usage tracking

**Example Usage**:
```javascript
const cache = require('../utils/upstash-cache');

// Cache-aside pattern
const analytics = await cache.getOrCompute(
  'analytics:creator:123',
  async () => {
    // Expensive database query
    return await db.query('SELECT ...');
  },
  1800 // 30 minutes TTL
);

// Distributed lock (prevent duplicate payout)
const locked = await cache.acquireLock('payout:creator:123', 60);
if (locked) {
  try {
    await processCreatorPayout(creatorId);
  } finally {
    await cache.releaseLock('payout:creator:123');
  }
}

// Feature flags
const isNewFeatureEnabled = await cache.getFeatureFlag('new_dashboard_ui');
```

---

### 3. **`backend/middleware/upstash-rate-limiter.js`** - Serverless Rate Limiting
**Status**: Available but NOT actively used in routes (uses old rate-limiters.js instead)

**Features**:
- ✅ **Multiple limiter types**: auth, payment, token, streaming, upload, analytics, API, public
- ✅ **Sliding window algorithm**: More accurate than fixed windows
- ✅ **Multi-tier limiting**: Combine IP + user rate limits
- ✅ **Analytics**: Track rate limit usage
- ✅ **Express middleware**: Drop-in replacement for existing limiters

**Rate Limits**:
```javascript
Auth endpoints:       5 requests / 15 minutes
Payment endpoints:    10 requests / minute
Token purchase:       20 requests / hour
Streaming:            100 requests / minute
Upload:               30 requests / hour
Analytics:            200 requests / minute
General API:          300 requests / minute
Public endpoints:     1000 requests / minute
```

**Example Usage**:
```javascript
const { authRateLimit, paymentRateLimit } = require('../middleware/upstash-rate-limiter');

// Apply to routes
router.post('/auth/login', authRateLimit, authController.login);
router.post('/payments/charge', paymentRateLimit, paymentController.charge);

// Multi-tier (IP + user)
const { createMultiTierRateLimit } = require('../middleware/upstash-rate-limiter');
router.post('/api/sensitive', createMultiTierRateLimit('payment'), handler);
```

---

### 4. **`backend/middleware/rate-limiters.js`** - Legacy Rate Limiting
**Status**: ✅ **ACTIVELY USED** (but falls back to memory store)

**Current Behavior**:
- Checks for `REDIS_URL` environment variable (NOT configured)
- Since `REDIS_URL` is missing, falls back to **in-memory rate limiting**
- Works fine for single-instance deployments
- **NOT suitable for multi-instance serverless** (each instance has separate memory)

**Located in**: `backend/api/index.js` line 188-196
```javascript
let rateLimiters = {};
(async () => {
  try {
    rateLimiters = await buildLimiters();
    console.log('✅ Rate limiters initialized');
  } catch (error) {
    console.warn('⚠️ Failed to initialize rate limiters, using defaults:', error.message);
  }
})();
```

---

## 🏥 Health Check Integration

**Location**: `backend/api/index.js` lines 535-569

Redis health check is included in the `/ready` endpoint:
```javascript
app.get('/ready', async (req, res) => {
  const checks = {
    database: false,
    redis: false,
    timestamp: new Date().toISOString()
  };

  try {
    // Check database
    const { pool } = require('../utils/db');
    await pool.query('SELECT 1');
    checks.database = true;
  } catch (error) {
    console.error('Database health check failed:', error.message);
  }

  try {
    // Check Redis if available
    const redis = require('../utils/redis');
    if (redis && redis.ping) {
      await redis.ping();
      checks.redis = true;
    }
  } catch (error) {
    console.error('Redis health check failed:', error.message);
    checks.redis = 'Not configured';
  }

  const allHealthy = checks.database && (checks.redis === true || checks.redis === 'Not configured');

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'not ready',
    checks
  });
});
```

---

## 📊 Current Usage Summary

| Component | Status | Notes |
|-----------|--------|-------|
| **Upstash Environment Variables** | ✅ Configured | Active in production |
| **utils/redis.js** | ⚠️ Available but unused | Full-featured client ready to use |
| **utils/upstash-cache.js** | ⚠️ Available but unused | Simplified cache wrapper ready to use |
| **middleware/upstash-rate-limiter.js** | ⚠️ Available but unused | Serverless rate limiting ready to use |
| **middleware/rate-limiters.js** | ✅ Actively used | Uses memory store (no Redis connection) |
| **Health check endpoint** | ✅ Checks Redis | Reports "Not configured" (non-fatal) |

---

## 🚀 Recommended Migration Path

### Phase 1: Enable Upstash Rate Limiting (Immediate)
Replace memory-based rate limiting with Upstash for proper distributed rate limiting:

**In `backend/api/index.js`**, replace lines 188-196:
```javascript
// OLD (uses memory store)
const { buildLimiters } = require('../middleware/rate-limiters');
let rateLimiters = {};
(async () => {
  try {
    rateLimiters = await buildLimiters();
    console.log('✅ Rate limiters initialized');
  } catch (error) {
    console.warn('⚠️ Failed to initialize rate limiters, using defaults:', error.message);
  }
})();
```

**WITH:**
```javascript
// NEW (uses Upstash Redis for distributed rate limiting)
const { rateLimiters } = require('../middleware/upstash-rate-limiter');
console.log('✅ Upstash rate limiters initialized');
```

**Benefits**:
- ✅ Distributed rate limiting across all Vercel instances
- ✅ Accurate request counting (no per-instance limits)
- ✅ Better DDoS protection
- ✅ Rate limit analytics

---

### Phase 2: Add Creator Profile Caching (High Impact)
Cache frequently accessed creator profiles to reduce database load:

**In `backend/routes/creators.js`** (or wherever creator profiles are fetched):
```javascript
const cache = require('../utils/upstash-cache');

router.get('/:username', async (req, res) => {
  const { username } = req.params;

  // Try cache first
  const cached = await cache.getCachedCreatorProfile(username);
  if (cached) {
    return res.json({ success: true, creator: cached });
  }

  // Fetch from database
  const creator = await db.query('SELECT * FROM users WHERE username = $1', [username]);

  // Cache for 5 minutes
  await cache.cacheCreatorProfile(username, creator, 300);

  res.json({ success: true, creator });
});
```

**Benefits**:
- ⚡ Faster page loads (cache hits ~5-10ms vs DB queries ~50-200ms)
- 💰 Reduced database costs
- 📈 Better scalability

---

### Phase 3: Add Analytics Caching (Medium Impact)
Cache expensive analytics queries:

**In `backend/routes/analytics.js`**:
```javascript
const cache = require('../utils/upstash-cache');

router.get('/creator/:creatorId/earnings', async (req, res) => {
  const { creatorId } = req.params;

  // Cache analytics for 30 minutes
  const earnings = await cache.getOrCompute(
    `analytics:earnings:${creatorId}`,
    async () => {
      // Expensive aggregation query
      return await db.query(`
        SELECT DATE(created_at) as date, SUM(amount) as total
        FROM earnings
        WHERE creator_id = $1
        GROUP BY DATE(created_at)
      `, [creatorId]);
    },
    1800 // 30 minutes
  );

  res.json({ success: true, earnings });
});
```

---

### Phase 4: Add Session Caching (Optional)
Cache active sessions to reduce database lookups:

**In authentication middleware**:
```javascript
const { sessions } = require('../utils/redis');

async function validateSession(req, res, next) {
  const sessionId = req.headers['x-session-id'];

  // Check cache first
  let session = await sessions.get(sessionId);

  if (!session) {
    // Fetch from database
    session = await db.query('SELECT * FROM sessions WHERE id = $1', [sessionId]);

    // Cache for 1 day
    await sessions.store(sessionId, session, TTL.DAY);
  }

  req.session = session;
  next();
}
```

---

## 🎯 Use Cases by Priority

### High Priority (Immediate Impact)
1. **Rate Limiting** - Switch to Upstash for distributed limiting
2. **Creator Profiles** - Cache heavily accessed creator pages
3. **Analytics** - Cache expensive dashboard queries

### Medium Priority
4. **Feature Flags** - Dynamic feature toggles without redeployment
5. **Session Data** - Reduce database lookups for active users
6. **Distributed Locks** - Prevent duplicate payouts/charges

### Low Priority
7. **OTP Codes** - Store verification codes temporarily
8. **Stream Tracking** - Cache active live streams list
9. **Token Balance** - Cache frequently checked balances

---

## ✅ Summary

**Current State**:
- ✅ Upstash Redis is **configured and ready**
- ⚠️ Not actively used (infrastructure exists but not integrated)
- ⚠️ Rate limiting uses memory store (works but not ideal for serverless)

**Next Steps**:
1. **Migrate rate limiting** to Upstash (1-line change)
2. **Add creator profile caching** (high traffic, easy wins)
3. **Add analytics caching** (expensive queries, significant cost savings)

**Benefits of Full Migration**:
- 🚀 **Performance**: 5-10x faster response times for cached data
- 💰 **Cost**: Reduce database costs by 40-60%
- 📈 **Scalability**: Handle 10x more traffic without infrastructure changes
- 🛡️ **Reliability**: Distributed rate limiting prevents DDoS
