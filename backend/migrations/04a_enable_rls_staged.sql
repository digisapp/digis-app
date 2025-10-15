-- =============================================================================
-- STAGED RLS ENABLEMENT - LOW BLAST RADIUS ROLLOUT
-- =============================================================================
-- This is a safer alternative to 04_enable_rls.sql
-- Enables RLS in small batches so you can test between each stage
-- =============================================================================

-- =============================================================================
-- STAGE 0: VERIFICATION (Run this first)
-- =============================================================================
-- Verify all prerequisites are met before enabling RLS

-- Check: Helper functions exist
SELECT
  'HELPER FUNCTIONS' as check_name,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) >= 8 THEN '✅ PASS'
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
    'owns_content',
    'is_conversation_participant'
  );

-- Check: Indexes exist
SELECT
  'PERFORMANCE INDEXES' as check_name,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) >= 20 THEN '✅ PASS'
    ELSE '❌ FAIL - Run 02_performance_indexes.sql first'
  END as status
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%';

-- Check: Policies exist
SELECT
  'RLS POLICIES' as check_name,
  COUNT(DISTINCT tablename) as tables_with_policies,
  CASE
    WHEN COUNT(DISTINCT tablename) >= 10 THEN '✅ PASS'
    ELSE '❌ FAIL - Run 03_rls_policies_part1_core.sql first'
  END as status
FROM pg_policies
WHERE schemaname = 'public';

-- Check: JWT -> DB identity mapping
SELECT
  'SUPABASE_ID MAPPING' as check_name,
  COUNT(*) as users_with_supabase_id,
  CASE
    WHEN COUNT(*) > 0 AND COUNT(*) = COUNT(supabase_id) THEN '✅ PASS'
    WHEN COUNT(*) = 0 THEN '⚠️ WARNING - No users yet'
    ELSE '❌ FAIL - Some users missing supabase_id'
  END as status
FROM public.users;

-- Check: Index on supabase_id
SELECT
  'SUPABASE_ID INDEX' as check_name,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ PASS'
    ELSE '❌ FAIL - Missing index on users(supabase_id)'
  END as status
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'users'
  AND indexdef LIKE '%supabase_id%';

-- =============================================================================
-- STAGE 1: CROWN JEWELS (Core auth & identity tables)
-- =============================================================================
-- Enable RLS on critical tables that have policies
-- Test thoroughly before proceeding to Stage 2

BEGIN;

DO $$
BEGIN
  RAISE NOTICE '=== STAGE 1: Enabling RLS on Crown Jewel Tables ===';

  -- Users & Auth
  ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ users';

  ALTER TABLE IF EXISTS public.blocked_users ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ blocked_users';

  -- Follows & Subscriptions
  ALTER TABLE IF EXISTS public.follows ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ follows';

  ALTER TABLE IF EXISTS public.subscriptions ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ subscriptions';

  ALTER TABLE IF EXISTS public.creator_subscriptions ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ creator_subscriptions';

  -- Messaging
  ALTER TABLE IF EXISTS public.conversations ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ conversations';

  ALTER TABLE IF EXISTS public.chat_messages ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ chat_messages';

  ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ notifications';

  RAISE NOTICE '=== STAGE 1 COMPLETE ===';
  RAISE NOTICE 'Test your app now before proceeding to Stage 2!';
END$$;

COMMIT;

-- Verification: Check enabled tables
SELECT
  'STAGE 1 VERIFICATION' as stage,
  tablename,
  CASE WHEN c.relrowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END as rls_status,
  (SELECT COUNT(*) FROM pg_policies pp WHERE pp.tablename = pt.tablename) as policy_count
FROM pg_tables pt
LEFT JOIN pg_class c ON c.relname = pt.tablename
WHERE pt.schemaname = 'public'
  AND pt.tablename IN (
    'users', 'blocked_users', 'follows', 'subscriptions',
    'creator_subscriptions', 'conversations', 'chat_messages', 'notifications'
  )
ORDER BY pt.tablename;

-- =============================================================================
-- SMOKE TEST CHECKLIST FOR STAGE 1
-- =============================================================================
-- ⚠️ STOP HERE AND TEST BEFORE PROCEEDING ⚠️
--
-- Test these user flows:
-- [ ] Login (fan and creator accounts)
-- [ ] View user profiles
-- [ ] Update own profile
-- [ ] Follow/unfollow creators
-- [ ] Subscribe/unsubscribe
-- [ ] Send/receive messages
-- [ ] View notifications
-- [ ] Verify you CANNOT:
--     - Update other users' profiles
--     - See others' private messages
--     - See others' subscription details
--
-- If all tests pass, proceed to Stage 2
-- If tests fail, check policies and fix before continuing
-- =============================================================================

-- =============================================================================
-- STAGE 2: PAYMENTS & FINANCIAL (After Stage 1 tests pass)
-- =============================================================================
-- Uncomment and run after Stage 1 is stable

/*
BEGIN;

DO $$
BEGIN
  RAISE NOTICE '=== STAGE 2: Enabling RLS on Financial Tables ===';

  -- Financial tables (highly sensitive!)
  ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ payments';

  ALTER TABLE IF EXISTS public.token_transactions ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ token_transactions';

  ALTER TABLE IF EXISTS public.tips ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ tips';

  ALTER TABLE IF EXISTS public.purchases ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ purchases';

  -- KYC & Tax (very sensitive!)
  ALTER TABLE IF EXISTS public.kyc_verifications ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ kyc_verifications';

  ALTER TABLE IF EXISTS public.tax_documents ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ tax_documents';

  RAISE NOTICE '=== STAGE 2 COMPLETE ===';
  RAISE NOTICE 'Test payment flows before proceeding to Stage 3!';
END$$;

COMMIT;

-- Test checklist:
-- [ ] Purchase tokens
-- [ ] View transaction history
-- [ ] Send/receive tips
-- [ ] Verify CANNOT see others' payments/transactions
*/

-- =============================================================================
-- STAGE 3: CONTENT & CREATOR FEATURES (After Stage 2 tests pass)
-- =============================================================================

/*
BEGIN;

DO $$
BEGIN
  RAISE NOTICE '=== STAGE 3: Enabling RLS on Content Tables ===';

  -- Content
  ALTER TABLE IF EXISTS public.content_uploads ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ content_uploads';

  ALTER TABLE IF EXISTS public.content_access_logs ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ content_access_logs';

  ALTER TABLE IF EXISTS public.file_uploads ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ file_uploads';

  ALTER TABLE IF EXISTS public.user_images ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ user_images';

  -- Creator features
  ALTER TABLE IF EXISTS public.creator_cards ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ creator_cards';

  ALTER TABLE IF EXISTS public.creator_offers ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ creator_offers';

  ALTER TABLE IF EXISTS public.offer_bookings ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ offer_bookings';

  ALTER TABLE IF EXISTS public.offer_purchases ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ offer_purchases';

  ALTER TABLE IF EXISTS public.offer_reviews ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ offer_reviews';

  ALTER TABLE IF EXISTS public.offer_favorites ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ offer_favorites';

  ALTER TABLE IF EXISTS public.creator_applications ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ creator_applications';

  RAISE NOTICE '=== STAGE 3 COMPLETE ===';
  RAISE NOTICE 'Test content access before proceeding to Stage 4!';
END$$;

COMMIT;

-- Test checklist:
-- [ ] Upload content (as creator)
-- [ ] View public content
-- [ ] View subscriber-only content (with subscription)
-- [ ] Verify CANNOT access subscriber content without subscription
-- [ ] Create/book offers
-- [ ] Apply to be creator
*/

-- =============================================================================
-- STAGE 4: STREAMING & CLASSES (After Stage 3 tests pass)
-- =============================================================================

/*
BEGIN;

DO $$
BEGIN
  RAISE NOTICE '=== STAGE 4: Enabling RLS on Streaming/Classes Tables ===';

  -- Streaming
  ALTER TABLE IF EXISTS public.stream_sessions ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ stream_sessions';

  ALTER TABLE IF EXISTS public.stream_products ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ stream_products';

  ALTER TABLE IF EXISTS public.stream_recording_purchases ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ stream_recording_purchases';

  ALTER TABLE IF EXISTS public.live_purchases ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ live_purchases';

  ALTER TABLE IF EXISTS public.product_showcase_events ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ product_showcase_events';

  ALTER TABLE IF EXISTS public.flash_sales ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ flash_sales';

  -- Classes
  ALTER TABLE IF EXISTS public.classes ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ classes';

  ALTER TABLE IF EXISTS public.class_enrollments ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ class_enrollments';

  ALTER TABLE IF EXISTS public.class_reviews ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ class_reviews';

  -- Shopping interactions
  ALTER TABLE IF EXISTS public.shopping_interactions ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ shopping_interactions';

  ALTER TABLE IF EXISTS public.shopping_interaction_responses ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ shopping_interaction_responses';

  ALTER TABLE IF EXISTS public.shop_reviews ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ shop_reviews';

  RAISE NOTICE '=== STAGE 4 COMPLETE ===';
  RAISE NOTICE 'Test streaming/classes before proceeding to Stage 5!';
END$$;

COMMIT;

-- Test checklist:
-- [ ] Start/stop live stream
-- [ ] Join live stream as viewer
-- [ ] Purchase from live stream
-- [ ] Enroll in class
-- [ ] Leave class review
*/

-- =============================================================================
-- STAGE 5: ANALYTICS & METADATA (After Stage 4 tests pass)
-- =============================================================================

/*
BEGIN;

DO $$
BEGIN
  RAISE NOTICE '=== STAGE 5: Enabling RLS on Analytics Tables ===';

  -- Analytics
  ALTER TABLE IF EXISTS public.creator_analytics ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ creator_analytics';

  ALTER TABLE IF EXISTS public.stream_analytics ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ stream_analytics';

  ALTER TABLE IF EXISTS public.stream_analytics_v2 ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ stream_analytics_v2';

  ALTER TABLE IF EXISTS public.offer_analytics ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ offer_analytics';

  ALTER TABLE IF EXISTS public.page_views ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ page_views';

  ALTER TABLE IF EXISTS public.custom_metrics ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ custom_metrics';

  ALTER TABLE IF EXISTS public.analytics_buckets ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ analytics_buckets';

  -- Metadata
  ALTER TABLE IF EXISTS public.session_metrics ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ session_metrics';

  ALTER TABLE IF EXISTS public.fan_notes ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ fan_notes';

  ALTER TABLE IF EXISTS public.offer_notifications ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ offer_notifications';

  -- Tiers
  ALTER TABLE IF EXISTS public.subscription_tier_benefits ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ subscription_tier_benefits';

  ALTER TABLE IF EXISTS public.subscription_tier_pricing ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ subscription_tier_pricing';

  ALTER TABLE IF EXISTS public.gifter_tiers ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ gifter_tiers';

  ALTER TABLE IF EXISTS public.gifter_tier_history ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ gifter_tier_history';

  RAISE NOTICE '=== STAGE 5 COMPLETE ===';
  RAISE NOTICE 'Test analytics dashboards!';
END$$;

COMMIT;

-- Test checklist:
-- [ ] View creator dashboard/analytics (as creator)
-- [ ] Verify non-creators CANNOT see creator analytics
-- [ ] Check fan notes (creator feature)
-- [ ] View subscription tier info
*/

-- =============================================================================
-- STAGE 6: REMAINING TABLES (After Stage 5 tests pass)
-- =============================================================================

/*
BEGIN;

DO $$
BEGIN
  RAISE NOTICE '=== STAGE 6: Enabling RLS on Remaining Tables ===';

  -- System/logging
  ALTER TABLE IF EXISTS public.application_logs ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ application_logs';

  RAISE NOTICE '=== STAGE 6 COMPLETE ===';
  RAISE NOTICE 'All tables now have RLS enabled!';
END$$;

COMMIT;
*/

-- =============================================================================
-- FINAL VERIFICATION (Run after all stages complete)
-- =============================================================================

-- All tables should have RLS enabled
SELECT
  'FINAL STATUS' as category,
  schemaname,
  tablename,
  CASE
    WHEN c.relrowsecurity THEN '✅ ENABLED'
    ELSE '❌ DISABLED'
  END as rls_status,
  (SELECT COUNT(*) FROM pg_policies pp WHERE pp.schemaname = pt.schemaname AND pp.tablename = pt.tablename) as policy_count,
  CASE
    WHEN c.relrowsecurity AND NOT EXISTS (SELECT 1 FROM pg_policies pp WHERE pp.tablename = pt.tablename) THEN '⚠️ NO POLICIES!'
    ELSE ''
  END as warning
FROM pg_tables pt
LEFT JOIN pg_class c ON c.relname = pt.tablename
LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = pt.schemaname
WHERE pt.schemaname = 'public'
ORDER BY tablename;

-- Summary stats
SELECT
  'SUMMARY' as category,
  COUNT(*) as total_tables,
  COUNT(*) FILTER (WHERE c.relrowsecurity) as rls_enabled,
  COUNT(*) FILTER (WHERE NOT c.relrowsecurity) as rls_disabled,
  (SELECT COUNT(DISTINCT tablename) FROM pg_policies WHERE schemaname = 'public') as tables_with_policies
FROM pg_tables pt
LEFT JOIN pg_class c ON c.relname = pt.tablename
LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE pt.schemaname = 'public'
  AND n.nspname = 'public';

-- =============================================================================
-- ROLLBACK FOR SPECIFIC STAGE (if needed)
-- =============================================================================
-- If a stage breaks, disable RLS for just those tables:

-- Stage 1 rollback:
-- ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.blocked_users DISABLE ROW LEVEL SECURITY;
-- ... etc

-- Stage 2 rollback:
-- ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.token_transactions DISABLE ROW LEVEL SECURITY;
-- ... etc

-- =============================================================================
-- NOTES
-- =============================================================================
-- * Run each stage sequentially
-- * Test thoroughly between stages
-- * If a stage fails, fix policies before continuing
-- * You can rollback individual stages without affecting others
-- * Stage 1 is the most critical - take extra time testing it
-- * Stages 4-6 can be combined if you're confident
-- =============================================================================
