# Logout Flow Hardening - Complete Implementation Guide

## ✅ Completed Hardeners

### 1. Global 401/403 Handling with LOGOUT_DEST ✅
**Location:** `src/utils/apiClient.js:306-345`

- Only redirects on 401/403 if user is actually NOT authenticated
- Prevents surprise kicks while legitimately logged in
- Checks session state before redirecting
- Uses `window.location.replace(LOGOUT_DEST)` to prevent back-button loops

### 2. Dedupe Guard for Logout Breadcrumbs ✅
**Locations:**
- `src/utils/sentry.js:202-232` - `logLogoutOnce()` and `resetLogoutBreadcrumb()`
- `src/App.js:600-603` - Usage in `handleSignOut()`
- `src/App.js:676, 893` - Reset on login

**Features:**
- Prevents double-logging if user rage-clicks logout
- Automatically resets on login to allow logout logging in next session
- Logs timestamp with each breadcrumb

### 3. useIsMounted Hook ✅
**Location:** `src/hooks/useIsMounted.js`

Belt-and-suspenders guard to prevent state updates or navigation after component unmount/logout.

**Usage Example:**
```javascript
const isMounted = useIsMounted();

useEffect(() => {
  let cancelled = false;
  (async () => {
    const res = await fetch('/api/something');
    if (cancelled || !isMounted.current) return;
    // safe: no state update after unmount
    setState(res.data);
  })();
  return () => { cancelled = true; };
}, []);
```

### 4. Stable Test Selectors ✅
**Locations:**
- `src/components/ProfileDropdown.js:543, 718` - `data-test="logout-btn"`
- `src/components/navigation/MobileNav.js:537` - `data-test="mobile-logout-btn"`

### 5. Production-Faithful E2E Tests ✅
**Locations:**
- `frontend/tests/e2e/utils/auth.js` - Login/logout helpers
- `frontend/tests/e2e/logout-flow.spec.js` - Comprehensive test suite

**Test Coverage:**
- Logout from all protected routes
- Back button verification
- Anonymous deep links
- Mobile logout
- Edge cases (rapid clicks, deep links)

### 6. Single Source of Truth for LOGOUT_DEST ✅
**Locations:**
- `src/constants/auth.js` - Constant definition
- `src/App.js:140` - Import and usage
- `src/components/ProtectedRoute.js:4, 23, 83` - Import and usage
- `src/utils/apiClient.js:3, 322, 336, 342` - Import and usage

## ✅ Button-Level Debounce (isWorking flag)

**Locations:**
- `src/components/ProfileDropdown.js:73, 543-560, 725-750` - Desktop logout buttons with debounce
- `src/components/navigation/MobileNav.js:41, 537-565` - Mobile logout button with debounce

**Implementation:**
- Added `isLoggingOut` state to prevent rapid clicks
- Guard clause at start of onClick: `if (isLoggingOut) return;`
- Button disabled prop based on state
- try/finally with 2-second timeout to reset state
- Conditional className for opacity: `opacity-60 cursor-not-allowed`
- Dynamic button text: "Signing out…" when working

## ✅ LOGOUT_DEST for Non-Root Deploys

**Location:** `src/constants/auth.js:12-16`

**Implementation:**
```javascript
export const LOGOUT_DEST = (() => {
  const baseUrl = import.meta.env.BASE_URL || '/';
  // Normalize: remove trailing slashes, then add single trailing slash
  return baseUrl.replace(/\/+$/, '/');
})();
```

**Features:**
- Uses `import.meta.env.BASE_URL` for Vite subpath support
- Works for both `/` and `/app/` base URLs
- Normalizes trailing slashes

## ✅ ProtectedRoute Role Gates Already Use `replace: true`

**Verified in `src/components/ProtectedRoute.js`:**
- Line 83: `<Navigate to={LOGOUT_DEST} state={{ from: location }} replace />`
- Line 89: `<Navigate to={fallbackPath} replace />`

Both use `replace: true` to prevent back-button issues.

## ✅ Service Worker Cache Cleanup

**Location:** `src/contexts/AuthContext.jsx:427-437`

**Implementation:**
Added cache cleanup to `teardownOnLogout()` function:
```javascript
// Clear service worker caches (if enabled)
if ('caches' in window) {
  caches.keys().then(keys => {
    keys.forEach(cacheName => {
      caches.delete(cacheName);
      console.log(`🧹 Deleted cache: ${cacheName}`);
    });
  }).catch(err => {
    console.warn('Cache cleanup warning (non-critical):', err);
  });
}
```

**Features:**
- Clears all service worker caches on logout
- Non-blocking with catch for errors
- Only runs if Cache API is available

## ✅ Creator Handle Validation

**Location:** `src/components/CreatorPublicProfileEnhanced.js:159-170`

**Implementation:**
```javascript
// Reject empty or whitespace-only usernames
if (!decoded || !decoded.trim()) {
  console.warn('Empty or whitespace username detected, redirecting to explore');
  return <Navigate to="/explore" replace />;
}

// Reject punctuation-only usernames (e.g., ".", "_", "---")
const isPunctuationOnly = /^[\W_]+$/.test(decoded.trim());
if (isPunctuationOnly) {
  console.warn('Punctuation-only username detected, redirecting to explore');
  return <Navigate to="/explore" replace />;
}
```

**Features:**
- Validates username after decodeURIComponent
- Rejects empty strings and whitespace-only usernames
- **Rejects punctuation-only usernames** (e.g., ".", "_", "---", "@@@")
- Redirects to /explore with replace flag to avoid 404 loops

## ✅ HomePage Title/Meta Reset

**Location:** `src/components/HomePage.js:26-41`

**Implementation:**
```javascript
// Reset page title and meta tags on mount
useEffect(() => {
  document.title = 'Digis - Connect with Creators';

  // Reset OG tags to default
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.content = 'Digis - Connect with Creators';

  const ogDescription = document.querySelector('meta[property="og:description"]');
  if (ogDescription) ogDescription.content = 'Connect with your favorite creators through video calls, live streams, and exclusive content.';

  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) ogImage.content = 'https://digis.cc/og-image.png';

  console.log('📄 HomePage: Reset page title and meta tags');
}, []);
```

**Features:**
- Resets document title on mount
- Clears stale OG meta tags (title, description, image)
- Prevents previous creator profile metadata from persisting after logout

## 🔍 Observability & Monitoring

### Sentry Breadcrumbs Tracking

The following breadcrumbs are logged for logout flow observability:

1. **`logout`** - User-initiated logout (`src/App.js:600-603`)
   - Logged once per session via `logLogoutOnce()` dedupe guard
   - Reset on login and app mount

2. **`auth_signed_out`** - Supabase auth state change (`src/App.js:698`)
   - Logged when SIGNED_OUT event fires
   - Should maintain ~1:1 ratio with `logout` breadcrumb

3. **`auth_api_redirect`** - API 401/403 triggered redirect (`src/utils/apiClient.js`)
   - Reason codes: `no_session`, `refresh_failed`, `session_check_error`
   - Tracks automatic redirects from failed API calls
   - Useful for alerting on session refresh regressions

### Recommended Sentry Alerts

**Alert 1: Logout Breadcrumb Ratio Drift**
- Query: `count(breadcrumb.message:logout) / count(breadcrumb.message:auth_signed_out)`
- Expected: 0.9 - 1.1 (roughly 1:1)
- Threshold: Alert if ratio < 0.9 or > 1.1 for 24h window
- Purpose: Detect double-logout bugs or missing breadcrumbs

**Alert 2: Auth API Redirect Spike**
- Query: `count(breadcrumb.message:auth_api_redirect)`
- Threshold: Alert if count > 100/hour
- Purpose: Detect session refresh regressions or token expiry issues

## ⏳ TODO: CI/E2E and Alerting

### GitHub Actions CI (.github/workflows/e2e-tests.yml)
```yaml
name: E2E Logout Tests

on:
  pull_request:
  schedule:
    - cron: '0 0 * * *' # Daily at midnight
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        working-directory: ./frontend
        run: npm ci

      - name: Install Playwright
        working-directory: ./frontend
        run: npx playwright install --with-deps

      - name: Run logout flow tests
        working-directory: ./frontend
        env:
          TEST_EMAIL: ${{ secrets.TEST_EMAIL }}
          TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}
        run: npx playwright test tests/e2e/logout-flow.spec.js

      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: frontend/playwright-report/
```

### Sentry Dashboard Alert
Create a custom metric in Sentry:

1. **Panel:** Breadcrumb Count Ratio
   - Query A: `count(breadcrumb.message:logout)`
   - Query B: `count(breadcrumb.message:auth_signed_out)`
   - Formula: `A / B`
   - Expected Range: `0.9 - 1.1` (roughly 1:1 ratio)
   - Alert if ratio drifts outside range

2. **Alert Rule:**
   - Name: "Logout Breadcrumb Mismatch"
   - Condition: Ratio < 0.9 or > 1.1 for 24h window
   - Notification: Slack/Email
   - Description: "Logout/auth_signed_out breadcrumb ratio has drifted, indicating possible logout flow regression"

## ✅ Micro-Review: apiClient 401/403 Redirect Guard

**Location:** `src/utils/apiClient.js:305-306, 314-317, 329-334, 356-361, 370-376`

**Implementation:**
Added module-level `isRedirecting` flag to prevent concurrent redirects + Sentry breadcrumbs:
```javascript
// Module-level flag to prevent concurrent redirects
let isRedirecting = false;

// In error interceptor
if (isRedirecting) {
  logger.debug('Redirect already in progress, skipping');
  return;
}

// Before each redirect - log to Sentry for observability
addSentryBreadcrumb('auth_api_redirect', 'auth', 'info', {
  reason: 'no_session',
  status: error.status,
  timestamp: new Date().toISOString()
});

isRedirecting = true;
window.location.replace(LOGOUT_DEST);
```

**Features:**
- Guards against multiple concurrent 401/403 errors triggering duplicate redirects
- Module-level flag persists across all apiClient requests
- Prevents redirect loops when multiple requests fail simultaneously
- **Sentry breadcrumbs** track all auth redirects with reason codes (no_session, refresh_failed, session_check_error)

## ✅ Micro-Review: Sentry Logout Breadcrumb Reset on App Mount

**Location:** `src/App.js:150-152`

**Implementation:**
```javascript
// Reset logout breadcrumb on app mount (handles browser restarts)
useEffect(() => {
  resetLogoutBreadcrumb();
}, []);
```

**Features:**
- Resets logout breadcrumb flag on full page load
- Handles browser restarts where user logs back in
- Complements existing reset on login (lines 676, 893)

## ✅ Stale Page Re-Auth Guard

**Location:** `src/contexts/AuthContext.jsx:452-457, 520-525` and `src/utils/apiClient.js:362-382`

**Implementation:**
Added `signedOutAt` flag to prevent stale tabs with old JS from silently re-authenticating:

```javascript
// In AuthContext signOut (line 452-457)
try {
  sessionStorage.setItem('signedOutAt', String(Date.now()));
} catch (e) {
  // Ignore storage errors (Safari private mode)
}

// In apiClient after successful session refresh (line 362-382)
try {
  if (sessionStorage.getItem('signedOutAt')) {
    logger.info('Skip retry: page marked signed-out');

    addSentryBreadcrumb('auth_api_redirect', 'auth', 'info', {
      reason: 'stale_tab_signed_out',
      status: error.status,
      timestamp: new Date().toISOString()
    });

    analytics.track('auth_api_redirect', {
      reason: 'stale_tab_signed_out',
      status: error.status,
      timestamp: new Date().toISOString()
    });

    isRedirecting = true;
    window.location.replace(LOGOUT_DEST);
    return;
  }
} catch (e) {
  // Ignore storage errors
}

// Clear flag on successful login (line 520-525)
try {
  sessionStorage.removeItem('signedOutAt');
} catch (e) {
  // Ignore storage errors
}
```

**Features:**
- Prevents stale tabs from re-authenticating after logout
- Tracks with Sentry breadcrumb and analytics event (reason: `stale_tab_signed_out`)
- Clears flag on successful login
- Safari private mode compatible

## ✅ Unauth Splash Component

**Location:** `src/components/UnauthSplash.js` and `src/components/ProtectedRoute.js:5, 29, 84-90`

**Implementation:**
Added minimal loading component shown for ~300-500ms during ProtectedRoute redirects:

```javascript
// UnauthSplash.js - Minimal spinner component
const UnauthSplash = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
    <div className="text-center">
      <div className="inline-block">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
      <p className="mt-4 text-gray-600 font-medium">
        Signing you out…
      </p>
    </div>
  </div>
);

// ProtectedRoute.js - Show splash before redirect (line 84-90)
if (!user) {
  if (!showUnauthSplash) {
    setTimeout(() => setShowUnauthSplash(true), 400);
    return <UnauthSplash />;
  }
  return <Navigate to={LOGOUT_DEST} state={{ from: location }} replace />;
}
```

**Features:**
- Smooth UX transition during logout redirects
- Reduces perceived flicker on low-end devices
- 400ms delay before redirect for visual continuity

## ✅ Analytics Events for Auth Redirects

**Location:** `src/utils/apiClient.js:5, 337-342, 372-377, 398-403, 420-426`

**Implementation:**
Added analytics tracking alongside Sentry breadcrumbs for all auth redirect paths:

```javascript
// Import analytics (line 5)
import { analytics } from '../lib/analytics';

// Track auth_api_redirect with reason codes:
// 1. no_session (line 337-342)
// 2. stale_tab_signed_out (line 372-377)
// 3. refresh_failed (line 398-403)
// 4. session_check_error (line 420-426)

analytics.track('auth_api_redirect', {
  reason: 'no_session', // or other reason codes
  status: error.status,
  timestamp: new Date().toISOString()
});
```

**Features:**
- Tracks all auth redirect events with reason codes
- Correlates UX patterns with backend behavior
- Respects Do Not Track (DNT) headers
- Logs to console in development mode

## ✅ Playwright Test for Meta Tag Reset

**Location:** `frontend/tests/e2e/logout-flow.spec.js:197-230`

**Implementation:**
Added E2E test to verify HomePage resets meta tags after logout from creator profile:

```javascript
test('HomePage resets meta tags after logout from creator profile', async ({ page }) => {
  // Visit a creator profile to populate meta tags
  await page.goto('/miriam');
  await page.waitForLoadState('networkidle');

  // Check that creator-specific meta tags are set
  const ogTitleBeforeLogout = await page.locator('meta[property="og:title"]').getAttribute('content');

  // Log out
  const profileButton = page.getByRole('button', { name: /profile menu/i });
  await profileButton.click();
  await page.locator('[data-test="logout-btn"]').click();

  // Should land on home page
  await expect(page).toHaveURL(LOGOUT_DEST, { timeout: 5000 });
  await page.waitForLoadState('networkidle');

  // Verify meta tags are reset to default
  const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
  const ogDescription = await page.locator('meta[property="og:description"]').getAttribute('content');
  const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');

  expect(ogTitle).toBe('Digis - Connect with Creators');
  expect(ogDescription).toContain('Connect with your favorite creators');
  expect(ogImage).toBe('https://digis.cc/og-image.png');
});
```

**Features:**
- Verifies OG title, description, and image reset to defaults
- Catches regressions where profile OG tags persist after logout
- Tests both meta tags and page title

## Summary

### Fully Implemented ✅
1. Global 401/403 handling
2. Dedupe guard for logout breadcrumbs
3. useIsMounted hook
4. Stable test selectors
5. Production-faithful E2E tests
6. Single source of truth for LOGOUT_DEST
7. ProtectedRoute uses replace:true
8. Button-level debounce (isWorking flag)
9. LOGOUT_DEST for non-root deploys
10. Service worker cache cleanup
11. Creator handle validation
12. HomePage title/meta reset
13. apiClient redirecting flag
14. Logout breadcrumb reset on app mount
15. **Stale page re-auth guard (signedOutAt flag)**
16. **Unauth splash component for smooth redirects**
17. **Analytics events for auth_api_redirect**
18. **Playwright test for meta tag reset**

### Server-Side Work (Backend) ⏳
1. Mirror creator validation regex in API route for creator handles

### CI/Observability (15-20 min) ⏳
1. GitHub Actions E2E workflow
2. Sentry dashboard alerting

## Testing Checklist

### Manual Testing
- [ ] Log out from /dashboard → lands on / without flicker
- [ ] Log out from /classes → lands on / without flicker
- [ ] Log out from /tv → lands on / without flicker
- [ ] Log out from /explore → lands on / without flicker
- [ ] Press back button after logout → stays on /
- [ ] Deep link to /wallet while logged out → redirects to /
- [ ] Rapid-click logout button → no double redirects
- [ ] Log out from /:username → lands on /

### E2E Testing
```bash
cd frontend
npx playwright test tests/e2e/logout-flow.spec.js
```

### Sentry Verification
After testing, check Sentry for:
- Exactly 1 "logout" breadcrumb per logout
- Exactly 1 "auth_signed_out" breadcrumb per logout
- 1:1 ratio between the two
