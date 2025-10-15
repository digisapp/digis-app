-- =============================================================================
-- DATABASE SECURITY AUDIT - RLS MIGRATION
-- =============================================================================
-- Run this first to get an accurate count and list of what needs fixing
-- =============================================================================

-- 1. All base tables in public schema
SELECT
  'BASE TABLES' as object_type,
  relname as name,
  CASE
    WHEN c.relrowsecurity THEN 'ENABLED'
    ELSE 'DISABLED'
  END as rls_status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'  -- 'r' = ordinary table
ORDER BY relname;

-- 2. Count tables with/without RLS
SELECT
  'SUMMARY' as category,
  COUNT(*) FILTER (WHERE c.relrowsecurity) as rls_enabled,
  COUNT(*) FILTER (WHERE NOT c.relrowsecurity) as rls_disabled,
  COUNT(*) as total_tables
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r';

-- 3. Tables without RLS enabled (exact list)
SELECT
  'TABLES NEEDING RLS' as category,
  schemaname,
  tablename
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
ORDER BY tablename;

-- 4. Functions using SECURITY DEFINER (NOT views)
SELECT
  'SECURITY DEFINER FUNCTIONS' as category,
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  CASE
    WHEN pg_get_functiondef(p.oid) ILIKE '%SECURITY DEFINER%' THEN 'DEFINER'
    WHEN pg_get_functiondef(p.oid) ILIKE '%SECURITY INVOKER%' THEN 'INVOKER'
    ELSE 'DEFAULT'
  END as security_mode
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) ILIKE '%SECURITY DEFINER%'
ORDER BY p.proname;

-- 5. Views in public schema (for reference)
SELECT
  'VIEWS' as category,
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

-- 6. Materialized views (if any)
SELECT
  'MATERIALIZED VIEWS' as category,
  schemaname,
  matviewname
FROM pg_matviews
WHERE schemaname = 'public'
ORDER BY matviewname;

-- 7. Existing RLS policies (if any)
SELECT
  'EXISTING POLICIES' as category,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 8. Check for indexes on common auth columns
SELECT
  'INDEX AUDIT' as category,
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    indexdef ILIKE '%supabase_id%'
    OR indexdef ILIKE '%user_id%'
    OR indexdef ILIKE '%creator_id%'
    OR indexdef ILIKE '%follower_id%'
    OR indexdef ILIKE '%subscriber_id%'
  )
ORDER BY tablename, indexname;

-- 9. Tables with user_id or creator_id columns (need policies)
SELECT
  'TABLES WITH OWNERSHIP COLUMNS' as category,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    column_name IN ('user_id', 'creator_id', 'owner_id', 'supabase_id',
                    'follower_id', 'subscriber_id', 'sender_id', 'receiver_id')
  )
ORDER BY table_name, column_name;

-- 10. Check auth.users table structure
SELECT
  'AUTH.USERS STRUCTURE' as category,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'auth'
  AND table_name = 'users'
ORDER BY ordinal_position;

-- 11. Check public.users linking to auth
SELECT
  'PUBLIC.USERS STRUCTURE' as category,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
ORDER BY ordinal_position;

-- 12. Storage buckets (need separate policies)
SELECT
  'STORAGE BUCKETS' as category,
  id,
  name,
  public
FROM storage.buckets
ORDER BY name;

-- 13. Check for realtime publications
SELECT
  'REALTIME PUBLICATIONS' as category,
  schemaname,
  tablename,
  pubname
FROM pg_publication_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- =============================================================================
-- SAVE RESULTS TO FILE OR EXPORT
-- =============================================================================
-- In Supabase SQL Editor, you can see all these results
-- Export to CSV for documentation
-- =============================================================================
