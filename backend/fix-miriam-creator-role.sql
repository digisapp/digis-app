-- Fix Miriam's creator role
-- Run this script to ensure Miriam is recognized as a creator

-- First, let's find Miriam's account
-- Replace 'miriam@example.com' with the actual email used to log in
DO $$
DECLARE
  miriam_id uuid;
  miriam_supabase_id uuid;
BEGIN
  -- Find Miriam by email or username
  -- Update the WHERE clause to match Miriam's actual email
  SELECT id, supabase_id INTO miriam_id, miriam_supabase_id
  FROM users
  WHERE email ILIKE '%miriam%'
     OR username ILIKE '%miriam%'
     OR display_name ILIKE '%miriam%'
  LIMIT 1;

  -- If found, update to creator
  IF miriam_id IS NOT NULL THEN
    UPDATE users
    SET
      is_creator = true,
      role = 'creator',
      creator_type = COALESCE(creator_type, 'general'),
      updated_at = NOW()
    WHERE id = miriam_id;

    RAISE NOTICE 'Updated user ID % (supabase_id: %) to creator', miriam_id, miriam_supabase_id;
  ELSE
    RAISE NOTICE 'No user found matching "miriam" - please update the WHERE clause with the correct email/username';
  END IF;
END $$;

-- Verify the change
SELECT
  id,
  supabase_id,
  email,
  username,
  display_name,
  is_creator,
  role,
  creator_type,
  is_super_admin
FROM users
WHERE email ILIKE '%miriam%'
   OR username ILIKE '%miriam%'
   OR display_name ILIKE '%miriam%';
