# Logout Flow Testing & Validation Guide

## 🧪 Quick Sanity Checks (Local Testing)

### 1. LOGOUT_DEST Under Subpath Deploy
**What:** Verify logout lands at correct base URL when app is deployed under a subpath

**How to Test:**
```bash
# Set base URL environment variable
export VITE_BASE_URL=/app/
npm run build
npm run preview

# Or in .env.local:
# VITE_BASE_URL=/app/

# Test:
# 1. Log in
# 2. Navigate to /app/classes
# 3. Click Sign Out
# 4. Verify: URL is /app/ (not /)
# 5. Press back button
# 6. Verify: Stays at /app/ (no bounce to /app/classes)
```

**Expected Result:**
- Logout redirects to `/app/` (respects BASE_URL)
- Back button stays at `/app/` (replace:true working)

**Line Reference:** `src/constants/auth.js:12-16`

---

### 2. Double 401 Storm Test (isRedirecting Flag)
**What:** Verify concurrent 401 errors only trigger one redirect

**How to Test:**
```bash
# Open DevTools → Network tab
# Set throttling to "Slow 3G"

# In Console, invalidate auth token:
localStorage.removeItem('supabase.auth.token')

# Make multiple API calls rapidly:
fetch('/api/profile')
fetch('/api/tokens/balance')
fetch('/api/users/me')

# Watch Network tab and Console logs
```

**Expected Result:**
- Only 1 redirect to LOGOUT_DEST
- Console shows: "Redirect already in progress, skipping" for subsequent 401s
- Sentry breadcrumb: `auth_api_redirect` logged once with reason

**Line Reference:** `src/utils/apiClient.js:305-306, 314-317`

---

### 3. Service Worker Cache Cleanup
**What:** Verify all caches are cleared on logout

**How to Test:**
```bash
# 1. Open DevTools → Application → Cache Storage
# 2. Note existing caches (if any)
# 3. Log in, browse around to populate cache
# 4. Check Application tab - should see caches
# 5. Click Sign Out
# 6. Check Application tab immediately after
```

**Expected Result:**
- All caches deleted
- Console shows: `🧹 Deleted cache: [cacheName]` for each cache
- Application → Cache Storage section is empty

**Line Reference:** `src/contexts/AuthContext.jsx:427-437`

---

### 4. Creator Handle Validation
**What:** Verify invalid usernames redirect to /explore

**Test Cases:**
```bash
# Empty/whitespace
http://localhost:5173/         # Space character
http://localhost:5173/%20      # Encoded space
http://localhost:5173/         # Tab character

# Punctuation-only
http://localhost:5173/.
http://localhost:5173/_
http://localhost:5173/---
http://localhost:5173/@@@
http://localhost:5173/...___

# Valid (should load profile or 404)
http://localhost:5173/johndoe
http://localhost:5173/john_doe
http://localhost:5173/john-doe
```

**Expected Result:**
- Empty/whitespace/punctuation → immediate redirect to `/explore` (no API call)
- Console shows warning: "Empty or whitespace username detected" or "Punctuation-only username detected"
- Valid usernames → attempt to load profile (may 404 if user doesn't exist)

**Line Reference:** `src/components/CreatorPublicProfileEnhanced.js:159-170`

---

### 5. HomePage Title/Meta Reset
**What:** Verify stale creator metadata is cleared after logout

**How to Test:**
```bash
# 1. Visit a creator profile (e.g., /johndoe)
# 2. Check DevTools → Elements → <head>
#    - Look for: <title>, <meta property="og:title">, etc.
#    - Should show creator-specific content
# 3. Log out
# 4. Check <head> again
```

**Expected Result:**
- Title: "Digis - Connect with Creators" (not creator name)
- OG title: "Digis - Connect with Creators"
- OG description: "Connect with your favorite creators..."
- OG image: "https://digis.cc/og-image.png" (not creator avatar)
- Console shows: `📄 HomePage: Reset page title and meta tags`

**Line Reference:** `src/components/HomePage.js:26-41`

**E2E Test:** `frontend/tests/e2e/logout-flow.spec.js:197-230`

---

### 6. Stale Page Re-Auth Guard
**What:** Verify stale tabs don't silently re-authenticate after logout

**How to Test:**
```bash
# 1. Open app in Tab A
# 2. Log in
# 3. Duplicate tab (Tab B with same session)
# 4. In Tab A: Log out
# 5. In Tab B: Make an API request (e.g., click a button that fetches data)
```

**Expected Result:**
- Tab B detects `signedOutAt` flag in sessionStorage
- Tab B redirects to LOGOUT_DEST (doesn't retry with refreshed token)
- Console shows: "Skip retry: page marked signed-out"
- Sentry breadcrumb: `auth_api_redirect` with reason `stale_tab_signed_out`
- Analytics event: `auth_api_redirect` with reason `stale_tab_signed_out`

**Line Reference:** `src/contexts/AuthContext.jsx:452-457, 520-525` and `src/utils/apiClient.js:362-382`

---

### 7. Unauth Splash Component
**What:** Verify smooth UX during logout redirects

**How to Test:**
```bash
# 1. While logged out, try to access a protected route (e.g., /wallet)
# 2. Observe the transition
```

**Expected Result:**
- Brief (~400ms) splash screen with spinner and "Signing you out…" text
- Smooth transition to LOGOUT_DEST
- No flicker or blank page
- Especially smooth on throttled network (DevTools → Network → Slow 3G)

**Line Reference:** `src/components/UnauthSplash.js` and `src/components/ProtectedRoute.js:84-90`

---

### 8. Analytics Events for Auth Redirects
**What:** Verify analytics events are tracked alongside Sentry breadcrumbs

**How to Test:**
```bash
# 1. Open DevTools → Console
# 2. In development mode, analytics events are logged to console
# 3. Trigger an auth redirect (e.g., invalidate token and make API call)
# 4. Check console for: [analytics.track] auth_api_redirect {reason: ...}
```

**Expected Result:**
- Console shows: `[analytics.track] auth_api_redirect` with reason code
- Reason codes: `no_session`, `stale_tab_signed_out`, `refresh_failed`, `session_check_error`
- In production: Event sent to analytics provider (Segment/Amplitude/GA)
- Respects Do Not Track (DNT) headers

**Line Reference:** `src/utils/apiClient.js:5, 337-342, 372-377, 398-403, 420-426`

---

## 🔍 Observability Checks

### Sentry Breadcrumb Verification
**After each logout test, check Sentry for:**

1. **`logout` breadcrumb** (blue, category: auth)
   - Count: Exactly 1 per logout
   - Data: `{ user, timestamp }`

2. **`auth_signed_out` breadcrumb** (blue, category: auth)
   - Count: Exactly 1 per logout
   - Data: `{ timestamp }`

3. **`auth_api_redirect` breadcrumb** (yellow/red, category: auth)
   - Count: 0 for normal logout, 1+ for 401 storm test
   - Data: `{ reason, status, timestamp }`
   - Reason codes: `no_session`, `refresh_failed`, `session_check_error`

**Ratio Check:**
```
logout count / auth_signed_out count ≈ 1.0
```

If ratio drifts outside 0.9-1.1, investigate:
- Double-logging (rage-clicks bypassing dedupe)
- Missing reset (breadcrumb flag not cleared on login/mount)

---

## ✅ Regression Checklist (2 Minutes)

Run this checklist after **any** auth or navigation changes:

### Basic Logout Flow
- [ ] Log out from `/dashboard` → lands on `/` without flicker
- [ ] Log out from `/classes` → lands on `/` without flicker (original bug)
- [ ] Log out from `/tv` → lands on `/` without flicker
- [ ] Log out from `/explore` → lands on `/` without flicker
- [ ] Log out from `/wallet` → lands on `/` without flicker

### Back Button Behavior
- [ ] After logout, press back button → stays on `/` (no bounce)
- [ ] Press back 5 times rapidly → still on `/` (replace:true working)

### Deep Links (Logged Out)
- [ ] Visit `/wallet` while logged out → redirects to `/` (ProtectedRoute)
- [ ] Visit `/dashboard` while logged out → redirects to `/`
- [ ] Visit `/admin` while logged out → redirects to `/`

### Edge Cases
- [ ] Rapid-click "Sign Out" button 5 times → only 1 redirect
- [ ] Check Sentry → only 1 `logout` breadcrumb
- [ ] Mobile menu logout (viewport 390×844) → single redirect, no flicker
- [ ] After logout, visit Home → title/OG tags show defaults (not last profile)

### API 401 Storm
- [ ] Invalidate token, make 3 API calls → only 1 redirect
- [ ] Sentry → 1 `auth_api_redirect` breadcrumb with reason

### Button Debounce
- [ ] Desktop: Click "Sign Out" → button shows "Signing out…", disabled
- [ ] Mobile: Click "Sign Out" → button shows "Signing out…", disabled
- [ ] Desktop: Rapid-click during "Signing out…" → no double action

---

## 🚀 Performance & UX Validation

### No Flicker on Logout
**What:** User should see smooth transition to home, no flash of previous page

**How to Test:**
```bash
# 1. Open DevTools → Performance tab
# 2. Start recording
# 3. Log out from /classes
# 4. Stop recording when home page loads
# 5. Check timeline for:
#    - Single navigation event
#    - No layout shifts
#    - No double renders of /classes before /
```

**Expected:**
- Single `window.location.replace()` call
- No intermediate renders of protected pages
- Home page renders immediately

---

### Mobile Touch Responsiveness
**What:** Logout button should respond instantly on touch devices

**How to Test:**
```bash
# 1. Open DevTools → Toggle device toolbar
# 2. Select iPhone 14 Pro (390×844)
# 3. Open mobile menu
# 4. Tap "Sign Out"
```

**Expected:**
- Button shows "Signing out…" within 100ms
- No delay or double-tap required
- Menu closes immediately
- Redirect to home within 500ms

---

## 🔬 Advanced Testing

### Subpath Deploy Simulation
```bash
# In vite.config.js, add:
export default {
  base: '/app/',
  // ... rest of config
}

# Build and test:
npm run build
npm run preview

# All logout tests should work with /app/ prefix
```

### Browser Restart Test
**What:** Verify breadcrumb flag resets on full page reload

```bash
# 1. Log in
# 2. Log out (triggers breadcrumb)
# 3. Hard refresh (Cmd/Ctrl + Shift + R)
# 4. Log in again
# 5. Log out again
# 6. Check Sentry → should see 2 logout breadcrumbs (not 1)
```

**Expected:**
- `resetLogoutBreadcrumb()` called on app mount
- Flag resets on browser restart
- Second logout after restart logs breadcrumb again

**Line Reference:** `src/App.js:150-152`

---

## 📊 Monitoring Dashboard Setup

### Sentry Widget 1: Logout Breadcrumb Ratio
```
Query A: count(breadcrumb.message:logout)
Query B: count(breadcrumb.message:auth_signed_out)
Formula: A / B
Display: Line chart, 24h window, 1h buckets
Alert: < 0.9 or > 1.1
```

### Sentry Widget 2: Auth Redirect Spike
```
Query: count(breadcrumb.message:auth_api_redirect)
Group by: breadcrumb.data.reason
Display: Bar chart, 24h window
Alert: > 100/hour
```

### Sentry Widget 3: Logout Error Rate
```
Query: count(error) where breadcrumb.message:logout
Display: Line chart, 7d window
Alert: > 10/day
```

---

## 🐛 Known Edge Cases & Workarounds

### Safari Private Mode
- **Issue:** `sessionStorage` denied → circuit breaker falls back to in-memory
- **Test:** Open Safari Private → log in/out → verify no crashes
- **Line:** `src/contexts/AuthContext.jsx:54-76`

### Browser Extensions
- **Issue:** Extensions may inject content that interferes with DOM queries
- **Mitigation:** Meta tag queries wrapped in `if (ogTitle)` guards
- **Line:** `src/components/HomePage.js:31-37`

### Concurrent Tab Logout
- **Issue:** User logs out in Tab A, Tab B still sees cached session
- **Mitigation:** Supabase broadcasts auth changes across tabs
- **Expected:** Tab B should detect SIGNED_OUT and clear state

---

## 📝 Test Automation (Playwright)

### Smoke Test Suite
```bash
cd frontend
npx playwright test tests/e2e/logout-flow.spec.js
```

**Coverage:**
- All protected routes logout test
- Back button verification
- Anonymous deep links
- Mobile viewport test
- Rapid-click edge case

**CI Integration:**
```yaml
# .github/workflows/e2e-tests.yml
on:
  pull_request:
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight
```

---

## 🎯 Success Criteria

**Before Merging:**
- [ ] All regression checklist items pass
- [ ] Sentry breadcrumb ratio = 1.0 ± 0.1
- [ ] No console errors during logout flow
- [ ] Mobile & desktop both tested
- [ ] Subpath deploy verified (if applicable)

**Post-Deploy:**
- [ ] Monitor Sentry for 24h
- [ ] Check `auth_api_redirect` count < 50/day
- [ ] Verify logout:auth_signed_out ratio stable
- [ ] No new logout-related issues reported

---

## 🔗 Related Documentation

- Implementation details: `/frontend/LOGOUT_HARDENING.md`
- Sentry setup: `/frontend/src/utils/sentry.js`
- E2E tests: `/frontend/tests/e2e/logout-flow.spec.js`
- Auth context: `/frontend/src/contexts/AuthContext.jsx`
