-- CRITICAL DATABASE FIXES FOR PRODUCTION
-- Run this in Supabase SQL Editor

-- 1. Create missing session_metrics table
CREATE TABLE IF NOT EXISTS session_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(supabase_id),
  creator_id UUID REFERENCES users(supabase_id),
  session_type VARCHAR(50) NOT NULL CHECK (session_type IN ('video_call', 'voice_call', 'stream', 'chat')),
  
  -- Quality metrics
  quality_score DECIMAL(3,2) CHECK (quality_score >= 0 AND quality_score <= 5),
  connection_quality VARCHAR(20) CHECK (connection_quality IN ('excellent', 'good', 'fair', 'poor')),
  video_resolution VARCHAR(20),
  audio_quality VARCHAR(20) CHECK (audio_quality IN ('excellent', 'good', 'fair', 'poor')),
  
  -- Performance metrics
  latency_ms INTEGER,
  packet_loss_percentage DECIMAL(5,2),
  jitter_ms INTEGER,
  bandwidth_kbps INTEGER,
  
  -- User experience metrics
  user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
  user_feedback TEXT,
  technical_issues JSONB DEFAULT '[]',
  
  -- Timing
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for session_metrics
CREATE INDEX IF NOT EXISTS idx_session_metrics_session_id ON session_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_session_metrics_user_id ON session_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_session_metrics_creator_id ON session_metrics(creator_id);
CREATE INDEX IF NOT EXISTS idx_session_metrics_session_type ON session_metrics(session_type);
CREATE INDEX IF NOT EXISTS idx_session_metrics_recorded_at ON session_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_metrics_quality_score ON session_metrics(quality_score);

-- 2. Add missing columns to streams table
ALTER TABLE streams 
ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS inactive_warning_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_end_warning_sent BOOLEAN DEFAULT FALSE;

-- Indexes for streams
CREATE INDEX IF NOT EXISTS idx_streams_is_live ON streams(is_live) WHERE is_live = true;
CREATE INDEX IF NOT EXISTS idx_streams_last_activity ON streams(last_activity_at DESC);

-- Update existing streams
UPDATE streams 
SET is_live = CASE 
  WHEN status = 'live' THEN true 
  ELSE false 
END
WHERE is_live IS NULL;

-- 3. Add interests field to users table (for creator categories)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS interests TEXT[] DEFAULT '{}' 
CHECK (array_length(interests, 1) <= 5 OR interests = '{}');

-- Index for interests
CREATE INDEX IF NOT EXISTS idx_users_interests ON users USING GIN (interests);

-- 4. Add missing columns that might be needed
ALTER TABLE users
ADD COLUMN IF NOT EXISTS specialties TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS what_i_offer TEXT,
ADD COLUMN IF NOT EXISTS availability TEXT;

-- 5. Fix creator_notification_preferences table if needed
CREATE TABLE IF NOT EXISTS creator_notification_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fan_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
  creator_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
  notifications_enabled BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT false,
  notification_types JSONB DEFAULT '{"new_content": true, "live_stream": true, "messages": true, "promotions": true}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(fan_id, creator_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_creator_notification_preferences_fan_id ON creator_notification_preferences(fan_id);
CREATE INDEX IF NOT EXISTS idx_creator_notification_preferences_creator_id ON creator_notification_preferences(creator_id);

-- Comments
COMMENT ON TABLE session_metrics IS 'Tracks quality and performance metrics for all types of sessions';
COMMENT ON COLUMN streams.is_live IS 'Whether the stream is currently live';
COMMENT ON COLUMN users.interests IS 'Creator interests/categories for discovery (max 5)';
COMMENT ON COLUMN users.what_i_offer IS 'Creator description of services offered';
COMMENT ON COLUMN users.availability IS 'Creator availability schedule text';

-- Grant permissions if needed (adjust based on your Supabase setup)
GRANT ALL ON session_metrics TO authenticated;
GRANT ALL ON creator_notification_preferences TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'All critical database fixes have been applied successfully!';
END $$;