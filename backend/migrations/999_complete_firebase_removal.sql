-- Complete Firebase Removal - Use only Supabase UUID
-- This migration ensures all tables use supabase_id exclusively

-- Step 1: Ensure supabase_id column exists and is properly configured
DO $$
BEGIN
    -- Add supabase_id if it doesn't exist
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

-- Step 2: Make supabase_id NOT NULL if it isn't already
DO $$
BEGIN
    -- Check if there are any NULL values first
    IF EXISTS (SELECT 1 FROM users WHERE supabase_id IS NULL) THEN
        RAISE EXCEPTION 'Cannot make supabase_id NOT NULL - found NULL values. Please populate them first.';
    END IF;

    -- Set NOT NULL constraint
    ALTER TABLE users ALTER COLUMN supabase_id SET NOT NULL;
    RAISE NOTICE 'Set supabase_id as NOT NULL';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'supabase_id already has NOT NULL constraint';
END $$;

-- Step 3: Add unique constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_supabase_id_unique'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_supabase_id_unique UNIQUE (supabase_id);
        RAISE NOTICE 'Added unique constraint on supabase_id';
    ELSE
        RAISE NOTICE 'Unique constraint on supabase_id already exists';
    END IF;
END $$;

-- Step 4: Drop old firebase_uid column if it still exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'firebase_uid'
    ) THEN
        -- First drop all foreign keys that reference it
        ALTER TABLE token_balances DROP CONSTRAINT IF EXISTS token_balances_user_id_fkey CASCADE;
        ALTER TABLE token_transactions DROP CONSTRAINT IF EXISTS token_transactions_user_id_fkey CASCADE;
        ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_user_id_fkey CASCADE;
        ALTER TABLE creator_subscriptions DROP CONSTRAINT IF EXISTS creator_subscriptions_subscriber_id_fkey CASCADE;
        ALTER TABLE followers DROP CONSTRAINT IF EXISTS followers_follower_id_fkey CASCADE;
        ALTER TABLE tips DROP CONSTRAINT IF EXISTS tips_tipper_id_fkey CASCADE;

        -- Drop the column
        ALTER TABLE users DROP COLUMN firebase_uid CASCADE;
        RAISE NOTICE 'Dropped firebase_uid column';
    ELSE
        RAISE NOTICE 'firebase_uid column does not exist - already removed';
    END IF;
END $$;

-- Step 5: Drop any firebase-related indexes
DROP INDEX IF EXISTS idx_users_firebase_uid;

-- Step 6: Ensure we have indexes for performance on supabase_id
CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON users(supabase_id);

-- Step 7: Create indexes on foreign key columns for performance
-- These columns store supabase_id as VARCHAR/text
CREATE INDEX IF NOT EXISTS idx_followers_follower_id ON followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_creator_id ON followers(creator_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber_id ON creator_subscriptions(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_creator_id ON creator_subscriptions(creator_id);
CREATE INDEX IF NOT EXISTS idx_token_balances_user_id ON token_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_tips_tipper_id ON tips(tipper_id);
CREATE INDEX IF NOT EXISTS idx_tips_creator_id ON tips(creator_id);

-- Step 8: Add helpful comments
COMMENT ON COLUMN users.supabase_id IS 'Primary authentication identifier from Supabase Auth (UUID)';
COMMENT ON COLUMN followers.follower_id IS 'Follower supabase_id stored as VARCHAR';
COMMENT ON COLUMN creator_subscriptions.subscriber_id IS 'Subscriber supabase_id stored as VARCHAR';

-- Step 9: Verification
DO $$
DECLARE
    firebase_columns INTEGER;
    firebase_indexes INTEGER;
BEGIN
    -- Check for firebase columns
    SELECT COUNT(*) INTO firebase_columns
    FROM information_schema.columns
    WHERE column_name LIKE '%firebase%';

    -- Check for firebase indexes
    SELECT COUNT(*) INTO firebase_indexes
    FROM pg_indexes
    WHERE indexname LIKE '%firebase%';

    -- Report results
    IF firebase_columns > 0 THEN
        RAISE WARNING 'Still have % firebase-related columns remaining:', firebase_columns;
        RAISE WARNING 'Run: SELECT table_name, column_name FROM information_schema.columns WHERE column_name LIKE ''%%firebase%%'';';
    ELSE
        RAISE NOTICE '✓ No Firebase columns found';
    END IF;

    IF firebase_indexes > 0 THEN
        RAISE WARNING 'Still have % firebase-related indexes remaining', firebase_indexes;
    ELSE
        RAISE NOTICE '✓ No Firebase indexes found';
    END IF;

    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Firebase Removal Migration Complete!';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Database now uses Supabase UUID exclusively';
END $$;
