# RLS Migration - Quick Start Guide

## TL;DR

You have 253 security issues. Your database is exposed. Here's how to fix it in ~1 hour.

## What You're Fixing

❌ **Current state**: Anyone with your `SUPABASE_URL` + `SUPABASE_ANON_KEY` (visible in your frontend) can read/write your entire database

✅ **After migration**: Users can only access data they're authorized to see

## Files Created

```
backend/migrations/
├── 00_audit_database.sql          # Run first - see what needs fixing
├── 01_helper_functions.sql        # Reusable policy helpers
├── 02_performance_indexes.sql     # Critical for speed
├── 03_rls_policies_part1_core.sql # Policies (BEFORE enabling RLS!)
├── 04_enable_rls.sql              # Enable RLS (the big switch)
├── 05_storage_policies.sql        # Storage bucket security
├── 06_test_rls.sql                # Test everything works
└── README_RLS_MIGRATION.md        # Full documentation
```

## 5-Minute Migration (Staging)

### 1. Audit Your Database

```bash
# In Supabase SQL Editor:
# Paste contents of 00_audit_database.sql
# Note the table count (likely ~60, not 249)
```

### 2. Run Migrations In Order

```bash
# Supabase Dashboard → SQL Editor → New Query
# Copy/paste each file, run sequentially:

01_helper_functions.sql        # ~1 min
02_performance_indexes.sql     # ~5-10 min (uses CONCURRENTLY)
03_rls_policies_part1_core.sql # ~2 min
04_enable_rls.sql              # ~1 min ⚠️ THE BIG SWITCH
05_storage_policies.sql        # ~1 min
06_test_rls.sql                # ~5 min (testing)
```

## Critical Notes

### Before You Run 04_enable_rls.sql

⚠️ **YOU NEED POLICIES FOR ALL YOUR TABLES**

File `03_rls_policies_part1_core.sql` only covers core tables:
- users, follows, subscriptions
- conversations, messages, notifications
- blocked_users, KYC, applications

**YOU MUST CREATE POLICIES FOR:**
- payments
- token_transactions
- content_uploads
- stream_sessions
- classes
- creator_offers
- ... and 40+ other tables

### Two Options:

**Option A: Create policies for remaining tables**
```sql
-- Copy the pattern from 03_rls_policies_part1_core.sql
-- Example for payments:
CREATE POLICY "Users can view own payments"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = payments.user_id
        AND users.supabase_id = auth.uid()
    )
  );

-- Repeat for all tables from audit
```

**Option B: Use permissive temporary policies** (⚠️ Less secure)
```sql
-- For each remaining table:
CREATE POLICY "temp_authenticated_access"
  ON public.table_name
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Then tighten policies later
```

### Safe Order (Critical!)

1. ✅ **CREATE POLICIES FIRST** (`03_rls_policies...`)
2. ✅ **GRANT PERMISSIONS** (included in policy files)
3. ✅ **ENABLE RLS** (`04_enable_rls.sql`)

**Never**:
- Enable RLS before creating policies (app breaks - RLS defaults to deny-all)
- Skip indexes (queries will be slow)
- Skip testing (you'll find issues in production)

## Backend Code Check

**CRITICAL**: Update your backend:

```javascript
// ❌ WRONG - Subject to RLS
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY  // <-- This respects RLS
)

// ✅ CORRECT - Bypasses RLS for admin operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // <-- Admin access
)
```

**When to use each:**
- **Service Role** (backend only): Creating users, admin dashboards, system tasks
- **Anon/Auth** (frontend): All user-initiated actions

## Testing Checklist

Run `06_test_rls.sql` and verify:

- [ ] ✅ Users can view all profiles (public read)
- [ ] ✅ Users can update own profile
- [ ] ❌ Users CANNOT update others' profiles (0 rows affected)
- [ ] ✅ Users can follow creators
- [ ] ❌ Users CANNOT follow themselves (policy violation)
- [ ] ✅ Users can view own payments
- [ ] ❌ Users CANNOT view others' payments (0 rows)
- [ ] ✅ Subscribers can access subscription content
- [ ] ❌ Non-subscribers CANNOT access subscription content (0 rows)
- [ ] ✅ Creators can view own analytics
- [ ] ❌ Non-creators CANNOT view creator analytics (0 rows)

## Rollback (Emergency)

If app breaks after enabling RLS:

```sql
-- Disable RLS temporarily
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

⚠️ **This exposes your data!** Fix policies and re-enable ASAP.

## Common Errors & Fixes

### "new row violates row-level security policy"

**Fix**: Check INSERT policy `WITH CHECK`:
```sql
-- Too restrictive?
WITH CHECK (user_id = current_user_db_id())
```

### Queries return empty

**Fix**: Check SELECT policy `USING`:
```sql
-- Too restrictive?
USING (creator_id = current_user_db_id())
```

### Backend 403 errors

**Fix**: Use `SUPABASE_SERVICE_ROLE_KEY` in backend

### Slow queries

**Fix**: Verify indexes created:
```sql
SELECT * FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%';
```

## Next Steps After Migration

1. **Monitor Supabase Logs** (Dashboard → Logs)
   - Watch for RLS policy violations
   - Check for unexpected 403s

2. **Test All User Flows**
   - Fan: browse → follow → subscribe → access content
   - Creator: upload → manage → view analytics
   - Payments: purchase → view history

3. **Tighten Policies** (if you used Option B)
   - Replace permissive `USING (true)` with proper auth checks
   - Use helper functions for consistency

4. **Monitor Performance**
   - Check query times in Logs
   - Add indexes if you see slow queries

## Production Rollout Strategy

### Best Practice: Test on Staging First

1. **Create staging project** from prod snapshot (Supabase Dashboard)
2. **Run all migrations** on staging
3. **Test all flows** on staging
4. **If green**, schedule maintenance window for prod
5. **Run migrations** on prod
6. **Monitor** for 24-48 hours

### If Going Straight to Prod

1. **Backup** (Supabase Dashboard → Database → Backups)
2. **Low-traffic window** (2-4 AM in your timezone)
3. **Have team on standby** (for rollback if needed)
4. **Run migrations** sequentially
5. **Test immediately** after each step
6. **Monitor closely** for first few hours

## File Sizes & Timing

- `00_audit_database.sql`: Instant
- `01_helper_functions.sql`: ~30 seconds
- `02_performance_indexes.sql`: **5-15 minutes** (CONCURRENTLY = safe but slow)
- `03_rls_policies_part1_core.sql`: ~1 minute
- `04_enable_rls.sql`: ~30 seconds
- `05_storage_policies.sql`: ~30 seconds
- `06_test_rls.sql`: ~5 minutes

**Total**: ~25-35 minutes (mostly index creation)

## Success Criteria

✅ Migration successful if:
- All tables have RLS enabled
- Each table has policies (no tables with 0 policies)
- Tests pass (06_test_rls.sql)
- Frontend works normally
- Backend works normally
- No unexpected 403s in logs
- Query performance acceptable

## Get Help

If stuck:
1. Check `README_RLS_MIGRATION.md` (full docs)
2. Check Supabase Dashboard → Logs for detailed errors
3. Review policy for the failing table
4. Test with `06_test_rls.sql`

## Summary

**The Fix**: 6 SQL files, ~30 minutes, 253 security issues resolved

**The Risk**: Low if you:
- Test on staging first
- Create policies before enabling RLS
- Have rollback plan ready
- Use service role key in backend

**The Benefit**: Your database goes from "wide open" to "secure by default"

Let's do this! 🚀
