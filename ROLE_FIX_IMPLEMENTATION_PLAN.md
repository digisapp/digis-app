# Creator→Fan Role Flip Fix - Implementation Plan

## Problem Summary

Miriam's Creator account randomly turns into a Fan account, losing the full menu and creator dashboard. This happens because:

1. **Multiple sources of role truth** - localStorage hints, AuthContext state, and backend database can disagree
2. **Race conditions** - Fast render paths mount Fan UI before canonical Creator role loads
3. **Legacy role hints** - Old `userRole` / `userIsCreator` localStorage keys override AuthContext
4. **Late sync-user failures** - Backend blips clobber creator profile with incomplete data

## Root Cause

The UI renders "Fan" from an initial/default guess while the real "Creator" role is still loading (or briefly errors), so parts of the app mount the Fan experience and cache/navigate from there. On iOS with Suspense/hydration and SW caching, this looks "random".

## Solution Architecture

### 1. Authoritative Session Endpoint ✅ COMPLETE

**File**: `backend/routes/auth.js`
**Endpoint**: `GET /api/auth/session`

```javascript
router.get('/session', verifySupabaseToken, async (req, res) => {
  // Query database directly - NO cache, NO guessing
  const query = `
    SELECT
      u.id as db_id,
      u.supabase_id,
      COALESCE(u.is_creator, false) as is_creator,
      COALESCE(u.is_super_admin, false) as is_admin
    FROM users u
    WHERE u.supabase_id = $1
    LIMIT 1
  `;

  // ... returns canonical role with Cache-Control: no-store
});
```

**Status**: ✅ Implemented
- Returns authoritative role directly from database
- No CDN/device caching (`Cache-Control: no-store`)
- Explicit NULL-safe boolean coalescing

### 2. Update AuthContext to Use Session Endpoint

**File**: `frontend/src/contexts/AuthContext.jsx`

**Changes Needed**:

1. **Replace sync-user with session endpoint** in `initAuth()`:
   ```javascript
   // OLD (line ~710):
   const result = await safeFetch(
     `${import.meta.env.VITE_BACKEND_URL}/api/auth/sync-user`,
     { method: 'POST', ... }
   );

   // NEW:
   const result = await safeFetch(
     `${import.meta.env.VITE_BACKEND_URL}/api/auth/session`,
     { method: 'GET', headers: { Authorization: `Bearer ${session.access_token}` } }
   );
   ```

2. **Update response handling**:
   ```javascript
   // OLD:
   if (result.ok && result.data?.user) {
     const userData = result.data.user;

   // NEW:
   if (result.ok && result.data?.ok) {
     const userData = {
       id: result.data.user.dbId,
       supabase_id: result.data.user.supabaseId,
       is_creator: result.data.user.isCreator,
       is_admin: result.data.user.isAdmin,
       roles: result.data.user.roles
     };
   ```

3. **Remove roleHint logic** (lines 88-94, 147-150):
   - Delete `roleHint` state variable
   - Delete `digis:lastKnownRole` localStorage reads
   - Keep lastKnownRole persistence for debugging only (lines 176-186)

4. **Simplify role computation** (lines 140-162):
   ```javascript
   // NEW - simplified:
   const role = useMemo(() => {
     if (profile?.is_admin === true) return 'admin';
     if (profile?.is_creator === true) return 'creator';
     return user ? 'fan' : null;
   }, [profile?.is_creator, profile?.is_admin, user]);
   ```

5. **Update protected setProfile** to trust backend (lines 57-82):
   ```javascript
   // KEEP downgrade protection but log only:
   if (currentProfile?.is_creator === true && newProfile.is_creator !== true) {
     console.warn('⚠️ Backend sent creator→fan downgrade. Investigate database!', {
       current: { username: currentProfile.username, is_creator: currentProfile.is_creator },
       attempted: { username: newProfile.username, is_creator: newProfile.is_creator }
     });
     // Log to Sentry but ALLOW the update (trust backend)
     addBreadcrumb('role_downgrade_from_backend', { level: 'warning', ...eventData });
   }
   return newProfile; // Always trust backend
   ```

### 3. Remove Legacy Role Hints from App.js

**File**: `frontend/src/App.jsx`

**Changes Needed**:

1. **Remove getInitialView()** function that reads `localStorage.userRole`
2. **Remove all reads of** `localStorage.userIsCreator` or `localStorage.userRole`
3. **Replace with AuthContext**: Everywhere that checks role, use `const { isCreator, isAdmin, roleResolved } = useAuth();`
4. **Gate initial routing on roleResolved**:
   ```javascript
   if (authLoading || !roleResolved) {
     return <LoadingScreen />;
   }

   const defaultPath = isAdmin ? '/admin' : isCreator ? '/dashboard' : '/explore';
   ```

### 4. Add Route Guards

**File**: `frontend/src/routes/guards.jsx` (NEW)

```javascript
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function CreatorOnly({ children }) {
  const { roleResolved, isCreator } = useAuth();
  if (!roleResolved) return null; // or skeleton
  return isCreator ? children : <Navigate to="/explore" replace />;
}

export function FanOnly({ children }) {
  const { roleResolved, isCreator } = useAuth();
  if (!roleResolved) return null;
  return !isCreator ? children : <Navigate to="/dashboard" replace />;
}
```

**Usage in Routes**:
```javascript
<Route
  path="/dashboard"
  element={<CreatorOnly><HybridCreatorDashboard /></CreatorOnly>}
/>
<Route
  path="/wallet"
  element={<FanOnly><WalletPage /></FanOnly>}
/>
```

### 5. Gate All UI on roleResolved

**Files to Update**:
- `frontend/src/App.jsx` - Main app router
- `frontend/src/components/Navigation.jsx` or similar - Menu rendering
- `frontend/src/pages/Dashboard.jsx` - Dashboard routing logic

**Pattern**:
```javascript
function SomeComponent() {
  const { roleResolved, isCreator, authLoading } = useAuth();

  if (authLoading || !roleResolved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Spinner />
      </div>
    );
  }

  // Now safe to branch on role
  return isCreator ? <CreatorUI /> : <FanUI />;
}
```

## Implementation Steps

### Phase 1: Backend (✅ COMPLETE)
1. [x] Create `/api/auth/session` endpoint with no-cache headers
2. [x] Verify database query returns canonical role

### Phase 2: Frontend - AuthContext
1. [ ] Update AuthContext to call `/api/auth/session` instead of `/api/auth/sync-user`
2. [ ] Remove `roleHint` state variable and localStorage reads
3. [ ] Simplify role computation logic
4. [ ] Update protected setProfile to log but trust backend
5. [ ] Test role resolution on Miriam's account

### Phase 3: Frontend - Remove Legacy Hints
1. [ ] Search codebase for all `localStorage.userRole` and `localStorage.userIsCreator` reads
2. [ ] Replace with `useAuth()` hook
3. [ ] Remove `getInitialView()` or similar helper functions
4. [ ] Test initial routing for creators vs fans

### Phase 4: Route Guards
1. [ ] Create `routes/guards.jsx` with CreatorOnly and FanOnly components
2. [ ] Wrap creator-only routes with `<CreatorOnly>`
3. [ ] Wrap fan-only routes with `<FanOnly>`
4. [ ] Test deep linking to protected routes

### Phase 5: UI Gating
1. [ ] Gate App.jsx main router on `roleResolved`
2. [ ] Gate navigation menus on `roleResolved`
3. [ ] Gate dashboard routing on `roleResolved`
4. [ ] Remove any "default fan UI" renderers before roleResolved

### Phase 6: Testing
1. [ ] Clear all localStorage/sessionStorage
2. [ ] Login as Miriam → verify Creator Dashboard appears
3. [ ] Hard refresh (Cmd+Shift+R) → verify still Creator Dashboard
4. [ ] Navigate around app → verify always Creator UI
5. [ ] Logout/login cycle → verify no fan view flash
6. [ ] Test on real iPhone in Safari (portrait + landscape)
7. [ ] Network throttling test (Slow 3G)
8. [ ] Simulate API failure → verify falls back gracefully

## Success Criteria

✅ Miriam logs in → sees Creator Dashboard (not Fan)
✅ Hard refresh → stays on Creator Dashboard
✅ Navigate around app → always sees Creator UI
✅ Logout/login → goes straight to Creator Dashboard
✅ Database shows `is_creator: true`
✅ No console errors about role downgrade
✅ (Optional) Console shows protection warnings if triggered

## Rollback Plan

If issues occur:
```bash
git revert HEAD~5..HEAD  # Revert last 5 commits
git push origin main
# Redeploy
```

## Files to Modify

### Backend
- [x] `backend/routes/auth.js` - Add `/api/auth/session` endpoint

### Frontend
- [ ] `frontend/src/contexts/AuthContext.jsx` - Use session endpoint, remove roleHint
- [ ] `frontend/src/App.jsx` - Remove legacy localStorage reads, gate on roleResolved
- [ ] `frontend/src/routes/guards.jsx` - NEW: Create route guards
- [ ] `frontend/src/components/Navigation.jsx` - Use AuthContext only
- [ ] `frontend/src/pages/Dashboard.jsx` - Gate on roleResolved

### Documentation
- [x] `ROLE_DOWNGRADE_FIX_TEST.md` - Testing guide
- [x] `ROLE_FIX_IMPLEMENTATION_PLAN.md` - This file

## Debugging Tools

**Check current role state**:
```javascript
// Browser console:
localStorage.getItem('digis:lastKnownRole')
```

**Check database**:
```sql
SELECT id, email, username, is_creator, role FROM users WHERE email = 'miriam@examodels.com';
```

**Check session endpoint**:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" https://digis.cc/api/auth/session
```

## Next Steps

After implementing this plan, monitor console for:
- ✅ `💾 Persisted lastKnownRole: creator` (good)
- ✅ `✅ Canonical role fetched from /api/auth/session` (good)
- ❌ `⚠️ Backend sent creator→fan downgrade` (investigate database!)

---

**Status**: Phase 1 complete, Phase 2 in progress
**Last Updated**: 2025-10-15
**Owner**: Claude Code
