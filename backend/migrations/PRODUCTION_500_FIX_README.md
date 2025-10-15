# Production 500 Error Fix - RLS Migration Issue

## Problem Summary

After enabling Row Level Security (RLS) on all tables, the production backend on Vercel started returning 500 errors on endpoints like:
- `/api/auth/sync-user`
- `/api/users/creators`

## Root Cause Analysis

### The Backend Connection Method

The backend uses a **regular PostgreSQL connection pool** (not Supabase client):

```javascript
// backend/utils/db.js
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ...
});

module.exports = { pool, query: executeQuery };
```

```javascript
// backend/routes/users.js
const { pool } = require('../utils/db');

router.get('/creators', async (req, res) => {
  // This connection RESPECTS RLS policies!
  const result = await pool.query('SELECT * FROM users WHERE is_creator = TRUE');
});
```

### The Issue

1. **Regular PostgreSQL connections RESPECT RLS policies** (they don't bypass them)
2. **RLS policies use `auth.uid()`** which returns the current Supabase authenticated user's UUID
3. **`auth.uid()` returns NULL for PostgreSQL pool connections** (it only works with Supabase client connections)
4. **When `auth.uid()` is NULL, all policies fail** → queries are blocked → 500 errors

### Example Failing Policy

```sql
-- This policy exists on the users table
CREATE POLICY "Users can view public creator profiles" ON users
  FOR SELECT TO authenticated
  USING (is_creator = true OR auth.uid() = supabase_id);
```

When the backend queries via `pool.query()`:
- `auth.uid()` returns NULL (no Supabase auth context)
- The policy evaluates to: `USING (is_creator = true OR NULL = supabase_id)`
- This fails, blocking the query
- Backend returns 500 error

## The Solution

Grant the PostgreSQL role used by the backend the ability to **bypass RLS entirely**.

### Why This Is Safe

1. **The backend IS the service layer** - it should have full database access
2. **The backend handles all authorization logic** in application code
3. **Frontend connections still respect RLS** (they use `SUPABASE_ANON_KEY`)
4. **This matches the intended security model**:
   - Frontend = restricted by RLS
   - Backend = unrestricted admin access

### Run This Migration

**File**: `FIX_BACKEND_RLS_BYPASS.sql`

**In Supabase SQL Editor**, run:

```sql
-- Grant BYPASSRLS to the postgres role
ALTER ROLE postgres BYPASSRLS;

-- Verify it worked
SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'postgres';
```

**Expected Output**:
```
 rolname  | rolbypassrls
----------+--------------
 postgres | t
```

## After Running the Fix

### What Changes

✅ **Backend queries via `DATABASE_URL` will bypass RLS**
- All routes in `backend/routes/*.js` will work
- No more 500 errors on `/api/users/creators`, `/api/auth/sync-user`, etc.

✅ **Backend queries via `SUPABASE_SERVICE_ROLE_KEY` will bypass RLS** (already did)
- If you switch to using Supabase admin client, it will also work

✅ **Frontend queries via `SUPABASE_ANON_KEY` will STILL respect RLS**
- Direct database access from frontend is still protected
- Users can only access data allowed by policies

### Testing Checklist

After running the migration:

1. **Check Vercel Production Logs**
   - Go to Vercel Dashboard → Your Project → Logs
   - Look for 500 errors to disappear
   - Verify successful database queries

2. **Test Critical Endpoints**
   ```bash
   # Test creators endpoint
   curl https://your-backend.vercel.app/api/users/creators?page=1&limit=20

   # Test auth sync
   curl https://your-backend.vercel.app/api/auth/sync-user \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. **Monitor for 24 Hours**
   - Watch for any new RLS-related errors
   - Verify all user flows work correctly
   - Check that frontend respects RLS (users can't access unauthorized data)

## Alternative Solutions (If BYPASSRLS Doesn't Work)

### Option 1: Modify Policies to Allow Service Role

Add this to every table's policy:

```sql
CREATE POLICY "Backend service role access" ON users
  FOR ALL TO authenticated
  USING (
    -- Allow if using service role
    current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
    OR
    -- Or normal authenticated access
    auth.uid() IS NOT NULL
  );
```

**Downside**: Must update all 67 tables' policies.

### Option 2: Switch to Supabase Admin Client

Modify `backend/routes/*.js` to use Supabase admin client instead of `pool`:

```javascript
// Instead of:
const { pool } = require('../utils/db');
const result = await pool.query('SELECT * FROM users');

// Use:
const { supabaseAdmin } = require('../utils/supabase-admin-v2');
const { data, error } = await supabaseAdmin.from('users').select('*');
```

**Downside**: Requires rewriting all database queries in the backend.

### Option 3: Create a Dedicated Backend Role

```sql
-- Create a role specifically for the backend
CREATE ROLE backend_service BYPASSRLS LOGIN PASSWORD 'secure_password';
GRANT ALL ON ALL TABLES IN SCHEMA public TO backend_service;

-- Update DATABASE_URL to use this role
-- DATABASE_URL=postgresql://backend_service:secure_password@host:port/db
```

**Downside**: More complex setup, requires changing DATABASE_URL.

## Recommended Solution

**Use the BYPASSRLS approach** (`FIX_BACKEND_RLS_BYPASS.sql`) because:
- ✅ One-line fix
- ✅ No code changes required
- ✅ Matches Supabase's intended security model
- ✅ Backend already uses `SUPABASE_SERVICE_ROLE_KEY` for admin operations
- ✅ Frontend remains protected by RLS

## Verification

After running the fix, verify with these SQL queries:

```sql
-- Check that postgres role has BYPASSRLS
SELECT rolname, rolbypassrls, rolsuper
FROM pg_roles
WHERE rolname = 'postgres';

-- Test a query that was failing (run this as the postgres role)
SELECT COUNT(*) FROM users WHERE is_creator = true;

-- Verify RLS is still enabled on tables
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true;
```

## Timeline

- **2025-10-15 13:00** - RLS migration completed (253 errors → 0 errors)
- **2025-10-15 13:30** - Production 500 errors reported on Vercel
- **2025-10-15 14:00** - Root cause identified (pool respects RLS, auth.uid() returns NULL)
- **2025-10-15 14:15** - Solution created (`FIX_BACKEND_RLS_BYPASS.sql`)
- **2025-10-15 [PENDING]** - User to run fix in Supabase SQL Editor

## Status

⚠️ **CRITICAL FIX REQUIRED** - Production is currently broken

**Next Step**: Run `FIX_BACKEND_RLS_BYPASS.sql` in Supabase SQL Editor immediately.

---

**Created**: 2025-10-15
**Status**: Awaiting deployment
**Priority**: CRITICAL
**Estimated Fix Time**: 1 minute (single SQL command)
