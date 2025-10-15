-- =============================================================================
-- FIX FUNCTION SEARCH PATH WARNINGS
-- =============================================================================
-- Sets search_path on all functions to prevent schema injection attacks
-- This is a PostgreSQL security best practice
-- =============================================================================

-- Set search_path for the 3 helper functions we created
ALTER FUNCTION public.current_user_db_id() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_owner(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.is_creator() SET search_path = public, pg_temp;

-- Set search_path for all other user-defined functions
-- This batch update will fix all 48 remaining functions

DO $$
DECLARE
  func_record RECORD;
  fixed_count INT := 0;
BEGIN
  FOR func_record IN
    SELECT
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as function_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'  -- Only regular functions (not aggregates, procedures, etc.)
      AND p.proname NOT LIKE 'pg_%'  -- Exclude PostgreSQL internal functions
      AND p.proname NOT LIKE 'plpgsql_%'  -- Exclude PL/pgSQL internal functions
  LOOP
    BEGIN
      -- Set search_path to public, pg_temp (secure pattern)
      EXECUTE format(
        'ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_temp',
        func_record.schema_name,
        func_record.function_name,
        func_record.function_args
      );
      fixed_count := fixed_count + 1;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Skipped: %.% - %', func_record.schema_name, func_record.function_name, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '======================================';
  RAISE NOTICE '✅ Fixed search_path on % functions', fixed_count;
  RAISE NOTICE '======================================';
END$$;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Count functions still missing search_path
SELECT
  'REMAINING ISSUES' as status,
  COUNT(*) as functions_without_search_path
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND (p.proconfig IS NULL OR NOT EXISTS (
    SELECT 1 FROM unnest(p.proconfig) AS config
    WHERE config LIKE 'search_path=%'
  ));

-- Show fixed functions
SELECT
  'FIXED FUNCTIONS' as status,
  p.proname as function_name,
  unnest(p.proconfig) as config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND p.proconfig IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM unnest(p.proconfig) AS config
    WHERE config LIKE 'search_path=%'
  )
ORDER BY p.proname
LIMIT 10;

-- =============================================================================
-- ✅ COMPLETE!
-- =============================================================================
-- All functions now have secure search_path configuration
-- This prevents schema injection attacks
-- =============================================================================
