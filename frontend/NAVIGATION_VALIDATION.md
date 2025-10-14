# Navigation Hardening Validation Checklist

## Overview
This document validates the navigation hardening improvements implemented to fix mobile auth/routing flakiness.

**Changes Implemented:**
- Fast boot routing with roleHint (0-50ms vs 0-6s wait)
- iOS Safari visibility guards to prevent redirect thrash
- Clean history management (replace for store-driven navigation)
- Public stream viewing (viral link sharing)
- SSR-safe theme detection
- Memory leak prevention with AbortController

---

## 10-Minute Validation Tests

### 1. Cold Guest → Home (Public Access)
**URL:** `https://digis.cc/?nocache=1` (Safari Private Tab)

**Expected Behavior:**
- ✅ Marketing homepage loads within ~1s
- ✅ No auth spinner or "Verifying Access..." message
- ✅ Clean, immediate render

**Code Verification:**
- `AppRoutes.jsx:144-156` - Non-authenticated users see HomePage immediately
- `AppRoutes.jsx:588-594` - Fast exit for public users (no session wait)

**Observability:**
- No Sentry auth breadcrumbs for guest users
- Analytics tracks page view with `role: 'guest'`

---

### 2. Creator Login → Root (Fast Redirect)
**URL:** Log in, then visit `https://digis.cc/`

**Expected Behavior:**
- ✅ Instant redirect to `/dashboard` using roleHint
- ✅ No "Verifying Access..." spinner
- ✅ Redirect happens in 0-50ms (before backend sync completes)
- ✅ Back button stays on dashboard (no history pollution)

**Code Verification:**
- `AppRoutes.jsx:147-148` - Uses `roleResolved || roleHint` gate
- `AppRoutes.jsx:148` - Calls `defaultPathFor(role || roleHint)` with fallback
- `useViewRouter.js:35` - Gate allows roleHint: `!roleResolved && !roleHint`
- `useViewRouter.js:63` - Uses `replace: true` to avoid history pollution

**Observability:**
- `AuthContext.jsx:600-603` - Logs "Fast roleHint from metadata"
- `useRouteMonitoring.js:52-72` - Logs first navigation with `usedRoleHint: true`
- Sentry tag: `auth.role: 'creator'`, `auth.roleResolved: false` initially

**Back Button Test:**
- Press back once → should stay on `/dashboard` (not loop to `/`)
- This proves `replace: true` is working

---

### 3. Fan Login → Root (Fast Redirect)
**URL:** Log in as fan, then visit `https://digis.cc/`

**Expected Behavior:**
- ✅ Instant redirect to `/explore` using roleHint
- ✅ No auth loading spinner

**Code Verification:**
- `AppRoutes.jsx:148` - `defaultPathFor('fan')` returns `/explore`
- `DesktopNav2025.js:274` - Logo click uses `role || roleHint` for instant navigation

---

### 4. Refresh While Logged In (Cached Profile)
**URL:** On `/dashboard` or `/explore`, pull-to-refresh

**Expected Behavior:**
- ✅ No auth splash loop
- ✅ At worst, a brief skeleton (~300ms max)
- ✅ Page renders immediately using cached profile
- ✅ Backend sync happens in background (fail-open)

**Code Verification:**
- `AuthContext.jsx:581-616` - Loads cached profile first
- `AuthContext.jsx:620-625` - Circuit breaker skips sync if in backoff
- `ProtectedRoute.js:71` - Only shows spinner for 6s max before fail-open
- `DesktopNav2025.js:122-134` - Skeleton renders while `roleResolved=false`

**Observability:**
- `AuthContext.jsx:621` - Logs "Using cached profile (circuit breaker active)"
- Sentry breadcrumb: `auth_sync_failed` if backend is down
- Sentry breadcrumb: `auth_sync_recovered` when backend comes back

---

### 5. Deep Link + Signed Out (Public Stream)
**URL:** `https://digis.cc/stream/creatorname` (signed out)

**Expected Behavior:**
- ✅ Stream page renders without redirect to login
- ✅ Allows viral link sharing (like Twitch/YouTube)
- ✅ Watch experience works for signed-out users

**URL:** `https://digis.cc/streaming` (signed out)

**Expected Behavior:**
- ✅ Protected route - redirects to login
- ✅ Broadcasting console requires authentication

**Code Verification:**
- `AppRoutes.jsx:306` - `/stream/:username` is public (no ProtectedRoute)
- `AppRoutes.jsx:300-304` - `/streaming` requires auth (ProtectedRoute)

---

### 6. iOS Background Edge Case (Visibility Guard)
**URL:** Start Go Live modal, trigger camera permission

**Test Steps:**
1. Open Go Live modal
2. Trigger camera permission prompt
3. Briefly background app (home swipe)
4. Return to app

**Expected Behavior:**
- ✅ No unexpected route change
- ✅ Modal stays open, no redirect thrash
- ✅ Camera permission prompt survives backgrounding

**Code Verification:**
- `useViewRouter.js:38` - Visibility guard: `if (document.visibilityState === 'hidden') return;`
- This prevents store-driven redirects while app is backgrounded

**Edge Cases:**
- iOS Safari: Page visibility fires during permission prompts
- Android Chrome: Page visibility fires during app switcher
- Desktop: No impact (page is never "hidden" during normal use)

---

## Code Sanity Checks (5 Minutes)

### AuthContext.jsx
**Lines to Verify:**

| Line | Check | Status |
|------|-------|--------|
| 49 | `roleHint` state initialized | ✅ |
| 118-123 | `extractRoleHint()` reads Supabase metadata | ✅ |
| 94-104 | `role` memo falls back to roleHint | ✅ |
| 527-528, 598-602 | roleHint set from session on load | ✅ |
| 667, 684 | `setRoleResolved(true)` on success AND failure | ✅ |
| 574, 726 | `setAuthLoading(false)` on timeout/error | ✅ |

**Circuit Breaker:**
- Lines 144-191: `recordSyncUserSuccess()` resets backoff
- Lines 196-266: `recordSyncUserFailure()` increments backoff
- Lines 620-625: Skips sync-user during backoff, uses cache

**Observability:**
- Lines 159-163: Sentry breadcrumb on auth recovery
- Lines 248-252: Sentry breadcrumb on auth failure
- Lines 900: Sentry tag `role` set on boot
- Lines 763-767: Sentry breadcrumb on sign out

---

### AppRoutes.jsx
**Lines to Verify:**

| Line | Check | Status |
|------|-------|--------|
| 147 | Gate: `roleResolved || roleHint` | ✅ |
| 148 | `defaultPathFor(role || roleHint)` with fallback | ✅ |
| 306 | `/stream/:username` is public (no ProtectedRoute) | ✅ |
| 300-304 | `/streaming` is protected | ✅ |
| 348-349 | Catch-all also uses `role || roleHint` | ✅ |

---

### useViewRouter.js
**Lines to Verify:**

| Line | Check | Status |
|------|-------|--------|
| 22 | `roleHint` destructured from useAuth | ✅ |
| 35 | Gate: `!roleResolved && !roleHint` | ✅ |
| 38 | Visibility guard: `document.visibilityState === 'hidden'` | ✅ |
| 63 | `navigate(..., { replace: true })` | ✅ |
| 66 | Dependencies include `roleHint` | ✅ |

---

### DesktopNav2025.js
**Lines to Verify:**

| Line | Check | Status |
|------|-------|--------|
| 48 | `useStore` imported for theme | ✅ |
| 59 | `roleHint` destructured from useAuth | ✅ |
| 72 | Early return only if `!currentUser` (not `!roleResolved`) | ✅ |
| 77 | `theme` from store (not document.*) | ✅ |
| 122-134 | Skeleton renders when `!roleResolved` | ✅ |
| 139-197 | Token fetch uses AbortController + mounted guard | ✅ |
| 259 | `theme === 'dark'` instead of document.* | ✅ |
| 274 | Logo uses `role || roleHint` | ✅ |
| 288 | Logo src uses `theme === 'dark'` | ✅ |
| 469 | Command palette uses `theme === 'dark'` | ✅ |

---

## Observability (Production Debugging)

### Sentry Breadcrumbs Added

| Breadcrumb | Location | When | Data |
|------------|----------|------|------|
| `auth_sync_recovered` | AuthContext.jsx:159 | Backend recovers from outage | previousFailureCount |
| `auth_sync_failed` | AuthContext.jsx:248 | Backend sync fails | failureCount, backoffDelay |
| `auth_boot` | AuthContext.jsx:893 | Auth completes | role, roleResolved, device |
| `auth_signed_out` | AuthContext.jsx:763 | User signs out | timestamp |
| `First navigation` | useRouteMonitoring.js:55 | First route after auth | usedRoleHint, role, duration |
| `Slow navigation` | useRouteMonitoring.js:76 | Navigation >2s | from, to, duration |
| `role_resolution_slow` | AuthContext.jsx:831 | Role takes >3s | elapsed, hasProfile |
| `invalid_role` | AuthContext.jsx:860 | Invalid role detected | role, is_creator, is_admin |

### Sentry Tags Set

| Tag | Location | Value | Purpose |
|-----|----------|-------|---------|
| `auth.role` | useRouteMonitoring.js:70 | 'creator'\|'admin'\|'fan'\|'unknown' | Group issues by user role |
| `auth.roleResolved` | useRouteMonitoring.js:71 | 'true'\|'false' | See if issue happened during boot |
| `role` | AuthContext.jsx:900 | Same as auth.role | Legacy compatibility |

### What to Look For in Production

**Fast routing working:**
- First navigation breadcrumb shows `usedRoleHint: true`
- Navigation duration < 100ms
- No "Verifying Access..." spinners in user recordings

**Backend outage resilience:**
- `auth_sync_failed` breadcrumbs during outages
- `auth_sync_recovered` when backend comes back
- Circuit breaker prevents retry storms

**iOS Safari issues:**
- No route changes during `document.visibilityState: 'hidden'`
- Camera permission prompts don't cause navigation
- Modal states survive backgrounding

---

## Common Gotchas to Test

### 1. Switch Accounts Without Tab Close (Creator ↔ Fan)
**Test:**
1. Sign in as creator → confirm lands on `/dashboard`
2. Sign out → sign in as fan → confirm lands on `/explore`
3. Verify no "sticky" roleHint from previous session

**Expected:**
- roleHint updates on new session
- No cached role from previous user

**Code:**
- `AuthContext.jsx:598-603` - roleHint extracted on every session
- `AuthContext.jsx:480-486` - Sign out clears all caches

---

### 2. First Load After New Deploy (Service Worker)
**Test:**
1. Visit `https://digis.cc/?nocache=1` after deploy
2. Hard refresh (Cmd+Shift+R)
3. Normal navigation

**Expected:**
- Service worker updates in background
- No stale routes cached
- App works immediately (no white screen)

**Code:**
- `AuthContext.jsx:446-455` - Cache cleanup on logout
- Service worker config (if enabled) should have `skipWaiting: true`

---

### 3. Very Slow Network (Simulate 3G)
**Test:**
1. Chrome DevTools → Network → Slow 3G
2. Sign in as creator
3. Monitor redirect speed

**Expected:**
- Redirect happens on roleHint (instant)
- Page renders with skeleton
- Backend sync completes in background
- No hard block on slow sync-user call

**Code:**
- `AppRoutes.jsx:147` - roleHint unblocks immediately
- `AuthContext.jsx:642` - sync-user has 6s timeout
- `ProtectedRoute.js:61-68` - 6s timeout before fail-open

---

## Performance Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Time to first redirect | < 100ms | Sentry first navigation breadcrumb |
| roleHint extraction | < 50ms | AuthContext logs "Fast roleHint" |
| Skeleton render | < 300ms | Visual inspection |
| Backend sync (success) | < 2s | sync-user endpoint duration |
| Backend sync (timeout) | 6s max | AuthContext timeout guard |
| Failed auth recovery | 5s → 15s → 60s | Circuit breaker backoff delays |

---

## Success Criteria

✅ **All tests pass** - No auth splash loops, instant redirects, clean back button behavior

✅ **Production metrics** - >95% of users see `usedRoleHint: true` on first navigation

✅ **Error rate** - <1% of sessions hit auth timeout or circuit breaker

✅ **Mobile iOS** - No reports of redirect thrash during camera permission

✅ **Sentry noise** - No spam of `role_resolution_slow` or `auth_sync_failed` (only during actual outages)

---

## Rollback Plan

If issues arise, revert commits in this order:

1. **Observability only** - Keep hardening, remove Sentry breadcrumbs
   - Revert: `useRouteMonitoring.js` changes only

2. **SSR-safe theme** - Keep fast routing, revert theme changes
   - Revert: `DesktopNav2025.js` theme changes only

3. **Full rollback** - Revert all navigation hardening
   - Revert commits: `feat: comprehensive navigation hardening...`

**Emergency hotfix:**
```bash
# Revert to pre-hardening state
git revert HEAD~1
git push origin main
```

---

## Related Files

**Core Routing:**
- `src/contexts/AuthContext.jsx` - roleHint extraction, circuit breaker
- `src/routes/AppRoutes.jsx` - fast redirect with roleHint
- `src/routes/useViewRouter.js` - visibility guard, replace: true
- `src/components/ProtectedRoute.js` - fail-open timeout guards

**Navigation:**
- `src/components/navigation/DesktopNav2025.js` - SSR-safe theme, AbortController
- `src/components/navigation/MobileNav.js` - (not modified yet)

**Observability:**
- `src/hooks/useRouteMonitoring.js` - Sentry breadcrumbs for routing
- `src/lib/sentry.client.js` - Sentry integration

**Utilities:**
- `src/utils/routeHelpers.js` - defaultPathFor() logic
- `src/utils/profileCache.js` - Profile caching for offline resilience

---

## Next Steps (Optional Improvements)

1. **Mobile Nav Parity** - Apply same fixes to `MobileNav.js`
2. **Route Preloading** - Preload lazy routes on hover for instant navigation
3. **Prefetch API** - Use `<link rel="prefetch">` for critical routes
4. **Web Vitals** - Track LCP/FID/CLS for navigation performance
5. **A/B Test** - Measure conversion impact of fast boot routing

---

**Last Updated:** 2025-10-14
**Validated By:** Claude Code
**Production Status:** ✅ Ready for deployment
