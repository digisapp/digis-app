-- =============================================================================
-- FIX REMAINING SECURITY WARNINGS
-- =============================================================================
-- Addresses extension schema, materialized view access, and other warnings
-- =============================================================================

-- =============================================================================
-- 1. MOVE pg_trgm EXTENSION TO EXTENSIONS SCHEMA
-- =============================================================================

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Note: Extensions can't be moved between schemas directly in PostgreSQL
-- Instead, we need to drop and recreate in the new schema
-- WARNING: This requires SUPERUSER privileges

-- Check if pg_trgm is being used
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '======================================';
  RAISE NOTICE 'Extension pg_trgm location check';
  RAISE NOTICE '======================================';

  -- List all indexes using pg_trgm (GIN/GIST with trgm operators)
  RAISE NOTICE 'Tables using pg_trgm indexes:';
  FOR r IN (
    SELECT
      schemaname,
      tablename,
      indexname
    FROM pg_indexes
    WHERE indexdef LIKE '%gin%trgm%' OR indexdef LIKE '%gist%trgm%'
  ) LOOP
    RAISE NOTICE '  - %.% (index: %)', r.schemaname, r.tablename, r.indexname;
  END LOOP;
END$$;

-- Uncomment the following if you have superuser access and want to move the extension:
-- Note: This will temporarily drop the extension (affects text search performance)
/*
DROP EXTENSION IF EXISTS pg_trgm CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated, anon;
*/

COMMENT ON SCHEMA extensions IS 'Schema for PostgreSQL extensions (recommended by Supabase)';

-- =============================================================================
-- 2. SECURE MATERIALIZED VIEW (analytics_dashboard_summary)
-- =============================================================================

-- Add RLS to materialized view
ALTER MATERIALIZED VIEW IF EXISTS analytics_dashboard_summary OWNER TO postgres;

-- Create policy for materialized view (only admins can access)
-- Note: Materialized views don't support RLS policies directly
-- Best approach: Revoke public access and grant only to specific roles

REVOKE ALL ON analytics_dashboard_summary FROM anon, authenticated;

-- Grant access only to service role (backend)
-- The backend using SUPABASE_SERVICE_ROLE_KEY will still have access

COMMENT ON MATERIALIZED VIEW analytics_dashboard_summary IS 'Analytics summary - access via backend API only';

-- =============================================================================
-- 3. VERIFICATION
-- =============================================================================

-- Check extension schema
SELECT
  'EXTENSION SCHEMA' as info,
  extname as extension_name,
  n.nspname as schema
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE extname = 'pg_trgm';

-- Check materialized view permissions
SELECT
  'MATERIALIZED VIEW ACCESS' as info,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'analytics_dashboard_summary';

-- =============================================================================
-- NOTES ON REMAINING WARNINGS
-- =============================================================================

-- ⚠️  Extension Warning (pg_trgm in public schema)
-- Solution requires SUPERUSER privileges
-- If you have SUPERUSER access, uncomment the DROP/CREATE statements above
-- Otherwise, this is a low-risk warning that can be accepted

-- ⚠️  Auth Warnings (Password Protection, MFA, PostgreSQL Version)
-- These must be configured in the Supabase Dashboard:
--   1. Password Protection: Settings → Auth → Password Settings
--   2. MFA Options: Settings → Auth → Multi-Factor Authentication
--   3. PostgreSQL Upgrade: Settings → Database → Upgrade

-- =============================================================================
-- ✅ COMPLETE!
-- =============================================================================
-- Materialized view access restricted to backend only
-- Extension warning documented with solution
-- Auth settings require Dashboard configuration
-- =============================================================================
