-- =====================================================
-- SAFE UPDATE USER ROLES - Only uses existing columns
-- =====================================================

-- Step 1: Check what columns actually exist in the users table
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 2: Check current users
SELECT * FROM users 
WHERE email IN ('admin@digis.cc', 'nathan@digis.cc');

-- =====================================================
-- UPDATE admin@digis.cc TO BE AN ADMIN
-- Only update columns that exist
-- =====================================================

UPDATE users
SET 
    is_super_admin = true,
    is_creator = false,
    role = 'admin',
    updated_at = NOW()
WHERE email = 'admin@digis.cc';

-- =====================================================
-- UPDATE nathan@digis.cc TO BE A CREATOR
-- Only update columns that exist
-- =====================================================

UPDATE users
SET 
    is_creator = true,
    is_super_admin = false,
    role = 'creator',
    price_per_min = COALESCE(price_per_min, 5.00),
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
    price_per_min,
    updated_at,
    CASE 
        WHEN is_super_admin = true THEN 'Admin Account'
        WHEN role = 'admin' THEN 'Admin Account'
        WHEN is_creator = true THEN 'Creator Account'
        ELSE 'Fan Account'
    END as account_type
FROM users
WHERE email IN ('admin@digis.cc', 'nathan@digis.cc')
ORDER BY email;