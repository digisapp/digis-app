-- Migration: Add indexes for fast creator profile lookups (v2 - Updated for actual schema)
-- Purpose: Enable case-insensitive, performant queries for username and supabase_id
-- Created: 2025-10-16
--
-- This migration adds indexes to support the robust identifier fallback chain
-- used in CreatorCard and public-creators route:
-- username → id → supabase_id

BEGIN;

-- ============================================================================
-- 1. Case-insensitive unique index for username
-- ============================================================================

-- Username: Case-insensitive unique index
-- Allows fast lookups like: LOWER(username) = 'nathan'
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_key
ON public.users (LOWER(username))
WHERE username IS NOT NULL;

COMMENT ON INDEX users_username_lower_key IS 'Case-insensitive unique index for username lookups';

-- ============================================================================
-- 2. Supabase ID index (if not already exists)
-- ============================================================================

-- Supabase ID: Regular index for UUID lookups
-- Most queries already use this, but ensure it exists
CREATE INDEX IF NOT EXISTS users_supabase_id_idx
ON public.users (supabase_id)
WHERE supabase_id IS NOT NULL;

COMMENT ON INDEX users_supabase_id_idx IS 'Index for supabase_id lookups (auth UUID)';

-- ============================================================================
-- 3. Composite index for creator filtering
-- ============================================================================

-- Composite index for common creator queries
-- Speeds up queries that filter by is_creator AND check username
CREATE INDEX IF NOT EXISTS users_creator_lookup_idx
ON public.users (is_creator, LOWER(username))
WHERE is_creator = true AND username IS NOT NULL;

COMMENT ON INDEX users_creator_lookup_idx IS 'Composite index for creator profile lookups';

-- ============================================================================
-- 4. Performance indexes for social features
-- ============================================================================

-- Check if follows table exists before creating indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'follows' AND table_schema = 'public') THEN
    -- Index for follower counts (used in creator profiles)
    CREATE INDEX IF NOT EXISTS follows_followed_id_idx
    ON public.follows (followed_id);

    COMMENT ON INDEX follows_followed_id_idx IS 'Index for counting followers of a creator';

    -- Index for following counts
    CREATE INDEX IF NOT EXISTS follows_follower_id_idx
    ON public.follows (follower_id);

    COMMENT ON INDEX follows_follower_id_idx IS 'Index for counting users a creator follows';

    RAISE NOTICE '✅ Created indexes on follows table';
  ELSE
    RAISE NOTICE 'ℹ️  follows table does not exist, skipping indexes';
  END IF;
END $$;

-- ============================================================================
-- 5. Index for online status queries
-- ============================================================================

-- Index for last_active_at to speed up online status checks
CREATE INDEX IF NOT EXISTS users_last_active_at_idx
ON public.users (last_active_at DESC)
WHERE last_active_at IS NOT NULL;

COMMENT ON INDEX users_last_active_at_idx IS 'Index for online status queries';

-- ============================================================================
-- 6. Index for creator availability queries
-- ============================================================================

-- Index for available_for_calls to filter online creators
CREATE INDEX IF NOT EXISTS users_available_creators_idx
ON public.users (is_creator, is_online, available_for_calls)
WHERE is_creator = true;

COMMENT ON INDEX users_available_creators_idx IS 'Index for finding available creators';

-- ============================================================================
-- 7. Verify indexes were created
-- ============================================================================

DO $$
DECLARE
  index_count integer;
BEGIN
  SELECT COUNT(*)::integer INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'users'
    AND indexname IN (
      'users_username_lower_key',
      'users_supabase_id_idx',
      'users_creator_lookup_idx',
      'users_last_active_at_idx',
      'users_available_creators_idx'
    );

  RAISE NOTICE '✅ Created/verified % indexes on users table', index_count;
END $$;

COMMIT;

-- ============================================================================
-- Performance Notes:
-- ============================================================================
--
-- 1. LOWER() indexes enable case-insensitive lookups without ILIKE
--    Example: LOWER(username) = 'nathan' (uses index)
--    vs: username ILIKE 'nathan' (full table scan)
--
-- 2. WHERE clauses in CREATE INDEX filter nulls for smaller, faster indexes
--
-- 3. Composite index (is_creator, username) speeds up creator searches
--
-- ============================================================================
-- Rollback (if needed):
-- ============================================================================
--
-- DROP INDEX IF EXISTS users_username_lower_key;
-- DROP INDEX IF EXISTS users_supabase_id_idx;
-- DROP INDEX IF EXISTS users_creator_lookup_idx;
-- DROP INDEX IF EXISTS users_last_active_at_idx;
-- DROP INDEX IF EXISTS users_available_creators_idx;
-- DROP INDEX IF EXISTS follows_followed_id_idx;
-- DROP INDEX IF EXISTS follows_follower_id_idx;
--
-- ============================================================================
