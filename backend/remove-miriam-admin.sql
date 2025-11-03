-- Remove admin access from Miriam and set her as a regular creator
-- Run this in Supabase SQL Editor

UPDATE users
SET is_admin = false,
    is_super_admin = false,
    role = 'creator'
WHERE email = 'miriam@examodels.com';

-- Verify the change
SELECT
  email,
  username,
  is_admin,
  is_super_admin,
  is_creator,
  role
FROM users
WHERE email = 'miriam@examodels.com';
