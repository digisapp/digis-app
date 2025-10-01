-- Create client_logs table for logging client-side events
CREATE TABLE IF NOT EXISTS client_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    level VARCHAR(20),
    message TEXT,
    context JSONB,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create analytics_events table for tracking user events
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_name VARCHAR(100) NOT NULL,
    event_data JSONB,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id VARCHAR(255),
    page_url TEXT,
    referrer TEXT,
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_client_logs_user_id ON client_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_client_logs_timestamp ON client_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_client_logs_level ON client_logs(level);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_events(session_id);

-- Enable RLS
ALTER TABLE client_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for client_logs
CREATE POLICY "Users can insert their own logs" ON client_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can view their own logs" ON client_logs
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- RLS policies for analytics_events  
CREATE POLICY "Users can insert their own events" ON analytics_events
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can view their own events" ON analytics_events
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- Grant permissions
GRANT ALL ON client_logs TO authenticated;
GRANT ALL ON analytics_events TO authenticated;
GRANT ALL ON client_logs TO anon;
GRANT ALL ON analytics_events TO anon;