-- ==========================================
-- CHUNK 4 of 5: Create Related Table Indexes
-- ==========================================
-- Run this AFTER Chunk 3
-- Creates performance indexes on tables that reference supabase_id

DO $$
BEGIN
    -- Followers table indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'followers') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'followers' AND column_name = 'follower_id') THEN
            CREATE INDEX IF NOT EXISTS idx_followers_follower_id ON followers(follower_id);
            RAISE NOTICE 'Created index on followers.follower_id';
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'followers' AND column_name = 'creator_id') THEN
            CREATE INDEX IF NOT EXISTS idx_followers_creator_id ON followers(creator_id);
            RAISE NOTICE 'Created index on followers.creator_id';
        END IF;
    ELSE
        RAISE NOTICE 'Followers table does not exist - skipping';
    END IF;

    -- Token balances indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'token_balances') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'token_balances' AND column_name = 'user_id') THEN
            CREATE INDEX IF NOT EXISTS idx_token_balances_user_id ON token_balances(user_id);
            RAISE NOTICE 'Created index on token_balances.user_id';
        END IF;
    ELSE
        RAISE NOTICE 'token_balances table does not exist - skipping';
    END IF;

    -- Token transactions indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'token_transactions') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'token_transactions' AND column_name = 'user_id') THEN
            CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id);
            RAISE NOTICE 'Created index on token_transactions.user_id';
        END IF;
    ELSE
        RAISE NOTICE 'token_transactions table does not exist - skipping';
    END IF;

    -- Payments indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'user_id') THEN
            CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
            RAISE NOTICE 'Created index on payments.user_id';
        END IF;
    ELSE
        RAISE NOTICE 'payments table does not exist - skipping';
    END IF;

    -- Tips indexes (only if table and columns exist)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tips') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tips' AND column_name = 'tipper_id') THEN
            CREATE INDEX IF NOT EXISTS idx_tips_tipper_id ON tips(tipper_id);
            RAISE NOTICE 'Created index on tips.tipper_id';
        ELSE
            RAISE NOTICE 'tips.tipper_id column does not exist - skipping';
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tips' AND column_name = 'creator_id') THEN
            CREATE INDEX IF NOT EXISTS idx_tips_creator_id ON tips(creator_id);
            RAISE NOTICE 'Created index on tips.creator_id';
        ELSE
            RAISE NOTICE 'tips.creator_id column does not exist - skipping';
        END IF;
    ELSE
        RAISE NOTICE 'tips table does not exist - skipping';
    END IF;

    -- Add comment on followers.follower_id (if column exists)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'followers' AND column_name = 'follower_id') THEN
        COMMENT ON COLUMN followers.follower_id IS 'Follower supabase_id stored as VARCHAR';
        RAISE NOTICE 'Added comment on followers.follower_id';
    END IF;

    RAISE NOTICE 'Note: creator_subscriptions indexes are intentionally skipped as this table may not exist or have different schema';
END $$;

-- Verify indexes were created
SELECT
    tablename,
    indexname
FROM pg_indexes
WHERE indexname LIKE 'idx_followers_%'
   OR indexname LIKE 'idx_token_%'
   OR indexname LIKE 'idx_payments_%'
   OR indexname LIKE 'idx_tips_%'
ORDER BY tablename, indexname;
