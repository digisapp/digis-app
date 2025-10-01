-- ================================================
-- ADDITIONAL USER COLUMNS UPDATE
-- Run this AFTER the main migration script
-- ================================================

-- Add missing columns to users table that are referenced in migration 131
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS creator_card_image TEXT,
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"emailNotifications": true, "pushNotifications": true, "messageAlerts": true, "streamAlerts": true}'::jsonb,
ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT '{"profileVisibility": "public", "messagePrivacy": "everyone", "showOnlineStatus": true}'::jsonb,
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT[],
ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en',
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/New_York',
ADD COLUMN IF NOT EXISTS availability_schedule JSONB DEFAULT '{
  "monday": {"available": true, "start": "09:00", "end": "17:00"},
  "tuesday": {"available": true, "start": "09:00", "end": "17:00"},
  "wednesday": {"available": true, "start": "09:00", "end": "17:00"},
  "thursday": {"available": true, "start": "09:00", "end": "17:00"},
  "friday": {"available": true, "start": "09:00", "end": "17:00"},
  "saturday": {"available": false},
  "sunday": {"available": false}
}'::jsonb,
ADD COLUMN IF NOT EXISTS auto_response_message TEXT,
ADD COLUMN IF NOT EXISTS analytics_visibility VARCHAR(20) DEFAULT 'public',
ADD COLUMN IF NOT EXISTS watermark_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS creator_token_balance INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS state VARCHAR(100),
ADD COLUMN IF NOT EXISTS country VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS availability_status VARCHAR(20) DEFAULT 'offline' CHECK (availability_status IN ('online', 'busy', 'away', 'dnd', 'offline')),
ADD COLUMN IF NOT EXISTS custom_greeting TEXT,
ADD COLUMN IF NOT EXISTS min_session_duration INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS max_session_duration INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS require_verification BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_accept_regulars BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS tv_trial_used BOOLEAN DEFAULT false;

-- Add pricing columns if they don't exist (as INTEGER for tokens, not DECIMAL)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS video_price INTEGER DEFAULT 150,
ADD COLUMN IF NOT EXISTS voice_price INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS message_price INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS stream_price INTEGER DEFAULT 100;

-- Create index on updated columns
CREATE INDEX IF NOT EXISTS idx_users_availability_status ON users(availability_status);
CREATE INDEX IF NOT EXISTS idx_users_last_seen_at ON users(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON users(updated_at);

-- Create trigger to update updated_at automatically
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at_trigger ON users;
CREATE TRIGGER update_users_updated_at_trigger
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_users_updated_at();

-- Add token rate columns if they don't exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS video_rate INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS voice_rate INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS chat_rate INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS stream_rate INTEGER DEFAULT 25;

-- Ensure all creators have proper token rates set
UPDATE users 
SET 
  video_rate = COALESCE(video_rate, 100),
  voice_rate = COALESCE(voice_rate, 50),
  chat_rate = COALESCE(chat_rate, 10),
  stream_rate = COALESCE(stream_rate, 25),
  video_price = COALESCE(video_price, 150),
  voice_price = COALESCE(voice_price, 50),
  message_price = COALESCE(message_price, 50),
  stream_price = COALESCE(stream_price, 100)
WHERE role = 'creator';