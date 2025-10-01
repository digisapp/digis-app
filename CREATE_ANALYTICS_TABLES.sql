-- Run this SQL in your Supabase SQL Editor (SQL Editor tab in Supabase Dashboard)

-- Create client_logs table for logging client-side events
CREATE TABLE IF NOT EXISTS public.client_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    level VARCHAR(20),
    message TEXT,
    context JSONB,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create analytics_events table for tracking user events
CREATE TABLE IF NOT EXISTS public.analytics_events (
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
CREATE INDEX IF NOT EXISTS idx_client_logs_user_id ON public.client_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_client_logs_timestamp ON public.client_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_client_logs_level ON public.client_logs(level);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON public.analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON public.analytics_events(session_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.client_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can insert their own logs" ON public.client_logs;
DROP POLICY IF EXISTS "Users can view their own logs" ON public.client_logs;
DROP POLICY IF EXISTS "Users can insert their own events" ON public.analytics_events;
DROP POLICY IF EXISTS "Users can view their own events" ON public.analytics_events;

-- RLS policies for client_logs
-- Allow users to insert logs (even anonymous)
CREATE POLICY "Users can insert their own logs" ON public.client_logs
    FOR INSERT 
    WITH CHECK (true);  -- Allow all inserts for logging

-- Allow users to view only their own logs
CREATE POLICY "Users can view their own logs" ON public.client_logs
    FOR SELECT 
    USING (auth.uid() = user_id OR user_id IS NULL);

-- RLS policies for analytics_events
-- Allow users to insert events (even anonymous)
CREATE POLICY "Users can insert their own events" ON public.analytics_events
    FOR INSERT 
    WITH CHECK (true);  -- Allow all inserts for analytics

-- Allow users to view only their own events
CREATE POLICY "Users can view their own events" ON public.analytics_events
    FOR SELECT 
    USING (auth.uid() = user_id OR user_id IS NULL);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.client_logs TO anon, authenticated;
GRANT ALL ON public.analytics_events TO anon, authenticated;

-- Grant permissions on sequences (for auto-generated IDs)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Add comment for documentation
COMMENT ON TABLE public.client_logs IS 'Stores client-side application logs for debugging and monitoring';
COMMENT ON TABLE public.analytics_events IS 'Stores user interaction events for analytics and tracking';

-- Verify tables were created successfully
SELECT 'client_logs table created' AS status WHERE EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'client_logs'
)
UNION ALL
SELECT 'analytics_events table created' AS status WHERE EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'analytics_events'
);