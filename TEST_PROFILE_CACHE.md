# Profile Cache Testing Guide

## Step 1: Clear Everything First
1. Open browser console (F12)
2. Run this in console to clear all cache:
   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   location.reload();
   ```

## Step 2: Sign In as Miriam
1. Sign in with Miriam's credentials
2. Look for these console logs:
   ```
   ✅ Profile cached: { username: 'miriam', email: '...', is_creator: true, expiresIn: '7 days' }
   ```

## Step 3: Check localStorage
In browser console, run:
```javascript
JSON.parse(localStorage.getItem('digis-profile-cache'))
```

You should see:
```json
{
  "version": "1.0",
  "timestamp": 1234567890,
  "expiresAt": 1234567890,
  "profile": {
    "username": "miriam",
    "email": "miriam@example.com",
    "is_creator": true,
    ...
  }
}
```

## Step 4: Refresh the Page
1. Press F5 or click refresh
2. Look for this log IMMEDIATELY (should be first thing):
   ```
   📦 Loading cached profile before session check: miriam
   ```

## Step 5: Debug If Not Working

If you DON'T see "📦 Loading cached profile", check:

1. **Is the cache being saved?**
   ```javascript
   localStorage.getItem('digis-profile-cache')
   ```
   If null → cache not saving

2. **Check what's in localStorage:**
   ```javascript
   Object.keys(localStorage)
   ```

3. **Check Zustand store:**
   ```javascript
   localStorage.getItem('hybrid-store')
   ```

## What You Should See When Working:

### On Sign In:
```
🔍 User data from sync: { email: 'miriam@...', is_creator: true, username: 'miriam' }
✅ Profile cached: { username: 'miriam', ... }
```

### On Refresh:
```
📦 Loading cached profile before session check: miriam
🔍 User data from sync: { email: 'miriam@...', is_creator: true, username: 'miriam' }
✅ Profile cached: { username: 'miriam', ... }
```

## Common Issues:

1. **Cache not saving** - Check for errors in console when signing in
2. **Cache not loading** - Check if App.js has the loadProfileCache() at the top of initAuth
3. **Cache loading but profile still shows default** - Check if HybridCreatorDashboard is using the cached profile from the store

## What to Report Back:

Please share:
1. What you see in console when signing in
2. What you see in console when refreshing
3. Result of: `localStorage.getItem('digis-profile-cache')`
4. Whether "Creator Name" or "miriam" shows up after refresh
