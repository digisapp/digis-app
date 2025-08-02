-- Migration: Create call requests and related tables
-- Created: 2025-07-23

-- Call requests table for creator-to-creator calls
CREATE TABLE IF NOT EXISTS call_requests (
    id SERIAL PRIMARY KEY,
    caller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    target_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    call_type VARCHAR(20) NOT NULL CHECK (call_type IN ('video', 'voice')),
    message TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    created_at TIMESTAMP DEFAULT NOW(),
    responded_at TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '5 minutes')
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_call_requests_caller_id ON call_requests(caller_id);
CREATE INDEX IF NOT EXISTS idx_call_requests_target_id ON call_requests(target_id);
CREATE INDEX IF NOT EXISTS idx_call_requests_status ON call_requests(status);
CREATE INDEX IF NOT EXISTS idx_call_requests_created_at ON call_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_call_requests_expires_at ON call_requests(expires_at);

-- Add availability_status and last_seen_at columns to users table if they don't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS availability_status VARCHAR(20) DEFAULT 'offline' 
CHECK (availability_status IN ('online', 'offline', 'busy', 'away'));

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP DEFAULT NOW();

-- Add display_name column if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);

-- Create indexes for the new user columns
CREATE INDEX IF NOT EXISTS idx_users_availability_status ON users(availability_status);
CREATE INDEX IF NOT EXISTS idx_users_last_seen_at ON users(last_seen_at);

-- Insert migration record
INSERT INTO migrations (version, name, executed_at) 
VALUES (4, '004_create_call_requests', NOW())
ON CONFLICT (version) DO NOTHING;