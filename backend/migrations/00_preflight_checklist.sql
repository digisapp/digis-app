-- =============================================================================
-- PRE-FLIGHT CHECKLIST - Run before enabling RLS
-- =============================================================================
-- This script checks all prerequisites are met
-- Fix any ❌ FAIL items before proceeding with RLS migration
-- =============================================================================

\echo '==================================================================='
\echo 'PRE-FLIGHT CHECKLIST FOR RLS MIGRATION'
\echo '==================================================================='
\echo ''

-- =============================================================================
-- CHECK 1: Service Role Key Configuration
-- =============================================================================
\echo '1. SERVICE ROLE KEY CONFIGURATION'
\echo '   ⚠️  MANUAL CHECK: Verify backend uses SUPABASE_SERVICE_ROLE_KEY'
\echo '   ✅ Check backend/.env has SUPABASE_SERVICE_ROLE_KEY'
\echo '   ✅ Check backend code creates admin client with service role key'
\echo '   ✅ Check frontend ONLY uses SUPABASE_ANON_KEY'
\echo ''

-- =============================================================================
-- CHECK 2: JWT → DB Identity Mapping
-- =============================================================================
\echo '2. SUPABASE_ID MAPPING (auth.users → public.users)'

SELECT
  'Users with supabase_id' as metric,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) = 0 THEN '⚠️  WARNING - No users yet (okay for new DB)'
    WHEN COUNT(*) = COUNT(supabase_id) THEN '✅ PASS - All users have supabase_id'
    ELSE '❌ FAIL - Some users missing supabase_id!'
  END as status
FROM public.users;

-- Check for null supabase_ids
SELECT
  'Users missing supabase_id' as metric,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ PASS'
    ELSE '❌ FAIL - Fix: UPDATE users SET supabase_id = ... WHERE supabase_id IS NULL'
  END as status
FROM public.users
WHERE supabase_id IS NULL;

-- Check for duplicate supabase_ids
SELECT
  'Duplicate supabase_ids' as metric,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ PASS'
    ELSE '❌ FAIL - Each user must have unique supabase_id'
  END as status
FROM (
  SELECT supabase_id, COUNT(*) as cnt
  FROM public.users
  WHERE supabase_id IS NOT NULL
  GROUP BY supabase_id
  HAVING COUNT(*) > 1
) duplicates;

-- Check for index on supabase_id
SELECT
  'Index on users.supabase_id' as metric,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ PASS'
    ELSE '❌ FAIL - Run 02_performance_indexes.sql first'
  END as status
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'users'
  AND indexdef ILIKE '%supabase_id%';

\echo ''

-- =============================================================================
-- CHECK 3: Helper Functions
-- =============================================================================
\echo '3. HELPER FUNCTIONS (DRY policy predicates)'

SELECT
  'Helper functions installed' as metric,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) >= 8 THEN '✅ PASS - ' || COUNT(*) || ' functions found'
    ELSE '❌ FAIL - Run 01_helper_functions.sql first'
  END as status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'current_user_db_id',
    'is_owner',
    'is_creator',
    'is_active_subscriber',
    'is_active_creator_subscriber',
    'owns_content',
    'is_conversation_participant',
    'follows_creator'
  );

-- List helper functions
SELECT
  '  - ' || p.proname as function_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname LIKE 'is_%'
   OR p.proname LIKE 'current_%'
   OR p.proname LIKE '%_content'
   OR p.proname LIKE '%_participant'
ORDER BY p.proname;

\echo ''

-- =============================================================================
-- CHECK 4: Performance Indexes
-- =============================================================================
\echo '4. PERFORMANCE INDEXES (critical for RLS speed)'

SELECT
  'RLS-critical indexes' as metric,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) >= 20 THEN '✅ PASS - ' || COUNT(*) || ' indexes found'
    WHEN COUNT(*) >= 10 THEN '⚠️  PARTIAL - Some indexes missing, may be slow'
    ELSE '❌ FAIL - Run 02_performance_indexes.sql first'
  END as status
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%';

-- Critical indexes check
WITH critical_indexes AS (
  SELECT unnest(ARRAY[
    'idx_users_supabase_id',
    'idx_subscriptions_active',
    'idx_follows_follower_id',
    'idx_follows_following_id',
    'idx_conversations_participant1',
    'idx_conversations_participant2'
  ]) as expected_index
)
SELECT
  'Critical indexes present' as metric,
  COUNT(*) as found,
  (SELECT COUNT(*) FROM critical_indexes) as expected,
  CASE
    WHEN COUNT(*) = (SELECT COUNT(*) FROM critical_indexes) THEN '✅ PASS'
    ELSE '⚠️  WARNING - Some critical indexes missing'
  END as status
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (SELECT expected_index FROM critical_indexes);

\echo ''

-- =============================================================================
-- CHECK 5: RLS Policies Exist
-- =============================================================================
\echo '5. RLS POLICIES (must exist before enabling RLS)'

SELECT
  'Tables with policies' as metric,
  COUNT(DISTINCT tablename) as count,
  CASE
    WHEN COUNT(DISTINCT tablename) >= 14 THEN '✅ PASS - Policies exist for ' || COUNT(DISTINCT tablename) || ' tables'
    WHEN COUNT(DISTINCT tablename) >= 8 THEN '⚠️  PARTIAL - Core tables covered, add more'
    ELSE '❌ FAIL - Run 03_rls_policies_part1_core.sql first'
  END as status
FROM pg_policies
WHERE schemaname = 'public';

-- Tables with policies
SELECT
  'Tables covered by policies:' as info,
  array_agg(DISTINCT tablename ORDER BY tablename) as tables
FROM pg_policies
WHERE schemaname = 'public';

\echo ''

-- =============================================================================
-- CHECK 6: Realtime Publications
-- =============================================================================
\echo '6. REALTIME PUBLICATIONS (tables published for Realtime)'

SELECT
  'Tables published for Realtime' as metric,
  COUNT(DISTINCT tablename) as count,
  CASE
    WHEN COUNT(*) = 0 THEN '⚠️  INFO - No Realtime subscriptions (okay if not using)'
    ELSE '✅ INFO - ' || COUNT(*) || ' tables published'
  END as status
FROM pg_publication_tables
WHERE schemaname = 'public';

-- List published tables
SELECT
  '  - ' || tablename as published_table,
  '(publication: ' || pubname || ')' as publication
FROM pg_publication_tables
WHERE schemaname = 'public'
ORDER BY tablename;

\echo ''
\echo 'IMPORTANT: Realtime respects RLS automatically.'
\echo 'Users only receive updates for rows they can SELECT via RLS policies.'
\echo ''

-- =============================================================================
-- CHECK 7: Storage Buckets
-- =============================================================================
\echo '7. STORAGE BUCKETS (need separate policies from table RLS)'

SELECT
  'Storage buckets' as metric,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) = 0 THEN '⚠️  INFO - No storage buckets (okay if not using)'
    ELSE '✅ INFO - ' || COUNT(*) || ' buckets found'
  END as status
FROM storage.buckets;

-- List buckets
SELECT
  '  - ' || name as bucket_name,
  CASE WHEN public THEN '(public)' ELSE '(private)' END as visibility
FROM storage.buckets
ORDER BY name;

\echo ''
\echo 'IMPORTANT: Run 05_storage_policies.sql for bucket security!'
\echo 'Table RLS does NOT protect Storage buckets.'
\echo ''

-- =============================================================================
-- CHECK 8: Current RLS Status
-- =============================================================================
\echo '8. CURRENT RLS STATUS (should be DISABLED before migration)'

SELECT
  'Tables with RLS already enabled' as metric,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ PASS - RLS disabled (ready for migration)'
    ELSE '⚠️  WARNING - ' || COUNT(*) || ' tables already have RLS'
  END as status
FROM pg_tables pt
JOIN pg_class c ON c.relname = pt.tablename
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE pt.schemaname = 'public'
  AND n.nspname = 'public'
  AND c.relrowsecurity = true;

-- If any tables have RLS enabled, list them
SELECT
  '  - ' || pt.tablename as table_with_rls,
  '(' || (SELECT COUNT(*) FROM pg_policies pp WHERE pp.tablename = pt.tablename) || ' policies)' as policy_count
FROM pg_tables pt
JOIN pg_class c ON c.relname = pt.tablename
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE pt.schemaname = 'public'
  AND n.nspname = 'public'
  AND c.relrowsecurity = true
ORDER BY pt.tablename;

\echo ''

-- =============================================================================
-- CHECK 9: SECURITY DEFINER Functions (potential RLS bypass)
-- =============================================================================
\echo '9. SECURITY DEFINER FUNCTIONS (should be INVOKER for RLS)'

SELECT
  'Functions using SECURITY DEFINER' as metric,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ PASS - No SECURITY DEFINER functions'
    ELSE '⚠️  WARNING - ' || COUNT(*) || ' functions bypass RLS'
  END as status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) ILIKE '%SECURITY DEFINER%';

-- List SECURITY DEFINER functions
SELECT
  '  - ' || p.proname as function_name,
  '(' || pg_get_function_identity_arguments(p.oid) || ')' as arguments,
  '⚠️  Review and convert to SECURITY INVOKER' as action
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) ILIKE '%SECURITY DEFINER%'
ORDER BY p.proname;

\echo ''

-- =============================================================================
-- CHECK 10: Table Structure (columns needed for policies)
-- =============================================================================
\echo '10. TABLE STRUCTURE (columns used by policies)'

-- Check for common ownership columns
WITH ownership_columns AS (
  SELECT
    table_name,
    array_agg(column_name ORDER BY column_name) as columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name IN (
      'user_id', 'creator_id', 'owner_id', 'supabase_id',
      'follower_id', 'subscriber_id', 'sender_id', 'receiver_id',
      'participant1_id', 'participant2_id', 'blocker_id', 'blocked_id'
    )
  GROUP BY table_name
)
SELECT
  'Tables with ownership columns' as metric,
  COUNT(*) as count,
  '✅ INFO - ' || COUNT(*) || ' tables have ownership tracking' as status
FROM ownership_columns;

\echo ''

-- =============================================================================
-- SUMMARY & NEXT STEPS
-- =============================================================================
\echo '==================================================================='
\echo 'PRE-FLIGHT SUMMARY'
\echo '==================================================================='
\echo ''

SELECT
  CASE
    WHEN (
      -- All critical checks pass
      (SELECT COUNT(*) FROM public.users WHERE supabase_id IS NULL) = 0
      AND (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname IN ('current_user_db_id', 'is_owner', 'is_creator')) >= 3
      AND (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%') >= 10
      AND (SELECT COUNT(DISTINCT tablename) FROM pg_policies WHERE schemaname = 'public') >= 8
    )
    THEN '✅ READY FOR RLS MIGRATION'
    ELSE '❌ NOT READY - Fix issues above first'
  END as overall_status;

\echo ''
\echo 'NEXT STEPS:'
\echo '  1. Fix any ❌ FAIL items above'
\echo '  2. Review ⚠️  WARNING items (may be okay)'
\echo '  3. Verify backend uses SUPABASE_SERVICE_ROLE_KEY (manual check)'
\echo '  4. Test on STAGING first!'
\echo '  5. Use 04a_enable_rls_staged.sql for gradual rollout'
\echo '  6. Run 06_test_rls.sql after each stage'
\echo ''
\echo '==================================================================='

-- =============================================================================
-- DETAILED INVENTORY (for documentation)
-- =============================================================================

\echo ''
\echo 'DETAILED INVENTORY'
\echo '-------------------------------------------------------------------'

-- All public tables
SELECT
  'Public tables' as category,
  tablename,
  (SELECT COUNT(*) FROM pg_policies pp WHERE pp.tablename = pt.tablename) as policies,
  CASE
    WHEN c.relrowsecurity THEN 'RLS ENABLED'
    ELSE 'RLS disabled'
  END as rls_status,
  CASE
    WHEN (SELECT COUNT(*) FROM pg_policies pp WHERE pp.tablename = pt.tablename) > 0 THEN '✅'
    ELSE '❌ NO POLICIES'
  END as ready
FROM pg_tables pt
LEFT JOIN pg_class c ON c.relname = pt.tablename
LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE pt.schemaname = 'public'
  AND n.nspname = 'public'
ORDER BY pt.tablename;

\echo ''
\echo '==================================================================='
\echo 'END OF PRE-FLIGHT CHECKLIST'
\echo '==================================================================='
