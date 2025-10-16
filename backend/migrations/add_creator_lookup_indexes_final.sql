-- Migration: Add indexes for fast creator profile lookups (FINAL - Matches actual schema)
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

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_key
ON public.users (LOWER(username))
WHERE username IS NOT NULL;

COMMENT ON INDEX users_username_lower_key IS 'Case-insensitive unique index for username lookups';

-- ============================================================================
-- 2. Supabase ID index
-- ============================================================================

CREATE INDEX IF NOT EXISTS users_supabase_id_idx
ON public.users (supabase_id)
WHERE supabase_id IS NOT NULL;

COMMENT ON INDEX users_supabase_id_idx IS 'Index for supabase_id lookups (auth UUID)';

-- ============================================================================
-- 3. Composite index for creator filtering
-- ============================================================================

CREATE INDEX IF NOT EXISTS users_creator_lookup_idx
ON public.users (is_creator, LOWER(username))
WHERE is_creator = true AND username IS NOT NULL;

COMMENT ON INDEX users_creator_lookup_idx IS 'Composite index for creator profile lookups';

-- ============================================================================
-- 4. Indexes on follows table
-- ============================================================================

-- Index for counting followers of a creator (creator_id)
CREATE INDEX IF NOT EXISTS follows_creator_id_idx
ON public.follows (creator_id);

COMMENT ON INDEX follows_creator_id_idx IS 'Index for counting followers of a creator';

-- Index for counting creators a user follows (follower_id)
CREATE INDEX IF NOT EXISTS follows_follower_id_idx
ON public.follows (follower_id);

COMMENT ON INDEX follows_follower_id_idx IS 'Index for counting creators a user follows';

-- ============================================================================
-- 5. Index for online status queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS users_last_active_at_idx
ON public.users (last_active_at DESC)
WHERE last_active_at IS NOT NULL;

COMMENT ON INDEX users_last_active_at_idx IS 'Index for online status queries';

-- ============================================================================
-- 6. Index for creator availability
-- ============================================================================

CREATE INDEX IF NOT EXISTS users_available_creators_idx
ON public.users (is_creator, is_online, available_for_calls)
WHERE is_creator = true;

COMMENT ON INDEX users_available_creators_idx IS 'Index for finding available creators';

-- ============================================================================
-- 7. Verify indexes
-- ============================================================================

DO $$
DECLARE
  user_index_count integer;
  follows_index_count integer;
BEGIN
  SELECT COUNT(*)::integer INTO user_index_count
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

  SELECT COUNT(*)::integer INTO follows_index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'follows'
    AND indexname IN (
      'follows_creator_id_idx',
      'follows_follower_id_idx'
    );

  RAISE NOTICE '✅ Created/verified % indexes on users table', user_index_count;
  RAISE NOTICE '✅ Created/verified % indexes on follows table', follows_index_count;
END $$;

COMMIT;
