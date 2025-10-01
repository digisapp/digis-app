-- Add banner image and next stream time columns to users table
-- These fields support the new ProfileBanner component

-- Add banner_image_url column for creator profile banners
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS banner_image_url TEXT,
ADD COLUMN IF NOT EXISTS next_stream_time TIMESTAMP WITH TIME ZONE;

-- Add index for next_stream_time for efficient queries
CREATE INDEX IF NOT EXISTS idx_users_next_stream_time 
ON users(next_stream_time) 
WHERE next_stream_time IS NOT NULL;

-- Add default banner images for existing creators
UPDATE users 
SET banner_image_url = CASE 
  WHEN creator_type = 'Gaming' THEN 'https://source.unsplash.com/1600x400/?gaming,esports'
  WHEN creator_type = 'Music' THEN 'https://source.unsplash.com/1600x400/?music,concert'
  WHEN creator_type = 'Art' THEN 'https://source.unsplash.com/1600x400/?art,creative'
  WHEN creator_type = 'Fitness' THEN 'https://source.unsplash.com/1600x400/?fitness,workout'
  WHEN creator_type = 'Education' THEN 'https://source.unsplash.com/1600x400/?education,learning'
  WHEN creator_type = 'Cooking' THEN 'https://source.unsplash.com/1600x400/?cooking,food'
  ELSE 'https://source.unsplash.com/1600x400/?abstract,gradient'
END
WHERE is_creator = true AND banner_image_url IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.banner_image_url IS 'URL to creator''s profile banner image (1600x400 recommended)';
COMMENT ON COLUMN users.next_stream_time IS 'Scheduled time for creator''s next stream';