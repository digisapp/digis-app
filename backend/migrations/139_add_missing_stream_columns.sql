-- Add missing columns to streams table
ALTER TABLE streams 
ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS inactive_warning_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_end_warning_sent BOOLEAN DEFAULT FALSE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_streams_is_live ON streams(is_live) WHERE is_live = true;
CREATE INDEX IF NOT EXISTS idx_streams_last_activity ON streams(last_activity_at DESC);

-- Update existing streams to set is_live based on status
UPDATE streams 
SET is_live = CASE 
  WHEN status = 'live' THEN true 
  ELSE false 
END
WHERE is_live IS NULL;

-- Add comments
COMMENT ON COLUMN streams.is_live IS 'Whether the stream is currently live';
COMMENT ON COLUMN streams.last_activity_at IS 'Last time there was activity in the stream';
COMMENT ON COLUMN streams.inactive_warning_sent IS 'Whether inactivity warning has been sent';
COMMENT ON COLUMN streams.auto_end_warning_sent IS 'Whether auto-end warning has been sent';