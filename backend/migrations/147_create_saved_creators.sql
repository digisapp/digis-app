-- Create saved_creators table for bookmarking/saving creators
CREATE TABLE IF NOT EXISTS saved_creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT, -- Optional notes about why the creator was saved
  notification_enabled BOOLEAN DEFAULT false, -- Get notified when creator goes live
  CONSTRAINT unique_saved_creator UNIQUE (user_id, creator_id),
  CONSTRAINT no_self_save CHECK (user_id != creator_id)
);

-- Create indexes for performance
CREATE INDEX idx_saved_creators_user_id ON saved_creators(user_id);
CREATE INDEX idx_saved_creators_creator_id ON saved_creators(creator_id);
CREATE INDEX idx_saved_creators_saved_at ON saved_creators(saved_at DESC);

-- Enable RLS
ALTER TABLE saved_creators ENABLE ROW LEVEL SECURITY;

-- RLS policies
-- Users can see their own saved creators
CREATE POLICY saved_creators_select_own ON saved_creators
FOR SELECT USING (user_id = auth.uid());

-- Users can only save creators for themselves
CREATE POLICY saved_creators_insert_own ON saved_creators
FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can only delete their own saved creators
CREATE POLICY saved_creators_delete_own ON saved_creators
FOR DELETE USING (user_id = auth.uid());

-- Users can update their own saved creators (e.g., notes, notifications)
CREATE POLICY saved_creators_update_own ON saved_creators
FOR UPDATE USING (user_id = auth.uid());

-- Add function to get saved creators count
CREATE OR REPLACE FUNCTION get_saved_creators_count(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM saved_creators
  WHERE user_id = p_user_id;
$$ LANGUAGE SQL STABLE;

-- Add function to check if a creator is saved by a user
CREATE OR REPLACE FUNCTION is_creator_saved(p_user_id UUID, p_creator_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1
    FROM saved_creators
    WHERE user_id = p_user_id AND creator_id = p_creator_id
  );
$$ LANGUAGE SQL STABLE;