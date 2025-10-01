-- =====================================================
-- DELETE ALL USERS AND START FRESH
-- =====================================================
-- WARNING: This will permanently delete ALL users and related data!
-- Make sure to backup your database first if needed.

-- =====================================================
-- STEP 1: CHECK WHAT WILL BE DELETED
-- =====================================================

-- See current counts before deletion
SELECT 
    'BEFORE DELETION:' as status,
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE is_creator = true) as creators,
    COUNT(*) FILTER (WHERE is_creator = false) as fans
FROM users;

-- See what related data exists
SELECT 
    'creator_applications' as table_name, COUNT(*) as count FROM creator_applications
UNION ALL
SELECT 'token_balances', COUNT(*) FROM token_balances
UNION ALL
SELECT 'token_transactions', COUNT(*) FROM token_transactions
UNION ALL
SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL
SELECT 'messages', COUNT(*) FROM messages
UNION ALL
SELECT 'payments', COUNT(*) FROM payments
UNION ALL
SELECT 'tips', COUNT(*) FROM tips
UNION ALL
SELECT 'creator_subscriptions', COUNT(*) FROM creator_subscriptions;

-- =====================================================
-- STEP 2: DELETE ALL RELATED DATA
-- =====================================================

-- Start transaction for safety
BEGIN;

-- Delete all related data first (due to foreign key constraints)
-- The order matters to avoid foreign key violations

-- Delete application data
DELETE FROM creator_applications;

-- Delete transaction/payment data
DELETE FROM token_transactions;
DELETE FROM token_balances;
DELETE FROM payments;
DELETE FROM tips;

-- Delete session/call data
DELETE FROM sessions;
DELETE FROM call_requests;
DELETE FROM session_recordings;

-- Delete messaging data
DELETE FROM messages;
DELETE FROM conversations;

-- Delete subscription/follower data
DELETE FROM creator_subscriptions;
DELETE FROM followers;

-- Delete content data
DELETE FROM creator_content;
DELETE FROM content_purchases;

-- Delete notification data
DELETE FROM notifications;

-- Delete analytics data
DELETE FROM analytics_events;
DELETE FROM creator_analytics;

-- Finally, delete all users
DELETE FROM users;

-- Reset sequences (auto-increment IDs) to start from 1
ALTER SEQUENCE IF EXISTS users_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS creator_applications_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS sessions_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS messages_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS payments_id_seq RESTART WITH 1;

-- Commit the transaction
COMMIT;

-- =====================================================
-- STEP 3: VERIFY DELETION
-- =====================================================

-- Check that all users are deleted
SELECT 
    'AFTER DELETION:' as status,
    COUNT(*) as total_users
FROM users;

-- Verify related tables are empty
SELECT 
    'All tables should show 0:' as check_status;

SELECT 
    'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'creator_applications', COUNT(*) FROM creator_applications
UNION ALL
SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL
SELECT 'messages', COUNT(*) FROM messages;

-- =====================================================
-- STEP 4: ALSO DELETE FROM SUPABASE AUTH (IMPORTANT!)
-- =====================================================

/*
IMPORTANT: The above only deletes from your public.users table.
You also need to delete users from Supabase Auth:

Option 1: Via Supabase Dashboard (Recommended)
1. Go to Authentication → Users in Supabase Dashboard
2. Select all users
3. Delete them

Option 2: Via SQL (if you have admin access)
Note: This requires admin privileges
*/

-- Check auth.users (requires admin privileges)
-- SELECT COUNT(*) FROM auth.users;

-- Delete from auth.users (requires admin privileges)
-- DELETE FROM auth.users;

-- =====================================================
-- STEP 5: CREATE FRESH TEST DATA (OPTIONAL)
-- =====================================================

/*
-- Create a test creator
INSERT INTO users (
    email, 
    username, 
    display_name,
    is_creator, 
    bio,
    price_per_min,
    created_at
) VALUES (
    'creator1@test.com',
    'creator1',
    'Test Creator',
    true,
    'I am a test creator',
    5.00,
    NOW()
);

-- Create a test fan
INSERT INTO users (
    email, 
    username, 
    display_name,
    is_creator,
    created_at
) VALUES (
    'fan1@test.com',
    'fan1', 
    'Test Fan',
    false,
    NOW()
);

-- Create another fan
INSERT INTO users (
    email, 
    username, 
    display_name,
    is_creator,
    created_at
) VALUES (
    'fan2@test.com',
    'fan2',
    'Test Fan 2',
    false,
    NOW()
);
*/

-- =====================================================
-- STEP 6: ALTERNATIVE - SAFE DELETE WITH BACKUP
-- =====================================================

/*
-- If you want to backup before deleting:

-- 1. Create backup tables
CREATE TABLE users_backup AS SELECT * FROM users;
CREATE TABLE creator_applications_backup AS SELECT * FROM creator_applications;

-- 2. Verify backup
SELECT COUNT(*) FROM users_backup;

-- 3. Then run the delete commands above

-- 4. To restore if needed:
-- INSERT INTO users SELECT * FROM users_backup;
-- DROP TABLE users_backup;
*/

-- =====================================================
-- SUMMARY
-- =====================================================

/*
This script:
1. Deletes ALL users (creators and fans)
2. Deletes ALL related data (sessions, messages, payments, etc.)
3. Resets ID sequences to start from 1
4. Provides optional test data creation

IMPORTANT NOTES:
- This is PERMANENT - make sure you want to do this
- You also need to delete users from Supabase Auth separately
- Consider backing up first if you might need the data later

To execute:
1. Run this entire script
2. Go to Supabase Dashboard → Authentication → Users
3. Delete all users there too
4. You now have a clean slate!
*/