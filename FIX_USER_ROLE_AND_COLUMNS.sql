-- Fix User Role and Missing Columns
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. CHECK AND FIX MIRIAM'S CREATOR STATUS
-- ============================================

-- Check current status
SELECT 
    supabase_id,
    email, 
    username,
    is_creator,
    role,
    is_admin,
    creator_type,
    creator_rate,
    voice_rate,
    stream_rate
FROM users 
WHERE email = 'miriam@examodels.com';

-- Update Miriam to be a creator
UPDATE users 
SET 
    is_creator = true,
    role = 'creator',
    creator_type = 'Content Creator',
    creator_rate = 50,
    voice_rate = 40,
    stream_rate = 30,
    available_for_calls = true
WHERE email = 'miriam@examodels.com';

-- ============================================
-- 2. ADD MISSING COLUMNS TO USERS TABLE
-- ============================================

-- Add video_price column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'video_price') THEN
        ALTER TABLE users ADD COLUMN video_price INTEGER DEFAULT 50;
    END IF;
END $$;

-- ============================================
-- 3. ADD MISSING COLUMNS TO SESSIONS TABLE
-- ============================================

-- Add fan_id column to sessions if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'fan_id') THEN
        ALTER TABLE sessions ADD COLUMN fan_id UUID REFERENCES users(supabase_id);
    END IF;
END $$;

-- Add start_time column to sessions if it doesn't exist (might be a typo for started_at)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'start_time') THEN
        ALTER TABLE sessions ADD COLUMN start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- ============================================
-- 4. VERIFY ALL CHANGES
-- ============================================

-- Verify Miriam is now a creator
SELECT 
    email, 
    username,
    is_creator,
    role,
    creator_type,
    'Successfully updated to Creator' as status
FROM users 
WHERE email = 'miriam@examodels.com';

-- Check if columns were added
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'users'
    AND column_name = 'video_price'
UNION ALL
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'sessions'
    AND column_name IN ('fan_id', 'start_time');

-- ============================================
-- 5. OPTIONAL: CHECK ALL CREATORS
-- ============================================

-- List all creators in the system
SELECT 
    email,
    username,
    is_creator,
    role,
    creator_type,
    creator_rate,
    video_price
FROM users
WHERE is_creator = true
ORDER BY created_at DESC;

-- ============================================
-- IMPORTANT NOTES:
-- ============================================
-- After running this script:
-- 1. Sign out from the frontend
-- 2. Sign back in as miriam@examodels.com
-- 3. You should now see the Creator Dashboard
-- 
-- The /api/auth/verify-role endpoint should now return:
-- { role: 'creator', isCreator: true }
-- ============================================