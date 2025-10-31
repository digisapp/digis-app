-- ==========================================
-- CHUNK 3 of 5: Create Supabase ID Index
-- ==========================================
-- Run this AFTER Chunk 2

-- Create index on users.supabase_id for performance
CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON users(supabase_id);

-- Add helpful comment
COMMENT ON COLUMN users.supabase_id IS 'Primary authentication identifier from Supabase Auth (UUID)';

-- Verify index was created
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'users' AND indexname = 'idx_users_supabase_id';
