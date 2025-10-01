-- Add mentions support to stream messages table
-- This migration adds a mentions column to store @username mentions in chat

-- Add mentions column to stream_messages table
ALTER TABLE stream_messages 
ADD COLUMN IF NOT EXISTS mentions JSONB DEFAULT '[]'::jsonb;

-- Add index for faster mention queries
CREATE INDEX IF NOT EXISTS idx_stream_messages_mentions 
ON stream_messages USING gin(mentions);

-- Add comment
COMMENT ON COLUMN stream_messages.mentions IS 'Array of usernames mentioned in this message';

-- Create a function to extract mentions from message text (for existing messages)
CREATE OR REPLACE FUNCTION extract_mentions_from_text(message_text TEXT)
RETURNS JSONB AS $$
DECLARE
    mentions_array TEXT[];
    mention_match TEXT;
BEGIN
    -- Extract all @username patterns from the message
    mentions_array := ARRAY(
        SELECT DISTINCT substring(match FROM 2)
        FROM regexp_split_to_table(message_text, '\s+') AS match
        WHERE match ~ '^@[a-zA-Z0-9_]+$'
    );
    
    RETURN to_jsonb(mentions_array);
END;
$$ LANGUAGE plpgsql;

-- Optional: Update existing messages to extract mentions
-- This is commented out by default to avoid processing large amounts of data
-- Uncomment if you want to retroactively extract mentions from existing messages
/*
UPDATE stream_messages 
SET mentions = extract_mentions_from_text(message)
WHERE message LIKE '%@%'
  AND (mentions IS NULL OR mentions = '[]'::jsonb);
*/

-- Add a trigger to validate mentions (ensure mentioned users exist)
CREATE OR REPLACE FUNCTION validate_mentions()
RETURNS TRIGGER AS $$
DECLARE
    mention TEXT;
    user_exists BOOLEAN;
BEGIN
    -- Only validate if mentions are provided
    IF NEW.mentions IS NOT NULL AND jsonb_array_length(NEW.mentions) > 0 THEN
        -- Check each mentioned username
        FOR mention IN SELECT jsonb_array_elements_text(NEW.mentions)
        LOOP
            SELECT EXISTS(
                SELECT 1 FROM users WHERE username = mention
            ) INTO user_exists;
            
            -- We don't fail if user doesn't exist, just log it
            -- This allows for flexibility in case users are deleted
            IF NOT user_exists THEN
                RAISE NOTICE 'Mentioned user % does not exist', mention;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for mention validation
DROP TRIGGER IF EXISTS validate_mentions_trigger ON stream_messages;
CREATE TRIGGER validate_mentions_trigger
    BEFORE INSERT OR UPDATE ON stream_messages
    FOR EACH ROW
    EXECUTE FUNCTION validate_mentions();

-- Create a view for messages with mention details
CREATE OR REPLACE VIEW stream_messages_with_mentions AS
SELECT 
    sm.*,
    CASE 
        WHEN jsonb_array_length(sm.mentions) > 0 THEN
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'username', u.username,
                    'display_name', u.display_name,
                    'profile_pic_url', u.profile_pic_url,
                    'is_creator', u.is_creator
                )
            )
            FROM users u
            WHERE u.username = ANY(
                SELECT jsonb_array_elements_text(sm.mentions)
            ))
        ELSE '[]'::jsonb
    END as mentioned_users
FROM stream_messages sm;

-- Grant permissions
GRANT SELECT ON stream_messages_with_mentions TO authenticated;
GRANT SELECT ON stream_messages_with_mentions TO anon;