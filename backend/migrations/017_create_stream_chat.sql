-- Migration: Create Live Stream Chat System
-- Separate from 1-on-1 messaging for public stream chat

-- ============================================================================
-- STREAM CHAT MESSAGES TABLE
-- ============================================================================
-- Public chat messages during live streams
CREATE TABLE IF NOT EXISTS stream_chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Stream reference
  stream_id VARCHAR(255) NOT NULL, -- Channel name or stream ID

  -- User who sent the message
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Message content
  message TEXT NOT NULL,

  -- Message metadata
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,

  -- User context at time of message
  user_role VARCHAR(50), -- 'host', 'moderator', 'subscriber', 'viewer'

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_stream_chat_stream_id ON stream_chat_messages(stream_id, created_at DESC);
CREATE INDEX idx_stream_chat_user_id ON stream_chat_messages(user_id);
CREATE INDEX idx_stream_chat_created_at ON stream_chat_messages(created_at DESC);

-- ============================================================================
-- STREAM CHAT MODERATION TABLE
-- ============================================================================
-- Track banned/muted users per stream
CREATE TABLE IF NOT EXISTS stream_chat_moderation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  stream_id VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Moderation action
  action VARCHAR(50) NOT NULL, -- 'ban', 'mute', 'timeout'
  duration_minutes INTEGER, -- NULL = permanent, otherwise temporary
  reason TEXT,

  -- Who performed the action
  moderator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  -- Ensure one active moderation per user per stream
  CONSTRAINT unique_stream_user_moderation UNIQUE(stream_id, user_id, action)
);

CREATE INDEX idx_stream_moderation_stream ON stream_chat_moderation(stream_id);
CREATE INDEX idx_stream_moderation_user ON stream_chat_moderation(user_id);
CREATE INDEX idx_stream_moderation_expires ON stream_chat_moderation(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to check if user is banned/muted in a stream
CREATE OR REPLACE FUNCTION is_user_moderated(
  p_stream_id VARCHAR(255),
  p_user_id UUID,
  p_action VARCHAR(50)
) RETURNS BOOLEAN AS $$
DECLARE
  v_moderation RECORD;
BEGIN
  SELECT * INTO v_moderation
  FROM stream_chat_moderation
  WHERE stream_id = p_stream_id
    AND user_id = p_user_id
    AND action = p_action
    AND (expires_at IS NULL OR expires_at > NOW())
  LIMIT 1;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old stream chat messages (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_stream_chat(days_old INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM stream_chat_messages
  WHERE created_at < NOW() - (days_old || ' days')::INTERVAL;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- Function to get stream chat messages with user info
CREATE OR REPLACE FUNCTION get_stream_chat_messages(
  p_stream_id VARCHAR(255),
  p_limit INTEGER DEFAULT 50,
  p_before TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  stream_id VARCHAR(255),
  user_id UUID,
  username VARCHAR(255),
  display_name VARCHAR(255),
  profile_pic_url TEXT,
  message TEXT,
  user_role VARCHAR(50),
  is_deleted BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.stream_id,
    m.user_id,
    u.username,
    u.display_name,
    u.profile_pic_url,
    m.message,
    m.user_role,
    m.is_deleted,
    m.created_at
  FROM stream_chat_messages m
  JOIN users u ON m.user_id = u.id
  WHERE m.stream_id = p_stream_id
    AND m.is_deleted = FALSE
    AND (p_before IS NULL OR m.created_at < p_before)
  ORDER BY m.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE stream_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_chat_moderation ENABLE ROW LEVEL SECURITY;

-- Stream chat messages: Everyone can read, authenticated users can insert
CREATE POLICY stream_chat_select_policy ON stream_chat_messages
  FOR SELECT
  USING (is_deleted = FALSE);

CREATE POLICY stream_chat_insert_policy ON stream_chat_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY stream_chat_update_policy ON stream_chat_messages
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Moderation: Only moderators/hosts can insert
CREATE POLICY stream_moderation_select_policy ON stream_chat_moderation
  FOR SELECT
  USING (true);

CREATE POLICY stream_moderation_insert_policy ON stream_chat_moderation
  FOR INSERT
  WITH CHECK (auth.uid() = moderator_id);

-- ============================================================================
-- REALTIME PUBLICATION
-- ============================================================================
-- Enable realtime for stream chat
ALTER PUBLICATION supabase_realtime ADD TABLE stream_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE stream_chat_moderation;

COMMIT;
