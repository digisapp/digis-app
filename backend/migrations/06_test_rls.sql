-- =============================================================================
-- RLS POLICY TESTING SCRIPT
-- =============================================================================
-- Run this script to verify RLS policies are working correctly
-- Replace test UUIDs with actual user IDs from your auth.users table
-- =============================================================================

-- =============================================================================
-- STEP 1: Get test user IDs
-- =============================================================================
-- Find some real user IDs to test with
SELECT
  'TEST USERS' as category,
  id as auth_uid,
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- Get corresponding public.users records
SELECT
  'PUBLIC USERS' as category,
  id as db_id,
  supabase_id,
  username,
  is_creator
FROM public.users
ORDER BY created_at DESC
LIMIT 5;

-- =============================================================================
-- STEP 2: Set test user context
-- =============================================================================
-- Replace with actual UUID from your auth.users table
-- This simulates being logged in as that user

-- Example: Set as regular fan user
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
SELECT set_config('role', 'authenticated', true);

-- Verify who we're testing as
SELECT
  auth.uid() as current_user_uid,
  current_user_db_id() as current_user_db_id,
  is_creator() as is_creator;

-- =============================================================================
-- TEST 1: Users Table - Profile Access
-- =============================================================================

-- ✅ Should work: View all user profiles (public read)
SELECT COUNT(*) as total_profiles_visible
FROM public.users;

-- ✅ Should work: View own profile
SELECT *
FROM public.users
WHERE supabase_id = auth.uid();

-- ❌ Should fail: Cannot update other user's profile
UPDATE public.users
SET bio = 'Hacked!'
WHERE supabase_id != auth.uid()
LIMIT 1;
-- Expected: No rows updated (blocked by RLS)

-- ✅ Should work: Update own profile
UPDATE public.users
SET bio = 'Updated my bio'
WHERE supabase_id = auth.uid();
-- Expected: 1 row updated

-- =============================================================================
-- TEST 2: Follows - Following/Unfollowing
-- =============================================================================

-- ✅ Should work: View all follows
SELECT COUNT(*) as total_follows_visible
FROM public.follows;

-- Get a creator to follow (not yourself)
SELECT id as creator_id
FROM public.users
WHERE is_creator = true
  AND supabase_id != auth.uid()
LIMIT 1;

-- ✅ Should work: Follow a creator
INSERT INTO public.follows (follower_id, following_id, created_at)
SELECT
  current_user_db_id(),
  (SELECT id FROM public.users WHERE is_creator = true AND supabase_id != auth.uid() LIMIT 1),
  NOW()
ON CONFLICT DO NOTHING;

-- ❌ Should fail: Try to follow yourself
INSERT INTO public.follows (follower_id, following_id, created_at)
VALUES (current_user_db_id(), current_user_db_id(), NOW());
-- Expected: Violates policy WITH CHECK

-- ❌ Should fail: Delete someone else's follow
DELETE FROM public.follows
WHERE follower_id != current_user_db_id()
LIMIT 1;
-- Expected: No rows deleted (not your follow)

-- =============================================================================
-- TEST 3: Subscriptions - Gated Access
-- =============================================================================

-- ✅ Should work: View own subscriptions
SELECT *
FROM public.subscriptions
WHERE subscriber_id = current_user_db_id()
   OR creator_id = current_user_db_id();

-- ❌ Should fail: View other users' subscriptions
SELECT *
FROM public.subscriptions
WHERE subscriber_id != current_user_db_id()
  AND creator_id != current_user_db_id();
-- Expected: 0 rows (filtered by RLS)

-- Test subscription helper function
SELECT is_active_subscriber(
  (SELECT id FROM public.users WHERE is_creator = true LIMIT 1)
) as has_subscription;

-- =============================================================================
-- TEST 4: Content Access - Visibility Rules
-- =============================================================================

-- ✅ Should see: Public content
SELECT COUNT(*) as public_content_visible
FROM public.content_uploads
WHERE visibility = 'public';

-- ✅ Should see: Own content (regardless of visibility)
SELECT COUNT(*) as own_content_visible
FROM public.content_uploads
WHERE creator_id = current_user_db_id();

-- ❌ Should NOT see: Private content from other creators (unless subscribed)
SELECT COUNT(*) as private_content_should_be_zero
FROM public.content_uploads
WHERE visibility = 'subscribers'
  AND creator_id != current_user_db_id()
  AND NOT is_active_subscriber(creator_id);
-- Expected: 0 rows

-- =============================================================================
-- TEST 5: Conversations & Messages - Privacy
-- =============================================================================

-- ✅ Should work: View own conversations
SELECT *
FROM public.conversations
WHERE participant1_id = current_user_db_id()
   OR participant2_id = current_user_db_id();

-- ❌ Should fail: View others' conversations
SELECT COUNT(*) as others_conversations_should_be_zero
FROM public.conversations
WHERE participant1_id != current_user_db_id()
  AND participant2_id != current_user_db_id();
-- Expected: 0 rows

-- ✅ Should work: Send message in own conversation
INSERT INTO public.chat_messages (conversation_id, sender_id, content, created_at)
SELECT
  (SELECT id FROM public.conversations
   WHERE participant1_id = current_user_db_id()
      OR participant2_id = current_user_db_id()
   LIMIT 1),
  current_user_db_id(),
  'Test message',
  NOW()
WHERE EXISTS (
  SELECT 1 FROM public.conversations
  WHERE participant1_id = current_user_db_id()
     OR participant2_id = current_user_db_id()
);

-- =============================================================================
-- TEST 6: Payments & Transactions - Financial Privacy
-- =============================================================================

-- ✅ Should see: Own payments only
SELECT *
FROM public.payments
WHERE EXISTS (
  SELECT 1 FROM public.users
  WHERE users.id = payments.user_id
    AND users.supabase_id = auth.uid()
);

-- ✅ Should see: Own token transactions
SELECT *
FROM public.token_transactions
WHERE user_id = current_user_db_id();

-- ❌ Should NOT see: Other users' transactions
SELECT COUNT(*) as others_transactions_should_be_zero
FROM public.token_transactions
WHERE user_id != current_user_db_id();
-- Expected: 0 rows

-- =============================================================================
-- TEST 7: Blocked Users
-- =============================================================================

-- ✅ Should work: Block another user
INSERT INTO public.blocked_users (blocker_id, blocked_id, created_at)
SELECT
  current_user_db_id(),
  (SELECT id FROM public.users WHERE supabase_id != auth.uid() LIMIT 1),
  NOW()
ON CONFLICT DO NOTHING;

-- ✅ Should see: Own blocks
SELECT *
FROM public.blocked_users
WHERE blocker_id = current_user_db_id();

-- ❌ Should NOT see: Other users' block lists
SELECT COUNT(*) as others_blocks_should_be_zero
FROM public.blocked_users
WHERE blocker_id != current_user_db_id();
-- Expected: 0 rows

-- =============================================================================
-- TEST 8: Creator-Only Features
-- =============================================================================

-- Switch to creator user
SELECT set_config('request.jwt.claim.sub',
  (SELECT supabase_id::text FROM public.users WHERE is_creator = true LIMIT 1),
  true);

-- Verify creator status
SELECT is_creator() as should_be_true;

-- ✅ Should work: View own analytics
SELECT *
FROM public.creator_analytics
WHERE creator_id = current_user_db_id();

-- ✅ Should work: View own stream analytics
SELECT *
FROM public.stream_analytics sa
WHERE sa.stream_id IN (
  SELECT id FROM public.stream_sessions
  WHERE creator_id = current_user_db_id()
);

-- ✅ Should work: Manage fan notes
SELECT *
FROM public.fan_notes
WHERE creator_id = current_user_db_id();

-- Switch back to regular user
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

-- ❌ Should fail: Regular users cannot see creator analytics
SELECT COUNT(*) as analytics_should_be_zero
FROM public.creator_analytics
WHERE creator_id != current_user_db_id();
-- Expected: 0 rows

-- =============================================================================
-- TEST 9: Realtime Subscriptions (if using Realtime)
-- =============================================================================

-- Verify table is published for Realtime
SELECT
  schemaname,
  tablename,
  pubname
FROM pg_publication_tables
WHERE schemaname = 'public'
  AND tablename IN ('chat_messages', 'notifications', 'stream_sessions')
ORDER BY tablename;

-- Note: Realtime respects RLS automatically
-- Users will only receive updates for rows they can SELECT via RLS

-- =============================================================================
-- TEST 10: Helper Functions
-- =============================================================================

-- Test all helper functions
SELECT
  'Helper Functions Test' as test_category,
  current_user_db_id() as my_db_id,
  is_owner(auth.uid()) as owns_self,
  is_creator() as am_i_creator,
  follows_creator(1) as follows_user_1,
  is_active_subscriber(1) as subscribed_to_user_1;

-- =============================================================================
-- SUMMARY: Expected Results
-- =============================================================================

SELECT '
RLS TEST SUMMARY - Expected Behavior:
======================================

✅ SHOULD WORK:
- View all public profiles
- Update own profile
- View all follows
- Follow/unfollow creators
- View own subscriptions
- View public content
- View own content
- View own conversations
- Send messages in own conversations
- View own payments/transactions
- Block/unblock users
- Creators see own analytics

❌ SHOULD FAIL:
- Update other users profiles (0 rows affected)
- Follow yourself (policy violation)
- Delete others follows (0 rows affected)
- View others subscriptions (0 rows returned)
- View private content without subscription (0 rows)
- View others conversations (0 rows)
- View others payments (0 rows)
- View others blocks (0 rows)
- Non-creators see creator analytics (0 rows)

If any test shows unexpected results, review the policy for that table.
' as summary;

-- =============================================================================
-- CLEANUP TEST DATA (optional)
-- =============================================================================
-- DELETE FROM public.blocked_users WHERE blocker_id = current_user_db_id();
-- DELETE FROM public.follows WHERE follower_id = current_user_db_id();
-- DELETE FROM public.chat_messages WHERE sender_id = current_user_db_id() AND content = 'Test message';
-- =============================================================================
