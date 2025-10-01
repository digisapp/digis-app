-- Fix Backend Crashes - Comprehensive Database Update
-- Run this script in Supabase SQL Editor to fix all missing tables and columns

-- ============================================
-- 1. CREATE MISSING TABLES
-- ============================================

-- Create update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create session_invites table (missing table causing crashes)
CREATE TABLE IF NOT EXISTS session_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_uid VARCHAR(255) UNIQUE NOT NULL,
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  fan_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('video', 'voice')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  scheduled BOOLEAN DEFAULT false,
  scheduled_date DATE,
  scheduled_time TIME,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 180),
  rate_per_min DECIMAL(10,2) NOT NULL,
  total_cost DECIMAL(10,2) NOT NULL,
  message TEXT,
  is_recurring BOOLEAN DEFAULT false,
  recurring_frequency VARCHAR(20) CHECK (recurring_frequency IN ('weekly', 'biweekly', 'monthly')),
  recurring_count INTEGER CHECK (recurring_count >= 1 AND recurring_count <= 12),
  preparations JSONB,
  package JSONB,
  request_intake_form BOOLEAN DEFAULT false,
  decline_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_schedule CHECK (
    (scheduled = false) OR 
    (scheduled = true AND scheduled_date IS NOT NULL AND scheduled_time IS NOT NULL)
  ),
  CONSTRAINT valid_recurring CHECK (
    (is_recurring = false) OR
    (is_recurring = true AND recurring_frequency IS NOT NULL AND recurring_count IS NOT NULL)
  )
);

-- Create private_call_requests table (missing price_per_minute column)
CREATE TABLE IF NOT EXISTS private_call_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id VARCHAR(255) NOT NULL,
    fan_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    price_per_minute DECIMAL(10,2) NOT NULL,
    minimum_minutes INTEGER DEFAULT 5,
    estimated_duration INTEGER DEFAULT 10,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
    token_hold_amount INTEGER NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '2 minutes'),
    responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create private_call_sessions table
CREATE TABLE IF NOT EXISTS private_call_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES private_call_requests(id) ON DELETE SET NULL,
    creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    fan_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    channel_name VARCHAR(255) NOT NULL UNIQUE,
    price_per_minute DECIMAL(10,2) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER DEFAULT 0,
    total_cost DECIMAL(10,2) DEFAULT 0,
    tokens_charged INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended', 'failed')),
    end_reason VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================

-- Add missing columns to sessions table if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'is_private_call') THEN
        ALTER TABLE sessions ADD COLUMN is_private_call BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'private_call_session_id') THEN
        ALTER TABLE sessions ADD COLUMN private_call_session_id UUID REFERENCES private_call_sessions(id);
    END IF;
END $$;

-- ============================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Indexes for session_invites
CREATE INDEX IF NOT EXISTS idx_session_invites_creator_id ON session_invites(creator_id);
CREATE INDEX IF NOT EXISTS idx_session_invites_fan_id ON session_invites(fan_id);
CREATE INDEX IF NOT EXISTS idx_session_invites_status ON session_invites(status);
CREATE INDEX IF NOT EXISTS idx_session_invites_scheduled_date ON session_invites(scheduled_date) WHERE scheduled = true;
CREATE INDEX IF NOT EXISTS idx_session_invites_created_at ON session_invites(created_at);

-- Indexes for private_call_requests
CREATE INDEX IF NOT EXISTS idx_private_call_requests_stream ON private_call_requests(stream_id);
CREATE INDEX IF NOT EXISTS idx_private_call_requests_fan ON private_call_requests(fan_id);
CREATE INDEX IF NOT EXISTS idx_private_call_requests_creator ON private_call_requests(creator_id);
CREATE INDEX IF NOT EXISTS idx_private_call_requests_status ON private_call_requests(status);
CREATE INDEX IF NOT EXISTS idx_private_call_requests_expires ON private_call_requests(expires_at);

-- Indexes for private_call_sessions
CREATE INDEX IF NOT EXISTS idx_private_call_sessions_creator ON private_call_sessions(creator_id);
CREATE INDEX IF NOT EXISTS idx_private_call_sessions_fan ON private_call_sessions(fan_id);
CREATE INDEX IF NOT EXISTS idx_private_call_sessions_status ON private_call_sessions(status);
CREATE INDEX IF NOT EXISTS idx_private_call_sessions_channel ON private_call_sessions(channel_name);

-- ============================================
-- 4. CREATE TRIGGERS
-- ============================================

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS update_session_invites_updated_at ON session_invites;
CREATE TRIGGER update_session_invites_updated_at BEFORE UPDATE
    ON session_invites FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_private_call_requests_updated_at ON private_call_requests;
CREATE TRIGGER update_private_call_requests_updated_at BEFORE UPDATE
    ON private_call_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_private_call_sessions_updated_at ON private_call_sessions;
CREATE TRIGGER update_private_call_sessions_updated_at BEFORE UPDATE
    ON private_call_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================

-- Enable RLS for session_invites
ALTER TABLE session_invites ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Users can view their session invites" ON session_invites;
CREATE POLICY "Users can view their session invites"
    ON session_invites FOR SELECT
    USING (creator_id = auth.uid() OR fan_id = auth.uid());

DROP POLICY IF EXISTS "Creators can create session invites" ON session_invites;
CREATE POLICY "Creators can create session invites"
    ON session_invites FOR INSERT
    WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "Creators can update their session invites" ON session_invites;
CREATE POLICY "Creators can update their session invites"
    ON session_invites FOR UPDATE
    USING (creator_id = auth.uid());

DROP POLICY IF EXISTS "Fans can respond to session invites" ON session_invites;
CREATE POLICY "Fans can respond to session invites"
    ON session_invites FOR UPDATE
    USING (fan_id = auth.uid());

-- Enable RLS for private_call_requests
ALTER TABLE private_call_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their private call requests" ON private_call_requests;
CREATE POLICY "Users can view their private call requests"
    ON private_call_requests FOR SELECT
    USING (creator_id = auth.uid() OR fan_id = auth.uid());

DROP POLICY IF EXISTS "Fans can create private call requests" ON private_call_requests;
CREATE POLICY "Fans can create private call requests"
    ON private_call_requests FOR INSERT
    WITH CHECK (fan_id = auth.uid());

DROP POLICY IF EXISTS "Creators can respond to private call requests" ON private_call_requests;
CREATE POLICY "Creators can respond to private call requests"
    ON private_call_requests FOR UPDATE
    USING (creator_id = auth.uid());

-- Enable RLS for private_call_sessions
ALTER TABLE private_call_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their private call sessions" ON private_call_sessions;
CREATE POLICY "Users can view their private call sessions"
    ON private_call_sessions FOR SELECT
    USING (creator_id = auth.uid() OR fan_id = auth.uid());

DROP POLICY IF EXISTS "System manages private call sessions" ON private_call_sessions;
CREATE POLICY "System manages private call sessions"
    ON private_call_sessions FOR ALL
    USING (false)
    WITH CHECK (false);

-- ============================================
-- 6. VERIFY TABLES AND COLUMNS
-- ============================================

-- Query to verify the tables were created successfully
SELECT 
    table_name,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name IN ('session_invites', 'private_call_requests', 'private_call_sessions')
GROUP BY table_name
ORDER BY table_name;

-- Query to verify specific critical columns exist
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND (
        (table_name = 'session_invites' AND column_name IN ('id', 'creator_id', 'fan_id', 'rate_per_min'))
        OR (table_name = 'private_call_requests' AND column_name IN ('id', 'price_per_minute', 'creator_id', 'fan_id'))
        OR (table_name = 'private_call_sessions' AND column_name IN ('id', 'price_per_minute', 'channel_name'))
    )
ORDER BY table_name, column_name;

-- ============================================
-- 7. ADDITIONAL FIXES FOR COMMON ISSUES
-- ============================================

-- Ensure users table has all required columns for references
DO $$ 
BEGIN
    -- Check if supabase_id exists in users table, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'supabase_id') THEN
        ALTER TABLE users ADD COLUMN supabase_id UUID UNIQUE;
        -- Update existing rows to have supabase_id if id column exists
        UPDATE users SET supabase_id = gen_random_uuid() WHERE supabase_id IS NULL;
        ALTER TABLE users ALTER COLUMN supabase_id SET NOT NULL;
    END IF;
END $$;

-- ============================================
-- SUMMARY
-- ============================================
-- This script:
-- 1. Creates the missing session_invites table
-- 2. Creates the missing private_call_requests table with price_per_minute column
-- 3. Creates the missing private_call_sessions table
-- 4. Adds missing columns to the sessions table
-- 5. Creates all necessary indexes for performance
-- 6. Sets up triggers for updated_at columns
-- 7. Enables Row Level Security with appropriate policies
-- 8. Verifies the changes were applied successfully
--
-- After running this script, restart your backend server and the crashes should be resolved.