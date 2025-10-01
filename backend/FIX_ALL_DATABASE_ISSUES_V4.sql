-- COMPREHENSIVE DATABASE FIX FOR DIGIS APP - VERSION 4
-- Run this SQL in your Supabase SQL Editor
-- This version handles various table structures safely

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
SELECT id, COALESCE(token_balance, 1000)
FROM users
ON CONFLICT (user_id) DO NOTHING;

-- Create followers table
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

-- Create indexes for digitals
CREATE INDEX IF NOT EXISTS idx_digitals_creator_id ON digitals(creator_id);
CREATE INDEX IF NOT EXISTS idx_digitals_created_at ON digitals(created_at DESC);

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

-- Create indexes for streams
CREATE INDEX IF NOT EXISTS idx_streams_creator_id ON streams(creator_id);
CREATE INDEX IF NOT EXISTS idx_streams_status ON streams(status);

-- Create user_tokens table
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
SELECT id, COALESCE(token_balance, 1000)
FROM users
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- STEP 3: Fix Notifications Table
-- ============================================

-- Create notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    message TEXT,
    notification_type VARCHAR(50),
    read BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns if table already exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        -- Add sender_id if missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'sender_id') THEN
            ALTER TABLE notifications ADD COLUMN sender_id UUID REFERENCES users(id) ON DELETE SET NULL;
        END IF;
        
        -- Add recipient_id if missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'recipient_id') THEN
            ALTER TABLE notifications ADD COLUMN recipient_id UUID REFERENCES users(id) ON DELETE CASCADE;
        END IF;
        
        -- Add notification_type if missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'notification_type') THEN
            ALTER TABLE notifications ADD COLUMN notification_type VARCHAR(50);
        END IF;
        
        -- Add metadata if missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'metadata') THEN
            ALTER TABLE notifications ADD COLUMN metadata JSONB DEFAULT '{}';
        END IF;
        
        -- Update recipient_id from user_id if needed
        UPDATE notifications 
        SET recipient_id = user_id 
        WHERE recipient_id IS NULL AND user_id IS NOT NULL;
    END IF;
END $$;

-- ============================================
-- STEP 4: Fix Subscriptions Table (Safely)
-- ============================================

DO $$
DECLARE
    v_has_member_id BOOLEAN;
    v_has_fan_id BOOLEAN;
    v_has_subscriber_id BOOLEAN;
BEGIN
    -- Check if subscriptions table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
        -- Check which columns exist
        SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'member_id')
        INTO v_has_member_id;
        
        SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'fan_id')
        INTO v_has_fan_id;
        
        SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'subscriber_id')
        INTO v_has_subscriber_id;
        
        -- Rename member_id to fan_id if needed
        IF v_has_member_id AND NOT v_has_fan_id THEN
            ALTER TABLE subscriptions RENAME COLUMN member_id TO fan_id;
            RAISE NOTICE 'Renamed member_id to fan_id in subscriptions table';
        END IF;
        
        -- Add fan_id if it doesn't exist at all
        IF NOT v_has_fan_id AND NOT v_has_member_id THEN
            ALTER TABLE subscriptions ADD COLUMN fan_id UUID REFERENCES users(id) ON DELETE CASCADE;
            
            -- Try to populate from subscriber_id if it exists
            IF v_has_subscriber_id THEN
                UPDATE subscriptions SET fan_id = subscriber_id WHERE fan_id IS NULL;
            END IF;
            
            RAISE NOTICE 'Added fan_id column to subscriptions table';
        END IF;
    ELSE
        -- Create subscriptions table if it doesn't exist
        CREATE TABLE subscriptions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            fan_id UUID REFERENCES users(id) ON DELETE CASCADE,
            creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
            tier VARCHAR(50) DEFAULT 'basic',
            price INTEGER DEFAULT 0,
            status VARCHAR(50) DEFAULT 'active',
            started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            ended_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(fan_id, creator_id)
        );
        RAISE NOTICE 'Created subscriptions table';
    END IF;
END $$;

-- ============================================
-- STEP 5: Copy Follows Data (Safely)
-- ============================================

DO $$
DECLARE
    v_column_list TEXT;
    v_has_following_id BOOLEAN;
    v_has_creator_id BOOLEAN;
    v_has_followed_id BOOLEAN;
BEGIN
    -- Check if follows table exists and get its structure
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'follows') THEN
        -- Get column list for debugging
        SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
        INTO v_column_list
        FROM information_schema.columns
        WHERE table_name = 'follows';
        
        RAISE NOTICE 'Follows table columns: %', v_column_list;
        
        -- Check which target column exists
        SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'follows' AND column_name = 'following_id')
        INTO v_has_following_id;
        
        SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'follows' AND column_name = 'creator_id')
        INTO v_has_creator_id;
        
        SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'follows' AND column_name = 'followed_id')
        INTO v_has_followed_id;
        
        -- Copy data based on what exists
        IF v_has_creator_id THEN
            INSERT INTO followers (follower_id, creator_id, followed_at, created_at)
            SELECT follower_id, creator_id, COALESCE(created_at, NOW()), COALESCE(created_at, NOW())
            FROM follows
            ON CONFLICT (follower_id, creator_id) DO NOTHING;
            RAISE NOTICE 'Copied follows data using creator_id column';
        ELSIF v_has_followed_id THEN
            INSERT INTO followers (follower_id, creator_id, followed_at, created_at)
            SELECT follower_id, followed_id, COALESCE(created_at, NOW()), COALESCE(created_at, NOW())
            FROM follows
            ON CONFLICT (follower_id, creator_id) DO NOTHING;
            RAISE NOTICE 'Copied follows data using followed_id column';
        ELSE
            RAISE NOTICE 'Could not find appropriate column in follows table to copy data';
        END IF;
    ELSE
        RAISE NOTICE 'Follows table does not exist, skipping data copy';
    END IF;
END $$;

-- ============================================
-- STEP 6: Create Support Tables
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
    avg_session_duration INTEGER,
    unique_visitors INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(creator_id, date)
);

CREATE INDEX IF NOT EXISTS idx_creator_analytics_creator_id ON creator_analytics(creator_id);

-- ============================================
-- STEP 7: Token Balance Functions
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
    WHERE user_id = p_user_id
    LIMIT 1;
    
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
-- STEP 8: Data Synchronization
-- ============================================

-- Ensure all users have display_name
UPDATE users
SET display_name = COALESCE(display_name, username, SPLIT_PART(email, '@', 1))
WHERE display_name IS NULL OR display_name = '';

-- Ensure all users have last_active
UPDATE users
SET last_active = COALESCE(last_active, last_active_at, last_sign_in_at, updated_at, created_at, NOW())
WHERE last_active IS NULL;

-- Give users initial tokens if they have none
UPDATE users 
SET token_balance = 1000 
WHERE token_balance IS NULL OR token_balance = 0;

-- Sync to token_balances table
INSERT INTO token_balances (user_id, balance)
SELECT id, COALESCE(token_balance, 1000)
FROM users
WHERE NOT EXISTS (
    SELECT 1 FROM token_balances tb WHERE tb.user_id = users.id
)
ON CONFLICT (user_id) DO UPDATE 
SET balance = EXCLUDED.balance;

-- Sync to user_tokens table
INSERT INTO user_tokens (user_id, balance)
SELECT id, COALESCE(token_balance, 1000)
FROM users
WHERE NOT EXISTS (
    SELECT 1 FROM user_tokens ut WHERE ut.user_id = users.id
)
ON CONFLICT (user_id) DO UPDATE 
SET balance = EXCLUDED.balance;

-- ============================================
-- STEP 9: Enable Row Level Security
-- ============================================

-- Enable RLS on new tables
ALTER TABLE token_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE digitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies
DO $$
BEGIN
    -- Token balances policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'token_balances' AND policyname = 'Users can view own balance') THEN
        CREATE POLICY "Users can view own balance" ON token_balances
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
    
    -- Followers policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'followers' AND policyname = 'Anyone can view followers') THEN
        CREATE POLICY "Anyone can view followers" ON followers
            FOR SELECT USING (true);
    END IF;
    
    -- Digitals policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'digitals' AND policyname = 'View public digitals') THEN
        CREATE POLICY "View public digitals" ON digitals
            FOR SELECT USING (is_public = true OR creator_id = auth.uid());
    END IF;
    
    -- Streams policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'streams' AND policyname = 'View active streams') THEN
        CREATE POLICY "View active streams" ON streams
            FOR SELECT USING (status IN ('live', 'ended') OR creator_id = auth.uid());
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Some RLS policies could not be created: %', SQLERRM;
END $$;

-- ============================================
-- FINAL VERIFICATION
-- ============================================

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'DATABASE FIX VERIFICATION RESULTS:';
    RAISE NOTICE '====================================';
    
    -- Check critical columns
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'display_name') THEN
        RAISE NOTICE '✓ users.display_name exists';
    ELSE
        RAISE NOTICE '✗ users.display_name MISSING';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_active') THEN
        RAISE NOTICE '✓ users.last_active exists';
    ELSE
        RAISE NOTICE '✗ users.last_active MISSING';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_super_admin') THEN
        RAISE NOTICE '✓ users.is_super_admin exists';
    ELSE
        RAISE NOTICE '✗ users.is_super_admin MISSING';
    END IF;
    
    -- Check critical tables
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'token_balances') THEN
        SELECT COUNT(*) INTO v_count FROM token_balances;
        RAISE NOTICE '✓ token_balances table exists (% records)', v_count;
    ELSE
        RAISE NOTICE '✗ token_balances table MISSING';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'digitals') THEN
        RAISE NOTICE '✓ digitals table exists';
    ELSE
        RAISE NOTICE '✗ digitals table MISSING';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'followers') THEN
        SELECT COUNT(*) INTO v_count FROM followers;
        RAISE NOTICE '✓ followers table exists (% records)', v_count;
    ELSE
        RAISE NOTICE '✗ followers table MISSING';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'streams') THEN
        RAISE NOTICE '✓ streams table exists';
    ELSE
        RAISE NOTICE '✗ streams table MISSING';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'sender_id') THEN
        RAISE NOTICE '✓ notifications.sender_id exists';
    ELSE
        RAISE NOTICE '✗ notifications.sender_id MISSING';
    END IF;
    
    -- Check token balance for users
    SELECT COUNT(*) INTO v_count FROM users WHERE token_balance > 0;
    RAISE NOTICE '✓ Users with tokens: %', v_count;
    
    RAISE NOTICE '====================================';
    RAISE NOTICE 'DATABASE FIX COMPLETE!';
    RAISE NOTICE 'Please restart your backend server.';
    RAISE NOTICE '====================================';
END $$;