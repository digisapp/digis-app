-- ============================================
-- SUPABASE USER SYNC FIX (Version 3)
-- ============================================
-- This SQL script creates a trigger to automatically sync 
-- Supabase Auth users to your custom users table
-- 
-- Run this in your Supabase SQL editor:
-- https://supabase.com/dashboard/project/lpphsjowsivjtcmafxnj/sql/new
-- ============================================

-- First, let's check the structure of your users table
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE 'Checking users table structure...';
  RAISE NOTICE 'Columns in users table:';
  
  FOR r IN 
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users'
    ORDER BY ordinal_position
  LOOP
    RAISE NOTICE '  - %: %', r.column_name, r.data_type;
  END LOOP;
END $$;

-- Step 1: Create a function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert the new user into the public.users table (without email)
  INSERT INTO public.users (
    id,  -- This will use the UUID from auth.users
    username,
    created_at,
    updated_at,
    is_creator,
    show_token_balance,
    auto_refill_enabled,
    is_suspended,
    profile_blocked,
    require_verification,
    auto_accept_regulars,
    is_sso_user,
    is_anonymous
  ) VALUES (
    new.id,  -- UUID from auth.users
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    now(),
    now(),
    false,  -- Default not a creator
    false,  -- Default hide token balance
    false,  -- Default no auto-refill
    false,  -- Default not suspended
    false,  -- Default profile not blocked
    false,  -- Default no verification required
    false,  -- Default don't auto-accept regulars
    false,  -- Default not SSO user
    false   -- Default not anonymous
  );
  
  -- Also create a token balance record for the new user
  INSERT INTO public.token_balances (
    user_id,
    balance,
    created_at,
    updated_at
  ) VALUES (
    new.id,
    0,  -- Start with 0 tokens
    now(),
    now()
  ) ON CONFLICT (user_id) DO NOTHING;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create the trigger that fires when a new auth user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 3: Create a function to handle user updates (metadata, etc.)
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS trigger AS $$
BEGIN
  -- Update the corresponding user in public.users
  UPDATE public.users
  SET
    username = COALESCE(new.raw_user_meta_data->>'username', username),
    updated_at = now()
  WHERE id = new.id;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create trigger for user updates
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

-- Step 5: Sync existing auth users that aren't in the users table yet
-- This will add any auth users that were created before the trigger
INSERT INTO public.users (
  id,
  username,
  created_at,
  updated_at,
  is_creator,
  show_token_balance,
  auto_refill_enabled,
  is_suspended,
  profile_blocked,
  require_verification,
  auto_accept_regulars,
  is_sso_user,
  is_anonymous
)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'username', split_part(au.email, '@', 1)),
  COALESCE(au.created_at, now()),
  now(),
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id
WHERE u.id IS NULL;

-- Step 6: Create token balances for any users missing them
INSERT INTO public.token_balances (user_id, balance, created_at, updated_at)
SELECT 
  u.id,
  0,
  now(),
  now()
FROM public.users u
LEFT JOIN public.token_balances tb ON tb.user_id = u.id
WHERE tb.user_id IS NULL;

-- Step 7: Verify the setup
DO $$
DECLARE
  auth_count INTEGER;
  users_count INTEGER;
  missing_count INTEGER;
BEGIN
  -- Count auth users
  SELECT COUNT(*) INTO auth_count FROM auth.users;
  
  -- Count users in public.users table
  SELECT COUNT(*) INTO users_count FROM public.users WHERE id IN (SELECT id FROM auth.users);
  
  -- Count missing users
  missing_count := auth_count - users_count;
  
  RAISE NOTICE '✅ Setup Complete!';
  RAISE NOTICE '📊 Auth users: %', auth_count;
  RAISE NOTICE '📊 Synced users: %', users_count;
  RAISE NOTICE '📊 Missing users: %', missing_count;
  
  IF missing_count > 0 THEN
    RAISE WARNING '⚠️  There are still % users not synced. Check for conflicts.', missing_count;
  ELSE
    RAISE NOTICE '✅ All auth users are synced!';
  END IF;
END $$;

-- ============================================
-- OPTIONAL: Fix ID column issues
-- ============================================
-- First, let's check if there are duplicate ID columns
DO $$
DECLARE
  id_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO id_count
  FROM information_schema.columns
  WHERE table_schema = 'public' 
  AND table_name = 'users'
  AND column_name = 'id';
  
  IF id_count > 1 THEN
    RAISE NOTICE '⚠️  Found % columns named "id" in users table', id_count;
    RAISE NOTICE 'To fix this, you may need to:';
    RAISE NOTICE '1. Backup your data first!';
    RAISE NOTICE '2. Drop the integer id column';
    RAISE NOTICE '3. Keep only the UUID id column';
  END IF;
END $$;

-- ============================================
-- OPTIONAL: Add email column if needed
-- ============================================
-- If you want to store emails in the users table, uncomment this:
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
-- 
-- Then update existing users with their emails:
-- UPDATE public.users u
-- SET email = au.email
-- FROM auth.users au
-- WHERE u.id = au.id;
-- ============================================