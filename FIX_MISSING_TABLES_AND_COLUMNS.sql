-- =====================================================
-- FIX MISSING TABLES AND COLUMNS FOR DIGIS
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. Create missing tables
-- -------------------------

-- Create stream_likes table (missing)
CREATE TABLE IF NOT EXISTS stream_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(stream_id, user_id)
);

-- Create tip_transactions table (missing)
CREATE TABLE IF NOT EXISTS tip_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create withdrawals table (missing)
CREATE TABLE IF NOT EXISTS withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    stripe_payout_id VARCHAR(255),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add missing columns to existing tables
-- ------------------------------------------

-- Add missing columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS uid UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS bank_account JSONB,
ADD COLUMN IF NOT EXISTS total_purchased INTEGER DEFAULT 0;

-- Update uid to match supabase_id if it exists
UPDATE users SET uid = supabase_id WHERE uid IS NULL AND supabase_id IS NOT NULL;

-- Add missing columns to payments table
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS session_id UUID;

-- Fix followers table column naming (user_id vs follower_user_id)
-- First check if followers table exists and has the right columns
DO $$ 
BEGIN 
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'followers') THEN
        -- Rename column if it exists with wrong name
        IF EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'followers' AND column_name = 'follower_user_id') 
           AND NOT EXISTS (SELECT FROM information_schema.columns 
                          WHERE table_name = 'followers' AND column_name = 'user_id') THEN
            ALTER TABLE followers RENAME COLUMN follower_user_id TO user_id;
        END IF;
        
        -- Add user_id if it doesn't exist at all
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'followers' AND column_name = 'user_id') THEN
            ALTER TABLE followers ADD COLUMN user_id UUID REFERENCES users(supabase_id);
        END IF;
    ELSE
        -- Create followers table if it doesn't exist
        CREATE TABLE followers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
            creator_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
            followed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(user_id, creator_id)
        );
    END IF;
END $$;

-- Fix class_reviews table column naming
DO $$ 
BEGIN 
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'class_reviews') THEN
        -- Add creator_id column if missing
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'class_reviews' AND column_name = 'creator_id') THEN
            ALTER TABLE class_reviews ADD COLUMN creator_id UUID REFERENCES users(supabase_id);
            
            -- Try to populate from classes table if possible
            UPDATE class_reviews cr
            SET creator_id = c.creator_id
            FROM classes c
            WHERE cr.class_id = c.id AND cr.creator_id IS NULL;
        END IF;
    END IF;
END $$;

-- 3. Create indexes for performance
-- ----------------------------------

CREATE INDEX IF NOT EXISTS idx_stream_likes_stream_id ON stream_likes(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_likes_user_id ON stream_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_tip_transactions_sender ON tip_transactions(sender_id);
CREATE INDEX IF NOT EXISTS idx_tip_transactions_recipient ON tip_transactions(recipient_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_users_uid ON users(uid);
CREATE INDEX IF NOT EXISTS idx_payments_session_id ON payments(session_id);

-- 4. Grant permissions for Supabase
-- ----------------------------------

-- Grant permissions to authenticated users
GRANT SELECT ON stream_likes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON stream_likes TO authenticated;

GRANT SELECT ON tip_transactions TO authenticated;
GRANT INSERT ON tip_transactions TO authenticated;

GRANT SELECT ON withdrawals TO authenticated;
GRANT INSERT ON withdrawals TO authenticated;

-- Grant permissions to service role
GRANT ALL ON stream_likes TO service_role;
GRANT ALL ON tip_transactions TO service_role;
GRANT ALL ON withdrawals TO service_role;

-- 5. Enable Row Level Security (RLS)
-- -----------------------------------

ALTER TABLE stream_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tip_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stream_likes
CREATE POLICY "Users can view all stream likes" ON stream_likes
    FOR SELECT USING (true);

CREATE POLICY "Users can like streams" ON stream_likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike streams" ON stream_likes
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for tip_transactions
CREATE POLICY "Users can view their own tips" ON tip_transactions
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send tips" ON tip_transactions
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- RLS Policies for withdrawals
CREATE POLICY "Users can view their own withdrawals" ON withdrawals
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can request withdrawals" ON withdrawals
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. Create helper functions
-- --------------------------

-- Function to get user by uid
CREATE OR REPLACE FUNCTION get_user_by_uid(user_uid UUID)
RETURNS TABLE (
    id UUID,
    email TEXT,
    username TEXT,
    is_creator BOOLEAN,
    token_balance INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.supabase_id as id,
        u.email,
        u.username,
        u.is_creator,
        u.token_balance
    FROM users u
    WHERE u.uid = user_uid OR u.supabase_id = user_uid;
END;
$$ LANGUAGE plpgsql;

-- 7. Fix any data inconsistencies
-- --------------------------------

-- Ensure all users have a uid
UPDATE users 
SET uid = supabase_id 
WHERE uid IS NULL AND supabase_id IS NOT NULL;

-- Ensure all users have token_balance initialized
UPDATE users 
SET token_balance = 0 
WHERE token_balance IS NULL;

-- Ensure all users have total_purchased initialized
UPDATE users 
SET total_purchased = 0 
WHERE total_purchased IS NULL;

-- 8. Verification query
-- ---------------------
-- Run this to verify all fixes were applied:

SELECT 
    'Tables Check' as check_type,
    COUNT(*) as found_count,
    3 as expected_count
FROM information_schema.tables 
WHERE table_name IN ('stream_likes', 'tip_transactions', 'withdrawals');

SELECT 
    'Users Columns Check' as check_type,
    COUNT(*) as found_count,
    3 as expected_count
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('uid', 'bank_account', 'total_purchased');

SELECT 
    'Followers Column Check' as check_type,
    COUNT(*) as found_count,
    1 as expected_count
FROM information_schema.columns 
WHERE table_name = 'followers' 
AND column_name = 'user_id';

-- =====================================================
-- END OF MIGRATION SCRIPT
-- =====================================================