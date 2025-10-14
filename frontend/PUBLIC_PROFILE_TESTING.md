# Public Profile Testing Checklist

## Overview
This document outlines testing procedures for the public creator profile "soft auth" pattern.
Ensures logged-in users can interact on public profiles without being redirected to sign-up.

---

## Quick Test Matrix (5 Minutes)

### Test 1: Guest User on Public Profile
**URL:** `https://digis.cc/miriam` (or any creator username)

**Steps:**
1. Open in incognito/private browsing
2. Page should load instantly (no auth spinner)
3. Click "Follow" button

**Expected:**
- ✅ Auth modal opens
- ✅ Page stays on /miriam (no redirect)
- ✅ Modal shows intent: "Sign up to follow Miriam"

**If Fails:**
- Check: Is `/creator/:username` or `/:username` wrapped in ProtectedRoute?
- Check: Does button call `requireAuthOr` or `handleInteraction`?

---

### Test 2: Logged-In Fan Clicks Follow
**URL:** `https://digis.cc/miriam`

**Pre-condition:** Signed in as a fan (not creator)

**Steps:**
1. Visit profile page
2. Click "Follow" button
3. Check network tab for API call

**Expected:**
- ✅ API call to `/api/follows` with `Authorization: Bearer {token}`
- ✅ Response 200/201 (success)
- ✅ Follow button changes to "Following" or shows checkmark
- ✅ No redirect to sign-up

**If Fails:**
- Check: `handleInteraction` uses `await getSession()` not `if (!user)`
- Check: API call includes Authorization header
- Check: Backend route doesn't 302 redirect to /signup

---

### Test 3: Logged-In Creator Clicks Message/Tip
**URL:** `https://digis.cc/miriam`

**Pre-condition:** Signed in as a different creator

**Steps:**
1. Visit another creator's profile
2. Click "Message" button
3. Check if message composer opens

**Expected:**
- ✅ Message composer modal opens
- ✅ Can send message
- ✅ No auth wall or redirect

**Alternative:** Click "Tip" button
- ✅ Tip modal opens
- ✅ Shows token balance
- ✅ Can complete tip flow

---

### Test 4: Profile Loads Slow (Fail-Open Scenario)
**URL:** `https://digis.cc/miriam`

**Pre-condition:**
- Signed in
- Simulate slow network (Chrome DevTools → Network → Slow 3G)
- OR: Backend is temporarily down

**Steps:**
1. Hard refresh page (Cmd+Shift+R)
2. Profile may load slowly or show skeleton
3. Click "Follow" before profile fully loads

**Expected:**
- ✅ Button works immediately (checks session, not profile)
- ✅ API call succeeds even if profile is still loading
- ✅ No "Sign up" redirect

**Key Point:** Session-based auth prevents false negatives when profile is temporarily null.

---

### Test 5: Expired Token Auto-Refresh
**URL:** `https://digis.cc/miriam`

**Pre-condition:** Token is about to expire (test after 50+ minutes of inactivity)

**Steps:**
1. Visit profile after long idle period
2. Click "Follow" or other interactive action
3. Watch network tab

**Expected:**
- ✅ First request: 401 Unauthorized
- ✅ Second request: Token refresh call to Supabase
- ✅ Third request: Retry with new token → 200/201 success
- ✅ User sees success (no error toast)

**Logs to Check:**
```
🔄 Token expired, refreshing...
✅ Token refreshed, retrying request
```

---

### Test 6: Reserved Username Protection
**URL:** `https://digis.cc/explore` or `https://digis.cc/dashboard`

**Steps:**
1. Try to visit these URLs
2. Should route to actual app pages, not treat as usernames

**Expected:**
- ✅ `/explore` → Explore page (not "User 'explore' not found")
- ✅ `/dashboard` → Dashboard page
- ✅ `/admin` → Admin page (if admin) or redirect
- ✅ No 404 or "Creator not found" error

**Reserved List Check:**
```javascript
const RESERVED = [
  'explore', 'dashboard', 'admin', 'settings', 'wallet',
  'messages', 'stream', 'login', 'signup', 'api', 'terms'
  // ... see reservedUsernames.js for full list
];
```

---

### Test 7: Intent Resumption After Auth
**URL:** `https://digis.cc/miriam`

**Pre-condition:** Signed out

**Steps:**
1. Click "Follow" button
2. Complete sign-up flow
3. After successful auth, should auto-follow

**Expected:**
- ✅ Auth modal opens with intent tracked
- ✅ After sign-up, auto-executes "Follow" action
- ✅ Toast: "Following Miriam!"
- ✅ Button changes to "Following"

**Implementation Check:**
```javascript
// In auth success handler:
await resumePendingIntent({
  follow: async (intent) => await followCreator(intent.target),
  tip: async (intent) => openTipModal(intent.target)
});
```

---

### Test 8: Multiple Interactions (Session Persistence)
**URL:** `https://digis.cc/miriam`

**Pre-condition:** Signed in

**Steps:**
1. Click "Follow" → success
2. Click "Tip" → modal opens
3. Click "Message" → composer opens
4. Click "Subscribe" → subscription flow starts

**Expected:**
- ✅ All actions work without re-authentication
- ✅ No repeated auth modals
- ✅ Session persists across all interactions

---

## Edge Cases to Test

### EC1: Account Switching (Creator ↔ Fan)
**Steps:**
1. Sign in as creator A
2. Visit creator B's profile (`/creatorB`)
3. Follow creator B → success
4. Sign out
5. Sign in as fan C
6. Visit creator B's profile again
7. Should show correct "Following" state for fan C

**Expected:**
- ✅ Following state updates correctly per user
- ✅ No stale session data from previous user

---

### EC2: CORS / Cross-Origin Requests
**If backend is on different domain** (e.g., `backend.digis.cc` vs `digis.cc`):

**Check Network Tab:**
- ✅ API responses include `Access-Control-Allow-Origin: https://digis.cc`
- ✅ Preflight OPTIONS requests succeed
- ✅ Authorization header is allowed: `Access-Control-Allow-Headers: Authorization`

**If using cookies:**
- ✅ Backend sends `Access-Control-Allow-Credentials: true`
- ✅ Frontend uses `credentials: 'include'`

---

### EC3: Back Button After Auth
**Steps:**
1. Guest visits `/miriam`
2. Clicks Follow → auth modal opens
3. Cancels auth modal
4. Presses back button

**Expected:**
- ✅ Goes to previous page (not /signup)
- ✅ No auth modal reopens
- ✅ No redirect loop

---

### EC4: Deep Link with Intent
**URL:** `https://digis.cc/miriam?intent=follow`

**Steps:**
1. Share link to friend (signed out)
2. Friend clicks link
3. Sees profile + auth prompt: "Sign up to follow Miriam"
4. Signs up
5. Auto-follows Miriam

**Expected:**
- ✅ Intent preserved in URL query param or sessionStorage
- ✅ After auth, intent executes automatically
- ✅ User sees confirmation toast

---

## Performance Benchmarks

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Page Load (Guest) | <1.5s | Chrome DevTools → Performance tab |
| Auth Check (Session) | <50ms | Console log: `getSession()` duration |
| Follow API Call | <500ms | Network tab → Timing |
| Token Refresh | <1s | 401 → Refresh → Retry chain |
| Intent Resumption | <100ms | Time from auth complete to action execute |

---

## Debugging Checklist

### Issue: Logged-in user gets "Sign up" modal

**Check:**
1. Is `handleInteraction` checking `user` prop or `getSession()`?
   - ✅ Should check session
   - ❌ Don't check profile/user (can be null)

2. Is `/:username` route passing `user={currentUser}`?
   - ✅ Should pass currentUser
   - ❌ Don't omit user prop

3. Is session actually valid?
   ```javascript
   const session = await supabase.auth.getSession();
   console.log('Session:', session?.data?.session);
   ```

4. Are there console errors during auth check?
   - Look for: "Session check failed" or "Error getting session"

---

### Issue: 401 Unauthorized on API calls

**Check:**
1. Is Authorization header present?
   ```javascript
   // Network tab → Request Headers
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

2. Is token expired? Check JWT payload:
   ```javascript
   const token = session.access_token;
   const payload = JSON.parse(atob(token.split('.')[1]));
   console.log('Token expires:', new Date(payload.exp * 1000));
   ```

3. Does backend accept the token?
   - Check backend logs for "Invalid token" or "Token verification failed"

4. Is CORS blocking the request?
   - Look for: "CORS policy: No 'Access-Control-Allow-Origin' header"

---

### Issue: Follow button doesn't change state after success

**Check:**
1. Is API call actually succeeding?
   ```javascript
   // Network tab → Response
   { "ok": true, "isFollowing": true }
   ```

2. Is local state updating?
   ```javascript
   setIsFollowing(true); // In success handler
   ```

3. Is component re-rendering?
   - Check React DevTools → Components → isFollowing state

---

### Issue: Intent doesn't resume after auth

**Check:**
1. Is intent being saved to sessionStorage?
   ```javascript
   // After clicking Follow (before auth modal)
   sessionStorage.getItem('postAuthIntent')
   // Should return: {"action":"follow","target":"miriam","timestamp":...}
   ```

2. Is `resumePendingIntent` called after auth?
   ```javascript
   // In auth success handler
   await resumePendingIntent({ follow: handleFollow });
   ```

3. Is intent handler registered?
   ```javascript
   // Make sure 'follow' key matches intent.action
   resumePendingIntent({
     follow: async (intent) => { ... },  // ✅ Correct
     followUser: async (intent) => { ... } // ❌ Wrong key
   });
   ```

---

## Backend Verification (Optional)

### Endpoint: GET /api/public/profile/:username

**Test with curl:**
```bash
# Signed out (no token)
curl https://backend.digis.cc/api/public/profile/miriam

# Expected: 200 OK with public fields only
{
  "profile": {
    "username": "miriam",
    "displayName": "Miriam",
    "avatar": "...",
    "followerCount": 1234
  },
  "capabilities": {
    "canFollow": false,
    "canMessage": false,
    "canTip": false
  }
}

# Signed in (with token)
curl -H "Authorization: Bearer eyJhbGciOiJ..." \
  https://backend.digis.cc/api/public/profile/miriam

# Expected: 200 OK with enriched fields
{
  "profile": { ... },
  "capabilities": {
    "canFollow": true,
    "canMessage": true,
    "canTip": true
  },
  "relationship": {
    "isFollowing": false,
    "isSubscribed": false
  }
}
```

### Endpoint: POST /api/follows

**Test with curl:**
```bash
# No token → 401
curl -X POST https://backend.digis.cc/api/follows \
  -H "Content-Type: application/json" \
  -d '{"creatorUsername":"miriam"}'

# Expected: 401 Unauthorized (JSON, not HTML redirect)
{ "error": "Unauthorized" }

# With token → 201 Created
curl -X POST https://backend.digis.cc/api/follows \
  -H "Authorization: Bearer eyJhbGciOiJ..." \
  -H "Content-Type: application/json" \
  -d '{"creatorUsername":"miriam"}'

# Expected: 201 Created
{ "ok": true, "isFollowing": true }
```

---

## Success Criteria

✅ **All 8 primary tests pass**
✅ **No false auth walls for logged-in users**
✅ **Intent resumption works after sign-up**
✅ **Reserved usernames don't cause 404s**
✅ **Token refresh handles expired sessions gracefully**
✅ **CORS configured correctly (if cross-origin)**
✅ **Performance targets met (<1.5s page load, <50ms auth check)**

---

## Rollback Plan

If issues arise in production:

### Quick Fix: Disable Intent Resumption
```javascript
// In auth success handler, comment out:
// await resumePendingIntent({ ... });
```

### Full Rollback: Revert to Profile-Based Auth
```bash
git revert ba0e702  # Revert "fix: logged-in users can now interact"
git push origin main
```

This reverts to checking `user` prop instead of session (may cause false auth walls but safer).

---

## Monitoring (Production)

### Sentry Alerts to Watch

1. **"Auth wall shown" breadcrumb spike**
   - Normal: ~10-20% of profile visits
   - Alert if: >50% of visits show auth wall
   - Indicates: Session check failing for logged-in users

2. **"Token refresh failed" errors**
   - Normal: <1% of API calls
   - Alert if: >5% of calls fail
   - Indicates: Supabase auth service issue

3. **401 errors on /api/follows, /api/tips**
   - Normal: Should retry once and succeed
   - Alert if: >10% of requests end in 401 after retry
   - Indicates: Token refresh not working

### Analytics to Track

- **Conversion Rate:** Sign-ups after auth wall
- **Follow Rate:** Follows completed after auth
- **Bounce Rate:** Users leaving after auth wall

---

**Last Updated:** 2025-10-14
**Tested By:** Claude Code
**Status:** ✅ Ready for QA
