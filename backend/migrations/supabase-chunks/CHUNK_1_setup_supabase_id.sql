-- ==========================================
-- CHUNK 1 of 5: Setup supabase_id Column
-- ==========================================
-- Run this first in Supabase SQL Editor

-- Add supabase_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'supabase_id'
    ) THEN
        ALTER TABLE users ADD COLUMN supabase_id UUID;
        RAISE NOTICE 'Added supabase_id column';
    ELSE
        RAISE NOTICE 'supabase_id column already exists';
    END IF;
END $$;

-- Make supabase_id NOT NULL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE supabase_id IS NULL) THEN
        RAISE EXCEPTION 'Cannot make supabase_id NOT NULL - found NULL values. Please populate them first.';
    END IF;

    ALTER TABLE users ALTER COLUMN supabase_id SET NOT NULL;
    RAISE NOTICE 'Set supabase_id as NOT NULL';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'supabase_id already has NOT NULL constraint';
END $$;

-- Add unique constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_supabase_id_unique'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_supabase_id_unique UNIQUE (supabase_id);
        RAISE NOTICE 'Added unique constraint on supabase_id';
    ELSE
        RAISE NOTICE 'Unique constraint already exists';
    END IF;
END $$;

-- Verify
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'supabase_id';
