-- Check if Miriam exists in the database
SELECT 
  supabase_id,
  email,
  username,
  display_name,
  role,
  is_creator,
  created_at,
  updated_at
FROM users
WHERE supabase_id = '963af068-edb0-4d12-8e8e-cfdb270eea26'
   OR email ILIKE '%miriam%';

-- Count total users
SELECT COUNT(*) as total_users FROM users;
