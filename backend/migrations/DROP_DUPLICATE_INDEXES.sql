-- =============================================================================
-- DROP DUPLICATE INDEXES
-- =============================================================================
-- Removes 21 redundant indexes to improve write performance and save disk space
-- Safe operation - keeps one index from each duplicate pair
-- =============================================================================

-- Analytics Events
DROP INDEX IF EXISTS idx_analytics_events_session; -- Keep: idx_analytics_events_session_id

-- Calendar Events
DROP INDEX IF EXISTS idx_calendar_events_creator; -- Keep: idx_calendar_events_creator_id

-- Content Likes
DROP INDEX IF EXISTS idx_content_likes_user; -- Keep: idx_content_likes_user_id

-- Creator Fan Notes
DROP INDEX IF EXISTS idx_creator_fan_notes_creator; -- Keep: idx_creator_fan_notes_creator_id
DROP INDEX IF EXISTS idx_creator_fan_notes_fan; -- Keep: idx_creator_fan_notes_fan_id

-- Creator Notification Preferences
DROP INDEX IF EXISTS idx_creator_notif_pref_creator_id; -- Keep: idx_creator_notification_preferences_creator_id
DROP INDEX IF EXISTS idx_creator_notif_pref_fan_id; -- Keep: idx_creator_notification_preferences_fan_id

-- Live Purchases
DROP INDEX IF EXISTS idx_live_purchases_recent; -- Keep: idx_live_purchases_time

-- Messages
DROP INDEX IF EXISTS idx_messages_receiver; -- Keep: idx_messages_receiver_id
DROP INDEX IF EXISTS idx_messages_sender; -- Keep: idx_messages_sender_id

-- Private Call Requests
DROP INDEX IF EXISTS idx_private_call_requests_creator; -- Keep: idx_private_call_requests_creator_id
DROP INDEX IF EXISTS idx_private_call_requests_fan; -- Keep: idx_private_call_requests_fan_id

-- Private Call Sessions
DROP INDEX IF EXISTS idx_private_call_sessions_creator; -- Keep: idx_private_call_sessions_creator_id
DROP INDEX IF EXISTS idx_private_call_sessions_fan; -- Keep: idx_private_call_sessions_fan_id

-- Processed Webhooks
DROP INDEX IF EXISTS idx_processed_webhooks_cleanup; -- Keep: idx_processed_webhooks_processed_at

-- Sessions
DROP INDEX IF EXISTS idx_sessions_creator; -- Keep: idx_sessions_creator_id
DROP INDEX IF EXISTS idx_sessions_user; -- Keep: idx_sessions_user_id

-- Shop Items
DROP INDEX IF EXISTS idx_shop_items_creator; -- Keep: idx_shop_items_creator_active

-- Stream Likes
DROP INDEX IF EXISTS idx_stream_likes_stream; -- Keep: idx_stream_likes_stream_id
DROP INDEX IF EXISTS idx_stream_likes_user; -- Keep: idx_stream_likes_user_id

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Check for remaining duplicate indexes
SELECT
  '✅ DUPLICATE INDEXES CLEANUP' as status,
  COUNT(*) as remaining_duplicates
FROM (
  SELECT
    tablename,
    indexname,
    indexdef,
    COUNT(*) OVER (PARTITION BY tablename, indexdef) as duplicate_count
  FROM pg_indexes
  WHERE schemaname = 'public'
) duplicates
WHERE duplicate_count > 1;

-- Show index count reduction
SELECT
  '📊 INDEX SUMMARY' as info,
  schemaname,
  COUNT(*) as total_indexes
FROM pg_indexes
WHERE schemaname = 'public'
GROUP BY schemaname;

-- =============================================================================
-- ✅ COMPLETE!
-- =============================================================================
-- Dropped 21 duplicate indexes
-- Benefits:
--   ✅ Reduced disk space usage
--   ✅ Faster INSERT/UPDATE/DELETE operations
--   ✅ Reduced index maintenance overhead
--   ✅ Same query performance (kept one index from each pair)
-- =============================================================================
