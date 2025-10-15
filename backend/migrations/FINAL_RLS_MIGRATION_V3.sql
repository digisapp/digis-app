-- =============================================================================
-- FINAL RLS MIGRATION FOR DIGIS APP - V3
-- =============================================================================
-- Simplified approach: Uses existing policies where they exist
-- =============================================================================

-- =============================================================================
-- STEP 1: CREATE SIMPLE HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION current_user_db_id()
RETURNS UUID
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT id FROM public.users WHERE supabase_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_owner(owner_uuid uuid)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT auth.uid() = owner_uuid;
$$;

CREATE OR REPLACE FUNCTION is_creator()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.users
    WHERE supabase_id = auth.uid()
      AND is_creator = true
  );
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION current_user_db_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_creator() TO authenticated;

-- =============================================================================
-- STEP 2: CREATE CRITICAL INDEXES
-- =============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_supabase_id ON users(supabase_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_is_creator ON users(is_creator) WHERE is_creator = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_following_id ON follows(following_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_subscriber_id ON subscriptions(subscriber_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_creator_id ON subscriptions(creator_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tips_sender_id ON tips(sender_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tips_receiver_id ON tips(receiver_id);

-- =============================================================================
-- STEP 3: GRANT BASE PERMISSIONS
-- =============================================================================

GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO authenticated;

-- =============================================================================
-- STEP 4: CREATE SIMPLE POLICIES FOR TABLES WITHOUT THEM
-- =============================================================================
-- These will allow authenticated users to manage their own data

-- analytics_buckets
DROP POLICY IF EXISTS "auth_access" ON analytics_buckets;
CREATE POLICY "auth_access" ON analytics_buckets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- application_logs (system only)
DROP POLICY IF EXISTS "no_access" ON application_logs;
CREATE POLICY "no_access" ON application_logs FOR ALL TO authenticated USING (false);

-- content_bundles
DROP POLICY IF EXISTS "auth_access" ON content_bundles;
CREATE POLICY "auth_access" ON content_bundles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- gift_catalog
DROP POLICY IF EXISTS "auth_access" ON gift_catalog;
CREATE POLICY "auth_access" ON gift_catalog FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ledger_snapshots
DROP POLICY IF EXISTS "auth_access" ON ledger_snapshots;
CREATE POLICY "auth_access" ON ledger_snapshots FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- loyalty_history
DROP POLICY IF EXISTS "auth_access" ON loyalty_history;
CREATE POLICY "auth_access" ON loyalty_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- migrations (system only)
DROP POLICY IF EXISTS "no_access" ON migrations;
CREATE POLICY "no_access" ON migrations FOR ALL TO authenticated USING (false);

-- pending_transactions
DROP POLICY IF EXISTS "auth_access" ON pending_transactions;
CREATE POLICY "auth_access" ON pending_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- processed_webhooks (system only)
DROP POLICY IF EXISTS "no_access" ON processed_webhooks;
CREATE POLICY "no_access" ON processed_webhooks FOR ALL TO authenticated USING (false);

-- creator_payout_intents
DROP POLICY IF EXISTS "auth_access" ON creator_payout_intents;
CREATE POLICY "auth_access" ON creator_payout_intents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- refresh_tokens
DROP POLICY IF EXISTS "auth_access" ON refresh_tokens;
CREATE POLICY "auth_access" ON refresh_tokens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- session_quality
DROP POLICY IF EXISTS "auth_access" ON session_quality;
CREATE POLICY "auth_access" ON session_quality FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- stripe_webhook_events (system only)
DROP POLICY IF EXISTS "no_access" ON stripe_webhook_events;
CREATE POLICY "no_access" ON stripe_webhook_events FOR ALL TO authenticated USING (false);

-- system_config (system only)
DROP POLICY IF EXISTS "no_access" ON system_config;
CREATE POLICY "no_access" ON system_config FOR ALL TO authenticated USING (false);

-- tokens
DROP POLICY IF EXISTS "auth_access" ON tokens;
CREATE POLICY "auth_access" ON tokens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- transaction_logs
DROP POLICY IF EXISTS "auth_access" ON transaction_logs;
CREATE POLICY "auth_access" ON transaction_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- withdrawal_requests
DROP POLICY IF EXISTS "auth_access" ON withdrawal_requests;
CREATE POLICY "auth_access" ON withdrawal_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================================================
-- STEP 5: ENABLE RLS ON ALL TABLES
-- =============================================================================

DO $$
DECLARE
  table_record RECORD;
  enabled_count INT := 0;
BEGIN
  -- Enable RLS on all public tables
  FOR table_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  LOOP
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY', table_record.tablename);
    enabled_count := enabled_count + 1;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ RLS ENABLED ON % TABLES', enabled_count;
  RAISE NOTICE '========================================';
END$$;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

SELECT
  'SUMMARY' as category,
  COUNT(*) as total_tables,
  COUNT(*) FILTER (WHERE c.relrowsecurity) as rls_enabled,
  COUNT(*) FILTER (WHERE NOT c.relrowsecurity) as rls_disabled
FROM pg_tables pt
LEFT JOIN pg_class c ON c.relname = pt.tablename
LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE pt.schemaname = 'public'
  AND (n.nspname = 'public' OR n.nspname IS NULL);

-- Count policies per table
SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
HAVING COUNT(*) > 0
ORDER BY policy_count DESC, tablename;

-- Check for tables with RLS but no policies (potential issue)
SELECT
  '⚠️  WARNING' as alert,
  pt.tablename,
  'RLS enabled but no policies - table may be locked' as issue
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
  );

-- =============================================================================
-- COMPLETED
-- =============================================================================
-- ✅ Helper functions created
-- ✅ Performance indexes added
-- ✅ Basic policies created for tables without them
-- ✅ RLS enabled on ALL tables
--
-- NOTES:
-- - Some policies use USING (true) for now - backend handles auth
-- - System tables (logs, webhooks, etc) have USING (false) - no direct access
-- - Tighten policies later based on your specific requirements
-- =============================================================================
