# ✅ Digis Deployment Checklist

**Use this checklist to deploy each phase safely**

## 🔴 **Phase 1: Critical Performance & Security** (Deploy Today)

### Pre-Deployment
- [ ] Database backup completed
- [ ] Run migration: `psql $DATABASE_URL -f backend/migrations/fix-active-sessions-performance.sql`
- [ ] Install deps: `npm install helmet cors express-rate-limit`

### Deploy
```bash
git add .
git commit -m "Phase 1: Performance + Security"
git push origin main && vercel --prod
```

### Verify
- [ ] Health check: `curl https://your-api.vercel.app/healthz`
- [ ] Sessions query: <100ms (was 79s)
- [ ] Login works end-to-end

### Rollback (if needed)
```bash
vercel rollback
```

---

## 🟡 **Phase 2: Real-time Migration** (Tomorrow)

### Pre-Deploy
- [ ] Ably/Pusher account created
- [ ] Environment vars: `ABLY_API_KEY`, `QSTASH_TOKEN`

### Deploy
```bash
npm install ably @upstash/qstash
git push origin main && vercel --prod
```

### Verify
- [ ] Real-time updates work
- [ ] Background jobs execute
- [ ] No WebSocket errors

---

## 🟢 **Phase 3: Monitoring** (Day 3)

### Pre-Deploy
- [ ] Sentry account + DSN
- [ ] Environment var: `SENTRY_DSN`

### Deploy
```bash
npm install @sentry/node
git push origin main && vercel --prod
```

### Verify
- [ ] Errors appear in Sentry
- [ ] Circuit breaker works
- [ ] Uptime >99.9%
