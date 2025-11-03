-- Migration: Create Supabase-based Messaging System
-- This replaces Agora Chat with a custom solution integrated with token economy

-- ============================================================================
-- CLEAN UP OLD TABLES (if they exist)
-- ============================================================================
-- Drop old tables to start fresh (be careful in production!)
DROP TABLE IF EXISTS message_reports CASCADE;
DROP TABLE IF EXISTS message_reactions CASCADE;
DROP TABLE IF EXISTS typing_indicators CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;

-- ============================================================================
-- CONVERSATIONS TABLE
-- ============================================================================
-- Tracks conversation threads between users
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Participants (always 2 users for 1-on-1 chat)
  user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Metadata
  last_message_id UUID, -- Will reference messages(id) after messages table is created
  last_message_at TIMESTAMPTZ DEFAULT NOW(),

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique conversation between two users
  CONSTRAINT unique_conversation UNIQUE(user1_id, user2_id),
  CONSTRAINT different_users CHECK (user1_id != user2_id)
);

-- Index for fast lookups
CREATE INDEX idx_conversations_user1 ON conversations(user1_id, last_message_at DESC);
CREATE INDEX idx_conversations_user2 ON conversations(user2_id, last_message_at DESC);

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Conversation reference
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

  -- Sender/Recipient
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Content
  content TEXT, -- Text content (can be NULL for media-only messages)
  media_url TEXT, -- S3/Supabase Storage URL for images/videos
  media_type VARCHAR(50), -- 'image', 'video', 'audio', 'file'
  thumbnail_url TEXT, -- Thumbnail for videos

  -- Token Economy Integration
  tokens_spent INTEGER DEFAULT 0, -- Cost to send this message (for premium messages)
  is_premium BOOLEAN DEFAULT FALSE, -- Premium messages cost tokens
  is_unlocked BOOLEAN DEFAULT TRUE, -- For pay-to-unlock media messages
  unlock_price INTEGER DEFAULT 0, -- Tokens needed to unlock media

  -- Special Message Types
  message_type VARCHAR(50) DEFAULT 'text', -- 'text', 'tip', 'offer', 'session_request', 'media'
  metadata JSONB, -- Extra data for special messages (e.g., offer details, tip amount)

  -- Session Integration
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL, -- Link to video call session if sent during call

  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT FALSE, -- Soft delete
  deleted_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure sender/recipient match conversation participants
  CONSTRAINT sender_in_conversation CHECK (
    sender_id IN (
      SELECT user1_id FROM conversations WHERE id = conversation_id
      UNION
      SELECT user2_id FROM conversations WHERE id = conversation_id
    )
  )
);

-- Indexes for performance
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id, created_at DESC);
CREATE INDEX idx_messages_recipient ON messages(recipient_id, is_read, created_at DESC);
CREATE INDEX idx_messages_unread ON messages(recipient_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_messages_session ON messages(session_id) WHERE session_id IS NOT NULL;

-- Add foreign key to conversations.last_message_id now that messages exists
ALTER TABLE conversations
  ADD CONSTRAINT fk_last_message
  FOREIGN KEY (last_message_id)
  REFERENCES messages(id)
  ON DELETE SET NULL;

-- ============================================================================
-- TYPING INDICATORS TABLE
-- ============================================================================
-- Track who is typing in which conversation (ephemeral data)
CREATE TABLE typing_indicators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),

  -- Auto-expire after 10 seconds
  CONSTRAINT unique_typing_user UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_typing_conversation ON typing_indicators(conversation_id, started_at DESC);

-- ============================================================================
-- MESSAGE REACTIONS TABLE
-- ============================================================================
-- Allow users to react to messages with emojis
CREATE TABLE message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction VARCHAR(10) NOT NULL, -- Emoji: '❤️', '👍', '😂', etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_reaction UNIQUE(message_id, user_id, reaction)
);

CREATE INDEX idx_reactions_message ON message_reactions(message_id);

-- ============================================================================
-- MESSAGE REPORTS TABLE
-- ============================================================================
-- Allow users to report inappropriate messages
CREATE TABLE message_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason VARCHAR(100) NOT NULL, -- 'spam', 'harassment', 'inappropriate', 'other'
  details TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'reviewed', 'dismissed', 'action_taken'
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_report UNIQUE(message_id, reported_by)
);

CREATE INDEX idx_reports_status ON message_reports(status, created_at DESC);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get or create conversation between two users
CREATE OR REPLACE FUNCTION get_or_create_conversation(
  p_user1_id UUID,
  p_user2_id UUID
) RETURNS UUID AS $$
DECLARE
  v_conversation_id UUID;
  v_min_user_id UUID;
  v_max_user_id UUID;
BEGIN
  -- Normalize user order (smaller UUID first) to ensure uniqueness
  IF p_user1_id < p_user2_id THEN
    v_min_user_id := p_user1_id;
    v_max_user_id := p_user2_id;
  ELSE
    v_min_user_id := p_user2_id;
    v_max_user_id := p_user1_id;
  END IF;

  -- Try to find existing conversation
  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE (user1_id = v_min_user_id AND user2_id = v_max_user_id)
     OR (user1_id = v_max_user_id AND user2_id = v_min_user_id)
  LIMIT 1;

  -- Create if doesn't exist
  IF v_conversation_id IS NULL THEN
    INSERT INTO conversations (user1_id, user2_id)
    VALUES (v_min_user_id, v_max_user_id)
    RETURNING id INTO v_conversation_id;
  END IF;

  RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark messages as read
CREATE OR REPLACE FUNCTION mark_messages_as_read(
  p_conversation_id UUID,
  p_user_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE messages
  SET is_read = TRUE, read_at = NOW()
  WHERE conversation_id = p_conversation_id
    AND recipient_id = p_user_id
    AND is_read = FALSE
    AND is_deleted = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get unread message count for a user
CREATE OR REPLACE FUNCTION get_unread_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM messages
  WHERE recipient_id = p_user_id
    AND is_read = FALSE
    AND is_deleted = FALSE;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update conversation last_message when new message is sent
CREATE OR REPLACE FUNCTION update_conversation_on_new_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET last_message_id = NEW.id,
      last_message_at = NEW.created_at,
      updated_at = NOW()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_on_message
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_on_new_message();

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_conversations_updated_at
BEFORE UPDATE ON conversations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_messages_updated_at
BEFORE UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Auto-cleanup old typing indicators (older than 10 seconds)
CREATE OR REPLACE FUNCTION cleanup_old_typing_indicators()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM typing_indicators
  WHERE started_at < NOW() - INTERVAL '10 seconds';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_typing_indicators
AFTER INSERT ON typing_indicators
EXECUTE FUNCTION cleanup_old_typing_indicators();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reports ENABLE ROW LEVEL SECURITY;

-- Conversations: Users can only see conversations they're part of
CREATE POLICY conversations_select_policy ON conversations
  FOR SELECT
  USING (
    auth.uid() = user1_id OR auth.uid() = user2_id
  );

CREATE POLICY conversations_insert_policy ON conversations
  FOR INSERT
  WITH CHECK (
    auth.uid() = user1_id OR auth.uid() = user2_id
  );

-- Messages: Users can see messages in their conversations
CREATE POLICY messages_select_policy ON messages
  FOR SELECT
  USING (
    auth.uid() = sender_id OR auth.uid() = recipient_id
  );

CREATE POLICY messages_insert_policy ON messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
  );

CREATE POLICY messages_update_policy ON messages
  FOR UPDATE
  USING (
    auth.uid() = sender_id OR auth.uid() = recipient_id
  );

-- Typing indicators: Users can see typing status in their conversations
CREATE POLICY typing_select_policy ON typing_indicators
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE id = conversation_id
        AND (user1_id = auth.uid() OR user2_id = auth.uid())
    )
  );

CREATE POLICY typing_insert_policy ON typing_indicators
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
  );

CREATE POLICY typing_delete_policy ON typing_indicators
  FOR DELETE
  USING (
    auth.uid() = user_id
  );

-- Reactions: Users can react to messages they can see
CREATE POLICY reactions_select_policy ON message_reactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM messages
      WHERE id = message_id
        AND (sender_id = auth.uid() OR recipient_id = auth.uid())
    )
  );

CREATE POLICY reactions_insert_policy ON message_reactions
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
  );

-- Reports: Users can only see their own reports
CREATE POLICY reports_select_policy ON message_reports
  FOR SELECT
  USING (
    auth.uid() = reported_by
  );

CREATE POLICY reports_insert_policy ON message_reports
  FOR INSERT
  WITH CHECK (
    auth.uid() = reported_by
  );

-- ============================================================================
-- REALTIME PUBLICATION
-- ============================================================================
-- Enable realtime for messages, conversations, and typing indicators
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE typing_indicators;
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;

-- ============================================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================================
-- Commented out - uncomment if you want test data
/*
-- Create a test conversation
INSERT INTO conversations (user1_id, user2_id)
SELECT u1.id, u2.id
FROM users u1, users u2
WHERE u1.email = 'creator@test.com'
  AND u2.email = 'fan@test.com'
ON CONFLICT DO NOTHING;

-- Create test messages
INSERT INTO messages (conversation_id, sender_id, recipient_id, content, message_type)
SELECT
  c.id,
  c.user2_id,
  c.user1_id,
  'Hey! I love your content! 👋',
  'text'
FROM conversations c
WHERE EXISTS (
  SELECT 1 FROM users WHERE id = c.user1_id AND email = 'creator@test.com'
)
LIMIT 1;
*/

COMMIT;
