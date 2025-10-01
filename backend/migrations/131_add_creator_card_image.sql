-- Add creator_card_image field to users table
-- This image is specifically for the creator card display in the Explore page
-- It's separate from the profile_pic_url to allow creators to optimize different images for different contexts

ALTER TABLE users ADD COLUMN IF NOT EXISTS creator_card_image TEXT;

-- Add notification preferences columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"emailNotifications": true, "pushNotifications": true, "messageAlerts": true, "streamAlerts": true}'::jsonb;

-- Add privacy settings columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT '{"profileVisibility": "public", "messagePrivacy": "everyone", "showOnlineStatus": true}'::jsonb;

-- Add blocked users table
CREATE TABLE IF NOT EXISTS blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  UNIQUE(user_id, blocked_user_id)
);

-- Add indices for performance
CREATE INDEX IF NOT EXISTS idx_blocked_users_user_id ON blocked_users(user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked_user_id ON blocked_users(blocked_user_id);

-- Add two-factor authentication columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT[];

-- Add language and timezone preferences
ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/New_York';

-- Add creator-specific settings
ALTER TABLE users ADD COLUMN IF NOT EXISTS availability_schedule JSONB DEFAULT '{
  "monday": {"available": true, "start": "09:00", "end": "17:00"},
  "tuesday": {"available": true, "start": "09:00", "end": "17:00"},
  "wednesday": {"available": true, "start": "09:00", "end": "17:00"},
  "thursday": {"available": true, "start": "09:00", "end": "17:00"},
  "friday": {"available": true, "start": "09:00", "end": "17:00"},
  "saturday": {"available": false, "start": "09:00", "end": "17:00"},
  "sunday": {"available": false, "start": "09:00", "end": "17:00"}
}'::jsonb;

ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_response_message TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS analytics_visibility VARCHAR(20) DEFAULT 'public';
ALTER TABLE users ADD COLUMN IF NOT EXISTS watermark_enabled BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN users.creator_card_image IS 'Separate image optimized for creator card display (4:5 portrait ratio)';
COMMENT ON COLUMN users.notification_preferences IS 'User notification preferences as JSON';
COMMENT ON COLUMN users.privacy_settings IS 'User privacy settings as JSON';
COMMENT ON COLUMN users.availability_schedule IS 'Creator availability schedule for calls and messages';
COMMENT ON COLUMN users.auto_response_message IS 'Auto-response message when creator is offline';
COMMENT ON COLUMN users.analytics_visibility IS 'Who can see creator analytics: public, followers, private';
COMMENT ON COLUMN users.watermark_enabled IS 'Whether to add watermark to creator content';