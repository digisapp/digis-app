-- =====================================================
-- CHECK DATABASE STRUCTURE AND PROVIDE WORKING QUERIES
-- =====================================================

-- =====================================================
-- PART 1: CHECK YOUR ACTUAL TABLE STRUCTURE
-- =====================================================

-- 1.1 Check users table columns
SELECT 
    'USERS TABLE COLUMNS:' as table_info,
    column_name, 
    data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'users'
ORDER BY ordinal_position;

-- 1.2 Check if creator_applications table exists and its columns
SELECT 
    'CREATOR_APPLICATIONS TABLE COLUMNS:' as table_info,
    column_name, 
    data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'creator_applications'
ORDER BY ordinal_position;

-- 1.3 Check what tables exist
SELECT 
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('users', 'creator_applications', 'creators', 'fans')
ORDER BY table_name;

-- =====================================================
-- PART 2: SIMPLE QUERIES THAT SHOULD WORK
-- =====================================================

-- 2.1 Get basic user count
SELECT COUNT(*) as total_users FROM users;

-- 2.2 Get all users with minimal columns (these should exist)
SELECT 
    id,
    email,
    username,
    is_creator
FROM users
LIMIT 10;

-- 2.3 Get creators (simple version)
SELECT 
    id,
    email,
    username
FROM users 
WHERE is_creator = true;

-- 2.4 Get fans (simple version)
SELECT 
    id,
    email,
    username
FROM users 
WHERE is_creator = false OR is_creator IS NULL;

-- =====================================================
-- PART 3: CHECK AND QUERY CREATOR APPLICATIONS SAFELY
-- =====================================================

-- 3.1 First check if the table exists
DO $$
DECLARE
    table_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'creator_applications'
    ) INTO table_exists;
    
    IF table_exists THEN
        RAISE NOTICE 'creator_applications table EXISTS';
    ELSE
        RAISE NOTICE 'creator_applications table DOES NOT EXIST';
    END IF;
END $$;

-- 3.2 If creator_applications exists, show its structure
-- (This will return empty if table doesn't exist)
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'creator_applications'
ORDER BY ordinal_position;

-- 3.3 Get pending applications (basic - no joins)
-- This query will work if the table exists
SELECT 
    id,
    status,
    application_reason,
    created_at
FROM creator_applications
WHERE status = 'pending'
ORDER BY created_at DESC;

-- =====================================================
-- PART 4: DYNAMIC QUERIES BASED ON AVAILABLE COLUMNS
-- =====================================================

-- 4.1 Build a query for creator applications with user info
-- This creates a safe query based on what columns actually exist
DO $$
DECLARE
    has_ca_table boolean;
    has_ca_user_id boolean;
    has_ca_supabase_user_id boolean;
    has_u_supabase_id boolean;
    query_text text;
BEGIN
    -- Check what exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'creator_applications'
    ) INTO has_ca_table;
    
    IF has_ca_table THEN
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'creator_applications' AND column_name = 'user_id'
        ) INTO has_ca_user_id;
        
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'creator_applications' AND column_name = 'supabase_user_id'
        ) INTO has_ca_supabase_user_id;
        
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'supabase_id'
        ) INTO has_u_supabase_id;
        
        -- Build appropriate query
        query_text := 'SELECT ca.*, u.email, u.username FROM creator_applications ca LEFT JOIN users u ON ';
        
        IF has_ca_user_id THEN
            query_text := query_text || 'u.id = ca.user_id';
        ELSIF has_ca_supabase_user_id AND has_u_supabase_id THEN
            query_text := query_text || 'u.supabase_id = ca.supabase_user_id';
        ELSE
            query_text := 'SELECT * FROM creator_applications';
        END IF;
        
        query_text := query_text || ' WHERE ca.status = ''pending'' ORDER BY ca.created_at DESC';
        
        RAISE NOTICE 'Use this query for pending applications: %', query_text;
    ELSE
        RAISE NOTICE 'creator_applications table does not exist';
    END IF;
END $$;

-- =====================================================
-- PART 5: CREATE THE SIMPLEST POSSIBLE WORKING VIEWS
-- =====================================================

-- Drop any existing views
DROP VIEW IF EXISTS simple_creators CASCADE;
DROP VIEW IF EXISTS simple_fans CASCADE;
DROP VIEW IF EXISTS simple_pending_applications CASCADE;

-- 5.1 Create simple creators view
CREATE OR REPLACE VIEW simple_creators AS
SELECT 
    id,
    email,
    username,
    is_creator,
    created_at
FROM users 
WHERE is_creator = true;

-- 5.2 Create simple fans view
CREATE OR REPLACE VIEW simple_fans AS
SELECT 
    id,
    email,
    username,
    is_creator,
    created_at
FROM users 
WHERE is_creator = false OR is_creator IS NULL;

-- 5.3 Create pending applications view (only if table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'creator_applications'
    ) THEN
        -- Check what columns exist for the join
        IF EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'creator_applications' 
            AND column_name = 'user_id'
        ) THEN
            -- Use user_id for join
            EXECUTE '
            CREATE OR REPLACE VIEW simple_pending_applications AS
            SELECT 
                ca.id as application_id,
                ca.status,
                ca.application_reason,
                ca.created_at,
                u.email,
                u.username
            FROM creator_applications ca
            LEFT JOIN users u ON u.id = ca.user_id
            WHERE ca.status = ''pending''
            ORDER BY ca.created_at DESC';
        ELSE
            -- No join possible, just show applications
            EXECUTE '
            CREATE OR REPLACE VIEW simple_pending_applications AS
            SELECT 
                id as application_id,
                status,
                application_reason,
                created_at
            FROM creator_applications
            WHERE status = ''pending''
            ORDER BY created_at DESC';
        END IF;
        
        RAISE NOTICE 'Created simple_pending_applications view';
    ELSE
        RAISE NOTICE 'Skipping simple_pending_applications view - table does not exist';
    END IF;
END $$;

-- =====================================================
-- PART 6: QUERIES YOU CAN USE RIGHT NOW
-- =====================================================

-- These queries will work after running the script above:

-- Get all creators
SELECT * FROM simple_creators;

-- Get all fans
SELECT * FROM simple_fans;

-- Get pending applications (if view was created)
SELECT * FROM simple_pending_applications;

-- Get counts
SELECT 
    (SELECT COUNT(*) FROM simple_creators) as total_creators,
    (SELECT COUNT(*) FROM simple_fans) as total_fans;

-- =====================================================
-- PART 7: IF YOU NEED TO CREATE MISSING TABLES
-- =====================================================

-- If creator_applications doesn't exist, create it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'creator_applications'
    ) THEN
        CREATE TABLE creator_applications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            application_reason TEXT NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            admin_notes TEXT,
            reviewed_by INTEGER,
            reviewed_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX idx_creator_applications_user_id ON creator_applications(user_id);
        CREATE INDEX idx_creator_applications_status ON creator_applications(status);
        
        RAISE NOTICE 'Created creator_applications table';
    END IF;
END $$;

-- =====================================================
-- SUMMARY OF WHAT TO DO
-- =====================================================

/*
1. Run PART 1 first to see your table structure
2. Run PART 2 for basic queries that should work
3. Run PART 5 to create simple views
4. Use PART 6 queries for your daily operations

The views created are:
- simple_creators: All creators
- simple_fans: All fans  
- simple_pending_applications: Pending creator applications (if table exists)

Just use:
SELECT * FROM simple_creators;
SELECT * FROM simple_fans;
SELECT * FROM simple_pending_applications;
*/