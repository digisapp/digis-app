-- ============================================
-- USER MANAGEMENT QUERIES FOR DIGIS
-- ============================================

-- 1. CHECK NATHAN@DIGIS.CC STATUS
-- --------------------------------------------
SELECT 
  id,
  supabase_id,
  email,
  username,
  display_name,
  is_creator,
  is_super_admin,
  role,
  created_at
FROM users 
WHERE email = 'nathan@digis.cc';


-- 2. MAKE NATHAN@DIGIS.CC AN ADMIN
-- --------------------------------------------
UPDATE users 
SET 
  is_super_admin = true,
  role = 'admin'
WHERE email = 'nathan@digis.cc';

-- Verify the update
SELECT email, username, is_creator, is_super_admin, role 
FROM users 
WHERE email = 'nathan@digis.cc';


-- 3. VIEW ALL ADMINS
-- --------------------------------------------
SELECT 
  email,
  username,
  display_name,
  is_super_admin,
  role,
  created_at
FROM users 
WHERE is_super_admin = true
ORDER BY created_at DESC;


-- 4. VIEW ALL CREATORS
-- --------------------------------------------
SELECT 
  email,
  username,
  display_name,
  is_creator,
  creator_type,
  created_at
FROM users 
WHERE is_creator = true
ORDER BY created_at DESC
LIMIT 20;


-- 5. MAKE ANY USER A CREATOR (Replace email)
-- --------------------------------------------
UPDATE users 
SET 
  is_creator = true,
  creator_type = 'Creator' -- Can be: Model, Influencer, Artist, Singer, etc.
WHERE email = 'user@example.com';


-- 6. MAKE ANY USER AN ADMIN (Replace email)
-- --------------------------------------------
UPDATE users 
SET 
  is_super_admin = true,
  role = 'admin'
WHERE email = 'user@example.com';


-- 7. REMOVE ADMIN PRIVILEGES (Replace email)
-- --------------------------------------------
UPDATE users 
SET 
  is_super_admin = false,
  role = 'user'
WHERE email = 'user@example.com';


-- 8. REMOVE CREATOR STATUS (Replace email)
-- --------------------------------------------
UPDATE users 
SET 
  is_creator = false,
  creator_type = NULL
WHERE email = 'user@example.com';


-- 9. BULK OPERATIONS - Make multiple users creators
-- --------------------------------------------
UPDATE users 
SET 
  is_creator = true,
  creator_type = 'Creator'
WHERE email IN (
  'email1@example.com',
  'email2@example.com',
  'email3@example.com'
);


-- 10. VIEW USER STATISTICS
-- --------------------------------------------
SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN is_creator = true THEN 1 END) as total_creators,
  COUNT(CASE WHEN is_super_admin = true THEN 1 END) as total_admins,
  COUNT(CASE WHEN is_creator = false AND is_super_admin = false THEN 1 END) as total_fans
FROM users;


-- 11. SEARCH USERS BY USERNAME OR EMAIL
-- --------------------------------------------
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
WHERE 
  email ILIKE '%search_term%' 
  OR username ILIKE '%search_term%'
  OR display_name ILIKE '%search_term%'
ORDER BY created_at DESC;


-- 12. FIX MISSING USER RECORDS
-- --------------------------------------------
-- If a user exists in Supabase Auth but not in users table
-- First get their ID from Supabase Auth, then:

INSERT INTO users (
  supabase_id,
  email,
  username,
  is_creator,
  is_super_admin,
  created_at,
  updated_at
) VALUES (
  'supabase-auth-uuid-here',
  'user@example.com',
  'username',
  false,  -- is_creator
  false,  -- is_super_admin
  NOW(),
  NOW()
)
ON CONFLICT (supabase_id) DO NOTHING;


-- 13. PROMOTE ACTIVE USERS TO CREATORS
-- --------------------------------------------
-- Example: Make users with token balance > 1000 creators
UPDATE users 
SET is_creator = true
WHERE supabase_id IN (
  SELECT user_supabase_id 
  FROM token_balances 
  WHERE balance > 1000
);


-- 14. VIEW RECENTLY REGISTERED USERS
-- --------------------------------------------
SELECT 
  email,
  username,
  display_name,
  is_creator,
  is_super_admin,
  created_at
FROM users 
ORDER BY created_at DESC
LIMIT 50;


-- 15. COMPREHENSIVE USER REPORT
-- --------------------------------------------
SELECT 
  u.email,
  u.username,
  u.display_name,
  u.is_creator,
  u.is_super_admin,
  u.creator_type,
  u.role,
  u.created_at,
  COALESCE(tb.balance, 0) as token_balance,
  (SELECT COUNT(*) FROM followers WHERE creator_id = u.supabase_id) as follower_count,
  (SELECT COUNT(*) FROM sessions WHERE creator_supabase_id = u.supabase_id) as total_sessions
FROM users u
LEFT JOIN token_balances tb ON u.supabase_id = tb.user_supabase_id
WHERE u.email = 'nathan@digis.cc';  -- Change email as needed