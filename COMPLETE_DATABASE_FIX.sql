-- COMPLETE DATABASE FIX - Run this ENTIRE script in Supabase SQL Editor
-- This fixes ALL missing tables and columns causing backend errors

-- ============================================
-- PART 1: FIX MISSING TABLES (from first script)
-- ============================================

-- Create update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create session_invites table if missing
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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create private_call_requests table if missing
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

-- Create private_call_sessions table if missing
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
-- PART 2: FIX MIRIAM'S CREATOR STATUS
-- ============================================

-- Update Miriam to be a creator
UPDATE users 
SET 
    is_creator = true,
    role = 'creator',
    creator_type = 'Content Creator',
    creator_rate = 50,
    voice_rate = 40,
    stream_rate = 30,
    available_for_calls = true
WHERE email = 'miriam@examodels.com';

-- ============================================
-- PART 3: ADD ALL MISSING COLUMNS
-- ============================================

-- Add missing columns to users table
DO $$ 
BEGIN
    -- Add video_price column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'video_price') THEN
        ALTER TABLE users ADD COLUMN video_price INTEGER DEFAULT 50;
    END IF;
    
    -- Ensure voice_rate exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'voice_rate') THEN
        ALTER TABLE users ADD COLUMN voice_rate INTEGER DEFAULT 40;
    END IF;
    
    -- Ensure stream_rate exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'stream_rate') THEN
        ALTER TABLE users ADD COLUMN stream_rate INTEGER DEFAULT 30;
    END IF;
END $$;

-- Add missing columns to sessions table
DO $$ 
BEGIN
    -- Add fan_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'fan_id') THEN
        ALTER TABLE sessions ADD COLUMN fan_id UUID REFERENCES users(supabase_id);
    END IF;
    
    -- Add start_time column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'start_time') THEN
        ALTER TABLE sessions ADD COLUMN start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    
    -- Add is_private_call column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'is_private_call') THEN
        ALTER TABLE sessions ADD COLUMN is_private_call BOOLEAN DEFAULT false;
    END IF;
    
    -- Add private_call_session_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'private_call_session_id') THEN
        ALTER TABLE sessions ADD COLUMN private_call_session_id UUID REFERENCES private_call_sessions(id);
    END IF;
END $$;

-- ============================================
-- PART 4: CREATE INDEXES
-- ============================================

-- Indexes for session_invites
CREATE INDEX IF NOT EXISTS idx_session_invites_creator_id ON session_invites(creator_id);
CREATE INDEX IF NOT EXISTS idx_session_invites_fan_id ON session_invites(fan_id);
CREATE INDEX IF NOT EXISTS idx_session_invites_status ON session_invites(status);

-- Indexes for private_call_requests
CREATE INDEX IF NOT EXISTS idx_private_call_requests_stream ON private_call_requests(stream_id);
CREATE INDEX IF NOT EXISTS idx_private_call_requests_creator ON private_call_requests(creator_id);
CREATE INDEX IF NOT EXISTS idx_private_call_requests_fan ON private_call_requests(fan_id);
CREATE INDEX IF NOT EXISTS idx_private_call_requests_status ON private_call_requests(status);

-- Indexes for private_call_sessions
CREATE INDEX IF NOT EXISTS idx_private_call_sessions_creator ON private_call_sessions(creator_id);
CREATE INDEX IF NOT EXISTS idx_private_call_sessions_fan ON private_call_sessions(fan_id);
CREATE INDEX IF NOT EXISTS idx_private_call_sessions_channel ON private_call_sessions(channel_name);

-- ============================================
-- PART 5: VERIFY EVERYTHING
-- ============================================

-- Check Miriam's status
SELECT 
    'Miriam Status' as check_type,
    email, 
    is_creator,
    role,
    creator_type
FROM users 
WHERE email = 'miriam@examodels.com';

-- Check if all required tables exist
SELECT 
    'Tables Check' as check_type,
    table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name IN ('session_invites', 'private_call_requests', 'private_call_sessions')
ORDER BY table_name;

-- Check if all required columns exist
SELECT 
    'Columns Check' as check_type,
    table_name,
    column_name
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND (
        (table_name = 'users' AND column_name IN ('video_price', 'voice_rate', 'stream_rate'))
        OR (table_name = 'sessions' AND column_name IN ('fan_id', 'start_time'))
        OR (table_name = 'private_call_requests' AND column_name = 'price_per_minute')
    )
ORDER BY table_name, column_name;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 
    '✅ Database fix complete!' as message,
    'Please sign out and sign back in as miriam@examodels.com' as next_step;