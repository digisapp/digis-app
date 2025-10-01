-- ============================================
-- ESSENTIAL USER MANAGEMENT QUERIES
-- ============================================
-- Run these queries in order in your Supabase SQL Editor

-- 1. CHECK IF NATHAN@DIGIS.CC EXISTS AND STATUS
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

-- If the above returns a row, skip to step 3
-- If no row returned, nathan@digis.cc hasn't logged in yet


-- 2. CHECK YOUR OWN ACCOUNT STATUS (replace with your email)
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
WHERE email = 'YOUR_EMAIL_HERE';  -- Replace with your actual email


-- 3. MAKE NATHAN@DIGIS.CC AN ADMIN (if user exists)
-- --------------------------------------------
UPDATE users 
SET 
  is_super_admin = true,
  role = 'admin'
WHERE email = 'nathan@digis.cc';

-- Verify the update worked
SELECT email, username, is_creator, is_super_admin, role 
FROM users 
WHERE email = 'nathan@digis.cc';


-- 4. MAKE YOURSELF AN ADMIN (replace email)
-- --------------------------------------------
UPDATE users 
SET 
  is_super_admin = true,
  role = 'admin'
WHERE email = 'YOUR_EMAIL_HERE';  -- Replace with your actual email


-- 5. VIEW ALL CURRENT ADMINS
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


-- 6. VIEW ALL USERS (to find specific people)
-- --------------------------------------------
SELECT 
  email,
  username,
  display_name,
  is_creator,
  is_super_admin,
  role,
  created_at
FROM users 
ORDER BY created_at DESC
LIMIT 100;


-- 7. FIX MISSING is_online COLUMN ERROR
-- --------------------------------------------
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;