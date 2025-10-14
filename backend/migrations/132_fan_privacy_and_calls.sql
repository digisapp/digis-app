-- Migration: Fan Privacy and Call Management
-- Description: Add fan privacy controls, creator-fan relationships, and call management

-- Fan privacy settings (extends existing users table)
ALTER TABLE users ADD COLUMN IF NOT EXISTS fan_privacy_visibility VARCHAR(20) DEFAULT 'private'
  CHECK (fan_privacy_visibility IN ('private', 'creators', 'link'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS fan_allow_dm VARCHAR(20) DEFAULT 'interacted'
  CHECK (fan_allow_dm IN ('none', 'following', 'interacted'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS fan_allow_calls VARCHAR(20) DEFAULT 'interacted'
  CHECK (fan_allow_calls IN ('none', 'following', 'interacted'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS fan_share_token VARCHAR(64) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fan_share_token_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fan_allow_search BOOLEAN DEFAULT FALSE;

-- Creator-Fan relationship tracking (for scoped visibility)
CREATE TABLE IF NOT EXISTS creator_fan_relationships (
  id SERIAL PRIMARY KEY,
  creator_id VARCHAR(255) NOT NULL REFERENCES users(firebase_uid) ON DELETE CASCADE,
  fan_id VARCHAR(255) NOT NULL REFERENCES users(firebase_uid) ON DELETE CASCADE,
  relation_type VARCHAR(20) NOT NULL CHECK (relation_type IN ('follow', 'tipped', 'purchased', 'messaged', 'called')),
  last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(creator_id, fan_id, relation_type)
);

-- Calls table for voice/video with Agora (replaces sessions table for 1:1 calls)
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id VARCHAR(255) NOT NULL REFERENCES users(firebase_uid) ON DELETE CASCADE,
  fan_id VARCHAR(255) NOT NULL REFERENCES users(firebase_uid) ON DELETE CASCADE,
  call_type VARCHAR(20) NOT NULL CHECK (call_type IN ('voice', 'video')),
  channel VARCHAR(255) NOT NULL,
  state VARCHAR(20) NOT NULL DEFAULT 'ringing' CHECK (state IN ('ringing', 'connected', 'ended', 'missed', 'declined', 'cancelled')),

  -- Agora credentials
  agora_app_id VARCHAR(255),
  agora_channel VARCHAR(255),
  creator_token TEXT,
  fan_token TEXT,
  creator_uid INTEGER,
  fan_uid INTEGER,

  -- Timing
  initiated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  connected_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,

  -- Billing
  rate_per_minute DECIMAL(10,2),
  total_cost DECIMAL(15,2),

  -- Metadata
  ended_by VARCHAR(255), -- user id who ended the call
  end_reason VARCHAR(50), -- 'completed', 'timeout', 'error', 'cancelled'
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Call invitations (for tracking pending call requests)
CREATE TABLE IF NOT EXISTS call_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  creator_id VARCHAR(255) NOT NULL REFERENCES users(firebase_uid) ON DELETE CASCADE,
  fan_id VARCHAR(255) NOT NULL REFERENCES users(firebase_uid) ON DELETE CASCADE,
  call_type VARCHAR(20) NOT NULL CHECK (call_type IN ('voice', 'video')),
  state VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  message TEXT,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '2 minutes',
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_fan_privacy ON users(fan_privacy_visibility) WHERE is_creator = FALSE;
CREATE INDEX IF NOT EXISTS idx_users_fan_share_token ON users(fan_share_token) WHERE fan_share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_creator_fan_rel_creator ON creator_fan_relationships(creator_id, fan_id);
CREATE INDEX IF NOT EXISTS idx_creator_fan_rel_fan ON creator_fan_relationships(fan_id);
CREATE INDEX IF NOT EXISTS idx_creator_fan_rel_type ON creator_fan_relationships(relation_type);
CREATE INDEX IF NOT EXISTS idx_calls_creator ON calls(creator_id);
CREATE INDEX IF NOT EXISTS idx_calls_fan ON calls(fan_id);
CREATE INDEX IF NOT EXISTS idx_calls_state ON calls(state);
CREATE INDEX IF NOT EXISTS idx_calls_channel ON calls(agora_channel);
CREATE INDEX IF NOT EXISTS idx_call_invitations_fan ON call_invitations(fan_id, state);
CREATE INDEX IF NOT EXISTS idx_call_invitations_expires ON call_invitations(expires_at) WHERE state = 'pending';

-- Function to check if creator has relationship with fan
CREATE OR REPLACE FUNCTION creator_has_relationship(
  p_creator_id VARCHAR(255),
  p_fan_id VARCHAR(255)
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM creator_fan_relationships
    WHERE creator_id = p_creator_id AND fan_id = p_fan_id
  );
END;
$$ LANGUAGE plpgsql;

-- Function to check if creator can message fan
CREATE OR REPLACE FUNCTION can_creator_message_fan(
  p_creator_id VARCHAR(255),
  p_fan_id VARCHAR(255)
)
RETURNS BOOLEAN AS $$
DECLARE
  fan_dm_setting VARCHAR(20);
  has_relationship BOOLEAN;
  fan_follows BOOLEAN;
BEGIN
  -- Get fan's DM settings
  SELECT fan_allow_dm INTO fan_dm_setting
  FROM users
  WHERE firebase_uid = p_fan_id;

  -- If no setting or 'none', deny
  IF fan_dm_setting IS NULL OR fan_dm_setting = 'none' THEN
    RETURN FALSE;
  END IF;

  -- Check if they have any relationship
  has_relationship := creator_has_relationship(p_creator_id, p_fan_id);

  -- If 'interacted', need any relationship
  IF fan_dm_setting = 'interacted' THEN
    RETURN has_relationship;
  END IF;

  -- If 'following', need follow relationship
  IF fan_dm_setting = 'following' THEN
    SELECT EXISTS (
      SELECT 1 FROM creator_fan_relationships
      WHERE creator_id = p_creator_id
        AND fan_id = p_fan_id
        AND relation_type = 'follow'
    ) INTO fan_follows;
    RETURN fan_follows;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to check if creator can call fan
CREATE OR REPLACE FUNCTION can_creator_call_fan(
  p_creator_id VARCHAR(255),
  p_fan_id VARCHAR(255)
)
RETURNS BOOLEAN AS $$
DECLARE
  fan_call_setting VARCHAR(20);
  has_relationship BOOLEAN;
  fan_follows BOOLEAN;
BEGIN
  -- Get fan's call settings
  SELECT fan_allow_calls INTO fan_call_setting
  FROM users
  WHERE firebase_uid = p_fan_id;

  -- If no setting or 'none', deny
  IF fan_call_setting IS NULL OR fan_call_setting = 'none' THEN
    RETURN FALSE;
  END IF;

  -- Check if they have any relationship
  has_relationship := creator_has_relationship(p_creator_id, p_fan_id);

  -- If 'interacted', need any relationship
  IF fan_call_setting = 'interacted' THEN
    RETURN has_relationship;
  END IF;

  -- If 'following', need follow relationship
  IF fan_call_setting = 'following' THEN
    SELECT EXISTS (
      SELECT 1 FROM creator_fan_relationships
      WHERE creator_id = p_creator_id
        AND fan_id = p_fan_id
        AND relation_type = 'follow'
    ) INTO fan_follows;
    RETURN fan_follows;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on calls
CREATE TRIGGER update_calls_updated_at
  BEFORE UPDATE ON calls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically create relationship on follow
CREATE OR REPLACE FUNCTION auto_create_follow_relationship()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO creator_fan_relationships (creator_id, fan_id, relation_type)
  VALUES (NEW.creator_id, NEW.follower_id, 'follow')
  ON CONFLICT (creator_id, fan_id, relation_type)
  DO UPDATE SET last_interaction_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_follow_relationship ON followers;
CREATE TRIGGER trigger_auto_follow_relationship
  AFTER INSERT ON followers
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_follow_relationship();

-- Trigger to automatically create relationship on tip
CREATE OR REPLACE FUNCTION auto_create_tip_relationship()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO creator_fan_relationships (creator_id, fan_id, relation_type)
  VALUES (NEW.creator_id, NEW.tipper_id, 'tipped')
  ON CONFLICT (creator_id, fan_id, relation_type)
  DO UPDATE SET last_interaction_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_tip_relationship ON tips;
CREATE TRIGGER trigger_auto_tip_relationship
  AFTER INSERT ON tips
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_tip_relationship();

-- Trigger to automatically create relationship on call
CREATE OR REPLACE FUNCTION auto_create_call_relationship()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create relationship when call is actually connected
  IF NEW.state = 'connected' AND OLD.state != 'connected' THEN
    INSERT INTO creator_fan_relationships (creator_id, fan_id, relation_type)
    VALUES (NEW.creator_id, NEW.fan_id, 'called')
    ON CONFLICT (creator_id, fan_id, relation_type)
    DO UPDATE SET last_interaction_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_call_relationship ON calls;
CREATE TRIGGER trigger_auto_call_relationship
  AFTER UPDATE ON calls
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_call_relationship();

-- Comments
COMMENT ON TABLE creator_fan_relationships IS 'Tracks interactions between creators and fans for scoped visibility and permissions';
COMMENT ON TABLE calls IS 'Voice and video calls between creators and fans using Agora.io';
COMMENT ON TABLE call_invitations IS 'Pending call invitations from creators to fans';
COMMENT ON COLUMN users.fan_privacy_visibility IS 'Fan profile visibility: private (owner only), creators (creators with relationship), link (anyone with share link)';
COMMENT ON COLUMN users.fan_allow_dm IS 'Who can DM this fan: none, following (creators they follow), interacted (creators with any relationship)';
COMMENT ON COLUMN users.fan_allow_calls IS 'Who can call this fan: none, following, interacted';
COMMENT ON COLUMN users.fan_share_token IS 'Optional revocable share token for non-indexed profile sharing';
