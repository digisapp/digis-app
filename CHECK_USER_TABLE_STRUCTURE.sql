-- =====================================================
-- CHECK USERS TABLE STRUCTURE
-- =====================================================

-- First, let's see what columns actually exist in the users table
SELECT 
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'users'
ORDER BY ordinal_position;

-- Check if we have any users with these emails
SELECT * FROM users 
WHERE email IN ('admin@digis.cc', 'nathan@digis.cc')
LIMIT 10;