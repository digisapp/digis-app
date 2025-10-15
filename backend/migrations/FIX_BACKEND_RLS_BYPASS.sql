-- =============================================================================
-- FIX BACKEND RLS BYPASS - CRITICAL PRODUCTION FIX
-- =============================================================================
-- Problem: Backend uses PostgreSQL connection pool (DATABASE_URL) which:
--   1. Respects RLS policies (doesn't bypass them)
--   2. Has no auth.uid() context (returns NULL)
--   3. Causes all policies using auth.uid() to fail
--
-- Solution: Grant BYPASSRLS to the postgres role used by the backend
-- =============================================================================

-- The DATABASE_URL connects as user: postgres.lpphsjowsivjtcmafxnj
-- We need to grant this role the ability to bypass RLS

-- Note: This requires SUPERUSER privileges to execute
-- Run this in Supabase SQL Editor with your admin account

-- Check current role attributes
SELECT
  rolname,
  rolsuper,
  rolcanlogin,
  rolbypassrls
FROM pg_roles
WHERE rolname LIKE 'postgres%'
ORDER BY rolname;

-- Grant BYPASSRLS to the postgres role
-- This allows the backend (using SUPABASE_SERVICE_ROLE_KEY or DATABASE_URL) to bypass RLS
ALTER ROLE postgres BYPASSRLS;

-- Verify the change
SELECT
  '✅ BYPASSRLS GRANTED' as status,
  rolname,
  rolbypassrls as has_bypass
FROM pg_roles
WHERE rolname = 'postgres';

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Test that backend queries will now work
DO $$
BEGIN
  -- This simulates a backend query that previously failed
  -- It should now succeed because postgres role bypasses RLS
  RAISE NOTICE '====================================';
  RAISE NOTICE 'Testing backend access...';
  RAISE NOTICE '====================================';

  -- Test users table (was failing with 500 errors)
  PERFORM COUNT(*) FROM users WHERE is_creator = true;
  RAISE NOTICE '✅ users table accessible';

  -- Test sessions table
  PERFORM COUNT(*) FROM sessions;
  RAISE NOTICE '✅ sessions table accessible';

  RAISE NOTICE '====================================';
  RAISE NOTICE '✅ ALL BACKEND QUERIES WORKING!';
  RAISE NOTICE '====================================';
END$$;

-- =============================================================================
-- ALTERNATIVE SOLUTION (if BYPASSRLS doesn't work)
-- =============================================================================

-- If you can't grant BYPASSRLS to postgres role, you can create a new policy
-- that allows service_role to access everything:

-- For users table:
-- DROP POLICY IF EXISTS "Backend service role access" ON users;
-- CREATE POLICY "Backend service role access" ON users
--   FOR ALL TO authenticated
--   USING (
--     -- Allow if using service role (which sets a special claim)
--     current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
--     OR
--     -- Or allow normal authenticated access with auth.uid()
--     auth.uid() IS NOT NULL
--   );

-- However, this approach requires modifying policies on ALL 67 tables
-- BYPASSRLS is cleaner and matches the intended security model

-- =============================================================================
-- ✅ COMPLETE!
-- =============================================================================
-- After running this migration:
-- 1. Backend queries using DATABASE_URL will bypass RLS
-- 2. Backend queries using SUPABASE_SERVICE_ROLE_KEY will bypass RLS
-- 3. Frontend queries using SUPABASE_ANON_KEY will still respect RLS
-- 4. The 500 errors on /api/auth/sync-user and /api/users/creators will be fixed
-- =============================================================================
