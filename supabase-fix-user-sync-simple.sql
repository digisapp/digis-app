-- ============================================
-- SUPABASE USER SYNC FIX (SIMPLIFIED VERSION)
-- ============================================
-- This SQL script creates a trigger to automatically sync 
-- Supabase Auth users to your custom users table
-- 
-- Run this in your Supabase SQL editor:
-- https://supabase.com/dashboard/project/lpphsjowsivjtcmafxnj/sql/new
-- ============================================

-- First, let's see what columns actually exist in your users table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'users'
ORDER BY ordinal_position;

-- Step 1: Create a minimal function to handle new user creation
-- This only uses the most basic columns that should exist
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert the new user with minimal fields
  INSERT INTO public.users (
    id,
    username,
    created_at,
    updated_at
  ) VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    now(),
    now()
  ) ON CONFLICT (id) DO NOTHING;
  
  -- Create token balance if the table exists
  INSERT INTO public.token_balances (
    user_id,
    balance,
    created_at,
    updated_at
  ) VALUES (
    new.id,
    0,
    now(),
    now()
  ) ON CONFLICT (user_id) DO NOTHING;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 3: Create update function
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS trigger AS $$
BEGIN
  UPDATE public.users
  SET
    username = COALESCE(new.raw_user_meta_data->>'username', username),
    updated_at = now()
  WHERE id = new.id;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create update trigger
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

-- Step 5: Sync existing auth users (minimal version)
INSERT INTO public.users (
  id,
  username,
  created_at,
  updated_at
)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'username', split_part(au.email, '@', 1)),
  COALESCE(au.created_at, now()),
  now()
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id
WHERE u.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Step 6: Create token balances for users
INSERT INTO public.token_balances (user_id, balance, created_at, updated_at)
SELECT 
  u.id,
  0,
  now(),
  now()
FROM public.users u
LEFT JOIN public.token_balances tb ON tb.user_id = u.id
WHERE tb.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Step 7: Update existing users to set default values for boolean columns if they exist
DO $$
BEGIN
  -- Check and update is_creator if it exists
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_creator') THEN
    UPDATE public.users SET is_creator = false WHERE is_creator IS NULL;
  END IF;
  
  -- Check and update other boolean columns if they exist
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'show_token_balance') THEN
    UPDATE public.users SET show_token_balance = false WHERE show_token_balance IS NULL;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'auto_refill_enabled') THEN
    UPDATE public.users SET auto_refill_enabled = false WHERE auto_refill_enabled IS NULL;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_suspended') THEN
    UPDATE public.users SET is_suspended = false WHERE is_suspended IS NULL;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'profile_blocked') THEN
    UPDATE public.users SET profile_blocked = false WHERE profile_blocked IS NULL;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'require_verification') THEN
    UPDATE public.users SET require_verification = false WHERE require_verification IS NULL;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'auto_accept_regulars') THEN
    UPDATE public.users SET auto_accept_regulars = false WHERE auto_accept_regulars IS NULL;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_anonymous') THEN
    UPDATE public.users SET is_anonymous = false WHERE is_anonymous IS NULL;
  END IF;
END $$;

-- Step 8: Verify the setup
DO $$
DECLARE
  auth_count INTEGER;
  users_count INTEGER;
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO auth_count FROM auth.users;
  SELECT COUNT(*) INTO users_count FROM public.users WHERE id IN (SELECT id FROM auth.users);
  missing_count := auth_count - users_count;
  
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ Setup Complete!';
  RAISE NOTICE '📊 Auth users: %', auth_count;
  RAISE NOTICE '📊 Synced users: %', users_count;
  RAISE NOTICE '📊 Missing users: %', missing_count;
  
  IF missing_count > 0 THEN
    RAISE WARNING '⚠️  There are still % users not synced. Check for ID conflicts.', missing_count;
  ELSE
    RAISE NOTICE '✅ All auth users are synced!';
  END IF;
  RAISE NOTICE '============================================';
END $$;