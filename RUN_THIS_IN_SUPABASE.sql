-- ============================================
-- DIGIS: Rename member_id to fan_id
-- ============================================
-- Run this script in your Supabase SQL editor
-- https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
-- ============================================

-- STEP 1: Check if column needs to be renamed
DO $$
BEGIN
  -- Only rename if member_id exists and fan_id doesn't
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'sessions' AND column_name = 'member_id') 
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'sessions' AND column_name = 'fan_id') THEN
    
    -- Rename the column
    ALTER TABLE public.sessions RENAME COLUMN member_id TO fan_id;
    RAISE NOTICE '✅ Renamed column: member_id → fan_id';
    
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'sessions' AND column_name = 'fan_id') THEN
    RAISE NOTICE '✅ Column already renamed: fan_id exists';
    
  ELSE
    RAISE WARNING '❌ Neither member_id nor fan_id found in sessions table';
  END IF;
END $$;

-- STEP 2: Update indexes
DO $$
BEGIN
  -- Drop old index if exists
  IF EXISTS (SELECT 1 FROM pg_indexes 
             WHERE indexname = 'idx_sessions_member_id') THEN
    DROP INDEX idx_sessions_member_id;
    RAISE NOTICE '✅ Dropped old index: idx_sessions_member_id';
  END IF;
  
  -- Create new index if doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                 WHERE indexname = 'idx_sessions_fan_id') THEN
    CREATE INDEX idx_sessions_fan_id ON public.sessions(fan_id);
    RAISE NOTICE '✅ Created new index: idx_sessions_fan_id';
  END IF;
END $$;

-- STEP 3: Verify the change
DO $$
DECLARE
  col_exists BOOLEAN;
BEGIN
  -- Check if fan_id exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sessions' AND column_name = 'fan_id'
  ) INTO col_exists;
  
  IF col_exists THEN
    RAISE NOTICE '============================================';
    RAISE NOTICE '✅ SUCCESS: Migration completed!';
    RAISE NOTICE '✅ The sessions table now uses fan_id';
    RAISE NOTICE '============================================';
  ELSE
    RAISE WARNING '============================================';
    RAISE WARNING '❌ FAILED: Migration did not complete';
    RAISE WARNING '❌ Please check for errors above';
    RAISE WARNING '============================================';
  END IF;
END $$;

-- STEP 4: Show current sessions table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'sessions'
ORDER BY ordinal_position;