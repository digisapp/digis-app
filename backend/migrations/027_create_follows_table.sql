-- Create follows table for user following relationships
CREATE TABLE IF NOT EXISTS follows (
  id SERIAL PRIMARY KEY,
  follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_follow UNIQUE (follower_id, followed_id),
  CONSTRAINT no_self_follow CHECK (follower_id != followed_id)
);

-- Create indexes for performance
CREATE INDEX idx_follows_follower_id ON follows(follower_id);
CREATE INDEX idx_follows_followed_id ON follows(followed_id);
CREATE INDEX idx_follows_created_at ON follows(created_at DESC);

-- Create composite index for common queries
CREATE INDEX idx_follows_follower_followed ON follows(follower_id, followed_id);

-- Enable RLS
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- RLS policies
-- Users can see who they follow
CREATE POLICY follows_select_own ON follows
FOR SELECT USING (follower_id = current_setting('request.jwt.claims')::json->>'sub'::integer);

-- Users can see who follows them (for creators)
CREATE POLICY follows_select_followers ON follows
FOR SELECT USING (followed_id = current_setting('request.jwt.claims')::json->>'sub'::integer);

-- Users can only create follows for themselves
CREATE POLICY follows_insert_own ON follows
FOR INSERT WITH CHECK (follower_id = current_setting('request.jwt.claims')::json->>'sub'::integer);

-- Users can only delete their own follows
CREATE POLICY follows_delete_own ON follows
FOR DELETE USING (follower_id = current_setting('request.jwt.claims')::json->>'sub'::integer);

-- Add follower count function for performance
CREATE OR REPLACE FUNCTION get_follower_count(user_id INTEGER)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM follows
  WHERE followed_id = user_id;
$$ LANGUAGE SQL STABLE;

-- Add following count function
CREATE OR REPLACE FUNCTION get_following_count(user_id INTEGER)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM follows
  WHERE follower_id = user_id;
$$ LANGUAGE SQL STABLE;

-- Add last_seen column to users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index on last_seen for online status queries
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen);

-- Create streams table if it doesn't exist (for activity feed)
CREATE TABLE IF NOT EXISTS streams (
  id SERIAL PRIMARY KEY,
  creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  viewer_count INTEGER DEFAULT 0,
  is_live BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Create index for activity queries
CREATE INDEX IF NOT EXISTS idx_streams_creator_id ON streams(creator_id);
CREATE INDEX IF NOT EXISTS idx_streams_created_at ON streams(created_at DESC);

-- Add updated_at column to users if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at_trigger'
  ) THEN
    CREATE TRIGGER update_users_updated_at_trigger
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at();
  END IF;
END
$$;