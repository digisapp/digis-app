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

---

## 📱 **iOS Hydration Fix Deployment**

### What Was Fixed
- React error #310 (Suspense hydration mismatch) on iOS Safari during login
- Replaced `suppressHydrationWarning` band-aid with proper `HydrationGate` component
- Added ESLint rules to catch unsafe SSR patterns
- Implemented build-based PWA cache versioning

### Pre-Deployment Steps

1. **Update Service Worker Build Number**
   ```bash
   # Edit frontend/public/sw.js
   # Increment BUILD_NUMBER: '20251015-002'
   ```

2. **Run Linter**
   ```bash
   cd frontend && npm run lint
   ```

3. **Test on iOS Safari (Required!)**
   - [ ] Clear Safari cache (Settings → Safari → Clear History)
   - [ ] Hard refresh homepage (logged out)
   - [ ] Login in portrait mode
   - [ ] Login in landscape mode
   - [ ] Check console for React error #310 (should be none)
   - [ ] Verify no "We'll be right back!" screen

### Deployment

```bash
cd frontend
npm run build
git add -A
git commit -m "deploy: iOS hydration fix"
git push origin main
# Deploy via your platform (Vercel/Netlify)
```

### Post-Deploy Verification

1. **On Real iPhone (not simulator)**
   - [ ] Clear Safari cache completely
   - [ ] Visit app (logged out)
   - [ ] Login as Creator → See Dashboard
   - [ ] Login as Fan → See Explore
   - [ ] No React error #310 in console
   - [ ] No flicker on first paint

2. **Regression Testing**
   - [ ] Desktop login works
   - [ ] Android login works
   - [ ] Creator profile editing works

### Troubleshooting

**Still seeing React error #310?**
1. Increment BUILD_NUMBER in sw.js
2. Run ESLint to find unsafe patterns
3. Check `frontend/SSR_SAFETY_GUIDE.md` for solutions

**Service worker not updating?**
1. Increment BUILD_NUMBER
2. Clear browser cache
3. Hard refresh (Cmd+Shift+R)

### Resources
- HydrationGate: `frontend/src/components/HydrationGate.jsx`
- SSR Guide: `frontend/SSR_SAFETY_GUIDE.md`
- ESLint: `frontend/.eslintrc.json`

