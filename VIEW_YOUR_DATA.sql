-- =====================================================
-- VIEW YOUR ACTUAL DATA IN SUPABASE
-- =====================================================

-- 1. SUMMARY OF YOUR USERS
-- =====================================================
SELECT 
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE is_creator = true) as total_creators,
    COUNT(*) FILTER (WHERE is_creator = false) as total_fans,
    COUNT(*) FILTER (WHERE is_creator IS NULL) as null_is_creator
FROM users;

-- 2. SEE ALL YOUR USERS WITH DETAILS
-- =====================================================
SELECT 
    id,
    email,
    username,
    is_creator,
    created_at
FROM users
ORDER BY created_at DESC;

-- 3. SEE CREATORS (if any exist)
-- =====================================================
SELECT 
    id,
    email,
    username,
    is_creator,
    created_at
FROM users 
WHERE is_creator = true
ORDER BY created_at DESC;

-- 4. SEE FANS
-- =====================================================
SELECT 
    id,
    email,
    username,
    is_creator,
    created_at
FROM users 
WHERE is_creator = false
ORDER BY created_at DESC;

-- 5. CHECK CREATOR APPLICATIONS
-- =====================================================
-- First check if table exists and has data
SELECT 
    COUNT(*) as total_applications,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'approved') as approved,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected
FROM creator_applications;

-- See actual applications
SELECT * FROM creator_applications ORDER BY created_at DESC LIMIT 10;

-- 6. HOW TO MAKE A USER A CREATOR
-- =====================================================
-- To make a specific user a creator, update their is_creator flag
-- Replace 'user@example.com' with the actual email

-- Example: Make a user a creator by email
/*
UPDATE users 
SET is_creator = true 
WHERE email = 'user@example.com';
*/

-- Example: Make a user a creator by ID
/*
UPDATE users 
SET is_creator = true 
WHERE id = 1;
*/

-- 7. HOW TO ADD A CREATOR APPLICATION
-- =====================================================
-- If you want to add a pending application for a user
/*
INSERT INTO creator_applications (
    user_id,
    status,
    created_at
) VALUES (
    1,  -- Replace with actual user ID
    'pending',
    NOW()
);
*/

-- 8. APPROVE A CREATOR APPLICATION
-- =====================================================
-- To approve an application and make the user a creator
/*
-- First, update the application status
UPDATE creator_applications 
SET 
    status = 'approved',
    reviewed_at = NOW()
WHERE id = 1;  -- Replace with application ID

-- Then, make the user a creator
UPDATE users 
SET is_creator = true 
WHERE id = (
    SELECT user_id 
    FROM creator_applications 
    WHERE id = 1  -- Same application ID
);
*/

-- 9. VIEW DATA IN SUPABASE DASHBOARD
-- =====================================================
/*
In Supabase Dashboard:

1. Go to Table Editor
2. Click on 'users' table
3. You'll see all 9 users
4. Look at the 'is_creator' column:
   - true = Creator
   - false = Fan
   
To make someone a creator in the dashboard:
1. Click on the user row
2. Edit the 'is_creator' field
3. Change from false to true
4. Save

To view creator applications:
1. Click on 'creator_applications' table
2. Filter by status = 'pending' to see pending ones
*/

-- 10. QUICK STATS
-- =====================================================
SELECT 
    'Total Users' as metric,
    COUNT(*) as value
FROM users
UNION ALL
SELECT 
    'Creators' as metric,
    COUNT(*) as value
FROM users WHERE is_creator = true
UNION ALL
SELECT 
    'Fans' as metric,
    COUNT(*) as value
FROM users WHERE is_creator = false
UNION ALL
SELECT 
    'Pending Applications' as metric,
    COUNT(*) as value
FROM creator_applications WHERE status = 'pending';

-- 11. IF YOU NEED TO CREATE SAMPLE DATA
-- =====================================================
/*
-- Add a sample creator
INSERT INTO users (email, username, is_creator, created_at)
VALUES ('creator1@example.com', 'creator1', true, NOW());

-- Add a sample fan
INSERT INTO users (email, username, is_creator, created_at)
VALUES ('fan1@example.com', 'fan1', false, NOW());

-- Add a sample creator application
INSERT INTO creator_applications (user_id, status, created_at)
SELECT id, 'pending', NOW() 
FROM users 
WHERE email = 'fan1@example.com';
*/