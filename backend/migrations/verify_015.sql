-- Verification query for migration 015
-- Run this in Supabase SQL Editor to confirm the fix

SELECT
  proname as function_name,
  prosecdef as is_security_definer,
  proconfig as configuration
FROM pg_proc
WHERE proname IN ('cached_auth_uid', 'get_current_user_db_id')
  AND pronamespace = 'public'::regnamespace
ORDER BY proname;

-- Expected output:
-- function_name            | is_security_definer | configuration
-- -------------------------|---------------------|-------------------
-- cached_auth_uid          | t                   | {search_path=public}
-- get_current_user_db_id   | t                   | {search_path=public}
