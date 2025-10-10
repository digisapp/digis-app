# Profile Persistence Testing Instructions

## The Problem
Service Worker was caching old app versions, causing Miriam's profile to revert to default on refresh.

## The Fix
1. **Disabled Service Worker** - Prevents caching interference
2. **Added AuthGate** - Waits for auth before rendering UI
3. **Improved Profile Cache** - Uses session expiry, loads instantly

## Testing Steps

### 1. CLEAN SLATE TEST

Open browser console (F12) and run:
```javascript
// Clear EVERYTHING
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### 2. SIGN IN AS MIRIAM

After signing in, check console for these logs IN ORDER:

```
✅ Expected logs after sign-in:
1. 🧹 Starting aggressive service worker cleanup...
2. ✅ Service worker cleanup complete - page will reload (if SW was found)
3. 🔐 AuthGate: Bootstrapping auth before render...
4. 🔐 AuthGate: Session loaded { hasSession: true, userEmail: 'miriam@...' }
5. 🔵 saveProfileCache called with: miriam ...
6. 📅 Using session expiry: [date 7 days from now]
7. ✅ Profile cached successfully
8. 🔍 Cache verification - saved to localStorage: true
```

### 3. VERIFY CACHE

In console, run:
```javascript
JSON.parse(localStorage.getItem('digis-profile-cache-v2'))
```

Expected output:
```json
{
  "version": "2.0",
  "timestamp": 1234567890,
  "expiresAt": 1234567890,
  "profile": {
    "username": "miriam",
    "email": "miriam@...",
    "is_creator": true,
    "bio": "Miriam's bio here",
    ...
  }
}
```

### 4. REFRESH PAGE TEST

Press F5 or click refresh button.

```
✅ Expected logs on refresh:
1. 🔐 AuthGate: Bootstrapping auth before render...
2. 📦 Loading cached profile before session check: miriam
3. ✅ Profile loaded from cache: { username: 'miriam', ... expiresIn: 'X hours' }
4. 🔐 AuthGate: Session loaded
5. 🔍 User data from sync: { email: 'miriam@...', is_creator: true, username: 'miriam' }
6. 🔵 saveProfileCache called with: miriam ...
7. ✅ Profile cached successfully
```

### 5. VISUAL VERIFICATION

**✅ SUCCESS:**
- Page shows loading spinner briefly (1-2 seconds)
- Miriam's username appears IMMEDIATELY
- Miriam's bio appears IMMEDIATELY
- Creator dashboard renders (not fan explore page)
- NO flash of "Creator Name" or default values

**❌ FAILURE:**
- You see "Creator Name" even for a moment
- Page shows fan/explore view
- Default bio text appears
- Profile switches from default to Miriam

### 6. HARD REFRESH TEST

Press Ctrl+Shift+R (or Cmd+Shift+R on Mac) for hard refresh.

Should still work - service worker is disabled so no cache interference.

### 7. CLOSE & REOPEN BROWSER TEST

1. Close the browser completely
2. Reopen and go to your app
3. Should still be logged in as Miriam (session persists)
4. Profile should load instantly from cache

## Troubleshooting

### If you still see default values:

1. **Check if Service Worker is gone:**
   ```javascript
   navigator.serviceWorker.getRegistrations().then(r => console.log('SW count:', r.length))
   ```
   Should show 0.

2. **Check if cache exists:**
   ```javascript
   localStorage.getItem('digis-profile-cache-v2')
   ```
   Should NOT be null.

3. **Check if AuthGate is working:**
   Look for "🔐 AuthGate:" logs BEFORE any other app logs.

4. **Force clean everything:**
   ```javascript
   // Unregister all service workers
   navigator.serviceWorker.getRegistrations().then(function(registrations) {
     for(let registration of registrations) {
       registration.unregister()
     }
   })

   // Clear all caches
   caches.keys().then(function(names) {
     for(let name of names) caches.delete(name)
   })

   // Clear storage
   localStorage.clear()
   sessionStorage.clear()

   // Reload
   location.reload()
   ```

## What Should Happen

### First Sign-In:
1. Service worker cleanup runs
2. Page may reload once
3. You sign in
4. Profile is cached
5. You see Miriam's account

### Every Refresh After That:
1. AuthGate bootstraps (loading spinner)
2. Profile loads from cache instantly
3. Session validates in background
4. You see Miriam's account immediately

### Session Expiry:
- Cache expires with Supabase session
- Typically ~7 days
- After expiry, you'll need to sign in again
- Cache is cleared on logout

## Success Criteria

✅ Miriam's username shows immediately on refresh
✅ Miriam's bio shows immediately on refresh
✅ Creator dashboard loads (not fan page)
✅ No "Creator Name" flash
✅ No service worker logs
✅ Cache survives browser close/reopen
✅ Logout clears cache properly

## Report Back

Please share:
1. ✅/❌ Does profile persist on F5 refresh?
2. ✅/❌ Do you see "Creator Name" at any point?
3. ✅/❌ Does hard refresh (Ctrl+Shift+R) work?
4. Console logs from sign-in
5. Console logs from refresh
6. Result of `localStorage.getItem('digis-profile-cache-v2')`
