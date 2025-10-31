-- ==========================================
-- CHUNK 2 of 5: Drop Firebase UID Column
-- ==========================================
-- Run this AFTER Chunk 1

-- Drop firebase_uid column and all foreign keys that reference it
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'firebase_uid'
    ) THEN
        -- Drop all foreign keys that reference firebase_uid
        ALTER TABLE token_balances DROP CONSTRAINT IF EXISTS token_balances_user_id_fkey CASCADE;
        ALTER TABLE token_transactions DROP CONSTRAINT IF EXISTS token_transactions_user_id_fkey CASCADE;
        ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_user_id_fkey CASCADE;
        ALTER TABLE creator_subscriptions DROP CONSTRAINT IF EXISTS creator_subscriptions_subscriber_id_fkey CASCADE;
        ALTER TABLE followers DROP CONSTRAINT IF EXISTS followers_follower_id_fkey CASCADE;
        ALTER TABLE tips DROP CONSTRAINT IF EXISTS tips_tipper_id_fkey CASCADE;

        -- Drop the firebase_uid column
        ALTER TABLE users DROP COLUMN firebase_uid CASCADE;
        RAISE NOTICE 'Dropped firebase_uid column and all constraints';
    ELSE
        RAISE NOTICE 'firebase_uid column does not exist - already removed';
    END IF;
END $$;

-- Drop firebase-related indexes
DROP INDEX IF EXISTS idx_users_firebase_uid;

-- Verify firebase_uid is gone
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'users' AND column_name LIKE '%firebase%';
-- Should return 0 rows
