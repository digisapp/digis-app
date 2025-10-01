-- Complete fix for analytics_events and client_logs tables
-- This version handles all missing columns and existing tables

-- First, drop existing policies to avoid conflicts
DO $$ 
BEGIN
    -- Drop policies if tables exist
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'analytics_events') THEN
        DROP POLICY IF EXISTS "analytics_events_insert_policy" ON analytics_events;
        DROP POLICY IF EXISTS "analytics_events_select_policy" ON analytics_events;
        DROP POLICY IF EXISTS "analytics_events_update_policy" ON analytics_events;
        DROP POLICY IF EXISTS "analytics_events_delete_policy" ON analytics_events;
        DROP POLICY IF EXISTS "analytics_events_anon_insert" ON analytics_events;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'client_logs') THEN
        DROP POLICY IF EXISTS "client_logs_insert_policy" ON client_logs;
        DROP POLICY IF EXISTS "client_logs_select_policy" ON client_logs;
        DROP POLICY IF EXISTS "client_logs_anon_insert" ON client_logs;
    END IF;
END $$;

-- Handle analytics_events table
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'analytics_events') THEN
        -- Add missing columns to existing table
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'analytics_events' AND column_name = 'user_id') THEN
            ALTER TABLE analytics_events ADD COLUMN user_id UUID;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'analytics_events' AND column_name = 'event_type') THEN
            ALTER TABLE analytics_events ADD COLUMN event_type VARCHAR(100);
            -- Update existing rows to have a default event_type
            UPDATE analytics_events SET event_type = 'unknown' WHERE event_type IS NULL;
            -- Make it NOT NULL after updating existing rows
            ALTER TABLE analytics_events ALTER COLUMN event_type SET NOT NULL;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'analytics_events' AND column_name = 'event_data') THEN
            ALTER TABLE analytics_events ADD COLUMN event_data JSONB;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'analytics_events' AND column_name = 'page_url') THEN
            ALTER TABLE analytics_events ADD COLUMN page_url TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'analytics_events' AND column_name = 'session_id') THEN
            ALTER TABLE analytics_events ADD COLUMN session_id UUID;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'analytics_events' AND column_name = 'created_at') THEN
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
END $$;

-- Handle client_logs table
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'client_logs') THEN
        -- Add missing columns to existing table
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'client_logs' AND column_name = 'user_id') THEN
            ALTER TABLE client_logs ADD COLUMN user_id UUID;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'client_logs' AND column_name = 'timestamp') THEN
            ALTER TABLE client_logs ADD COLUMN timestamp TIMESTAMPTZ DEFAULT NOW();
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'client_logs' AND column_name = 'level') THEN
            ALTER TABLE client_logs ADD COLUMN level VARCHAR(20);
            UPDATE client_logs SET level = 'info' WHERE level IS NULL;
            ALTER TABLE client_logs ALTER COLUMN level SET NOT NULL;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'client_logs' AND column_name = 'message') THEN
            ALTER TABLE client_logs ADD COLUMN message TEXT;
            UPDATE client_logs SET message = 'No message' WHERE message IS NULL;
            ALTER TABLE client_logs ALTER COLUMN message SET NOT NULL;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'client_logs' AND column_name = 'context') THEN
            ALTER TABLE client_logs ADD COLUMN context JSONB;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'client_logs' AND column_name = 'created_at') THEN
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

-- Create indexes (safe with IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_logs_user_id ON client_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_client_logs_created_at ON client_logs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for analytics_events
CREATE POLICY "analytics_events_insert_policy" ON analytics_events
    FOR INSERT 
    WITH CHECK (true);  -- Allow all inserts for now

CREATE POLICY "analytics_events_select_policy" ON analytics_events
    FOR SELECT 
    USING (true);  -- Allow all selects for now

-- Create RLS policies for client_logs
CREATE POLICY "client_logs_insert_policy" ON client_logs
    FOR INSERT 
    WITH CHECK (true);  -- Allow all inserts

CREATE POLICY "client_logs_select_policy" ON client_logs
    FOR SELECT 
    USING (true);  -- Allow all selects

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON analytics_events TO anon, authenticated;
GRANT ALL ON client_logs TO anon, authenticated;

-- Test the tables
SELECT 
    'Tables created/updated successfully' as status,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'analytics_events') as analytics_events_columns,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'client_logs') as client_logs_columns;