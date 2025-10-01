-- FINAL DATABASE FIX FOR DIGIS APP
-- Based on your actual database structure
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Add Missing Columns to Users Table
-- ============================================

-- Add display_name column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Update display_name from existing data
UPDATE users 
SET display_name = COALESCE(
    display_name,
    username,
    SPLIT_PART(email, '@', 1)
)
WHERE display_name IS NULL;

-- Add last_active column (for backend compatibility)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update last_active from existing columns
UPDATE users
SET last_active = COALESCE(last_active, last_active_at, updated_at, created_at, NOW())
WHERE last_active IS NULL;

-- Ensure is_super_admin exists
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- Add profile columns if missing
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS profile_pic_url TEXT,
ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- ============================================
-- STEP 2: Create Missing Core Tables
-- ============================================

-- Create token_balances table (backend expects this)
CREATE TABLE IF NOT EXISTS token_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_token_balances_user_id ON token_balances(user_id);

-- Initialize token balances from users table
INSERT INTO token_balances (user_id, balance)
SELECT id, COALESCE(token_balance, 1000)
FROM users
ON CONFLICT (user_id) DO UPDATE 
SET balance = GREATEST(token_balances.balance, EXCLUDED.balance);

-- Create followers table (backend expects 'followers', not 'follows')
CREATE TABLE IF NOT EXISTS followers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    followed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, creator_id)
);

CREATE INDEX IF NOT EXISTS idx_followers_follower_id ON followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_creator_id ON followers(creator_id);

-- Copy data from existing follows table
INSERT INTO followers (follower_id, creator_id, followed_at, created_at)
SELECT 
    follower_id, 
    creator_id, 
    COALESCE(created_at, NOW()),
    COALESCE(created_at, NOW())
FROM follows
WHERE follower_id IS NOT NULL 
AND creator_id IS NOT NULL
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
    duration INTEGER,
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

CREATE INDEX IF NOT EXISTS idx_digitals_creator_id ON digitals(creator_id);
CREATE INDEX IF NOT EXISTS idx_digitals_created_at ON digitals(created_at DESC);

-- Create payments table if missing
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

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);

-- Create streams table for live streaming
CREATE TABLE IF NOT EXISTS streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    channel_name VARCHAR(255) UNIQUE,
    stream_key VARCHAR(255),
    status VARCHAR(50) DEFAULT 'inactive',
    category VARCHAR(100),
    tags TEXT[],
    viewer_count INTEGER DEFAULT 0,
    peak_viewers INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER,
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

CREATE INDEX IF NOT EXISTS idx_streams_creator_id ON streams(creator_id);
CREATE INDEX IF NOT EXISTS idx_streams_status ON streams(status);

-- Create user_tokens table (alternative tracking)
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

-- Initialize user_tokens
INSERT INTO user_tokens (user_id, balance)
SELECT id, COALESCE(token_balance, 1000)
FROM users
ON CONFLICT (user_id) DO UPDATE 
SET balance = GREATEST(user_tokens.balance, EXCLUDED.balance);

-- ============================================
-- STEP 3: Fix Notifications Table
-- ============================================

-- Add missing columns to notifications
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS notification_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Update recipient_id from user_id
UPDATE notifications 
SET recipient_id = user_id 
WHERE recipient_id IS NULL AND user_id IS NOT NULL;

-- ============================================
-- STEP 4: Fix Subscriptions Table
-- ============================================

-- Add fan_id column if it doesn't exist
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS fan_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Check if there's a user_id or subscriber_id column to copy from
DO $$
BEGIN
    -- If user_id exists, copy to fan_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'user_id') THEN
        UPDATE subscriptions SET fan_id = user_id WHERE fan_id IS NULL;
    END IF;
    
    -- If subscriber_id exists, copy to fan_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'subscriber_id') THEN
        UPDATE subscriptions SET fan_id = subscriber_id WHERE fan_id IS NULL;
    END IF;
END $$;

-- ============================================
-- STEP 5: Create Analytics Tables
-- ============================================

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
    avg_session_duration INTEGER,
    unique_visitors INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(creator_id, date)
);

CREATE INDEX IF NOT EXISTS idx_creator_analytics_creator_id ON creator_analytics(creator_id);

-- ============================================
-- STEP 6: Token Balance Helper Function
-- ============================================

CREATE OR REPLACE FUNCTION get_user_token_balance(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_balance INTEGER;
BEGIN
    -- Try token_balances table first
    SELECT balance INTO v_balance
    FROM token_balances
    WHERE user_id = p_user_id
    LIMIT 1;
    
    -- Fallback to user_tokens
    IF v_balance IS NULL THEN
        SELECT balance INTO v_balance
        FROM user_tokens
        WHERE user_id = p_user_id
        LIMIT 1;
    END IF;
    
    -- Fallback to users table
    IF v_balance IS NULL THEN
        SELECT token_balance INTO v_balance
        FROM users
        WHERE id = p_user_id
        LIMIT 1;
    END IF;
    
    RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 7: Ensure Users Have Tokens
-- ============================================

-- Give all users initial tokens if they have none
UPDATE users 
SET token_balance = 1000 
WHERE token_balance IS NULL OR token_balance = 0;

-- Ensure Nathan has admin privileges for testing
UPDATE users 
SET is_admin = true, 
    is_creator = true,
    is_super_admin = true
WHERE email = 'nathan@examodels.com';

-- Ensure other test users have tokens
UPDATE users 
SET token_balance = 1000
WHERE email IN ('miriam@examodels.com', 'admin@digis.cc')
AND (token_balance IS NULL OR token_balance = 0);

-- ============================================
-- STEP 8: Enable Row Level Security
-- ============================================

-- Enable RLS on new tables
ALTER TABLE token_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE digitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for development
CREATE POLICY "Allow all for token_balances" ON token_balances FOR ALL USING (true);
CREATE POLICY "Allow all for followers" ON followers FOR ALL USING (true);
CREATE POLICY "Allow all for digitals" ON digitals FOR ALL USING (true);
CREATE POLICY "Allow all for streams" ON streams FOR ALL USING (true);
CREATE POLICY "Allow all for user_tokens" ON user_tokens FOR ALL USING (true);

-- ============================================
-- VERIFICATION
-- ============================================

DO $$
DECLARE
    v_missing TEXT := '';
    v_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'DATABASE FIX VERIFICATION:';
    RAISE NOTICE '========================================';
    
    -- Check Users columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'display_name') THEN
        v_missing := v_missing || 'users.display_name, ';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_active') THEN
        v_missing := v_missing || 'users.last_active, ';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_super_admin') THEN
        v_missing := v_missing || 'users.is_super_admin, ';
    END IF;
    
    -- Check critical tables
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'token_balances') THEN
        v_missing := v_missing || 'token_balances table, ';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'followers') THEN
        v_missing := v_missing || 'followers table, ';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'digitals') THEN
        v_missing := v_missing || 'digitals table, ';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'streams') THEN
        v_missing := v_missing || 'streams table, ';
    END IF;
    
    -- Check notifications columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'sender_id') THEN
        v_missing := v_missing || 'notifications.sender_id, ';
    END IF;
    
    -- Check subscriptions columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'fan_id') THEN
        v_missing := v_missing || 'subscriptions.fan_id, ';
    END IF;
    
    IF v_missing = '' THEN
        RAISE NOTICE '✅ ALL REQUIRED TABLES AND COLUMNS EXIST!';
        
        -- Count records
        SELECT COUNT(*) INTO v_count FROM users WHERE token_balance > 0;
        RAISE NOTICE '✅ Users with tokens: %', v_count;
        
        SELECT COUNT(*) INTO v_count FROM token_balances;
        RAISE NOTICE '✅ Token balance records: %', v_count;
        
        SELECT COUNT(*) INTO v_count FROM followers;
        RAISE NOTICE '✅ Follower relationships: %', v_count;
        
        RAISE NOTICE '';
        RAISE NOTICE '🎉 DATABASE SETUP COMPLETE!';
        RAISE NOTICE '🚀 You can now restart your backend server.';
    ELSE
        RAISE NOTICE '⚠️ STILL MISSING: %', v_missing;
        RAISE NOTICE 'Please check the errors above.';
    END IF;
    
    RAISE NOTICE '========================================';
END $$;