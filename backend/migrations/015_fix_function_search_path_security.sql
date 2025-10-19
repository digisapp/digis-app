-- Migration: Fix Function Search Path Security Vulnerabilities
-- Addresses: Supabase Linter warnings for function_search_path_mutable
--
-- Security Impact:
-- ✅ Prevents search_path injection attacks on SECURITY DEFINER functions
-- ✅ Ensures functions always use public schema, preventing malicious overrides
-- ✅ Follows Supabase best practices for secure function definitions
--
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- ============================================================================
-- Fix cached_auth_uid() - Add SET search_path = public
-- ============================================================================

CREATE OR REPLACE FUNCTION cached_auth_uid()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid();
$$;

-- ============================================================================
-- Fix get_current_user_db_id() - Add SET search_path = public
-- ============================================================================

CREATE OR REPLACE FUNCTION get_current_user_db_id()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT id FROM public.users WHERE supabase_id = auth.uid() LIMIT 1);
END;
$$;

-- ============================================================================
-- Verify fixes applied correctly
-- ============================================================================

-- Check that search_path is now set for both functions
DO $$
DECLARE
  cached_uid_config TEXT[];
  db_id_config TEXT[];
BEGIN
  -- Get prosecdef and proconfig for cached_auth_uid
  SELECT proconfig INTO cached_uid_config
  FROM pg_proc
  WHERE proname = 'cached_auth_uid'
    AND pronamespace = 'public'::regnamespace;

  -- Get prosecdef and proconfig for get_current_user_db_id
  SELECT proconfig INTO db_id_config
  FROM pg_proc
  WHERE proname = 'get_current_user_db_id'
    AND pronamespace = 'public'::regnamespace;

  -- Verify both have search_path set
  IF cached_uid_config IS NULL OR NOT ('search_path=public' = ANY(cached_uid_config)) THEN
    RAISE WARNING 'cached_auth_uid() search_path not set correctly';
  ELSE
    RAISE NOTICE '✅ cached_auth_uid() search_path = public';
  END IF;

  IF db_id_config IS NULL OR NOT ('search_path=public' = ANY(db_id_config)) THEN
    RAISE WARNING 'get_current_user_db_id() search_path not set correctly';
  ELSE
    RAISE NOTICE '✅ get_current_user_db_id() search_path = public';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Run this query to verify search_path is set:
-- SELECT
--   proname as function_name,
--   prosecdef as is_security_definer,
--   proconfig as configuration
-- FROM pg_proc
-- WHERE proname IN ('cached_auth_uid', 'get_current_user_db_id')
--   AND pronamespace = 'public'::regnamespace;
--
-- Expected output:
-- function_name            | is_security_definer | configuration
-- -------------------------|---------------------|-------------------
-- cached_auth_uid          | t                   | {search_path=public}
-- get_current_user_db_id   | t                   | {search_path=public}

-- ============================================================================
-- NOTES
-- ============================================================================

-- What This Migration Does:
-- ✅ Adds SET search_path = public to cached_auth_uid()
-- ✅ Adds SET search_path = public to get_current_user_db_id()
-- ✅ Prevents search_path injection attacks on SECURITY DEFINER functions
-- ✅ Maintains all existing function behavior (STABLE, SECURITY DEFINER)
--
-- Security Impact:
-- Before: Functions could be hijacked by creating malicious functions in user schemas
-- After: Functions are locked to public schema, preventing injection attacks
--
-- Why This Matters:
-- SECURITY DEFINER functions run with elevated privileges (like sudo).
-- Without SET search_path, an attacker could create a malicious schema and
-- trick the function into executing attacker-controlled code.
--
-- Next Steps:
-- 1. Run this migration on your Supabase database
-- 2. Re-run Supabase Database Linter to verify warnings are resolved
-- 3. Confirm no application errors (functions should work identically)
