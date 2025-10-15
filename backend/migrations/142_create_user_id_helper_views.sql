-- Migration: Create helper views to abstract ID type differences
-- This helps prevent UUID/INT type mismatch errors after Supabase migration
-- Created: 2025-10-15

-- Drop views if they exist
DROP VIEW IF EXISTS v_user_full CASCADE;
DROP VIEW IF EXISTS v_creator_profile CASCADE;

-- Create comprehensive user view with all ID types clearly labeled
CREATE OR REPLACE VIEW v_user_full AS
SELECT
  u.id AS user_db_id,           -- INTEGER: database primary key
  u.supabase_id AS user_uuid,   -- UUID: Supabase auth ID
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
  COALESCE(tb.balance, 0) as token_balance,
  COALESCE(tb.total_purchased, 0) as total_purchased,
  COALESCE(tb.total_spent, 0) as total_spent,
  COALESCE(tb.total_earned, 0) as total_earned,
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
FROM users u
LEFT JOIN token_balances tb ON tb.user_id = u.supabase_id;

COMMENT ON VIEW v_user_full IS 'Complete user profile with token balances and canonical role computation';

-- Create creator-specific view for easy querying
CREATE OR REPLACE VIEW v_creator_profile AS
SELECT
  u.id AS creator_db_id,        -- INTEGER: for joins with sessions, followers, etc.
  u.supabase_id AS creator_uuid, -- UUID: for authentication
  u.email,
  u.username,
  u.display_name,
  u.bio,
  u.profile_pic_url,
  u.verified,
  u.creator_type,
  u.price_per_min,
  u.video_price,
  u.voice_price,
  u.stream_price,
  u.message_price,
  u.text_message_price,
  u.image_message_price,
  u.audio_message_price,
  u.video_message_price,
  COALESCE(tb.balance, 0) as token_balance,
  COALESCE(tb.total_earned, 0) as total_earned,
  (SELECT COUNT(*) FROM followers WHERE creator_id = u.id) AS follower_count,
  (SELECT COUNT(*) FROM subscriptions WHERE creator_id = u.id AND status = 'active') AS subscriber_count
FROM users u
LEFT JOIN token_balances tb ON tb.user_id = u.supabase_id
WHERE u.is_creator = true OR u.role = 'creator' OR u.creator_type IS NOT NULL;

COMMENT ON VIEW v_creator_profile IS 'Creator-specific profile with follower/subscriber counts';

-- Add helpful indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON users(supabase_id);
CREATE INDEX IF NOT EXISTS idx_token_balances_user_id ON token_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_followers_creator_id_follower_id ON followers(creator_id, follower_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_creator_id_user_id ON subscriptions(creator_id, user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Add comment explaining the ID type pattern
COMMENT ON TABLE users IS 'Users table: id (INT) is DB primary key, supabase_id (UUID) is auth ID';
COMMENT ON TABLE followers IS 'Followers: creator_id uses users.id (INT), follower_id uses users.supabase_id (UUID)';
COMMENT ON TABLE subscriptions IS 'Subscriptions: creator_id uses users.id (INT), user_id uses users.supabase_id (UUID)';
COMMENT ON TABLE token_balances IS 'Token balances: user_id uses users.supabase_id (UUID)';
