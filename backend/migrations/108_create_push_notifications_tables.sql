-- =====================================================
-- CREATE PUSH NOTIFICATIONS TABLES
-- =====================================================
-- This migration adds support for web push notifications

BEGIN;

-- =====================================================
-- PUSH SUBSCRIPTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id, endpoint)
);

-- =====================================================
-- PUSH NOTIFICATION PREFERENCES
-- =====================================================
CREATE TABLE IF NOT EXISTS push_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(supabase_id) ON DELETE CASCADE,
    
    -- Global settings
    enabled BOOLEAN DEFAULT true,
    quiet_hours_enabled BOOLEAN DEFAULT false,
    quiet_hours_start TIME DEFAULT '22:00',
    quiet_hours_end TIME DEFAULT '08:00',
    
    -- Notification types
    new_followers BOOLEAN DEFAULT true,
    creator_online BOOLEAN DEFAULT true,
    creator_content BOOLEAN DEFAULT true,
    creator_live BOOLEAN DEFAULT true,
    messages BOOLEAN DEFAULT true,
    session_reminders BOOLEAN DEFAULT true,
    tips_received BOOLEAN DEFAULT true,
    promotions BOOLEAN DEFAULT false,
    system_updates BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- CREATOR-SPECIFIC NOTIFICATION SETTINGS
-- =====================================================
ALTER TABLE notification_settings 
ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT true;

-- =====================================================
-- PUSH NOTIFICATION LOGS
-- =====================================================
CREATE TABLE IF NOT EXISTS push_notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    subscription_id INTEGER REFERENCES push_subscriptions(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    data JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'clicked')),
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- SCHEDULED NOTIFICATIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS scheduled_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    data JSONB DEFAULT '{}',
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_active ON push_subscriptions(is_active) WHERE is_active = true;
CREATE INDEX idx_push_notification_preferences_user_id ON push_notification_preferences(user_id);
CREATE INDEX idx_push_notification_logs_user_id ON push_notification_logs(user_id);
CREATE INDEX idx_push_notification_logs_created_at ON push_notification_logs(created_at DESC);
CREATE INDEX idx_scheduled_notifications_scheduled_for ON scheduled_notifications(scheduled_for) WHERE sent = false;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update timestamp trigger for preferences
CREATE TRIGGER update_push_notification_preferences_updated_at 
BEFORE UPDATE ON push_notification_preferences
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update last_used_at for subscriptions
CREATE OR REPLACE FUNCTION update_subscription_last_used()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE push_subscriptions 
    SET last_used_at = NOW()
    WHERE id = NEW.subscription_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_subscription_last_used
AFTER INSERT ON push_notification_logs
FOR EACH ROW EXECUTE FUNCTION update_subscription_last_used();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- Push subscriptions policies
CREATE POLICY push_subscriptions_own ON push_subscriptions 
    FOR ALL USING (user_id = auth.uid());

-- Preferences policies
CREATE POLICY push_notification_preferences_own ON push_notification_preferences 
    FOR ALL USING (user_id = auth.uid());

-- Logs policies (users can only see their own)
CREATE POLICY push_notification_logs_own ON push_notification_logs 
    FOR SELECT USING (user_id = auth.uid());

-- Scheduled notifications policies
CREATE POLICY scheduled_notifications_own ON scheduled_notifications 
    FOR ALL USING (user_id = auth.uid());

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Create default preferences for existing users
INSERT INTO push_notification_preferences (user_id)
SELECT supabase_id FROM users
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to check if user should receive notification
CREATE OR REPLACE FUNCTION should_send_push_notification(
    p_user_id UUID,
    p_notification_type VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
    v_prefs push_notification_preferences;
    v_current_time TIME;
    v_should_send BOOLEAN := true;
BEGIN
    -- Get user preferences
    SELECT * INTO v_prefs 
    FROM push_notification_preferences 
    WHERE user_id = p_user_id;
    
    -- Check if notifications are enabled globally
    IF NOT v_prefs.enabled THEN
        RETURN false;
    END IF;
    
    -- Check quiet hours
    IF v_prefs.quiet_hours_enabled THEN
        v_current_time := CURRENT_TIME;
        IF v_prefs.quiet_hours_start < v_prefs.quiet_hours_end THEN
            -- Normal case: quiet hours don't cross midnight
            IF v_current_time >= v_prefs.quiet_hours_start AND v_current_time <= v_prefs.quiet_hours_end THEN
                RETURN false;
            END IF;
        ELSE
            -- Quiet hours cross midnight
            IF v_current_time >= v_prefs.quiet_hours_start OR v_current_time <= v_prefs.quiet_hours_end THEN
                RETURN false;
            END IF;
        END IF;
    END IF;
    
    -- Check specific notification type
    CASE p_notification_type
        WHEN 'new_follower' THEN v_should_send := v_prefs.new_followers;
        WHEN 'creator_online' THEN v_should_send := v_prefs.creator_online;
        WHEN 'creator_content' THEN v_should_send := v_prefs.creator_content;
        WHEN 'creator_live' THEN v_should_send := v_prefs.creator_live;
        WHEN 'message' THEN v_should_send := v_prefs.messages;
        WHEN 'session_reminder' THEN v_should_send := v_prefs.session_reminders;
        WHEN 'tip_received' THEN v_should_send := v_prefs.tips_received;
        WHEN 'promotion' THEN v_should_send := v_prefs.promotions;
        WHEN 'system_update' THEN v_should_send := v_prefs.system_updates;
        ELSE v_should_send := true;
    END CASE;
    
    RETURN v_should_send;
END;
$$ LANGUAGE plpgsql;

COMMIT;