-- ============================================
-- COMPLETE SUPABASE SCHEMA UPDATE FOR DIGIS (FIXED)
-- ============================================
-- This SQL script updates your Supabase database with all columns
-- from your full stack application
-- 
-- Run this in your Supabase SQL editor:
-- https://supabase.com/dashboard/project/lpphsjowsivjtcmafxnj/sql/new
-- ============================================

-- First, let's check current schema
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Current users table columns:';
  FOR r IN 
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users'
    ORDER BY ordinal_position
  LOOP
    RAISE NOTICE '  - %: %', r.column_name, r.data_type;
  END LOOP;
  RAISE NOTICE '============================================';
END $$;

-- ============================================
-- STEP 1: Update Users Table Structure
-- ============================================

-- Add missing columns to users table (safe - won't error if column exists)
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS supabase_id UUID UNIQUE,
  ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS profile_pic_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS price_per_min DECIMAL(10,2) DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS total_sessions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(15,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total_spent DECIMAL(15,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS creator_token_balance INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS state VARCHAR(100),
  ADD COLUMN IF NOT EXISTS country VARCHAR(100),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS raw_user_meta_data JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS aud VARCHAR(255) DEFAULT 'authenticated',
  ADD COLUMN IF NOT EXISTS role VARCHAR(255) DEFAULT 'authenticated',
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS banned_until TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS is_sso_user BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Fix any ID column issues
DO $$
BEGIN
  -- If we have both integer and UUID id columns, we need to fix this
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' 
    AND column_name = 'id' AND data_type = 'integer'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' 
    AND column_name = 'supabase_id'
  ) THEN
    -- First update supabase_id for all existing users
    UPDATE public.users 
    SET supabase_id = gen_random_uuid() 
    WHERE supabase_id IS NULL;
  END IF;
END $$;

-- ============================================
-- STEP 2: Update Token Balances Table
-- ============================================

-- First check if table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                 WHERE table_schema = 'public' AND table_name = 'token_balances') THEN
    -- Create table if it doesn't exist
    CREATE TABLE public.token_balances (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) UNIQUE, -- Firebase UID
      supabase_user_id UUID UNIQUE, -- Supabase UUID
      balance INTEGER DEFAULT 0 CHECK (balance >= 0),
      total_purchased INTEGER DEFAULT 0 CHECK (total_purchased >= 0),
      total_spent INTEGER DEFAULT 0 CHECK (total_spent >= 0),
      total_earned INTEGER DEFAULT 0 CHECK (total_earned >= 0),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  ELSE
    -- Add missing columns if table already exists
    ALTER TABLE public.token_balances
      ADD COLUMN IF NOT EXISTS supabase_user_id UUID UNIQUE,
      ADD COLUMN IF NOT EXISTS total_purchased INTEGER DEFAULT 0 CHECK (total_purchased >= 0),
      ADD COLUMN IF NOT EXISTS total_spent INTEGER DEFAULT 0 CHECK (total_spent >= 0),
      ADD COLUMN IF NOT EXISTS total_earned INTEGER DEFAULT 0 CHECK (total_earned >= 0),
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- ============================================
-- STEP 3: Create Sessions Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.sessions (
  id SERIAL PRIMARY KEY,
  session_uid VARCHAR(255) UNIQUE NOT NULL,
  creator_id INTEGER REFERENCES users(id),
  fan_id INTEGER REFERENCES users(id),
  type VARCHAR(50) CHECK (type IN ('video', 'voice', 'stream')),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'ended', 'cancelled')),
  start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_time TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER DEFAULT 0,
  rate_per_min DECIMAL(10,2) DEFAULT 1.00,
  total_cost DECIMAL(15,2) DEFAULT 0.00,
  tokens_charged INTEGER DEFAULT 0,
  agora_channel VARCHAR(255),
  agora_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- STEP 4: Create Token Transactions Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.token_transactions (
  id SERIAL PRIMARY KEY,
  transaction_id VARCHAR(255) UNIQUE DEFAULT gen_random_uuid()::text,
  user_id VARCHAR(255), -- Firebase UID
  supabase_user_id UUID, -- Supabase UUID
  type VARCHAR(50) CHECK (type IN ('purchase', 'spend', 'earn', 'tip', 'refund', 'gift_sent', 'gift_received')),
  amount INTEGER NOT NULL,
  balance_before INTEGER,
  balance_after INTEGER,
  description TEXT,
  reference_id VARCHAR(255),
  reference_type VARCHAR(50),
  stripe_payment_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- STEP 5: Create Virtual Gifts Tables
-- ============================================

CREATE TABLE IF NOT EXISTS public.virtual_gifts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  emoji VARCHAR(50),
  icon_url TEXT,
  cost INTEGER NOT NULL CHECK (cost > 0),
  rarity VARCHAR(50) DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gifts_sent (
  id SERIAL PRIMARY KEY,
  gift_id INTEGER REFERENCES virtual_gifts(id),
  sender_id INTEGER REFERENCES users(id),
  receiver_id INTEGER REFERENCES users(id),
  session_id INTEGER REFERENCES sessions(id),
  cost INTEGER NOT NULL,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- STEP 6: Create Tips Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.tips (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER REFERENCES users(id),
  receiver_id INTEGER REFERENCES users(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  message TEXT,
  session_id INTEGER REFERENCES sessions(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- STEP 7: Create Chat Messages Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES sessions(id),
  sender_id INTEGER REFERENCES users(id),
  message TEXT NOT NULL,
  is_system_message BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- STEP 8: Update Auth Trigger Functions
-- ============================================

-- Create function to sync Supabase auth users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (
    supabase_id,
    email,
    username,
    email_verified,
    auth_provider,
    raw_user_meta_data,
    aud,
    role,
    confirmed_at,
    created_at,
    updated_at
  ) VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    COALESCE(new.email_confirmed_at IS NOT NULL, FALSE),
    CASE 
      WHEN new.raw_app_meta_data->>'provider' IS NOT NULL 
      THEN new.raw_app_meta_data->>'provider'
      ELSE 'email'
    END,
    new.raw_user_meta_data,
    new.aud,
    new.role,
    new.confirmed_at,
    now(),
    now()
  ) ON CONFLICT (supabase_id) DO UPDATE SET
    email = EXCLUDED.email,
    email_verified = EXCLUDED.email_verified,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = now();
  
  -- Create token balance for new user (check if columns exist first)
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'token_balances' 
             AND column_name = 'created_at') THEN
    INSERT INTO public.token_balances (
      supabase_user_id,
      balance,
      created_at,
      updated_at
    ) VALUES (
      new.id,
      0,
      now(),
      now()
    ) ON CONFLICT (supabase_user_id) DO NOTHING;
  ELSE
    -- If created_at doesn't exist, insert without it
    INSERT INTO public.token_balances (
      supabase_user_id,
      balance
    ) VALUES (
      new.id,
      0
    ) ON CONFLICT (supabase_user_id) DO NOTHING;
  END IF;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create/update triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update function for auth user updates
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS trigger AS $$
BEGIN
  UPDATE public.users
  SET
    email = new.email,
    username = COALESCE(new.raw_user_meta_data->>'username', username),
    email_verified = COALESCE(new.email_confirmed_at IS NOT NULL, email_verified),
    raw_user_meta_data = new.raw_user_meta_data,
    updated_at = now()
  WHERE supabase_id = new.id;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

-- ============================================
-- STEP 9: Sync Existing Auth Users
-- ============================================

-- First, update existing users with Supabase IDs if they don't have them
DO $$
DECLARE
  auth_user RECORD;
BEGIN
  FOR auth_user IN SELECT * FROM auth.users LOOP
    -- Try to match by email first
    UPDATE public.users 
    SET supabase_id = auth_user.id,
        email_verified = COALESCE(auth_user.email_confirmed_at IS NOT NULL, FALSE),
        raw_user_meta_data = auth_user.raw_user_meta_data,
        confirmed_at = auth_user.confirmed_at
    WHERE email = auth_user.email AND supabase_id IS NULL;
    
    -- If no match by email, insert new user
    INSERT INTO public.users (
      supabase_id,
      email,
      username,
      email_verified,
      auth_provider,
      raw_user_meta_data,
      aud,
      role,
      confirmed_at,
      created_at,
      updated_at
    ) VALUES (
      auth_user.id,
      auth_user.email,
      COALESCE(auth_user.raw_user_meta_data->>'username', split_part(auth_user.email, '@', 1)),
      COALESCE(auth_user.email_confirmed_at IS NOT NULL, FALSE),
      CASE 
        WHEN auth_user.raw_app_meta_data->>'provider' IS NOT NULL 
        THEN auth_user.raw_app_meta_data->>'provider'
        ELSE 'email'
      END,
      auth_user.raw_user_meta_data,
      auth_user.aud,
      auth_user.role,
      auth_user.confirmed_at,
      COALESCE(auth_user.created_at, now()),
      now()
    ) ON CONFLICT (supabase_id) DO NOTHING;
  END LOOP;
END $$;

-- Create token balances for all users (handle missing columns)
DO $$
BEGIN
  -- Check if created_at column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'token_balances' 
             AND column_name = 'created_at') THEN
    -- Insert with timestamps
    INSERT INTO public.token_balances (supabase_user_id, balance, created_at, updated_at)
    SELECT u.supabase_id, 0, now(), now()
    FROM public.users u
    WHERE u.supabase_id IS NOT NULL
    ON CONFLICT (supabase_user_id) DO NOTHING;
  ELSE
    -- Insert without timestamps
    INSERT INTO public.token_balances (supabase_user_id, balance)
    SELECT u.supabase_id, 0
    FROM public.users u
    WHERE u.supabase_id IS NOT NULL
    ON CONFLICT (supabase_user_id) DO NOTHING;
  END IF;
END $$;

-- ============================================
-- STEP 10: Create Indexes for Performance
-- ============================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON public.users(supabase_id);
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON public.users(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_is_creator ON public.users(is_creator);

-- Token balances indexes
CREATE INDEX IF NOT EXISTS idx_token_balances_supabase_user_id ON public.token_balances(supabase_user_id);
CREATE INDEX IF NOT EXISTS idx_token_balances_user_id ON public.token_balances(user_id);

-- Sessions indexes
CREATE INDEX IF NOT EXISTS idx_sessions_creator_id ON public.sessions(creator_id);
CREATE INDEX IF NOT EXISTS idx_sessions_fan_id ON public.sessions(fan_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.sessions(status);

-- ============================================
-- STEP 11: Add Sample Virtual Gifts
-- ============================================

INSERT INTO public.virtual_gifts (name, emoji, cost, rarity) VALUES
  ('Rose', '🌹', 10, 'common'),
  ('Heart', '❤️', 20, 'common'),
  ('Diamond', '💎', 100, 'rare'),
  ('Crown', '👑', 500, 'epic'),
  ('Star', '⭐', 50, 'common'),
  ('Fire', '🔥', 75, 'rare'),
  ('Rocket', '🚀', 200, 'rare'),
  ('Rainbow', '🌈', 300, 'epic'),
  ('Unicorn', '🦄', 1000, 'legendary')
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 12: Verify the Update
-- ============================================

DO $$
DECLARE
  col_count INTEGER;
  auth_count INTEGER;
  users_count INTEGER;
  synced_count INTEGER;
  r RECORD;
BEGIN
  -- Count columns in users table
  SELECT COUNT(*) INTO col_count 
  FROM information_schema.columns 
  WHERE table_schema = 'public' AND table_name = 'users';
  
  -- Count auth users
  SELECT COUNT(*) INTO auth_count FROM auth.users;
  
  -- Count users in public.users
  SELECT COUNT(*) INTO users_count FROM public.users;
  
  -- Count synced users
  SELECT COUNT(*) INTO synced_count 
  FROM public.users 
  WHERE supabase_id IS NOT NULL;
  
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ Schema Update Complete!';
  RAISE NOTICE '📊 Users table now has % columns', col_count;
  RAISE NOTICE '📊 Auth users: %', auth_count;
  RAISE NOTICE '📊 Total users: %', users_count;
  RAISE NOTICE '📊 Synced users: %', synced_count;
  RAISE NOTICE '============================================';
  
  -- Show token_balances columns
  RAISE NOTICE 'Token balances table columns:';
  FOR r IN 
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'token_balances'
    ORDER BY ordinal_position
  LOOP
    RAISE NOTICE '  - %: %', r.column_name, r.data_type;
  END LOOP;
  RAISE NOTICE '============================================';
END $$;