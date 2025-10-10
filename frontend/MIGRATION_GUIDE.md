# App.js Refactoring - Migration Guide

## ✅ What's Been Created

All new contexts and utilities are ready to use:

### 1. **ModalContext** (`src/contexts/ModalContext.jsx`)
- Centralized modal state management
- Replaces 10+ individual useState flags
- Clean API: `open()`, `close()`, `isOpen()`, `getProps()`
- Typed modal identifiers in `MODALS` constant

### 2. **DeviceContext** (`src/contexts/DeviceContext.jsx`)
- Single source of truth for device detection
- Replaces scattered `useMediaQuery` calls
- Guards window access for SSR safety
- Provides: `isMobile`, `isTablet`, `isDesktop`, `orientation`

### 3. **AuthContext** (`src/contexts/AuthContext.jsx`)
- Consolidated authentication logic
- Syncs with AppBootstrap's useAuthStore
- Profile caching with proper persistence
- **No more localStorage role flags** (single source of truth: profile)
- Throttled API calls (prevents duplicates)
- Provides: `user`, `profile`, `tokenBalance`, `isCreator`, `isAdmin`, `signOut`

### 4. **SocketContext** (`src/contexts/SocketContext.jsx`)
- Centralized Socket.io management
- Auto-connects on login, disconnects on logout
- Event listeners for calls, messages, balance updates
- Clean emit API: `requestCall`, `respondToCall`, `sendMessage`

### 5. **AppRoutes** (`src/routes/AppRoutes.jsx`)
- All route definitions in one place
- Routes own their lazy imports (not App.js)
- **No more `currentView` state** - `location.pathname` is source of truth
- Mobile/desktop routing handled automatically

### 6. **Logger Utility** (`src/utils/logger.js`)
- Centralized logging with environment awareness
- Debug logs disabled in production
- Categorized loggers: `authLogger`, `socketLogger`, `modalLogger`, `deviceLogger`
- Replaces scattered console.log statements

### 7. **Modals Component** (`src/components/modals/Modals.jsx`)
- Single component that renders all modals
- Lazy-loaded modal components
- Error boundaries for each modal

---

## 🔧 Step-by-Step Migration

### Step 1: Wrap App with New Providers

Update `main.jsx`:

```javascript
import { AuthProvider } from './contexts/AuthContext';
import { DeviceProvider } from './contexts/DeviceContext';
import { ModalProvider } from './contexts/ModalContext';
import { SocketProvider } from './contexts/SocketContext';

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <AuthGate>
            <AppBootstrap>
              <AuthProvider>
                <DeviceProvider>
                  <SocketProvider>
                    <ModalProvider>
                      <App />
                      <Toaster position="top-right" />
                    </ModalProvider>
                  </SocketProvider>
                </DeviceProvider>
              </AuthProvider>
            </AppBootstrap>
          </AuthGate>
        </QueryClientProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
```

**Provider Order Matters!**
1. AuthProvider (auth must be ready first)
2. DeviceProvider (device detection)
3. SocketProvider (needs auth)
4. ModalProvider (UI layer)

---

### Step 2: Replace Auth Logic in App.js

**Before**:
```javascript
const [user, setUser] = useState(null);
const [profile, setProfile] = useState(null);
const [tokenBalance, setTokenBalance] = useState(0);
const [authLoading, setAuthLoading] = useState(true);
const isCreator = profile?.is_creator || localStorage.getItem('userIsCreator') === 'true'; // ❌ BAD

useEffect(() => {
  // 300 lines of initAuth logic...
}, []);

const fetchUserProfile = useCallback(async (currentUser) => {
  // 80 lines...
}, [user]);

const fetchTokenBalance = useCallback(async (currentUser) => {
  // 50 lines...
}, [user]);
```

**After**:
```javascript
import { useAuth } from './contexts/AuthContext';

const {
  user,
  profile,
  tokenBalance,
  authLoading,
  isCreator,
  isAdmin,
  isAuthenticated,
  signOut,
  refreshProfile,
  updateTokenBalance
} = useAuth();

// All auth logic is now in AuthContext!
// No need for initAuth effect, fetchUserProfile, fetchTokenBalance
```

**Delete from App.js**:
- Lines 627-798: `initAuth` useEffect
- Lines 415-553: `fetchUserProfile` function
- Lines 556-607: `fetchTokenBalance` function
- All localStorage role checks

---

### Step 3: Replace Device Detection

**Before**:
```javascript
const isMobile = useMediaQuery(BREAKPOINTS.MOBILE_QUERY);
const isTablet = useMediaQuery(BREAKPOINTS.TABLET_QUERY);
const isMobilePortrait = useMediaQuery(BREAKPOINTS.MOBILE_PORTRAIT_QUERY);
const isMobileLandscape = useMediaQuery(BREAKPOINTS.MOBILE_LANDSCAPE_QUERY);

useEffect(() => {
  console.log('📱 Device detection:', { isMobile, isTablet /* ... */ });
}, [isMobile, isTablet]);
```

**After**:
```javascript
import { useDevice } from './contexts/DeviceContext';

const { isMobile, isTablet, isDesktop, orientation } = useDevice();

// All device detection is centralized!
// Debug logging happens automatically in DeviceContext
```

---

### Step 4: Replace Modal State

**Before**:
```javascript
const [showTokenPurchase, setShowTokenPurchase] = useState(false);
const [showGoLiveSetup, setShowGoLiveSetup] = useState(false);
const [showCreatorApplication, setShowCreatorApplication] = useState(false);
// ... 7 more modal states

// Open modal
setShowTokenPurchase(true);

// Close modal
setShowTokenPurchase(false);

// Render modals (150+ lines of JSX)
{showTokenPurchase && (
  <div className="fixed inset-0...">
    <ImprovedTokenPurchase
      user={user}
      onSuccess={(tokens) => {
        updateTokenBalance(tokens);
        setShowTokenPurchase(false);
      }}
      onClose={() => setShowTokenPurchase(false)}
    />
  </div>
)}
```

**After**:
```javascript
import { useModal, MODALS } from './contexts/ModalContext';
import Modals from './components/modals/Modals';

const { open, close } = useModal();

// Open modal with props
open(MODALS.TOKEN_PURCHASE, {
  onSuccess: (tokens) => updateTokenBalance(tokens)
});

// Close modal
close(MODALS.TOKEN_PURCHASE);

// Render all modals (single line)
<Modals user={user} tokenBalance={tokenBalance} onTokenUpdate={fetchTokenBalance} />
```

**Delete from App.js**:
- All modal useState declarations
- All modal rendering JSX (lines 917-1711)

---

### Step 5: Replace Socket Logic

**Before**:
```javascript
useEffect(() => {
  if (!user) return;

  const timeoutId = setTimeout(async () => {
    try {
      await socketService.connect();
    } catch (error) {
      console.warn('Socket connection failed:', error.message);
    }
  }, 1500);

  const unsubConnection = socketService.on('connection-status', ({ connected }) => {
    setWebsocketConnected(connected);
  });

  const unsubCallRequest = socketService.on('call-request', (data) => {
    // Handle call request...
  });

  // ... more listeners

  return () => {
    clearTimeout(timeoutId);
    unsubConnection();
    unsubCallRequest();
    socketService.disconnect();
  };
}, [user, isCreator]);
```

**After**:
```javascript
import { useSocket } from './contexts/SocketContext';

const { connected, requestCall, respondToCall } = useSocket();

// Socket connects/disconnects automatically!
// Event listeners are registered in SocketContext
```

**Delete from App.js**:
- Lines 303-372: Socket useEffect

---

### Step 6: Replace Routes with AppRoutes

**Before**:
```javascript
const [currentView, setCurrentView] = useState('explore');

// URL ⇄ view syncing (causes loops!)
useEffect(() => {
  const pathToView = {
    '/': 'home',
    '/dashboard': 'dashboard',
    '/explore': 'explore',
    // ... 30 more
  };
  const view = pathToView[location.pathname];
  if (view) {
    setCurrentView(view);
  }
}, [location.pathname]);

// 600+ lines of conditional rendering
{currentView === 'dashboard' ? (
  <DashboardRouter />
) : currentView === 'explore' ? (
  <ExplorePage />
) : currentView === 'messages' ? (
  <MessagesPage />
) : // ... 30 more views
}
```

**After**:
```javascript
import AppRoutes from './routes/AppRoutes';

// Single line!
<AppRoutes />

// location.pathname is the single source of truth
// No more currentView state, no more syncing effects
```

**Delete from App.js**:
- `currentView` state
- `setCurrentView` calls everywhere
- URL ⇄ view syncing effects (lines 223-252)
- All conditional view rendering (lines 1031-1554)

---

### Step 7: Consolidated Debug Logs

**Before**:
```javascript
console.log('🔐 Auth state changed:', event);
console.log('📱 Device detection:', { isMobile, isTablet });
console.log('🔵 Opening modal:', modalName);
console.log('📡 Socket connected');
```

**After**:
```javascript
import { authLogger, deviceLogger, modalLogger, socketLogger } from './utils/logger';

authLogger.auth('login', { email: user.email });
deviceLogger.device({ isMobile, isTablet });
modalLogger.modal('open', 'tokenPurchase');
socketLogger.socket('connected', { userId: user.id });

// In production, debug logs are automatically disabled!
```

---

## 📝 New App.js Structure (Target: ~200 lines)

```javascript
import React, { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useDevice } from './contexts/DeviceContext';
import { useModal } from './contexts/ModalContext';
import { useSocket } from './contexts/SocketContext';
import Navigation from './components/navigation';
import AppRoutes from './routes/AppRoutes';
import Modals from './components/modals/Modals';
import ErrorBoundary from './components/ui/ErrorBoundary';
import EnhancedToaster from './components/ui/EnhancedToaster';

const App = () => {
  // Get state from contexts (no business logic in App.js)
  const { user, profile, tokenBalance, isCreator, isAdmin, updateTokenBalance } = useAuth();
  const { isMobile } = useDevice();
  const { open } = useModal();
  const { connected } = useSocket();

  // Minimal UI state (only what's needed for view logic)
  const [viewingCreator, setViewingCreator] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);

  return (
    <ErrorBoundary>
      <div className="min-h-screen">
        <EnhancedToaster />

        {/* Navigation */}
        {user && <Navigation />}

        {/* Routes - location.pathname is source of truth */}
        <AppRoutes />

        {/* All Modals */}
        <Modals
          user={user}
          tokenBalance={tokenBalance}
          onTokenUpdate={updateTokenBalance}
        />
      </div>
    </ErrorBoundary>
  );
};

export default App;
```

**That's it! ~200 lines instead of 1,718.**

---

## 🧪 Testing Checklist

### AuthContext
- [ ] Sign in (email/password, Google, Twitter)
- [ ] Session persists on page refresh
- [ ] Profile loads from cache immediately
- [ ] Token balance fetches correctly
- [ ] Role detection (creator/admin/fan) works
- [ ] Sign out clears everything
- [ ] No more role flip-flopping!

### DeviceContext
- [ ] isMobile detects mobile devices
- [ ] isTablet detects tablets
- [ ] Orientation changes work
- [ ] No window access errors in SSR

### ModalContext
- [ ] Opening modals works
- [ ] Closing modals works
- [ ] Props pass to modals correctly
- [ ] Multiple modals can be managed

### SocketContext
- [ ] Connects on login
- [ ] Disconnects on logout
- [ ] Call requests received
- [ ] Balance updates received
- [ ] Messages received

### AppRoutes
- [ ] All routes work
- [ ] Protected routes redirect correctly
- [ ] Role-based routing (admin/creator/fan)
- [ ] Mobile/desktop rendering correct
- [ ] No currentView state (pathname is truth)

---

## 🚨 Common Migration Issues

### Issue 1: "useAuth must be used within AuthProvider"
**Solution**: Make sure AuthProvider wraps your App component in main.jsx

### Issue 2: "Cannot read property 'isMobile' of undefined"
**Solution**: Ensure DeviceProvider wraps your App component

### Issue 3: Modals not opening
**Solution**:
1. Check that ModalProvider wraps App
2. Import MODALS constant, don't use string directly
3. Use `open(MODALS.TOKEN_PURCHASE)` not `open('tokenPurchase')`

### Issue 4: Socket not connecting
**Solution**:
1. AuthProvider must be above SocketProvider
2. User must be logged in for socket to connect

### Issue 5: Routes not working
**Solution**:
1. Remove all `currentView` state and effects
2. Use `<AppRoutes />` component
3. Navigation uses React Router's `navigate()` function

---

## 📊 Expected Results

### Before Migration
```
App.js: 1,718 lines
├── 20+ useState hooks
├── 10+ useEffect hooks
├── Mixed concerns (auth, routing, sockets, modals, device detection)
├── Duplicate logic everywhere
├── localStorage role bugs
└── Hard to test
```

### After Migration
```
App.js: ~200 lines
├── 2-3 useState hooks (minimal UI state)
├── 0 useEffect hooks (logic in contexts)
├── Single responsibility (composition only)
├── No duplicate logic
├── No localStorage bugs (single source of truth)
└── Easy to test (each context independently testable)

+ New architecture:
  ├── AuthContext (400 lines) - Testable
  ├── DeviceContext (100 lines) - Testable
  ├── ModalContext (100 lines) - Testable
  ├── SocketContext (150 lines) - Testable
  ├── AppRoutes (250 lines) - Testable
  └── Logger (150 lines) - Testable
```

**Net Result**:
- 88% reduction in App.js size
- Better architecture
- More testable
- Fewer bugs
- Easier maintenance

---

## 🎯 Success Criteria

- ✅ App.js reduced to ~200 lines
- ✅ All auth flows work (sign in, sign out, persist)
- ✅ All modals work
- ✅ All routes work
- ✅ Socket connections work
- ✅ No role flip-flopping
- ✅ No regressions in functionality
- ✅ Tests pass
- ✅ Production ready

---

## 📚 Next Steps After Migration

1. **Add Tests**:
   - Unit tests for each context
   - Integration tests for auth flows
   - E2E tests for critical paths

2. **Monitor**:
   - Watch for errors in Sentry
   - Monitor performance metrics
   - Check user feedback

3. **Iterate**:
   - Refine contexts as needed
   - Add more utilities
   - Improve type safety with TypeScript

4. **Document**:
   - Update team documentation
   - Add JSDoc comments
   - Create architecture diagrams

---

## 🆘 Need Help?

Check the following files for reference:
- `/REFACTORING_PLAN.md` - Detailed plan and rationale
- `/REFACTORING_SUMMARY.md` - Before/after comparisons
- `/src/contexts/*.jsx` - Context implementations
- `/src/routes/AppRoutes.jsx` - Route definitions
- `/src/utils/logger.js` - Logging utility

Good luck with the migration! 🚀
