-- ================================================
-- DATABASE VERIFICATION SCRIPT
-- Run this AFTER running the migration scripts to verify success
-- ================================================

-- Check if all essential tables exist
SELECT 
  'Tables Check' as check_type,
  COUNT(*) as tables_found,
  STRING_AGG(table_name, ', ') as table_list
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'users',
  'sessions',
  'streams',
  'stream_recordings',
  'stream_messages',
  'messages',
  'creator_earnings',
  'creator_payouts',
  'badges',
  'digitals',
  'digital_categories',
  'digital_views',
  'digital_access',
  'creator_notification_preferences',
  'vod_purchases',
  'tv_subscriptions',
  'session_invites',
  'calendar_events',
  'creator_fan_notes',
  'ticketed_shows',
  'show_tickets',
  'content_items',
  'content_purchases',
  'content_likes',
  'shop_items',
  'shop_purchases',
  'subscription_tiers',
  'tier_subscriptions',
  'challenges',
  'user_challenges',
  'badge_history',
  'stream_activity',
  'private_call_requests',
  'stream_co_hosts',
  'analytics_events',
  'push_subscriptions'
);

-- Check essential user columns
SELECT 
  'User Columns Check' as check_type,
  COUNT(*) as columns_found,
  STRING_AGG(column_name, ', ') as column_list
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN (
  'supabase_id',
  'email',
  'username',
  'role',
  'video_rate',
  'voice_rate',
  'chat_rate',
  'stream_rate',
  'video_price',
  'voice_price',
  'message_price',
  'stream_price',
  'creator_card_image',
  'card_image_url',
  'notification_preferences',
  'privacy_settings',
  'availability_status',
  'availability_schedule',
  'kyc_status',
  'age_verified',
  'creator_token_balance',
  'state',
  'country',
  'updated_at'
);

-- Check for missing foreign key references
SELECT 
  'Foreign Keys Check' as check_type,
  COUNT(*) as fk_count
FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY'
AND table_schema = 'public';

-- Check for indexes
SELECT 
  'Indexes Check' as check_type,
  COUNT(*) as index_count
FROM pg_indexes 
WHERE schemaname = 'public';

-- Check RLS is enabled on important tables
SELECT 
  'RLS Check' as check_type,
  COUNT(*) as rls_enabled_count,
  STRING_AGG(relname, ', ') as tables_with_rls
FROM pg_class 
WHERE relrowsecurity = true
AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND relkind = 'r';

-- Summary of database state
SELECT 
  'Summary' as check_type,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') as total_tables,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public') as total_columns,
  (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') as total_indexes,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as total_policies;