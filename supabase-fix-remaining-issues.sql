-- ============================================
-- FIX REMAINING DATABASE ISSUES
-- ============================================
-- Run this in your Supabase SQL editor:
-- https://supabase.com/dashboard/project/lpphsjowsivjtcmafxnj/sql/new
-- ============================================

-- 1. Add missing columns to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tv_trial_used BOOLEAN DEFAULT FALSE;

-- 2. Create class_reviews table (referenced by classes route)
CREATE TABLE IF NOT EXISTS public.class_reviews (
  id SERIAL PRIMARY KEY,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  creator_id INTEGER REFERENCES users(id),
  reviewer_id INTEGER REFERENCES users(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Add indexes for class_reviews
CREATE INDEX IF NOT EXISTS idx_class_reviews_class_id ON public.class_reviews(class_id);
CREATE INDEX IF NOT EXISTS idx_class_reviews_creator_id ON public.class_reviews(creator_id);
CREATE INDEX IF NOT EXISTS idx_class_reviews_reviewer_id ON public.class_reviews(reviewer_id);

-- 4. Update tv_subscriptions to use correct user_id type
-- First check if the column needs updating
DO $$
BEGIN
  -- Check if user_id column exists and is the wrong type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tv_subscriptions' 
    AND column_name = 'user_id' 
    AND data_type != 'integer'
  ) THEN
    -- Drop and recreate the column with correct type
    ALTER TABLE public.tv_subscriptions DROP COLUMN user_id CASCADE;
    ALTER TABLE public.tv_subscriptions ADD COLUMN user_id INTEGER REFERENCES users(id) UNIQUE;
  END IF;
END $$;

-- 5. Verify tables
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('classes', 'class_participants', 'tv_subscriptions', 'notifications', 'class_reviews');
  
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ Verified % tables exist', table_count;
  RAISE NOTICE '============================================';
END $$;