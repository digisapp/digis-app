-- =============================================================================
-- RLS POLICIES MIGRATION - PART 1: CORE TABLES
-- =============================================================================
-- IMPORTANT: Run migrations in this order:
--   00_audit_database.sql (to verify what needs fixing)
--   01_helper_functions.sql (reusable policy predicates)
--   02_performance_indexes.sql (BEFORE enabling RLS!)
--   03_rls_policies_part1_core.sql (THIS FILE - core user/auth tables)
--   04_rls_policies_part2_content.sql (content and commerce tables)
--   05_rls_policies_part3_enable.sql (enable RLS on all tables)
--   06_storage_policies.sql (Supabase Storage bucket policies)
--
-- Safe Order: CREATE POLICIES → GRANT PERMISSIONS → ENABLE RLS
-- This prevents bricking the app (RLS defaults to deny-all)
-- =============================================================================

BEGIN;

-- =============================================================================
-- GRANT BASE SCHEMA AND TABLE PERMISSIONS
-- =============================================================================
-- PostgREST requires these grants before RLS can work
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO authenticated;

-- =============================================================================
-- USERS TABLE POLICIES
-- =============================================================================
-- Pattern: Public read (discovery), private write (own profile only)

DROP POLICY IF EXISTS "Users can view all profiles" ON public.users;
CREATE POLICY "Users can view all profiles"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (is_owner(supabase_id))
  WITH CHECK (is_owner(supabase_id));

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (is_owner(supabase_id));

DROP POLICY IF EXISTS "Prevent profile deletion" ON public.users;
CREATE POLICY "Prevent profile deletion"
  ON public.users
  FOR DELETE
  TO authenticated
  USING (false);

-- =============================================================================
-- BLOCKED_USERS TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own blocks" ON public.blocked_users;
CREATE POLICY "Users can view own blocks"
  ON public.blocked_users
  FOR SELECT
  TO authenticated
  USING (
    blocker_id = current_user_db_id()
  );

DROP POLICY IF EXISTS "Users can block others" ON public.blocked_users;
CREATE POLICY "Users can block others"
  ON public.blocked_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    blocker_id = current_user_db_id()
    AND blocked_id != current_user_db_id()  -- Can't block self
  );

DROP POLICY IF EXISTS "Users can unblock" ON public.blocked_users;
CREATE POLICY "Users can unblock"
  ON public.blocked_users
  FOR DELETE
  TO authenticated
  USING (blocker_id = current_user_db_id());

-- =============================================================================
-- KYC_VERIFICATIONS TABLE POLICIES
-- =============================================================================
-- Pattern: Strictly private - users only see their own KYC data

DROP POLICY IF EXISTS "Users can view own KYC" ON public.kyc_verifications;
CREATE POLICY "Users can view own KYC"
  ON public.kyc_verifications
  FOR SELECT
  TO authenticated
  USING (user_id = current_user_db_id());

DROP POLICY IF EXISTS "Users can create own KYC" ON public.kyc_verifications;
CREATE POLICY "Users can create own KYC"
  ON public.kyc_verifications
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = current_user_db_id());

DROP POLICY IF EXISTS "Users can update own KYC" ON public.kyc_verifications;
CREATE POLICY "Users can update own KYC"
  ON public.kyc_verifications
  FOR UPDATE
  TO authenticated
  USING (user_id = current_user_db_id())
  WITH CHECK (user_id = current_user_db_id());

-- =============================================================================
-- TAX_DOCUMENTS TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own tax documents" ON public.tax_documents;
CREATE POLICY "Users can view own tax documents"
  ON public.tax_documents
  FOR SELECT
  TO authenticated
  USING (user_id = current_user_db_id());

DROP POLICY IF EXISTS "Users can create tax documents" ON public.tax_documents;
CREATE POLICY "Users can create tax documents"
  ON public.tax_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = current_user_db_id());

-- =============================================================================
-- CREATOR_APPLICATIONS TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own applications" ON public.creator_applications;
CREATE POLICY "Users can view own applications"
  ON public.creator_applications
  FOR SELECT
  TO authenticated
  USING (user_id = current_user_db_id());

DROP POLICY IF EXISTS "Users can apply to be creator" ON public.creator_applications;
CREATE POLICY "Users can apply to be creator"
  ON public.creator_applications
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = current_user_db_id());

DROP POLICY IF EXISTS "Users can update own applications" ON public.creator_applications;
CREATE POLICY "Users can update own applications"
  ON public.creator_applications
  FOR UPDATE
  TO authenticated
  USING (user_id = current_user_db_id())
  WITH CHECK (user_id = current_user_db_id());

-- =============================================================================
-- USER_IMAGES TABLE POLICIES
-- =============================================================================
-- Pattern: Public read for profile images, private write

DROP POLICY IF EXISTS "Anyone can view user images" ON public.user_images;
CREATE POLICY "Anyone can view user images"
  ON public.user_images
  FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Users can upload images" ON public.user_images;
CREATE POLICY "Users can upload images"
  ON public.user_images
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = current_user_db_id());

DROP POLICY IF EXISTS "Users can delete own images" ON public.user_images;
CREATE POLICY "Users can delete own images"
  ON public.user_images
  FOR DELETE
  TO authenticated
  USING (user_id = current_user_db_id());

-- =============================================================================
-- FOLLOWS TABLE POLICIES
-- =============================================================================
-- Pattern: Public read (follower counts), users control their own follows

DROP POLICY IF EXISTS "Anyone can view follows" ON public.follows;
CREATE POLICY "Anyone can view follows"
  ON public.follows
  FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Users can follow others" ON public.follows;
CREATE POLICY "Users can follow others"
  ON public.follows
  FOR INSERT
  TO authenticated
  WITH CHECK (
    follower_id = current_user_db_id()
    AND follower_id != following_id  -- Can't follow self
  );

DROP POLICY IF EXISTS "Users can unfollow" ON public.follows;
CREATE POLICY "Users can unfollow"
  ON public.follows
  FOR DELETE
  TO authenticated
  USING (follower_id = current_user_db_id());

-- =============================================================================
-- SUBSCRIPTIONS TABLE POLICIES
-- =============================================================================
-- Pattern: Subscribers and creators can see their own subscription relationships

DROP POLICY IF EXISTS "Users can view related subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view related subscriptions"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (
    subscriber_id = current_user_db_id()
    OR creator_id = current_user_db_id()
  );

DROP POLICY IF EXISTS "Users can subscribe to creators" ON public.subscriptions;
CREATE POLICY "Users can subscribe to creators"
  ON public.subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    subscriber_id = current_user_db_id()
    AND subscriber_id != creator_id  -- Can't subscribe to self
  );

DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can update own subscriptions"
  ON public.subscriptions
  FOR UPDATE
  TO authenticated
  USING (subscriber_id = current_user_db_id())
  WITH CHECK (subscriber_id = current_user_db_id());

DROP POLICY IF EXISTS "Users can cancel subscriptions" ON public.subscriptions;
CREATE POLICY "Users can cancel subscriptions"
  ON public.subscriptions
  FOR DELETE
  TO authenticated
  USING (subscriber_id = current_user_db_id());

-- =============================================================================
-- CREATOR_SUBSCRIPTIONS TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view creator subscriptions" ON public.creator_subscriptions;
CREATE POLICY "Users can view creator subscriptions"
  ON public.creator_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    user_id = current_user_db_id()
    OR creator_id = current_user_db_id()
  );

DROP POLICY IF EXISTS "Users can create creator subscriptions" ON public.creator_subscriptions;
CREATE POLICY "Users can create creator subscriptions"
  ON public.creator_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = current_user_db_id()
    AND user_id != creator_id
  );

DROP POLICY IF EXISTS "Users can update creator subscriptions" ON public.creator_subscriptions;
CREATE POLICY "Users can update creator subscriptions"
  ON public.creator_subscriptions
  FOR UPDATE
  TO authenticated
  USING (user_id = current_user_db_id())
  WITH CHECK (user_id = current_user_db_id());

-- =============================================================================
-- SUBSCRIPTION_TIER_BENEFITS TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Anyone can view tier benefits" ON public.subscription_tier_benefits;
CREATE POLICY "Anyone can view tier benefits"
  ON public.subscription_tier_benefits
  FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Creators can manage tier benefits" ON public.subscription_tier_benefits;
CREATE POLICY "Creators can manage tier benefits"
  ON public.subscription_tier_benefits
  FOR ALL
  TO authenticated
  USING (
    is_creator()
    AND creator_id = current_user_db_id()
  )
  WITH CHECK (
    is_creator()
    AND creator_id = current_user_db_id()
  );

-- =============================================================================
-- SUBSCRIPTION_TIER_PRICING TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Anyone can view tier pricing" ON public.subscription_tier_pricing;
CREATE POLICY "Anyone can view tier pricing"
  ON public.subscription_tier_pricing
  FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Creators can manage tier pricing" ON public.subscription_tier_pricing;
CREATE POLICY "Creators can manage tier pricing"
  ON public.subscription_tier_pricing
  FOR ALL
  TO authenticated
  USING (
    is_creator()
    AND creator_id = current_user_db_id()
  )
  WITH CHECK (
    is_creator()
    AND creator_id = current_user_db_id()
  );

-- =============================================================================
-- CONVERSATIONS TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
CREATE POLICY "Users can view own conversations"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (
    participant1_id = current_user_db_id()
    OR participant2_id = current_user_db_id()
  );

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    participant1_id = current_user_db_id()
    OR participant2_id = current_user_db_id()
  );

DROP POLICY IF EXISTS "Participants can update conversations" ON public.conversations;
CREATE POLICY "Participants can update conversations"
  ON public.conversations
  FOR UPDATE
  TO authenticated
  USING (
    participant1_id = current_user_db_id()
    OR participant2_id = current_user_db_id()
  )
  WITH CHECK (
    participant1_id = current_user_db_id()
    OR participant2_id = current_user_db_id()
  );

-- =============================================================================
-- CHAT_MESSAGES TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view messages in conversations" ON public.chat_messages;
CREATE POLICY "Users can view messages in conversations"
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "Users can send messages" ON public.chat_messages;
CREATE POLICY "Users can send messages"
  ON public.chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = current_user_db_id()
    AND is_conversation_participant(conversation_id)
  );

DROP POLICY IF EXISTS "Users can update own messages" ON public.chat_messages;
CREATE POLICY "Users can update own messages"
  ON public.chat_messages
  FOR UPDATE
  TO authenticated
  USING (sender_id = current_user_db_id())
  WITH CHECK (sender_id = current_user_db_id());

DROP POLICY IF EXISTS "Users can delete own messages" ON public.chat_messages;
CREATE POLICY "Users can delete own messages"
  ON public.chat_messages
  FOR DELETE
  TO authenticated
  USING (sender_id = current_user_db_id());

-- =============================================================================
-- NOTIFICATIONS TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = current_user_db_id());

DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
CREATE POLICY "System can create notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);  -- Backend handles validation

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = current_user_db_id())
  WITH CHECK (user_id = current_user_db_id());

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (user_id = current_user_db_id());

COMMIT;

-- =============================================================================
-- VERIFICATION
-- =============================================================================
-- Check created policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'users', 'blocked_users', 'kyc_verifications', 'tax_documents',
    'creator_applications', 'user_images', 'follows', 'subscriptions',
    'creator_subscriptions', 'subscription_tier_benefits',
    'subscription_tier_pricing', 'conversations', 'chat_messages',
    'notifications'
  )
ORDER BY tablename, policyname;
