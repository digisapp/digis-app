-- ============================================
-- CHECK USERS TABLE STRUCTURE AND FIX REFERENCES
-- ============================================
-- Run this BEFORE the FIX_MISSING_TABLES_2024.sql
-- ============================================

-- First, let's check what columns the users table has
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Check if users table uses 'id' or 'user_id' or something else
SELECT 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
WHERE 
    tc.table_name = 'users' 
    AND tc.constraint_type = 'PRIMARY KEY';

-- If the users table doesn't exist or doesn't have an id column,
-- we need to ensure it's properly set up first
-- This is a safe operation that won't error if the table already exists

-- Option 1: If users table doesn't exist at all, create it
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE,
    display_name VARCHAR(255),
    bio TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    is_creator BOOLEAN DEFAULT false,
    is_admin BOOLEAN DEFAULT false,
    role VARCHAR(50) DEFAULT 'fan',
    token_balance INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Option 2: If users table exists but uses user_id instead of id
-- Check if this is the case and add an id column if needed
DO $$
BEGIN
    -- Check if 'id' column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'id'
    ) THEN
        -- Check if 'user_id' exists and rename it to 'id'
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name = 'user_id'
        ) THEN
            ALTER TABLE users RENAME COLUMN user_id TO id;
        ELSE
            -- If neither exists, add id column
            ALTER TABLE users ADD COLUMN id UUID DEFAULT gen_random_uuid() PRIMARY KEY;
        END IF;
    END IF;
END $$;

-- Now ensure all the necessary columns exist on the users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS username VARCHAR(100),
ADD COLUMN IF NOT EXISTS display_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS banner_url TEXT,
ADD COLUMN IF NOT EXISTS is_creator BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'fan',
ADD COLUMN IF NOT EXISTS token_balance INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add offer-related columns that the FIX_MISSING_TABLES script expects
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS offers_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS offers_auto_accept BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS offers_response_time VARCHAR(50) DEFAULT '24 hours',
ADD COLUMN IF NOT EXISTS offers_completion_rate DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS total_offers_completed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_offer_rating DECIMAL(3,2) DEFAULT 0.00;

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can view all users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- Basic RLS policy for users table
CREATE POLICY "Users can view all users" ON users
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Now you can safely run FIX_MISSING_TABLES_2024.sql after this script
-- ============================================