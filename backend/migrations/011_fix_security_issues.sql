-- Migration: Fix Supabase Database Linter Security Issues
-- Addresses: RLS disabled, function search_path, extension schema

-- ============================================================================
-- 1. ENABLE ROW LEVEL SECURITY (ERROR LEVEL - CRITICAL)
-- ============================================================================

-- Enable RLS on username_quarantine table
ALTER TABLE public.username_quarantine ENABLE ROW LEVEL SECURITY;

-- Enable RLS on username_changes table
ALTER TABLE public.username_changes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. CREATE RLS POLICIES FOR USERNAME TABLES
-- ============================================================================

-- Policy: Only authenticated users can read username_quarantine
DROP POLICY IF EXISTS "Users can read quarantined usernames" ON public.username_quarantine;
CREATE POLICY "Users can read quarantined usernames"
  ON public.username_quarantine
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only service role can insert/update/delete quarantined usernames
DROP POLICY IF EXISTS "Service role can manage quarantine" ON public.username_quarantine;
CREATE POLICY "Service role can manage quarantine"
  ON public.username_quarantine
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Users can read their own username changes
DROP POLICY IF EXISTS "Users can read own username changes" ON public.username_changes;
CREATE POLICY "Users can read own username changes"
  ON public.username_changes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id::uuid);

-- Policy: Users can insert their own username changes
DROP POLICY IF EXISTS "Users can insert own username changes" ON public.username_changes;
CREATE POLICY "Users can insert own username changes"
  ON public.username_changes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id::uuid);

-- Policy: Service role can manage all username changes
DROP POLICY IF EXISTS "Service role can manage username changes" ON public.username_changes;
CREATE POLICY "Service role can manage username changes"
  ON public.username_changes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 3. FIX FUNCTION SEARCH_PATH (WARN LEVEL)
-- ============================================================================

-- Fix is_username_quarantined function to have immutable search_path
DROP FUNCTION IF EXISTS public.is_username_quarantined(text);
CREATE OR REPLACE FUNCTION public.is_username_quarantined(p_username text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp  -- Fix: Set explicit search_path
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.username_quarantine
    WHERE LOWER(username) = LOWER(p_username)
  );
END;
$$;

-- ============================================================================
-- 4. MOVE pg_trgm EXTENSION FROM PUBLIC SCHEMA (WARN LEVEL)
-- ============================================================================

-- Move pg_trgm extension to extensions schema (best practice)
-- Note: This requires superuser privileges, might fail on Supabase
-- If it fails, it's okay - Supabase manages extensions differently

DO $$
BEGIN
  -- Create extensions schema if it doesn't exist
  CREATE SCHEMA IF NOT EXISTS extensions;

  -- Try to move pg_trgm to extensions schema
  -- This may fail on Supabase due to permissions, which is fine
  BEGIN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Cannot move pg_trgm extension (insufficient privileges). This is okay on Supabase.';
    WHEN OTHERS THEN
      RAISE NOTICE 'Could not move pg_trgm extension: %', SQLERRM;
  END;
END $$;

-- ============================================================================
-- 5. GRANT APPROPRIATE PERMISSIONS
-- ============================================================================

-- Grant read access to authenticated users
GRANT SELECT ON public.username_quarantine TO authenticated;
GRANT SELECT ON public.username_changes TO authenticated;

-- Grant full access to service_role
GRANT ALL ON public.username_quarantine TO service_role;
GRANT ALL ON public.username_changes TO service_role;

-- Grant execute on function to authenticated users
GRANT EXECUTE ON FUNCTION public.is_username_quarantined(text) TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify the fix)
-- ============================================================================

-- Check RLS is enabled
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE tablename IN ('username_quarantine', 'username_changes');

-- Check policies exist
-- SELECT schemaname, tablename, policyname
-- FROM pg_policies
-- WHERE tablename IN ('username_quarantine', 'username_changes');

-- Check function search_path
-- SELECT proname, prosecdef, proconfig
-- FROM pg_proc
-- WHERE proname = 'is_username_quarantined';
