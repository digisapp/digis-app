-- Fix permissions for analytics_events and client_logs tables

-- First, ensure the tables exist with proper structure
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB,
    page_url TEXT,
    session_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    context JSONB,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_client_logs_created_at ON client_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_logs_user_id ON client_logs(user_id);

-- Enable Row Level Security
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "analytics_events_insert_policy" ON analytics_events;
DROP POLICY IF EXISTS "analytics_events_select_policy" ON analytics_events;
DROP POLICY IF EXISTS "analytics_events_update_policy" ON analytics_events;
DROP POLICY IF EXISTS "analytics_events_delete_policy" ON analytics_events;

DROP POLICY IF EXISTS "client_logs_insert_policy" ON client_logs;
DROP POLICY IF EXISTS "client_logs_select_policy" ON client_logs;

-- Create RLS policies for analytics_events
-- Allow all authenticated users to insert their own events
CREATE POLICY "analytics_events_insert_policy" ON analytics_events
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Allow users to see their own events
CREATE POLICY "analytics_events_select_policy" ON analytics_events
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id OR user_id IS NULL);

-- Allow users to update their own events
CREATE POLICY "analytics_events_update_policy" ON analytics_events
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own events
CREATE POLICY "analytics_events_delete_policy" ON analytics_events
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- Create RLS policies for client_logs
-- Allow all authenticated users to insert logs
CREATE POLICY "client_logs_insert_policy" ON client_logs
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Allow users to see their own logs
CREATE POLICY "client_logs_select_policy" ON client_logs
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id OR user_id IS NULL);

-- Also create policies for anonymous users (for logging before auth)
CREATE POLICY "analytics_events_anon_insert" ON analytics_events
    FOR INSERT TO anon
    WITH CHECK (user_id IS NULL);

CREATE POLICY "client_logs_anon_insert" ON client_logs
    FOR INSERT TO anon
    WITH CHECK (true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON analytics_events TO authenticated;
GRANT INSERT ON analytics_events TO anon;
GRANT ALL ON client_logs TO authenticated;
GRANT INSERT ON client_logs TO anon;

-- Grant sequence permissions if needed
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Verify the policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('analytics_events', 'client_logs')
ORDER BY tablename, policyname;