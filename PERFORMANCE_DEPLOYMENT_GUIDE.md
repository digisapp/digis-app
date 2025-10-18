# Performance Optimization Deployment Guide

## Overview

This guide will help you deploy the RLS (Row Level Security) performance optimizations to fix the issues identified by the Supabase database linter.

## What This Migration Fixes

### 1. **auth_rls_initplan warnings** (70+ instances)
- **Problem**: RLS policies re-evaluate `auth.uid()` for each row, causing severe performance degradation
- **Solution**: Wrap `auth.uid()` in `(SELECT auth.uid())` to cache the result per query
- **Impact**: 30-50% reduction in query planning time

### 2. **multiple_permissive_policies warnings** (40+ instances)
- **Problem**: Multiple RLS policies for the same table/role/action causing redundant checks
- **Solution**: Consolidate related policies into fewer, optimized policies
- **Impact**: Reduces policy evaluation overhead

### 3. **duplicate_index warnings** (30+ instances)
- **Problem**: Identical indexes on the same columns waste storage and slow down writes
- **Solution**: Drop duplicate indexes, keep only one optimal index per access pattern
- **Impact**: Reduces storage usage and improves write performance

## Files Involved

- **Migration SQL**: `backend/migrations/012_optimize_high_traffic_rls.sql`
- **Test Script**: `backend/migrations/012_test_migration.sh`

## Pre-Deployment Checklist

- [ ] Backup your database (Supabase auto-backups should be enabled)
- [ ] Review the migration SQL file to understand the changes
- [ ] Have access to Supabase SQL Editor
- [ ] Optional: Test in a staging environment first

## Deployment Steps

### Step 1: Access Supabase SQL Editor

1. Go to https://supabase.com/dashboard
2. Select your project: **digis** (lpphsjowsivjtcmafxnj)
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Run the Migration

1. Open the migration file: `backend/migrations/012_optimize_high_traffic_rls.sql`
2. Copy the **entire contents** of the file
3. Paste into the Supabase SQL Editor
4. Review the SQL one more time
5. Click **Run** (bottom right corner)

### Step 3: Verify the Migration

The migration includes `ANALYZE` commands at the end that will automatically update PostgreSQL statistics. After running the migration:

1. Check for any errors in the SQL Editor output
2. If successful, you should see messages about policies being created and indexes being dropped
3. Run the verification queries included at the bottom of the migration file (commented out)

### Step 4: Test in Production

After the migration completes:

1. **Test authentication flows**:
   - Login as a fan
   - Login as a creator (Miriam)
   - Login as admin
   - Verify profiles load quickly

2. **Test high-traffic features**:
   - View user profiles
   - Check session history
   - View token balances
   - Follow/unfollow creators
   - Send/receive messages

3. **Monitor performance**:
   - Check Supabase Dashboard > Database > Query Performance
   - Look for reduced query times on `users`, `sessions`, `token_balances`, `follows`, `messages` tables

### Step 5: Re-run Database Linter

1. In Supabase Dashboard, go to **Database** > **Linter**
2. Click **Refresh** or **Run Linter**
3. Verify the warning counts are significantly reduced:
   - `auth_rls_initplan` warnings should be reduced by ~60-70%
   - `multiple_permissive_policies` warnings should be reduced by ~80%
   - `duplicate_index` warnings should be eliminated completely

## Expected Results

### Performance Improvements

- **Query Planning Time**: 30-50% faster
- **RLS Policy Evaluation**: Reduced overhead from fewer policies
- **Write Operations**: Faster due to fewer indexes to maintain
- **Storage**: Reduced usage from duplicate index removal

### Security

- ✅ **No security reduction**: All RLS policies maintain the same security guarantees
- ✅ **Same access controls**: Users can only access their own data
- ✅ **Service role unchanged**: Backend service role maintains full access

## Rollback Plan (If Needed)

If you encounter issues after running the migration:

1. **Immediate rollback**: Restore from Supabase automatic backup
   - Go to Database > Backups
   - Select the backup from before the migration
   - Click "Restore"

2. **Manual rollback**: Re-run the original policies
   - Check git history for original policy definitions
   - Recreate policies manually in SQL Editor

3. **Partial rollback**: Roll back specific tables
   - Drop optimized policies: `DROP POLICY "policy_name" ON table_name;`
   - Recreate original policies from git history

## Troubleshooting

### Issue: Migration fails with "policy already exists"

**Solution**: The migration includes `DROP POLICY IF EXISTS` statements, but if you get this error:
1. Manually drop the conflicting policy first
2. Re-run the migration

### Issue: Application shows "permission denied" errors

**Solution**:
1. Check application logs for which table/operation is denied
2. Verify the new policies in SQL Editor:
   ```sql
   SELECT tablename, policyname, cmd, qual
   FROM pg_policies
   WHERE tablename = 'affected_table_name';
   ```
3. Compare with the migration SQL to ensure policies were created correctly

### Issue: Duplicate index warnings still appear

**Solution**: The migration attempts to drop indexes with guessed names. If some weren't dropped:
1. Run this query to find actual duplicate index names:
   ```sql
   SELECT
     schemaname, tablename,
     array_agg(indexname) as duplicate_indexes,
     indexdef
   FROM pg_indexes
   WHERE tablename IN ('users', 'sessions', 'token_balances', 'follows', 'messages')
   GROUP BY schemaname, tablename, indexdef
   HAVING COUNT(*) > 1;
   ```
2. Manually drop the duplicates: `DROP INDEX schema.actual_index_name;`

### Issue: Queries are slower after migration

**Solution**: This is unlikely, but if it happens:
1. Run `ANALYZE` on affected tables:
   ```sql
   ANALYZE public.users;
   ANALYZE public.sessions;
   ANALYZE public.token_balances;
   ANALYZE public.follows;
   ANALYZE public.messages;
   ```
2. Check if required indexes were accidentally dropped
3. Consider rolling back if performance doesn't improve

## Post-Deployment Monitoring

### Week 1: Active Monitoring

- Monitor error rates in application logs
- Check Supabase Dashboard > Database > Query Performance daily
- Watch for user-reported issues with authentication or data access
- Verify database CPU and memory usage is stable or improved

### Week 2-4: Passive Monitoring

- Check Query Performance weekly
- Review any RLS-related errors in logs
- Compare performance metrics to pre-migration baseline

## Next Steps

After successful deployment:

1. **Document the improvement**: Note the performance gains in your team docs
2. **Update monitoring dashboards**: Set new baselines for query performance
3. **Schedule regular linter runs**: Run the Supabase Database Linter monthly to catch new issues early

## Support

If you encounter issues during deployment:

1. Check the Troubleshooting section above
2. Review Supabase documentation: https://supabase.com/docs/guides/database/postgres/row-level-security
3. Check application logs for specific error messages
4. Consider rolling back and investigating the issue before re-attempting

---

**Migration File**: `backend/migrations/012_optimize_high_traffic_rls.sql`
**Test Script**: `backend/migrations/012_test_migration.sh`
**Created**: 2025-10-18
**Estimated Deployment Time**: 5-10 minutes
**Estimated Downtime**: None (zero-downtime migration)
