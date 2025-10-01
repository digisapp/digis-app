-- Add missing pricing columns to users table
-- These columns are required by migration 128

-- Add video_price column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'video_price') THEN
        ALTER TABLE users ADD COLUMN video_price DECIMAL(10,2) DEFAULT 150;
    END IF;
END $$;

-- Add voice_price column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'voice_price') THEN
        ALTER TABLE users ADD COLUMN voice_price DECIMAL(10,2) DEFAULT 50;
    END IF;
END $$;

-- Add message_price column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'message_price') THEN
        ALTER TABLE users ADD COLUMN message_price DECIMAL(10,2) DEFAULT 50;
    END IF;
END $$;

-- Add stream_price column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'stream_price') THEN
        ALTER TABLE users ADD COLUMN stream_price DECIMAL(10,2) DEFAULT 100;
    END IF;
END $$;

-- Add text_message_price column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'text_message_price') THEN
        ALTER TABLE users ADD COLUMN text_message_price DECIMAL(10,2) DEFAULT 50;
    END IF;
END $$;

-- Add image_message_price column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'image_message_price') THEN
        ALTER TABLE users ADD COLUMN image_message_price DECIMAL(10,2) DEFAULT 100;
    END IF;
END $$;

-- Add audio_message_price column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'audio_message_price') THEN
        ALTER TABLE users ADD COLUMN audio_message_price DECIMAL(10,2) DEFAULT 150;
    END IF;
END $$;

-- Add video_message_price column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'video_message_price') THEN
        ALTER TABLE users ADD COLUMN video_message_price DECIMAL(10,2) DEFAULT 200;
    END IF;
END $$;

-- Add message_price_enabled column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'message_price_enabled') THEN
        ALTER TABLE users ADD COLUMN message_price_enabled BOOLEAN DEFAULT true;
    END IF;
END $$;