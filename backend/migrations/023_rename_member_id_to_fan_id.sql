-- ============================================
-- Rename member_id to fan_id throughout database
-- ============================================
-- This migration renames member_id columns to fan_id
-- for consistency across the application
-- ============================================

-- STEP 1: Rename column in sessions table
ALTER TABLE public.sessions 
RENAME COLUMN member_id TO fan_id;

-- STEP 2: Rename index
DROP INDEX IF EXISTS idx_sessions_member_id;
CREATE INDEX IF NOT EXISTS idx_sessions_fan_id ON public.sessions(fan_id);

-- STEP 3: Update any views that might reference member_id
-- (Add any views here if they exist)

-- STEP 4: Verify the changes
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Column rename completed successfully!';
  RAISE NOTICE '============================================';
  
  -- Check if fan_id column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'sessions' AND column_name = 'fan_id') THEN
    RAISE NOTICE '✅ Column renamed: sessions.fan_id';
  ELSE
    RAISE WARNING '❌ Column rename failed: sessions.fan_id not found';
  END IF;
  
  -- Check if old column is gone
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'sessions' AND column_name = 'member_id') THEN
    RAISE NOTICE '✅ Old column removed: sessions.member_id';
  ELSE
    RAISE WARNING '❌ Old column still exists: sessions.member_id';
  END IF;
  
  -- Check index
  IF EXISTS (SELECT 1 FROM pg_indexes 
             WHERE tablename = 'sessions' AND indexname = 'idx_sessions_fan_id') THEN
    RAISE NOTICE '✅ Index created: idx_sessions_fan_id';
  ELSE
    RAISE WARNING '❌ Index not created: idx_sessions_fan_id';
  END IF;
  
  RAISE NOTICE '============================================';
  RAISE NOTICE 'IMPORTANT: Update all application code to use fan_id instead of member_id';
  RAISE NOTICE '============================================';
END $$;

-- ============================================
-- Rollback script (save separately)
-- ============================================
-- To rollback this change, run:
-- ALTER TABLE public.sessions RENAME COLUMN fan_id TO member_id;
-- DROP INDEX IF EXISTS idx_sessions_fan_id;
-- CREATE INDEX IF NOT EXISTS idx_sessions_member_id ON public.sessions(member_id);