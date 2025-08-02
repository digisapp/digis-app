-- Migration: Add Analytics Tables
-- Description: Creates tables for storing analytics events and session metrics

-- Create analytics_events table for storing frontend events
CREATE TABLE IF NOT EXISTS analytics_events (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    creator_id VARCHAR(255),
    session_id VARCHAR(255),
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    batch_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_analytics_events_user_id (user_id),
    INDEX idx_analytics_events_creator_id (creator_id),
    INDEX idx_analytics_events_session_id (session_id),
    INDEX idx_analytics_events_event_type (event_type),
    INDEX idx_analytics_events_timestamp (timestamp),
    INDEX idx_analytics_events_batch_id (batch_id),
    
    -- Composite indexes for common queries
    INDEX idx_analytics_events_user_timestamp (user_id, timestamp DESC),
    INDEX idx_analytics_events_creator_timestamp (creator_id, timestamp DESC),
    INDEX idx_analytics_events_session_timestamp (session_id, timestamp DESC)
);

-- Create session_metrics table for storing detailed session analytics
CREATE TABLE IF NOT EXISTS session_metrics (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    duration INTEGER DEFAULT 0, -- in milliseconds
    quality_metrics JSONB DEFAULT '{}',
    revenue_metrics JSONB DEFAULT '{}',
    technical_metrics JSONB DEFAULT '{}',
    interactions_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_session_metrics_user_id (user_id),
    INDEX idx_session_metrics_start_time (start_time),
    INDEX idx_session_metrics_duration (duration),
    
    -- Constraints
    CONSTRAINT chk_session_metrics_duration_positive CHECK (duration >= 0),
    CONSTRAINT chk_session_metrics_interactions_positive CHECK (interactions_count >= 0)
);

-- Create analytics_aggregations table for pre-computed metrics
CREATE TABLE IF NOT EXISTS analytics_aggregations (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    metric_type VARCHAR(100) NOT NULL, -- 'daily', 'hourly', 'session_type', etc.
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    aggregation_data JSONB NOT NULL DEFAULT '{}',
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint to prevent duplicate aggregations
    UNIQUE (user_id, metric_type, period_start, period_end),
    
    -- Indexes
    INDEX idx_analytics_aggregations_user_metric (user_id, metric_type),
    INDEX idx_analytics_aggregations_period (period_start, period_end),
    INDEX idx_analytics_aggregations_computed (computed_at)
);

-- Create real_time_metrics table for live dashboard updates
CREATE TABLE IF NOT EXISTS real_time_metrics (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,2),
    metric_metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Unique constraint for latest metric values
    UNIQUE (user_id, metric_name),
    
    -- Indexes
    INDEX idx_real_time_metrics_user (user_id),
    INDEX idx_real_time_metrics_timestamp (timestamp),
    INDEX idx_real_time_metrics_expires (expires_at)
);

-- Create triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to session_metrics
CREATE TRIGGER update_session_metrics_updated_at 
    BEFORE UPDATE ON session_metrics 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add foreign key constraints (if users table exists)
DO $$
BEGIN
    -- Check if users table exists before adding constraints
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        -- Add foreign key for analytics_events
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                      WHERE constraint_name = 'fk_analytics_events_user_id') THEN
            ALTER TABLE analytics_events 
            ADD CONSTRAINT fk_analytics_events_user_id 
            FOREIGN KEY (user_id) REFERENCES users(firebase_uid) ON DELETE CASCADE;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                      WHERE constraint_name = 'fk_analytics_events_creator_id') THEN
            ALTER TABLE analytics_events 
            ADD CONSTRAINT fk_analytics_events_creator_id 
            FOREIGN KEY (creator_id) REFERENCES users(firebase_uid) ON DELETE CASCADE;
        END IF;
        
        -- Add foreign key for session_metrics
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                      WHERE constraint_name = 'fk_session_metrics_user_id') THEN
            ALTER TABLE session_metrics 
            ADD CONSTRAINT fk_session_metrics_user_id 
            FOREIGN KEY (user_id) REFERENCES users(firebase_uid) ON DELETE CASCADE;
        END IF;
        
        -- Add foreign key for analytics_aggregations
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                      WHERE constraint_name = 'fk_analytics_aggregations_user_id') THEN
            ALTER TABLE analytics_aggregations 
            ADD CONSTRAINT fk_analytics_aggregations_user_id 
            FOREIGN KEY (user_id) REFERENCES users(firebase_uid) ON DELETE CASCADE;
        END IF;
        
        -- Add foreign key for real_time_metrics
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                      WHERE constraint_name = 'fk_real_time_metrics_user_id') THEN
            ALTER TABLE real_time_metrics 
            ADD CONSTRAINT fk_real_time_metrics_user_id 
            FOREIGN KEY (user_id) REFERENCES users(firebase_uid) ON DELETE CASCADE;
        END IF;
    END IF;
END
$$;

-- Create indexes for JSONB columns to improve query performance
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_data_gin ON analytics_events USING GIN (event_data);
CREATE INDEX IF NOT EXISTS idx_session_metrics_quality_gin ON session_metrics USING GIN (quality_metrics);
CREATE INDEX IF NOT EXISTS idx_session_metrics_revenue_gin ON session_metrics USING GIN (revenue_metrics);
CREATE INDEX IF NOT EXISTS idx_session_metrics_technical_gin ON session_metrics USING GIN (technical_metrics);
CREATE INDEX IF NOT EXISTS idx_analytics_aggregations_data_gin ON analytics_aggregations USING GIN (aggregation_data);
CREATE INDEX IF NOT EXISTS idx_real_time_metrics_metadata_gin ON real_time_metrics USING GIN (metric_metadata);

-- Create view for session analytics with user info
CREATE OR REPLACE VIEW session_analytics_view AS
SELECT 
    sm.*,
    ae.event_type,
    ae.event_data,
    ae.timestamp as event_timestamp,
    u.username,
    u.is_creator
FROM session_metrics sm
LEFT JOIN analytics_events ae ON sm.session_id = ae.session_id
LEFT JOIN users u ON sm.user_id = u.firebase_uid
WHERE ae.event_type IN ('session_started', 'session_ended', 'revenue_generated')
ORDER BY sm.start_time DESC;

-- Create view for real-time dashboard data
CREATE OR REPLACE VIEW real_time_dashboard_view AS
SELECT 
    rtm.user_id,
    rtm.metric_name,
    rtm.metric_value,
    rtm.metric_metadata,
    rtm.timestamp,
    u.username,
    u.is_creator
FROM real_time_metrics rtm
LEFT JOIN users u ON rtm.user_id = u.firebase_uid
WHERE rtm.expires_at IS NULL OR rtm.expires_at > NOW()
ORDER BY rtm.timestamp DESC;

-- Add comments to tables
COMMENT ON TABLE analytics_events IS 'Stores all analytics events from frontend collectors';
COMMENT ON TABLE session_metrics IS 'Stores detailed metrics for video/voice call sessions';
COMMENT ON TABLE analytics_aggregations IS 'Pre-computed analytics metrics for performance';
COMMENT ON TABLE real_time_metrics IS 'Live metrics for real-time dashboard updates';

COMMENT ON COLUMN analytics_events.event_type IS 'Type of event: session_started, session_ended, page_view, etc.';
COMMENT ON COLUMN analytics_events.event_data IS 'JSON data specific to the event type';
COMMENT ON COLUMN session_metrics.duration IS 'Session duration in milliseconds';
COMMENT ON COLUMN session_metrics.quality_metrics IS 'Video/audio quality data';
COMMENT ON COLUMN session_metrics.revenue_metrics IS 'Revenue and token data';
COMMENT ON COLUMN session_metrics.technical_metrics IS 'Technical performance data';
COMMENT ON COLUMN real_time_metrics.expires_at IS 'When this metric expires (NULL for permanent)';

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE ON analytics_events TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE ON session_metrics TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON analytics_aggregations TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON real_time_metrics TO your_app_user;
-- GRANT SELECT ON session_analytics_view TO your_app_user;
-- GRANT SELECT ON real_time_dashboard_view TO your_app_user;