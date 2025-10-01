-- Check if follows table exists and has the right columns
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'follows'
ORDER BY ordinal_position;

-- If no results, the table doesn't exist or has different columns
-- Let's also check the followers table
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'followers'
ORDER BY ordinal_position;

-- Quick fix: Add user_id column to follows table if it exists
ALTER TABLE follows 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE;

-- If follower_id exists, copy it to user_id
DO $$ 
BEGIN 
    IF EXISTS (SELECT FROM information_schema.columns 
               WHERE table_name = 'follows' AND column_name = 'follower_id') THEN
        UPDATE follows SET user_id = follower_id WHERE user_id IS NULL;
    END IF;
END $$;