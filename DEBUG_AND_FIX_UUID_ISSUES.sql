-- =====================================================
-- DEBUG AND FIX UUID/INTEGER TYPE MISMATCHES
-- =====================================================

-- STEP 1: IDENTIFY THE ISSUE
-- Check what column types you have in the users table
SELECT 
    'users' as table_name,
    column_name, 
    data_type,
    udt_name,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'users'
AND column_name IN ('id', 'supabase_id', 'firebase_uid')
ORDER BY ordinal_position;

-- Check creator_subscriptions structure
SELECT 
    'creator_subscriptions' as table_name,
    column_name, 
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'creator_subscriptions'
AND column_name LIKE '%_id'
ORDER BY ordinal_position;

-- Check if you have the auth.users table properly linked
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'auth' 
    AND table_name = 'users'
) as auth_users_exists;

-- =====================================================
-- STEP 2: VIEW YOUR CURRENT DATA STRUCTURE
-- =====================================================

-- See sample data from users table (limited to 5 rows)
SELECT 
    id,
    supabase_id,
    email,
    username,
    is_creator,
    role,
    CASE 
        WHEN supabase_id IS NULL THEN 'Missing Supabase ID'
        ELSE 'Has Supabase ID'
    END as supabase_status
FROM users
LIMIT 5;

-- Count users by type
SELECT 
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE is_creator = true) as creators,
    COUNT(*) FILTER (WHERE is_creator = false) as fans,
    COUNT(*) FILTER (WHERE is_super_admin = true) as admins,
    COUNT(*) FILTER (WHERE supabase_id IS NOT NULL) as with_supabase_id,
    COUNT(*) FILTER (WHERE supabase_id IS NULL) as without_supabase_id
FROM users;

-- =====================================================
-- STEP 3: SAFE QUERIES THAT HANDLE TYPE MISMATCHES
-- =====================================================

-- Get all creators (safe version)
SELECT 
    id,
    supabase_id,
    email,
    username,
    display_name,
    bio,
    profile_pic_url,
    price_per_min,
    is_online,
    created_at
FROM users 
WHERE is_creator = true
ORDER BY created_at DESC;

-- Get all fans (safe version)
SELECT 
    id,
    supabase_id,
    email,
    username,
    display_name,
    created_at
FROM users 
WHERE is_creator = false OR is_creator IS NULL
ORDER BY created_at DESC;

-- Get pending creator applications (safe version)
-- This checks if the table exists first
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'creator_applications'
    ) THEN
        RAISE NOTICE 'creator_applications table exists';
    ELSE
        RAISE NOTICE 'creator_applications table does not exist';
    END IF;
END $$;

-- If creator_applications exists, get pending applications
-- (Run this only if the table exists)
SELECT 
    ca.id,
    ca.status,
    ca.application_reason,
    ca.created_at,
    u.username,
    u.email,
    u.display_name
FROM creator_applications ca
LEFT JOIN users u ON 
    CASE 
        WHEN ca.supabase_user_id IS NOT NULL THEN u.supabase_id = ca.supabase_user_id
        WHEN ca.user_id IS NOT NULL THEN u.id = ca.user_id
        ELSE false
    END
WHERE ca.status = 'pending'
ORDER BY ca.created_at DESC;

-- =====================================================
-- STEP 4: FIX COMMON ISSUES
-- =====================================================

-- If you need to populate missing supabase_id values from auth.users
UPDATE users u
SET supabase_id = a.id
FROM auth.users a
WHERE u.email = a.email
AND u.supabase_id IS NULL;

-- Add missing columns if they don't exist
DO $$
BEGIN
    -- Add supabase_id if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'supabase_id'
    ) THEN
        ALTER TABLE users ADD COLUMN supabase_id UUID;
        CREATE INDEX idx_users_supabase_id ON users(supabase_id);
    END IF;
    
    -- Add is_creator if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'is_creator'
    ) THEN
        ALTER TABLE users ADD COLUMN is_creator BOOLEAN DEFAULT FALSE;
        CREATE INDEX idx_users_is_creator ON users(is_creator);
    END IF;
    
    -- Add role if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'role'
    ) THEN
        ALTER TABLE users ADD COLUMN role VARCHAR(255) DEFAULT 'authenticated';
    END IF;
END $$;

-- =====================================================
-- STEP 5: CREATE SAFE VIEWS FOR EASY ACCESS
-- =====================================================

-- Drop existing views if they exist
DROP VIEW IF EXISTS v_creators CASCADE;
DROP VIEW IF EXISTS v_fans CASCADE;
DROP VIEW IF EXISTS v_pending_applications CASCADE;

-- Create view for creators
CREATE OR REPLACE VIEW v_creators AS
SELECT 
    u.id,
    u.supabase_id,
    u.email,
    u.username,
    u.display_name,
    u.bio,
    u.profile_pic_url,
    u.price_per_min,
    u.is_online,
    u.created_at,
    COALESCE(
        (SELECT COUNT(*) FROM sessions s WHERE s.creator_id::text = u.supabase_id::text),
        0
    ) as total_sessions,
    COALESCE(
        (SELECT COUNT(*) FROM creator_subscriptions cs WHERE cs.creator_id = u.supabase_id),
        0
    ) as subscriber_count
FROM users u
WHERE u.is_creator = true;

-- Create view for fans
CREATE OR REPLACE VIEW v_fans AS
SELECT 
    u.id,
    u.supabase_id,
    u.email,
    u.username,
    u.display_name,
    u.created_at,
    COALESCE(
        (SELECT SUM(amount) FROM token_purchases tp WHERE tp.user_id::text = u.supabase_id::text),
        0
    ) as total_tokens_purchased
FROM users u
WHERE u.is_creator = false OR u.is_creator IS NULL;

-- Create view for pending applications (if table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'creator_applications'
    ) THEN
        EXECUTE '
        CREATE OR REPLACE VIEW v_pending_applications AS
        SELECT 
            ca.id as application_id,
            ca.status,
            ca.application_reason,
            ca.created_at as applied_at,
            ca.admin_notes,
            u.id as user_id,
            u.supabase_id,
            u.username,
            u.email,
            u.display_name
        FROM creator_applications ca
        LEFT JOIN users u ON u.supabase_id = ca.supabase_user_id
        WHERE ca.status = ''pending''
        ORDER BY ca.created_at DESC';
    END IF;
END $$;

-- =====================================================
-- STEP 6: HELPER FUNCTIONS FOR SAFE QUERIES
-- =====================================================

-- Function to safely get user by various ID types
CREATE OR REPLACE FUNCTION get_user_safe(user_identifier TEXT)
RETURNS TABLE (
    id INTEGER,
    supabase_id UUID,
    email VARCHAR,
    username VARCHAR,
    is_creator BOOLEAN,
    role VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.supabase_id,
        u.email,
        u.username,
        u.is_creator,
        u.role
    FROM users u
    WHERE 
        u.email = user_identifier
        OR u.username = user_identifier
        OR u.supabase_id::text = user_identifier
        OR u.id::text = user_identifier
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 7: TEST YOUR QUERIES
-- =====================================================

-- Now you can safely query:
-- All creators
SELECT * FROM v_creators;

-- All fans
SELECT * FROM v_fans;

-- Pending applications (if view exists)
SELECT * FROM v_pending_applications;

-- Find a specific user safely
SELECT * FROM get_user_safe('user@example.com');

-- =====================================================
-- FINAL NOTES
-- =====================================================
/*
The UUID error occurs because:
1. Some tables use INTEGER for user IDs (older tables)
2. Some use UUID for Supabase IDs (newer/migrated tables)
3. Joins between these tables fail without proper casting

Solutions implemented above:
1. Safe views that handle type conversion
2. CASE statements in JOINs to handle both ID types
3. Helper functions for safe queries
4. Proper casting where needed

To use in Supabase Dashboard:
1. Run the diagnostic queries first (STEP 1-2)
2. Apply the fixes if needed (STEP 4)
3. Create the views (STEP 5)
4. Use the views for safe querying (STEP 7)
*/