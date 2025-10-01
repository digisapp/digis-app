-- Fix analytics_events table by adding missing created_at column
ALTER TABLE analytics_events 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at 
ON analytics_events(created_at DESC);

-- Update any existing rows to have created_at if needed
UPDATE analytics_events 
SET created_at = COALESCE(timestamp, NOW()) 
WHERE created_at IS NULL;