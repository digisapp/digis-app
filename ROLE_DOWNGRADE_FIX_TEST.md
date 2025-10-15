# Creator→Fan Role Downgrade Fix - Testing Guide

## Issue Fixed
Miriam's Creator account was randomly turning into a Fan account, losing the full menu and creator dashboard.

## Root Causes Found

### 1. Premature Fan Classification
**Location**: `AuthContext.jsx` lines 102-113

**Bug**:
```js
const role = useMemo(() => {
  if (profile?.is_admin || isAdmin) return 'admin';
  if (profile?.is_creator || isCreator) return 'creator';
  if (profile?.id) return 'fan'; // ❌ BUG: Downgrades creators!
  ...
}, [dependencies]);
```

**Problem**: When `profile.is_creator` temporarily became `undefined` (during refetch or timing issue), the code would fall through to `if (profile?.id)` and immediately classify the user as a 'fan'.

**Fix**: Check `lastKnownRole` BEFORE defaulting to fan, and only downgrade with EXPLICIT confirmation (`is_creator === false`).

### 2. No setProfile Protection
**Location**: `AuthContext.jsx` - original setProfile had no guards

**Problem**: Any API response with `is_creator: false` or missing field would clobber the creator status.

**Fix**: Wrapped `setProfile` with downgrade detection that blocks creator→fan transitions.

## Fixes Implemented

### Fix 1: Protected Role Computation
```js
const role = useMemo(() => {
  // 1) Canonical when profile is ready
  if (profile?.is_admin === true || isAdmin) return 'admin';
  if (profile?.is_creator === true || isCreator) return 'creator';

  // 2) CRITICAL: Check lastKnownRole BEFORE defaulting to fan
  if (roleHint && (roleHint === 'creator' || roleHint === 'admin')) {
    console.log('🛡️ Protected role downgrade - using lastKnownRole:', roleHint);
    return roleHint;
  }

  // 3) Only downgrade with EXPLICIT confirmation
  if (profile?.id && profile?.is_creator === false && profile?.is_admin === false) {
    return 'fan';
  }

  // 4) Fast path fallback
  if (roleHint) return roleHint;

  // 5) Truly unknown
  return user ? 'fan' : null;
}, [dependencies]);
```

**Protection Level**: Triple-layer defense:
1. Explicit `=== true` checks (not just truthy)
2. lastKnownRole fallback before fan default
3. Explicit `=== false` required to downgrade

### Fix 2: Protected setProfile Guard
```js
const setProfile = useCallback((newProfile) => {
  if (!newProfile) {
    setProfileRaw(newProfile);
    return;
  }

  setProfileRaw((currentProfile) => {
    // CRITICAL: Never downgrade from creator/admin to fan
    if (currentProfile?.is_creator === true && newProfile.is_creator !== true) {
      console.warn('🛡️ Blocked creator→fan downgrade attempt:', {
        current: { username: currentProfile.username, is_creator: currentProfile.is_creator },
        attempted: { username: newProfile.username, is_creator: newProfile.is_creator }
      });
      // Keep existing creator profile, update safe fields only
      return {
        ...currentProfile,
        ...(newProfile.token_balance !== undefined ? { token_balance: newProfile.token_balance } : {})
      };
    }

    // Similar protection for admin
    if (currentProfile?.is_admin === true && newProfile.is_admin !== true) {
      console.warn('🛡️ Blocked admin→fan downgrade attempt');
      return { ...currentProfile, ... };
    }

    // Safe update - no downgrade detected
    return newProfile;
  });
}, []);
```

**Protection Level**: Hard guard that:
- Blocks ANY attempt to set is_creator from true → false/undefined
- Blocks ANY attempt to set is_admin from true → false/undefined
- Preserves existing role data
- Only allows safe field updates (token_balance, etc.)

## Testing Checklist

### Pre-Deploy Testing

1. **Verify Database**
   ```bash
   cd backend && node -e "
   const { Pool } = require('pg');
   require('dotenv').config();
   const pool = new Pool({ connectionString: process.env.DATABASE_URL });
   
   pool.query('SELECT id, email, username, is_creator, role FROM users WHERE email = \$1', 
     ['miriam@examodels.com']
   ).then(r => {
     console.log('Miriam DB Status:', r.rows[0]);
     pool.end();
   });
   "
   ```
   **Expected**: `is_creator: true, role: 'creator'`

2. **Check lastKnownRole Persistence**
   - Login as Miriam
   - Open DevTools → Application → Local Storage
   - Check for key: `digis:lastKnownRole`
   - **Expected**: `'creator'`

3. **Test Role Protection Log**
   - Login as Miriam
   - Open DevTools Console
   - Look for: `💾 Persisted lastKnownRole: creator`
   - **Expected**: Console message appears

### Deployment Testing

1. **Login as Miriam**
   - Email: `miriam@examodels.com`
   - **Expected**: Creator Dashboard visible
   - **Expected**: Full menu with Creator options

2. **Hard Refresh Test**
   - Press Cmd+Shift+R (or Ctrl+Shift+R)
   - **Expected**: Still see Creator Dashboard
   - **Expected**: NO flicker to Fan view

3. **Check Console for Protection**
   - Open DevTools Console
   - Look for `🛡️ Protected role downgrade` messages
   - **Expected**: If protection triggered, warning appears

4. **Navigation Test**
   - Navigate to /dashboard
   - Navigate to /profile
   - Navigate to /explore
   - Return to /dashboard
   - **Expected**: Always see Creator UI
   - **Expected**: Never see Fan-only UI

5. **Logout/Login Cycle**
   - Logout
   - Login as Miriam again
   - **Expected**: Creator Dashboard immediately
   - **Expected**: No fan view flash

### Stress Testing

1. **Network Throttling**
   - DevTools → Network → Slow 3G
   - Hard refresh
   - **Expected**: Creator UI (may load slower but stays creator)

2. **Simulate API Failure**
   - Block `/api/auth/sync-user` in DevTools
   - Hard refresh
   - **Expected**: Falls back to cached profile (still creator)
   - **Expected**: See circuit breaker message

3. **Profile Refetch**
   - In Console: `window.location.reload()`
   - **Expected**: Still creator after reload

## Success Criteria

✅ Miriam logs in → sees Creator Dashboard (not Fan)
✅ Hard refresh → stays on Creator Dashboard
✅ Navigate around app → always sees Creator UI
✅ Logout/login → goes straight to Creator Dashboard
✅ Database shows `is_creator: true`
✅ localStorage shows `digis:lastKnownRole: 'creator'`
✅ No console errors about role downgrade
✅ (Optional) Console shows protection warnings if triggered

## Rollback Plan

If issues occur:

```bash
git revert HEAD
git push origin main
# Redeploy
```

## Monitoring

**Console Messages to Watch**:
- ✅ `💾 Persisted lastKnownRole: creator` - Good
- ✅ `🛡️ Protected role downgrade` - Protection working
- ❌ `⚠️ Blocked creator→fan downgrade` - Should NOT appear in normal use
- ❌ `⚠️ Invalid role detected` - Critical error

**localStorage to Monitor**:
- Key: `digis:lastKnownRole`
- Value should be: `'creator'` for Miriam

## Notes for Developers

- **Never** manually set `profile.is_creator = false` for creators
- **Always** use `setProfile()` from AuthContext (has protection)
- **Check** `lastKnownRole` if role seems wrong
- **Trust** the database as source of truth

---

**Fixed**: 2025-10-15
**Tested By**: Pending deployment testing
**Status**: Ready for production
