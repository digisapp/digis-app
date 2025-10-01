-- Fix analytics_events table by adding missing created_at column
-- This fixes the error: "Could not find the 'created_at' column of 'analytics_events' in the schema cache"

-- Add created_at column if it doesn't exist
ALTER TABLE analytics_events 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Ensure the column has proper index for performance
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at 
ON analytics_events(created_at DESC);

-- Update any existing rows that might have NULL created_at
UPDATE analytics_events 
SET created_at = NOW() 
WHERE created_at IS NULL;

-- Verify the fix
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'analytics_events' 
    AND column_name = 'created_at';