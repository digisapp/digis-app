-- Migration to rename banner_pic_url to banner_url for cleaner naming
-- This makes the field name more professional and consistent

-- Rename the column if it exists
ALTER TABLE users 
RENAME COLUMN banner_pic_url TO banner_url;

-- Update the comment for documentation
COMMENT ON COLUMN users.banner_url IS 'URL to creator''s profile banner image (1600x400 recommended)';

-- If the column doesn't exist yet, create it with the new name
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'banner_url'
  ) THEN
    ALTER TABLE users ADD COLUMN banner_url TEXT;
    COMMENT ON COLUMN users.banner_url IS 'URL to creator''s profile banner image (1600x400 recommended)';
  END IF;
END $$;