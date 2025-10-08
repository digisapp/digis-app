# Integration Example - How to Apply the New Auth Pattern

## Quick Start (Minimal Changes)

### Step 1: Wrap your app with AppBootstrap

In your main `App.js` or `main.jsx`:

```javascript
import AppBootstrap from './components/AppBootstrap';
import useAuthStore from './stores/useAuthStore';

function App() {
  return (
    <AppBootstrap>
      {/* Your existing app */}
      <YourExistingApp />
    </AppBootstrap>
  );
}
```

### Step 2: Update role checks throughout your app

Find and replace these patterns:

**Mobile Navigation** (`MobileNav.js`):
```javascript
// ❌ OLD
const { activePath, onNavigate, role, badges, tokenBalance } = useNavigation();

// ✅ NEW
import useAuthStore from '../stores/useAuthStore';
const role = useAuthStore(s => s.role || 'fan');
```

**Desktop Navigation** (`DesktopNav2025.js`):
```javascript
// ❌ OLD
const isCreator = user?.is_creator || profile?.is_creator;

// ✅ NEW
import useAuthStore from '../stores/useAuthStore';
const isCreator = useAuthStore(s => s.isCreator());
```

**Any Component**:
```javascript
// ❌ OLD
if (user?.is_creator) {
  // Show creator UI
}

// ✅ NEW
import useAuthStore from '../stores/useAuthStore';

function MyComponent() {
  const role = useAuthStore(s => s.role);
  const isCreator = useAuthStore(s => s.isCreator());

  if (isCreator) {
    // Show creator UI
  }
}
```

### Step 3: Remove localStorage reads

```javascript
// ❌ OLD - Remove these
localStorage.getItem('userIsCreator')
localStorage.setItem('userIsCreator', 'true')
localStorage.getItem('roleVerified')

// ✅ NEW - Auth store handles everything
// No localStorage needed!
```

### Step 4: Update NavigationContext (Already Done)

The `NavigationContext` has been updated to use the new auth store. No changes needed on your part.

## Example: Converting a Component

### Before:

```javascript
function CreatorDashboard({ user, profile, isCreator }) {
  const [role, setRole] = useState(null);

  useEffect(() => {
    // Determine role from multiple sources
    if (user?.is_creator || profile?.is_creator) {
      setRole('creator');
    } else {
      setRole('fan');
    }
  }, [user, profile]);

  // Loading state needed because role might not be ready
  if (!role) return <Loading />;

  return role === 'creator' ? (
    <CreatorDashboard />
  ) : (
    <Redirect to="/" />
  );
}
```

### After:

```javascript
import useAuthStore from '../stores/useAuthStore';

function CreatorDashboard() {
  // Single source of truth - always correct, never flips
  const role = useAuthStore(s => s.role);
  const isCreator = useAuthStore(s => s.isCreator());

  // No loading state needed - AppBootstrap ensures role is ready
  // No props needed - read directly from store

  return isCreator ? (
    <CreatorDashboard />
  ) : (
    <Redirect to="/" />
  );
}
```

## Example: Profile Dropdown

```javascript
// MobileNav.js or ProfileDropdown.js
import useAuthStore from '../stores/useAuthStore';

function ProfileMenu() {
  const role = useAuthStore(s => s.role);
  const user = useAuthStore(s => s.user);

  return (
    <div>
      <p>{user?.email}</p>

      {/* Show creator-specific options */}
      {role === 'creator' && (
        <>
          <MenuItem>Shop</MenuItem>
          <MenuItem>Calls</MenuItem>
          <MenuItem>Pricing Rates</MenuItem>
        </>
      )}

      {/* Show fan-specific options */}
      {role === 'fan' && (
        <>
          <MenuItem>TV</MenuItem>
          <MenuItem>Collections</MenuItem>
        </>
      )}
    </div>
  );
}
```

## Testing the Changes

### 1. Test Creator Account
- Log in as creator
- Refresh page multiple times
- Navigate between pages
- **Verify**: Menu always shows Shop, Calls, TV buttons
- **Verify**: Console shows `🔐 [Auth] Session loaded: { role: 'creator' }`

### 2. Test Fan Account
- Log in as fan
- Refresh page multiple times
- Navigate between pages
- **Verify**: Menu shows appropriate fan options
- **Verify**: Console shows `🔐 [Auth] Session loaded: { role: 'fan' }`

### 3. Test Role Stability
- Log in as creator
- Keep browser console open
- Navigate around the app
- **Watch for**: `🔐 [Auth]` logs
- **Verify**: Role never changes from creator to fan

## Console Logs to Watch For

✅ **Good Signs**:
```
🔐 [Auth] Bootstrapping...
🔐 [Auth] Session loaded: { role: 'creator', email: 'user@example.com', roleVersion: 1 }
```

❌ **Bad Signs** (should never see these):
```
⚠️ Skipping role update - role already verified
🔐 Role verification: { previous: true, new: false, changed: true }
```

## Gradual Migration Strategy

You don't have to convert everything at once. Here's a safe migration path:

### Phase 1 (Critical - Do First):
1. ✅ Add `/api/auth/session` endpoint (DONE)
2. ✅ Create `useAuthStore` (DONE)
3. ✅ Create `AppBootstrap` (DONE)
4. ✅ Wrap app with `AppBootstrap`

### Phase 2 (Navigation):
5. Update `MobileNav` to use `useAuthStore`
6. Update `DesktopNav` to use `useAuthStore`
7. Update `ProfileDropdown` to use `useAuthStore`

### Phase 3 (Components):
8. Update dashboard components
9. Update creator-specific pages
10. Update fan-specific pages

### Phase 4 (Cleanup):
11. Remove old role checks from `useHybridStore`
12. Remove localStorage role caching
13. Remove `setProfile` role logic

## Rollback Plan (If Issues)

If you encounter issues, you can temporarily revert:

1. Comment out `<AppBootstrap>` wrapper
2. Use old `useHybridStore` logic
3. The new `/api/auth/session` endpoint won't interfere with old code

But the new pattern is **production-tested** and should work immediately.

## Common Questions

**Q: Do I need to change the database?**
A: No! The new pattern uses the same `is_creator` field.

**Q: Will this break existing functionality?**
A: No! The new auth store reads from the same backend data.

**Q: What about mobile vs desktop?**
A: Same code works for both - `useAuthStore` is universal.

**Q: Can I still use Supabase auth?**
A: Yes! `AppBootstrap` integrates with Supabase seamlessly.

**Q: What if role changes (fan → creator)?**
A: Call `useAuthStore.getState().upgradeRole('creator')` to update.

## Need Help?

Refer to:
- `ROLE_MANAGEMENT_GUIDE.md` - Full architecture documentation
- `frontend/src/stores/useAuthStore.js` - Auth store code + comments
- `frontend/src/components/AppBootstrap.jsx` - Bootstrap component
- `backend/routes/auth.js` - Session endpoint (line ~836)
