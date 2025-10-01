-- Check what columns exist in the streams table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'streams' 
ORDER BY ordinal_position;