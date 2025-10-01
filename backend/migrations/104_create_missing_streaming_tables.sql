-- =====================================================
-- CREATE MISSING STREAMING AND RECORDING TABLES
-- =====================================================
-- This migration adds tables referenced in streaming.js but not defined in the schema

BEGIN;

-- =====================================================
-- STREAMING RECORDINGS
-- =====================================================

CREATE TABLE IF NOT EXISTS stream_recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID, -- Made nullable and UUID to handle both old and new session formats
    creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_private BOOLEAN DEFAULT false,
    recording_settings JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'recording' CHECK (status IN ('recording', 'processing', 'completed', 'failed')),
    external_recording_id VARCHAR(255),
    recording_config JSONB DEFAULT '{}',
    file_url TEXT,
    thumbnail_url TEXT,
    file_size BIGINT,
    duration_seconds INTEGER,
    processing_result JSONB DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recording views tracking
CREATE TABLE IF NOT EXISTS recording_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recording_id UUID NOT NULL REFERENCES stream_recordings(id) ON DELETE CASCADE,
    viewer_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    watch_duration INTEGER DEFAULT 0,
    last_position INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(recording_id, viewer_id)
);

-- Recording purchases for premium content
CREATE TABLE IF NOT EXISTS recording_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    recording_id UUID NOT NULL REFERENCES stream_recordings(id) ON DELETE CASCADE,
    price_paid DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    stripe_payment_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, recording_id)
);

-- Recording clips
CREATE TABLE IF NOT EXISTS recording_clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recording_id UUID NOT NULL REFERENCES stream_recordings(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    duration_seconds INTEGER GENERATED ALWAYS AS (end_time - start_time) STORED,
    clip_url TEXT,
    thumbnail_url TEXT,
    file_size BIGINT,
    processing_result JSONB DEFAULT '{}',
    is_public BOOLEAN DEFAULT true,
    status VARCHAR(50) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clip views
CREATE TABLE IF NOT EXISTS clip_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clip_id UUID NOT NULL REFERENCES recording_clips(id) ON DELETE CASCADE,
    viewer_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(clip_id, viewer_id)
);

-- Clip likes
CREATE TABLE IF NOT EXISTS clip_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clip_id UUID NOT NULL REFERENCES recording_clips(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(clip_id, user_id)
);

-- Creator streaming settings
CREATE TABLE IF NOT EXISTS creator_settings (
    creator_id UUID PRIMARY KEY REFERENCES users(supabase_id) ON DELETE CASCADE,
    -- Private stream settings
    private_stream_rate INTEGER DEFAULT 100 CHECK (private_stream_rate >= 0),
    private_stream_min_time INTEGER DEFAULT 5 CHECK (private_stream_min_time >= 1),
    private_stream_auto_accept VARCHAR(20) DEFAULT 'manual' CHECK (private_stream_auto_accept IN ('manual', 'auto', 'whitelist')),
    private_stream_enabled BOOLEAN DEFAULT true,
    -- Recording settings
    auto_record_streams BOOLEAN DEFAULT false,
    recording_quality VARCHAR(20) DEFAULT 'high' CHECK (recording_quality IN ('low', 'medium', 'high', 'ultra')),
    recording_format VARCHAR(20) DEFAULT 'mp4' CHECK (recording_format IN ('mp4', 'webm', 'flv')),
    -- General settings
    stream_notifications_enabled BOOLEAN DEFAULT true,
    chat_moderation_level VARCHAR(20) DEFAULT 'medium' CHECK (chat_moderation_level IN ('off', 'low', 'medium', 'high')),
    allow_guest_chat BOOLEAN DEFAULT false,
    subscriber_only_chat BOOLEAN DEFAULT false,
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Private stream requests
CREATE TABLE IF NOT EXISTS private_stream_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fan_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    stream_id UUID REFERENCES streams(stream_id) ON DELETE CASCADE,
    minimum_minutes INTEGER NOT NULL CHECK (minimum_minutes >= 1),
    rate_per_minute INTEGER NOT NULL CHECK (rate_per_minute >= 0),
    total_cost INTEGER GENERATED ALWAYS AS (minimum_minutes * rate_per_minute) STORED,
    message TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
    responded_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '5 minutes',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Stream recordings indexes
CREATE INDEX idx_stream_recordings_creator_id ON stream_recordings(creator_id);
CREATE INDEX idx_stream_recordings_session_id ON stream_recordings(session_id);
CREATE INDEX idx_stream_recordings_status ON stream_recordings(status);
CREATE INDEX idx_stream_recordings_created_at ON stream_recordings(created_at DESC);

-- Recording views indexes
CREATE INDEX idx_recording_views_recording_id ON recording_views(recording_id);
CREATE INDEX idx_recording_views_viewer_id ON recording_views(viewer_id);

-- Recording purchases indexes
CREATE INDEX idx_recording_purchases_user_id ON recording_purchases(user_id);
CREATE INDEX idx_recording_purchases_recording_id ON recording_purchases(recording_id);

-- Recording clips indexes
CREATE INDEX idx_recording_clips_recording_id ON recording_clips(recording_id);
CREATE INDEX idx_recording_clips_creator_id ON recording_clips(creator_id);
CREATE INDEX idx_recording_clips_status ON recording_clips(status);

-- Clip engagement indexes
CREATE INDEX idx_clip_views_clip_id ON clip_views(clip_id);
CREATE INDEX idx_clip_likes_clip_id ON clip_likes(clip_id);

-- Private stream requests indexes
CREATE INDEX idx_private_stream_requests_fan_id ON private_stream_requests(fan_id);
CREATE INDEX idx_private_stream_requests_creator_id ON private_stream_requests(creator_id);
CREATE INDEX idx_private_stream_requests_status ON private_stream_requests(status);
CREATE INDEX idx_private_stream_requests_expires_at ON private_stream_requests(expires_at);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update timestamp triggers
CREATE TRIGGER update_stream_recordings_updated_at BEFORE UPDATE ON stream_recordings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recording_views_updated_at BEFORE UPDATE ON recording_views
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_creator_settings_updated_at BEFORE UPDATE ON creator_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE stream_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE recording_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE recording_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE recording_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE clip_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE clip_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_stream_requests ENABLE ROW LEVEL SECURITY;

-- Stream recordings policies
CREATE POLICY stream_recordings_select_public ON stream_recordings FOR SELECT 
    USING (is_private = false OR auth.uid() = creator_id);
CREATE POLICY stream_recordings_select_purchased ON stream_recordings FOR SELECT 
    USING (auth.uid() IN (SELECT user_id FROM recording_purchases WHERE recording_id = stream_recordings.id));
CREATE POLICY stream_recordings_insert ON stream_recordings FOR INSERT 
    WITH CHECK (auth.uid() = creator_id);
CREATE POLICY stream_recordings_update ON stream_recordings FOR UPDATE 
    USING (auth.uid() = creator_id);
CREATE POLICY stream_recordings_delete ON stream_recordings FOR DELETE 
    USING (auth.uid() = creator_id);

-- Recording views policies
CREATE POLICY recording_views_select ON recording_views FOR SELECT 
    USING (auth.uid() = viewer_id OR auth.uid() = (SELECT creator_id FROM stream_recordings WHERE id = recording_id));
CREATE POLICY recording_views_insert ON recording_views FOR INSERT 
    WITH CHECK (auth.uid() = viewer_id);
CREATE POLICY recording_views_update ON recording_views FOR UPDATE 
    USING (auth.uid() = viewer_id);

-- Recording purchases policies
CREATE POLICY recording_purchases_select ON recording_purchases FOR SELECT 
    USING (auth.uid() = user_id OR auth.uid() = (SELECT creator_id FROM stream_recordings WHERE id = recording_id));
CREATE POLICY recording_purchases_insert ON recording_purchases FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Recording clips policies
CREATE POLICY recording_clips_select ON recording_clips FOR SELECT 
    USING (is_public = true OR auth.uid() IN (creator_id, created_by));
CREATE POLICY recording_clips_insert ON recording_clips FOR INSERT 
    WITH CHECK (auth.uid() = created_by);
CREATE POLICY recording_clips_update ON recording_clips FOR UPDATE 
    USING (auth.uid() IN (creator_id, created_by));
CREATE POLICY recording_clips_delete ON recording_clips FOR DELETE 
    USING (auth.uid() IN (creator_id, created_by));

-- Clip engagement policies
CREATE POLICY clip_views_select ON clip_views FOR SELECT 
    USING (auth.uid() = viewer_id);
CREATE POLICY clip_views_insert ON clip_views FOR INSERT 
    WITH CHECK (auth.uid() = viewer_id);

CREATE POLICY clip_likes_all ON clip_likes FOR ALL 
    USING (auth.uid() = user_id);

-- Creator settings policies
CREATE POLICY creator_settings_all ON creator_settings FOR ALL 
    USING (auth.uid() = creator_id);

-- Private stream requests policies
CREATE POLICY private_stream_requests_select ON private_stream_requests FOR SELECT 
    USING (auth.uid() IN (fan_id, creator_id));
CREATE POLICY private_stream_requests_insert ON private_stream_requests FOR INSERT 
    WITH CHECK (auth.uid() = fan_id);
CREATE POLICY private_stream_requests_update ON private_stream_requests FOR UPDATE 
    USING (auth.uid() = creator_id AND status = 'pending');

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to automatically expire old private stream requests
CREATE OR REPLACE FUNCTION expire_old_private_stream_requests()
RETURNS void AS $$
BEGIN
    UPDATE private_stream_requests 
    SET status = 'expired' 
    WHERE status = 'pending' 
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to calculate total recording revenue
CREATE OR REPLACE FUNCTION get_recording_revenue(recording_uuid UUID)
RETURNS DECIMAL AS $$
DECLARE
    total_revenue DECIMAL;
BEGIN
    SELECT COALESCE(SUM(price_paid), 0) INTO total_revenue
    FROM recording_purchases
    WHERE recording_id = recording_uuid;
    
    RETURN total_revenue;
END;
$$ LANGUAGE plpgsql;

-- Function to get clip statistics
CREATE OR REPLACE FUNCTION get_clip_stats(clip_uuid UUID)
RETURNS TABLE(
    view_count BIGINT,
    like_count BIGINT,
    engagement_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM clip_views WHERE clip_id = clip_uuid) as view_count,
        (SELECT COUNT(*) FROM clip_likes WHERE clip_id = clip_uuid) as like_count,
        CASE 
            WHEN (SELECT COUNT(*) FROM clip_views WHERE clip_id = clip_uuid) > 0 THEN
                ROUND((SELECT COUNT(*)::DECIMAL FROM clip_likes WHERE clip_id = clip_uuid) / 
                      (SELECT COUNT(*) FROM clip_views WHERE clip_id = clip_uuid) * 100, 2)
            ELSE 0
        END as engagement_rate;
END;
$$ LANGUAGE plpgsql;

COMMIT;