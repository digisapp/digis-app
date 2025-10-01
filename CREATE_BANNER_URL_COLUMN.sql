-- Safe migration to add banner_url column to users table
-- This handles the case where the column doesn't exist yet

-- First, check if banner_url column exists, if not create it
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN users.banner_url IS 'URL to creator''s profile banner image (1600x400 recommended)';

-- If you have any existing data in banner_pic_url or banner_image_url columns, 
-- uncomment and run the appropriate line below:
-- UPDATE users SET banner_url = banner_pic_url WHERE banner_pic_url IS NOT NULL;
-- UPDATE users SET banner_url = banner_image_url WHERE banner_image_url IS NOT NULL;

-- After migration, you can drop the old column if it exists:
-- ALTER TABLE users DROP COLUMN IF EXISTS banner_pic_url;
-- ALTER TABLE users DROP COLUMN IF EXISTS banner_image_url;