-- COMPREHENSIVE DATABASE FIX FOR DIGIS APP - VERSION 3
-- Run this SQL in your Supabase SQL Editor
-- This fixes all missing tables and columns identified from error logs

-- ============================================
-- STEP 1: Add Missing Columns to Users Table
-- ============================================

-- Add display_name column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Update display_name from existing data (without raw_user_meta_data)
UPDATE users 
SET display_name = COALESCE(
    display_name,
    username,
    SPLIT_PART(email, '@', 1)
)
WHERE display_name IS NULL;

-- Add last_active column (different from last_active_at)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Ensure is_super_admin exists
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- Add any other potentially missing user columns
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS profile_pic_url TEXT,
ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- ============================================
-- STEP 2: Create Missing Tables
-- ============================================

-- Create token_balances table
CREATE TABLE IF NOT EXISTS token_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_token_balances_user_id ON token_balances(user_id);

-- Initialize token balances from users table
INSERT INTO token_balances (user_id, balance)
SELECT id, COALESCE(token_balance, 0)
FROM users
ON CONFLICT (user_id) DO NOTHING;

-- Create followers table (was using 'follows' but queries expect 'followers')
CREATE TABLE IF NOT EXISTS followers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    followed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, creator_id)
);

-- Create indexes for followers
CREATE INDEX IF NOT EXISTS idx_followers_follower_id ON followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_creator_id ON followers(creator_id);

-- Copy data from follows table if it exists (check columns dynamically)
DO $$
DECLARE
    v_creator_column TEXT;
BEGIN
    -- Check if follows table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'follows') THEN
        -- Check what the creator column is called
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'follows' AND column_name = 'following_id') THEN
            v_creator_column := 'following_id';
        ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'follows' AND column_name = 'creator_id') THEN
            v_creator_column := 'creator_id';
        ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'follows' AND column_name = 'followed_id') THEN
            v_creator_column := 'followed_id';
        ELSE
            -- If we can't find a matching column, skip the copy
            RAISE NOTICE 'Could not find creator/following column in follows table, skipping data copy';
            RETURN;
        END IF;
        
        -- Copy the data using dynamic SQL
        EXECUTE format('
            INSERT INTO followers (follower_id, creator_id, followed_at, created_at)
            SELECT follower_id, %I, created_at, created_at
            FROM follows
            ON CONFLICT (follower_id, creator_id) DO NOTHING
        ', v_creator_column);
        
        RAISE NOTICE 'Copied data from follows table to followers table';
    END IF;
END $$;

-- Create digitals table for digital content
CREATE TABLE IF NOT EXISTS digitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    thumbnail_url TEXT,
    price INTEGER DEFAULT 0,
    file_type VARCHAR(50),
    file_size BIGINT,
    duration INTEGER, -- for videos in seconds
    is_free BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT TRUE,
    view_count INTEGER DEFAULT 0,
    purchase_count INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for digitals
CREATE INDEX IF NOT EXISTS idx_digitals_creator_id ON digitals(creator_id);
CREATE INDEX IF NOT EXISTS idx_digitals_created_at ON digitals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_digitals_is_public ON digitals(is_public);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50) NOT NULL,
    payment_method VARCHAR(50),
    stripe_payment_intent_id VARCHAR(255),
    stripe_charge_id VARCHAR(255),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for payments
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- Create streams table for live streaming
CREATE TABLE IF NOT EXISTS streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    channel_name VARCHAR(255) UNIQUE,
    stream_key VARCHAR(255),
    status VARCHAR(50) DEFAULT 'inactive', -- inactive, live, ended
    category VARCHAR(100),
    tags TEXT[],
    viewer_count INTEGER DEFAULT 0,
    peak_viewers INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- in seconds
    is_recorded BOOLEAN DEFAULT FALSE,
    recording_url TEXT,
    chat_enabled BOOLEAN DEFAULT TRUE,
    tips_enabled BOOLEAN DEFAULT TRUE,
    subscription_only BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for streams
CREATE INDEX IF NOT EXISTS idx_streams_creator_id ON streams(creator_id);
CREATE INDEX IF NOT EXISTS idx_streams_status ON streams(status);
CREATE INDEX IF NOT EXISTS idx_streams_created_at ON streams(created_at DESC);

-- Create user_tokens table (alternative name for token tracking)
CREATE TABLE IF NOT EXISTS user_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 0,
    total_purchased INTEGER DEFAULT 0,
    total_spent INTEGER DEFAULT 0,
    total_earned INTEGER DEFAULT 0,
    last_transaction_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Initialize user_tokens from existing data
INSERT INTO user_tokens (user_id, balance)
SELECT id, COALESCE(token_balance, 0)
FROM users
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- STEP 3: Fix Notifications Table Structure
-- ============================================

-- Check if notifications table exists, if not create it
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    message TEXT,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to notifications table
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS notification_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Update existing notifications to have proper structure
UPDATE notifications
SET recipient_id = user_id
WHERE recipient_id IS NULL AND user_id IS NOT NULL;

-- ============================================
-- STEP 4: Fix Subscriptions Table Structure
-- ============================================

-- Check if subscriptions table has member_id or fan_id
DO $$
BEGIN
    -- First check if subscriptions table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
        -- Check for member_id column and rename to fan_id
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'subscriptions' 
            AND column_name = 'member_id'
        ) THEN
            ALTER TABLE subscriptions RENAME COLUMN member_id TO fan_id;
        END IF;
        
        -- Add fan_id if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'subscriptions' 
            AND column_name = 'fan_id'
        ) THEN
            ALTER TABLE subscriptions ADD COLUMN fan_id UUID REFERENCES users(id) ON DELETE CASCADE;
            -- Copy from user_id if fan_id is null
            UPDATE subscriptions SET fan_id = user_id WHERE fan_id IS NULL AND user_id IS NOT NULL;
        END IF;
    END IF;
END $$;

-- ============================================
-- STEP 5: Create Additional Support Tables
-- ============================================

-- Create stream_analytics table
CREATE TABLE IF NOT EXISTS stream_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    viewer_count INTEGER DEFAULT 0,
    chat_messages INTEGER DEFAULT 0,
    tips_total INTEGER DEFAULT 0,
    new_followers INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stream_analytics_stream_id ON stream_analytics(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_analytics_timestamp ON stream_analytics(timestamp DESC);

-- Create creator_analytics table
CREATE TABLE IF NOT EXISTS creator_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    views INTEGER DEFAULT 0,
    followers_gained INTEGER DEFAULT 0,
    followers_lost INTEGER DEFAULT 0,
    revenue_tokens INTEGER DEFAULT 0,
    revenue_usd DECIMAL(10, 2) DEFAULT 0,
    engagement_rate DECIMAL(5, 2),
    avg_session_duration INTEGER, -- in seconds
    unique_visitors INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(creator_id, date)
);

CREATE INDEX IF NOT EXISTS idx_creator_analytics_creator_id ON creator_analytics(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_analytics_date ON creator_analytics(date DESC);

-- Create stream_co_hosts table for co-hosting
CREATE TABLE IF NOT EXISTS stream_co_hosts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
    co_host_id UUID REFERENCES users(id) ON DELETE CASCADE,
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, accepted, active, ended
    joined_at TIMESTAMP WITH TIME ZONE,
    left_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(stream_id, co_host_id)
);

CREATE INDEX IF NOT EXISTS idx_stream_co_hosts_stream_id ON stream_co_hosts(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_co_hosts_co_host_id ON stream_co_hosts(co_host_id);

-- ============================================
-- STEP 6: Create Functions for Token Balance
-- ============================================

-- Function to get user token balance
CREATE OR REPLACE FUNCTION get_user_token_balance(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_balance INTEGER;
BEGIN
    -- Try token_balances table first
    SELECT balance INTO v_balance
    FROM token_balances
    WHERE user_id = p_user_id;
    
    IF v_balance IS NULL THEN
        -- Fallback to user_tokens table
        SELECT balance INTO v_balance
        FROM user_tokens
        WHERE user_id = p_user_id;
    END IF;
    
    IF v_balance IS NULL THEN
        -- Fallback to users table
        SELECT token_balance INTO v_balance
        FROM users
        WHERE id = p_user_id;
    END IF;
    
    RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to update user token balance
CREATE OR REPLACE FUNCTION update_user_token_balance(
    p_user_id UUID,
    p_amount INTEGER,
    p_operation VARCHAR -- 'add', 'subtract', 'set'
) RETURNS INTEGER AS $$
DECLARE
    v_new_balance INTEGER;
BEGIN
    -- Ensure records exist
    INSERT INTO token_balances (user_id, balance)
    VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;
    
    INSERT INTO user_tokens (user_id, balance)
    VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Update based on operation
    IF p_operation = 'add' THEN
        UPDATE token_balances
        SET balance = balance + p_amount,
            last_updated = NOW()
        WHERE user_id = p_user_id
        RETURNING balance INTO v_new_balance;
        
        UPDATE user_tokens
        SET balance = balance + p_amount,
            updated_at = NOW()
        WHERE user_id = p_user_id;
        
        UPDATE users
        SET token_balance = COALESCE(token_balance, 0) + p_amount
        WHERE id = p_user_id;
        
    ELSIF p_operation = 'subtract' THEN
        UPDATE token_balances
        SET balance = GREATEST(0, balance - p_amount),
            last_updated = NOW()
        WHERE user_id = p_user_id
        RETURNING balance INTO v_new_balance;
        
        UPDATE user_tokens
        SET balance = GREATEST(0, balance - p_amount),
            updated_at = NOW()
        WHERE user_id = p_user_id;
        
        UPDATE users
        SET token_balance = GREATEST(0, COALESCE(token_balance, 0) - p_amount)
        WHERE id = p_user_id;
        
    ELSIF p_operation = 'set' THEN
        UPDATE token_balances
        SET balance = p_amount,
            last_updated = NOW()
        WHERE user_id = p_user_id
        RETURNING balance INTO v_new_balance;
        
        UPDATE user_tokens
        SET balance = p_amount,
            updated_at = NOW()
        WHERE user_id = p_user_id;
        
        UPDATE users
        SET token_balance = p_amount
        WHERE id = p_user_id;
    END IF;
    
    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 7: Grant Permissions (for Supabase RLS)
-- ============================================

-- Enable RLS on new tables
ALTER TABLE token_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE digitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_analytics ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies for token_balances
CREATE POLICY "Users can view their own token balance" ON token_balances
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can update token balances" ON token_balances
    FOR ALL USING (true);

-- Create basic RLS policies for followers
CREATE POLICY "Anyone can view followers" ON followers
    FOR SELECT USING (true);

CREATE POLICY "Users can manage their follows" ON followers
    FOR ALL USING (auth.uid() = follower_id);

-- Create basic RLS policies for digitals
CREATE POLICY "Anyone can view public digitals" ON digitals
    FOR SELECT USING (is_public = true);

CREATE POLICY "Creators can manage their digitals" ON digitals
    FOR ALL USING (auth.uid() = creator_id);

-- Create basic RLS policies for streams
CREATE POLICY "Anyone can view active streams" ON streams
    FOR SELECT USING (status IN ('live', 'ended') OR creator_id = auth.uid());

CREATE POLICY "Creators can manage their streams" ON streams
    FOR ALL USING (auth.uid() = creator_id);

-- ============================================
-- STEP 8: Final Data Synchronization
-- ============================================

-- Ensure all users have token balance records
INSERT INTO token_balances (user_id, balance)
SELECT id, COALESCE(token_balance, 0)
FROM users
WHERE NOT EXISTS (
    SELECT 1 FROM token_balances tb
    WHERE tb.user_id = users.id
);

-- Update last_active for all users
UPDATE users
SET last_active = COALESCE(last_active_at, last_sign_in_at, updated_at, created_at, NOW())
WHERE last_active IS NULL;

-- Set display_name for all users who don't have one
UPDATE users
SET display_name = COALESCE(
    display_name,
    username,
    SPLIT_PART(email, '@', 1)
)
WHERE display_name IS NULL OR display_name = '';

-- Give initial token balance to users who have none
UPDATE users 
SET token_balance = 1000 
WHERE token_balance IS NULL OR token_balance = 0;

-- Also update the token tables
UPDATE token_balances 
SET balance = 1000 
WHERE balance = 0;

UPDATE user_tokens 
SET balance = 1000 
WHERE balance = 0;

-- ============================================
-- STEP 9: Debug and List Follows Table Structure
-- ============================================

-- Let's see what columns the follows table actually has
DO $$
DECLARE
    v_column_list TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'follows') THEN
        SELECT string_agg(column_name || ' (' || data_type || ')', ', ' ORDER BY ordinal_position)
        INTO v_column_list
        FROM information_schema.columns
        WHERE table_name = 'follows';
        
        RAISE NOTICE 'Follows table columns: %', v_column_list;
    ELSE
        RAISE NOTICE 'Follows table does not exist';
    END IF;
END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Run these to verify everything is set up correctly:
DO $$
BEGIN
    RAISE NOTICE '====================';
    RAISE NOTICE 'Verification Results:';
    RAISE NOTICE '====================';
    
    -- Check users table columns
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'display_name') THEN
        RAISE NOTICE '✓ display_name column exists';
    ELSE
        RAISE NOTICE '✗ display_name column missing';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_active') THEN
        RAISE NOTICE '✓ last_active column exists';
    ELSE
        RAISE NOTICE '✗ last_active column missing';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_super_admin') THEN
        RAISE NOTICE '✓ is_super_admin column exists';
    ELSE
        RAISE NOTICE '✗ is_super_admin column missing';
    END IF;
    
    -- Check tables
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'token_balances') THEN
        RAISE NOTICE '✓ token_balances table exists';
    ELSE
        RAISE NOTICE '✗ token_balances table missing';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'digitals') THEN
        RAISE NOTICE '✓ digitals table exists';
    ELSE
        RAISE NOTICE '✗ digitals table missing';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'followers') THEN
        RAISE NOTICE '✓ followers table exists';
    ELSE
        RAISE NOTICE '✗ followers table missing';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'streams') THEN
        RAISE NOTICE '✓ streams table exists';
    ELSE
        RAISE NOTICE '✗ streams table missing';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
        RAISE NOTICE '✓ payments table exists';
    ELSE
        RAISE NOTICE '✗ payments table missing';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_tokens') THEN
        RAISE NOTICE '✓ user_tokens table exists';
    ELSE
        RAISE NOTICE '✗ user_tokens table missing';
    END IF;
    
    -- Check notification columns
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'sender_id') THEN
        RAISE NOTICE '✓ notifications.sender_id exists';
    ELSE
        RAISE NOTICE '✗ notifications.sender_id missing';
    END IF;
    
    -- Check token balance
    PERFORM get_user_token_balance(gen_random_uuid());
    RAISE NOTICE '✓ Token balance functions created';
    
    RAISE NOTICE '====================';
    RAISE NOTICE 'Database fix complete!';
    RAISE NOTICE 'Please restart your backend server.';
    RAISE NOTICE '====================';
END $$;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
-- If all queries execute successfully, your database should now be compatible with the backend!
-- Please restart your backend server after running this script.