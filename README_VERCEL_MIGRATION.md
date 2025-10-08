# 🚀 Vercel Migration - Quick Start

**Status**: ✅ Phase 0 Complete - Code artifacts created
**Next**: Install dependencies → Test locally → Deploy

---

## What Was Created

This migration prep created 7 new files to make your app Vercel-ready:

### 📋 Planning & Documentation
1. `VERCEL_MIGRATION_AUDIT.md` - Complete audit of incompatibilities
2. `VERCEL_DEPLOYMENT_GUIDE.md` - Step-by-step deployment instructions
3. `README_VERCEL_MIGRATION.md` - This file (quick reference)

### 🔧 Backend Infrastructure
4. `backend/utils/realtime-adapter.js` - **Supabase Realtime adapter** (replaces Socket.io)
5. `backend/middleware/upstash-rate-limiter.js` - **Upstash rate limiting** (replaces rate-limiter-flexible)
6. `backend/middleware/cors-config.js` - **Production CORS** with regex for preview URLs
7. `backend/routes/cron/index.js` - **Vercel Cron routes** (replaces node-cron)

### ⚙️ Configuration
8. `backend/vercel-production.json` - Backend deployment config with cron
9. `frontend/vercel-production.json` - Frontend deployment config

---

## ⚡ Immediate Next Steps (10 minutes)

### 1. Install New Dependencies

```bash
cd backend
pnpm add @upstash/ratelimit @upstash/redis
cd ..
```

### 2. Create Upstash Redis Account

1. Go to [console.upstash.com](https://console.upstash.com)
2. Create new Redis database (free tier)
3. Copy credentials:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### 3. Add to `.env`

```bash
# Backend .env - add these lines:
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here
VERCEL_CRON_SECRET=$(openssl rand -hex 32)
```

### 4. Test Locally

```bash
# Start backend
cd backend
pnpm dev

# In another terminal, test new endpoints
curl http://localhost:3005/health
curl http://localhost:3005/ready
```

---

## 🎯 Migration Checklist

### Phase 1: Code Integration (2-4 hours)

- [ ] Install dependencies: `@upstash/ratelimit`, `@upstash/redis`
- [ ] Replace Socket.io calls with Realtime adapter
  - [ ] Update `backend/utils/socket.js` imports
  - [ ] Update `backend/utils/socket-enhanced.js` imports
  - [ ] Update `backend/utils/stream-activity-monitor.js`
  - [ ] Update `backend/utils/challenge-service.js`
- [ ] Replace rate limiters
  - [ ] Update `backend/middleware/rate-limiters.js` to use Upstash
  - [ ] Update all route files using rate limiters
- [ ] Update CORS
  - [ ] Replace `backend/api/index.js` CORS config with new `cors-config.js`
- [ ] Add cron routes to Express
  - [ ] In `backend/api/index.js`, add: `app.use('/api/cron', require('./routes/cron'))`
- [ ] Disable serverless-incompatible code on Vercel
  - [ ] Wrap Socket.io init in: `if (process.env.VERCEL !== '1')`
  - [ ] Wrap cron jobs in: `if (process.env.VERCEL !== '1')`
  - [ ] Wrap BullMQ workers in: `if (process.env.VERCEL !== '1')`

### Phase 2: Frontend Updates (1-2 hours)

- [ ] Update real-time subscriptions to Supabase Realtime
  - [ ] Replace Socket.io client with Supabase Realtime channels
  - [ ] Map event names (see `VERCEL_MIGRATION_AUDIT.md`)
  - [ ] Test chat, notifications, streaming events

### Phase 3: Testing (2-3 hours)

- [ ] Test locally with new adapters
  - [ ] User authentication
  - [ ] Real-time chat
  - [ ] Streaming events
  - [ ] Payment flow
  - [ ] Rate limiting
- [ ] Test cron endpoints manually
  - [ ] `POST http://localhost:3005/api/cron/payouts` (with auth header)
- [ ] Load test with Artillery/k6

### Phase 4: Deployment (1-2 hours)

- [ ] Run database migrations on Supabase
- [ ] Set up Vercel projects (backend + frontend)
- [ ] Configure environment variables (see `VERCEL_DEPLOYMENT_GUIDE.md`)
- [ ] Deploy backend first
- [ ] Deploy frontend with backend URL
- [ ] Update Stripe webhooks to Vercel URL
- [ ] Test production deployment

### Phase 5: Monitoring (Ongoing)

- [ ] Set up Axiom logging
- [ ] Configure Sentry error tracking
- [ ] Set up alerts for:
  - [ ] Rate limit exceeded (>80% of users)
  - [ ] Function timeouts
  - [ ] 5xx errors
  - [ ] Failed cron jobs
  - [ ] Database connection errors

---

## 🔥 Quick Wins You Can Do Now

### 1. Test CORS Config (1 min)

```javascript
// backend/api/index.js - replace existing CORS block with:
const { corsOptions } = require('./middleware/cors-config');
app.use(cors(corsOptions));
```

### 2. Test Realtime Adapter (2 min)

```javascript
// backend/utils/socket.js - at the top, add:
const { emitToRoom, emitToUser } = require('./realtime-adapter');

// Replace any io.to(...).emit(...) with:
await emitToRoom('stream:123', 'viewer-count', { count: 10 });
```

### 3. Test Rate Limiter (2 min)

```javascript
// backend/routes/auth.js - replace existing rate limiter:
const { authRateLimit } = require('../middleware/upstash-rate-limiter');

router.post('/login', authRateLimit, async (req, res) => {
  // ... existing code
});
```

---

## 📊 Migration Impact Summary

| Component | Current | After Migration | Effort |
|-----------|---------|-----------------|--------|
| Real-time | Socket.io (persistent) | Supabase Realtime (serverless) | 6-8h |
| Cron Jobs | node-cron (in-process) | Vercel Cron (managed) | 3-4h |
| Rate Limiting | rate-limiter-flexible | Upstash Ratelimit | 2-3h |
| Logging | Winston (file) | Winston + Axiom (cloud) | 1-2h |
| CORS | Static list | Regex + dynamic | 30min |
| Background Jobs | BullMQ (in-process) | Vercel Cron / Inngest | 2-3h |

**Total Estimated Time**: 15-20 hours

---

## 🚨 Critical Before Deploy

1. **Backup Database**: `pg_dump` your Supabase database
2. **Test Payments**: Use Stripe test mode first
3. **Preview Deploy**: Deploy to Vercel preview first (not production)
4. **Monitor Closely**: Watch logs for first 24 hours
5. **Rollback Plan**: Know how to rollback (see deployment guide)

---

## 📚 Reference Files

- **Full audit**: `VERCEL_MIGRATION_AUDIT.md`
- **Deployment steps**: `VERCEL_DEPLOYMENT_GUIDE.md`
- **Realtime adapter**: `backend/utils/realtime-adapter.js`
- **Rate limiter**: `backend/middleware/upstash-rate-limiter.js`
- **CORS config**: `backend/middleware/cors-config.js`
- **Cron routes**: `backend/routes/cron/index.js`

---

## 💡 Pro Tips

1. **Deploy backend first** - Frontend needs backend URL
2. **Use preview deployments** - Test on Vercel before promoting to prod
3. **Keep Socket.io for local dev** - Wrap Vercel-specific code in env checks
4. **Monitor rate limits** - Start conservative, increase based on usage
5. **Test cron jobs next day** - They run on schedule, not on deploy

---

## 🆘 Need Help?

1. Check `VERCEL_DEPLOYMENT_GUIDE.md` → "Common Issues & Solutions"
2. Review Vercel logs: Dashboard → Deployments → Functions
3. Test individual components locally before deploying
4. Use Vercel's preview deployments for testing

---

## ✅ Ready to Deploy?

If you've completed **Phase 1-3** above:

```bash
# Deploy backend
cd backend
vercel --prod

# Deploy frontend (after backend is live)
cd ../frontend
vercel --prod
```

Follow `VERCEL_DEPLOYMENT_GUIDE.md` for detailed steps.

**Good luck! 🚀**

