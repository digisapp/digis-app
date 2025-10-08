# Vercel Deployment Guide - Digis Platform

**Migration Status**: Phase 0 Complete - Code Ready for Phase 1 Testing
**Estimated Deploy Time**: 2-3 hours (first time), 30 minutes (subsequent)

---

## Prerequisites

### 1. Install Required Dependencies

```bash
# Backend - add new serverless-compatible packages
cd backend
pnpm add @upstash/ratelimit @upstash/redis

# Verify Supabase is installed (should already be)
pnpm list @supabase/supabase-js

cd ..
```

### 2. External Services Setup

#### Upstash Redis (REQUIRED)
1. Go to [upstash.com](https://upstash.com)
2. Create account (free tier available)
3. Create new Redis database
4. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

#### Axiom Logging (Recommended)
1. Go to [axiom.co](https://axiom.co)
2. Create account (free tier: 500MB/month)
3. Create new dataset: `digis-production`
4. Copy API token

#### Sentry (Recommended)
1. Go to [sentry.io](https://sentry.io)
2. Create two projects: `digis-backend` and `digis-frontend`
3. Copy DSN for each

---

## Step-by-Step Deployment

### Phase 1: Database Migration

```bash
# Connect to your Supabase database
psql $DATABASE_URL

# Run all migrations (if not already done)
cd backend
pnpm run migrate

# Verify schema
\dt
\q
```

---

### Phase 2: Deploy Backend

#### 2.1 Create Vercel Project

```bash
cd backend
vercel login
vercel --prod
```

When prompted:
- Project name: `digis-backend`
- Directory: `./backend` (if in monorepo) or `.` (if in backend dir)
- Override settings: **NO**

#### 2.2 Set Environment Variables

**Option A: Via Vercel Dashboard**
1. Go to Vercel dashboard → Settings → Environment Variables
2. Add each variable for Production, Preview, and Development

**Option B: Via CLI**

```bash
# Production environment
vercel env add DATABASE_URL production
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
vercel env add AGORA_APP_ID production
vercel env add AGORA_APP_CERTIFICATE production
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
vercel env add JWT_ACCESS_SECRET production
vercel env add JWT_REFRESH_SECRET production
vercel env add FRONTEND_URL production  # https://your-frontend.vercel.app
vercel env add NODE_ENV production
vercel env add VERCEL_CRON_SECRET production  # Generate: openssl rand -hex 32
vercel env add AXIOM_API_TOKEN production
vercel env add SENTRY_DSN production

# Repeat for preview and development if needed
```

**Generate secrets:**

```bash
# JWT secrets (64+ characters)
openssl rand -base64 64

# Vercel Cron secret
openssl rand -hex 32
```

#### 2.3 Update vercel.json

```bash
# Use the production config
cp backend/vercel-production.json backend/vercel.json

# Or manually update:
# - Change FRONTEND_URL in CORS to your actual frontend domain
# - Verify cron paths match /api/cron/* routes
```

#### 2.4 Deploy

```bash
vercel --prod
```

**Copy the deployment URL** (e.g., `https://digis-backend.vercel.app`)

---

### Phase 3: Deploy Frontend

#### 3.1 Update Frontend Environment

```bash
cd ../frontend

# Create .env.production
cat > .env.production << EOF
VITE_BACKEND_URL=https://digis-backend.vercel.app  # Use your backend URL
VITE_SUPABASE_URL=$VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY
VITE_AGORA_APP_ID=$VITE_AGORA_APP_ID
VITE_SENTRY_DSN=$VITE_SENTRY_DSN
VITE_APP_VERSION=2.0.0
EOF
```

#### 3.2 Create Vercel Project

```bash
vercel --prod
```

When prompted:
- Project name: `digis-frontend`
- Framework: Vite (auto-detected)
- Build command: `pnpm build`
- Output directory: `dist`

#### 3.3 Set Environment Variables

```bash
vercel env add VITE_BACKEND_URL production
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel env add VITE_STRIPE_PUBLISHABLE_KEY production
vercel env add VITE_AGORA_APP_ID production
vercel env add VITE_SENTRY_DSN production
vercel env add VITE_APP_VERSION production
```

#### 3.4 Update vercel.json

```bash
cp frontend/vercel-production.json frontend/vercel.json
```

#### 3.5 Deploy

```bash
vercel --prod
```

---

### Phase 4: Update Backend CORS

1. Go to Vercel backend dashboard → Deployments → Latest
2. Copy the frontend production URL (e.g., `https://digis-frontend.vercel.app`)
3. Update backend environment variable:

```bash
vercel env rm FRONTEND_URL production
vercel env add FRONTEND_URL production
# Enter: https://digis-frontend.vercel.app
```

4. Update `backend/middleware/cors-config.js` line 15:

```javascript
const PRODUCTION_DOMAINS = [
  'https://digis.app',  // Your custom domain
  'https://www.digis.app',
  'https://digis-frontend.vercel.app',  // Add this
];
```

5. Redeploy backend:

```bash
cd backend
vercel --prod
```

---

### Phase 5: Configure Stripe Webhooks

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://digis-backend.vercel.app/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy webhook signing secret
5. Update Vercel env:

```bash
vercel env rm STRIPE_WEBHOOK_SECRET production
vercel env add STRIPE_WEBHOOK_SECRET production
# Paste the new webhook secret
```

---

### Phase 6: Test Deployment

#### Backend Health Check

```bash
curl https://digis-backend.vercel.app/health
# Should return: {"status":"healthy",...}

curl https://digis-backend.vercel.app/ready
# Should return: {"status":"ready","checks":{...}}
```

#### Frontend Check

```bash
curl https://digis-frontend.vercel.app
# Should return HTML
```

#### CORS Test

```bash
curl -H "Origin: https://digis-frontend.vercel.app" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://digis-backend.vercel.app/api/users

# Should return 200 with CORS headers
```

#### Test Real-time (Supabase Realtime)

```javascript
// In browser console on frontend
const { createClient } = supabase;
const client = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

const channel = client.channel('test');
channel.subscribe((status) => {
  console.log('Realtime status:', status);
});

// Should log: "Realtime status: SUBSCRIBED"
```

---

### Phase 7: Custom Domain Setup (Optional)

#### Frontend Custom Domain

1. Vercel Dashboard → Project → Settings → Domains
2. Add domain: `digis.app`
3. Update DNS (A/CNAME records as shown)
4. Wait for SSL certificate (5-10 minutes)

#### Backend Custom Domain

1. Add domain: `api.digis.app`
2. Update DNS
3. Update frontend env:

```bash
vercel env rm VITE_BACKEND_URL production
vercel env add VITE_BACKEND_URL production
# Enter: https://api.digis.app
```

4. Redeploy frontend

---

## Post-Deployment Checklist

- [ ] Backend health endpoint returns 200
- [ ] Frontend loads without errors
- [ ] CORS allows requests from frontend
- [ ] Supabase connection works (login/register)
- [ ] Stripe payments work (test mode)
- [ ] Agora video calls connect
- [ ] Real-time features work (chat, notifications)
- [ ] Rate limiting triggers after threshold
- [ ] Cron jobs execute (check Vercel logs next day)
- [ ] Error tracking in Sentry
- [ ] Logs appear in Axiom
- [ ] Stripe webhooks receive events

---

## Monitoring & Debugging

### View Logs

**Vercel Dashboard:**
- Deployments → Latest → Logs
- Filter by function, time, status

**Axiom:**
```bash
# Query logs
dataset: digis-production
| where timestamp > ago(1h)
| project timestamp, level, message, requestId
```

**Sentry:**
- Issues → Filter by environment: production

### Test Cron Jobs

```bash
# Manually trigger (requires VERCEL_CRON_SECRET)
curl -X POST https://digis-backend.vercel.app/api/cron/payouts \
     -H "Authorization: Bearer YOUR_VERCEL_CRON_SECRET"
```

### Check Rate Limits

```bash
# Headers show remaining requests
curl -I https://digis-backend.vercel.app/api/users \
     -H "Authorization: Bearer YOUR_JWT"

# X-RateLimit-Remaining: 299
# X-RateLimit-Reset: 2025-10-07T12:00:00.000Z
```

---

## Rollback Procedure

If deployment fails:

```bash
# List recent deployments
vercel ls

# Rollback to previous
vercel rollback <deployment-url>

# Or via dashboard:
# Deployments → Click previous → Promote to Production
```

---

## Common Issues & Solutions

### 1. "CORS error" in browser

**Solution:**
- Verify FRONTEND_URL in backend env matches actual frontend URL
- Check `backend/middleware/cors-config.js` includes frontend domain
- For preview deployments, ensure regex pattern matches

### 2. "Rate limit error" immediately

**Solution:**
- Check UPSTASH_REDIS_REST_URL and token are set
- Verify Upstash Redis database is active
- Test Redis: `curl $UPSTASH_REDIS_REST_URL/ping -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN"`

### 3. Real-time events not received

**Solution:**
- Verify Supabase Realtime is enabled (Project Settings → API → Realtime)
- Check channel names match between backend emit and frontend subscribe
- Ensure SERVICE_ROLE_KEY has broadcast permissions

### 4. Cron jobs not running

**Solution:**
- Check Vercel Cron tab shows scheduled jobs
- Verify VERCEL_CRON_SECRET is set and matches
- Cron logs appear in Vercel → Deployments → Functions

### 5. "Function timeout" error

**Solution:**
- Increase maxDuration in vercel.json (max 300s on Pro plan)
- Move long-running tasks to background jobs (Inngest)
- Optimize database queries (add indexes)

---

## Next Steps

1. **Monitor for 24 hours** - Watch for errors, performance issues
2. **Load test** - Use tools like k6 or Artillery
3. **Set up alerts** - Sentry for errors, Axiom for log patterns
4. **Gradual rollout** - Use Vercel A/B testing (10% → 50% → 100%)
5. **Optimize** - Review function execution times, bundle sizes

---

## Support Resources

- **Vercel Docs**: https://vercel.com/docs
- **Supabase Realtime**: https://supabase.com/docs/guides/realtime
- **Upstash**: https://upstash.com/docs/redis
- **Project Issues**: See `VERCEL_MIGRATION_AUDIT.md`

