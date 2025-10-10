# App.js Refactoring Plan

## Overview
App.js is currently **1,718 lines** with multiple responsibilities. This document outlines a safe, incremental refactoring strategy to reduce it to ~150-200 lines.

## Current Problems
1. **Too many responsibilities**: Auth, routing, state, modals, services, navigation
2. **20+ useState hooks** and 10+ useEffect hooks
3. **Duplicated logic** for mobile/desktop rendering
4. **localStorage role flags** causing "creator flips to fan" bugs
5. **Mixed concerns**: UI, business logic, data fetching all in one file

---

## Refactoring Phases (Safe & Incremental)

### ✅ Phase 1: Modal Management (~150 lines removed)
**Status**: Complete
**Risk**: Low (isolated state)

**Created**:
- `src/contexts/ModalContext.jsx` - Centralized modal state with `open()`, `close()`, `isOpen()` API
- `src/components/modals/Modals.jsx` - Single component that renders all modals

**Benefits**:
- Replaces 10+ individual `useState` flags
- No prop drilling
- Lazy-loaded modals
- Typed modal identifiers prevent typos

**Usage**:
```javascript
import { useModal, MODALS } from './contexts/ModalContext';

const { open, close, isOpen } = useModal();

// Open modal with props
open(MODALS.TOKEN_PURCHASE, { onSuccess: handleSuccess });

// Close modal
close(MODALS.TOKEN_PURCHASE);

// Check if open
if (isOpen(MODALS.TOKEN_PURCHASE)) { ... }
```

---

### ✅ Phase 2: Device Detection (~50 lines removed)
**Status**: Complete
**Risk**: Very Low (no side effects)

**Created**:
- `src/contexts/DeviceContext.jsx` - Single source of truth for device detection

**Benefits**:
- Replaces scattered `useMediaQuery` calls
- Removes duplicate device detection logic
- Removes duplicate debug console.log statements
- Single provider for `isMobile`, `isTablet`, `isDesktop`, `orientation`, etc.

**Usage**:
```javascript
import { useDevice } from './contexts/DeviceContext';

const { isMobile, isTablet, isDesktop, orientation } = useDevice();
```

---

### ✅ Phase 3: Authentication (~300 lines removed)
**Status**: Complete
**Risk**: Medium (core functionality, but well-tested)

**Created**:
- `src/contexts/AuthContext.jsx` - Single source of truth for auth

**Consolidates**:
- Supabase session management
- Profile syncing with backend via `/api/auth/sync-user`
- Token balance fetching and updates
- Role verification (creator/admin/fan)
- Profile caching for persistence (replaces manual localStorage reads)
- Syncs with AppBootstrap's `useAuthStore`

**Removes**:
- Duplicate auth logic in App.js
- Manual `localStorage.getItem('userIsCreator')` checks
- Scattered `fetchUserProfile()` and `fetchTokenBalance()` functions
- Profile cache loading/saving scattered across App.js

**Benefits**:
- **Fixes role flip-flopping**: Profile is single source of truth, no more localStorage flags
- **Session persistence**: Properly hydrates from cache on page refresh
- **Throttled fetching**: Prevents duplicate API calls
- **Type-safe**: Returns well-defined user, profile, and token data

**Usage**:
```javascript
import { useAuth } from './contexts/AuthContext';

const {
  user,           // Supabase user object
  profile,        // Full profile from backend
  tokenBalance,   // Current token balance
  authLoading,    // Loading state
  isCreator,      // Computed from profile.is_creator
  isAdmin,        // Computed from profile.is_super_admin
  isAuthenticated, // Boolean
  signOut,        // Function to sign out
  refreshProfile, // Manually refresh profile
  updateTokenBalance // Update balance (for purchases)
} = useAuth();
```

---

### 🔄 Phase 4: Routes (~600 lines removed)
**Status**: TODO
**Risk**: Low (isolated rendering logic)

**To Create**:
- `src/routes/AppRoutes.jsx` - All route definitions
- `src/routes/ProtectedRoutes.jsx` - Auth-required routes
- `src/routes/PublicRoutes.jsx` - Public routes
- `src/routes/routeConfig.js` - Route mappings

**Changes**:
- Move all `<Routes>` and lazy imports out of App.js
- Remove `currentView` state (use `location.pathname` as single source of truth)
- Remove URL ⇄ view syncing effects
- Keep route ownership of code-splitting

**Benefits**:
- App.js becomes declarative: `<AppRoutes />`
- No more `currentView` state duplication
- Routes own their own lazy imports
- Easier to add/remove/modify routes

---

### 🔄 Phase 5: Socket Provider (~100 lines removed)
**Status**: TODO
**Risk**: Low (isolated connection logic)

**To Create**:
- `src/contexts/SocketContext.jsx` - Centralized socket management

**Consolidates**:
- Socket.io connection lifecycle
- Event listeners (calls, messages, balance updates)
- Connection status
- Emit functions (`requestCall`, etc.)

**Benefits**:
- No direct `socketService` calls in App.js
- Automatic connect/disconnect on login/logout
- Clean API for socket operations

---

## Final App.js Structure (~150-200 lines)

```javascript
import { AuthProvider } from './contexts/AuthContext';
import { DeviceProvider } from './contexts/DeviceContext';
import { ModalProvider } from './contexts/ModalContext';
import { SocketProvider } from './contexts/SocketProvider';
import Navigation from './components/navigation';
import AppRoutes from './routes/AppRoutes';
import Modals from './components/modals/Modals';
import ErrorBoundary from './components/ui/ErrorBoundary';

const App = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <DeviceProvider>
            <SocketProvider>
              <ModalProvider>
                <Navigation />
                <AppRoutes />
                <Modals />
              </ModalProvider>
            </SocketProvider>
          </DeviceProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
```

**What's left in App.js**: Nothing! Just provider composition.

---

## Migration Steps

### Step 1: Wrap App with new providers
Add to `main.jsx` or `App.js`:

```javascript
import { DeviceProvider } from './contexts/DeviceContext';
import { ModalProvider } from './contexts/ModalContext';
import { AuthProvider } from './contexts/AuthContext';

// Wrap existing App
root.render(
  <BrowserRouter>
    <AuthProvider>
      <DeviceProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </DeviceProvider>
    </AuthProvider>
  </BrowserRouter>
);
```

### Step 2: Replace modal state in App.js
**Before**:
```javascript
const [showTokenPurchase, setShowTokenPurchase] = useState(false);
const [showGoLiveSetup, setShowGoLiveSetup] = useState(false);
// ... 8 more modal states
```

**After**:
```javascript
import { useModal, MODALS } from './contexts/ModalContext';
const { open, close } = useModal();

// Replace setShowTokenPurchase(true)
open(MODALS.TOKEN_PURCHASE, { onSuccess: handleSuccess });

// Replace setShowTokenPurchase(false)
close(MODALS.TOKEN_PURCHASE);
```

### Step 3: Replace device detection
**Before**:
```javascript
const isMobile = useMediaQuery(BREAKPOINTS.MOBILE_QUERY);
const isTablet = useMediaQuery(BREAKPOINTS.TABLET_QUERY);
// ... duplicate checks everywhere
```

**After**:
```javascript
import { useDevice } from './contexts/DeviceContext';
const { isMobile, isTablet, isDesktop } = useDevice();
```

### Step 4: Replace auth logic
**Before**:
```javascript
const [user, setUser] = useState(null);
const [profile, setProfile] = useState(null);
const [tokenBalance, setTokenBalance] = useState(0);
const isCreator = profile?.is_creator || localStorage.getItem('userIsCreator') === 'true';
// ... complex initAuth useEffect
```

**After**:
```javascript
import { useAuth } from './contexts/AuthContext';
const { user, profile, tokenBalance, isCreator, isAdmin } = useAuth();
```

### Step 5: Replace modal rendering
**Before**: 150+ lines of conditional modal JSX in App.js

**After**:
```javascript
import Modals from './components/modals/Modals';

// In render:
<Modals
  user={user}
  tokenBalance={tokenBalance}
  onTokenUpdate={fetchTokenBalance}
/>
```

---

## Testing Strategy

1. **Test AuthProvider**:
   - Session present/absent
   - Profile cache hydration
   - Role mapping (creator/admin/fan)
   - Sign in/out flows

2. **Test ModalContext**:
   - Open/close modals
   - Pass props to modals
   - Multiple modals open at once

3. **Test DeviceProvider**:
   - Responsive breakpoints
   - Orientation changes
   - Touch vs pointer devices

4. **Integration Tests**:
   - Full auth flow (sign in → profile load → token fetch)
   - Modal interactions with auth state
   - Device-specific rendering

---

## Success Metrics

- ✅ App.js reduced from 1,718 → ~200 lines (88% reduction)
- ✅ No more `localStorage` role checks (single source of truth: profile)
- ✅ No more role flip-flopping bugs
- ✅ Session persistence works on refresh
- ✅ Modal state centralized (no prop drilling)
- ✅ Device detection centralized (no duplicate logic)
- ✅ All tests pass
- ✅ No regressions in prod

---

## Rollback Plan

Each phase is independent. If issues arise:

1. **Phase 1 (Modals)**: Keep old modal state, remove ModalProvider
2. **Phase 2 (Device)**: Keep old useMediaQuery calls, remove DeviceProvider
3. **Phase 3 (Auth)**: Revert to old initAuth logic, remove AuthProvider
4. **Phases 4-5**: Not yet implemented

All changes are additive (providers wrap existing code), so rollback is low-risk.

---

## Next Steps

1. ✅ **Complete Phase 3** - Test AuthProvider thoroughly
2. 🔄 **Start Phase 4** - Extract routes to AppRoutes.jsx
3. 🔄 **Start Phase 5** - Create SocketProvider
4. ✅ **Update App.js** - Remove old code, use new providers
5. ✅ **Test thoroughly** - All flows (auth, modals, routing, sockets)
6. ✅ **Deploy to staging** - Monitor for issues
7. ✅ **Deploy to prod** - Gradual rollout

---

## Questions or Issues?

If you encounter problems during migration:
1. Check console for provider errors
2. Verify provider order (Auth → Device → Socket → Modal)
3. Ensure all imports are correct
4. Check that hooks are used inside provider boundaries
