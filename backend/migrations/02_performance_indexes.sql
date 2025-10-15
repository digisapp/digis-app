-- =============================================================================
-- PERFORMANCE INDEXES FOR RLS POLICIES
-- =============================================================================
-- These indexes are CRITICAL for RLS policy performance
-- Without them, RLS predicates will cause slow queries and timeouts
-- Create these BEFORE enabling RLS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- USERS TABLE INDEXES
-- -----------------------------------------------------------------------------
-- Primary auth lookup (used in nearly every policy)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_supabase_id
  ON public.users(supabase_id)
  WHERE supabase_id IS NOT NULL;

-- Creator lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_is_creator
  ON public.users(is_creator)
  WHERE is_creator = true;

-- Username lookups (for profile pages)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username
  ON public.users(username)
  WHERE username IS NOT NULL;

-- Combined index for creator queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_creator_active
  ON public.users(is_creator, id)
  WHERE is_creator = true;

-- -----------------------------------------------------------------------------
-- FOLLOWS TABLE INDEXES
-- -----------------------------------------------------------------------------
-- Follower lookups (who is following)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_follower_id
  ON public.follows(follower_id);

-- Following lookups (who they follow)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_following_id
  ON public.follows(following_id);

-- Combined for bidirectional checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_follower_following
  ON public.follows(follower_id, following_id);

-- Check if user follows creator
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_active
  ON public.follows(following_id, follower_id)
  WHERE created_at IS NOT NULL;

-- -----------------------------------------------------------------------------
-- SUBSCRIPTIONS TABLE INDEXES
-- -----------------------------------------------------------------------------
-- Subscriber lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_subscriber_id
  ON public.subscriptions(subscriber_id);

-- Creator lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_creator_id
  ON public.subscriptions(creator_id);

-- Active subscriptions (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_active
  ON public.subscriptions(creator_id, subscriber_id)
  WHERE status = 'active'
    AND (expires_at IS NULL OR expires_at > NOW());

-- Partial index for active subscriptions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_status_active
  ON public.subscriptions(subscriber_id, creator_id, expires_at)
  WHERE status = 'active';

-- -----------------------------------------------------------------------------
-- CREATOR_SUBSCRIPTIONS TABLE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_subscriptions_user_id
  ON public.creator_subscriptions(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_subscriptions_creator_id
  ON public.creator_subscriptions(creator_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_subscriptions_active
  ON public.creator_subscriptions(creator_id, user_id)
  WHERE status = 'active'
    AND (end_date IS NULL OR end_date > NOW());

-- -----------------------------------------------------------------------------
-- CONTENT_UPLOADS TABLE INDEXES
-- -----------------------------------------------------------------------------
-- Creator content lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_uploads_creator_id
  ON public.content_uploads(creator_id);

-- Visibility filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_uploads_visibility
  ON public.content_uploads(visibility);

-- Combined for access checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_uploads_creator_visibility
  ON public.content_uploads(creator_id, visibility);

-- Public content
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_uploads_public
  ON public.content_uploads(id, creator_id)
  WHERE visibility = 'public';

-- -----------------------------------------------------------------------------
-- PURCHASES TABLE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchases_buyer_id
  ON public.purchases(buyer_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchases_seller_id
  ON public.purchases(seller_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchases_content_id
  ON public.purchases(content_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchases_completed
  ON public.purchases(buyer_id, content_id)
  WHERE status = 'completed';

-- -----------------------------------------------------------------------------
-- CONVERSATIONS TABLE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_participant1
  ON public.conversations(participant1_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_participant2
  ON public.conversations(participant2_id);

-- Both participants for quick lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_participants
  ON public.conversations(participant1_id, participant2_id);

-- -----------------------------------------------------------------------------
-- CHAT_MESSAGES TABLE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_conversation_id
  ON public.chat_messages(conversation_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_sender_id
  ON public.chat_messages(sender_id);

-- Conversation messages ordered
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_conversation_created
  ON public.chat_messages(conversation_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- NOTIFICATIONS TABLE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_id
  ON public.notifications(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);

-- Unread notifications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread
  ON public.notifications(user_id)
  WHERE read_at IS NULL;

-- -----------------------------------------------------------------------------
-- PAYMENTS TABLE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_user_id
  ON public.payments(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_session_id
  ON public.payments(session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_stripe_id
  ON public.payments(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- TOKEN_TRANSACTIONS TABLE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_token_transactions_user_id
  ON public.token_transactions(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_token_transactions_user_created
  ON public.token_transactions(user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- TIPS TABLE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tips_sender_id
  ON public.tips(sender_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tips_receiver_id
  ON public.tips(receiver_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tips_sender_receiver
  ON public.tips(sender_id, receiver_id);

-- -----------------------------------------------------------------------------
-- BLOCKED_USERS TABLE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blocked_users_blocker_id
  ON public.blocked_users(blocker_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blocked_users_blocked_id
  ON public.blocked_users(blocked_id);

-- Quick block check
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blocked_users_both
  ON public.blocked_users(blocker_id, blocked_id);

-- -----------------------------------------------------------------------------
-- STREAM_SESSIONS TABLE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stream_sessions_creator_id
  ON public.stream_sessions(creator_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stream_sessions_status
  ON public.stream_sessions(status);

-- Live streams
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stream_sessions_live
  ON public.stream_sessions(id, creator_id)
  WHERE status = 'live';

-- Creator's streams
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stream_sessions_creator_status
  ON public.stream_sessions(creator_id, status, created_at DESC);

-- -----------------------------------------------------------------------------
-- OFFER TABLES INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_offers_creator_id
  ON public.creator_offers(creator_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_offer_purchases_user_id
  ON public.offer_purchases(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_offer_purchases_offer_id
  ON public.offer_purchases(offer_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_offer_bookings_user_id
  ON public.offer_bookings(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_offer_bookings_offer_id
  ON public.offer_bookings(offer_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_offer_favorites_user_id
  ON public.offer_favorites(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_offer_reviews_user_id
  ON public.offer_reviews(user_id);

-- -----------------------------------------------------------------------------
-- CLASSES TABLE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_classes_creator_id
  ON public.classes(creator_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_class_enrollments_user_id
  ON public.class_enrollments(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_class_enrollments_class_id
  ON public.class_enrollments(class_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_class_enrollments_user_class
  ON public.class_enrollments(user_id, class_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_class_reviews_user_id
  ON public.class_reviews(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_class_reviews_class_id
  ON public.class_reviews(class_id);

-- -----------------------------------------------------------------------------
-- ANALYTICS TABLES INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_analytics_creator_id
  ON public.creator_analytics(creator_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stream_analytics_stream_id
  ON public.stream_analytics(stream_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_page_views_page_owner_id
  ON public.page_views(page_owner_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_custom_metrics_user_id
  ON public.custom_metrics(user_id);

-- -----------------------------------------------------------------------------
-- FAN_NOTES TABLE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fan_notes_creator_id
  ON public.fan_notes(creator_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fan_notes_fan_id
  ON public.fan_notes(fan_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fan_notes_creator_fan
  ON public.fan_notes(creator_id, fan_id);

-- -----------------------------------------------------------------------------
-- FILE UPLOADS AND USER IMAGES INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_file_uploads_user_id
  ON public.file_uploads(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_images_user_id
  ON public.user_images(user_id);

-- =============================================================================
-- VERIFY INDEX CREATION
-- =============================================================================
-- Check index status
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- =============================================================================
-- NOTES
-- =============================================================================
-- All indexes use CONCURRENTLY to avoid locking tables during creation
-- This is safe for production but takes longer to create
-- If index creation fails, check for duplicate index names and retry
-- =============================================================================
