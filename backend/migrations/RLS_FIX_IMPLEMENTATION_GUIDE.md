# RLS Fix Implementation Guide

## Problem Recap

After enabling RLS, production backend returned 500 errors because:
1. Backend uses regular PostgreSQL `pool` connections (not Supabase client)
2. Regular PG connections have no `auth.uid()` context → returns NULL
3. RLS policies using `auth.uid()` fail when NULL → queries blocked

## ❌ WRONG Solution (Don't Use)

~~`ALTER ROLE postgres BYPASSRLS;`~~

**Why this is dangerous:**
- Completely disables RLS for that role
- If credentials leak, entire database is exposed
- Not Supabase's intended security model

## ✅ CORRECT Solution

Set JWT claims in PostgreSQL session before each request:

```javascript
await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
  JSON.stringify({ sub: supabaseId, role: 'authenticated' })
]);
```

This makes `auth.uid()` work in RLS policies.

## Implementation Status

### ✅ Completed

1. **Created JWT Middleware** (`middleware/pg-with-jwt.js`)
   - Sets JWT context for each request
   - Provides dedicated `req.pg` client per request
   - Manages transactions automatically

2. **Updated Authentication Middleware** (`middleware/auth.js`)
   - `authenticateToken` now wraps `verifySupabaseToken` + `withPgAndJwt`
   - Every authenticated route now gets `req.pg` with JWT context set

### ⚠️ IN PROGRESS - Routes Need Updating

**Current Issue**: Routes still use `pool.query()` instead of `req.pg`

**Example (WRONG)**:
```javascript
router.get('/creators', authenticateToken, async (req, res) => {
  // ❌ This uses a different client without JWT context
  const result = await pool.query('SELECT * FROM users WHERE is_creator = TRUE');
  res.json({ creators: result.rows });
});
```

**Fixed Version (CORRECT)**:
```javascript
router.get('/creators', authenticateToken, async (req, res) => {
  try {
    // ✅ This uses the dedicated client with JWT context
    const result = await req.pg.query('SELECT * FROM users WHERE is_creator = TRUE');
    await req.pg.query('COMMIT');
    res.json({ creators: result.rows });
  } catch (error) {
    await req.pg.query('ROLLBACK');
    throw error;
  }
});
```

## Routes That Need Updating

### Critical (Failing in Production)

1. **`routes/users.js`**
   - `/creators` - GET (line ~823)
   - All other routes using `pool.query()`

2. **`routes/auth.js`**
   - `/sync-user` - POST
   - All other routes using `pool.query()`

### All Files Using `pool.query()`

Run this to find all occurrences:
```bash
cd backend
grep -r "pool.query" routes/ | wc -l
```

## Migration Steps

### Option 1: Update Routes Individually (Recommended for Testing)

1. Pick one failing route (e.g., `/api/users/creators`)
2. Replace `pool.query(...)` with `req.pg.query(...)`
3. Add transaction management (`COMMIT`/`ROLLBACK`)
4. Test locally
5. Deploy to production
6. Repeat for other routes

### Option 2: Global Pool Wrapper (Faster but Riskier)

Wrap `pool.query()` to automatically use `req.pg` if available:

```javascript
// In utils/db.js
const originalQuery = pool.query.bind(pool);

pool.query = function(text, params) {
  // Check if we're in a request context with req.pg
  const asyncLocalStorage = require('async_hooks').AsyncLocalStorage;
  const store = asyncLocalStorage.getStore();

  if (store && store.pg) {
    // Use the request's dedicated client with JWT context
    return store.pg.query(text, params);
  }

  // Fallback to regular pool (for non-request contexts)
  return originalQuery(text, params);
};
```

This is complex and requires AsyncLocalStorage setup - not recommended unless you have hundreds of routes to update.

### Option 3: Use Helper Function (Middle Ground)

Create a query helper in each route file:

```javascript
// At top of route file
const db = (req) => req.pg || pool;

// In route handlers
router.get('/creators', authenticateToken, async (req, res) => {
  const result = await db(req).query('SELECT ...');
  // ...
});
```

This allows gradual migration and fallback to `pool` for routes without auth.

## Testing Checklist

### Local Testing
- [ ] Start dev server: `npm run dev`
- [ ] Test `/api/users/creators` endpoint
- [ ] Verify no errors in console
- [ ] Check that queries return data

### Production Testing
- [ ] Deploy to Vercel
- [ ] Monitor logs for 500 errors
- [ ] Test critical endpoints:
  - `/api/users/creators`
  - `/api/auth/sync-user`
- [ ] Verify RLS is working (users can't access unauthorized data)

## Rollback Plan

If issues occur in production:

1. **Immediate**: Revert the `authenticateToken` wrapper
   ```javascript
   // In middleware/auth.js
   const authenticateToken = verifySupabaseToken; // Back to simple version
   ```

2. **Deploy** the revert immediately

3. **Investigate** which routes are incompatible

4. **Fix** those routes specifically

## Files Changed

### New Files
- ✅ `middleware/pg-with-jwt.js` - JWT context middleware
- ✅ `migrations/RLS_FIX_IMPLEMENTATION_GUIDE.md` - This file
- ❌ `migrations/FIX_BACKEND_RLS_BYPASS.sql` - DELETE THIS (wrong approach)
- ❌ `migrations/FIX_BACKEND_RLS_BYPASS_ALTERNATIVE.sql` - DELETE THIS
- ❌ `migrations/FIX_BACKEND_RLS_BYPASS_SIMPLE.sql` - DELETE THIS
- ❌ `migrations/PRODUCTION_500_FIX_README.md` - DELETE THIS (outdated)

### Modified Files
- ✅ `middleware/auth.js` - Wrapped `authenticateToken` with JWT middleware
- ✅ `api/index.js` - Loaded JWT middleware

### Files That Need Modification
- ⚠️  `routes/users.js` - Replace all `pool.query()` with `req.pg.query()`
- ⚠️  `routes/auth.js` - Replace all `pool.query()` with `req.pg.query()`
- ⚠️  `routes/*.js` - Update all other route files

## Next Steps

1. **Test Current Implementation**
   - Verify middleware loads without errors ✅
   - Test that `req.pg` is available in routes
   - Check JWT context is set correctly

2. **Update One Critical Route**
   - Start with `/api/users/creators`
   - Replace `pool.query()` with `req.pg.query()`
   - Add proper transaction management
   - Test locally

3. **Deploy and Monitor**
   - Deploy to Vercel
   - Monitor for 24 hours
   - Check error rates

4. **Gradually Update Remaining Routes**
   - Update routes in batches
   - Test after each batch
   - Monitor production

## Support

If you encounter issues:

1. Check logs for specific error messages
2. Verify `req.pg` exists in the route handler
3. Ensure `authenticateToken` is applied to the route
4. Check that transaction is committed/rolled back

## Timeline

- ✅ **2025-10-15 14:00** - Identified root cause
- ✅ **2025-10-15 18:00** - Created JWT middleware
- ✅ **2025-10-15 18:50** - Integrated middleware with auth
- ⏳ **2025-10-15 19:00** - Update critical routes
- ⏳ **2025-10-15 20:00** - Deploy and test
- ⏳ **2025-10-16** - Complete remaining routes

---

**Created**: 2025-10-15
**Status**: In Progress
**Priority**: CRITICAL
