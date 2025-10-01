-- Migration: Enhanced call features and creator systems
-- Description: Add tables and columns for comprehensive call management

-- Enhanced user availability and preferences
ALTER TABLE users ADD COLUMN IF NOT EXISTS availability_status VARCHAR(20) DEFAULT 'offline' CHECK (availability_status IN ('online', 'busy', 'away', 'dnd', 'offline'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_greeting TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS min_session_duration INTEGER DEFAULT 5;
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_session_duration INTEGER DEFAULT 60;
ALTER TABLE users ADD COLUMN IF NOT EXISTS require_verification BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_accept_regulars BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Creator pricing preferences
CREATE TABLE IF NOT EXISTS creator_pricing (
    id SERIAL PRIMARY KEY,
    creator_id VARCHAR(255) NOT NULL REFERENCES users(firebase_uid),
    service_type VARCHAR(20) NOT NULL CHECK (service_type IN ('video', 'voice', 'message', 'stream')),
    base_rate DECIMAL(10,2) NOT NULL DEFAULT 5.00,
    peak_hour_multiplier DECIMAL(3,2) DEFAULT 1.0,
    demand_multiplier DECIMAL(3,2) DEFAULT 1.0,
    loyalty_discount DECIMAL(3,2) DEFAULT 0.0,
    bulk_discount_30min DECIMAL(3,2) DEFAULT 0.0,
    bulk_discount_60min DECIMAL(3,2) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(creator_id, service_type)
);

-- Call queue system
CREATE TABLE IF NOT EXISTS call_queue (
    id SERIAL PRIMARY KEY,
    creator_id VARCHAR(255) NOT NULL REFERENCES users(firebase_uid),
    fan_id VARCHAR(255) NOT NULL REFERENCES users(firebase_uid),
    session_type VARCHAR(20) NOT NULL CHECK (session_type IN ('video', 'voice')),
    estimated_duration INTEGER DEFAULT 10,
    estimated_cost DECIMAL(10,2) NOT NULL,
    queue_position INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'expired', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '30 minutes'
);

-- Creator blocked users
CREATE TABLE IF NOT EXISTS creator_blocked_users (
    id SERIAL PRIMARY KEY,
    creator_id VARCHAR(255) NOT NULL REFERENCES users(firebase_uid),
    blocked_user_id VARCHAR(255) NOT NULL REFERENCES users(firebase_uid),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(creator_id, blocked_user_id)
);

-- Enhanced call requests with more details
ALTER TABLE call_requests ADD COLUMN IF NOT EXISTS queue_id INTEGER REFERENCES call_queue(id);
ALTER TABLE call_requests ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(10,2);
ALTER TABLE call_requests ADD COLUMN IF NOT EXISTS priority_level VARCHAR(20) DEFAULT 'normal' CHECK (priority_level IN ('normal', 'priority', 'vip'));
ALTER TABLE call_requests ADD COLUMN IF NOT EXISTS fan_tier VARCHAR(20) DEFAULT 'newcomer';
ALTER TABLE call_requests ADD COLUMN IF NOT EXISTS auto_accepted BOOLEAN DEFAULT FALSE;

-- Call recordings
CREATE TABLE IF NOT EXISTS call_recordings (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    call_request_id VARCHAR(255) REFERENCES call_requests(id),
    recording_url TEXT,
    thumbnail_url TEXT,
    duration_seconds INTEGER,
    file_size_mb DECIMAL(10,2),
    price_tokens INTEGER DEFAULT 50,
    creator_consent BOOLEAN DEFAULT FALSE,
    fan_consent BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'expired', 'deleted')),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '30 days',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Call interactions (gifts, reactions, etc.)
CREATE TABLE IF NOT EXISTS call_interactions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    sender_id VARCHAR(255) NOT NULL REFERENCES users(firebase_uid),
    interaction_type VARCHAR(30) NOT NULL CHECK (interaction_type IN ('gift', 'reaction', 'tip', 'poll_vote', 'game_action')),
    interaction_data JSONB NOT NULL,
    token_cost INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fan engagement tracking
CREATE TABLE IF NOT EXISTS fan_engagement (
    id SERIAL PRIMARY KEY,
    fan_id VARCHAR(255) NOT NULL REFERENCES users(firebase_uid),
    creator_id VARCHAR(255) NOT NULL REFERENCES users(firebase_uid),
    total_calls INTEGER DEFAULT 0,
    total_minutes INTEGER DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0.00,
    last_call_at TIMESTAMP WITH TIME ZONE,
    loyalty_tier VARCHAR(20) DEFAULT 'newcomer' CHECK (loyalty_tier IN ('newcomer', 'regular', 'vip', 'legend')),
    loyalty_points INTEGER DEFAULT 0,
    favorite_times JSONB,
    preferences JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(fan_id, creator_id)
);

-- Creator analytics and performance
CREATE TABLE IF NOT EXISTS creator_analytics (
    id SERIAL PRIMARY KEY,
    creator_id VARCHAR(255) NOT NULL REFERENCES users(firebase_uid),
    date_recorded DATE NOT NULL,
    total_calls INTEGER DEFAULT 0,
    total_minutes INTEGER DEFAULT 0,
    total_earnings DECIMAL(10,2) DEFAULT 0.00,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    peak_hour INTEGER,
    most_popular_service VARCHAR(20),
    unique_fans INTEGER DEFAULT 0,
    repeat_customers INTEGER DEFAULT 0,
    queue_wait_time_avg INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(creator_id, date_recorded)
);

-- Creator peak hours configuration
CREATE TABLE IF NOT EXISTS creator_peak_hours (
    id SERIAL PRIMARY KEY,
    creator_id VARCHAR(255) NOT NULL REFERENCES users(firebase_uid),
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday
    start_hour INTEGER NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
    end_hour INTEGER NOT NULL CHECK (end_hour >= 0 AND end_hour <= 23),
    multiplier DECIMAL(3,2) DEFAULT 1.5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(creator_id, day_of_week, start_hour)
);

-- Safety and moderation
CREATE TABLE IF NOT EXISTS call_reports (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    reporter_id VARCHAR(255) NOT NULL REFERENCES users(firebase_uid),
    reported_user_id VARCHAR(255) NOT NULL REFERENCES users(firebase_uid),
    report_type VARCHAR(30) NOT NULL CHECK (report_type IN ('inappropriate_content', 'harassment', 'spam', 'safety_concern', 'technical_issue')),
    description TEXT NOT NULL,
    evidence_urls TEXT[],
    auto_recorded BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),
    moderator_id VARCHAR(255) REFERENCES users(firebase_uid),
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Enhanced notifications system
CREATE TABLE IF NOT EXISTS notification_templates (
    id SERIAL PRIMARY KEY,
    template_name VARCHAR(50) NOT NULL UNIQUE,
    title_template VARCHAR(255) NOT NULL,
    message_template TEXT NOT NULL,
    category VARCHAR(30) NOT NULL,
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User notification preferences (enhanced)
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "push": true, "sms": false, "in_app": true}';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_availability ON users(availability_status);
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_creator_pricing_creator ON creator_pricing(creator_id);
CREATE INDEX IF NOT EXISTS idx_call_queue_creator_status ON call_queue(creator_id, status);
CREATE INDEX IF NOT EXISTS idx_call_queue_expires ON call_queue(expires_at);
CREATE INDEX IF NOT EXISTS idx_creator_blocked_creator ON creator_blocked_users(creator_id);
CREATE INDEX IF NOT EXISTS idx_call_recordings_session ON call_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_call_interactions_session ON call_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_fan_engagement_fan_creator ON fan_engagement(fan_id, creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_analytics_creator_date ON creator_analytics(creator_id, date_recorded);
CREATE INDEX IF NOT EXISTS idx_call_reports_status ON call_reports(status);
CREATE INDEX IF NOT EXISTS idx_call_reports_session ON call_reports(session_id);

-- Functions for automatic queue management
CREATE OR REPLACE FUNCTION update_queue_positions()
RETURNS TRIGGER AS $$
BEGIN
    -- Reorder queue positions when a call is removed
    UPDATE call_queue 
    SET queue_position = queue_position - 1
    WHERE creator_id = OLD.creator_id 
    AND queue_position > OLD.queue_position
    AND status = 'waiting';
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger for queue management
DROP TRIGGER IF EXISTS trigger_update_queue_positions ON call_queue;
CREATE TRIGGER trigger_update_queue_positions
    AFTER DELETE ON call_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_queue_positions();

-- Function to calculate dynamic pricing
CREATE OR REPLACE FUNCTION calculate_dynamic_price(
    p_creator_id VARCHAR(255),
    p_service_type VARCHAR(20),
    p_duration_minutes INTEGER DEFAULT 10
)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    base_rate DECIMAL(10,2);
    final_rate DECIMAL(10,2);
    peak_multiplier DECIMAL(3,2) := 1.0;
    demand_multiplier DECIMAL(3,2) := 1.0;
    bulk_discount DECIMAL(3,2) := 0.0;
    current_hour INTEGER;
    queue_count INTEGER;
BEGIN
    -- Get base pricing
    SELECT cp.base_rate, cp.peak_hour_multiplier, cp.demand_multiplier, 
           cp.bulk_discount_30min, cp.bulk_discount_60min
    INTO base_rate, peak_multiplier, demand_multiplier, bulk_discount, bulk_discount
    FROM creator_pricing cp
    WHERE cp.creator_id = p_creator_id AND cp.service_type = p_service_type;
    
    -- Use default if no custom pricing found
    IF base_rate IS NULL THEN
        base_rate := CASE p_service_type
            WHEN 'video' THEN 8.00
            WHEN 'voice' THEN 6.00
            WHEN 'stream' THEN 5.00
            ELSE 5.00
        END;
    END IF;
    
    -- Check if it's peak hours
    current_hour := EXTRACT(HOUR FROM NOW());
    IF EXISTS (
        SELECT 1 FROM creator_peak_hours cph
        WHERE cph.creator_id = p_creator_id 
        AND cph.day_of_week = EXTRACT(DOW FROM NOW())
        AND current_hour BETWEEN cph.start_hour AND cph.end_hour
    ) THEN
        SELECT cph.multiplier INTO peak_multiplier
        FROM creator_peak_hours cph
        WHERE cph.creator_id = p_creator_id 
        AND cph.day_of_week = EXTRACT(DOW FROM NOW())
        AND current_hour BETWEEN cph.start_hour AND cph.end_hour
        LIMIT 1;
    END IF;
    
    -- Calculate demand multiplier based on queue length
    SELECT COUNT(*) INTO queue_count
    FROM call_queue cq
    WHERE cq.creator_id = p_creator_id AND cq.status = 'waiting';
    
    IF queue_count > 5 THEN
        demand_multiplier := 1.3;
    ELSIF queue_count > 2 THEN
        demand_multiplier := 1.1;
    END IF;
    
    -- Apply bulk discount for longer sessions
    IF p_duration_minutes >= 60 THEN
        bulk_discount := 0.10; -- 10% off for 60+ minutes
    ELSIF p_duration_minutes >= 30 THEN
        bulk_discount := 0.05; -- 5% off for 30+ minutes
    END IF;
    
    -- Calculate final rate
    final_rate := base_rate * peak_multiplier * demand_multiplier * (1 - bulk_discount);
    
    RETURN ROUND(final_rate, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to update fan loyalty tier
CREATE OR REPLACE FUNCTION update_fan_loyalty_tier()
RETURNS TRIGGER AS $$
DECLARE
    new_tier VARCHAR(20);
BEGIN
    -- Determine new loyalty tier based on total spent and calls
    IF NEW.total_spent >= 1000 OR NEW.total_calls >= 50 THEN
        new_tier := 'legend';
    ELSIF NEW.total_spent >= 500 OR NEW.total_calls >= 25 THEN
        new_tier := 'vip';
    ELSIF NEW.total_spent >= 100 OR NEW.total_calls >= 10 THEN
        new_tier := 'regular';
    ELSE
        new_tier := 'newcomer';
    END IF;
    
    -- Update loyalty tier if changed
    IF NEW.loyalty_tier != new_tier THEN
        NEW.loyalty_tier := new_tier;
        NEW.loyalty_points := NEW.loyalty_points + 
            CASE new_tier
                WHEN 'legend' THEN 100
                WHEN 'vip' THEN 50
                WHEN 'regular' THEN 25
                ELSE 0
            END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for fan loyalty updates
DROP TRIGGER IF EXISTS trigger_update_fan_loyalty ON fan_engagement;
CREATE TRIGGER trigger_update_fan_loyalty
    BEFORE UPDATE ON fan_engagement
    FOR EACH ROW
    EXECUTE FUNCTION update_fan_loyalty_tier();

-- Insert default notification templates
INSERT INTO notification_templates (template_name, title_template, message_template, category, priority)
VALUES 
    ('call_request', 'Incoming {session_type} call', '{fan_username} wants to start a {session_type} call', 'call', 'high'),
    ('call_accepted', 'Call accepted', '{creator_username} accepted your call request', 'call', 'high'),
    ('call_declined', 'Call declined', '{creator_username} declined your call request', 'call', 'normal'),
    ('queue_position', 'Queue update', 'You are #{position} in {creator_username}''s queue', 'call', 'normal'),
    ('earnings_milestone', 'Earnings milestone', 'Congratulations! You''ve earned ${amount} today', 'earnings', 'normal'),
    ('loyalty_upgrade', 'Loyalty upgrade', 'You''ve been upgraded to {tier} status with {creator_username}', 'loyalty', 'normal'),
    ('recording_ready', 'Recording ready', 'Your call recording with {username} is ready to view', 'recording', 'normal')
ON CONFLICT (template_name) DO NOTHING;