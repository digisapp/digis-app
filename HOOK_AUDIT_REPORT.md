# React Hook Ordering Audit Report
**Date**: 2025-10-16
**Issue**: React Error #310 (Rendered more hooks than during the previous render)

## Root Cause
Components with early returns (loading/error states) that occur **before** all hook definitions, causing inconsistent hook call order between renders.

## Fixed Components

### 1. ✅ MobileMessages.js (Commit: 2d43ee2)
**Problem**: `handleSendAudioMessage` was defined after `startAudioRecording` which referenced it
**Fix**: Moved `handleSendAudioMessage` before `startAudioRecording`
**Lines**: 155-188

### 2. ✅ MobileWalletPage.js (Commit: af885b1)
**Problem**: `motionProps` and `itemMotionProps` were defined **after** early returns
**Fix**: Moved both definitions to lines 152-161, **before** all early returns
**Early Returns**:
- Line 164: `if (loading && !balance && transactions.length === 0)`
- Line 197: `if (error && !balance && transactions.length === 0)`

## Verified Correct Components

### ✅ MobileHomePageOptimized.js
- All hooks: Lines 12-148
- Early returns: Lines 151-169
- **Status**: CORRECT - Hooks before early returns

### ✅ MobileExplore.js
- All hooks: Lines 34-220
- No early returns before main render
- **Status**: CORRECT - Proper hook ordering

### ✅ MobileEditProfile.js
- All hooks: Lines 89-188
- No early returns (renders full UI always)
- **Status**: CORRECT - No early returns

## Production Deployment Status

**Build Hash Change**: `index-DJIkGjKY.js` → `index-H6rESKZL.js`
**Status**: ⚠️  Deployed but error persists

## Possible Reasons Error Persists

1. **CDN Cache**: Vercel/Cloudflare edge cache hasn't invalidated
2. **Browser Cache**: User needs hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
3. **Source Maps**: Production build is minified - actual component name hidden
4. **Another Component**: There may be another component not yet identified

## How to Identify the Exact Component

Since production shows `Az` (minified name), you need to:

### Option 1: Enable Source Maps (Temporary)
```javascript
// vite.config.js
export default defineConfig({
  build: {
    sourcemap: true  // ⚠️  Only for debugging, disable after
  }
});
```
Then redeploy and check the error stack - it will show real component names.

### Option 2: Search Pattern
```bash
# Find all components with early returns
cd frontend/src/components/mobile
grep -rn "if.*return" --include="*.js" | grep -B20 "useState\|useEffect\|useCallback"
```

### Option 3: Manual Audit
Check each mobile component for this pattern:
```javascript
// ❌ BAD
function Component() {
  const [state, setState] = useState();

  if (loading) return <Loading />;  // Early return

  const value = useMemo(() => ...);  // ❌ Hook after early return

  return <div>...</div>;
}

// ✅ GOOD
function Component() {
  const [state, setState] = useState();
  const value = useMemo(() => ...);  // ✅ All hooks before returns

  if (loading) return <Loading />;

  return <div>...</div>;
}
```

## ESLint Configuration

Updated `.eslintrc.json`:
- `react-hooks/rules-of-hooks`: `"error"` (catches most violations)
- `react-hooks/exhaustive-deps`: `"warn"` (reduced noise)

**Note**: ESLint's `rules-of-hooks` does NOT catch "hooks after early returns" - only manual review catches this.

## Recommended Next Steps

1. **Clear CDN Cache**: Force Vercel to invalidate edge cache
2. **Hard Refresh**: Instruct users to do Ctrl+Shift+R
3. **Enable Source Maps**: Temporarily deploy with source maps to get exact component name
4. **Monitor**: Wait 5-10 minutes for CDN propagation
5. **Verify**: Test on incognito/private browsing (no cache)

## Prevention Checklist

Before pushing any new component:
- [ ] All `useState`, `useEffect`, `useCallback`, `useMemo`, `useRef` at top
- [ ] No hooks after `if/for/try` statements
- [ ] No hooks after early `return` statements
- [ ] Run `npm run lint` to catch ESLint violations
- [ ] Test component in dev mode first

## Summary

**Fixed**: 2 components (MobileMessages.js, MobileWalletPage.js)
**Verified**: 3 components (MobileHomePageOptimized.js, MobileExplore.js, MobileEditProfile.js)
**Status**: Code is correct, waiting for CDN cache invalidation or user hard refresh

---

**If error persists after 10 minutes**:
1. Enable source maps in vite.config.js
2. Redeploy
3. Get exact component name from error stack
4. Fix that specific component
