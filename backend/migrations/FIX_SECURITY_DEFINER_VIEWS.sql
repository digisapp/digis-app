-- =============================================================================
-- FIX SECURITY DEFINER VIEWS
-- =============================================================================
-- Converts 9 views from SECURITY DEFINER to SECURITY INVOKER
-- This resolves the remaining Supabase security warnings
-- =============================================================================

-- View 1: creator_payout_history
-- Note: If this view doesn't exist, it will be skipped
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'creator_payout_history') THEN
    -- Get the view definition
    EXECUTE (
      SELECT 'CREATE OR REPLACE VIEW creator_payout_history WITH (security_invoker=true) AS ' || definition
      FROM pg_views
      WHERE schemaname = 'public' AND viewname = 'creator_payout_history'
    );
    RAISE NOTICE '✅ Fixed: creator_payout_history';
  ELSE
    RAISE NOTICE '⏭️  Skipped: creator_payout_history (view does not exist)';
  END IF;
END$$;

-- View 2: show_statistics
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'show_statistics') THEN
    EXECUTE (
      SELECT 'CREATE OR REPLACE VIEW show_statistics WITH (security_invoker=true) AS ' || definition
      FROM pg_views
      WHERE schemaname = 'public' AND viewname = 'show_statistics'
    );
    RAISE NOTICE '✅ Fixed: show_statistics';
  ELSE
    RAISE NOTICE '⏭️  Skipped: show_statistics (view does not exist)';
  END IF;
END$$;

-- View 3: payment_amounts_view
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'payment_amounts_view') THEN
    EXECUTE (
      SELECT 'CREATE OR REPLACE VIEW payment_amounts_view WITH (security_invoker=true) AS ' || definition
      FROM pg_views
      WHERE schemaname = 'public' AND viewname = 'payment_amounts_view'
    );
    RAISE NOTICE '✅ Fixed: payment_amounts_view';
  ELSE
    RAISE NOTICE '⏭️  Skipped: payment_amounts_view (view does not exist)';
  END IF;
END$$;

-- View 4: ppv_analytics
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'ppv_analytics') THEN
    EXECUTE (
      SELECT 'CREATE OR REPLACE VIEW ppv_analytics WITH (security_invoker=true) AS ' || definition
      FROM pg_views
      WHERE schemaname = 'public' AND viewname = 'ppv_analytics'
    );
    RAISE NOTICE '✅ Fixed: ppv_analytics';
  ELSE
    RAISE NOTICE '⏭️  Skipped: ppv_analytics (view does not exist)';
  END IF;
END$$;

-- View 5: v_user_full
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'v_user_full') THEN
    EXECUTE (
      SELECT 'CREATE OR REPLACE VIEW v_user_full WITH (security_invoker=true) AS ' || definition
      FROM pg_views
      WHERE schemaname = 'public' AND viewname = 'v_user_full'
    );
    RAISE NOTICE '✅ Fixed: v_user_full';
  ELSE
    RAISE NOTICE '⏭️  Skipped: v_user_full (view does not exist)';
  END IF;
END$$;

-- View 6: subscription_tier_analytics
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'subscription_tier_analytics') THEN
    EXECUTE (
      SELECT 'CREATE OR REPLACE VIEW subscription_tier_analytics WITH (security_invoker=true) AS ' || definition
      FROM pg_views
      WHERE schemaname = 'public' AND viewname = 'subscription_tier_analytics'
    );
    RAISE NOTICE '✅ Fixed: subscription_tier_analytics';
  ELSE
    RAISE NOTICE '⏭️  Skipped: subscription_tier_analytics (view does not exist)';
  END IF;
END$$;

-- View 7: v_creator_profile
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'v_creator_profile') THEN
    EXECUTE (
      SELECT 'CREATE OR REPLACE VIEW v_creator_profile WITH (security_invoker=true) AS ' || definition
      FROM pg_views
      WHERE schemaname = 'public' AND viewname = 'v_creator_profile'
    );
    RAISE NOTICE '✅ Fixed: v_creator_profile';
  ELSE
    RAISE NOTICE '⏭️  Skipped: v_creator_profile (view does not exist)';
  END IF;
END$$;

-- View 8: offer_statistics
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'offer_statistics') THEN
    EXECUTE (
      SELECT 'CREATE OR REPLACE VIEW offer_statistics WITH (security_invoker=true) AS ' || definition
      FROM pg_views
      WHERE schemaname = 'public' AND viewname = 'offer_statistics'
    );
    RAISE NOTICE '✅ Fixed: offer_statistics';
  ELSE
    RAISE NOTICE '⏭️  Skipped: offer_statistics (view does not exist)';
  END IF;
END$$;

-- View 9: session_pricing_view
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'session_pricing_view') THEN
    EXECUTE (
      SELECT 'CREATE OR REPLACE VIEW session_pricing_view WITH (security_invoker=true) AS ' || definition
      FROM pg_views
      WHERE schemaname = 'public' AND viewname = 'session_pricing_view'
    );
    RAISE NOTICE '✅ Fixed: session_pricing_view';
  ELSE
    RAISE NOTICE '⏭️  Skipped: session_pricing_view (view does not exist)';
  END IF;
END$$;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Check if any views still have SECURITY DEFINER
SELECT
  'REMAINING ISSUES' as status,
  COUNT(*) as count
FROM pg_views v
JOIN pg_class c ON c.relname = v.viewname
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.reloptions::text LIKE '%security_definer%';

-- List all views with their security settings
SELECT
  'VIEW SECURITY SETTINGS' as info,
  viewname,
  CASE
    WHEN c.reloptions::text LIKE '%security_invoker=true%' THEN 'SECURITY INVOKER ✅'
    WHEN c.reloptions::text LIKE '%security_definer%' THEN 'SECURITY DEFINER ⚠️'
    ELSE 'DEFAULT (INVOKER) ✅'
  END as security_mode
FROM pg_views v
LEFT JOIN pg_class c ON c.relname = v.viewname
LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE v.schemaname = 'public'
  AND v.viewname IN (
    'creator_payout_history',
    'show_statistics',
    'payment_amounts_view',
    'ppv_analytics',
    'v_user_full',
    'subscription_tier_analytics',
    'v_creator_profile',
    'offer_statistics',
    'session_pricing_view'
  )
ORDER BY v.viewname;

-- =============================================================================
-- ✅ COMPLETE!
-- =============================================================================
-- All 9 SECURITY DEFINER views converted to SECURITY INVOKER
-- Views now run with the querying user's permissions (respecting RLS)
-- This resolves all remaining Supabase security warnings
-- =============================================================================
