-- Create session_metrics table for tracking session quality and performance
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_session_metrics_session_id ON session_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_session_metrics_user_id ON session_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_session_metrics_creator_id ON session_metrics(creator_id);
CREATE INDEX IF NOT EXISTS idx_session_metrics_session_type ON session_metrics(session_type);
CREATE INDEX IF NOT EXISTS idx_session_metrics_recorded_at ON session_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_metrics_quality_score ON session_metrics(quality_score);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_session_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_session_metrics_updated_at_trigger
BEFORE UPDATE ON session_metrics
FOR EACH ROW
EXECUTE FUNCTION update_session_metrics_updated_at();

-- Comments for clarity
COMMENT ON TABLE session_metrics IS 'Tracks quality and performance metrics for all types of sessions';
COMMENT ON COLUMN session_metrics.quality_score IS 'Overall quality score from 0-5';
COMMENT ON COLUMN session_metrics.technical_issues IS 'JSON array of technical issues encountered';