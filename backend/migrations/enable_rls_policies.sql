-- =============================================================================
-- DIGIS APP - ROW LEVEL SECURITY (RLS) MIGRATION
-- =============================================================================
-- This migration enables RLS on all public tables and creates appropriate
-- security policies based on the Digis application's authentication model.
--
-- IMPORTANT: This migration assumes:
-- 1. Authentication is handled via Supabase Auth (auth.users table)
-- 2. Users table has a supabase_id column linking to auth.uid()
-- 3. Creators and fans are differentiated via the is_creator column
--
-- Run this migration in Supabase SQL Editor or via migration tools
-- =============================================================================

-- =============================================================================
-- STEP 1: ENABLE RLS ON ALL PUBLIC TABLES
-- =============================================================================

-- User and Authentication Tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_images ENABLE ROW LEVEL SECURITY;

-- Subscription and Follow Tables
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_tier_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_tier_pricing ENABLE ROW LEVEL SECURITY;

-- Content Tables
ALTER TABLE public.content_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Creator Features Tables
ALTER TABLE public.creator_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_notifications ENABLE ROW LEVEL SECURITY;

-- Classes Tables
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_reviews ENABLE ROW LEVEL SECURITY;

-- Streaming and Sessions Tables
ALTER TABLE public.stream_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_analytics_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_recording_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_metrics ENABLE ROW LEVEL SECURITY;

-- Shopping and Commerce Tables
ALTER TABLE public.shopping_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_interaction_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_showcase_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flash_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_purchases ENABLE ROW LEVEL SECURITY;

-- Payment and Token Tables
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;

-- Gifter Tier Tables
ALTER TABLE public.gifter_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gifter_tier_history ENABLE ROW LEVEL SECURITY;

-- Communication Tables
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fan_notes ENABLE ROW LEVEL SECURITY;

-- Analytics and Tracking Tables
ALTER TABLE public.creator_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_buckets ENABLE ROW LEVEL SECURITY;

-- System and Logging Tables
ALTER TABLE public.application_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 2: CREATE RLS POLICIES FOR EACH TABLE
-- =============================================================================

-- -----------------------------------------------------------------------------
-- USERS TABLE POLICIES
-- -----------------------------------------------------------------------------
-- Users can view all other users (for discovery), but only modify their own
CREATE POLICY "Users can view all profiles"
  ON public.users FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (supabase_id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  WITH CHECK (supabase_id = auth.uid());

CREATE POLICY "Users cannot delete profiles"
  ON public.users FOR DELETE
  USING (false);

-- -----------------------------------------------------------------------------
-- BLOCKED USERS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view own blocked list"
  ON public.blocked_users FOR SELECT
  USING (blocker_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "Users can manage own blocks"
  ON public.blocked_users FOR INSERT
  WITH CHECK (blocker_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "Users can remove own blocks"
  ON public.blocked_users FOR DELETE
  USING (blocker_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- KYC VERIFICATIONS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view own KYC"
  ON public.kyc_verifications FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "Users can create own KYC"
  ON public.kyc_verifications FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "Users can update own KYC"
  ON public.kyc_verifications FOR UPDATE
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- TAX DOCUMENTS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view own tax documents"
  ON public.tax_documents FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "Users can create own tax documents"
  ON public.tax_documents FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- CREATOR APPLICATIONS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view own applications"
  ON public.creator_applications FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "Users can create applications"
  ON public.creator_applications FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "Users can update own applications"
  ON public.creator_applications FOR UPDATE
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- USER IMAGES POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Anyone can view user images"
  ON public.user_images FOR SELECT
  USING (true);

CREATE POLICY "Users can upload own images"
  ON public.user_images FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "Users can delete own images"
  ON public.user_images FOR DELETE
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- FOLLOWS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Anyone can view follows"
  ON public.follows FOR SELECT
  USING (true);

CREATE POLICY "Users can follow others"
  ON public.follows FOR INSERT
  WITH CHECK (follower_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "Users can unfollow"
  ON public.follows FOR DELETE
  USING (follower_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- SUBSCRIPTIONS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (
    subscriber_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    OR creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
  );

CREATE POLICY "Users can create subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (subscriber_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "Users can update own subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (subscriber_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "Users can cancel subscriptions"
  ON public.subscriptions FOR DELETE
  USING (subscriber_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- CREATOR SUBSCRIPTIONS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view creator subscriptions"
  ON public.creator_subscriptions FOR SELECT
  USING (
    user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    OR creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
  );

CREATE POLICY "Users can subscribe to creators"
  ON public.creator_subscriptions FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "Users can update own subscriptions"
  ON public.creator_subscriptions FOR UPDATE
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- SUBSCRIPTION TIER BENEFITS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Anyone can view tier benefits"
  ON public.subscription_tier_benefits FOR SELECT
  USING (true);

CREATE POLICY "Creators can manage tier benefits"
  ON public.subscription_tier_benefits FOR ALL
  USING (creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid() AND is_creator = true));

-- -----------------------------------------------------------------------------
-- SUBSCRIPTION TIER PRICING POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Anyone can view tier pricing"
  ON public.subscription_tier_pricing FOR SELECT
  USING (true);

CREATE POLICY "Creators can manage tier pricing"
  ON public.subscription_tier_pricing FOR ALL
  USING (creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid() AND is_creator = true));

-- -----------------------------------------------------------------------------
-- CONTENT UPLOADS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view accessible content"
  ON public.content_uploads FOR SELECT
  USING (
    -- Content owner can see all their content
    creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    OR
    -- Public content visible to all
    visibility = 'public'
    OR
    -- Subscribers can see subscriber-only content
    (visibility = 'subscribers' AND EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.creator_id = content_uploads.creator_id
      AND s.subscriber_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
      AND s.status = 'active'
    ))
  );

CREATE POLICY "Creators can upload content"
  ON public.content_uploads FOR INSERT
  WITH CHECK (creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid() AND is_creator = true));

CREATE POLICY "Creators can update own content"
  ON public.content_uploads FOR UPDATE
  USING (creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "Creators can delete own content"
  ON public.content_uploads FOR DELETE
  USING (creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- CONTENT ACCESS LOGS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view own access logs"
  ON public.content_access_logs FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "System can create access logs"
  ON public.content_access_logs FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- FILE UPLOADS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view own files"
  ON public.file_uploads FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "Users can upload files"
  ON public.file_uploads FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "Users can delete own files"
  ON public.file_uploads FOR DELETE
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- PURCHASES POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view own purchases"
  ON public.purchases FOR SELECT
  USING (
    buyer_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    OR seller_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
  );

CREATE POLICY "Users can create purchases"
  ON public.purchases FOR INSERT
  WITH CHECK (buyer_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- CREATOR CARDS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Anyone can view creator cards"
  ON public.creator_cards FOR SELECT
  USING (true);

CREATE POLICY "Creators can manage cards"
  ON public.creator_cards FOR ALL
  USING (creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid() AND is_creator = true));

-- -----------------------------------------------------------------------------
-- CREATOR OFFERS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Anyone can view active offers"
  ON public.creator_offers FOR SELECT
  USING (true);

CREATE POLICY "Creators can manage offers"
  ON public.creator_offers FOR ALL
  USING (creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid() AND is_creator = true));

-- -----------------------------------------------------------------------------
-- OFFER BOOKINGS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view own bookings"
  ON public.offer_bookings FOR SELECT
  USING (
    user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    OR offer_id IN (SELECT id FROM public.creator_offers WHERE creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()))
  );

CREATE POLICY "Users can create bookings"
  ON public.offer_bookings FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "Users can update own bookings"
  ON public.offer_bookings FOR UPDATE
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- OFFER PURCHASES POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view own offer purchases"
  ON public.offer_purchases FOR SELECT
  USING (
    user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    OR offer_id IN (SELECT id FROM public.creator_offers WHERE creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()))
  );

CREATE POLICY "Users can create offer purchases"
  ON public.offer_purchases FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- OFFER REVIEWS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Anyone can view reviews"
  ON public.offer_reviews FOR SELECT
  USING (true);

CREATE POLICY "Users can create reviews"
  ON public.offer_reviews FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "Users can update own reviews"
  ON public.offer_reviews FOR UPDATE
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "Users can delete own reviews"
  ON public.offer_reviews FOR DELETE
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- OFFER FAVORITES POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view own favorites"
  ON public.offer_favorites FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "Users can favorite offers"
  ON public.offer_favorites FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "Users can unfavorite offers"
  ON public.offer_favorites FOR DELETE
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- OFFER ANALYTICS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Creators can view offer analytics"
  ON public.offer_analytics FOR SELECT
  USING (
    offer_id IN (SELECT id FROM public.creator_offers WHERE creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()))
  );

CREATE POLICY "System can create analytics"
  ON public.offer_analytics FOR INSERT
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- OFFER NOTIFICATIONS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view own offer notifications"
  ON public.offer_notifications FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "System can create notifications"
  ON public.offer_notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON public.offer_notifications FOR UPDATE
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- CLASSES POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Anyone can view classes"
  ON public.classes FOR SELECT
  USING (true);

CREATE POLICY "Creators can manage classes"
  ON public.classes FOR ALL
  USING (creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid() AND is_creator = true));

-- -----------------------------------------------------------------------------
-- CLASS ENROLLMENTS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view own enrollments"
  ON public.class_enrollments FOR SELECT
  USING (
    user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    OR class_id IN (SELECT id FROM public.classes WHERE creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()))
  );

CREATE POLICY "Users can enroll in classes"
  ON public.class_enrollments FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "Users can update enrollments"
  ON public.class_enrollments FOR UPDATE
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- CLASS REVIEWS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Anyone can view class reviews"
  ON public.class_reviews FOR SELECT
  USING (true);

CREATE POLICY "Enrolled users can review"
  ON public.class_reviews FOR INSERT
  WITH CHECK (
    user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.class_enrollments WHERE user_id = class_reviews.user_id AND class_id = class_reviews.class_id)
  );

CREATE POLICY "Users can update own reviews"
  ON public.class_reviews FOR UPDATE
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- STREAM SESSIONS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view relevant streams"
  ON public.stream_sessions FOR SELECT
  USING (
    creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    OR status = 'live'
    OR status = 'ended'
  );

CREATE POLICY "Creators can manage streams"
  ON public.stream_sessions FOR ALL
  USING (creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid() AND is_creator = true));

-- -----------------------------------------------------------------------------
-- STREAM ANALYTICS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Creators can view stream analytics"
  ON public.stream_analytics FOR SELECT
  USING (
    stream_id IN (SELECT id FROM public.stream_sessions WHERE creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()))
  );

CREATE POLICY "System can create analytics"
  ON public.stream_analytics FOR INSERT
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- STREAM ANALYTICS V2 POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Creators can view stream analytics v2"
  ON public.stream_analytics_v2 FOR SELECT
  USING (
    stream_id IN (SELECT id FROM public.stream_sessions WHERE creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()))
  );

CREATE POLICY "System can create analytics v2"
  ON public.stream_analytics_v2 FOR INSERT
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- STREAM PRODUCTS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Anyone can view stream products"
  ON public.stream_products FOR SELECT
  USING (true);

CREATE POLICY "Creators can manage stream products"
  ON public.stream_products FOR ALL
  USING (
    stream_id IN (SELECT id FROM public.stream_sessions WHERE creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()))
  );

-- -----------------------------------------------------------------------------
-- STREAM RECORDING PURCHASES POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view own recording purchases"
  ON public.stream_recording_purchases FOR SELECT
  USING (
    user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    OR stream_id IN (SELECT id FROM public.stream_sessions WHERE creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()))
  );

CREATE POLICY "Users can purchase recordings"
  ON public.stream_recording_purchases FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- SESSION METRICS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view own session metrics"
  ON public.session_metrics FOR SELECT
  USING (
    user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
  );

CREATE POLICY "System can create metrics"
  ON public.session_metrics FOR INSERT
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- SHOPPING INTERACTIONS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view relevant interactions"
  ON public.shopping_interactions FOR SELECT
  USING (
    user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    OR stream_id IN (SELECT id FROM public.stream_sessions WHERE creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()))
  );

CREATE POLICY "Users can create interactions"
  ON public.shopping_interactions FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- SHOPPING INTERACTION RESPONSES POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view responses"
  ON public.shopping_interaction_responses FOR SELECT
  USING (
    interaction_id IN (SELECT id FROM public.shopping_interactions WHERE user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()))
    OR responder_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
  );

CREATE POLICY "Creators can respond"
  ON public.shopping_interaction_responses FOR INSERT
  WITH CHECK (responder_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid() AND is_creator = true));

-- -----------------------------------------------------------------------------
-- PRODUCT SHOWCASE EVENTS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Anyone can view showcase events"
  ON public.product_showcase_events FOR SELECT
  USING (true);

CREATE POLICY "Creators can manage showcases"
  ON public.product_showcase_events FOR ALL
  USING (
    stream_id IN (SELECT id FROM public.stream_sessions WHERE creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()))
  );

-- -----------------------------------------------------------------------------
-- FLASH SALES POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Anyone can view flash sales"
  ON public.flash_sales FOR SELECT
  USING (true);

CREATE POLICY "Creators can manage flash sales"
  ON public.flash_sales FOR ALL
  USING (creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid() AND is_creator = true));

-- -----------------------------------------------------------------------------
-- SHOP REVIEWS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Anyone can view shop reviews"
  ON public.shop_reviews FOR SELECT
  USING (true);

CREATE POLICY "Users can create shop reviews"
  ON public.shop_reviews FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "Users can update own reviews"
  ON public.shop_reviews FOR UPDATE
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- LIVE PURCHASES POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view own purchases"
  ON public.live_purchases FOR SELECT
  USING (
    user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    OR stream_id IN (SELECT id FROM public.stream_sessions WHERE creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()))
  );

CREATE POLICY "Users can create purchases"
  ON public.live_purchases FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- PAYMENTS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view own payments"
  ON public.payments FOR SELECT
  USING (
    -- Assuming payments has user_id or similar field linking to users
    EXISTS (SELECT 1 FROM public.users WHERE id = payments.user_id AND supabase_id = auth.uid())
    OR
    -- Or if payments are linked via sessions
    session_id IN (
      SELECT id FROM public.sessions
      WHERE creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
      OR fan_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    )
  );

CREATE POLICY "System can create payments"
  ON public.payments FOR INSERT
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- TOKEN TRANSACTIONS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view own transactions"
  ON public.token_transactions FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "System can create transactions"
  ON public.token_transactions FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- TIPS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view relevant tips"
  ON public.tips FOR SELECT
  USING (
    sender_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    OR receiver_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
  );

CREATE POLICY "Users can send tips"
  ON public.tips FOR INSERT
  WITH CHECK (sender_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- GIFTER TIERS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view gifter tiers"
  ON public.gifter_tiers FOR SELECT
  USING (
    user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    OR creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
  );

CREATE POLICY "System can manage gifter tiers"
  ON public.gifter_tiers FOR ALL
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- GIFTER TIER HISTORY POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view tier history"
  ON public.gifter_tier_history FOR SELECT
  USING (
    user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    OR creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
  );

CREATE POLICY "System can create history"
  ON public.gifter_tier_history FOR INSERT
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- CONVERSATIONS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view own conversations"
  ON public.conversations FOR SELECT
  USING (
    participant1_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    OR participant2_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
  );

CREATE POLICY "Users can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (
    participant1_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    OR participant2_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
  );

CREATE POLICY "Users can update own conversations"
  ON public.conversations FOR UPDATE
  USING (
    participant1_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    OR participant2_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- CHAT MESSAGES POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view messages in own conversations"
  ON public.chat_messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE participant1_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
      OR participant2_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (sender_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "Users can update own messages"
  ON public.chat_messages FOR UPDATE
  USING (sender_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "Users can delete own messages"
  ON public.chat_messages FOR DELETE
  USING (sender_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- NOTIFICATIONS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- FAN NOTES POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Creators can view notes about fans"
  ON public.fan_notes FOR SELECT
  USING (creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid() AND is_creator = true));

CREATE POLICY "Creators can create fan notes"
  ON public.fan_notes FOR INSERT
  WITH CHECK (creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid() AND is_creator = true));

CREATE POLICY "Creators can update fan notes"
  ON public.fan_notes FOR UPDATE
  USING (creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid() AND is_creator = true));

CREATE POLICY "Creators can delete fan notes"
  ON public.fan_notes FOR DELETE
  USING (creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid() AND is_creator = true));

-- -----------------------------------------------------------------------------
-- CREATOR ANALYTICS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Creators can view own analytics"
  ON public.creator_analytics FOR SELECT
  USING (creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid() AND is_creator = true));

CREATE POLICY "System can create analytics"
  ON public.creator_analytics FOR INSERT
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- PAGE VIEWS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Creators can view own page views"
  ON public.page_views FOR SELECT
  USING (
    page_owner_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid())
  );

CREATE POLICY "System can create page views"
  ON public.page_views FOR INSERT
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- CUSTOM METRICS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view own metrics"
  ON public.custom_metrics FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()));

CREATE POLICY "System can create metrics"
  ON public.custom_metrics FOR INSERT
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- ANALYTICS BUCKETS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Creators can view analytics buckets"
  ON public.analytics_buckets FOR SELECT
  USING (creator_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid() AND is_creator = true));

CREATE POLICY "System can manage buckets"
  ON public.analytics_buckets FOR ALL
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- APPLICATION LOGS POLICIES
-- -----------------------------------------------------------------------------
-- Only system/service role should access logs
CREATE POLICY "No direct access to logs"
  ON public.application_logs FOR ALL
  USING (false);

-- =============================================================================
-- STEP 3: FIX SECURITY DEFINER VIEWS
-- =============================================================================
-- Replace SECURITY DEFINER views with SECURITY INVOKER views
-- This ensures views enforce the querying user's RLS policies

-- Drop and recreate show_statistics view
DROP VIEW IF EXISTS public.show_statistics CASCADE;
CREATE VIEW public.show_statistics
WITH (security_invoker = true)
AS
SELECT
  -- Add your view query here based on your original view definition
  -- This is a placeholder - replace with actual columns
  *
FROM public.stream_sessions
WHERE status = 'ended';

-- Drop and recreate ppv_analytics view
DROP VIEW IF EXISTS public.ppv_analytics CASCADE;
CREATE VIEW public.ppv_analytics
WITH (security_invoker = true)
AS
SELECT
  -- Add your view query here based on your original view definition
  *
FROM public.purchases;

-- Drop and recreate subscription_tier_analytics view
DROP VIEW IF EXISTS public.subscription_tier_analytics CASCADE;
CREATE VIEW public.subscription_tier_analytics
WITH (security_invoker = true)
AS
SELECT
  -- Add your view query here based on your original view definition
  *
FROM public.subscriptions;

-- Drop and recreate offer_statistics view
DROP VIEW IF EXISTS public.offer_statistics CASCADE;
CREATE VIEW public.offer_statistics
WITH (security_invoker = true)
AS
SELECT
  -- Add your view query here based on your original view definition
  *
FROM public.creator_offers;

-- =============================================================================
-- STEP 4: GRANT NECESSARY PERMISSIONS
-- =============================================================================
-- Grant authenticated users access to tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================
-- All tables now have RLS enabled with appropriate policies
-- Views now use SECURITY INVOKER instead of SECURITY DEFINER
--
-- NEXT STEPS:
-- 1. Test policies with different user roles
-- 2. Update view definitions with actual queries
-- 3. Monitor query performance after RLS
-- 4. Adjust policies as needed for your specific use cases
-- =============================================================================
