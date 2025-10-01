-- Add supabase_id column to users table if it doesn't exist
DO $$ 
BEGIN
    -- Check if supabase_id column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'supabase_id'
    ) THEN
        -- Add the column
        ALTER TABLE users ADD COLUMN supabase_id UUID;
        
        -- Update existing records to use the id as supabase_id
        UPDATE users SET supabase_id = id WHERE supabase_id IS NULL;
        
        -- Make it NOT NULL after populating
        ALTER TABLE users ALTER COLUMN supabase_id SET NOT NULL;
        
        -- Add unique constraint
        ALTER TABLE users ADD CONSTRAINT users_supabase_id_unique UNIQUE (supabase_id);
        
        -- Create index for performance
        CREATE INDEX idx_users_supabase_id ON users(supabase_id);
        
        RAISE NOTICE 'supabase_id column added successfully';
    ELSE
        RAISE NOTICE 'supabase_id column already exists';
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'supabase_id';