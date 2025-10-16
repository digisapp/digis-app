-- Migration 008: Fan Profile Fields & Indexes
-- Created: 2025-10-16
-- Purpose: Add fan profile fields (about_me, location, fan_rank, badges) and create performance indexes

-- 1) Add columns for fan profiles (nullable by default)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS about_me TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS fan_rank TEXT,
  ADD COLUMN IF NOT EXISTS badges TEXT[];

-- 2) Add profile_visibility with proper constraint and default to 'private' for safety
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_visibility TEXT DEFAULT 'private'
    CHECK (profile_visibility IN ('public', 'followers', 'private'));

-- 3) Set default visibility to 'private' for existing users if column already exists
UPDATE users SET profile_visibility = 'private' WHERE profile_visibility IS NULL;

-- 4) Core indexes for performance
-- Username lookup (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));

-- Creator/fan filtering
CREATE INDEX IF NOT EXISTS idx_users_is_creator ON users (is_creator);

-- Profile visibility filtering
CREATE INDEX IF NOT EXISTS idx_users_profile_visibility ON users (profile_visibility);

-- 5) Follow relationship indexes (only if follows table and columns exist)
DO $$
BEGIN
  -- Check if follows table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'follows') THEN
    -- Check if follower_id column exists
    IF EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_name = 'follows' AND column_name = 'follower_id'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows (follower_id);
    END IF;

    -- Check if followed_id column exists
    IF EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_name = 'follows' AND column_name = 'followed_id'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_follows_followed ON follows (followed_id);

      -- Create composite index only if both columns exist
      IF EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'follows' AND column_name = 'follower_id'
      ) THEN
        CREATE INDEX IF NOT EXISTS idx_follows_both ON follows (follower_id, followed_id);
      END IF;
    END IF;
  END IF;
END $$;

-- 6) Gift transactions indexes (for stats calculations)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'gift_transactions') THEN
    IF EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_name = 'gift_transactions' AND column_name = 'sender_id'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_gift_transactions_sender ON gift_transactions (sender_id);
    END IF;

    IF EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_name = 'gift_transactions' AND column_name = 'recipient_id'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_gift_transactions_recipient ON gift_transactions (recipient_id);
    END IF;
  END IF;
END $$;

-- 7) Tip transactions indexes (for stats calculations)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tip_transactions') THEN
    IF EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_name = 'tip_transactions' AND column_name = 'sender_id'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_tip_transactions_sender ON tip_transactions (sender_id);
    END IF;

    IF EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_name = 'tip_transactions' AND column_name = 'recipient_id'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_tip_transactions_recipient ON tip_transactions (recipient_id);
    END IF;
  END IF;
END $$;

-- 8) Stream chat indexes (for comment count)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stream_chat') THEN
    IF EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_name = 'stream_chat' AND column_name = 'user_id'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_stream_chat_user ON stream_chat (user_id);
    END IF;
  END IF;
END $$;

-- 9) Add constraints for reasonable field lengths (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'check_about_me_length'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT check_about_me_length
      CHECK (about_me IS NULL OR char_length(about_me) <= 1000);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'check_location_length'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT check_location_length
      CHECK (location IS NULL OR char_length(location) <= 200);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'check_bio_length'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT check_bio_length
      CHECK (bio IS NULL OR char_length(bio) <= 500);
  END IF;
END $$;

-- 10) Comment for documentation
COMMENT ON COLUMN users.about_me IS 'Extended bio for fan profiles (max 1000 chars)';
COMMENT ON COLUMN users.location IS 'General location: city, state/region (max 200 chars)';
COMMENT ON COLUMN users.fan_rank IS 'Gamification rank for fans (e.g., Bronze, Silver, Gold, Platinum)';
COMMENT ON COLUMN users.badges IS 'Array of achievement badges';
COMMENT ON COLUMN users.profile_visibility IS 'Profile visibility: public, followers (followers-only), or private';
