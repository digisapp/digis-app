-- =====================================================
-- UPDATE USER ROLES FOR SPECIFIC ACCOUNTS (FIXED)
-- Using correct column names: is_super_admin and role
-- =====================================================

-- First, let's check the current status of these users
SELECT 
    id,
    email,
    username,
    is_creator,
    is_super_admin,
    role,
    creator_status,
    created_at
FROM users
WHERE email IN ('admin@digis.cc', 'nathan@digis.cc');

-- =====================================================
-- UPDATE admin@digis.cc TO BE AN ADMIN
-- =====================================================

UPDATE users
SET 
    is_super_admin = true,
    is_creator = false,
    role = 'admin',
    creator_status = NULL,
    updated_at = NOW()
WHERE email = 'admin@digis.cc';

-- =====================================================
-- UPDATE nathan@digis.cc TO BE A CREATOR
-- =====================================================

UPDATE users
SET 
    is_creator = true,
    is_super_admin = false,
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
    is_super_admin,
    role,
    creator_status,
    updated_at
FROM users
WHERE email IN ('admin@digis.cc', 'nathan@digis.cc');

-- =====================================================
-- ADDITIONAL: Ensure proper setup for both accounts
-- =====================================================

-- Make sure admin@digis.cc has no creator-specific fields
UPDATE users
SET 
    creator_status = NULL,
    creator_type = NULL,
    creator_category = NULL,
    price_per_min = NULL
WHERE email = 'admin@digis.cc';

-- Make sure nathan@digis.cc has proper creator setup
UPDATE users
SET 
    creator_status = 'approved',
    creator_type = COALESCE(creator_type, 'content_creator'),
    creator_category = COALESCE(creator_category, 'general'),
    price_per_min = COALESCE(price_per_min, 5.00)
WHERE email = 'nathan@digis.cc';

-- Final verification with all relevant fields
SELECT 
    email,
    username,
    is_creator,
    is_super_admin,
    role,
    creator_status,
    creator_type,
    creator_category,
    price_per_min,
    CASE 
        WHEN is_super_admin = true THEN 'Admin Account'
        WHEN role = 'admin' THEN 'Admin Account'
        WHEN is_creator = true THEN 'Creator Account'
        ELSE 'Fan Account'
    END as account_type
FROM users
WHERE email IN ('admin@digis.cc', 'nathan@digis.cc')
ORDER BY email;