# Role Management Architecture - Single Source of Truth

## Problem Solved

Previously, the app had multiple sources of truth for user roles:
- `user.is_creator` from props
- `profile.is_creator` from profile endpoint
- `localStorage` cached values
- `NavigationContext` computed role

This caused **role flip-flopping** where a creator account would randomly appear as a fan account due to race conditions, stale data, or cache desynchronization.

## Solution: 3-State Auth Pattern

The new architecture implements a **strict 3-state bootstrap pattern** with a single source of truth.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Single Source)                   │
│                                                               │
│  GET /api/auth/session                                       │
│  └─> Returns: { role, is_creator, is_admin, permissions }  │
│      Computed once from database                             │
│                                                               │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Frontend (useAuthStore)                    │
│                                                               │
│  State: "idle" | "loading" | "ready"                        │
│  Role: "creator" | "fan" | "admin" | null                   │
│                                                               │
│  CRITICAL: App doesn't render until authStatus === "ready"  │
│                                                               │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    All Components                            │
│                                                               │
│  const role = useAuthStore(s => s.role);                    │
│  const isCreator = useAuthStore(s => s.isCreator());        │
│                                                               │
│  ✅ Always read from useAuthStore                           │
│  ❌ Never read from user.is_creator or profile              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Backend: `/api/auth/session`

**Location**: `backend/routes/auth.js`

**Purpose**: Single source of truth for role

**Returns**:
```json
{
  "success": true,
  "session": {
    "userId": "uuid",
    "email": "user@example.com",
    "username": "username",
    "role": "creator",          // PRIMARY: "creator" | "fan" | "admin"
    "is_creator": true,
    "is_admin": false,
    "permissions": ["creator:manage", "creator:earnings"],
    "role_version": 1,
    "user": { "id": "...", "email": "...", "username": "..." }
  }
}
```

**Key Features**:
- Queries database once using `getUserRole(userId)`
- Computes role from `is_creator` and `is_admin` fields
- Returns permissions array for fine-grained access control
- Includes `role_version` for future token rotation

### 2. Frontend: `useAuthStore`

**Location**: `frontend/src/stores/useAuthStore.js`

**Purpose**: Manages auth state with 3-state pattern

**States**:
- `idle`: No auth attempt yet
- `loading`: Fetching session from backend
- `ready`: Session loaded, role is authoritative

**Key Methods**:
```javascript
// Bootstrap on app load
await useAuthStore.getState().bootstrap(token);

// Get current role (always use this)
const role = useAuthStore(s => s.role);

// Check if creator
const isCreator = useAuthStore(s => s.isCreator());

// Upgrade role (triggers session refresh)
await useAuthStore.getState().upgradeRole('creator');

// Logout
useAuthStore.getState().clearSession();
```

### 3. AppBootstrap Component

**Location**: `frontend/src/components/AppBootstrap.jsx`

**Purpose**: Blocks rendering until auth is ready

**Usage**:
```jsx
// In App.jsx or main.jsx
import AppBootstrap from './components/AppBootstrap';

function App() {
  return (
    <AppBootstrap>
      {/* Your app only renders after authStatus === 'ready' */}
      <YourApp />
    </AppBootstrap>
  );
}
```

**What it does**:
1. Calls `bootstrap()` on mount
2. Shows loading screen while `authStatus === 'loading'`
3. Listens for Supabase auth changes
4. Only renders children when `authStatus === 'ready'`

This **eliminates flicker** and **prevents role flip-flopping** by ensuring we never render with uncertain role state.

## Migration Guide

### Before (❌ Old Way)

```javascript
// Multiple sources of truth - FRAGILE
const isCreator = user?.is_creator || profile?.is_creator || localStorage.getItem('userIsCreator');

// Race conditions possible
useEffect(() => {
  fetchProfile().then(p => {
    setIsCreator(p.is_creator); // Might be stale!
  });
}, []);

// Renders before role is known
return isCreator ? <CreatorView /> : <FanView />;
```

### After (✅ New Way)

```javascript
// Single source of truth - ROCK SOLID
const role = useAuthStore(s => s.role);
const isCreator = useAuthStore(s => s.isCreator());

// App doesn't render until role is known (handled by AppBootstrap)
// No need for loading states or race condition handling

// Always correct, never flips
return role === 'creator' ? <CreatorView /> : <FanView />;
```

### Updating Components

Replace these patterns:

```javascript
// ❌ OLD - Don't use these anymore
user?.is_creator
profile?.is_creator
storeIsCreator
user?.role === 'creator'
isCreator (from props)
```

With:

```javascript
// ✅ NEW - Single source of truth
import useAuthStore from '../stores/useAuthStore';

const role = useAuthStore(s => s.role);
const isCreator = useAuthStore(s => s.isCreator());
const isAdmin = useAuthStore(s => s.isAdmin());
const hasPermission = useAuthStore(s => s.hasPermission('creator:manage'));
```

## Route Protection

```javascript
function RequireRole({ allowed, children }) {
  const role = useAuthStore(s => s.role);

  if (!role || !allowed.includes(role)) {
    return <Navigate to="/forbidden" replace />;
  }

  return children;
}

// Usage
<Route
  path="/creator/dashboard"
  element={
    <RequireRole allowed={['creator', 'admin']}>
      <CreatorDashboard />
    </RequireRole>
  }
/>
```

## Layout Switching

```javascript
function AppLayout() {
  const role = useAuthStore(s => s.role);

  switch (role) {
    case 'admin':
      return <AdminLayout />;
    case 'creator':
      return <CreatorLayout />;
    case 'fan':
    default:
      return <FanLayout />;
  }
}
```

## Handling Role Upgrades

When a user upgrades from fan to creator:

```javascript
// After successful creator registration
const upgradeRole = useAuthStore(s => s.upgradeRole);
await upgradeRole('creator');

// This will:
// 1. Update the store immediately
// 2. Increment role_version
// 3. Refresh the session from backend
// 4. Update UI automatically via Zustand subscribers
```

## Testing

```javascript
// Mock the auth store in tests
import { act } from '@testing-library/react';
import useAuthStore from './stores/useAuthStore';

beforeEach(() => {
  act(() => {
    useAuthStore.getState().setSession({
      role: 'creator',
      user: { id: '123', email: 'test@example.com', username: 'test' },
      permissions: ['creator:all']
    });
  });
});
```

## Benefits

✅ **No more role flip-flopping** - Single source of truth prevents inconsistencies

✅ **No localStorage** - Eliminates stale cache issues

✅ **No race conditions** - App doesn't render until role is known

✅ **No flicker** - Bootstrap pattern ensures smooth loading

✅ **Type-safe** - Strict role types: "creator" | "fan" | "admin"

✅ **Future-proof** - Supports JWT rotation via `role_version`

✅ **Production-ready** - Tested pattern used by major apps

## Common Pitfalls to Avoid

❌ **Don't** read role from props or local storage
❌ **Don't** compute role from multiple fields
❌ **Don't** render before `authStatus === 'ready'`
❌ **Don't** cache role in component state
❌ **Don't** use multiple auth stores

✅ **Do** always use `useAuthStore`
✅ **Do** wrap app with `AppBootstrap`
✅ **Do** trust the backend as source of truth
✅ **Do** use `upgradeRole()` for explicit changes
✅ **Do** test edge cases (logout, expired tokens)

## Next Steps (Recommended)

1. **Add JWT role claims** - Put role in the JWT for faster validation
2. **Token rotation** - Force refresh JWT when role changes
3. **Multi-tab sync** - Use BroadcastChannel for role changes
4. **Audit logs** - Track role changes in database
5. **RBAC middleware** - Enforce roles on every backend route

## Questions?

This architecture is based on industry best practices and eliminates the class of bugs that cause role flip-flopping. If you have questions or need to extend this pattern, refer to the code comments in:

- `backend/routes/auth.js` - `/session` endpoint
- `frontend/src/stores/useAuthStore.js` - Auth store
- `frontend/src/components/AppBootstrap.jsx` - Bootstrap component
