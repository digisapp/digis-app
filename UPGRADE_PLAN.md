# Production Upgrade Plan

This document outlines the systematic upgrade path to make Digis production-perfect.

## ✅ Completed (Already Implemented)

1. **Monorepo Structure** - pnpm workspace configuration
2. **Environment Validation** - Strict Zod-based env validation in `backend/src/config/env.ts`
3. **CI/CD Pipeline** - GitHub Actions for lint/test/build on every PR
4. **Code Quality Tools** - ESLint, Prettier, EditorConfig

## 🚧 Phase 1: Foundation (Week 1-2)

### Priority: CRITICAL

- [ ] **Migrate to pnpm**
  ```bash
  npm install -g pnpm@9.6.0
  pnpm install
  ```

- [ ] **Enable Branch Protection**
  - Go to GitHub repo settings → Branches
  - Protect `main` branch
  - Require PR reviews (1 minimum)
  - Require status checks to pass (CI)
  - Require branches to be up to date
  - Enable "Require signed commits" (optional)

- [ ] **Add Conventional Commits**
  - Install: `pnpm add -D @commitlint/cli @commitlint/config-conventional`
  - Add `.commitlintrc.json`:
    ```json
    {
      "extends": ["@commitlint/config-conventional"],
      "rules": {
        "type-enum": [2, "always", [
          "feat", "fix", "docs", "style", "refactor",
          "perf", "test", "chore", "revert", "ci"
        ]]
      }
    }
    ```

- [ ] **Consolidate SQL Migrations**
  - Current: 147+ migration files + many one-off SQL scripts
  - Action: Review and consolidate into sequentially numbered migrations
  - Keep: Supabase migrations as source of truth
  - Remove: All `FIX_*.sql`, `RUN_THIS_*.sql`, `CREATE_*.sql` from root
  - Document: Migration strategy in `MIGRATIONS.md`

- [ ] **Update Backend package.json**
  ```json
  {
    "name": "@digis/backend",
    "scripts": {
      "dev": "tsx watch api/index.js",
      "build": "tsc -p .",
      "lint": "eslint . --ext .js,.ts",
      "type-check": "tsc --noEmit",
      "test": "vitest run",
      "migrate": "node utils/migrate.js"
    }
  }
  ```

- [ ] **Update Frontend package.json**
  ```json
  {
    "name": "@digis/frontend",
    "scripts": {
      "dev": "vite",
      "build": "tsc && vite build",
      "lint": "eslint . --ext .js,.jsx,.ts,.tsx",
      "type-check": "tsc --noEmit",
      "test": "vitest run"
    }
  }
  ```

## 🔐 Phase 2: Security Hardening (Week 2-3)

### Priority: HIGH

- [ ] **JWT Strategy - Bearer Token (No CSRF needed)**
  - ✅ Use `Authorization: Bearer <token>` header
  - ✅ Store access token in memory on client
  - ✅ Optional: Refresh token in httpOnly cookie with strict origin checks
  - Update `backend/middleware/auth.js` to check `Authorization` header
  - Remove cookie-based auth if present

- [ ] **Webhook Security**
  - [ ] Fix Stripe webhook verification:
    ```javascript
    // backend/routes/stripe-webhooks.js
    import Stripe from 'stripe';
    import bodyParser from 'body-parser';

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    router.post('/stripe',
      bodyParser.raw({ type: 'application/json' }), // RAW BODY
      async (req, res) => {
        const sig = req.headers['stripe-signature'];
        let event;
        try {
          event = stripe.webhooks.constructEvent(
            req.body, // raw buffer
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
          );
        } catch (err) {
          return res.status(400).send(`Webhook Error: ${err.message}`);
        }
        // Handle event...
        res.json({ received: true });
      }
    );
    ```

  - [ ] Add idempotency for all webhooks:
    ```javascript
    // Check Redis before processing
    const key = `webhook:${event.id}`;
    const exists = await redis.get(key);
    if (exists) return res.sendStatus(200);
    await redis.set(key, '1', 'EX', 86400); // 24h TTL
    ```

- [ ] **Rate Limiting Enhancement**
  ```javascript
  // backend/api/index.js
  import rateLimit from 'express-rate-limit';

  // Stricter limits for money endpoints
  const financialLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per window
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api/payments', financialLimiter);
  app.use('/api/tokens/purchase', financialLimiter);
  ```

- [ ] **Add Request ID Middleware**
  ```javascript
  // backend/middleware/requestId.js
  import { randomUUID } from 'crypto';

  export function requestId(req, res, next) {
    const id = req.headers['x-request-id'] || randomUUID();
    req.id = id;
    res.setHeader('x-request-id', id);
    next();
  }
  ```

## ⚡ Phase 3: Performance & DX (Week 3-4)

### Priority: MEDIUM

- [ ] **Add BullMQ for Background Jobs**
  ```bash
  pnpm add bullmq ioredis
  ```

  ```javascript
  // backend/lib/queue.js
  import { Queue, Worker } from 'bullmq';
  import Redis from 'ioredis';

  const connection = new Redis(process.env.REDIS_URL);

  export const mediaQueue = new Queue('media', { connection });

  export function initWorkers() {
    new Worker('media', async job => {
      if (job.name === 'thumbnail') {
        // Generate thumbnail
      }
    }, { connection });
  }
  ```

- [ ] **Frontend: Add TanStack Query**
  ```bash
  cd frontend
  pnpm add @tanstack/react-query
  ```

  ```jsx
  // frontend/src/lib/api.js
  export async function api(path, init) {
    const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAccessToken()}`,
        ...init?.headers
      },
      ...init
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
  }
  ```

- [ ] **Add Strict TypeScript**
  ```json
  // backend/tsconfig.json
  {
    "compilerOptions": {
      "strict": true,
      "noImplicitAny": true,
      "strictNullChecks": true,
      "esModuleInterop": true,
      "module": "NodeNext",
      "target": "ES2022"
    }
  }
  ```

## 🧪 Phase 4: Testing (Week 4+)

### Priority: MEDIUM-HIGH

- [ ] **Add E2E Tests with Playwright**
  ```bash
  cd frontend
  pnpm add -D @playwright/test
  ```

  ```javascript
  // frontend/tests/e2e/critical-flow.spec.ts
  test('user can login and follow creator', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="login-button"]');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
    // ... continue flow
  });
  ```

- [ ] **Add Integration Tests for Backend**
  ```javascript
  // backend/__tests__/integration/auth.test.js
  import { describe, it, expect } from 'vitest';
  import request from 'supertest';
  import { app } from '../../api/index.js';

  describe('POST /api/auth/login', () => {
    it('returns access token on valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('access_token');
    });
  });
  ```

## 📊 Phase 5: Observability (Ongoing)

- [ ] **Add Sentry**
  ```bash
  pnpm add @sentry/node @sentry/react
  ```

- [ ] **Add Structured Logging**
  - Already added `pino` logger in `backend/src/config/logger.ts`
  - Use in all routes: `logger.info({ userId, action }, 'user_action')`

- [ ] **Add Health Check Endpoint**
  ```javascript
  // backend/routes/health.js
  app.get('/health', async (req, res) => {
    const checks = {
      database: await checkDatabase(),
      redis: await checkRedis(),
      uptime: process.uptime()
    };
    const healthy = Object.values(checks).every(c => c.status === 'ok');
    res.status(healthy ? 200 : 503).json(checks);
  });
  ```

## 📝 Documentation Tasks

- [ ] Create `CONTRIBUTING.md`
- [ ] Create PR template (`.github/pull_request_template.md`)
- [ ] Document API endpoints (Swagger/OpenAPI)
- [ ] Create runbooks for common operations
- [ ] Document deployment process

## 🚀 Deployment Checklist

Before going to production:

- [ ] All environment variables in Vercel/hosting platform
- [ ] Database backups configured
- [ ] Monitoring and alerting set up
- [ ] Rate limits tested and tuned
- [ ] Error tracking (Sentry) configured
- [ ] SSL certificates valid
- [ ] CORS origins restricted to production domains
- [ ] All secrets rotated from development
- [ ] CDN configured for static assets
- [ ] Load testing completed

## Next Steps

1. **Week 1**: Complete Phase 1 (Foundation)
2. **Week 2-3**: Complete Phase 2 (Security)
3. **Week 3-4**: Start Phase 3 (Performance)
4. **Ongoing**: Phase 4 (Testing) and Phase 5 (Observability)

## Getting Help

If you need help with any of these steps:
- Review the example code in this document
- Check the original review document
- Consult the official documentation for each tool
- Ask in team chat for clarification
