-- =====================================================
-- UPDATE USER ROLES FOR SPECIFIC ACCOUNTS
-- =====================================================

-- First, let's check the current status of these users
SELECT 
    id,
    email,
    username,
    is_creator,
    is_admin,
    role,
    created_at
FROM users
WHERE email IN ('admin@digis.cc', 'nathan@digis.cc');

-- =====================================================
-- UPDATE admin@digis.cc TO BE AN ADMIN
-- =====================================================

UPDATE users
SET 
    is_admin = true,
    is_creator = false,
    role = 'admin',
    updated_at = NOW()
WHERE email = 'admin@digis.cc';

-- =====================================================
-- UPDATE nathan@digis.cc TO BE A CREATOR
-- =====================================================

UPDATE users
SET 
    is_creator = true,
    is_admin = false,
    role = 'creator',
    creator_status = 'approved',
    updated_at = NOW()
WHERE email = 'nathan@digis.cc';

-- =====================================================
-- VERIFY THE CHANGES
-- =====================================================

SELECT 
    id,
    email,
    username,
    is_creator,
    is_admin,
    role,
    creator_status,
    updated_at
FROM users
WHERE email IN ('admin@digis.cc', 'nathan@digis.cc');

-- =====================================================
-- ADDITIONAL: Ensure admin@digis.cc is not a creator
-- and nathan@digis.cc is an approved creator
-- =====================================================

-- Make sure admin@digis.cc has proper admin privileges
UPDATE users
SET 
    creator_status = NULL,
    creator_type = NULL,
    creator_category = NULL
WHERE email = 'admin@digis.cc';

-- Make sure nathan@digis.cc has proper creator setup
UPDATE users
SET 
    creator_status = 'approved',
    creator_type = COALESCE(creator_type, 'content_creator'),
    creator_category = COALESCE(creator_category, 'general')
WHERE email = 'nathan@digis.cc';

-- Final verification with all relevant fields
SELECT 
    email,
    username,
    is_creator,
    is_admin,
    role,
    creator_status,
    creator_type,
    creator_category,
    CASE 
        WHEN is_admin = true THEN 'Admin Account'
        WHEN is_creator = true THEN 'Creator Account'
        ELSE 'Fan Account'
    END as account_type
FROM users
WHERE email IN ('admin@digis.cc', 'nathan@digis.cc')
ORDER BY email;