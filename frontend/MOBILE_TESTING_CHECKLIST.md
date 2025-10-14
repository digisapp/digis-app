# Mobile Homepage Loading - Testing Checklist

Complete verification guide for testing the mobile loading fixes on iPhone.

## Prerequisites

✅ All fixes deployed (commit `240f992`)
✅ Vercel deployment completed successfully

## Phase 1: One-Time Service Worker Reset

### Step 1: Clear Stale Service Worker

**Action:** Open `https://digis.cc/?nocache=1` on iPhone Safari

**Expected Result:**
- Page should reload automatically within 1-2 seconds
- Console should log: `🔄 Running Service Worker hotfix...`
- After reload, URL should change from `?nocache=1` to clean `https://digis.cc/`

**If it doesn't work:**
- Hard refresh: Hold down Shift + tap Reload button
- Clear Safari cache: Settings → Safari → Clear History and Website Data
- Try again with `?nocache=1`

**For PWA Users:**
- If app was added to Home Screen, DELETE the home screen icon
- Open Safari browser directly (not PWA)
- Visit `https://digis.cc/?nocache=1`
- After fix verification, can re-add to Home Screen

---

## Phase 2: Debug HUD Verification

### Step 2: Enable Debug Mode

**Action:** Open `https://digis.cc/?debug=1` on iPhone Safari

**Expected Result:**
- Green/black debug HUD appears in bottom-left corner
- Shows real-time values:
  ```
  Debug HUD
  authLoading: false (green)
  roleResolved: false (for public users)
  role: null
  user: null
  path: /
  view: null
  ```

**Watch for:**
- `authLoading` should turn FALSE within 5 seconds maximum
- If it stays TRUE, the hard timeout failed → see Scenario A below

---

## Decision Tree: What You See

### Scenario A: authLoading stays TRUE for >5s

**Problem:** Hard timeout not firing

**Solution:**
1. Check browser console for errors
2. Verify bootTimeout is being set (check console logs)
3. Look for: `⚠️ Hard auth timeout reached after 5s`

**Fix if missing:**
```javascript
// AuthContext.jsx line 489
const bootTimeout = setTimeout(() => {
  if (mounted) {
    console.warn('⚠️ Hard auth timeout reached after 5s - forcing load complete');
    setAuthLoading(false);
  }
}, 5000);
```

**Emergency workaround:** Add this listener to ensure auth always clears:
```javascript
// AuthContext.jsx - in subscribeToAuthChanges callback
supabase.auth.onAuthStateChange((_event, session) => {
  setUser(session?.user ?? null);
  setAuthLoading(false); // ALWAYS clear loading
});
```

---

### Scenario B: authLoading=false but roleResolved stays FALSE

**Problem:** Role resolution hanging (waiting for backend)

**Why this happens:**
- Backend `/api/auth/sync-user` is slow or failing
- No cached profile available
- Network timeout

**Current behavior:** App shows public homepage (correct!)

**To improve (optional):**
- Use cached profile to set provisional role immediately
- Don't wait for server response to show public page

**Fix:**
```javascript
// AuthContext.jsx - Set cached profile BEFORE fetching
const cachedProfile = loadProfileCache();
if (cachedProfile && mounted) {
  setProfile(cachedProfile);
  setUser(session.user); // Sets roleResolved=true immediately
}
```

---

### Scenario C: roleResolved=true but page flickers/redirects

**Problem:** Navigation loop in useViewRouter

**Check these three guards exist in useViewRouter.js:**

1. ✅ Wait for roleResolved
```javascript
if (!roleResolved) return;
```

2. ✅ Skip navigation at root path
```javascript
const isAtRoot = location.pathname === '/';
if (isAtRoot) {
  lastViewRef.current = currentView;
  return;
}
```

3. ✅ No-op if already at expected path
```javascript
const isAtExpectedPath = location.pathname === expectedPath;
if (isAtExpectedPath) {
  lastViewRef.current = currentView;
  return;
}
```

**Emergency fix:** Temporarily disable useViewRouter navigation:
```javascript
// useViewRouter.js line 57 - comment out:
// navigate(expectedPath, { replace: false });
```

---

## Phase 3: Normal Homepage Test

### Step 3: Test Public Homepage

**Action:** Open `https://digis.cc/` (no query params)

**Expected Result:**
- Homepage loads within 1-2 seconds
- No "Loading..." spinner
- Videos, buttons, and animations work
- Sign In / Sign Up buttons functional

**Verify:**
- [ ] authLoading goes false within 5s
- [ ] HomePage renders (not stuck on splash screen)
- [ ] Navigation buttons clickable
- [ ] No redirect loops
- [ ] Console has no errors

---

## Phase 4: Go Live / Schedule Verification

### Step 4A: Go Live Button (Creators Only)

**For creators** after logging in:

**Action:** Tap floating "Go Live" button in mobile nav

**Expected Result:**
- Opens MobileLiveStream modal (not a route)
- Modal shows stream setup UI
- Agora track creation happens INSIDE modal on user tap
- Tapping "Start Streaming" navigates to `/streaming`

**Verify:**
```javascript
// MobileNav.js
onShowGoLive={() => {
  openModal(MODALS.MOBILE_LIVE_STREAM, { ... });
}}
```

**NOT this:**
```javascript
// ❌ Wrong - don't navigate directly
navigate('/streaming');
```

---

### Step 4B: Schedule Navigation

**Action:** Tap "Schedule" in mobile nav

**Expected Result:**
- Navigates to `/schedule` route
- MobileSchedule component renders
- No modal, just plain route navigation

**Verify:**
```javascript
// Correct implementation
navigate('/schedule');
```

---

## Phase 5: PWA Stability (Optional)

### Step 5: Temporarily Disable PWA

**If problems persist**, disable PWA for testing:

**Edit vite.config.js:**
```javascript
VitePWA({
  injectRegister: false, // Disable auto-registration
  // ... rest of config
})
```

**Or comment out PWA plugin entirely:**
```javascript
// VitePWA({ ... }),
```

**Redeploy and test**. If issues disappear, the PWA was the culprit.

**Production fix:**
```javascript
// vite.config.js - Ensure immediate updates
workbox: {
  clientsClaim: true,
  skipWaiting: true, // Takes effect immediately
}
```

---

## Success Criteria

✅ **All must pass:**

- [ ] `?nocache=1` triggers SW unregistration and reload
- [ ] `?debug=1` shows HUD with `authLoading: false` within 5s
- [ ] Public homepage loads without "Loading..." spinner
- [ ] Sign In / Sign Up buttons work
- [ ] No redirect loops
- [ ] Go Live opens modal (not route)
- [ ] Schedule navigates to route (not modal)

---

## Console Logs to Watch For

**Good signs:**
```
🔄 Running Service Worker hotfix...
🧹 Unregistering 1 service worker(s)...
✅ No session found - showing public homepage
authLoading: false
📄 HomePage: Reset page title and meta tags
```

**Bad signs:**
```
⚠️ Hard auth timeout reached after 5s (if authLoading is still true)
❌ Backend sync failed (should fallback to cache)
📍 Store view changed to: dashboard → navigating to: /dashboard (redirect loop)
```

---

## Emergency Rollback

If all else fails, revert these files:

```bash
git revert 240f992  # Revert comprehensive mobile fixes
git push origin main
```

Then investigate one fix at a time.

---

## Contact Info for Issues

- GitHub Issues: https://github.com/digisapp/digis-app/issues
- Include:
  - iPhone model & iOS version
  - Safari version
  - Debug HUD screenshot (`?debug=1`)
  - Browser console logs
  - Steps to reproduce

---

**Last Updated:** 2025-10-14 (commit `240f992`)
