-- Fix permissions for analytics_events and client_logs tables
-- This version handles existing tables

-- First, check and add missing columns if tables exist
DO $$ 
BEGIN
    -- Add created_at to analytics_events if it doesn't exist
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'analytics_events') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'analytics_events' 
                      AND column_name = 'created_at') THEN
            ALTER TABLE analytics_events ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
        END IF;
    ELSE
        -- Create table if it doesn't exist
        CREATE TABLE analytics_events (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID,
            event_type VARCHAR(100) NOT NULL,
            event_data JSONB,
            page_url TEXT,
            session_id UUID,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;

    -- Add created_at to client_logs if it doesn't exist
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'client_logs') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'client_logs' 
                      AND column_name = 'created_at') THEN
            ALTER TABLE client_logs ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
        END IF;
    ELSE
        -- Create table if it doesn't exist
        CREATE TABLE client_logs (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            timestamp TIMESTAMPTZ DEFAULT NOW(),
            level VARCHAR(20) NOT NULL,
            message TEXT NOT NULL,
            context JSONB,
            user_id UUID,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
END $$;

-- Create indexes for better performance (IF NOT EXISTS handles existing indexes)
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_client_logs_user_id ON client_logs(user_id);

-- Only create created_at indexes if the columns exist
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.columns 
              WHERE table_name = 'analytics_events' 
              AND column_name = 'created_at') THEN
        CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at DESC);
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.columns 
              WHERE table_name = 'client_logs' 
              AND column_name = 'created_at') THEN
        CREATE INDEX IF NOT EXISTS idx_client_logs_created_at ON client_logs(created_at DESC);
    END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "analytics_events_insert_policy" ON analytics_events;
DROP POLICY IF EXISTS "analytics_events_select_policy" ON analytics_events;
DROP POLICY IF EXISTS "analytics_events_update_policy" ON analytics_events;
DROP POLICY IF EXISTS "analytics_events_delete_policy" ON analytics_events;
DROP POLICY IF EXISTS "analytics_events_anon_insert" ON analytics_events;

DROP POLICY IF EXISTS "client_logs_insert_policy" ON client_logs;
DROP POLICY IF EXISTS "client_logs_select_policy" ON client_logs;
DROP POLICY IF EXISTS "client_logs_anon_insert" ON client_logs;

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

-- Verify the setup
SELECT 
    'analytics_events' as table_name,
    COUNT(*) as policy_count
FROM pg_policies
WHERE tablename = 'analytics_events'
UNION ALL
SELECT 
    'client_logs' as table_name,
    COUNT(*) as policy_count
FROM pg_policies
WHERE tablename = 'client_logs';