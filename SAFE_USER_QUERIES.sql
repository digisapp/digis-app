-- =====================================================
-- SAFE USER QUERIES - Auto-detects available columns
-- =====================================================

-- STEP 1: SEE WHAT COLUMNS YOU ACTUALLY HAVE
-- =====================================================

-- List ALL columns in your users table
SELECT 
    ordinal_position as position,
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'users'
ORDER BY ordinal_position;

-- Check which expected columns exist
SELECT 
    'users table has these columns:' as info,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'id') as has_id,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'supabase_id') as has_supabase_id,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email') as has_email,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'username') as has_username,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_creator') as has_is_creator,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_online') as has_is_online,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'display_name') as has_display_name,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'bio') as has_bio,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'profile_pic_url') as has_profile_pic_url,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'price_per_min') as has_price_per_min,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role') as has_role,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_super_admin') as has_is_super_admin,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'created_at') as has_created_at;

-- =====================================================
-- STEP 2: BASIC SAFE QUERIES (Only using common columns)
-- =====================================================

-- Get all users with basic info (these columns should exist)
SELECT 
    id,
    email,
    username,
    is_creator,
    created_at
FROM users
LIMIT 10;

-- Count users by type (safe version)
SELECT 
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE is_creator = true) as creators,
    COUNT(*) FILTER (WHERE is_creator = false) as fans
FROM users;

-- =====================================================
-- STEP 3: GET ALL CREATORS (safe query)
-- =====================================================

-- Basic creator query (minimal columns)
SELECT 
    id,
    email,
    username,
    is_creator,
    created_at
FROM users 
WHERE is_creator = true
ORDER BY created_at DESC;

-- =====================================================
-- STEP 4: GET ALL FANS (safe query)
-- =====================================================

-- Basic fan query (minimal columns)
SELECT 
    id,
    email,
    username,
    is_creator,
    created_at
FROM users 
WHERE is_creator = false OR is_creator IS NULL
ORDER BY created_at DESC;

-- =====================================================
-- STEP 5: CHECK AND GET CREATOR APPLICATIONS
-- =====================================================

-- Check if creator_applications table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'creator_applications'
) as creator_applications_table_exists;

-- If it exists, check its structure
SELECT 
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'creator_applications'
ORDER BY ordinal_position;

-- Get pending applications (only run if table exists)
-- This query tries different join methods to handle various ID types
WITH application_data AS (
    SELECT * FROM creator_applications WHERE status = 'pending'
)
SELECT 
    a.*,
    u.email,
    u.username
FROM application_data a
LEFT JOIN users u ON 
    (a.supabase_user_id IS NOT NULL AND u.supabase_id = a.supabase_user_id)
    OR (a.user_id IS NOT NULL AND u.id = a.user_id)
ORDER BY a.created_at DESC;

-- =====================================================
-- STEP 6: ADD MISSING COLUMNS (if needed)
-- =====================================================

-- Add commonly needed columns if they don't exist
DO $$
BEGIN
    -- Add is_online column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'is_online'
    ) THEN
        ALTER TABLE users ADD COLUMN is_online BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added is_online column';
    END IF;
    
    -- Add display_name if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'display_name'
    ) THEN
        ALTER TABLE users ADD COLUMN display_name VARCHAR(255);
        RAISE NOTICE 'Added display_name column';
    END IF;
    
    -- Add bio if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'bio'
    ) THEN
        ALTER TABLE users ADD COLUMN bio TEXT DEFAULT '';
        RAISE NOTICE 'Added bio column';
    END IF;
    
    -- Add profile_pic_url if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'profile_pic_url'
    ) THEN
        ALTER TABLE users ADD COLUMN profile_pic_url TEXT DEFAULT '';
        RAISE NOTICE 'Added profile_pic_url column';
    END IF;
    
    -- Add price_per_min if missing (for creators)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'price_per_min'
    ) THEN
        ALTER TABLE users ADD COLUMN price_per_min DECIMAL(10,2) DEFAULT 1.00;
        RAISE NOTICE 'Added price_per_min column';
    END IF;
    
    -- Add is_super_admin if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'is_super_admin'
    ) THEN
        ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added is_super_admin column';
    END IF;
END $$;

-- =====================================================
-- STEP 7: CREATE DYNAMIC VIEWS BASED ON AVAILABLE COLUMNS
-- =====================================================

-- Drop existing views
DROP VIEW IF EXISTS v_creators_safe CASCADE;
DROP VIEW IF EXISTS v_fans_safe CASCADE;
DROP VIEW IF EXISTS v_pending_applications_safe CASCADE;

-- Create a safe creator view using only existing columns
CREATE OR REPLACE VIEW v_creators_safe AS
SELECT 
    u.id,
    u.email,
    u.username,
    u.is_creator,
    u.created_at,
    -- Add optional columns only if they exist
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'supabase_id') 
         THEN u.supabase_id ELSE NULL END as supabase_id,
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'display_name') 
         THEN u.display_name ELSE NULL END as display_name,
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'bio') 
         THEN u.bio ELSE NULL END as bio,
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'profile_pic_url') 
         THEN u.profile_pic_url ELSE NULL END as profile_pic_url,
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'price_per_min') 
         THEN u.price_per_min ELSE NULL END as price_per_min,
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_online') 
         THEN u.is_online ELSE FALSE END as is_online
FROM users u
WHERE u.is_creator = true;

-- Create a safe fan view
CREATE OR REPLACE VIEW v_fans_safe AS
SELECT 
    u.id,
    u.email,
    u.username,
    u.is_creator,
    u.created_at,
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'supabase_id') 
         THEN u.supabase_id ELSE NULL END as supabase_id,
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'display_name') 
         THEN u.display_name ELSE NULL END as display_name
FROM users u
WHERE u.is_creator = false OR u.is_creator IS NULL;

-- =====================================================
-- STEP 8: SIMPLE QUERIES YOU CAN RUN NOW
-- =====================================================

-- After running the above setup, you can safely use:

-- 1. Get all creators
SELECT * FROM v_creators_safe;

-- 2. Get all fans
SELECT * FROM v_fans_safe;

-- 3. Get online creators (if is_online column was added)
SELECT * FROM v_creators_safe WHERE is_online = true;

-- 4. Count summary
SELECT 
    (SELECT COUNT(*) FROM v_creators_safe) as total_creators,
    (SELECT COUNT(*) FROM v_fans_safe) as total_fans,
    (SELECT COUNT(*) FROM v_creators_safe WHERE is_online = true) as online_creators;

-- =====================================================
-- STEP 9: ALTERNATIVE - SIMPLIFIED QUERIES
-- =====================================================

-- If you just want the simplest possible queries:

-- All creators (absolutely minimal)
SELECT id, email, username 
FROM users 
WHERE is_creator = true;

-- All fans (absolutely minimal)
SELECT id, email, username 
FROM users 
WHERE is_creator = false;

-- Pending applications (if table exists)
SELECT * 
FROM creator_applications 
WHERE status = 'pending';

-- =====================================================
-- HELPFUL INFORMATION
-- =====================================================

/*
This script:
1. First checks what columns actually exist in your tables
2. Provides safe queries that only use existing columns
3. Optionally adds missing columns if you want them
4. Creates views that dynamically handle optional columns
5. Gives you simple queries that will definitely work

To use this:
1. Run STEP 1 first to see what columns you have
2. Run STEP 2-4 for basic queries
3. Optionally run STEP 6 to add missing columns
4. Use STEP 8 or 9 for your regular queries

The main tables you need to know about:
- users: Contains all users (creators and fans)
- creator_applications: Contains pending creator applications
- is_creator: Boolean flag that determines if a user is a creator or fan
*/