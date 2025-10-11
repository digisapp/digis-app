# 🚨 Digis Platform Stabilization Plan

**Goal:** Production-ready stability in 3 phases (1 week total)

---

## **Phase 1: Critical Performance Fixes** (Deploy Today - 2 hours)

### ✅ **1.1 Fix Slow Active Sessions Query (79s → <100ms)**

**Problem:** `COUNT(*)` scans entire sessions table
**Solution:** Partial indexes + Redis caching

```bash
# Deploy this migration NOW
psql $DATABASE_URL -f backend/migrations/fix-active-sessions-performance.sql
```

**Update backend code:**
```javascript
// routes/users.js or dashboard routes
const sessionCounters = require('../utils/redis-counters');

// Replace slow query:
// const { rows } = await pool.query('SELECT COUNT(*) FROM sessions WHERE status = "active"');

// With fast Redis counter:
const counts = await sessionCounters.getCounts();
// Returns: { activeSessions: 42, activeCreators: 12, activeFans: 30 }
```

**Set up reconciliation cron (Vercel Cron):**
```javascript
// api/cron/reconcile-sessions.js
export default async function handler(req, res) {
  const sessionCounters = require('../../utils/redis-counters');
  await sessionCounters.reconcile();
  res.json({ ok: true });
}
```

**Vercel config:**
```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/reconcile-sessions",
    "schedule": "*/5 * * * *"
  }]
}
```

---

### ✅ **1.2 Harden Postgres Connection Pool**

**Update `backend/utils/db.js`:**
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 15,                      // Limit connections
  idleTimeoutMillis: 30_000,    // Close idle after 30s
  connectionTimeoutMillis: 5_000, // Fail fast
  statement_timeout: 10_000     // Kill slow queries after 10s
});

pool.on('error', (err) => {
  console.error('💥 PG Pool error:', err);
});

module.exports = { pool };
```

---

### ✅ **1.3 Add Express Security Headers**

**Update `backend/server.js`:**
```javascript
const express = require('express');
const { securityHeaders, corsMiddleware, baseRateLimiter } = require('./middleware/security');

const app = express();

// CRITICAL: Must be first
app.set('trust proxy', 1);

// Security
app.use(securityHeaders);
app.use(corsMiddleware);
app.use(baseRateLimiter);

// Auth routes need stricter limits
const { authRateLimiter } = require('./middleware/security');
app.use('/api/auth', authRateLimiter);
app.use('/api/payments', require('./middleware/security').paymentRateLimiter);

// Health check (no rate limit)
app.get('/healthz', (req, res) => res.json({ ok: true, ts: Date.now() }));
```

---

### ✅ **1.4 Supabase JWT Verification (Fast Auth)**

**Update `backend/middleware/auth.js`:**
```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifySupabaseToken(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth error:', err);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

module.exports = { verifySupabaseToken };
```

---

## **Phase 2: Real-time & Background Jobs** (Deploy Tomorrow - 4 hours)

### ✅ **2.1 Replace In-Memory WebSockets with Ably/Pusher**

**Problem:** Vercel serverless doesn't support long-lived WebSocket connections
**Solution:** Use managed real-time service

**Option A: Ably (Recommended)**
```bash
npm install ably
```

```javascript
// backend/services/realtime.js
const Ably = require('ably');
const ably = new Ably.Realtime(process.env.ABLY_API_KEY);

// Publish event
async function publishSessionUpdate(sessionId, data) {
  const channel = ably.channels.get(`session:${sessionId}`);
  await channel.publish('update', data);
}

// Token generation endpoint for frontend
app.get('/api/realtime/token', verifySupabaseToken, async (req, res) => {
  const tokenRequest = await ably.auth.createTokenRequest({
    clientId: req.user.id
  });
  res.json(tokenRequest);
});
```

**Frontend update:**
```javascript
// frontend/src/contexts/SocketContext.jsx
import Ably from 'ably';

const getRealtimeToken = async () => {
  const res = await fetch('/api/realtime/token', {
    headers: { Authorization: `Bearer ${supabaseToken}` }
  });
  return res.json();
};

const ably = new Ably.Realtime({ authCallback: getRealtimeToken });
const channel = ably.channels.get(`session:${sessionId}`);

channel.subscribe('update', (message) => {
  console.log('Session update:', message.data);
});
```

---

### ✅ **2.2 Background Jobs with Vercel Cron + QStash**

**Replace BullMQ with serverless jobs:**

```bash
npm install @upstash/qstash
```

```javascript
// backend/utils/queue.js
const { Client } = require('@upstash/qstash');
const qstash = new Client({ token: process.env.QSTASH_TOKEN });

async function scheduleSessionEnd(sessionId, delaySeconds) {
  await qstash.publishJSON({
    url: `${process.env.API_URL}/api/jobs/end-session`,
    body: { sessionId },
    delay: delaySeconds
  });
}

// api/jobs/end-session.js (Vercel function)
export default async function handler(req, res) {
  const { sessionId } = req.body;

  // Verify QStash signature
  const signature = req.headers['upstash-signature'];
  // ... verify signature

  // End session logic
  await pool.query('UPDATE sessions SET status = $1 WHERE id = $2', ['ended', sessionId]);

  res.json({ ok: true });
}
```

---

### ✅ **2.3 Stripe Webhook Security**

**Update `backend/routes/payments.js`:**
```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post('/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];

    try {
      // Verify signature
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      // Idempotency check
      const { id: eventId } = event;
      const exists = await pool.query(
        'SELECT 1 FROM stripe_events WHERE event_id = $1',
        [eventId]
      );

      if (exists.rows.length > 0) {
        return res.json({ received: true, duplicate: true });
      }

      // Store event
      await pool.query(
        'INSERT INTO stripe_events (event_id, type, processed_at) VALUES ($1, $2, NOW())',
        [eventId, event.type]
      );

      // Process event
      switch (event.type) {
        case 'payment_intent.succeeded':
          await handlePaymentSuccess(event.data.object);
          break;
        // ... other cases
      }

      res.json({ received: true });
    } catch (err) {
      console.error('Webhook error:', err);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);
```

---

## **Phase 3: Monitoring & Resilience** (Deploy Day 3 - 2 hours)

### ✅ **3.1 Add Observability**

```bash
npm install @sentry/node @sentry/tracing
```

```javascript
// backend/server.js
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

// ... routes

app.use(Sentry.Handlers.errorHandler());
```

---

### ✅ **3.2 Graceful Shutdown**

```javascript
// backend/server.js
const server = app.listen(port);

const shutdown = async () => {
  console.log('🛑 Shutting down gracefully...');

  server.close(() => {
    console.log('✅ HTTP server closed');
  });

  // Close DB pool
  await pool.end();

  // Close Redis
  await redis.quit();

  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

---

### ✅ **3.3 Circuit Breaker for External APIs**

```bash
npm install opossum
```

```javascript
// backend/utils/circuit-breaker.js
const CircuitBreaker = require('opossum');

const agoraBreaker = new CircuitBreaker(async (channelName, uid) => {
  // Agora token generation
  return generateAgoraToken(channelName, uid);
}, {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
});

agoraBreaker.fallback(() => ({
  error: 'SERVICE_UNAVAILABLE',
  message: 'Video service temporarily unavailable'
}));

module.exports = { agoraBreaker };
```

---

## **Deployment Checklist**

### **Pre-Deploy**
- [ ] Run migrations: `psql $DATABASE_URL -f backend/migrations/fix-active-sessions-performance.sql`
- [ ] Set env vars: `ALLOWED_ORIGINS`, `ABLY_API_KEY`, `QSTASH_TOKEN`, `SENTRY_DSN`
- [ ] Test Redis connection: `npm run test:redis`
- [ ] Verify Stripe webhook secret

### **Deploy Phase 1** (Today)
```bash
cd backend
git add .
git commit -m "Phase 1: Performance + Security hardening"
git push origin main
vercel --prod
```

### **Deploy Phase 2** (Tomorrow)
```bash
git commit -m "Phase 2: Real-time + Background jobs"
git push origin main
vercel --prod
```

### **Deploy Phase 3** (Day 3)
```bash
git commit -m "Phase 3: Monitoring + Resilience"
git push origin main
vercel --prod
```

### **Post-Deploy**
- [ ] Monitor Sentry for errors
- [ ] Check `/healthz` endpoint
- [ ] Verify active sessions count is fast (<100ms)
- [ ] Test token purchases end-to-end
- [ ] Test video call flow

---

## **Environment Variables to Add**

```bash
# Vercel Production Environment
ALLOWED_ORIGINS=https://digis.app,https://www.digis.app
ABLY_API_KEY=your_ably_key
QSTASH_TOKEN=your_qstash_token
SENTRY_DSN=your_sentry_dsn
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## **Files Created**

1. ✅ `backend/migrations/fix-active-sessions-performance.sql`
2. ✅ `backend/utils/redis-counters.js`
3. ✅ `backend/middleware/security.js` (updated)
4. ✅ `STABILIZATION_PLAN.md` (this file)

---

## **Success Metrics**

After Phase 1:
- Active sessions query: **<100ms** (was 79s)
- Auth endpoint: **<200ms** (was inconsistent)
- Zero CORS errors in production

After Phase 2:
- Real-time updates: **<500ms latency**
- Background jobs: **100% processed**
- Zero payment webhook failures

After Phase 3:
- Error rate: **<0.1%**
- API uptime: **>99.9%**
- Mean response time: **<300ms**

---

## **Quick Wins (Do These First)**

1. **Deploy the sessions index** (5 min): Instant 790x speedup
2. **Add rate limiters** (10 min): Prevent abuse
3. **Trust proxy** (2 min): Fix IP detection
4. **Add health check** (5 min): Monitor uptime

```bash
# Quick deploy script
psql $DATABASE_URL -f backend/migrations/fix-active-sessions-performance.sql
git add backend/middleware/security.js backend/server.js
git commit -m "Critical: Sessions perf + security"
git push origin main && vercel --prod
```

---

## **Support**

Questions? Check:
- 📖 `/CLAUDE.md` - Architecture overview
- 🐛 `/LOGIN_FIX_SUMMARY.md` - Recent auth fix
- 🔧 `/DEBUG_LOGIN_ISSUE.md` - Troubleshooting guide
