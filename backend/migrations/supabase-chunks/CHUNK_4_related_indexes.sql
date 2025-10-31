-- ==========================================
-- CHUNK 4 of 5: Create Related Table Indexes
-- ==========================================
-- Run this AFTER Chunk 3
-- Creates performance indexes on tables that reference supabase_id

-- Followers table indexes
CREATE INDEX IF NOT EXISTS idx_followers_follower_id ON followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_creator_id ON followers(creator_id);

COMMENT ON COLUMN followers.follower_id IS 'Follower supabase_id stored as VARCHAR';

-- Token balances indexes
CREATE INDEX IF NOT EXISTS idx_token_balances_user_id ON token_balances(user_id);

-- Token transactions indexes
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id);

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);

-- Tips indexes (if table exists)
CREATE INDEX IF NOT EXISTS idx_tips_tipper_id ON tips(tipper_id);
CREATE INDEX IF NOT EXISTS idx_tips_creator_id ON tips(creator_id);

-- Note: creator_subscriptions indexes are intentionally skipped
-- as this table may not exist or have different schema

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
