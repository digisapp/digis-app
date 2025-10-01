-- COMPREHENSIVE DATABASE FIX FOR DIGIS APP
-- Run this SQL in your Supabase SQL Editor
-- This fixes all missing tables and columns identified from error logs

-- ============================================
-- STEP 1: Add Missing Columns to Users Table
-- ============================================

-- Add display_name column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Update display_name from existing data
UPDATE users 
SET display_name = COALESCE(
    (raw_user_meta_data->>'display_name')::TEXT,
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

-- Copy data from follows table if it exists
INSERT INTO followers (follower_id, creator_id, followed_at, created_at)
SELECT follower_id, following_id, created_at, created_at
FROM follows
ON CONFLICT (follower_id, creator_id) DO NOTHING;

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

-- Rename member_id to fan_id if needed
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subscriptions' 
        AND column_name = 'member_id'
    ) THEN
        ALTER TABLE subscriptions RENAME COLUMN member_id TO fan_id;
    END IF;
END $$;

-- Add fan_id if it doesn't exist
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS fan_id UUID REFERENCES users(id) ON DELETE CASCADE;

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
-- STEP 7: Create Views for Compatibility
-- ============================================

-- Create a view to handle different subscription column names
CREATE OR REPLACE VIEW subscription_details AS
SELECT 
    s.*,
    COALESCE(s.fan_id, s.user_id) as subscriber_id,
    u1.username as subscriber_username,
    u1.display_name as subscriber_display_name,
    u2.username as creator_username,
    u2.display_name as creator_display_name
FROM subscriptions s
LEFT JOIN users u1 ON COALESCE(s.fan_id, s.user_id) = u1.id
LEFT JOIN users u2 ON s.creator_id = u2.id;

-- ============================================
-- STEP 8: Grant Permissions
-- ============================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant permissions to anon users for public data
GRANT SELECT ON users, creators, streams TO anon;

-- ============================================
-- STEP 9: Final Data Synchronization
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

-- Set display_name for all users
UPDATE users
SET display_name = COALESCE(
    display_name,
    (raw_user_meta_data->>'display_name')::TEXT,
    username,
    SPLIT_PART(email, '@', 1)
)
WHERE display_name IS NULL;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Run these to verify everything is set up correctly:
/*
SELECT 'Users table columns' as check, COUNT(*) as count FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('display_name', 'last_active', 'is_super_admin');

SELECT 'Token balances' as check, COUNT(*) as count FROM token_balances;

SELECT 'Digitals table' as check, EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'digitals') as exists;

SELECT 'Followers table' as check, EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'followers') as exists;

SELECT 'Streams table' as check, EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'streams') as exists;

SELECT 'Notifications sender_id' as check, EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'sender_id') as exists;
*/

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
-- If all queries execute successfully, your database should now be compatible with the backend!