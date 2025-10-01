-- Add VOD pricing to stream_recordings table
ALTER TABLE stream_recordings 
ADD COLUMN IF NOT EXISTS price_in_tokens INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- Create VOD purchases table
CREATE TABLE IF NOT EXISTS vod_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  recording_id UUID NOT NULL,
  tokens_paid INTEGER NOT NULL,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '48 hours'), -- 48 hour rental period
  watch_count INTEGER DEFAULT 0,
  last_watched_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, recording_id)
);

-- Create indexes for VOD purchases
CREATE INDEX IF NOT EXISTS idx_vod_purchases_user_id ON vod_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_vod_purchases_recording_id ON vod_purchases(recording_id);
CREATE INDEX IF NOT EXISTS idx_vod_purchases_expires_at ON vod_purchases(expires_at);
CREATE INDEX IF NOT EXISTS idx_vod_purchases_purchased_at ON vod_purchases(purchased_at);

-- Add VOD revenue tracking to creator_earnings
ALTER TABLE creator_earnings
ADD COLUMN IF NOT EXISTS vod_earnings DECIMAL(10, 2) DEFAULT 0;

-- Create function to check VOD access
CREATE OR REPLACE FUNCTION check_vod_access(p_user_id UUID, p_recording_id UUID)
RETURNS TABLE(
  has_access BOOLEAN,
  is_purchased BOOLEAN,
  is_expired BOOLEAN,
  expires_at TIMESTAMP WITH TIME ZONE,
  price_in_tokens INTEGER
) AS $$
DECLARE
  v_expires_at TIMESTAMP WITH TIME ZONE;
  v_is_valid BOOLEAN;
  v_price INTEGER;
  v_is_free BOOLEAN;
BEGIN
  -- Check purchase
  SELECT vp.expires_at, vp.expires_at > NOW()
  INTO v_expires_at, v_is_valid
  FROM vod_purchases vp
  WHERE vp.user_id = p_user_id 
    AND vp.recording_id = p_recording_id
  LIMIT 1;
  
  -- Get recording info
  SELECT sr.price_in_tokens, sr.is_free
  INTO v_price, v_is_free
  FROM stream_recordings sr
  WHERE sr.id = p_recording_id
  LIMIT 1;
  
  -- Return results
  RETURN QUERY SELECT
    COALESCE(v_is_valid, v_is_free, false) as has_access,
    v_expires_at IS NOT NULL as is_purchased,
    CASE WHEN v_expires_at IS NOT NULL THEN NOT v_is_valid ELSE false END as is_expired,
    v_expires_at as expires_at,
    COALESCE(v_price, 50) as price_in_tokens;
END;
$$ LANGUAGE plpgsql;

-- Update stream_recordings to set default pricing for existing recordings
UPDATE stream_recordings 
SET price_in_tokens = 50 
WHERE price_in_tokens IS NULL;

-- Add comment
COMMENT ON TABLE vod_purchases IS 'Tracks pay-per-view purchases for VOD content (replays)';
COMMENT ON COLUMN vod_purchases.expires_at IS '48-hour rental period for VOD access';
COMMENT ON COLUMN stream_recordings.price_in_tokens IS 'Price to watch this VOD replay';
COMMENT ON COLUMN stream_recordings.is_free IS 'Whether this VOD is free to watch (promotional content)';