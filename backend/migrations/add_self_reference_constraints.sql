-- Migration: Add constraints to prevent self-follows and self-subscriptions
-- This ensures data integrity at the database level
-- Author: System
-- Date: 2025-01-10

-- ============================================================================
-- FOLLOWERS TABLE CONSTRAINTS
-- ============================================================================

-- 1. Prevent self-follows (creator cannot follow themselves)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'followers_no_self'
  ) THEN
    ALTER TABLE followers
      ADD CONSTRAINT followers_no_self
      CHECK (creator_id <> follower_id);

    RAISE NOTICE 'Added constraint: followers_no_self';
  ELSE
    RAISE NOTICE 'Constraint followers_no_self already exists';
  END IF;
END
$$;

-- 2. Ensure unique creator-follower pairs (prevent duplicates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'followers_unique_pair'
  ) THEN
    -- First remove any existing duplicates
    DELETE FROM followers a USING followers b
    WHERE a.id > b.id
      AND a.creator_id = b.creator_id
      AND a.follower_id = b.follower_id;

    -- Then add the unique constraint
    ALTER TABLE followers
      ADD CONSTRAINT followers_unique_pair
      UNIQUE (creator_id, follower_id);

    RAISE NOTICE 'Added constraint: followers_unique_pair';
  ELSE
    RAISE NOTICE 'Constraint followers_unique_pair already exists';
  END IF;
END
$$;

-- 3. Clean up any existing self-follows (if they exist)
DELETE FROM followers
WHERE creator_id = follower_id;

-- ============================================================================
-- SUBSCRIPTIONS TABLE CONSTRAINTS
-- ============================================================================

-- 1. Prevent self-subscriptions (creator cannot subscribe to themselves)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscriptions_no_self'
  ) THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_no_self
      CHECK (creator_id <> user_id);

    RAISE NOTICE 'Added constraint: subscriptions_no_self';
  ELSE
    RAISE NOTICE 'Constraint subscriptions_no_self already exists';
  END IF;
END
$$;

-- 2. Ensure unique creator-user pairs (prevent duplicates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscriptions_unique_pair'
  ) THEN
    -- First remove any existing duplicates (keep the most recent)
    DELETE FROM subscriptions a USING subscriptions b
    WHERE a.id > b.id
      AND a.creator_id = b.creator_id
      AND a.user_id = b.user_id;

    -- Then add the unique constraint
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_unique_pair
      UNIQUE (creator_id, user_id);

    RAISE NOTICE 'Added constraint: subscriptions_unique_pair';
  ELSE
    RAISE NOTICE 'Constraint subscriptions_unique_pair already exists';
  END IF;
END
$$;

-- 3. Clean up any existing self-subscriptions (if they exist)
DELETE FROM subscriptions
WHERE creator_id = user_id;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Report on cleaned up data
DO $$
DECLARE
  self_follows_count INTEGER;
  self_subs_count INTEGER;
BEGIN
  -- This should now always return 0 due to constraints
  SELECT COUNT(*) INTO self_follows_count
  FROM followers
  WHERE creator_id = follower_id;

  SELECT COUNT(*) INTO self_subs_count
  FROM subscriptions
  WHERE creator_id = user_id;

  RAISE NOTICE 'Verification Complete:';
  RAISE NOTICE '  - Self-follows found: %', self_follows_count;
  RAISE NOTICE '  - Self-subscriptions found: %', self_subs_count;

  IF self_follows_count > 0 OR self_subs_count > 0 THEN
    RAISE WARNING 'Self-references still exist! Check constraints.';
  ELSE
    RAISE NOTICE '  ✓ All self-references cleaned up successfully';
  END IF;
END
$$;

-- ============================================================================
-- ROLLBACK SCRIPT (commented out - uncomment if needed)
-- ============================================================================

/*
-- To rollback this migration:

ALTER TABLE followers DROP CONSTRAINT IF EXISTS followers_no_self;
ALTER TABLE followers DROP CONSTRAINT IF EXISTS followers_unique_pair;
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_no_self;
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_unique_pair;
*/
