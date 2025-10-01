-- =====================================================
-- CREATE CONTENT, MODERATION, AND NOTIFICATION TABLES
-- =====================================================
-- This migration adds tables for content management, moderation, and notifications

BEGIN;

-- =====================================================
-- CONTENT MANAGEMENT TABLES
-- =====================================================

-- Content table for pictures and videos
CREATE TABLE IF NOT EXISTS content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    type VARCHAR(20) CHECK (type IN ('picture', 'video')),
    title TEXT,
    description TEXT,
    thumbnail_url TEXT,
    content_url TEXT,
    duration INTEGER, -- For videos, in seconds
    price DECIMAL(10,2) DEFAULT 0,
    likes INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT true,
    is_premium BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content purchases tracking
CREATE TABLE IF NOT EXISTS content_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES content(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    price_paid DECIMAL(10,2),
    tokens_used INTEGER,
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(content_id, user_id)
);

-- Content views tracking
CREATE TABLE IF NOT EXISTS content_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES content(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    view_duration INTEGER, -- In seconds
    UNIQUE(content_id, user_id)
);

-- Content likes
CREATE TABLE IF NOT EXISTS content_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES content(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(content_id, user_id)
);

-- =====================================================
-- CREATOR SETTINGS AND STATS
-- =====================================================

-- Creator settings table
CREATE TABLE IF NOT EXISTS creator_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID UNIQUE REFERENCES users(supabase_id) ON DELETE CASCADE,
    rates JSONB DEFAULT '{
        "videoCall": 5,
        "voiceCall": 3,
        "message": 1,
        "picture": 10,
        "video": 25
    }',
    subscription_enabled BOOLEAN DEFAULT true,
    tips_enabled BOOLEAN DEFAULT true,
    min_call_duration INTEGER DEFAULT 60, -- In seconds
    max_call_duration INTEGER DEFAULT 3600, -- In seconds
    auto_accept_calls BOOLEAN DEFAULT false,
    availability_schedule JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Creator stats view (materialized for performance)
CREATE MATERIALIZED VIEW IF NOT EXISTS creator_stats AS
SELECT 
    u.supabase_id as creator_id,
    u.username,
    (SELECT COUNT(*) FROM follows WHERE creator_id = u.supabase_id) as followers,
    (SELECT COUNT(*) FROM content WHERE creator_id = u.supabase_id) as total_content,
    (SELECT COUNT(*) FROM content WHERE creator_id = u.supabase_id AND type = 'picture') as total_pictures,
    (SELECT COUNT(*) FROM content WHERE creator_id = u.supabase_id AND type = 'video') as total_videos,
    (SELECT COALESCE(SUM(likes), 0) FROM content WHERE creator_id = u.supabase_id) as total_likes,
    (SELECT COALESCE(SUM(views), 0) FROM content WHERE creator_id = u.supabase_id) as total_views,
    (SELECT COUNT(DISTINCT id) FROM sessions WHERE creator_id = u.supabase_id) as total_sessions,
    (SELECT COALESCE(SUM(amount), 0) FROM tips WHERE creator_id = u.supabase_id) as total_tips_received,
    u.created_at as joined_date,
    NOW() as last_updated
FROM users u
WHERE u.is_creator = true;

-- Create index for fast refresh
CREATE UNIQUE INDEX idx_creator_stats_creator_id ON creator_stats(creator_id);

-- =====================================================
-- MODERATION TABLES
-- =====================================================

-- Content moderation table
CREATE TABLE IF NOT EXISTS content_moderation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('creator_profile', 'content', 'message', 'stream')),
    content_id VARCHAR(255) NOT NULL,
    reported_by UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    action_taken VARCHAR(50) CHECK (action_taken IN ('none', 'warning', 'content_removed', 'account_suspended', 'account_banned')),
    moderation_result JSONB,
    admin_notes TEXT,
    reviewed_by UUID REFERENCES users(supabase_id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- NOTIFICATION SETTINGS
-- =====================================================

-- Notification settings per creator
CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    new_content BOOLEAN DEFAULT true,
    live_streams BOOLEAN DEFAULT true,
    messages BOOLEAN DEFAULT true,
    promotions BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, creator_id)
);

-- Stream viewers for tracking
CREATE TABLE IF NOT EXISTS stream_viewers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID REFERENCES streams(stream_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    watch_duration INTEGER DEFAULT 0, -- In seconds
    UNIQUE(stream_id, user_id, joined_at)
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Content indexes
CREATE INDEX idx_content_creator_id ON content(creator_id);
CREATE INDEX idx_content_type ON content(type);
CREATE INDEX idx_content_created_at ON content(created_at DESC);
CREATE INDEX idx_content_price ON content(price);
CREATE INDEX idx_content_is_published ON content(is_published);

-- Content purchases indexes
CREATE INDEX idx_content_purchases_user_id ON content_purchases(user_id);
CREATE INDEX idx_content_purchases_content_id ON content_purchases(content_id);
CREATE INDEX idx_content_purchases_purchased_at ON content_purchases(purchased_at DESC);

-- Content views indexes
CREATE INDEX idx_content_views_content_id ON content_views(content_id);
CREATE INDEX idx_content_views_user_id ON content_views(user_id);

-- Content likes indexes
CREATE INDEX idx_content_likes_content_id ON content_likes(content_id);
CREATE INDEX idx_content_likes_user_id ON content_likes(user_id);

-- Moderation indexes
CREATE INDEX idx_content_moderation_status ON content_moderation(status);
CREATE INDEX idx_content_moderation_content_type ON content_moderation(content_type);
CREATE INDEX idx_content_moderation_created_at ON content_moderation(created_at DESC);
CREATE INDEX idx_content_moderation_severity ON content_moderation(severity);

-- Notification settings indexes
CREATE INDEX idx_notification_settings_user_id ON notification_settings(user_id);
CREATE INDEX idx_notification_settings_creator_id ON notification_settings(creator_id);

-- Stream viewers indexes
CREATE INDEX idx_stream_viewers_stream_id ON stream_viewers(stream_id);
CREATE INDEX idx_stream_viewers_user_id ON stream_viewers(user_id);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update content stats on likes
CREATE OR REPLACE FUNCTION update_content_likes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE content 
        SET likes = likes + 1 
        WHERE id = NEW.content_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE content 
        SET likes = GREATEST(likes - 1, 0) 
        WHERE id = OLD.content_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_content_likes
AFTER INSERT OR DELETE ON content_likes
FOR EACH ROW EXECUTE FUNCTION update_content_likes();

-- Update content stats on views
CREATE OR REPLACE FUNCTION update_content_views()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE content 
    SET views = (
        SELECT COUNT(DISTINCT user_id) 
        FROM content_views 
        WHERE content_id = NEW.content_id
    )
    WHERE id = NEW.content_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_content_views
AFTER INSERT ON content_views
FOR EACH ROW EXECUTE FUNCTION update_content_views();

-- Update timestamps
CREATE TRIGGER update_content_updated_at BEFORE UPDATE ON content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_creator_settings_updated_at BEFORE UPDATE ON creator_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_moderation_updated_at BEFORE UPDATE ON content_moderation
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_settings_updated_at BEFORE UPDATE ON notification_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to refresh creator stats
CREATE OR REPLACE FUNCTION refresh_creator_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY creator_stats;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_moderation ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_viewers ENABLE ROW LEVEL SECURITY;

-- Content policies
CREATE POLICY content_select ON content FOR SELECT 
    USING (is_published = true OR creator_id = auth.uid());

CREATE POLICY content_insert ON content FOR INSERT 
    WITH CHECK (creator_id = auth.uid());

CREATE POLICY content_update ON content FOR UPDATE 
    USING (creator_id = auth.uid());

CREATE POLICY content_delete ON content FOR DELETE 
    USING (creator_id = auth.uid());

-- Content purchases policies
CREATE POLICY content_purchases_select ON content_purchases FOR SELECT 
    USING (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM content WHERE content.id = content_purchases.content_id 
        AND content.creator_id = auth.uid()
    ));

CREATE POLICY content_purchases_insert ON content_purchases FOR INSERT 
    WITH CHECK (user_id = auth.uid());

-- Content views policies
CREATE POLICY content_views_select ON content_views FOR SELECT 
    USING (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM content WHERE content.id = content_views.content_id 
        AND content.creator_id = auth.uid()
    ));

CREATE POLICY content_views_insert ON content_views FOR INSERT 
    WITH CHECK (user_id = auth.uid());

-- Content likes policies
CREATE POLICY content_likes_select ON content_likes FOR SELECT USING (true);
CREATE POLICY content_likes_insert ON content_likes FOR INSERT 
    WITH CHECK (user_id = auth.uid());
CREATE POLICY content_likes_delete ON content_likes FOR DELETE 
    USING (user_id = auth.uid());

-- Creator settings policies
CREATE POLICY creator_settings_select ON creator_settings FOR SELECT USING (true);
CREATE POLICY creator_settings_manage ON creator_settings FOR ALL 
    USING (creator_id = auth.uid());

-- Content moderation policies
CREATE POLICY content_moderation_insert ON content_moderation FOR INSERT 
    WITH CHECK (reported_by = auth.uid());

CREATE POLICY content_moderation_select ON content_moderation FOR SELECT 
    USING (reported_by = auth.uid() OR creator_id = auth.uid() OR 
           EXISTS (SELECT 1 FROM users WHERE supabase_id = auth.uid() AND role = 'admin'));

CREATE POLICY content_moderation_update ON content_moderation FOR UPDATE 
    USING (EXISTS (SELECT 1 FROM users WHERE supabase_id = auth.uid() AND role = 'admin'));

-- Notification settings policies
CREATE POLICY notification_settings_select ON notification_settings FOR SELECT 
    USING (user_id = auth.uid() OR creator_id = auth.uid());

CREATE POLICY notification_settings_manage ON notification_settings FOR ALL 
    USING (user_id = auth.uid());

-- Stream viewers policies
CREATE POLICY stream_viewers_select ON stream_viewers FOR SELECT USING (true);
CREATE POLICY stream_viewers_insert ON stream_viewers FOR INSERT 
    WITH CHECK (user_id = auth.uid());
CREATE POLICY stream_viewers_update ON stream_viewers FOR UPDATE 
    USING (user_id = auth.uid());

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Create default creator settings for existing creators
INSERT INTO creator_settings (creator_id)
SELECT supabase_id FROM users WHERE is_creator = true
ON CONFLICT (creator_id) DO NOTHING;

-- Refresh creator stats
SELECT refresh_creator_stats();

COMMIT;