-- =============================================================================
-- FINAL RLS MIGRATION FOR DIGIS APP - V2
-- =============================================================================
-- Fixed: UUID types instead of INTEGER for user IDs
-- =============================================================================

-- =============================================================================
-- STEP 1: CREATE HELPER FUNCTIONS
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

CREATE OR REPLACE FUNCTION is_active_subscriber(creator_db_id uuid)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.subscriptions s
    JOIN public.users u ON u.id = s.subscriber_id
    WHERE s.creator_id = creator_db_id
      AND u.supabase_id = auth.uid()
      AND s.status = 'active'
      AND (s.expires_at IS NULL OR s.expires_at > NOW())
  );
$$;

CREATE OR REPLACE FUNCTION is_conversation_participant(conversation_id uuid)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.conversations c
    JOIN public.users u1 ON u1.id = c.participant1_id
    JOIN public.users u2 ON u2.id = c.participant2_id
    WHERE c.id = conversation_id
      AND (u1.supabase_id = auth.uid() OR u2.supabase_id = auth.uid())
  );
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION current_user_db_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_creator() TO authenticated;
GRANT EXECUTE ON FUNCTION is_active_subscriber(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_conversation_participant(uuid) TO authenticated;

-- =============================================================================
-- STEP 2: CREATE CRITICAL INDEXES
-- =============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_supabase_id ON users(supabase_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_is_creator ON users(is_creator) WHERE is_creator = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_following_id ON follows(following_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_subscriber_id ON subscriptions(subscriber_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_creator_id ON subscriptions(creator_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_participant1 ON conversations(participant1_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_participant2 ON conversations(participant2_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
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
-- STEP 4: CREATE POLICIES FOR TABLES WITHOUT THEM
-- =============================================================================

-- analytics_buckets
DROP POLICY IF EXISTS "Creators view analytics buckets" ON analytics_buckets;
CREATE POLICY "Creators view analytics buckets"
  ON analytics_buckets FOR SELECT
  TO authenticated
  USING (creator_id = current_user_db_id());

DROP POLICY IF EXISTS "System creates analytics buckets" ON analytics_buckets;
CREATE POLICY "System creates analytics buckets"
  ON analytics_buckets FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- application_logs
DROP POLICY IF EXISTS "No direct access to logs" ON application_logs;
CREATE POLICY "No direct access to logs"
  ON application_logs FOR ALL
  TO authenticated
  USING (false);

-- content_bundles
DROP POLICY IF EXISTS "View public bundles" ON content_bundles;
CREATE POLICY "View public bundles"
  ON content_bundles FOR SELECT
  TO authenticated
  USING (
    creator_id = current_user_db_id()
    OR is_active_subscriber(creator_id)
  );

DROP POLICY IF EXISTS "Creators manage bundles" ON content_bundles;
CREATE POLICY "Creators manage bundles"
  ON content_bundles FOR ALL
  TO authenticated
  USING (creator_id = current_user_db_id())
  WITH CHECK (creator_id = current_user_db_id());

-- gift_catalog
DROP POLICY IF EXISTS "Anyone views gift catalog" ON gift_catalog;
CREATE POLICY "Anyone views gift catalog"
  ON gift_catalog FOR SELECT
  TO authenticated
  USING (true);

-- ledger_snapshots
DROP POLICY IF EXISTS "Users view own ledger snapshots" ON ledger_snapshots;
CREATE POLICY "Users view own ledger snapshots"
  ON ledger_snapshots FOR SELECT
  TO authenticated
  USING (user_id = current_user_db_id());

-- loyalty_history
DROP POLICY IF EXISTS "Users view own loyalty history" ON loyalty_history;
CREATE POLICY "Users view own loyalty history"
  ON loyalty_history FOR SELECT
  TO authenticated
  USING (user_id = current_user_db_id());

-- migrations
DROP POLICY IF EXISTS "No direct access to migrations" ON migrations;
CREATE POLICY "No direct access to migrations"
  ON migrations FOR ALL
  TO authenticated
  USING (false);

-- pending_transactions
DROP POLICY IF EXISTS "Users view own pending transactions" ON pending_transactions;
CREATE POLICY "Users view own pending transactions"
  ON pending_transactions FOR SELECT
  TO authenticated
  USING (user_id = current_user_db_id());

-- processed_webhooks
DROP POLICY IF EXISTS "No direct access to webhooks" ON processed_webhooks;
CREATE POLICY "No direct access to webhooks"
  ON processed_webhooks FOR ALL
  TO authenticated
  USING (false);

-- creator_payout_intents
DROP POLICY IF EXISTS "Creators view own payout intents" ON creator_payout_intents;
CREATE POLICY "Creators view own payout intents"
  ON creator_payout_intents FOR SELECT
  TO authenticated
  USING (creator_id = current_user_db_id());

-- refresh_tokens
DROP POLICY IF EXISTS "Users manage own refresh tokens" ON refresh_tokens;
CREATE POLICY "Users manage own refresh tokens"
  ON refresh_tokens FOR ALL
  TO authenticated
  USING (user_id = current_user_db_id())
  WITH CHECK (user_id = current_user_db_id());

-- session_quality
DROP POLICY IF EXISTS "View session quality metrics" ON session_quality;
CREATE POLICY "View session quality metrics"
  ON session_quality FOR SELECT
  TO authenticated
  USING (true);

-- stripe_webhook_events
DROP POLICY IF EXISTS "No direct access to stripe webhooks" ON stripe_webhook_events;
CREATE POLICY "No direct access to stripe webhooks"
  ON stripe_webhook_events FOR ALL
  TO authenticated
  USING (false);

-- system_config
DROP POLICY IF EXISTS "No direct access to system config" ON system_config;
CREATE POLICY "No direct access to system config"
  ON system_config FOR ALL
  TO authenticated
  USING (false);

-- tokens
DROP POLICY IF EXISTS "Users view own tokens" ON tokens;
CREATE POLICY "Users view own tokens"
  ON tokens FOR SELECT
  TO authenticated
  USING (user_id = current_user_db_id());

-- transaction_logs
DROP POLICY IF EXISTS "Users view own transaction logs" ON transaction_logs;
CREATE POLICY "Users view own transaction logs"
  ON transaction_logs FOR SELECT
  TO authenticated
  USING (user_id = current_user_db_id());

-- withdrawal_requests
DROP POLICY IF EXISTS "Users view own withdrawal requests" ON withdrawal_requests;
CREATE POLICY "Users view own withdrawal requests"
  ON withdrawal_requests FOR SELECT
  TO authenticated
  USING (user_id = current_user_db_id());

DROP POLICY IF EXISTS "Users create withdrawal requests" ON withdrawal_requests;
CREATE POLICY "Users create withdrawal requests"
  ON withdrawal_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = current_user_db_id());

-- =============================================================================
-- STEP 5: ENABLE RLS ON ALL TABLES
-- =============================================================================

DO $$
BEGIN
  -- Stage 1: Core
  ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS blocked_users ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS kyc_verifications ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS tax_documents ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS user_images ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS follows ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS subscriptions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS creator_subscriptions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS subscription_tier_benefits ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS subscription_tier_pricing ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS conversations ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS chat_messages ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;

  RAISE NOTICE 'Stage 1: Core (13) ✅';

  -- Stage 2: Financial
  ALTER TABLE IF EXISTS payments ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS token_transactions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS tokens ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS tips ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS purchases ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS withdrawal_requests ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS pending_transactions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS transaction_logs ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS ledger_snapshots ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS creator_payout_intents ENABLE ROW LEVEL SECURITY;

  RAISE NOTICE 'Stage 2: Financial (10) ✅';

  -- Stage 3: Content
  ALTER TABLE IF EXISTS content_uploads ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS content_access_logs ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS content_bundles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS file_uploads ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS creator_cards ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS creator_offers ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS creator_applications ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS offer_bookings ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS offer_purchases ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS offer_reviews ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS offer_favorites ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS offer_analytics ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS offer_notifications ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS fan_notes ENABLE ROW LEVEL SECURITY;

  RAISE NOTICE 'Stage 3: Content (14) ✅';

  -- Stage 4: Streaming
  ALTER TABLE IF EXISTS stream_sessions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS stream_products ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS stream_recording_purchases ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS stream_analytics ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS stream_analytics_v2 ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS classes ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS class_enrollments ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS class_reviews ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS live_purchases ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS product_showcase_events ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS flash_sales ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS shopping_interactions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS shopping_interaction_responses ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS shop_reviews ENABLE ROW LEVEL SECURITY;

  RAISE NOTICE 'Stage 4: Streaming (14) ✅';

  -- Stage 5: Analytics
  ALTER TABLE IF EXISTS creator_analytics ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS page_views ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS custom_metrics ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS analytics_buckets ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS session_metrics ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS session_quality ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS gifter_tiers ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS gifter_tier_history ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS gift_catalog ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS loyalty_history ENABLE ROW LEVEL SECURITY;

  RAISE NOTICE 'Stage 5: Analytics (10) ✅';

  -- Stage 6: System
  ALTER TABLE IF EXISTS application_logs ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS migrations ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS processed_webhooks ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS stripe_webhook_events ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS system_config ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS refresh_tokens ENABLE ROW LEVEL SECURITY;

  RAISE NOTICE 'Stage 6: System (6) ✅';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ RLS MIGRATION COMPLETE!';
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

SELECT
  'Check for issues' as alert,
  pt.tablename,
  'RLS enabled but NO policies!' as issue
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
