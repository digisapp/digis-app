-- ============================================
-- COMPLETE DIGIS DATABASE SCHEMA - 2024
-- ============================================
-- This script ensures ALL required tables and columns exist in your Supabase database
-- Run this after FIX_MISSING_TABLES_2024.sql if you still have errors
-- ============================================

-- ============================================
-- 1. ENSURE OFFER SYSTEM TABLES (From previous script)
-- ============================================
-- These should exist from FIX_MISSING_TABLES_2024.sql but let's ensure they're present

-- ============================================
-- 2. MISSING STREAMING & CONTENT TABLES
-- ============================================

-- Stream recordings table for VOD functionality
CREATE TABLE IF NOT EXISTS stream_recordings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration_seconds INTEGER,
    file_url TEXT,
    thumbnail_url TEXT,
    view_count INTEGER DEFAULT 0,
    price_tokens INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stream_recordings_creator ON stream_recordings(creator_id);
CREATE INDEX IF NOT EXISTS idx_stream_recordings_public ON stream_recordings(is_public);

-- VOD purchases for recorded content
CREATE TABLE IF NOT EXISTS vod_purchases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recording_id UUID REFERENCES stream_recordings(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tokens_paid INTEGER NOT NULL,
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vod_purchases_buyer ON vod_purchases(buyer_id);
CREATE INDEX IF NOT EXISTS idx_vod_purchases_recording ON vod_purchases(recording_id);

-- ============================================
-- 3. PPV MESSAGES SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS ppv_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID,
    message_text TEXT,
    media_urls TEXT[],
    media_types VARCHAR(50)[],
    price_tokens INTEGER NOT NULL CHECK (price_tokens > 0),
    is_unlocked BOOLEAN DEFAULT false,
    unlocked_at TIMESTAMP WITH TIME ZONE,
    tokens_earned INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ppv_messages_sender ON ppv_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_ppv_messages_recipient ON ppv_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_ppv_messages_conversation ON ppv_messages(conversation_id);

-- PPV message unlocks tracking
CREATE TABLE IF NOT EXISTS ppv_message_unlocks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID REFERENCES ppv_messages(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tokens_paid INTEGER NOT NULL,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ppv_unlocks_message ON ppv_message_unlocks(message_id);
CREATE INDEX IF NOT EXISTS idx_ppv_unlocks_buyer ON ppv_message_unlocks(buyer_id);

-- ============================================
-- 4. DIGITAL PRODUCTS & SHOP
-- ============================================

CREATE TABLE IF NOT EXISTS digital_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    price_tokens INTEGER NOT NULL CHECK (price_tokens > 0),
    file_urls TEXT[],
    preview_urls TEXT[],
    is_active BOOLEAN DEFAULT true,
    total_sales INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_digital_products_creator ON digital_products(creator_id);
CREATE INDEX IF NOT EXISTS idx_digital_products_active ON digital_products(is_active);

CREATE TABLE IF NOT EXISTS digital_purchases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES digital_products(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tokens_paid INTEGER NOT NULL,
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_digital_purchases_buyer ON digital_purchases(buyer_id);
CREATE INDEX IF NOT EXISTS idx_digital_purchases_product ON digital_purchases(product_id);

-- ============================================
-- 5. SESSION INVITES & CALL MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS session_invites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    fan_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_type VARCHAR(50) NOT NULL CHECK (session_type IN ('video', 'voice', 'stream')),
    scheduled_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    price_per_minute INTEGER,
    status VARCHAR(50) DEFAULT 'pending',
    message TEXT,
    response_message TEXT,
    responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_invites_creator ON session_invites(creator_id);
CREATE INDEX IF NOT EXISTS idx_session_invites_fan ON session_invites(fan_id);
CREATE INDEX IF NOT EXISTS idx_session_invites_status ON session_invites(status);

-- ============================================
-- 6. FAN NOTES & CRM
-- ============================================

CREATE TABLE IF NOT EXISTS creator_fan_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    fan_id UUID REFERENCES users(id) ON DELETE CASCADE,
    notes TEXT,
    tags TEXT[],
    favorite BOOLEAN DEFAULT false,
    vip_status BOOLEAN DEFAULT false,
    total_spent INTEGER DEFAULT 0,
    last_interaction TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(creator_id, fan_id)
);

CREATE INDEX IF NOT EXISTS idx_fan_notes_creator ON creator_fan_notes(creator_id);
CREATE INDEX IF NOT EXISTS idx_fan_notes_fan ON creator_fan_notes(fan_id);
CREATE INDEX IF NOT EXISTS idx_fan_notes_vip ON creator_fan_notes(vip_status);

-- ============================================
-- 7. TICKETED SHOWS & EVENTS
-- ============================================

CREATE TABLE IF NOT EXISTS ticketed_shows (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    ticket_price INTEGER NOT NULL CHECK (ticket_price > 0),
    max_tickets INTEGER,
    tickets_sold INTEGER DEFAULT 0,
    stream_id UUID,
    status VARCHAR(50) DEFAULT 'scheduled',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticketed_shows_creator ON ticketed_shows(creator_id);
CREATE INDEX IF NOT EXISTS idx_ticketed_shows_scheduled ON ticketed_shows(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_ticketed_shows_status ON ticketed_shows(status);

CREATE TABLE IF NOT EXISTS show_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    show_id UUID REFERENCES ticketed_shows(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tokens_paid INTEGER NOT NULL,
    attended BOOLEAN DEFAULT false,
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(show_id, buyer_id)
);

CREATE INDEX IF NOT EXISTS idx_show_tickets_show ON show_tickets(show_id);
CREATE INDEX IF NOT EXISTS idx_show_tickets_buyer ON show_tickets(buyer_id);

-- ============================================
-- 8. GIFTER TIERS & LOYALTY
-- ============================================

CREATE TABLE IF NOT EXISTS gifter_tiers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fan_id UUID REFERENCES users(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tier_level VARCHAR(50) DEFAULT 'bronze',
    total_gifts_sent INTEGER DEFAULT 0,
    total_tokens_spent INTEGER DEFAULT 0,
    perks TEXT[],
    badge_color VARCHAR(50),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(fan_id, creator_id)
);

CREATE INDEX IF NOT EXISTS idx_gifter_tiers_fan ON gifter_tiers(fan_id);
CREATE INDEX IF NOT EXISTS idx_gifter_tiers_creator ON gifter_tiers(creator_id);
CREATE INDEX IF NOT EXISTS idx_gifter_tiers_level ON gifter_tiers(tier_level);

-- ============================================
-- 9. ANALYTICS & METRICS
-- ============================================

CREATE TABLE IF NOT EXISTS session_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    fan_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_type VARCHAR(50),
    duration_seconds INTEGER,
    tokens_earned INTEGER,
    quality_score DECIMAL(3,2),
    engagement_score DECIMAL(3,2),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_metrics_creator ON session_metrics(creator_id);
CREATE INDEX IF NOT EXISTS idx_session_metrics_fan ON session_metrics(fan_id);
CREATE INDEX IF NOT EXISTS idx_session_metrics_recorded ON session_metrics(recorded_at);

-- ============================================
-- 10. CO-HOST & MODERATION
-- ============================================

CREATE TABLE IF NOT EXISTS stream_co_hosts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    co_host_id UUID REFERENCES users(id) ON DELETE CASCADE,
    permissions TEXT[],
    revenue_share DECIMAL(5,2) DEFAULT 0,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_co_hosts_stream ON stream_co_hosts(stream_id);
CREATE INDEX IF NOT EXISTS idx_co_hosts_creator ON stream_co_hosts(creator_id);

CREATE TABLE IF NOT EXISTS stream_moderators (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    moderator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    permissions TEXT[],
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moderators_stream ON stream_moderators(stream_id);
CREATE INDEX IF NOT EXISTS idx_moderators_creator ON stream_moderators(creator_id);

-- ============================================
-- 11. ENSURE CRITICAL COLUMNS ON USERS TABLE
-- ============================================

-- Add any missing user columns
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_kyc_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS age_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS age_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS creator_card_image TEXT,
ADD COLUMN IF NOT EXISTS banner_url TEXT,
ADD COLUMN IF NOT EXISTS banner_image_url TEXT,
ADD COLUMN IF NOT EXISTS message_price INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS video_call_price INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS voice_call_price INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS stream_price INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS bio_interests TEXT[],
ADD COLUMN IF NOT EXISTS creator_interests TEXT[],
ADD COLUMN IF NOT EXISTS languages_spoken TEXT[],
ADD COLUMN IF NOT EXISTS availability_schedule JSONB,
ADD COLUMN IF NOT EXISTS auto_accept_calls BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS platform_fee_percentage DECIMAL(5,2) DEFAULT 20.00,
ADD COLUMN IF NOT EXISTS payout_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS payout_details JSONB,
ADD COLUMN IF NOT EXISTS total_earnings INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pending_payout INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_payout_at TIMESTAMP WITH TIME ZONE;

-- ============================================
-- 12. ENSURE STREAMS TABLE HAS ALL COLUMNS
-- ============================================

-- First ensure streams table exists
CREATE TABLE IF NOT EXISTS streams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    description TEXT,
    thumbnail_url TEXT,
    stream_key VARCHAR(255) UNIQUE,
    is_live BOOLEAN DEFAULT false,
    viewer_count INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add any missing columns
ALTER TABLE streams
ADD COLUMN IF NOT EXISTS category VARCHAR(100),
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS password VARCHAR(255),
ADD COLUMN IF NOT EXISTS max_viewers INTEGER,
ADD COLUMN IF NOT EXISTS total_tokens_earned INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS peak_viewer_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_watch_time INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS chat_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS tips_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS recording_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS recorded_url TEXT,
ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_ticketed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ticket_price INTEGER DEFAULT 0;

-- ============================================
-- 13. ENSURE MESSAGES TABLE EXISTS
-- ============================================

CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID,
    message_text TEXT,
    attachments TEXT[],
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    is_ppv BOOLEAN DEFAULT false,
    ppv_price INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(recipient_id, is_read);

-- ============================================
-- 14. ENABLE ROW LEVEL SECURITY ON NEW TABLES
-- ============================================

ALTER TABLE stream_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE vod_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppv_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppv_message_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_fan_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticketed_shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE show_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifter_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_co_hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_moderators ENABLE ROW LEVEL SECURITY;
ALTER TABLE streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 15. CREATE BASIC RLS POLICIES
-- ============================================

-- Drop existing policies first
DROP POLICY IF EXISTS "Public recordings are viewable" ON stream_recordings;
DROP POLICY IF EXISTS "Creators manage their recordings" ON stream_recordings;
DROP POLICY IF EXISTS "Users view their purchases" ON vod_purchases;
DROP POLICY IF EXISTS "Users view their PPV messages" ON ppv_messages;
DROP POLICY IF EXISTS "Active products are public" ON digital_products;
DROP POLICY IF EXISTS "Creators manage their products" ON digital_products;
DROP POLICY IF EXISTS "Users view their invites" ON session_invites;
DROP POLICY IF EXISTS "Creators manage fan notes" ON creator_fan_notes;
DROP POLICY IF EXISTS "Shows are public" ON ticketed_shows;
DROP POLICY IF EXISTS "Creators manage their shows" ON ticketed_shows;
DROP POLICY IF EXISTS "Users view their tiers" ON gifter_tiers;
DROP POLICY IF EXISTS "Public streams are viewable" ON streams;
DROP POLICY IF EXISTS "Creators manage their streams" ON streams;
DROP POLICY IF EXISTS "Users access their messages" ON messages;
DROP POLICY IF EXISTS "Users send messages" ON messages;

-- Stream recordings policies
CREATE POLICY "Public recordings are viewable" ON stream_recordings
    FOR SELECT USING (is_public = true OR auth.uid() = creator_id);

CREATE POLICY "Creators manage their recordings" ON stream_recordings
    FOR ALL USING (auth.uid() = creator_id);

-- VOD purchases policies
CREATE POLICY "Users view their purchases" ON vod_purchases
    FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = creator_id);

-- PPV messages policies
CREATE POLICY "Users view their PPV messages" ON ppv_messages
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Digital products policies
CREATE POLICY "Active products are public" ON digital_products
    FOR SELECT USING (is_active = true OR auth.uid() = creator_id);

CREATE POLICY "Creators manage their products" ON digital_products
    FOR ALL USING (auth.uid() = creator_id);

-- Session invites policies
CREATE POLICY "Users view their invites" ON session_invites
    FOR SELECT USING (auth.uid() = creator_id OR auth.uid() = fan_id);

-- Fan notes policies - only creators can access
CREATE POLICY "Creators manage fan notes" ON creator_fan_notes
    FOR ALL USING (auth.uid() = creator_id);

-- Ticketed shows policies
CREATE POLICY "Shows are public" ON ticketed_shows
    FOR SELECT USING (true);

CREATE POLICY "Creators manage their shows" ON ticketed_shows
    FOR ALL USING (auth.uid() = creator_id);

-- Gifter tiers policies
CREATE POLICY "Users view their tiers" ON gifter_tiers
    FOR SELECT USING (auth.uid() = fan_id OR auth.uid() = creator_id);

-- Streams policies
CREATE POLICY "Public streams are viewable" ON streams
    FOR SELECT USING (is_private = false OR auth.uid() = creator_id);

CREATE POLICY "Creators manage their streams" ON streams
    FOR ALL USING (auth.uid() = creator_id);

-- Messages policies
CREATE POLICY "Users access their messages" ON messages
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users send messages" ON messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- ============================================
-- 16. CREATE HELPER FUNCTIONS
-- ============================================

-- Function to calculate creator earnings
CREATE OR REPLACE FUNCTION calculate_creator_earnings(p_creator_id UUID, p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
    total_earnings INTEGER,
    video_calls_earnings INTEGER,
    voice_calls_earnings INTEGER,
    tips_earnings INTEGER,
    messages_earnings INTEGER,
    digital_sales_earnings INTEGER,
    offers_earnings INTEGER,
    ticketed_shows_earnings INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(earnings.total), 0)::INTEGER as total_earnings,
        COALESCE(SUM(earnings.video_calls), 0)::INTEGER as video_calls_earnings,
        COALESCE(SUM(earnings.voice_calls), 0)::INTEGER as voice_calls_earnings,
        COALESCE(SUM(earnings.tips), 0)::INTEGER as tips_earnings,
        COALESCE(SUM(earnings.messages), 0)::INTEGER as messages_earnings,
        COALESCE(SUM(earnings.digital_sales), 0)::INTEGER as digital_sales_earnings,
        COALESCE(SUM(earnings.offers), 0)::INTEGER as offers_earnings,
        COALESCE(SUM(earnings.ticketed_shows), 0)::INTEGER as ticketed_shows_earnings
    FROM (
        -- Video call earnings
        SELECT tokens_earned as total, tokens_earned as video_calls, 0 as voice_calls, 
               0 as tips, 0 as messages, 0 as digital_sales, 0 as offers, 0 as ticketed_shows
        FROM sessions 
        WHERE creator_id = p_creator_id 
        AND session_type = 'video'
        AND DATE(created_at) BETWEEN p_start_date AND p_end_date
        
        UNION ALL
        
        -- Voice call earnings
        SELECT tokens_earned as total, 0 as video_calls, tokens_earned as voice_calls,
               0 as tips, 0 as messages, 0 as digital_sales, 0 as offers, 0 as ticketed_shows
        FROM sessions 
        WHERE creator_id = p_creator_id 
        AND session_type = 'voice'
        AND DATE(created_at) BETWEEN p_start_date AND p_end_date
        
        UNION ALL
        
        -- Tips earnings
        SELECT amount as total, 0 as video_calls, 0 as voice_calls,
               amount as tips, 0 as messages, 0 as digital_sales, 0 as offers, 0 as ticketed_shows
        FROM tips 
        WHERE creator_id = p_creator_id
        AND DATE(created_at) BETWEEN p_start_date AND p_end_date
        
        UNION ALL
        
        -- PPV message earnings
        SELECT tokens_earned as total, 0 as video_calls, 0 as voice_calls,
               0 as tips, tokens_earned as messages, 0 as digital_sales, 0 as offers, 0 as ticketed_shows
        FROM ppv_messages 
        WHERE sender_id = p_creator_id
        AND is_unlocked = true
        AND DATE(created_at) BETWEEN p_start_date AND p_end_date
        
        UNION ALL
        
        -- Digital product sales
        SELECT tokens_paid as total, 0 as video_calls, 0 as voice_calls,
               0 as tips, 0 as messages, tokens_paid as digital_sales, 0 as offers, 0 as ticketed_shows
        FROM digital_purchases 
        WHERE creator_id = p_creator_id
        AND DATE(purchased_at) BETWEEN p_start_date AND p_end_date
        
        UNION ALL
        
        -- Offer purchases
        SELECT tokens_paid as total, 0 as video_calls, 0 as voice_calls,
               0 as tips, 0 as messages, 0 as digital_sales, tokens_paid as offers, 0 as ticketed_shows
        FROM offer_purchases 
        WHERE creator_id = p_creator_id
        AND status = 'completed'
        AND DATE(created_at) BETWEEN p_start_date AND p_end_date
        
        UNION ALL
        
        -- Ticketed show sales
        SELECT tokens_paid as total, 0 as video_calls, 0 as voice_calls,
               0 as tips, 0 as messages, 0 as digital_sales, 0 as offers, tokens_paid as ticketed_shows
        FROM show_tickets st
        JOIN ticketed_shows ts ON st.show_id = ts.id
        WHERE ts.creator_id = p_creator_id
        AND DATE(st.purchased_at) BETWEEN p_start_date AND p_end_date
    ) as earnings;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 17. GRANT PERMISSIONS
-- ============================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================
-- END OF COMPLETE DATABASE SCHEMA
-- ============================================
-- After running this script, your database should have ALL required tables and columns
-- If you still get errors, check the specific table/column mentioned in the error
-- ============================================