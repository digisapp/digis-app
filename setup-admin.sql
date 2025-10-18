-- ============================================
-- DIGIS ADMIN SETUP SCRIPT
-- ============================================
-- Run this in Supabase SQL Editor to set up admin access
-- ============================================

-- Step 1: Make your account an admin
-- IMPORTANT: Replace 'YOUR_EMAIL@example.com' with your actual email!

UPDATE users
SET
  is_super_admin = true,
  role = 'admin',
  updated_at = NOW()
WHERE email = 'YOUR_EMAIL@example.com';

-- Step 2: Verify it worked
-- You should see your account with is_super_admin = true and role = 'admin'

SELECT
  id,
  username,
  email,
  is_super_admin,
  role,
  is_creator,
  created_at,
  updated_at
FROM users
WHERE email = 'YOUR_EMAIL@example.com';

-- ============================================
-- OPTIONAL: Additional Admin Setup
-- ============================================

-- Make an existing creator also an admin (they keep creator privileges)
-- UPDATE users SET is_super_admin = true, role = 'admin' WHERE email = 'creator@example.com';

-- Create a dedicated admin-only account (if needed)
-- This assumes the user already exists in the database
-- UPDATE users SET is_super_admin = true, is_creator = false, role = 'admin' WHERE email = 'admin-only@example.com';

-- ============================================
-- USEFUL QUERIES FOR ADMIN MANAGEMENT
-- ============================================

-- View all admins
-- SELECT username, email, role, is_super_admin, is_creator FROM users WHERE is_super_admin = true OR role = 'admin';

-- View all pending creator applications
-- SELECT ca.id, u.username, u.email, ca.status, ca.created_at
-- FROM creator_applications ca
-- LEFT JOIN users u ON ca.supabase_user_id = u.supabase_id
-- WHERE ca.status = 'pending'
-- ORDER BY ca.created_at ASC;

-- Remove admin access from a user
-- UPDATE users SET is_super_admin = false, role = 'fan' WHERE email = 'remove-admin@example.com';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check database schema is correct (should show video_rate_cents, voice_rate_cents, etc.)
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'users'
-- AND column_name LIKE '%rate%'
-- ORDER BY column_name;

-- ============================================
-- DONE!
-- ============================================
-- After running this:
-- 1. Clear browser cache: localStorage.clear(); location.reload();
-- 2. Navigate to: https://digis.cc/admin/login
-- 3. Sign in with your admin email and password
-- 4. You should see the full admin dashboard!
-- ============================================
