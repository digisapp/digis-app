# Vercel Deployment Guide for Digis

## Quick Start

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Login to Vercel

```bash
vercel login
```

### 3. Deploy to Staging

```bash
vercel --prod=false
```

---

## Environment Variables Setup

You need to configure these in the Vercel dashboard (Settings > Environment Variables):

### Required Variables

#### Database
```
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?pgbouncer=true&connection_limit=10
```

#### Supabase
```
SUPABASE_URL=https://[YOUR-PROJECT].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
```

#### Redis (Upstash) - **REQUIRED for caching**
```
UPSTASH_REDIS_REST_URL=https://[YOUR-REDIS].upstash.io
UPSTASH_REDIS_REST_TOKEN=AX...
```

#### Stripe
```
STRIPE_SECRET_KEY=sk_live_... (or sk_test_... for staging)
STRIPE_WEBHOOK_SECRET=whsec_...
```

#### Agora.io
```
AGORA_APP_ID=[YOUR_APP_ID]
AGORA_APP_CERTIFICATE=[YOUR_CERTIFICATE]
```

#### General
```
NODE_ENV=production
FRONTEND_URL=https://your-frontend.vercel.app
ALLOWED_ORIGINS=https://your-frontend.vercel.app,https://yourdomain.com
```

---

## Post-Deployment Verification

### 1. Run Smoke Tests

```bash
chmod +x smoke-test.sh
./smoke-test.sh https://your-deployment.vercel.app YOUR_JWT_TOKEN
```

### 2. Check Critical Endpoints

```bash
curl https://your-deployment.vercel.app/health
curl https://your-deployment.vercel.app/api/healthz
curl https://your-deployment.vercel.app/ready
```

---

## Deployment Checklist

- [ ] All environment variables set in Vercel
- [ ] Stripe webhook endpoint configured
- [ ] Upstash Redis configured and tested
- [ ] Database migrations applied
- [ ] Smoke tests passing
- [ ] Frontend deployed and connected

---

