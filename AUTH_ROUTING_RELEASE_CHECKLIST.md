# Auth & Routing System - Release Checklist

## ✅ Pre-Deployment Verification (5 minutes)

### 1. Creator Login Flow
- [ ] Login as creator → lands on `/dashboard`
- [ ] Hard refresh stays on `/dashboard` (no flicker)
- [ ] Sentry breadcrumb `auth_boot` logged with `role=creator` tag
- [ ] No console errors

### 2. Fan Login Flow
- [ ] Login as fan → lands on `/explore`
- [ ] Open profile menu → `data-test="creator-tools"` **hidden**
- [ ] Open profile menu → `data-test="fan-tools"` **visible**
- [ ] No redirect loops

### 3. Backend Outage Simulation
- [ ] Temporarily return 500 from `/api/auth/sync-user` (DevTools Network tab)
- [ ] See single `auth_sync_failed` Sentry breadcrumb
- [ ] Cached profile renders (no blocking error)
- [ ] Toast appears: "We're syncing your account. You can keep browsing."
- [ ] Re-enable endpoint
- [ ] See `auth_sync_recovered` Sentry breadcrumb

### 4. Deep Link Redirect
- [ ] As fan, navigate to `/dashboard?tab=stats`
- [ ] Redirected **once** to `/explore` (no loop)
- [ ] Query string removed

### 5. Responsive Behavior
- [ ] Resize desktop ↔ mobile
- [ ] No flicker, no extra `auth_boot` breadcrumbs
- [ ] Navigation adapts smoothly

---

## 🚀 Production Configuration

### Environment Variables

#### ✅ Confirmed in `.env.production`:
```bash
VITE_DEBUG_UI=false              # Disables console logs in prod
VITE_SENTRY_DSN=<your-dsn>       # Sentry error tracking
VITE_SENTRY_ENABLED=true         # Enable Sentry
```

#### ⚠️ Verify in Vercel Dashboard:
- Production deployment has `VITE_DEBUG_UI=false`
- Preview deployments can use `VITE_DEBUG_UI=true` for staging

### Sentry Configuration

#### Sampling Rates (in `sentry.client.js`):
```javascript
tracesSampleRate: 0.1            // 10% of transactions (adjust based on volume)
replaysSessionSampleRate: 0.0     // Don't record all sessions
replaysOnErrorSampleRate: 1.0     // Record all error sessions
```

**Recommendations:**
- **Low traffic** (<10k users/day): traces 10-20%, errors 100%
- **Medium traffic** (10k-100k): traces 5-10%, errors 100%
- **High traffic** (>100k): traces 1-5%, errors 50-100%

---

## 🧪 Playwright Smoke Tests

### Run before deploy:
```bash
cd frontend
npx playwright test tests/auth-routing.spec.js
```

### Key Tests:
1. **Fan login** → `/explore`, fan-tools visible
2. **Creator login** → `/dashboard`, creator-tools visible
3. **Deep link redirect** → no loops with query strings
4. **Slow network** → skeleton + "Still loading..." after 3s
5. **Circuit breaker** → cached profile + toast

---

## 📊 Post-Deploy Monitoring

### Sentry Dashboard Setup

Create a dashboard with these queries:

#### 1. Auth Boot Events
```
event.message:"auth_boot"
```
**Expected:** Steady rate matching user logins

#### 2. Role Redirects
```
event.message:"role_redirect"
```
**Expected:** Low volume (only when from !== to)

#### 3. Sync Failures
```
event.message:"auth_sync_failed"
```
**Alert if >1% of auth_boot events**

#### 4. Sync Recovery
```
event.message:"auth_sync_recovered"
```
**Should follow auth_sync_failed events**

#### 5. Invalid Roles
```
event.message:"invalid_role"
```
**Alert immediately** (indicates backend data issue)

#### 6. Slow Role Resolution
```
event.message:"role_resolution_slow"
```
**Monitor for backend performance issues**

### Grouped by Role
Filter all queries by: `tags.role:"creator"`, `tags.role:"fan"`, `tags.role:"guest"`

---

### Alert Configuration

Create two low-noise alerts to catch critical issues:

#### Alert 1: High Sync Failure Rate (Backend Health)

**Trigger:** `auth_sync_failed` rate exceeds 1% of `auth_boot` events in a 5-minute window

**Setup in Sentry:**
1. Navigate to **Alerts** → **Create Alert**
2. Select **Issue Alert** or **Metric Alert**
3. Configure:
   - **Metric:** Custom query
   - **Query:**
     ```
     (count(event.message:"auth_sync_failed") / count(event.message:"auth_boot")) * 100 > 1
     ```
   - **Time window:** 5 minutes
   - **Evaluation frequency:** Every 1 minute
4. **Action:** Send notification to #engineering-alerts Slack channel
5. **Alert name:** `Auth Sync Failure Rate > 1%`
6. **Description:** "Backend /api/auth/sync-user endpoint failing at >1% rate. Check backend health, database connections, and Supabase status."

**Expected baseline:** <0.1% failure rate under normal conditions

**Response playbook:**
- Check backend logs for `/api/auth/sync-user` errors
- Verify database connection pool health
- Check Supabase dashboard for outages
- Review recent backend deployments

---

#### Alert 2: Invalid Role Detection (Data Integrity)

**Trigger:** Any `invalid_role` event occurs (immediate notification)

**Setup in Sentry:**
1. Navigate to **Alerts** → **Create Alert**
2. Select **Issue Alert**
3. Configure:
   - **When:** `event.message:"invalid_role"`
   - **If:** Event count is more than **0** in **1 minute**
   - **Then:** Send notification immediately
4. **Action:**
   - Send to #engineering-critical Slack channel
   - Page on-call engineer (if available)
5. **Alert name:** `Invalid Role Detected`
6. **Description:** "A user logged in with an invalid or unexpected role value. This indicates a backend data integrity issue or upstream service sending malformed data."

**Expected baseline:** Zero occurrences under normal conditions

**Response playbook:**
- Check Sentry event details for:
  - `role` field (what invalid value was received)
  - `originalRole` field (casing or format issues)
  - `uid` (affected user)
- Query users table for affected user:
  ```sql
  SELECT id, email, username, role FROM users WHERE id = '<uid>';
  ```
- Verify role enum in database matches application expectations
- Check if recent migration or backend change modified role handling
- If widespread: emergency hotfix to normalize roles in backend

---

### Alert Best Practices

**Notification Channels:**
- **High Sync Failure Rate:** Non-critical, 5min aggregation → #engineering-alerts
- **Invalid Role:** Critical, immediate → #engineering-critical + PagerDuty

**Muting/Snoozing:**
- During planned maintenance, mute "High Sync Failure Rate" alert
- Never mute "Invalid Role" alert (indicates data corruption)

**Review Cadence:**
- Weekly: Review alert thresholds (is 1% still appropriate?)
- Monthly: Check for false positives and adjust time windows

---

## 🎯 Feature Flags (Optional)

### Circuit Breaker Toast Toggle

To disable the toast in production without redeploying:

**Option 1: Environment Variable**
```bash
# Add to .env.production
VITE_CIRCUIT_BREAKER_TOAST=false
```

Then in `AuthContext.jsx`:
```javascript
const showToast = import.meta.env.VITE_CIRCUIT_BREAKER_TOAST !== 'false';
if (state === 'backoff' && !circuitBreakerToastShown.current && showToast) {
  // Show toast
}
```

**Option 2: LaunchDarkly / Feature Flag Service**
```javascript
const showToast = useFeatureFlag('circuit-breaker-toast', true);
```

---

## 📝 Known Edge Cases (Handled)

### ✅ Safari Private Mode
- sessionStorage unavailable → uses in-memory fallback
- Circuit breaker still works identically

### ✅ Trailing Slashes
- `/dashboard` and `/dashboard/` treated as same
- No redirect loops

### ✅ Query Strings
- `/dashboard?x=1` normalized correctly
- Redirects don't spam breadcrumbs

### ✅ Slow Network
- "Still loading..." appears at 3s
- Skeleton prevents layout jump

### ✅ Backend Outage
- Cached profile used
- Exponential backoff: 5s → 15s → 60s
- Non-blocking toast informs user

---

## 🔧 Troubleshooting

### Issue: Too Many `role_redirect` Breadcrumbs
**Cause:** Redirect loops or over-calling `defaultPathFor()`
**Fix:** Check that components aren't calling redirect on every render

### Issue: No Sentry Breadcrumbs
**Cause:** `VITE_DEBUG_UI=true` or Sentry not initialized
**Fix:** Verify `.env.production` and check browser console for Sentry init

### Issue: Circuit Breaker Not Working
**Cause:** sessionStorage quota exceeded
**Fix:** In-memory fallback should kick in automatically (check console)

### Issue: Toast Spamming Users
**Cause:** Circuit breaker firing repeatedly
**Fix:** Toast only shows once per session (flag: `circuitBreakerToastShown`)

---

## 📦 Files Modified (Reference)

### Core Auth/Routing:
- `/frontend/src/contexts/AuthContext.jsx` - Circuit breaker, observability, toast
- `/frontend/src/utils/routeHelpers.js` - Redirect logic, path normalization
- `/frontend/src/lib/sentry.client.js` - Breadcrumbs, PII scrubbing, rate limiting
- `/frontend/src/components/ProtectedRoute.js` - Loading skeleton, slow load message

### Navigation:
- `/frontend/src/components/navigation/MobileNav.js` - data-test attributes
- `/frontend/src/components/ProfileDropdown.js` - data-test attributes

### Testing:
- `/frontend/tests/auth-routing.spec.js` - Playwright E2E tests

### Configuration:
- `/frontend/.env.production` - `VITE_DEBUG_UI=false`

---

## 🎉 Success Criteria

**You're production-ready when:**
- ✅ All 5 verification tests pass
- ✅ Sentry receiving breadcrumbs in staging/preview
- ✅ Playwright tests green
- ✅ No console errors in production build
- ✅ Circuit breaker tested with simulated outage
- ✅ Monitoring dashboard created

**Deploy with confidence!** 🚀
