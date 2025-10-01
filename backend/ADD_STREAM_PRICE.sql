-- Add stream_price column (alias for stream_rate)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS stream_price INTEGER;

-- Copy data from stream_rate to stream_price
UPDATE users 
SET stream_price = COALESCE(stream_rate, 100)
WHERE stream_price IS NULL;

-- Verify
SELECT 'stream_price column added successfully' as status;