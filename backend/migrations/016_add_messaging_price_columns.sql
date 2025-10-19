-- Add missing messaging price columns to users table

-- Add text_message_price if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'text_message_price'
  ) THEN
    ALTER TABLE users ADD COLUMN text_message_price DECIMAL(10,2) DEFAULT 1.00;
  END IF;
END $$;

-- Add image_message_price if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'image_message_price'
  ) THEN
    ALTER TABLE users ADD COLUMN image_message_price DECIMAL(10,2) DEFAULT 3.00;
  END IF;
END $$;

-- Add video_message_price if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'video_message_price'
  ) THEN
    ALTER TABLE users ADD COLUMN video_message_price DECIMAL(10,2) DEFAULT 5.00;
  END IF;
END $$;

-- Add voice_memo_price if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'voice_memo_price'
  ) THEN
    ALTER TABLE users ADD COLUMN voice_memo_price DECIMAL(10,2) DEFAULT 2.00;
  END IF;
END $$;

-- Add helpful comment
COMMENT ON COLUMN users.text_message_price IS 'Price in tokens for text messages';
COMMENT ON COLUMN users.image_message_price IS 'Price in tokens for image messages';
COMMENT ON COLUMN users.video_message_price IS 'Price in tokens for video messages';
COMMENT ON COLUMN users.voice_memo_price IS 'Price in tokens for voice memos';
