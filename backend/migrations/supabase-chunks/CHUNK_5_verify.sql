-- ==========================================
-- CHUNK 5 of 5: Verification
-- ==========================================
-- Run this AFTER Chunk 4
-- Verifies Firebase has been completely removed

-- Check for any remaining firebase columns
SELECT
    table_name,
    column_name
FROM information_schema.columns
WHERE column_name LIKE '%firebase%';
-- Should return 0 rows

-- Check for any remaining firebase indexes
SELECT
    tablename,
    indexname
FROM pg_indexes
WHERE indexname LIKE '%firebase%';
-- Should return 0 rows

-- Verify supabase_id is properly configured
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'supabase_id';
-- Should show: supabase_id | uuid | NO | NULL

-- Verify supabase_id has unique constraint
SELECT
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint
WHERE conname = 'users_supabase_id_unique';
-- Should show: users_supabase_id_unique | u

-- Check all created indexes
SELECT
    tablename,
    indexname
FROM pg_indexes
WHERE indexname LIKE 'idx_%supabase%'
   OR indexname LIKE 'idx_followers_%'
   OR indexname LIKE 'idx_token_%'
ORDER BY tablename, indexname;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Firebase Removal Migration Complete!';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Database now uses Supabase UUID exclusively';
END $$;
