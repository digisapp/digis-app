-- Create stream_recordings table for saved live stream recordings
CREATE TABLE IF NOT EXISTS stream_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id VARCHAR(255),
  creator_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  resolution TEXT DEFAULT '1440p', -- 2K default resolution
  duration INTEGER,
  size BIGINT,
  is_public BOOLEAN DEFAULT false,
  access_type VARCHAR(20) DEFAULT 'free' CHECK (access_type IN ('free', 'paid')),
  price DECIMAL(10,2) DEFAULT 0.00,
  token_price INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  purchase_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  recording_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create purchases table for recording purchases
CREATE TABLE IF NOT EXISTS recording_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
  recording_id UUID REFERENCES stream_recordings(id) ON DELETE CASCADE,
  price DECIMAL(10,2),
  token_price INTEGER,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, recording_id)
);

-- Create indexes for performance
CREATE INDEX idx_stream_recordings_creator_id ON stream_recordings(creator_id);
CREATE INDEX idx_stream_recordings_stream_id ON stream_recordings(stream_id);
CREATE INDEX idx_stream_recordings_is_public ON stream_recordings(is_public);
CREATE INDEX idx_stream_recordings_access_type ON stream_recordings(access_type);
CREATE INDEX idx_stream_recordings_created_at ON stream_recordings(created_at DESC);

CREATE INDEX idx_recording_purchases_user_id ON recording_purchases(user_id);
CREATE INDEX idx_recording_purchases_recording_id ON recording_purchases(recording_id);
CREATE INDEX idx_recording_purchases_purchased_at ON recording_purchases(purchased_at DESC);

-- Enable RLS
ALTER TABLE stream_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE recording_purchases ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stream_recordings
CREATE POLICY "Creators can view own recordings" ON stream_recordings
  FOR SELECT USING (creator_id = auth.uid() OR is_public = true);

CREATE POLICY "Creators can insert own recordings" ON stream_recordings
  FOR INSERT WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Creators can update own recordings" ON stream_recordings
  FOR UPDATE USING (creator_id = auth.uid());

CREATE POLICY "Creators can delete own recordings" ON stream_recordings
  FOR DELETE USING (creator_id = auth.uid());

-- RLS Policies for recording_purchases
CREATE POLICY "Users can view own purchases" ON recording_purchases
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can create purchases" ON recording_purchases
  FOR INSERT WITH CHECK (true);

-- Function to check if user has purchased recording
CREATE OR REPLACE FUNCTION has_purchased_recording(p_user_id UUID, p_recording_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM recording_purchases 
    WHERE user_id = p_user_id AND recording_id = p_recording_id
  );
END;
$$ LANGUAGE plpgsql;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_stream_recordings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stream_recordings_updated_at_trigger
BEFORE UPDATE ON stream_recordings
FOR EACH ROW
EXECUTE FUNCTION update_stream_recordings_updated_at();

-- Comments for documentation
COMMENT ON TABLE stream_recordings IS 'Stores saved live stream recordings with monetization options';
COMMENT ON TABLE recording_purchases IS 'Tracks user purchases of paid stream recordings';
COMMENT ON COLUMN stream_recordings.access_type IS 'Access type: free or paid';
COMMENT ON COLUMN stream_recordings.token_price IS 'Price in tokens for paid access';
COMMENT ON COLUMN stream_recordings.resolution IS 'Recording resolution (1440p/2K default, 1080p, 720p, etc)';