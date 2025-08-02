-- Migration: Call requests system
-- Description: Add tables for call requests and notifications

-- Call requests table
CREATE TABLE IF NOT EXISTS call_requests (
    id VARCHAR(255) PRIMARY KEY,
    fan_id VARCHAR(255) NOT NULL REFERENCES users(firebase_uid),
    creator_id VARCHAR(255) NOT NULL REFERENCES users(firebase_uid),
    session_type VARCHAR(20) NOT NULL CHECK (session_type IN ('video', 'voice')),
    fan_username VARCHAR(255),
    fan_profile_pic_url TEXT,
    fan_bio TEXT,
    estimated_duration INTEGER DEFAULT 10,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    channel_name VARCHAR(255),
    session_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '5 minutes'
);

-- Notifications table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(firebase_uid),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_call_requests_creator_status ON call_requests(creator_id, status);
CREATE INDEX IF NOT EXISTS idx_call_requests_fan ON call_requests(fan_id);
CREATE INDEX IF NOT EXISTS idx_call_requests_created ON call_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_call_requests_expires ON call_requests(expires_at);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- Add a function to automatically expire old call requests
CREATE OR REPLACE FUNCTION expire_old_call_requests()
RETURNS void AS $$
BEGIN
    UPDATE call_requests 
    SET status = 'expired' 
    WHERE status = 'pending' 
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run this function (if using pg_cron extension)
-- SELECT cron.schedule('expire-call-requests', '* * * * *', 'SELECT expire_old_call_requests();');