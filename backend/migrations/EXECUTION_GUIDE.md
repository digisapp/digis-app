# RLS Migration - Execution Guide

## Overview

This guide walks you through enabling Row Level Security (RLS) on your Supabase database with minimal risk.

**Time Required**: 1-2 hours (including testing)
**Risk Level**: Low (if you follow the staged approach)
**Impact**: Fixes 253 security issues

## Pre-Migration Checklist

### 1. Backup Everything

```bash
# Supabase Dashboard:
# Settings → Database → Backups → Create Backup
```

### 2. Verify Backend Configuration

Check `/backend/.env`:
```bash
✅ SUPABASE_URL=https://your-project.supabase.co
✅ SUPABASE_ANON_KEY=eyJ...  (for frontend/client)
✅ SUPABASE_SERVICE_ROLE_KEY=eyJ...  (for backend/admin)
```

**Critical**: Backend code must use `SUPABASE_SERVICE_ROLE_KEY`:

```javascript
// backend/server.js or similar
const { createClient } = require('@supabase/supabase-js')

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // ✅ Service role bypasses RLS
)
```

### 3. Test Environment Ready

**Option A: Staging Project** (Recommended)
```bash
# Supabase Dashboard:
# 1. Go to your production project
# 2. Click "..." → "Clone Project" or create snapshot
# 3. Restore snapshot to new staging project
# 4. Run migration on staging first
```

**Option B: Test on Production** (Higher risk)
```bash
# Only if you can't create staging
# Ensure you have:
# - Recent backup
# - Low-traffic time window
# - Team ready for rollback
```

## Execution Sequence

### Phase 1: Pre-Flight (5 minutes)

**File**: `00_preflight_checklist.sql`

```bash
# In Supabase SQL Editor:
# 1. Open your project
# 2. Click "SQL Editor" → "New query"
# 3. Copy/paste 00_preflight_checklist.sql
# 4. Run
```

**Expected Output**:
```
✅ PASS - All users have supabase_id
✅ PASS - Helper functions (8 found)
✅ PASS - RLS-critical indexes (25 found)
✅ PASS - Policies exist for 14 tables
✅ READY FOR RLS MIGRATION
```

**If you see ❌ FAIL**:
- Fix the issue before proceeding
- Common fix: Run the missing migration file
- Example: "❌ FAIL - Run 01_helper_functions.sql first"

### Phase 2: Foundation (10 minutes)

#### Step 1: Helper Functions

**File**: `01_helper_functions.sql`

```sql
-- Creates reusable policy predicates:
-- - current_user_db_id()
-- - is_owner(uuid)
-- - is_creator()
-- - is_active_subscriber(creator_id)
-- - 7+ more functions
```

**Verification**:
```sql
SELECT current_user_db_id();  -- Should work without error
SELECT is_creator();  -- Should return true/false
```

#### Step 2: Performance Indexes

**File**: `02_performance_indexes.sql`

```sql
-- Creates 40+ indexes
-- Uses CONCURRENTLY (safe for production, no locks)
-- Takes longest (5-15 minutes)
```

**Monitor Progress**:
```sql
-- Check index creation status
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename;
```

**⏰ WAIT**: Let indexes finish before proceeding!

### Phase 3: Policies (5 minutes)

#### Step 3: Core Table Policies

**File**: `03_rls_policies_part1_core.sql`

```sql
-- Creates policies for:
-- - users, blocked_users
-- - follows, subscriptions
-- - conversations, chat_messages
-- - notifications
-- - 6+ more tables

-- IMPORTANT: RLS still DISABLED at this point
-- Safe to create policies before enabling
```

**Verification**:
```sql
SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Should see policies for core tables
```

### Phase 4: Staged RLS Enablement (30 minutes)

**File**: `04a_enable_rls_staged.sql` (Recommended)
*OR*
**File**: `04_enable_rls.sql` (All at once - higher risk)

#### Using Staged Approach (Safer):

**Stage 1: Crown Jewels** (Identity & Auth)
```sql
-- Uncomment and run Stage 1 section
-- Enables RLS on:
-- - users, blocked_users
-- - follows, subscriptions
-- - conversations, messages
-- - notifications
```

**🧪 TEST STAGE 1**:
```bash
# Test these flows:
✅ Login (fan and creator)
✅ View profiles
✅ Update own profile
✅ Follow/unfollow
✅ Subscribe
✅ Send/receive messages
✅ View notifications

❌ Verify CANNOT:
   - Update other users' profiles
   - See others' messages
   - See others' subscriptions
```

**If Stage 1 fails**:
```sql
-- Rollback Stage 1 only:
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows DISABLE ROW LEVEL SECURITY;
-- ... etc

-- Fix policies, then try again
```

**Stage 2: Financial** (After Stage 1 passes)
```sql
-- Uncomment and run Stage 2
-- Enables RLS on:
-- - payments, token_transactions
-- - tips, purchases
-- - kyc_verifications, tax_documents
```

**🧪 TEST STAGE 2**:
```bash
✅ Purchase tokens
✅ View transaction history
✅ Send/receive tips
❌ Verify CANNOT see others' transactions
```

**Stage 3-6**: Continue similarly
- Test between each stage
- Fix issues before proceeding
- Can combine Stages 4-6 if confident

### Phase 5: Storage Security (5 minutes)

**File**: `05_storage_policies.sql`

```sql
-- Creates policies for Storage buckets:
-- - avatars (public read, private write)
-- - covers (public read, private write)
-- - private-content (private read/write)
```

**IMPORTANT**: Verify bucket names match yours!

```sql
-- Check your buckets:
SELECT id, name, public FROM storage.buckets;

-- If bucket names differ, update policy file
```

**🧪 TEST STORAGE**:
```bash
✅ Upload avatar (as authenticated user)
✅ View avatar publicly (as anonymous)
✅ Upload to correct path: {user_id}/filename.jpg
❌ Verify CANNOT upload to others' paths
```

### Phase 6: Testing (15 minutes)

**File**: `06_test_rls.sql`

```sql
-- Comprehensive test suite
-- Replace UUIDs with real user IDs first
```

**Setup**:
```sql
-- Get real user ID
SELECT id, email FROM auth.users LIMIT 5;

-- Copy UUID and replace in test file:
SELECT set_config('request.jwt.claim.sub', 'PASTE-UUID-HERE', true);
```

**Run Tests**:
```sql
-- Run each section of 06_test_rls.sql
-- Verify expected results:
-- ✅ Should succeed
-- ❌ Should fail (0 rows)
```

## Post-Migration

### 1. Monitor Logs (24-48 hours)

```bash
# Supabase Dashboard → Logs

# Watch for:
🔍 RLS policy violations
🔍 Unexpected 403 errors
🔍 Slow queries (> 1000ms)
```

### 2. User Acceptance Testing

**Fan Flow**:
```bash
1. Browse creators
2. Follow creator
3. Subscribe to creator
4. Access subscriber content
5. Send message
6. Purchase tokens
7. View transaction history
```

**Creator Flow**:
```bash
1. Login as creator
2. View dashboard/analytics
3. Upload content
4. Manage offers
5. View subscribers
6. Check earnings
```

### 3. Performance Monitoring

```sql
-- Check slow queries
SELECT
  query,
  calls,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE query LIKE '%FROM public.%'
  AND mean_time > 100
ORDER BY mean_time DESC
LIMIT 20;

-- Check index usage
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

## Troubleshooting

### Issue: "new row violates row-level security policy"

**Symptom**: INSERT/UPDATE fails with RLS error

**Diagnosis**:
```sql
-- Check INSERT policy
SELECT policyname, qual, with_check
FROM pg_policies
WHERE tablename = 'your_table'
  AND cmd = 'INSERT';
```

**Fix**: Adjust `WITH CHECK` condition in policy

### Issue: Queries return empty

**Symptom**: Data exists but queries return 0 rows

**Diagnosis**:
```sql
-- Check SELECT policy
SELECT policyname, qual
FROM pg_policies
WHERE tablename = 'your_table'
  AND cmd = 'SELECT';
```

**Fix**: Loosen `USING` clause in SELECT policy

### Issue: Backend 403 errors

**Symptom**: Backend API calls fail with 403

**Diagnosis**: Backend using anon key instead of service role

**Fix**:
```javascript
// Change from:
const supabase = createClient(URL, ANON_KEY)

// To:
const supabase = createClient(URL, SERVICE_ROLE_KEY)
```

### Issue: Slow queries

**Symptom**: Queries timeout or take > 1 second

**Diagnosis**: Missing indexes

**Fix**:
```sql
-- Check if index exists
EXPLAIN ANALYZE SELECT * FROM table WHERE user_id = 123;

-- If "Seq Scan" appears, add index:
CREATE INDEX CONCURRENTLY idx_table_user_id ON table(user_id);
```

### Issue: Realtime stops working

**Symptom**: No realtime events after RLS

**Diagnosis**: User can't SELECT rows, so no events

**Fix**: Check SELECT policy allows user to see rows:
```sql
CREATE POLICY "realtime_read"
  ON table_name
  FOR SELECT
  TO authenticated
  USING (/* condition that allows access */);
```

## Rollback Plans

### Full Rollback (Emergency Only)

```sql
-- Disable ALL RLS (exposes data!)
DO $$
DECLARE
  table_record RECORD;
BEGIN
  FOR table_record IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', table_record.tablename);
  END LOOP;
END$$;
```

⚠️ **Only use if app is completely broken**
⚠️ **Your data is now exposed - fix policies ASAP**

### Partial Rollback (Recommended)

```sql
-- Disable RLS on specific problematic table only
ALTER TABLE public.problematic_table DISABLE ROW LEVEL SECURITY;

-- Fix policy
DROP POLICY "bad_policy" ON public.problematic_table;
CREATE POLICY "fixed_policy" ON public.problematic_table
  FOR SELECT
  USING (/* corrected condition */);

-- Re-enable RLS
ALTER TABLE public.problematic_table ENABLE ROW LEVEL SECURITY;
```

## Success Criteria

✅ Migration successful if:

1. **All tests pass** (`06_test_rls.sql`)
2. **No unexpected 403 errors** in logs
3. **User flows work**:
   - Fan can browse, follow, subscribe, purchase
   - Creator can upload, manage, view analytics
   - Payments process correctly
4. **Performance acceptable**:
   - Queries < 500ms average
   - No timeout errors
5. **Security verified**:
   - Users can't see others' private data
   - Subscription gates work
   - Creator-only features protected

## Timeline

**Staging Test** (Day 1):
- Morning: Run migration (1-2 hours)
- Afternoon: Test all flows (2-3 hours)
- Evening: Monitor logs

**Production** (Day 2-3):
- If staging green, schedule prod window
- Low-traffic time (2-4 AM)
- Run migration (1-2 hours)
- Monitor closely for 24-48 hours

## Support

**Documentation**:
- `README_RLS_MIGRATION.md` - Full details
- `QUICK_START.md` - TL;DR version
- Individual SQL files - Inline comments

**Supabase Resources**:
- Dashboard → Logs (detailed errors)
- Dashboard → Database → Policies (view policies)
- [Supabase RLS Docs](https://supabase.com/docs/guides/auth/row-level-security)

**Debugging**:
```sql
-- Check RLS status
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Check policies
SELECT * FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;

-- Test as user
SELECT set_config('request.jwt.claim.sub', 'user-uuid', true);
SELECT * FROM your_table;  -- See what this user can access
```

## Final Notes

- **Test on staging first** - Can't emphasize enough
- **Staged rollout** - Don't enable all tables at once
- **Service role for backend** - Critical for admin operations
- **Monitor logs** - Catch issues early
- **Have rollback ready** - But hopefully won't need it

Good luck! 🚀

**Estimated Total Time**:
- Staging: 3-4 hours (migration + testing)
- Production: 1-2 hours (migration) + 24-48 hours (monitoring)
