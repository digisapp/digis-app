-- Remove unused creator_card_image column
-- This field was never implemented and adds unnecessary complexity
-- The profile_pic_url is used for all avatar displays including Creator Cards

-- Check if column exists before dropping (safe approach)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'creator_card_image'
    ) THEN
        ALTER TABLE users DROP COLUMN creator_card_image;
        RAISE NOTICE 'Column creator_card_image dropped successfully';
    ELSE
        RAISE NOTICE 'Column creator_card_image does not exist, skipping';
    END IF;
END $$;