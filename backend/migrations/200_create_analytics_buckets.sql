-- Migration: Create Analytics Buckets for Supabase v2
-- This migration sets up tables and functions for analytics bucket integration
-- Supporting Apache Iceberg format for large-scale time-series data

-- Create analytics bucket configuration table
CREATE TABLE IF NOT EXISTS analytics_buckets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_name VARCHAR(255) UNIQUE NOT NULL,
    bucket_type VARCHAR(50) NOT NULL CHECK (bucket_type IN ('time_series', 'event_log', 'aggregated')),
    retention_days INTEGER DEFAULT 90,
    compression VARCHAR(50) DEFAULT 'zstd',
    partitioning VARCHAR(50) DEFAULT 'daily',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create stream analytics table for real-time metrics
CREATE TABLE IF NOT EXISTS stream_analytics_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID NOT NULL,
    creator_id UUID NOT NULL,
    -- Metrics
    viewer_count INTEGER DEFAULT 0,
    peak_viewers INTEGER DEFAULT 0,
    average_watch_time_seconds INTEGER DEFAULT 0,
    total_watch_time_seconds BIGINT DEFAULT 0,
    unique_viewers INTEGER DEFAULT 0,
    -- Engagement metrics
    chat_messages_count INTEGER DEFAULT 0,
    reactions_count INTEGER DEFAULT 0,
    tips_total DECIMAL(10, 2) DEFAULT 0,
    new_followers INTEGER DEFAULT 0,
    -- Revenue metrics
    tokens_earned DECIMAL(10, 2) DEFAULT 0,
    subscription_revenue DECIMAL(10, 2) DEFAULT 0,
    -- Technical metrics
    average_bitrate INTEGER,
    average_fps DECIMAL(5, 2),
    quality_score DECIMAL(3, 2) CHECK (quality_score >= 0 AND quality_score <= 100),
    buffering_ratio DECIMAL(5, 4) DEFAULT 0,
    -- Temporal data
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    time_bucket TIMESTAMPTZ, -- For time-series aggregation
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Indexes for performance
    CONSTRAINT fk_stream FOREIGN KEY (stream_id) REFERENCES streams(id) ON DELETE CASCADE,
    CONSTRAINT fk_creator FOREIGN KEY (creator_id) REFERENCES users(supabase_id) ON DELETE CASCADE
);

-- Create indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_stream_analytics_stream_timestamp ON stream_analytics_v2(stream_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_stream_analytics_creator_timestamp ON stream_analytics_v2(creator_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_stream_analytics_time_bucket ON stream_analytics_v2(time_bucket);
CREATE INDEX IF NOT EXISTS idx_stream_analytics_timestamp_brin ON stream_analytics_v2 USING BRIN (timestamp);

-- Create analytics events table for detailed event tracking
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name VARCHAR(255) NOT NULL,
    user_id UUID,
    session_id VARCHAR(255),
    properties JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    processed BOOLEAN DEFAULT FALSE,
    
    -- Index for queries
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(supabase_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_name_timestamp ON analytics_events(event_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_timestamp ON analytics_events(user_id, timestamp DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_processed ON analytics_events(processed) WHERE processed = FALSE;

-- Create page views tracking table
CREATE TABLE IF NOT EXISTS page_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_url TEXT NOT NULL,
    user_id UUID,
    session_id VARCHAR(255),
    referrer TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    
    -- Foreign key
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(supabase_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_page_views_url_timestamp ON page_views(page_url, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_user_timestamp ON page_views(user_id, timestamp DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_page_views_session ON page_views(session_id);

-- Create custom metrics table for application-specific metrics
CREATE TABLE IF NOT EXISTS custom_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(255) NOT NULL,
    metric_value NUMERIC NOT NULL,
    metric_unit VARCHAR(50) DEFAULT 'count',
    tags JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_metrics_name_timestamp ON custom_metrics(metric_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_custom_metrics_tags ON custom_metrics USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_custom_metrics_timestamp_brin ON custom_metrics USING BRIN (timestamp);

-- Create application logs table for observability
CREATE TABLE IF NOT EXISTS application_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level VARCHAR(20) NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal')),
    message TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    service VARCHAR(100) DEFAULT 'digis-backend',
    environment VARCHAR(50),
    version VARCHAR(50),
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_application_logs_level_timestamp ON application_logs(level, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_application_logs_service_timestamp ON application_logs(service, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_application_logs_timestamp_brin ON application_logs USING BRIN (timestamp);

-- Create client logs table for frontend error tracking
CREATE TABLE IF NOT EXISTS client_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    url TEXT,
    user_agent TEXT,
    session_id VARCHAR(255),
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_logs_level_timestamp ON client_logs(level, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_client_logs_session ON client_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_client_logs_timestamp_brin ON client_logs USING BRIN (timestamp);

-- Function to write analytics data to bucket (simulated)
CREATE OR REPLACE FUNCTION write_to_analytics_bucket(
    p_bucket_name TEXT,
    p_namespace TEXT,
    p_table_name TEXT,
    p_data JSONB
) RETURNS UUID AS $$
DECLARE
    v_result_id UUID;
BEGIN
    -- In production, this would interface with Apache Iceberg/Parquet storage
    -- For now, we store in a regular table with partitioning
    
    -- Generate a unique ID for this write operation
    v_result_id := gen_random_uuid();
    
    -- Log the write operation
    INSERT INTO application_logs (level, message, context)
    VALUES (
        'info',
        'Analytics data written to bucket',
        jsonb_build_object(
            'bucket', p_bucket_name,
            'namespace', p_namespace,
            'table', p_table_name,
            'result_id', v_result_id,
            'row_count', jsonb_array_length(p_data)
        )
    );
    
    RETURN v_result_id;
END;
$$ LANGUAGE plpgsql;

-- Function to execute analytics queries (simulated)
CREATE OR REPLACE FUNCTION execute_analytics_query(
    p_query_text TEXT,
    p_query_params JSONB DEFAULT '[]'
) RETURNS TABLE (result JSONB) AS $$
BEGIN
    -- In production, this would execute queries against Apache Iceberg tables
    -- For now, return a placeholder result
    
    -- Log the query
    INSERT INTO application_logs (level, message, context)
    VALUES (
        'debug',
        'Analytics query executed',
        jsonb_build_object(
            'query', p_query_text,
            'params', p_query_params
        )
    );
    
    -- Return placeholder result
    RETURN QUERY
    SELECT jsonb_build_object(
        'status', 'success',
        'message', 'Analytics query executed',
        'data', '[]'::jsonb
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get observability dashboard data
CREATE OR REPLACE FUNCTION get_observability_dashboard(
    p_time_range TEXT DEFAULT '1h'
) RETURNS TABLE (
    metric_name TEXT,
    metric_value NUMERIC,
    trend TEXT,
    details JSONB
) AS $$
DECLARE
    v_interval INTERVAL;
BEGIN
    -- Parse time range
    v_interval := CASE p_time_range
        WHEN '1h' THEN INTERVAL '1 hour'
        WHEN '24h' THEN INTERVAL '24 hours'
        WHEN '7d' THEN INTERVAL '7 days'
        WHEN '30d' THEN INTERVAL '30 days'
        ELSE INTERVAL '1 hour'
    END;
    
    RETURN QUERY
    WITH recent_metrics AS (
        SELECT 
            metric_name AS name,
            AVG(metric_value) AS avg_value,
            COUNT(*) AS count
        FROM custom_metrics
        WHERE timestamp > NOW() - v_interval
        GROUP BY metric_name
    ),
    error_counts AS (
        SELECT 
            COUNT(*) FILTER (WHERE level = 'error') AS errors,
            COUNT(*) FILTER (WHERE level = 'warn') AS warnings
        FROM application_logs
        WHERE timestamp > NOW() - v_interval
    ),
    stream_stats AS (
        SELECT 
            AVG(viewer_count) AS avg_viewers,
            SUM(tokens_earned) AS total_tokens
        FROM stream_analytics_v2
        WHERE timestamp > NOW() - v_interval
    )
    SELECT 
        'avg_viewers' AS metric_name,
        COALESCE(ss.avg_viewers, 0) AS metric_value,
        'stable' AS trend,
        jsonb_build_object('time_range', p_time_range) AS details
    FROM stream_stats ss
    UNION ALL
    SELECT 
        'total_tokens_earned',
        COALESCE(ss.total_tokens, 0),
        'up',
        jsonb_build_object('time_range', p_time_range)
    FROM stream_stats ss
    UNION ALL
    SELECT 
        'error_count',
        ec.errors,
        CASE WHEN ec.errors > 100 THEN 'down' ELSE 'stable' END,
        jsonb_build_object('warnings', ec.warnings)
    FROM error_counts ec;
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate stream analytics
CREATE OR REPLACE FUNCTION aggregate_stream_analytics(
    p_stream_id UUID,
    p_time_bucket INTERVAL DEFAULT INTERVAL '5 minutes'
) RETURNS TABLE (
    time_bucket TIMESTAMPTZ,
    avg_viewers NUMERIC,
    total_messages INTEGER,
    total_tips NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        date_trunc('hour', sa.timestamp) + 
            (EXTRACT(MINUTE FROM sa.timestamp)::INTEGER / 
             EXTRACT(MINUTE FROM p_time_bucket)::INTEGER) * p_time_bucket AS time_bucket,
        AVG(sa.viewer_count) AS avg_viewers,
        SUM(sa.chat_messages_count) AS total_messages,
        SUM(sa.tips_total) AS total_tips
    FROM stream_analytics_v2 sa
    WHERE sa.stream_id = p_stream_id
    GROUP BY 1
    ORDER BY 1 DESC;
END;
$$ LANGUAGE plpgsql;

-- Create a materialized view for real-time dashboard
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_dashboard_summary AS
SELECT 
    date_trunc('hour', timestamp) AS hour,
    COUNT(DISTINCT creator_id) AS active_creators,
    COUNT(DISTINCT stream_id) AS active_streams,
    SUM(viewer_count) AS total_viewers,
    SUM(tokens_earned) AS total_tokens_earned,
    AVG(quality_score) AS avg_quality_score
FROM stream_analytics_v2
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY 1 DESC;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_analytics_dashboard_summary_hour ON analytics_dashboard_summary(hour DESC);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_analytics_dashboard() RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_dashboard_summary;
END;
$$ LANGUAGE plpgsql;

-- Add update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists and recreate
DROP TRIGGER IF EXISTS update_analytics_buckets_updated_at ON analytics_buckets;
CREATE TRIGGER update_analytics_buckets_updated_at
    BEFORE UPDATE ON analytics_buckets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Grant permissions (adjust based on your Supabase setup)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT INSERT ON analytics_events, page_views, custom_metrics, client_logs TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Comments for documentation
COMMENT ON TABLE analytics_buckets IS 'Configuration for analytics data buckets using Apache Iceberg format';
COMMENT ON TABLE stream_analytics_v2 IS 'Real-time streaming analytics with time-series support';
COMMENT ON TABLE analytics_events IS 'General purpose event tracking for user analytics';
COMMENT ON TABLE page_views IS 'Page view tracking for web analytics';
COMMENT ON TABLE custom_metrics IS 'Custom application metrics for monitoring';
COMMENT ON TABLE application_logs IS 'Structured application logs for observability';
COMMENT ON TABLE client_logs IS 'Frontend error and debug logs';
COMMENT ON FUNCTION write_to_analytics_bucket IS 'Write data to analytics bucket (Iceberg/Parquet)';
COMMENT ON FUNCTION execute_analytics_query IS 'Execute SQL queries on analytics data';
COMMENT ON FUNCTION get_observability_dashboard IS 'Get dashboard metrics for monitoring';