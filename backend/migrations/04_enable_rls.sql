-- =============================================================================
-- ENABLE RLS ON ALL TABLES - FINAL STEP
-- =============================================================================
-- CRITICAL: Only run this AFTER:
--   ✅ 01_helper_functions.sql
--   ✅ 02_performance_indexes.sql
--   ✅ 03_rls_policies_part1_core.sql
--   ✅ All other policy files for your tables
--
-- This script enables RLS on all public tables
-- DO NOT run this before policies are created or app will break!
-- =============================================================================

BEGIN;

-- Get list of all tables that need RLS and don't have it yet
DO $$
DECLARE
  table_record RECORD;
  tables_enabled INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting RLS enablement...';

  FOR table_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN (
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relrowsecurity = true
      )
    ORDER BY tablename
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_record.tablename);
    tables_enabled := tables_enabled + 1;
    RAISE NOTICE 'Enabled RLS on: %', table_record.tablename;
  END LOOP;

  RAISE NOTICE 'RLS enabled on % tables', tables_enabled;
END$$;

-- Force RLS for table owners (important security measure)
-- This ensures even service role queries respect RLS unless explicitly bypassed
DO $$
DECLARE
  table_record RECORD;
BEGIN
  FOR table_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  LOOP
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_record.tablename);
    RAISE NOTICE 'Forced RLS on: %', table_record.tablename;
  END LOOP;
END$$;

COMMIT;

-- =============================================================================
-- VERIFICATION
-- =============================================================================
-- Check RLS status on all tables
SELECT
  schemaname,
  tablename,
  CASE
    WHEN c.relrowsecurity THEN '✅ ENABLED'
    ELSE '❌ DISABLED'
  END as rls_status,
  CASE
    WHEN c.relforcerowsecurity THEN '✅ FORCED'
    ELSE '❌ NOT FORCED'
  END as force_rls
FROM pg_tables pt
LEFT JOIN pg_class c ON c.relname = pt.tablename
LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = pt.schemaname
WHERE pt.schemaname = 'public'
ORDER BY tablename;

-- Count policies per table
SELECT
  tablename,
  COUNT(*) as policy_count,
  array_agg(policyname ORDER BY policyname) as policies
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Tables with RLS enabled but NO policies (DANGEROUS!)
SELECT
  pt.tablename,
  'WARNING: RLS enabled but no policies!' as status
FROM pg_tables pt
JOIN pg_class c ON c.relname = pt.tablename
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE pt.schemaname = 'public'
  AND n.nspname = 'public'
  AND c.relrowsecurity = true
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies pp
    WHERE pp.schemaname = 'public'
      AND pp.tablename = pt.tablename
  )
ORDER BY pt.tablename;

-- =============================================================================
-- ROLLBACK PLAN (EMERGENCY ONLY)
-- =============================================================================
-- If something breaks, you can disable RLS temporarily:
-- WARNING: This exposes your data! Only use in emergencies!
--
-- DO $$
-- DECLARE
--   table_record RECORD;
-- BEGIN
--   FOR table_record IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
--   LOOP
--     EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', table_record.tablename);
--   END LOOP;
-- END$$;
-- =============================================================================
