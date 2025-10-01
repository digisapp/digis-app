-- ============================================
-- ADD MESSAGE PRICING COLUMNS
-- Run this in your Supabase SQL Editor
-- ============================================

-- Add message price columns to users table if they don't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS text_message_price INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS image_message_price INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS audio_message_price INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS video_message_price INTEGER DEFAULT 5;

-- Add comments for clarity
COMMENT ON COLUMN users.text_message_price IS 'Price in tokens for text messages';
COMMENT ON COLUMN users.image_message_price IS 'Price in tokens for image messages';
COMMENT ON COLUMN users.audio_message_price IS 'Price in tokens for audio messages';
COMMENT ON COLUMN users.video_message_price IS 'Price in tokens for video messages';

-- Update existing creators with default values if NULL
UPDATE users 
SET 
  text_message_price = COALESCE(text_message_price, 1),
  image_message_price = COALESCE(image_message_price, 2),
  audio_message_price = COALESCE(audio_message_price, 3),
  video_message_price = COALESCE(video_message_price, 5)
WHERE is_creator = true;

-- Verify the columns were added
SELECT 
  username,
  is_creator,
  video_price,
  voice_price,
  text_message_price,
  image_message_price,
  audio_message_price,
  video_message_price
FROM users 
WHERE is_creator = true
LIMIT 5;