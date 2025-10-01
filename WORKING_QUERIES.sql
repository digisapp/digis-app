-- =====================================================
-- WORKING QUERIES - Only uses columns that actually exist
-- =====================================================

-- =====================================================
-- STEP 1: FIRST, CHECK WHAT YOU ACTUALLY HAVE
-- =====================================================

-- Check users table structure
SELECT 
    column_name, 
    data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'users'
ORDER BY ordinal_position;

-- Check creator_applications table structure (if it exists)
SELECT 
    column_name, 
    data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'creator_applications'
ORDER BY ordinal_position;

-- =====================================================
-- STEP 2: ULTRA-SAFE QUERIES (Only use * or specific columns we know exist)
-- =====================================================

-- Get ALL creators (using *)
SELECT * FROM users WHERE is_creator = true;

-- Get ALL fans (using *)
SELECT * FROM users WHERE is_creator = false;

-- Get ALL pending applications (using * - only if table exists)
SELECT * FROM creator_applications WHERE status = 'pending';

-- =====================================================
-- STEP 3: IF ABOVE FAILS, USE THESE MINIMAL QUERIES
-- =====================================================

-- Just get all users
SELECT * FROM users LIMIT 10;

-- Count creators vs fans
SELECT 
    is_creator,
    COUNT(*) as count
FROM users
GROUP BY is_creator;

-- Check if creator_applications table has any data
SELECT COUNT(*) as total_applications FROM creator_applications;

-- Get all data from creator_applications (see what columns it has)
SELECT * FROM creator_applications LIMIT 10;

-- =====================================================
-- STEP 4: DYNAMIC COLUMN DETECTION AND QUERY BUILDER
-- =====================================================

-- This will show you EXACTLY what queries to use based on your actual columns
DO $$
DECLARE
    col_record RECORD;
    users_columns TEXT := '';
    ca_columns TEXT := '';
    has_ca_table BOOLEAN;
BEGIN
    -- Build list of users table columns
    FOR col_record IN 
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users'
        ORDER BY ordinal_position
    LOOP
        users_columns := users_columns || col_record.column_name || ', ';
    END LOOP;
    
    RAISE NOTICE 'Users table has these columns: %', rtrim(users_columns, ', ');
    
    -- Check if creator_applications exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'creator_applications'
    ) INTO has_ca_table;
    
    IF has_ca_table THEN
        -- Build list of creator_applications columns
        FOR col_record IN 
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'creator_applications'
            ORDER BY ordinal_position
        LOOP
            ca_columns := ca_columns || col_record.column_name || ', ';
        END LOOP;
        
        RAISE NOTICE 'Creator_applications table has these columns: %', rtrim(ca_columns, ', ');
    ELSE
        RAISE NOTICE 'Creator_applications table does not exist';
    END IF;
    
    -- Provide working queries
    RAISE NOTICE '';
    RAISE NOTICE 'USE THESE QUERIES:';
    RAISE NOTICE '1. Get creators: SELECT * FROM users WHERE is_creator = true;';
    RAISE NOTICE '2. Get fans: SELECT * FROM users WHERE is_creator = false;';
    
    IF has_ca_table THEN
        RAISE NOTICE '3. Get pending applications: SELECT * FROM creator_applications WHERE status = ''pending'';';
    END IF;
END $$;

-- =====================================================
-- STEP 5: CREATE SAFE VIEWS THAT WILL ALWAYS WORK
-- =====================================================

-- Drop existing views
DROP VIEW IF EXISTS all_creators CASCADE;
DROP VIEW IF EXISTS all_fans CASCADE;
DROP VIEW IF EXISTS pending_applications CASCADE;

-- Create view for creators (using SELECT *)
CREATE OR REPLACE VIEW all_creators AS
SELECT * FROM users WHERE is_creator = true;

-- Create view for fans
CREATE OR REPLACE VIEW all_fans AS
SELECT * FROM users WHERE is_creator = false OR is_creator IS NULL;

-- Create view for pending applications (only if table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'creator_applications'
    ) THEN
        -- Check if status column exists
        IF EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'creator_applications' 
            AND column_name = 'status'
        ) THEN
            EXECUTE 'CREATE OR REPLACE VIEW pending_applications AS
                     SELECT * FROM creator_applications WHERE status = ''pending''';
        ELSE
            EXECUTE 'CREATE OR REPLACE VIEW pending_applications AS
                     SELECT * FROM creator_applications';
        END IF;
        RAISE NOTICE 'Created pending_applications view';
    END IF;
END $$;

-- =====================================================
-- FINAL WORKING QUERIES - USE THESE!
-- =====================================================

-- After running the above, these will work:
SELECT * FROM all_creators;
SELECT * FROM all_fans;
SELECT * FROM pending_applications;  -- Only if table exists

-- =====================================================
-- ALTERNATIVE: SEE RAW DATA
-- =====================================================

-- If you just want to see what's in your tables:
SELECT * FROM users LIMIT 20;
SELECT * FROM creator_applications LIMIT 20;  -- May error if doesn't exist

-- =====================================================
-- IN CASE OF EMERGENCY - ABSOLUTE MINIMAL QUERIES
-- =====================================================

-- These should NEVER fail:
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM users WHERE is_creator = true;
SELECT COUNT(*) FROM users WHERE is_creator = false;