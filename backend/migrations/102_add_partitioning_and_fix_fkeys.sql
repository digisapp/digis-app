-- =====================================================
-- ADD PARTITIONING AND FIX REMAINING FOREIGN KEYS
-- =====================================================
-- This migration adds partitioning to high-volume tables and fixes any remaining foreign key issues

BEGIN;

-- =====================================================
-- STEP 1: UPDATE REMAINING TABLES TO USE SUPABASE_ID
-- =====================================================

-- First, let's fix tables that reference users(uid) which doesn't exist
-- These need to reference users(supabase_id) instead

-- Update creator_stripe_accounts
ALTER TABLE creator_stripe_accounts 
DROP CONSTRAINT IF EXISTS creator_stripe_accounts_creator_id_fkey;

ALTER TABLE creator_stripe_accounts 
ADD CONSTRAINT creator_stripe_accounts_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

-- Update creator_payouts
ALTER TABLE creator_payouts 
DROP CONSTRAINT IF EXISTS creator_payouts_creator_id_fkey;

ALTER TABLE creator_payouts 
ADD CONSTRAINT creator_payouts_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

-- Update creator_earnings
ALTER TABLE creator_earnings 
DROP CONSTRAINT IF EXISTS creator_earnings_creator_id_fkey;

ALTER TABLE creator_earnings 
ADD CONSTRAINT creator_earnings_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

-- Update creator_payout_settings
ALTER TABLE creator_payout_settings 
DROP CONSTRAINT IF EXISTS creator_payout_settings_creator_id_fkey;

ALTER TABLE creator_payout_settings 
ADD CONSTRAINT creator_payout_settings_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

-- Update analytics tables to use supabase_id
ALTER TABLE analytics_events 
DROP CONSTRAINT IF EXISTS fk_analytics_events_user_id,
DROP CONSTRAINT IF EXISTS fk_analytics_events_creator_id;

ALTER TABLE analytics_events 
ADD CONSTRAINT analytics_events_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE analytics_events 
ADD CONSTRAINT analytics_events_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

-- Update session_metrics
ALTER TABLE session_metrics 
DROP CONSTRAINT IF EXISTS fk_session_metrics_user_id;

ALTER TABLE session_metrics 
ADD CONSTRAINT session_metrics_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

-- Update analytics_aggregations
ALTER TABLE analytics_aggregations 
DROP CONSTRAINT IF EXISTS fk_analytics_aggregations_user_id;

ALTER TABLE analytics_aggregations 
ADD CONSTRAINT analytics_aggregations_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

-- Update real_time_metrics
ALTER TABLE real_time_metrics 
DROP CONSTRAINT IF EXISTS fk_real_time_metrics_user_id;

ALTER TABLE real_time_metrics 
ADD CONSTRAINT real_time_metrics_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

-- Update virtual gifts tables
ALTER TABLE gifts_sent 
DROP CONSTRAINT IF EXISTS gifts_sent_fan_id_fkey,
DROP CONSTRAINT IF EXISTS gifts_sent_creator_id_fkey;

ALTER TABLE gifts_sent 
ADD CONSTRAINT gifts_sent_fan_id_fkey 
FOREIGN KEY (fan_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE gifts_sent 
ADD CONSTRAINT gifts_sent_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE gift_transactions 
DROP CONSTRAINT IF EXISTS gift_transactions_fan_id_fkey,
DROP CONSTRAINT IF EXISTS gift_transactions_creator_id_fkey;

ALTER TABLE gift_transactions 
ADD CONSTRAINT gift_transactions_fan_id_fkey 
FOREIGN KEY (fan_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE gift_transactions 
ADD CONSTRAINT gift_transactions_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE creator_gift_settings 
DROP CONSTRAINT IF EXISTS creator_gift_settings_creator_id_fkey;

ALTER TABLE creator_gift_settings 
ADD CONSTRAINT creator_gift_settings_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

-- Update streaming tables
ALTER TABLE streams 
DROP CONSTRAINT IF EXISTS streams_creator_id_fkey;

ALTER TABLE streams 
ADD CONSTRAINT streams_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE stream_viewers 
DROP CONSTRAINT IF EXISTS stream_viewers_viewer_id_fkey;

ALTER TABLE stream_viewers 
ADD CONSTRAINT stream_viewers_viewer_id_fkey 
FOREIGN KEY (viewer_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE stream_messages 
DROP CONSTRAINT IF EXISTS stream_messages_sender_id_fkey;

ALTER TABLE stream_messages 
ADD CONSTRAINT stream_messages_sender_id_fkey 
FOREIGN KEY (sender_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

-- Update tips table
ALTER TABLE tips 
DROP CONSTRAINT IF EXISTS tips_creator_id_fkey;

ALTER TABLE tips 
ADD CONSTRAINT tips_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

-- Update withdrawals
ALTER TABLE withdrawals 
DROP CONSTRAINT IF EXISTS withdrawals_creator_id_fkey;

ALTER TABLE withdrawals 
ADD CONSTRAINT withdrawals_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

-- Update creator offers
ALTER TABLE creator_offers 
DROP CONSTRAINT IF EXISTS creator_offers_creator_id_fkey;

ALTER TABLE creator_offers 
ADD CONSTRAINT creator_offers_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE offer_redemptions 
DROP CONSTRAINT IF EXISTS offer_redemptions_user_id_fkey;

ALTER TABLE offer_redemptions 
ADD CONSTRAINT offer_redemptions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

-- Update TV subscriptions
ALTER TABLE tv_subscriptions 
DROP CONSTRAINT IF EXISTS tv_subscriptions_user_id_fkey;

ALTER TABLE tv_subscriptions 
ADD CONSTRAINT tv_subscriptions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE tv_subscription_transactions 
DROP CONSTRAINT IF EXISTS tv_subscription_transactions_user_id_fkey;

ALTER TABLE tv_subscription_transactions 
ADD CONSTRAINT tv_subscription_transactions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

-- Update connect features
ALTER TABLE creator_connect_profiles 
DROP CONSTRAINT IF EXISTS creator_connect_profiles_creator_id_fkey;

ALTER TABLE creator_connect_profiles 
ADD CONSTRAINT creator_connect_profiles_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE collaborations 
DROP CONSTRAINT IF EXISTS collaborations_creator_id_fkey;

ALTER TABLE collaborations 
ADD CONSTRAINT collaborations_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE collaboration_applications 
DROP CONSTRAINT IF EXISTS collaboration_applications_applicant_id_fkey;

ALTER TABLE collaboration_applications 
ADD CONSTRAINT collaboration_applications_applicant_id_fkey 
FOREIGN KEY (applicant_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE creator_trips 
DROP CONSTRAINT IF EXISTS creator_trips_creator_id_fkey;

ALTER TABLE creator_trips 
ADD CONSTRAINT creator_trips_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE trip_participants 
DROP CONSTRAINT IF EXISTS trip_participants_creator_id_fkey;

ALTER TABLE trip_participants 
ADD CONSTRAINT trip_participants_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE creator_meetups 
DROP CONSTRAINT IF EXISTS creator_meetups_host_id_fkey;

ALTER TABLE creator_meetups 
ADD CONSTRAINT creator_meetups_host_id_fkey 
FOREIGN KEY (host_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE meetup_attendees 
DROP CONSTRAINT IF EXISTS meetup_attendees_creator_id_fkey;

ALTER TABLE meetup_attendees 
ADD CONSTRAINT meetup_attendees_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE mentorship_profiles 
DROP CONSTRAINT IF EXISTS mentorship_profiles_creator_id_fkey;

ALTER TABLE mentorship_profiles 
ADD CONSTRAINT mentorship_profiles_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE mentorships 
DROP CONSTRAINT IF EXISTS mentorships_mentor_id_fkey,
DROP CONSTRAINT IF EXISTS mentorships_mentee_id_fkey;

ALTER TABLE mentorships 
ADD CONSTRAINT mentorships_mentor_id_fkey 
FOREIGN KEY (mentor_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE mentorships 
ADD CONSTRAINT mentorships_mentee_id_fkey 
FOREIGN KEY (mentee_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE mentorship_sessions 
DROP CONSTRAINT IF EXISTS mentorship_sessions_mentor_id_fkey,
DROP CONSTRAINT IF EXISTS mentorship_sessions_mentee_id_fkey;

ALTER TABLE mentorship_sessions 
ADD CONSTRAINT mentorship_sessions_mentor_id_fkey 
FOREIGN KEY (mentor_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE mentorship_sessions 
ADD CONSTRAINT mentorship_sessions_mentee_id_fkey 
FOREIGN KEY (mentee_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE forum_topics 
DROP CONSTRAINT IF EXISTS forum_topics_creator_id_fkey;

ALTER TABLE forum_topics 
ADD CONSTRAINT forum_topics_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE forum_replies 
DROP CONSTRAINT IF EXISTS forum_replies_creator_id_fkey;

ALTER TABLE forum_replies 
ADD CONSTRAINT forum_replies_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

-- Update enhanced call features
ALTER TABLE creator_pricing 
DROP CONSTRAINT IF EXISTS creator_pricing_creator_id_fkey;

ALTER TABLE creator_pricing 
ADD CONSTRAINT creator_pricing_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE call_queue 
DROP CONSTRAINT IF EXISTS call_queue_creator_id_fkey,
DROP CONSTRAINT IF EXISTS call_queue_fan_id_fkey;

ALTER TABLE call_queue 
ADD CONSTRAINT call_queue_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE call_queue 
ADD CONSTRAINT call_queue_fan_id_fkey 
FOREIGN KEY (fan_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE creator_blocked_users 
DROP CONSTRAINT IF EXISTS creator_blocked_users_creator_id_fkey,
DROP CONSTRAINT IF EXISTS creator_blocked_users_blocked_user_id_fkey;

ALTER TABLE creator_blocked_users 
ADD CONSTRAINT creator_blocked_users_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE creator_blocked_users 
ADD CONSTRAINT creator_blocked_users_blocked_user_id_fkey 
FOREIGN KEY (blocked_user_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE call_recordings 
DROP CONSTRAINT IF EXISTS call_recordings_creator_id_fkey,
DROP CONSTRAINT IF EXISTS call_recordings_fan_id_fkey;

ALTER TABLE call_recordings 
ADD CONSTRAINT call_recordings_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE call_recordings 
ADD CONSTRAINT call_recordings_fan_id_fkey 
FOREIGN KEY (fan_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE call_interactions 
DROP CONSTRAINT IF EXISTS call_interactions_creator_id_fkey,
DROP CONSTRAINT IF EXISTS call_interactions_fan_id_fkey;

ALTER TABLE call_interactions 
ADD CONSTRAINT call_interactions_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE call_interactions 
ADD CONSTRAINT call_interactions_fan_id_fkey 
FOREIGN KEY (fan_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE fan_engagement 
DROP CONSTRAINT IF EXISTS fan_engagement_fan_id_fkey,
DROP CONSTRAINT IF EXISTS fan_engagement_creator_id_fkey;

ALTER TABLE fan_engagement 
ADD CONSTRAINT fan_engagement_fan_id_fkey 
FOREIGN KEY (fan_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE fan_engagement 
ADD CONSTRAINT fan_engagement_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE creator_analytics 
DROP CONSTRAINT IF EXISTS creator_analytics_creator_id_fkey;

ALTER TABLE creator_analytics 
ADD CONSTRAINT creator_analytics_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE creator_peak_hours 
DROP CONSTRAINT IF EXISTS creator_peak_hours_creator_id_fkey;

ALTER TABLE creator_peak_hours 
ADD CONSTRAINT creator_peak_hours_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE call_reports 
DROP CONSTRAINT IF EXISTS call_reports_creator_id_fkey,
DROP CONSTRAINT IF EXISTS call_reports_fan_id_fkey,
DROP CONSTRAINT IF EXISTS call_reports_reported_by_fkey;

ALTER TABLE call_reports 
ADD CONSTRAINT call_reports_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE call_reports 
ADD CONSTRAINT call_reports_fan_id_fkey 
FOREIGN KEY (fan_id) REFERENCES users(supabase_id) ON DELETE CASCADE;

ALTER TABLE call_reports 
ADD CONSTRAINT call_reports_reported_by_fkey 
FOREIGN KEY (reported_by) REFERENCES users(supabase_id) ON DELETE CASCADE;

-- =====================================================
-- STEP 2: ADD PARTITIONING TO HIGH-VOLUME TABLES
-- =====================================================

-- Note: token_transactions was already partitioned in the main migration

-- Partition stream_messages table
CREATE TABLE stream_messages_new (
    id SERIAL,
    message_id UUID UNIQUE DEFAULT gen_random_uuid(),
    stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    content TEXT,
    message_type VARCHAR(20) DEFAULT 'text',
    tip_id VARCHAR(255),
    gift_sent_id UUID REFERENCES gifts_sent(id),
    is_highlighted BOOLEAN DEFAULT false,
    is_pinned BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for 2025
CREATE TABLE stream_messages_2025_q1 PARTITION OF stream_messages_new
    FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');
CREATE TABLE stream_messages_2025_q2 PARTITION OF stream_messages_new
    FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');
CREATE TABLE stream_messages_2025_q3 PARTITION OF stream_messages_new
    FOR VALUES FROM ('2025-07-01') TO ('2025-10-01');
CREATE TABLE stream_messages_2025_q4 PARTITION OF stream_messages_new
    FOR VALUES FROM ('2025-10-01') TO ('2026-01-01');

-- Copy existing data
INSERT INTO stream_messages_new 
SELECT * FROM stream_messages;

-- Drop old table and rename
DROP TABLE stream_messages CASCADE;
ALTER TABLE stream_messages_new RENAME TO stream_messages;

-- Recreate indexes
CREATE INDEX idx_stream_messages_stream_id ON stream_messages(stream_id);
CREATE INDEX idx_stream_messages_sender_id ON stream_messages(sender_id);
CREATE INDEX idx_stream_messages_created_at ON stream_messages(created_at DESC);

-- Partition memberships table
CREATE TABLE memberships_new (
    id SERIAL,
    user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    tier_id INTEGER NOT NULL REFERENCES membership_tiers(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    price_paid DECIMAL(10,2),
    payment_method VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    next_billing_date TIMESTAMP WITH TIME ZONE,
    tokens_remaining INTEGER DEFAULT 0,
    cancellation_reason TEXT,
    upgraded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for 2025
CREATE TABLE memberships_2025_q1 PARTITION OF memberships_new
    FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');
CREATE TABLE memberships_2025_q2 PARTITION OF memberships_new
    FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');
CREATE TABLE memberships_2025_q3 PARTITION OF memberships_new
    FOR VALUES FROM ('2025-07-01') TO ('2025-10-01');
CREATE TABLE memberships_2025_q4 PARTITION OF memberships_new
    FOR VALUES FROM ('2025-10-01') TO ('2026-01-01');

-- Copy existing data
INSERT INTO memberships_new 
SELECT * FROM memberships;

-- Drop old table and rename
DROP TABLE memberships CASCADE;
ALTER TABLE memberships_new RENAME TO memberships;

-- Recreate indexes
CREATE INDEX idx_memberships_user_id ON memberships(user_id);
CREATE INDEX idx_memberships_creator_id ON memberships(creator_id);
CREATE INDEX idx_memberships_tier_id ON memberships(tier_id);
CREATE INDEX idx_memberships_status ON memberships(status);
CREATE INDEX idx_memberships_created_at ON memberships(created_at);

-- Add unique constraint
ALTER TABLE memberships ADD CONSTRAINT memberships_user_tier_unique 
    UNIQUE (user_id, tier_id);

-- Partition content_views table
CREATE TABLE content_views_new (
    id VARCHAR(255),
    user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    content_id VARCHAR(255) NOT NULL REFERENCES creator_content(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id, viewed_at)
) PARTITION BY RANGE (viewed_at);

-- Create partitions for 2025
CREATE TABLE content_views_2025_q1 PARTITION OF content_views_new
    FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');
CREATE TABLE content_views_2025_q2 PARTITION OF content_views_new
    FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');
CREATE TABLE content_views_2025_q3 PARTITION OF content_views_new
    FOR VALUES FROM ('2025-07-01') TO ('2025-10-01');
CREATE TABLE content_views_2025_q4 PARTITION OF content_views_new
    FOR VALUES FROM ('2025-10-01') TO ('2026-01-01');

-- Copy existing data
INSERT INTO content_views_new 
SELECT * FROM content_views;

-- Drop old table and rename
DROP TABLE content_views CASCADE;
ALTER TABLE content_views_new RENAME TO content_views;

-- Recreate indexes
CREATE INDEX idx_content_views_user_id ON content_views(user_id);
CREATE INDEX idx_content_views_content_id ON content_views(content_id);
CREATE INDEX idx_content_views_viewed_at ON content_views(viewed_at DESC);

-- Partition analytics_events table
CREATE TABLE analytics_events_new (
    id SERIAL,
    event_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(100),
    event_action VARCHAR(100),
    event_label VARCHAR(255),
    event_value DECIMAL(10,2),
    properties JSONB DEFAULT '{}',
    session_id VARCHAR(255),
    device_info JSONB DEFAULT '{}',
    location_info JSONB DEFAULT '{}',
    referrer_info JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for 2025
CREATE TABLE analytics_events_2025_q1 PARTITION OF analytics_events_new
    FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');
CREATE TABLE analytics_events_2025_q2 PARTITION OF analytics_events_new
    FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');
CREATE TABLE analytics_events_2025_q3 PARTITION OF analytics_events_new
    FOR VALUES FROM ('2025-07-01') TO ('2025-10-01');
CREATE TABLE analytics_events_2025_q4 PARTITION OF analytics_events_new
    FOR VALUES FROM ('2025-10-01') TO ('2026-01-01');

-- Copy existing data
INSERT INTO analytics_events_new 
SELECT * FROM analytics_events;

-- Drop old table and rename
DROP TABLE analytics_events CASCADE;
ALTER TABLE analytics_events_new RENAME TO analytics_events;

-- Recreate indexes
CREATE INDEX idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_creator_id ON analytics_events(creator_id);
CREATE INDEX idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at DESC);
CREATE INDEX idx_analytics_events_properties_gin ON analytics_events USING gin(properties);

-- =====================================================
-- STEP 3: RECREATE RLS POLICIES FOR PARTITIONED TABLES
-- =====================================================

-- Enable RLS on new partitioned tables
ALTER TABLE stream_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Stream messages policies
CREATE POLICY stream_messages_select ON stream_messages FOR SELECT 
    USING (auth.uid() IN (SELECT viewer_id FROM stream_viewers WHERE stream_id = stream_messages.stream_id));
CREATE POLICY stream_messages_insert ON stream_messages FOR INSERT 
    WITH CHECK (auth.uid() = sender_id);

-- Memberships policies
CREATE POLICY memberships_select ON memberships FOR SELECT 
    USING (auth.uid() IN (user_id, creator_id));
CREATE POLICY memberships_insert ON memberships FOR INSERT 
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY memberships_update ON memberships FOR UPDATE 
    USING (auth.uid() IN (user_id, creator_id));

-- Content views policies
CREATE POLICY content_views_select ON content_views FOR SELECT 
    USING (auth.uid() = user_id OR auth.uid() = (SELECT creator_id FROM creator_content WHERE id = content_id));
CREATE POLICY content_views_insert ON content_views FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Analytics events policies
CREATE POLICY analytics_events_select ON analytics_events FOR SELECT 
    USING (auth.uid() IN (user_id, creator_id));
CREATE POLICY analytics_events_insert ON analytics_events FOR INSERT 
    WITH CHECK (auth.uid() IN (user_id, creator_id));

COMMIT;