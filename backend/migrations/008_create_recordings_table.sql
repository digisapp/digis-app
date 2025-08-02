-- Create recordings table for cloud recording management
CREATE TABLE IF NOT EXISTS recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL UNIQUE,
  channel VARCHAR(255) NOT NULL,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_id VARCHAR(255) NOT NULL,
  sid VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'recording',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  stopped_at TIMESTAMP WITH TIME ZONE,
  duration INTEGER,
  file_url TEXT,
  thumbnail_url TEXT,
  file_size BIGINT,
  storage_config JSONB,
  server_response JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_recordings_creator_id ON recordings(creator_id);
CREATE INDEX idx_recordings_channel ON recordings(channel);
CREATE INDEX idx_recordings_status ON recordings(status);
CREATE INDEX idx_recordings_started_at ON recordings(started_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_recordings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_recordings_updated_at_trigger
BEFORE UPDATE ON recordings
FOR EACH ROW
EXECUTE FUNCTION update_recordings_updated_at();

-- Add comments for documentation
COMMENT ON TABLE recordings IS 'Stores cloud recording information for sessions';
COMMENT ON COLUMN recordings.session_id IS 'Unique identifier for the recording session';
COMMENT ON COLUMN recordings.channel IS 'Agora channel name';
COMMENT ON COLUMN recordings.creator_id IS 'ID of the creator who initiated the recording';
COMMENT ON COLUMN recordings.resource_id IS 'Agora cloud recording resource ID';
COMMENT ON COLUMN recordings.sid IS 'Agora cloud recording session ID';
COMMENT ON COLUMN recordings.status IS 'Recording status: recording, completed, failed';
COMMENT ON COLUMN recordings.file_url IS 'URL to access the recorded file';
COMMENT ON COLUMN recordings.storage_config IS 'Cloud storage configuration used';
COMMENT ON COLUMN recordings.server_response IS 'Full response from Agora server';