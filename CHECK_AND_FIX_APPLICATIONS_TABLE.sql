-- =====================================================
-- CHECK ACTUAL STRUCTURE AND FIX CREATOR APPLICATIONS
-- =====================================================

-- STEP 1: SEE WHAT COLUMNS ACTUALLY EXIST
-- =====================================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'creator_applications'
ORDER BY ordinal_position;

-- STEP 2: CHECK WHICH COLUMNS ARE REQUIRED (NOT NULL)
-- =====================================================
SELECT 
    column_name,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'creator_applications'
AND is_nullable = 'NO'
ORDER BY ordinal_position;

-- STEP 3: MAKE BIO NULLABLE (only if it exists and is NOT NULL)
-- =====================================================
DO $$
BEGIN
    -- Check if bio column exists and is NOT NULL
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'creator_applications' 
        AND column_name = 'bio'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE creator_applications ALTER COLUMN bio DROP NOT NULL;
        RAISE NOTICE 'Made bio column nullable';
    END IF;
END $$;

-- STEP 4: CREATE A SIMPLE TEST APPLICATION
-- =====================================================
-- This query dynamically builds based on what columns exist

DO $$
DECLARE
    has_bio BOOLEAN;
    has_reason BOOLEAN;
    has_display_name BOOLEAN;
    insert_query TEXT;
BEGIN
    -- Check what columns exist
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'creator_applications' AND column_name = 'bio'
    ) INTO has_bio;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'creator_applications' AND column_name = 'application_reason'
    ) INTO has_reason;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'creator_applications' AND column_name = 'display_name'
    ) INTO has_display_name;
    
    -- Build insert query based on existing columns
    insert_query := 'INSERT INTO creator_applications (user_id, status, created_at';
    
    IF has_bio THEN
        insert_query := insert_query || ', bio';
    END IF;
    
    insert_query := insert_query || ') VALUES ((SELECT id FROM users WHERE is_creator = false LIMIT 1), ''pending'', NOW()';
    
    IF has_bio THEN
        insert_query := insert_query || ', ''Test creator bio - I want to become a creator on Digis''';
    END IF;
    
    insert_query := insert_query || ')';
    
    -- Execute the insert
    EXECUTE insert_query;
    RAISE NOTICE 'Created test application';
END $$;

-- STEP 5: VIEW ALL APPLICATIONS (see what data you have)
-- =====================================================
SELECT * FROM creator_applications LIMIT 5;

-- STEP 6: VIEW PENDING APPLICATIONS WITH USER INFO
-- =====================================================
SELECT 
    ca.*,
    u.email,
    u.username,
    u.display_name
FROM creator_applications ca
LEFT JOIN users u ON u.id = ca.user_id
WHERE ca.status = 'pending'
ORDER BY ca.created_at DESC;

-- STEP 7: IF TABLE IS BROKEN, RECREATE IT
-- =====================================================
-- Only run this if you want to start fresh with a proper structure

/*
-- DROP AND RECREATE (ONLY IF NEEDED)
DROP TABLE IF EXISTS creator_applications CASCADE;

CREATE TABLE creator_applications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,  -- Creator's bio/description
    status VARCHAR(50) DEFAULT 'pending',  -- pending, approved, rejected
    admin_notes TEXT,  -- Admin's review notes
    reviewed_by INTEGER REFERENCES users(id),  -- Admin who reviewed
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_creator_applications_user_id ON creator_applications(user_id);
CREATE INDEX idx_creator_applications_status ON creator_applications(status);
CREATE INDEX idx_creator_applications_created_at ON creator_applications(created_at DESC);

-- Add a test application
INSERT INTO creator_applications (user_id, bio, status)
SELECT 
    id,
    'I want to become a creator to share my expertise',
    'pending'
FROM users 
WHERE is_creator = false 
LIMIT 1;
*/

-- STEP 8: MAKE SURE ADMIN EXISTS
-- =====================================================
-- Ensure admin@digis.cc is set up
UPDATE users 
SET 
    is_super_admin = true,
    role = 'admin'
WHERE email = 'admin@digis.cc';

-- Verify admin
SELECT 
    id,
    email,
    username,
    is_super_admin,
    role
FROM users 
WHERE email = 'admin@digis.cc';

-- STEP 9: SUMMARY OF APPLICATIONS
-- =====================================================
SELECT 
    COUNT(*) as total_applications,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'approved') as approved,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected
FROM creator_applications;

-- =====================================================
-- WHAT TO DO NEXT
-- =====================================================
/*
After running this script:

1. Check the output of STEP 1 to see what columns you actually have
2. The script will automatically create a test application
3. admin@digis.cc can now login and go to /admin
4. They'll see pending applications to review

If the table structure is completely wrong, uncomment and run STEP 7
to recreate it with a simpler structure.
*/