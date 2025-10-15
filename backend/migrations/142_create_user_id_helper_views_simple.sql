-- Migration: Create helper views to abstract ID type differences (SIMPLIFIED)
-- This helps prevent UUID/INT type mismatch errors after Supabase migration
-- Created: 2025-10-15

-- Drop views if they exist
DROP VIEW IF EXISTS v_user_full CASCADE;
DROP VIEW IF EXISTS v_creator_profile CASCADE;

-- Create comprehensive user view with all ID types clearly labeled
CREATE OR REPLACE VIEW v_user_full AS
SELECT
  u.id AS user_db_id,           -- INTEGER/UUID: database primary key
  u.supabase_id AS user_uuid,   -- UUID: Supabase auth ID (if different from id)
  u.email,
  u.username,
  u.display_name,
  u.bio,
  u.profile_pic_url,
  u.is_creator,
  u.is_super_admin,
  u.role,
  u.creator_type,
  u.verified,
  u.email_verified,
  u.created_at,
  u.updated_at,
  u.last_active,
  -- Canonical role flags
  (
    u.is_creator = true OR
    u.role = 'creator' OR
    u.creator_type IS NOT NULL
  ) AS is_creator_canonical,
  (
    u.is_super_admin = true OR
    u.role = 'admin'
  ) AS is_admin_canonical
FROM users u;

COMMENT ON VIEW v_user_full IS 'Complete user profile with canonical role computation';

-- Create creator-specific view for easy querying
CREATE OR REPLACE VIEW v_creator_profile AS
SELECT
  u.id AS creator_db_id,        -- For joins with sessions, followers, etc.
  u.supabase_id AS creator_uuid, -- For authentication
  u.email,
  u.username,
  u.display_name,
  u.bio,
  u.profile_pic_url,
  u.verified,
  u.creator_type,
  (SELECT COUNT(*) FROM followers WHERE creator_id = u.id) AS follower_count,
  (SELECT COUNT(*) FROM subscriptions WHERE creator_id = u.id AND status = 'active') AS subscriber_count
FROM users u
WHERE u.is_creator = true OR u.role = 'creator' OR u.creator_type IS NOT NULL;

COMMENT ON VIEW v_creator_profile IS 'Creator-specific profile with follower/subscriber counts';

-- Add helpful indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON users(supabase_id);
CREATE INDEX IF NOT EXISTS idx_followers_creator_id_follower_id ON followers(creator_id, follower_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_creator_id_status ON subscriptions(creator_id, status);

-- Add comment explaining the ID type pattern
COMMENT ON TABLE users IS 'Users table: Check schema - may use id (UUID) = supabase_id, or separate id (INT) + supabase_id (UUID)';
COMMENT ON TABLE followers IS 'Followers: creator_id typically references users.id, follower_id may use supabase_id';
COMMENT ON TABLE subscriptions IS 'Subscriptions: creator_id typically references users.id, user_id may use supabase_id';
