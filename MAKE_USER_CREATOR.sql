-- This SQL script will make a user a creator in the database
-- Run this in your Supabase SQL Editor

-- First, let's check your current user status
SELECT id, username, email, is_creator, is_super_admin, role 
FROM users 
WHERE email = 'YOUR_EMAIL_HERE';  -- Replace with your email

-- To make yourself a creator, run this:
UPDATE users 
SET 
  is_creator = true,
  role = 'creator',
  creator_type = 'Model',  -- Or whatever type you prefer
  updated_at = NOW()
WHERE email = 'YOUR_EMAIL_HERE';  -- Replace with your email

-- Verify the update
SELECT id, username, email, is_creator, is_super_admin, role, creator_type
FROM users 
WHERE email = 'YOUR_EMAIL_HERE';  -- Replace with your email

-- If you also want to be an admin:
UPDATE users 
SET 
  is_super_admin = true,
  updated_at = NOW()
WHERE email = 'YOUR_EMAIL_HERE';  -- Replace with your email