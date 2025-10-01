-- =====================================================
-- MAKE admin@digis.cc AN ADMIN USER
-- =====================================================

-- First, check if the user exists
SELECT 
    id,
    email,
    username,
    is_creator,
    is_super_admin,
    role
FROM users 
WHERE email = 'admin@digis.cc';

-- If user doesn't exist, create them as admin
INSERT INTO users (
    email,
    username,
    display_name,
    is_creator,
    is_super_admin,
    role,
    created_at
) VALUES (
    'admin@digis.cc',
    'admin',
    'Digis Admin',
    false,  -- Not a creator, just admin
    true,   -- Is super admin
    'admin', -- Admin role
    NOW()
) ON CONFLICT (email) DO UPDATE SET
    is_super_admin = true,
    role = 'admin',
    updated_at = NOW();

-- If user already exists, update them to admin
UPDATE users 
SET 
    is_super_admin = true,
    role = 'admin',
    updated_at = NOW()
WHERE email = 'admin@digis.cc';

-- Verify the admin was created/updated
SELECT 
    id,
    email,
    username,
    display_name,
    is_creator,
    is_super_admin,
    role,
    created_at
FROM users 
WHERE email = 'admin@digis.cc';

-- =====================================================
-- ALSO CREATE IN SUPABASE AUTH (IMPORTANT!)
-- =====================================================

/*
IMPORTANT: You also need to create this user in Supabase Auth:

1. Go to Supabase Dashboard
2. Navigate to Authentication → Users
3. Click "Add User" → "Create New User"
4. Enter:
   - Email: admin@digis.cc
   - Password: [choose a secure password]
   - Click "Create User"
   - Check "Auto Confirm Email" if you want to skip email verification

OR use the Supabase Auth API/SDK:
*/

-- After creating in Supabase Auth, link the auth user to database user
-- You'll need the UUID from Supabase Auth for this
/*
UPDATE users 
SET supabase_id = 'UUID-FROM-SUPABASE-AUTH'
WHERE email = 'admin@digis.cc';
*/

-- =====================================================
-- GRANT FULL ADMIN PRIVILEGES
-- =====================================================

-- Ensure admin has all necessary permissions
UPDATE users 
SET 
    is_super_admin = true,
    role = 'admin',
    is_creator = false,  -- Admins typically aren't creators
    email_verified = true,
    updated_at = NOW()
WHERE email = 'admin@digis.cc';

-- =====================================================
-- VERIFY ADMIN ACCESS
-- =====================================================

-- Check all admin users in the system
SELECT 
    id,
    email,
    username,
    is_super_admin,
    role,
    created_at
FROM users 
WHERE is_super_admin = true OR role = 'admin'
ORDER BY created_at DESC;

-- =====================================================
-- TEST ADMIN CAPABILITIES
-- =====================================================

-- Create a test creator application to review
INSERT INTO creator_applications (
    user_id,
    status,
    created_at
) 
SELECT 
    id,
    'pending',
    NOW()
FROM users 
WHERE email != 'admin@digis.cc'
LIMIT 1;

-- View pending applications (what admin will see)
SELECT 
    ca.id,
    ca.status,
    ca.created_at,
    u.email,
    u.username
FROM creator_applications ca
JOIN users u ON u.id = ca.user_id
WHERE ca.status = 'pending'
ORDER BY ca.created_at DESC;

-- =====================================================
-- RESULT MESSAGE
-- =====================================================

/*
After running this script:

✅ admin@digis.cc is now a super admin
✅ They can access /admin dashboard
✅ They can approve/reject creator applications
✅ They have full admin privileges

Next steps:
1. Create the user in Supabase Auth (see instructions above)
2. Link the Supabase Auth UUID to the database user
3. Login as admin@digis.cc
4. Navigate to /admin to access the Admin Dashboard
*/