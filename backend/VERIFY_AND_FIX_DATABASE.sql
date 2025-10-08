-- Comprehensive Database Verification and Fix Script
-- This script checks for missing columns and adds them to ensure data integrity

-- ============================================================
-- ANALYTICS_EVENTS TABLE
-- ============================================================
-- Add created_at column if it doesn't exist
ALTER TABLE analytics_events 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Ensure the column has proper index for performance
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at 
ON analytics_events(created_at DESC);

-- Update any existing rows that might have NULL created_at
UPDATE analytics_events 
SET created_at = NOW() 
WHERE created_at IS NULL;

-- ============================================================
-- USERS TABLE - Ensure all critical columns exist
-- ============================================================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS stream_price INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS voice_price INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS video_price INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS creator_rate INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS text_message_price INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS image_message_price INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS audio_message_price INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS video_message_price INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS available_for_calls BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS total_sessions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_earnings NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_spent NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS token_balance INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS availability_schedule JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS auto_response_message TEXT,
ADD COLUMN IF NOT EXISTS analytics_visibility VARCHAR(50) DEFAULT 'private',
ADD COLUMN IF NOT EXISTS watermark_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(50) DEFAULT 'not_submitted',
ADD COLUMN IF NOT EXISTS kyc_submitted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS kyc_expiry_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
ADD COLUMN IF NOT EXISTS tv_trial_start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tv_trial_end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tv_trial_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT[];

-- ============================================================
-- SESSIONS TABLE - Ensure all critical columns exist
-- ============================================================
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS rate_per_minute_cents INTEGER,
ADD COLUMN IF NOT EXISTS total_cost_cents INTEGER,
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
ADD COLUMN IF NOT EXISTS is_private_call BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS private_call_session_id UUID;

-- ============================================================
-- PAYMENTS TABLE - Ensure all critical columns exist
-- ============================================================
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS amount_cents INTEGER,
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS status VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
ADD COLUMN IF NOT EXISTS request_id TEXT;

-- ============================================================
-- MESSAGES TABLE - Ensure all critical columns exist
-- ============================================================
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS price_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- ============================================================
-- PRIVATE_CALL_REQUESTS TABLE - Ensure it exists
-- ============================================================
CREATE TABLE IF NOT EXISTS private_call_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fan_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending',
    scheduled_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER DEFAULT 30,
    rate_per_minute_cents INTEGER,
    total_cost_cents INTEGER,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_private_call_requests_fan_id ON private_call_requests(fan_id);
CREATE INDEX IF NOT EXISTS idx_private_call_requests_creator_id ON private_call_requests(creator_id);
CREATE INDEX IF NOT EXISTS idx_private_call_requests_status ON private_call_requests(status);

-- ============================================================
-- PRIVATE_CALL_SESSIONS TABLE - Ensure it exists
-- ============================================================
CREATE TABLE IF NOT EXISTS private_call_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES private_call_requests(id) ON DELETE SET NULL,
    fan_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_name TEXT NOT NULL,
    agora_token TEXT,
    status VARCHAR(50) DEFAULT 'scheduled',
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    rate_per_minute_cents INTEGER,
    total_cost_cents INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_private_call_sessions_fan_id ON private_call_sessions(fan_id);
CREATE INDEX IF NOT EXISTS idx_private_call_sessions_creator_id ON private_call_sessions(creator_id);
CREATE INDEX IF NOT EXISTS idx_private_call_sessions_request_id ON private_call_sessions(request_id);

-- ============================================================
-- STREAMS TABLE - Ensure all critical columns exist
-- ============================================================
ALTER TABLE streams
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS viewer_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'scheduled',
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS price_tokens INTEGER DEFAULT 0;

-- ============================================================
-- CREATOR_OFFERS TABLE - Ensure it exists
-- ============================================================
CREATE TABLE IF NOT EXISTS creator_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category VARCHAR(100) DEFAULT 'General',
    price_tokens INTEGER NOT NULL,
    delivery_time VARCHAR(50),
    max_quantity INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creator_offers_creator_id ON creator_offers(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_offers_is_active ON creator_offers(is_active);

-- ============================================================
-- SHOP_ITEMS TABLE - Ensure all critical columns exist
-- ============================================================
ALTER TABLE shop_items
ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS price_cents INTEGER,
ADD COLUMN IF NOT EXISTS category VARCHAR(100),
ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_digital BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';

-- ============================================================
-- CALENDAR_EVENTS TABLE - Ensure all critical columns exist
-- ============================================================
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS title TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS event_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE NOT NULL,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMP WITH TIME ZONE NOT NULL,
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS recurrence_pattern JSONB,
ADD COLUMN IF NOT EXISTS max_attendees INTEGER,
ADD COLUMN IF NOT EXISTS price_tokens INTEGER DEFAULT 0;

-- ============================================================
-- NOTIFICATIONS TABLE - Ensure all critical columns exist
-- ============================================================
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL,
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS message TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS action_url TEXT;

-- ============================================================
-- FOLLOWERS TABLE - Ensure it exists
-- ============================================================
CREATE TABLE IF NOT EXISTS followers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_followers_follower_id ON followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_following_id ON followers(following_id);

-- ============================================================
-- Add missing indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_is_creator ON users(is_creator) WHERE is_creator = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_is_online ON users(is_online) WHERE is_online = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON users(supabase_id);
CREATE INDEX IF NOT EXISTS idx_sessions_creator_id ON sessions(creator_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- ============================================================
-- Verification Query
-- ============================================================
-- Check critical tables exist
SELECT 
    'Table Check' as check_type,
    table_name,
    'EXISTS' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name IN (
        'users', 'sessions', 'payments', 'messages', 'streams', 
        'private_call_requests', 'private_call_sessions', 
        'creator_offers', 'shop_items', 'calendar_events',
        'notifications', 'followers', 'analytics_events'
    )
ORDER BY table_name;

-- Check for analytics_events created_at column
SELECT 
    'Column Check' as check_type,
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'analytics_events' 
    AND column_name = 'created_at';
