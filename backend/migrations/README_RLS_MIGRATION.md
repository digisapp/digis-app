# Supabase RLS Migration - Production-Ready Guide

## Executive Summary

**Status**: 253 security issues detected by Supabase linter
**Risk Level**: 🔴 **CRITICAL** - Database exposed without Row Level Security
**Solution**: Enable RLS with proper policies on all public tables

## What's Wrong

### The Problem

Your Supabase database currently has:
- ❌ Multiple tables without RLS enabled
- ❌ Functions using SECURITY DEFINER (bypassing RLS)
- ❌ Storage buckets without access policies
- ❌ No indexes for RLS policy performance

### Why It's Critical

Without RLS:
```javascript
// Anyone can do this with your public Supabase credentials:
const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Read ALL payments, messages, KYC docs, etc.
const { data } = await supabase.from('payments').select('*')

// Modify ANY user's profile
await supabase.from('users').update({ is_creator: true }).eq('id', 123)
```

Your `SUPABASE_URL` and `SUPABASE_ANON_KEY` are in your frontend code = publicly visible.

## Migration Files (In Order)

### Phase 1: Audit & Preparation

**1. `00_audit_database.sql`** - Run this first
- Counts exact number of tables needing RLS
- Identifies SECURITY DEFINER functions (not views!)
- Lists existing policies
- Checks for missing indexes

```sql
-- In Supabase SQL Editor, run:
\i 00_audit_database.sql
```

**Expected Output:**
- Exact table count (not 249, likely ~60 base tables)
- List of functions using SECURITY DEFINER
- Current RLS status per table

### Phase 2: Foundation

**2. `01_helper_functions.sql`** - DRY reusable policy predicates
- Creates `current_user_db_id()` - maps auth.uid() to your users.id
- Creates `is_creator()` - checks if user is creator
- Creates `is_active_subscriber(creator_id)` - subscription checks
- 8+ other helper functions

**Why**: Keeps policies maintainable. Instead of duplicating complex queries, use:
```sql
USING (is_active_subscriber(creator_id))
-- vs
USING (EXISTS(SELECT 1 FROM subscriptions WHERE ...))
```

**3. `02_performance_indexes.sql`** - CRITICAL for performance
- Indexes on `users(supabase_id)` - used in every policy
- Indexes on `subscriptions(creator_id, subscriber_id)` - frequent lookups
- Indexes on `follows(follower_id, following_id)` - follower checks
- 40+ indexes total

**Why**: Without these, RLS predicates cause slow queries. A `is_active_subscriber()` check without indexes = full table scan on every row.

Uses `CREATE INDEX CONCURRENTLY` = safe for production (no table locking).

### Phase 3: Policies

**4. `03_rls_policies_part1_core.sql`** - Core tables
- **IMPORTANT**: Creates policies BEFORE enabling RLS
- Grants base permissions to `authenticated` role
- Covers: users, follows, subscriptions, conversations, messages, notifications

**Safe Order**:
1. Grant permissions (`GRANT SELECT ON table TO authenticated`)
2. Create policies (`CREATE POLICY...`)
3. Enable RLS (in separate file)

**Pattern Examples**:
- **Public Read, Private Write**: users, follows, classes
- **Own Data Only**: payments, messages, KYC docs
- **Subscription-Gated**: content_uploads (public OR owned OR subscribed)
- **Creator-Only**: analytics, fan_notes

**5. Additional Policy Files** (create as needed)
- Content & commerce tables
- Streaming & classes tables
- Analytics tables
- All remaining tables from audit

### Phase 4: Enable RLS

**6. `04_enable_rls.sql`** - The big switch
- Enables RLS on all tables
- Forces RLS even for table owners
- Verification queries

**⚠️ WARNING**: Only run after policies are created!

### Phase 5: Storage & Testing

**7. `05_storage_policies.sql`** - Storage bucket policies
- **Table RLS ≠ Storage RLS** (separate systems!)
- Policies for avatars, covers, private-content buckets
- Path structure: `{user_id}/{filename}`

**8. `06_test_rls.sql`** - Comprehensive test suite
- Simulates different user roles
- Tests expected successes and failures
- Verifies policies work correctly

## Step-by-Step Execution

### Before You Start

1. **Backup your database** (Supabase Dashboard → Database → Backups)
2. **Test on staging first** (spin up staging project from snapshot)
3. **Schedule low-traffic window** (if going straight to prod)
4. **Have rollback plan ready** (disable RLS script in 04_enable_rls.sql)

### Execution Sequence

```bash
# 1. Audit (informational only)
# Run in Supabase SQL Editor
00_audit_database.sql

# 2. Helper functions
01_helper_functions.sql

# 3. Indexes (takes time, uses CONCURRENTLY = safe)
02_performance_indexes.sql

# 4. Policies (safe, RLS not enabled yet)
03_rls_policies_part1_core.sql
# ... any additional policy files

# 5. Enable RLS (THE BIG SWITCH)
04_enable_rls.sql

# 6. Storage policies
05_storage_policies.sql

# 7. Test everything
06_test_rls.sql
```

### Supabase Dashboard Method

1. Open https://supabase.com/dashboard → Your Project
2. Click "SQL Editor" → "New query"
3. Copy/paste each file contents
4. Run sequentially
5. Check "Results" panel for errors

### psql Command Line Method

```bash
# Connect to Supabase
psql "postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres"

# Run files in order
\i 00_audit_database.sql
\i 01_helper_functions.sql
\i 02_performance_indexes.sql
\i 03_rls_policies_part1_core.sql
\i 04_enable_rls.sql
\i 05_storage_policies.sql
\i 06_test_rls.sql
```

## Testing & Validation

### Smoke Tests (06_test_rls.sql)

Replace test UUIDs with real user IDs:

```sql
-- Set as test user
SELECT set_config('request.jwt.claim.sub', 'real-uuid-here', true);

-- Should succeed
SELECT * FROM users;  -- Public read
UPDATE users SET bio = 'test' WHERE supabase_id = auth.uid();  -- Own profile

-- Should fail (0 rows affected)
UPDATE users SET bio = 'hacked' WHERE supabase_id != auth.uid();
SELECT * FROM payments WHERE user_id != current_user_db_id();
```

### Frontend/Backend Tests

1. **Fan user flow**:
   - Login, view creators, follow, subscribe
   - Access public content ✅
   - Access subscriber content (with subscription) ✅
   - Cannot access private content (without subscription) ❌

2. **Creator user flow**:
   - Login, view dashboard, check analytics
   - Upload content, manage offers
   - View subscribers, fan notes
   - Regular users cannot see creator analytics ❌

3. **Payment flow**:
   - Purchase tokens, view own transaction history ✅
   - Cannot view others' transactions ❌

### Backend Code Check

**CRITICAL**: Backend must use service role for admin operations:

```javascript
// ❌ WRONG - uses anon key, subject to RLS
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

// ✅ CORRECT - bypasses RLS for admin operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
```

**When to use Service Role**:
- Creating users (during signup)
- Admin dashboards
- Background jobs (analytics, cleanup)
- System-generated notifications

**When to use Anon/Auth**:
- Frontend (browser/mobile)
- User-initiated actions
- Any client-side code

## Common Issues & Fixes

### Issue: "new row violates row-level security policy"

**Cause**: INSERT policy `WITH CHECK` too restrictive

**Fix**: Review INSERT policy:
```sql
CREATE POLICY "name" ON table
  FOR INSERT
  WITH CHECK (user_id = current_user_db_id());  -- Check this condition
```

### Issue: Queries return empty after migration

**Cause**: SELECT policy filtering out data

**Fix**: Check USING clause:
```sql
CREATE POLICY "name" ON table
  FOR SELECT
  USING (/* This might be too restrictive */);
```

### Issue: Backend API 403 errors

**Cause**: Backend using anon key instead of service role

**Fix**: Use `SUPABASE_SERVICE_ROLE_KEY` for backend

### Issue: Slow queries after RLS

**Cause**: Missing indexes for policy predicates

**Fix**: Run `02_performance_indexes.sql` and verify:
```sql
EXPLAIN ANALYZE SELECT * FROM content_uploads WHERE visibility = 'public';
-- Should use index, not sequential scan
```

### Issue: Storage uploads failing

**Cause**: Storage policies not created

**Fix**: Run `05_storage_policies.sql` and ensure bucket path structure:
```javascript
// ✅ CORRECT
const path = `${userId}/avatar.jpg`

// ❌ WRONG
const path = `avatar.jpg`
```

## Rollback Plan

**Emergency Disable** (data exposed, but app works):

```sql
-- Disable RLS on all tables
DO $$
DECLARE
  table_record RECORD;
BEGIN
  FOR table_record IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', table_record.tablename);
  END LOOP;
END$$;
```

**⚠️ WARNING**: This exposes your database! Only use temporarily while you fix policies.

**Better Rollback**: Fix specific policy, leave RLS enabled:

```sql
-- Drop problematic policy
DROP POLICY "policy_name" ON table_name;

-- Recreate with correct logic
CREATE POLICY "policy_name" ON table_name
  FOR SELECT
  USING (/* fixed condition */);
```

## Performance Monitoring

### Check Policy Performance

```sql
-- Slow queries
SELECT
  query,
  calls,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE query LIKE '%FROM public.%'
  AND mean_time > 100  -- queries over 100ms
ORDER BY mean_time DESC
LIMIT 20;
```

### Check Index Usage

```sql
-- Unused indexes (consider dropping)
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
ORDER BY tablename;
```

### Check Missing Indexes

```sql
-- Table scans that should use indexes
SELECT
  schemaname,
  tablename,
  seq_scan,
  idx_scan,
  seq_scan / NULLIF(idx_scan, 0)::float as seq_vs_idx_ratio
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND seq_scan > 1000
  AND seq_scan > idx_scan
ORDER BY seq_scan DESC;
```

## Realtime Considerations

Supabase Realtime respects RLS automatically:

1. **Realtime replication policy** (if needed):
```sql
CREATE POLICY "realtime_replication"
  ON table_name
  FOR SELECT
  TO supabase_realtime
  USING (true);
```

2. **Users only receive updates for rows they can SELECT**
   - If user can't SELECT a row via RLS, they won't get realtime updates
   - This is good for security!

3. **Test realtime after migration**:
```javascript
const channel = supabase
  .channel('messages')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'chat_messages' },
    (payload) => console.log(payload)
  )
  .subscribe()

// Should only receive messages from own conversations
```

## Security Definer Functions

The audit found functions using `SECURITY DEFINER` (not views - that was a mistake).

**Check them:**
```sql
SELECT
  n.nspname as schema,
  p.proname as function,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public'
  AND pg_get_functiondef(p.oid) ILIKE '%SECURITY DEFINER%';
```

**Convert to SECURITY INVOKER** (respects RLS):
```sql
CREATE OR REPLACE FUNCTION function_name()
RETURNS return_type
LANGUAGE plpgsql
SECURITY INVOKER  -- Changed from DEFINER
AS $$
BEGIN
  -- function body
END;
$$;
```

**Only keep SECURITY DEFINER if**:
- Function needs elevated privileges
- You've carefully audited the security implications
- It has its own internal auth checks

## Post-Migration Checklist

- [ ] All tables have RLS enabled (check with 04_enable_rls.sql verification)
- [ ] Each table has appropriate policies (no tables with RLS but 0 policies)
- [ ] Helper functions created and working
- [ ] Performance indexes created
- [ ] Storage buckets have policies
- [ ] SECURITY DEFINER functions converted or justified
- [ ] Backend uses service role key correctly
- [ ] Frontend flows tested (fan and creator)
- [ ] Realtime still working
- [ ] Payment flows working
- [ ] No unexpected 403 errors in logs
- [ ] Query performance acceptable
- [ ] Staging tested successfully before prod

## Support Resources

- [Supabase RLS Docs](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Docs](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase Auth Helpers](https://supabase.com/docs/guides/auth/auth-helpers)
- Supabase Dashboard → Logs (detailed error messages)

## Summary

This migration moves from "database wide open" to "secure by default":

**Before**: Anyone with your public Supabase credentials can access all data
**After**: Users can only access data they're authorized to see via RLS policies

**Migration time**: ~30-60 minutes (mostly index creation)
**Risk**: Low if tested on staging first, policies created before enabling RLS
**Impact**: Fixes 253 critical security issues

Good luck! Test thoroughly and roll out carefully. 🚀
