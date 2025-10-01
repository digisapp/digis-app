-- Run this SQL in your Supabase SQL editor to make your account an admin
-- Replace the email with your actual email address

-- First, check your current user status
SELECT 
  id,
  supabase_id,
  email,
  username,
  is_creator,
  is_super_admin,
  role
FROM users 
WHERE email = 'YOUR_EMAIL_HERE';

-- Make yourself an admin
UPDATE users 
SET 
  is_super_admin = true,
  role = 'admin'
WHERE email = 'YOUR_EMAIL_HERE';

-- Verify the update
SELECT 
  id,
  supabase_id,
  email,
  username,
  is_creator,
  is_super_admin,
  role
FROM users 
WHERE email = 'YOUR_EMAIL_HERE';

-- Also add the missing is_online column that's causing errors
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;