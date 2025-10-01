-- Create tables for stream chat and features

-- Stream messages table
CREATE TABLE IF NOT EXISTS stream_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
  display_name VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  reply_to UUID REFERENCES stream_messages(id),
  is_pinned BOOLEAN DEFAULT false,
  deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  INDEX idx_stream_messages_channel (channel),
  INDEX idx_stream_messages_created (created_at DESC)
);

-- Stream moderation table
CREATE TABLE IF NOT EXISTS stream_moderation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
  moderator_id UUID REFERENCES users(supabase_id),
  action VARCHAR(50) NOT NULL CHECK (action IN ('ban', 'timeout', 'unban')),
  reason TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  INDEX idx_moderation_channel (channel),
  INDEX idx_moderation_user (user_id)
);

-- Stream polls table
CREATE TABLE IF NOT EXISTS stream_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel VARCHAR(255) NOT NULL,
  creator_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSON NOT NULL,
  duration INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  INDEX idx_polls_channel (channel),
  INDEX idx_polls_active (is_active)
);

-- Poll votes table
CREATE TABLE IF NOT EXISTS poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES stream_polls(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE KEY unique_poll_vote (poll_id, user_id),
  INDEX idx_votes_poll (poll_id)
);

-- Gift transactions table
CREATE TABLE IF NOT EXISTS gift_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
  channel VARCHAR(255) NOT NULL,
  gift_type VARCHAR(50) NOT NULL,
  quantity INTEGER DEFAULT 1,
  tokens_spent INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  INDEX idx_gifts_channel (channel),
  INDEX idx_gifts_recipient (recipient_id),
  INDEX idx_gifts_created (created_at DESC)
);

-- Tip transactions table
CREATE TABLE IF NOT EXISTS tip_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
  channel VARCHAR(255) NOT NULL,
  amount INTEGER NOT NULL,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  INDEX idx_tips_channel (channel),
  INDEX idx_tips_recipient (recipient_id),
  INDEX idx_tips_created (created_at DESC)
);

-- Stream analytics table
CREATE TABLE IF NOT EXISTS stream_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel VARCHAR(255) NOT NULL UNIQUE,
  viewer_count INTEGER DEFAULT 0,
  peak_viewers INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  gifts_received INTEGER DEFAULT 0,
  gift_revenue INTEGER DEFAULT 0,
  tips_received INTEGER DEFAULT 0,
  tip_revenue INTEGER DEFAULT 0,
  new_followers INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  INDEX idx_analytics_channel (channel)
);

-- Add streams table if not exists
CREATE TABLE IF NOT EXISTS streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel VARCHAR(255) NOT NULL UNIQUE,
  creator_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
  title VARCHAR(255),
  description TEXT,
  is_live BOOLEAN DEFAULT false,
  is_recording BOOLEAN DEFAULT false,
  recording_id VARCHAR(255),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  INDEX idx_streams_creator (creator_id),
  INDEX idx_streams_live (is_live)
);

-- Create function to update analytics
CREATE OR REPLACE FUNCTION update_stream_analytics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update message count
  IF TG_TABLE_NAME = 'stream_messages' AND TG_OP = 'INSERT' THEN
    UPDATE stream_analytics 
    SET messages_sent = messages_sent + 1,
        updated_at = NOW()
    WHERE channel = NEW.channel;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_analytics_on_message
AFTER INSERT ON stream_messages
FOR EACH ROW
EXECUTE FUNCTION update_stream_analytics();

-- Enable RLS
ALTER TABLE stream_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_moderation ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tip_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view stream messages" ON stream_messages
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own messages" ON stream_messages
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view polls" ON stream_polls
  FOR SELECT USING (true);

CREATE POLICY "Users can vote on polls" ON poll_votes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their transactions" ON gift_transactions
  FOR SELECT USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "Users can view their tips" ON tip_transactions
  FOR SELECT USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "Creators can view their analytics" ON stream_analytics
  FOR SELECT USING (
    channel IN (
      SELECT channel FROM streams WHERE creator_id = auth.uid()
    )
  );