# BullMQ → Inngest + QStash Migration Guide

## Overview

This guide documents the migration from BullMQ (Redis-based job queue) to **Inngest** (serverless workflows) + **QStash** (HTTP task queue) for full Vercel compatibility.

### Why Migrate?

**Problem:** BullMQ requires persistent Redis connections and long-running workers, which don't work on Vercel's serverless platform.

**Solution:**
- **Inngest**: Multi-step, stateful workflows with automatic retries and visibility
- **QStash**: Lightweight HTTP task queue for webhooks and simple delayed tasks
- **Upstash Redis**: Keep for caching and rate-limiting only (no longer for queues)

---

## Architecture Comparison

### Before (BullMQ)
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Express   │────▶│   BullMQ     │────▶│   Worker    │
│     API     │     │   (Redis)    │     │  (24/7 PM2) │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                    ┌──────▼──────┐
                    │    Redis    │
                    │  (Persistent) │
                    └─────────────┘
```

**Issues:**
- ❌ Workers need to run 24/7
- ❌ Redis connection required (not serverless)
- ❌ Scaling requires managing worker instances
- ❌ No built-in visibility or monitoring

### After (Inngest + QStash)
```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   Vercel     │────▶│   Inngest   │────▶│  Serverless  │
│  Functions   │     │  Platform   │     │   Execution  │
└──────────────┘     └─────────────┘     └──────────────┘
       │                                          ▲
       │                                          │
       ▼                                          │
┌──────────────┐                         ┌───────────────┐
│    QStash    │─────────────────────────▶│  Your API    │
│   (Cron)     │      HTTP Request        │  Endpoints   │
└──────────────┘                         └───────────────┘
       │
       ▼
┌──────────────┐
│ Upstash Redis│
│  (Cache only)│
└──────────────┘
```

**Benefits:**
- ✅ Fully serverless (no workers)
- ✅ Auto-scales infinitely
- ✅ Built-in retries and error handling
- ✅ Visual workflow monitoring
- ✅ Idempotency built-in
- ✅ No infrastructure management

---

## What Was Migrated

### BullMQ Jobs → Inngest Functions

| BullMQ Queue | Inngest Function | Trigger | File |
|--------------|------------------|---------|------|
| Email queue | (Moved to QStash) | HTTP delayed | `utils/qstash.js` |
| Media processing | `processMedia` | Event: `media.process` | `inngest/functions/media.js` |
| Analytics | `dailyEarningsRollup` | Cron: Daily 2 AM | `inngest/functions/earnings-rollups.js` |
| Analytics | `monthlyEarningsRollup` | Cron: Monthly | `inngest/functions/earnings-rollups.js` |
| Payout processing | `processPayouts` | Cron: 1st, 15th | `inngest/functions/payouts.js` |
| Payout retry | `retryFailedPayouts` | Cron: Daily | `inngest/functions/payouts.js` |
| Account updates | `updateAccountStatuses` | Cron: Hourly | `inngest/functions/payouts.js` |

---

## Implementation Details

### 1. Inngest Functions Created

#### Payout Workflows (`/backend/inngest/functions/payouts.js`)

**Functions:**
- `processPayouts` - Main scheduled payout processing (1st & 15th of month)
- `retryFailedPayouts` - Daily retry of failed payouts
- `updateAccountStatuses` - Hourly Stripe account status sync
- `processSinglePayout` - Manual/instant payout processing

**Features:**
- ✅ Automatic retries (up to 5 attempts)
- ✅ Concurrency limiting (prevents API rate limits)
- ✅ Idempotency via event IDs
- ✅ Step-by-step execution (resumes from failure point)
- ✅ Database locks to prevent duplicates
- ✅ Admin notifications on completion

**Trigger Example:**
```javascript
// Emit event to trigger payout
await inngest.send({
  name: 'payout.scheduled',
  data: {
    payoutDate: '2025-01-15',
    dayOfMonth: 15
  }
});
```

#### Earnings Rollups (`/backend/inngest/functions/earnings-rollups.js`)

**Functions:**
- `dailyEarningsRollup` - Daily earnings aggregation (runs at 2 AM)
- `monthlyEarningsRollup` - Monthly rollup (runs on 1st of month)
- `warmAnalyticsCache` - Pre-cache popular queries (hourly)

**Features:**
- ✅ Aggregates earnings by source (tips, subscriptions, calls, etc.)
- ✅ Updates creator lifetime earnings
- ✅ Calculates platform-wide statistics
- ✅ Generates monthly statements
- ✅ Warms Upstash Redis cache

**Trigger Example:**
```javascript
// Trigger daily rollup
await inngest.send({
  name: 'earnings.rollup-daily',
  data: { targetDate: '2025-01-15' }
});
```

### 2. QStash Utilities (`/backend/utils/qstash.js`)

**Use Cases:**
- Delayed HTTP requests (e.g., "send email in 5 minutes")
- Webhook relay with signature verification
- Cron triggers (→ Inngest events)

**Examples:**

```javascript
const { sendEmailDelayed, schedulePayouts } = require('../utils/qstash');

// Send delayed email
await sendEmailDelayed({
  to: 'user@example.com',
  template: 'welcome',
  data: { name: 'John' },
  delayMinutes: 5
});

// Schedule payout cron jobs
await schedulePayouts(); // Runs on 1st & 15th of month
```

### 3. Upstash Redis Cache (`/backend/utils/upstash-cache.js`)

**NEW Purpose:** Caching and rate-limiting only (no longer for job queues)

**Use Cases:**
- Creator profile caching
- Analytics caching
- Feature flags
- Distributed locks
- Rate limiting counters
- User presence tracking

**Examples:**

```javascript
const cache = require('../utils/upstash-cache');

// Cache creator profile
await cache.cacheCreatorProfile(creatorId, profile, 300); // 5 min TTL

// Get or compute
const topCreators = await cache.getOrCompute(
  'analytics:top-creators:30d',
  async () => {
    // Expensive query
    return await db.query('SELECT ...');
  },
  3600 // 1 hour TTL
);

// Distributed lock (prevent duplicate payouts)
const locked = await cache.acquireLock(`payout:${payoutId}`, 60);
if (!locked) {
  return { error: 'Payout already processing' };
}
```

### 4. Inngest API Routes

#### Main Handler (`/backend/api/inngest.js`)
Serves Inngest webhook handler for function execution.

#### Trigger Endpoint (`/backend/api/inngest-trigger.js`)
Allows triggering Inngest events via HTTP (for QStash cron):

```bash
POST /api/inngest/trigger
{
  "name": "earnings.rollup-daily",
  "data": {}
}
```

---

## Setup Instructions

### Step 1: Environment Variables

Add to `.env`:

```bash
# Inngest
INNGEST_EVENT_KEY=your_inngest_event_key
INNGEST_SIGNING_KEY=your_inngest_signing_key

# QStash (Upstash)
QSTASH_TOKEN=your_qstash_token

# Upstash Redis (existing - keep for caching)
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_redis_token

# Backend URL (for QStash callbacks)
BACKEND_URL=https://your-backend.vercel.app
```

**Get Keys:**
1. **Inngest**: https://app.inngest.com → Create account → Get event key
2. **QStash**: https://console.upstash.com → QStash → Get token
3. **Upstash Redis**: Already configured (existing)

### Step 2: Register Inngest Route

Add to `backend/api/index.js`:

```javascript
// Inngest webhook handler
const inngestHandler = require('./inngest');
app.use('/api/inngest', inngestHandler);

// Inngest trigger endpoint (for QStash cron)
const inngestTrigger = require('./inngest-trigger');
app.post('/api/inngest/trigger', inngestTrigger);
```

### Step 3: Deploy to Inngest

```bash
# Install Inngest CLI
npx inngest-cli@latest

# Deploy functions
cd backend
npx inngest-cli deploy
```

### Step 4: Set Up QStash Cron Jobs

**Option A: Manual (Upstash Dashboard)**
1. Go to https://console.upstash.com/qstash
2. Create schedule → Cron
3. URL: `https://your-backend.vercel.app/api/inngest/trigger`
4. Body: `{ "name": "earnings.rollup-daily", "data": {} }`
5. Cron: `0 2 * * *` (Daily at 2 AM)

**Option B: Programmatic**
```javascript
const { schedulePayouts, scheduleNightlyRollup } = require('./utils/qstash');

// Run once to set up cron schedules
await schedulePayouts();
await scheduleNightlyRollup();
```

---

## Migration Checklist

### Pre-Migration
- [x] Install Inngest SDK (`pnpm add inngest`)
- [x] Install QStash SDK (`pnpm add @upstash/qstash`)
- [x] Create Inngest account (free tier: 50k steps/month)
- [x] Get QStash token (free tier: 500 requests/day)
- [x] Inventory BullMQ jobs (see table above)

### Code Migration
- [x] Create Inngest client (`inngest/client.js`)
- [x] Migrate payout workflows (`inngest/functions/payouts.js`)
- [x] Migrate earnings rollups (`inngest/functions/earnings-rollups.js`)
- [x] Create QStash utilities (`utils/qstash.js`)
- [x] Create Upstash cache utility (`utils/upstash-cache.js`)
- [x] Create Inngest API routes (`api/inngest.js`, `api/inngest-trigger.js`)

### Testing
- [ ] Test payout processing locally
- [ ] Test earnings rollup locally
- [ ] Deploy to Inngest dev environment
- [ ] Set up QStash cron jobs
- [ ] Test end-to-end workflow

### Production Cutover
- [ ] Deploy backend with Inngest routes
- [ ] Set environment variables in Vercel
- [ ] Deploy Inngest functions to production
- [ ] Set up production QStash cron
- [ ] Monitor first payout cycle (1st or 15th)
- [ ] Remove BullMQ workers and dependencies

---

## Testing Guide

### Local Testing (Development)

```bash
# 1. Start backend
cd backend
pnpm dev

# 2. Trigger payout manually
curl -X POST http://localhost:3005/api/inngest/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "name": "payout.scheduled",
    "data": {
      "payoutDate": "2025-01-15",
      "dayOfMonth": 15
    }
  }'

# 3. Check Inngest dashboard
# Visit: https://app.inngest.com → Functions → View executions
```

### Triggering Events Manually

```javascript
const { inngest } = require('./inngest/client');

// Process payouts
await inngest.send({
  name: 'payout.scheduled',
  data: {
    payoutDate: new Date().toISOString().split('T')[0],
    dayOfMonth: new Date().getDate()
  }
});

// Daily rollup
await inngest.send({
  name: 'earnings.rollup-daily',
  data: {}
});

// Single payout
await inngest.send({
  name: 'payout.process-single',
  data: {
    payoutId: 'payout_123',
    creatorId: 'creator_abc',
    amount: 10000, // $100.00 in cents
    stripeAccountId: 'acct_...'
  }
});
```

---

## Monitoring

### Inngest Dashboard
- **URL:** https://app.inngest.com
- **Metrics:**
  - Function executions (success/failure)
  - Step-by-step execution logs
  - Retry attempts
  - Execution duration
  - Error rates

### QStash Dashboard
- **URL:** https://console.upstash.com/qstash
- **Metrics:**
  - Scheduled jobs
  - HTTP request delivery
  - Retry attempts
  - Success/failure rates

### Upstash Redis Dashboard
- **URL:** https://console.upstash.com/redis
- **Metrics:**
  - Commands per second
  - Cache hit rate
  - Memory usage
  - Key count

---

## Cost Comparison

### Before (BullMQ + Redis + Workers)
| Service | Cost |
|---------|------|
| Redis (managed) | $10-20/month |
| Worker instances (PM2/Docker) | $20-50/month |
| DevOps time | 4-8 hours/month |
| **Total** | **$30-70/month + 4-8 hours** |

### After (Inngest + QStash + Upstash)
| Service | Free Tier | Paid Tier |
|---------|-----------|-----------|
| Inngest | 50k steps/month | $20/month (250k steps) |
| QStash | 500 requests/day | $10/month (10k requests/day) |
| Upstash Redis | 10k commands/day | $10/month (100k/day) |
| Worker management | $0 (serverless) | $0 |
| DevOps time | 0 hours | 0 hours |
| **Total** | **$0/month** | **$40/month** |

**Savings:** $30-70/month + 4-8 hours DevOps time

---

## Rollback Plan

If issues occur, you can roll back:

### Option 1: Re-enable BullMQ (Temporary)
```javascript
// Keep BullMQ code for 1-2 weeks as backup
// Switch between systems with feature flag
const USE_INNGEST = process.env.USE_INNGEST === 'true';

if (USE_INNGEST) {
  await inngest.send({ name: 'payout.scheduled', data: {} });
} else {
  await payoutQueue.add('process', {});
}
```

### Option 2: Manual Execution
```bash
# Run payout processor directly
node backend/jobs/payout-processor.js process
```

---

## Next Steps

1. **Set up Inngest account** (5 min)
   - Sign up at https://app.inngest.com
   - Create project
   - Get event key

2. **Test locally** (15 min)
   - Add environment variables
   - Register Inngest routes
   - Trigger test event
   - View in Inngest dashboard

3. **Deploy to staging** (30 min)
   - Deploy backend with Inngest routes
   - Set Vercel environment variables
   - Deploy Inngest functions
   - Test end-to-end

4. **Production cutover** (1-2 weeks)
   - Monitor first payout cycle
   - Verify earnings rollups
   - Remove BullMQ after stable

---

## Support Resources

- **Inngest Docs:** https://www.inngest.com/docs
- **QStash Docs:** https://upstash.com/docs/qstash
- **Upstash Redis Docs:** https://upstash.com/docs/redis
- **This Migration Guide:** You're reading it!

---

**Migration Status:** ✅ Code Complete - Ready for Testing

**Last Updated:** January 2025
**Prepared By:** Claude Code (Anthropic)
**Target Platform:** Vercel Serverless
