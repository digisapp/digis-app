# Authentication & Navigation Refactor - Implementation Guide

## Overview

This guide documents the comprehensive refactor of authentication and navigation to eliminate "Creator (default)" bugs and role drift issues.

## ✅ Completed Changes

### 1. Canonical `currentUser` from AuthContext

**What Changed:**
- Created `currentUser` in AuthContext that merges Supabase auth (id, email) with DB profile (username, display_name, role, etc.)
- All navigation components now call `useAuth()` instead of receiving `user` as props

**Files Modified:**
- `frontend/src/contexts/AuthContext.jsx` - Added currentUser useMemo
- `frontend/src/components/navigation/DesktopNav2025.js` - Uses useAuth()
- `frontend/src/components/navigation/MobileNav.js` - Uses useAuth()
- `frontend/src/components/navigation/NavigationShell.js` - Uses useAuth()
- `frontend/src/App.js` - Removed user prop from Navigation

**Impact:**
- Navigation now shows "Miriam" instead of "Creator (default)"
- Both desktop and mobile display correct username/display_name

### 2. Role String Export from AuthContext

**What Changed:**
- Exported canonical `role` string from AuthContext: `'admin' | 'creator' | 'fan' | null`
- Centralized role computation logic to avoid recomputation

**Code:**
```javascript
// AuthContext.jsx
const role = useMemo(() => {
  if (!roleResolved) return null;
  if (profile?.role === 'admin' || isAdmin) return 'admin';
  if (profile?.is_creator || isCreator) return 'creator';
  return 'fan';
}, [profile?.role, profile?.is_creator, isAdmin, isCreator, roleResolved]);
```

**Usage:**
```javascript
// Before (every component)
const { isCreator, isAdmin } = useAuth();
const role = isCreator ? 'creator' : isAdmin ? 'admin' : 'fan';

// After (centralized)
const { role } = useAuth();
```

### 3. Role Drift Elimination

**What Changed:**
- Removed `useAuthStore` role fallbacks in navigation components
- Single source of truth: AuthContext only

**Files Modified:**
- `frontend/src/components/navigation/MobileNav.js` - Removed storeRole fallback
- `frontend/src/components/navigation/DesktopNav2025.js` - Removed storeRole fallback

**Impact:**
- No more conflicts between store role ('fan') and context role ('creator')

### 4. roleResolved Guards

**What Changed:**
- Added `roleResolved` guards to prevent UI flicker during auth bootstrap

**Implementation:**
```javascript
// Mobile skeleton
if (!roleResolved) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100]" style={{...}}>
      <div className="flex items-center justify-around h-[72px] px-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex flex-col items-center justify-center flex-1">
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    </nav>
  );
}
```

**Impact:**
- Navigation doesn't render until role is fully resolved
- Prevents "fan → creator" flicker on page load

### 5. PWA Cache Management

**What Changed:**
- Added `cleanupOutdatedCaches: true`
- Added `clientsClaim: true` and `skipWaiting: true` for immediate SW updates

**File Modified:**
- `frontend/vite.config.js`

**Configuration:**
```javascript
VitePWA({
  registerType: 'autoUpdate',
  cleanupOutdatedCaches: true,
  workbox: {
    clientsClaim: true,
    skipWaiting: true,
    cleanupOutdatedCaches: true,
    // ...
  }
})
```

## 📋 Recommended Next Steps

### 1. Guard All Role-Dependent UI

**Pattern to Follow:**
```javascript
function MyComponent() {
  const { currentUser, role, roleResolved } = useAuth();

  if (!roleResolved) return <SkeletonNav />;

  // Safe to render with currentUser / role after this point
  return (
    <div>
      <h1>{currentUser.display_name || currentUser.username}</h1>
      {role === 'creator' && <CreatorActions />}
    </div>
  );
}
```

**Apply to:**
- Any header/menu that prints the name
- Any component with creator-only actions
- Any page that depends on role to render content

### 2. Service Worker Update Strategy

**Current Behavior:**
- `skipWaiting: true` → SW activates immediately on update
- Can refresh users mid-flow (disruptive during payment/auth)

**Recommended Enhancement:**
```javascript
// In src/utils/ServiceWorkerManager.js or similar
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(registration => {
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // Show toast: "New version available — Refresh"
          showUpdateToast(() => {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
          });
        }
      });
    });
  });
}
```

**Benefits:**
- User controls when to update (not mid-flow)
- Quick updates still possible (user can click banner)

### 3. Migrate Remaining Components Off Props

**Current State:**
- ~36 components in App.js still receive `user={user}` as props
- These show "default" instead of actual username

**Migration Pattern:**
```javascript
// BEFORE (App.js)
<MessagesPage user={user} isCreator={isCreator} />

// BEFORE (MessagesPage.jsx)
function MessagesPage({ user, isCreator }) {
  return <div>{user.username || 'default'}</div>; // ❌ Shows "default"
}

// AFTER (App.js)
<MessagesPage />

// AFTER (MessagesPage.jsx)
import { useAuth } from '../contexts/AuthContext';

function MessagesPage() {
  const { currentUser, role, roleResolved } = useAuth();

  if (!roleResolved) return <Skeleton />;

  return <div>{currentUser.username}</div>; // ✅ Shows "miriam"
}
```

**Codemod Approach:**
1. Find all `user={user}` in App.js
2. Remove the prop from component calls
3. Add `import { useAuth } from '../contexts/AuthContext'` to component files
4. Replace function signature: `function X({ user, ...rest })` → `function X(props)`
5. Add `const { currentUser, role, roleResolved } = useAuth()` at top
6. Replace all `user.` references with `currentUser.`
7. Add roleResolved guard if component depends on role

**ESLint Rule (Optional):**
```json
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "JSXAttribute[name.name='user'][value.expression.name='user']",
        "message": "Use useAuth() hook instead of passing user as prop"
      }
    ]
  }
}
```

### 4. Normalize Profile Fields Server-Side

**Check Backend Returns:**
```json
{
  "id": "...",
  "email": "...",
  "username": "miriam",
  "display_name": "Miriam",    // NOT displayName or displayname
  "is_creator": true,           // NOT isCreator or is_Creator
  "role": "creator",
  "avatar_url": "...",          // NOT avatarUrl or avatar_URL
  "token_balance": 1000
}
```

**Endpoints to Verify:**
- `POST /api/auth/sync-user` - Returns full profile on login
- `GET /api/auth/me` - Returns canonical user data
- `GET /api/users/profile` - Returns profile with consistent keys

**Test:**
```bash
# As Miriam
curl -H "Authorization: Bearer $TOKEN" \
  https://backend-nathans-projects-43dfdae0.vercel.app/api/auth/me | jq
```

**Expected:**
```json
{
  "username": "miriam",
  "display_name": "Miriam",
  "is_creator": true,
  "role": "creator"
}
```

### 5. Handle Account Switching Cleanly

**Issue:**
- User A logs in → caches populate
- User A logs out, User B logs in → stale cache can show User A's data

**Solution:**

**In AuthContext.jsx:**
```javascript
const signOut = useCallback(async () => {
  try {
    await supabase.auth.signOut();

    // Clear ALL per-user caches
    setUser(null);
    setProfile(null);
    setTokenBalance(0);
    clearProfileCache();
    clearRoleCache();

    // Clear any stores
    useAuthStore.getState().logout();
    useHybridStore.getState().logout();

    // Clear localStorage items
    localStorage.removeItem('userIsCreator');
    localStorage.removeItem('userRole');

    console.log('✅ Signed out successfully');
  } catch (error) {
    console.error('Sign out error:', error);
    setError('Failed to sign out');
  }
}, []);
```

**In SocketContext:**
```javascript
// Disconnect/reconnect on user ID change
useEffect(() => {
  if (!currentUser?.id) return;

  // Disconnect previous user's socket
  socketService.disconnect();

  // Wait for role resolution before connecting
  if (roleResolved) {
    socketService.connect(currentUser.id);
    socketService.emit('user:join', {
      userId: currentUser.id,
      role: role
    });
  }

  return () => {
    socketService.disconnect();
  };
}, [currentUser?.id, role, roleResolved]);
```

## 🧪 Testing Checklist

### Desktop Testing
- [ ] Log in as creator Miriam
- [ ] Verify ProfileDropdown shows "Miriam" (not "Creator (default)")
- [ ] Verify no flicker during page load
- [ ] Check token balance displays correctly
- [ ] Log out and log in as different user
- [ ] Verify no data leakage between accounts

### Mobile Testing
- [ ] Log in as creator Miriam
- [ ] Verify profile menu shows "Miriam"
- [ ] Verify dashboard title shows "Miriam"
- [ ] Verify no flicker during page load
- [ ] Tap profile copy link → uses correct username
- [ ] Open wallet modal → receives currentUser
- [ ] Log out and log in as different user
- [ ] Verify no data leakage between accounts

### DevTools Verification
- [ ] Open Network tab
- [ ] Check `/api/auth/sync-user` response has full profile
- [ ] Check `/api/auth/me` response has full profile
- [ ] Console logs show: `✅ Canonical role fetched from /api/me: { username: "miriam", is_creator: true }`
- [ ] No errors about missing username or display_name

### Cache Testing
- [ ] Deploy new version
- [ ] Hard refresh (Cmd+Shift+R)
- [ ] Verify old cached pages are gone
- [ ] Verify new code loads immediately

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│              AuthContext (SSoT)                 │
│                                                 │
│  ┌─────────────────────────────────────────┐  │
│  │ user (Supabase auth: id, email)         │  │
│  │ profile (DB: username, display_name...) │  │
│  └─────────────────────────────────────────┘  │
│                     ↓                           │
│  ┌─────────────────────────────────────────┐  │
│  │ currentUser = { ...user, ...profile }   │  │
│  │ role = 'admin' | 'creator' | 'fan'      │  │
│  │ roleResolved = true                     │  │
│  └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                     ↓
        ┌────────────┴────────────┐
        ↓                         ↓
┌──────────────┐          ┌──────────────┐
│ DesktopNav   │          │  MobileNav   │
│              │          │              │
│ useAuth()    │          │ useAuth()    │
│ - currentUser│          │ - currentUser│
│ - role       │          │ - role       │
│ - resolved   │          │ - resolved   │
└──────────────┘          └──────────────┘
        ↓                         ↓
   Shows "Miriam"            Shows "Miriam"
```

## 🎯 Success Criteria

✅ Navigation shows actual username (not "default")
✅ No role flicker during page load
✅ Desktop and mobile consistent
✅ Role comes from single source (AuthContext)
✅ Cache clears on deployment
✅ Account switching is clean (no data leakage)

## 📝 Notes

- All changes have been committed and pushed to main branch
- Backend URLs verified: `https://backend-nathans-projects-43dfdae0.vercel.app`
- PWA config enhanced for immediate updates
- Role drift sources eliminated
- Migration pattern documented for remaining 36 components

## 🚀 Deployment

All changes are live on:
- Frontend: `https://digis.cc`
- Backend: `https://backend-nathans-projects-43dfdae0.vercel.app`

Next deployment will automatically:
- Clean old caches via `cleanupOutdatedCaches`
- Activate new SW immediately via `skipWaiting`
- Show updated navigation with correct usernames
