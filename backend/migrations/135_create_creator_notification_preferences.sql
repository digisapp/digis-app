-- Create creator notification preferences table
-- This tracks which creators a user wants to receive notifications from
CREATE TABLE IF NOT EXISTS creator_notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fan_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  notifications_enabled BOOLEAN DEFAULT true,
  live_notifications BOOLEAN DEFAULT true,
  content_notifications BOOLEAN DEFAULT true,
  announcement_notifications BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_fan_creator_notification UNIQUE (fan_id, creator_id),
  CONSTRAINT no_self_notification CHECK (fan_id != creator_id)
);

-- Create indexes for performance
CREATE INDEX idx_creator_notif_pref_fan_id ON creator_notification_preferences(fan_id);
CREATE INDEX idx_creator_notif_pref_creator_id ON creator_notification_preferences(creator_id);
CREATE INDEX idx_creator_notif_pref_enabled ON creator_notification_preferences(notifications_enabled) WHERE notifications_enabled = true;

-- Enable RLS
ALTER TABLE creator_notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies
-- Users can see their own notification preferences
CREATE POLICY creator_notif_pref_select_own ON creator_notification_preferences
FOR SELECT USING (fan_id = auth.uid());

-- Users can insert their own notification preferences
CREATE POLICY creator_notif_pref_insert_own ON creator_notification_preferences
FOR INSERT WITH CHECK (fan_id = auth.uid());

-- Users can update their own notification preferences
CREATE POLICY creator_notif_pref_update_own ON creator_notification_preferences
FOR UPDATE USING (fan_id = auth.uid());

-- Users can delete their own notification preferences
CREATE POLICY creator_notif_pref_delete_own ON creator_notification_preferences
FOR DELETE USING (fan_id = auth.uid());

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_creator_notif_pref_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_creator_notif_pref_updated_at_trigger
BEFORE UPDATE ON creator_notification_preferences
FOR EACH ROW
EXECUTE FUNCTION update_creator_notif_pref_updated_at();

-- Function to check if user should receive notification from creator
CREATE OR REPLACE FUNCTION should_receive_creator_notification(
  p_fan_id UUID,
  p_creator_id UUID,
  p_notification_type VARCHAR DEFAULT 'general'
) RETURNS BOOLEAN AS $$
DECLARE
  v_preferences RECORD;
BEGIN
  SELECT * INTO v_preferences
  FROM creator_notification_preferences
  WHERE fan_id = p_fan_id AND creator_id = p_creator_id;
  
  IF NOT FOUND THEN
    -- No specific preference set, default to false
    RETURN FALSE;
  END IF;
  
  -- Check if notifications are enabled at all
  IF NOT v_preferences.notifications_enabled THEN
    RETURN FALSE;
  END IF;
  
  -- Check specific notification type
  CASE p_notification_type
    WHEN 'live' THEN
      RETURN v_preferences.live_notifications;
    WHEN 'content' THEN
      RETURN v_preferences.content_notifications;
    WHEN 'announcement' THEN
      RETURN v_preferences.announcement_notifications;
    ELSE
      RETURN v_preferences.notifications_enabled;
  END CASE;
END;
$$ LANGUAGE plpgsql STABLE;