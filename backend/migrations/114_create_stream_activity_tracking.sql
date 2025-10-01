-- Migration: Create stream activity tracking tables
-- Description: Track stream activity to auto-end inactive streams

-- Add activity tracking columns to streams table
ALTER TABLE streams 
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_fan_interaction_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS viewer_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_end_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_end_minutes INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS warning_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS auto_ended BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_end_reason VARCHAR(255);

-- Create stream activity log table
CREATE TABLE IF NOT EXISTS stream_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL, -- 'fan_joined', 'fan_left', 'chat_message', 'gift_sent', 'creator_action'
    fan_id UUID REFERENCES users(id) ON DELETE SET NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for efficient activity queries
CREATE INDEX IF NOT EXISTS idx_stream_activity_stream_id_created ON stream_activity_log(stream_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_streams_last_activity ON streams(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_streams_auto_end ON streams(status, auto_end_enabled, last_fan_interaction_at);

-- Create function to update stream activity
CREATE OR REPLACE FUNCTION update_stream_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the stream's last activity timestamp
    UPDATE streams 
    SET last_activity_at = CURRENT_TIMESTAMP,
        last_fan_interaction_at = CASE 
            WHEN NEW.activity_type IN ('fan_joined', 'chat_message', 'gift_sent') 
            THEN CURRENT_TIMESTAMP 
            ELSE last_fan_interaction_at 
        END
    WHERE id = NEW.stream_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for activity updates
DROP TRIGGER IF EXISTS trigger_update_stream_activity ON stream_activity_log;
CREATE TRIGGER trigger_update_stream_activity
AFTER INSERT ON stream_activity_log
FOR EACH ROW
EXECUTE FUNCTION update_stream_activity();

-- Add creator preferences for auto-end
ALTER TABLE creators
ADD COLUMN IF NOT EXISTS stream_auto_end_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS stream_auto_end_minutes INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS stream_warning_minutes INTEGER DEFAULT 5;