-- Migration: Update default token rates for all services
-- Created: 2025-08-13
-- Description: Sets default token rates for video calls, voice calls, messages, etc.

-- Update existing creators with default token rates if they haven't set custom rates
UPDATE users 
SET 
    video_price = COALESCE(video_price, 150),           -- 150 tokens per minute for video calls
    voice_price = COALESCE(voice_price, 50),            -- 50 tokens per minute for voice calls
    message_price = COALESCE(message_price, 50),        -- 50 tokens per text message
    stream_price = COALESCE(stream_price, 100),         -- 100 tokens per minute for streaming
    text_message_price = COALESCE(text_message_price, 50),     -- 50 tokens per text message
    image_message_price = COALESCE(image_message_price, 100),  -- 100 tokens per image message
    audio_message_price = COALESCE(audio_message_price, 150),  -- 150 tokens per audio message
    video_message_price = COALESCE(video_message_price, 200),  -- 200 tokens per video message
    message_price_enabled = true                               -- Enable message pricing
WHERE is_creator = true;

-- Set default rates for new creators (update column defaults)
ALTER TABLE users 
    ALTER COLUMN video_price SET DEFAULT 150,
    ALTER COLUMN voice_price SET DEFAULT 50,
    ALTER COLUMN message_price SET DEFAULT 50,
    ALTER COLUMN stream_price SET DEFAULT 100,
    ALTER COLUMN text_message_price SET DEFAULT 50,
    ALTER COLUMN image_message_price SET DEFAULT 100,
    ALTER COLUMN audio_message_price SET DEFAULT 150,
    ALTER COLUMN video_message_price SET DEFAULT 200,
    ALTER COLUMN message_price_enabled SET DEFAULT true;

-- Update creator_pricing table if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'creator_pricing') THEN
        UPDATE creator_pricing 
        SET 
            video_call_rate = COALESCE(video_call_rate, 150),
            voice_call_rate = COALESCE(voice_call_rate, 50),
            text_message_rate = COALESCE(text_message_rate, 50),
            image_message_rate = COALESCE(image_message_rate, 100),
            audio_message_rate = COALESCE(audio_message_rate, 150),
            video_message_rate = COALESCE(video_message_rate, 200),
            stream_rate = COALESCE(stream_rate, 100);
            
        -- Update defaults for creator_pricing table
        ALTER TABLE creator_pricing 
            ALTER COLUMN video_call_rate SET DEFAULT 150,
            ALTER COLUMN voice_call_rate SET DEFAULT 50,
            ALTER COLUMN text_message_rate SET DEFAULT 50,
            ALTER COLUMN image_message_rate SET DEFAULT 100,
            ALTER COLUMN audio_message_rate SET DEFAULT 150,
            ALTER COLUMN video_message_rate SET DEFAULT 200,
            ALTER COLUMN stream_rate SET DEFAULT 100;
    END IF;
END $$;

-- Add comment explaining the token economy
COMMENT ON COLUMN users.video_price IS 'Video call rate in tokens per minute (default: 150)';
COMMENT ON COLUMN users.voice_price IS 'Voice call rate in tokens per minute (default: 50)';
COMMENT ON COLUMN users.message_price IS 'Text message rate in tokens per message (default: 50)';
COMMENT ON COLUMN users.stream_price IS 'Live stream rate in tokens per minute (default: 100)';
COMMENT ON COLUMN users.text_message_price IS 'Text message rate in tokens (default: 50)';
COMMENT ON COLUMN users.image_message_price IS 'Image message rate in tokens (default: 100)';
COMMENT ON COLUMN users.audio_message_price IS 'Audio message rate in tokens (default: 150)';
COMMENT ON COLUMN users.video_message_price IS 'Video message rate in tokens (default: 200)';