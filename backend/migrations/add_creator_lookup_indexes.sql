-- Migration: Add indexes for fast creator profile lookups
-- Purpose: Enable case-insensitive, performant queries for username, slug, and supabase_id
-- Created: 2025-10-16
--
-- This migration adds indexes to support the robust identifier fallback chain
-- used in CreatorCard and public-creators route:
-- username → slug → handle → id → supabase_id

BEGIN;

-- ============================================================================
-- 1. Case-insensitive unique indexes for username and slug
-- ============================================================================

-- Username: Case-insensitive unique index
-- Allows fast lookups like: LOWER(username) = 'nathan'
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_key
ON public.users (LOWER(username))
WHERE username IS NOT NULL;

COMMENT ON INDEX users_username_lower_key IS 'Case-insensitive unique index for username lookups';

-- Slug: Case-insensitive unique index
-- Allows fast lookups like: LOWER(slug) = 'nathan-creator'
CREATE UNIQUE INDEX IF NOT EXISTS users_slug_lower_key
ON public.users (LOWER(slug))
WHERE slug IS NOT NULL;

COMMENT ON INDEX users_slug_lower_key IS 'Case-insensitive unique index for slug lookups';

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
-- Speeds up queries that filter by is_creator AND check username/slug
CREATE INDEX IF NOT EXISTS users_creator_lookup_idx
ON public.users (is_creator, LOWER(username), LOWER(slug))
WHERE is_creator = true AND username IS NOT NULL;

COMMENT ON INDEX users_creator_lookup_idx IS 'Composite index for creator profile lookups';

-- ============================================================================
-- 4. Performance indexes for social features
-- ============================================================================

-- Index for follower counts (used in creator profiles)
CREATE INDEX IF NOT EXISTS follows_followed_id_idx
ON public.follows (followed_id);

COMMENT ON INDEX follows_followed_id_idx IS 'Index for counting followers of a creator';

-- Index for following counts
CREATE INDEX IF NOT EXISTS follows_follower_id_idx
ON public.follows (follower_id);

COMMENT ON INDEX follows_follower_id_idx IS 'Index for counting users a creator follows';

-- ============================================================================
-- 5. Index for online status queries
-- ============================================================================

-- Index for last_active_at to speed up online status checks
CREATE INDEX IF NOT EXISTS users_last_active_at_idx
ON public.users (last_active_at DESC)
WHERE last_active_at IS NOT NULL;

COMMENT ON INDEX users_last_active_at_idx IS 'Index for online status queries';

-- ============================================================================
-- 6. Verify indexes were created
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
      'users_slug_lower_key',
      'users_supabase_id_idx',
      'users_creator_lookup_idx',
      'users_last_active_at_idx'
    );

  RAISE NOTICE '✅ Created/verified % indexes on users table', index_count;

  SELECT COUNT(*)::integer INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'follows'
    AND indexname IN (
      'follows_followed_id_idx',
      'follows_follower_id_idx'
    );

  RAISE NOTICE '✅ Created/verified % indexes on follows table', index_count;
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
-- 3. Composite index (is_creator, username, slug) speeds up creator searches
--
-- 4. If using citext column type, use normal unique indexes instead:
--    CREATE UNIQUE INDEX users_username_key ON users (username);
--
-- ============================================================================
-- Rollback (if needed):
-- ============================================================================
--
-- DROP INDEX IF EXISTS users_username_lower_key;
-- DROP INDEX IF EXISTS users_slug_lower_key;
-- DROP INDEX IF EXISTS users_supabase_id_idx;
-- DROP INDEX IF EXISTS users_creator_lookup_idx;
-- DROP INDEX IF EXISTS users_last_active_at_idx;
-- DROP INDEX IF EXISTS follows_followed_id_idx;
-- DROP INDEX IF EXISTS follows_follower_id_idx;
--
-- ============================================================================
