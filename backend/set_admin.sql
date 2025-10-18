-- Set user as admin/super admin
-- Replace the email or supabase_id below with the actual admin user

-- Option 1: Set by email
-- UPDATE users
-- SET
--   is_super_admin = true,
--   is_creator = true,
--   role = 'admin',
--   updated_at = NOW()
-- WHERE email = 'admin@example.com';

-- Option 2: Set by supabase_id (recommended - more specific)
-- UPDATE users
-- SET
--   is_super_admin = true,
--   is_creator = true,
--   role = 'admin',
--   updated_at = NOW()
-- WHERE supabase_id = 'YOUR-SUPABASE-ID-HERE';

-- First, find your supabase_id:
-- SELECT supabase_id, email, username, role, is_super_admin
-- FROM users
-- WHERE email = 'your-email@example.com';

-- Then run this to set as admin:
-- UPDATE users
-- SET is_super_admin = true, is_creator = true, role = 'admin', updated_at = NOW()
-- WHERE supabase_id = 'your-supabase-id';

-- Verify the update
SELECT
  supabase_id,
  email,
  username,
  display_name,
  role,
  is_creator,
  is_super_admin,
  created_at,
  updated_at
FROM users
WHERE is_super_admin = true OR role = 'admin'
ORDER BY created_at DESC;
