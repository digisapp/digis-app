-- =====================================================
-- COMPREHENSIVE DATABASE FIX FOR DIGIS
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. Fix followers table column issue
-- ====================================
ALTER TABLE followers 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE;

-- If follower_user_id exists, copy data and drop it
DO $$ 
BEGIN 
    IF EXISTS (SELECT FROM information_schema.columns 
               WHERE table_name = 'followers' AND column_name = 'follower_user_id') THEN
        UPDATE followers SET user_id = follower_user_id WHERE user_id IS NULL;
        ALTER TABLE followers DROP COLUMN follower_user_id;
    END IF;
END $$;

-- 2. Create missing stream_tips table
-- ====================================
CREATE TABLE IF NOT EXISTS stream_tips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stream_tips_stream ON stream_tips(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_tips_sender ON stream_tips(sender_id);

-- 3. Add missing columns to users table
-- ======================================
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS auto_withdraw_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_withdraw_threshold DECIMAL(10, 2) DEFAULT 100.00,
ADD COLUMN IF NOT EXISTS auto_withdraw_schedule VARCHAR(20) DEFAULT 'weekly';

-- 4. Add missing columns to withdrawals table
-- ============================================
ALTER TABLE withdrawals 
ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES users(supabase_id);

-- Update creator_id from user_id if null
UPDATE withdrawals SET creator_id = user_id WHERE creator_id IS NULL;

-- 5. Create gift_transactions table
-- ==================================
CREATE TABLE IF NOT EXISTS gift_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    gift_type VARCHAR(50) NOT NULL,
    amount INTEGER NOT NULL,
    message TEXT,
    session_id UUID REFERENCES sessions(id),
    stream_id UUID REFERENCES streams(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_transactions_sender ON gift_transactions(sender_id);
CREATE INDEX IF NOT EXISTS idx_gift_transactions_recipient ON gift_transactions(recipient_id);
CREATE INDEX IF NOT EXISTS idx_gift_transactions_session ON gift_transactions(session_id);
CREATE INDEX IF NOT EXISTS idx_gift_transactions_stream ON gift_transactions(stream_id);

-- 6. Add missing columns to sessions table
-- =========================================
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'video';

-- 6b. Add missing columns to streams table
-- =========================================
ALTER TABLE streams 
ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT false;

-- 7. Create creator_offers table
-- ===============================
CREATE TABLE IF NOT EXISTS creator_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    duration_minutes INTEGER,
    offer_type VARCHAR(50) NOT NULL, -- 'video_call', 'voice_call', 'custom_content', etc
    max_bookings INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creator_offers_creator ON creator_offers(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_offers_active ON creator_offers(is_active);

-- 8. Create offer_bookings table
-- ===============================
CREATE TABLE IF NOT EXISTS offer_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID REFERENCES creator_offers(id) ON DELETE CASCADE,
    fan_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, completed, cancelled
    payment_id UUID REFERENCES payments(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offer_bookings_offer ON offer_bookings(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_bookings_fan ON offer_bookings(fan_id);
CREATE INDEX IF NOT EXISTS idx_offer_bookings_creator ON offer_bookings(creator_id);
CREATE INDEX IF NOT EXISTS idx_offer_bookings_status ON offer_bookings(status);

-- 9. Create stream_likes table (if not exists)
-- =============================================
CREATE TABLE IF NOT EXISTS stream_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(stream_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_stream_likes_stream ON stream_likes(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_likes_user ON stream_likes(user_id);

-- 10. Create tip_transactions table (if not exists)
-- ==================================================
CREATE TABLE IF NOT EXISTS tip_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tip_transactions_sender ON tip_transactions(sender_id);
CREATE INDEX IF NOT EXISTS idx_tip_transactions_recipient ON tip_transactions(recipient_id);

-- 11. Grant permissions
-- ======================
GRANT ALL ON stream_tips TO authenticated;
GRANT ALL ON gift_transactions TO authenticated;
GRANT ALL ON creator_offers TO authenticated;
GRANT ALL ON offer_bookings TO authenticated;

-- Grant to service role
GRANT ALL ON stream_tips TO service_role;
GRANT ALL ON gift_transactions TO service_role;
GRANT ALL ON creator_offers TO service_role;
GRANT ALL ON offer_bookings TO service_role;

-- 12. Enable RLS
-- ==============
ALTER TABLE stream_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_bookings ENABLE ROW LEVEL SECURITY;

-- 13. Create RLS Policies for stream_tips
-- ========================================
CREATE POLICY "Users can view stream tips" ON stream_tips
    FOR SELECT USING (true);

CREATE POLICY "Users can send tips" ON stream_tips
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- 14. Create RLS Policies for gift_transactions
-- ==============================================
CREATE POLICY "Users can view their gift transactions" ON gift_transactions
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send gifts" ON gift_transactions
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- 15. Create RLS Policies for creator_offers
-- ===========================================
CREATE POLICY "Anyone can view active offers" ON creator_offers
    FOR SELECT USING (is_active = true);

CREATE POLICY "Creators can manage their offers" ON creator_offers
    FOR ALL USING (auth.uid() = creator_id);

-- 16. Create RLS Policies for offer_bookings
-- ===========================================
CREATE POLICY "Users can view their bookings" ON offer_bookings
    FOR SELECT USING (auth.uid() = fan_id OR auth.uid() = creator_id);

CREATE POLICY "Users can create bookings" ON offer_bookings
    FOR INSERT WITH CHECK (auth.uid() = fan_id);

CREATE POLICY "Users can update their bookings" ON offer_bookings
    FOR UPDATE USING (auth.uid() = fan_id OR auth.uid() = creator_id);

-- 17. Verification Queries
-- ========================
SELECT 'Tables Check' as check_type,
    COUNT(*) as found_count,
    6 as expected_count
FROM information_schema.tables 
WHERE table_name IN ('stream_tips', 'gift_transactions', 'creator_offers', 
                     'offer_bookings', 'stream_likes', 'tip_transactions');

SELECT 'Users Columns Check' as check_type,
    COUNT(*) as found_count,
    3 as expected_count
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('auto_withdraw_enabled', 'auto_withdraw_threshold', 'auto_withdraw_schedule');

SELECT 'Followers Column Check' as check_type,
    COUNT(*) as found_count,
    1 as expected_count
FROM information_schema.columns 
WHERE table_name = 'followers' 
AND column_name = 'user_id';

SELECT 'Withdrawals Column Check' as check_type,
    COUNT(*) as found_count,
    1 as expected_count
FROM information_schema.columns 
WHERE table_name = 'withdrawals' 
AND column_name = 'creator_id';

SELECT 'Sessions Column Check' as check_type,
    COUNT(*) as found_count,
    1 as expected_count
FROM information_schema.columns 
WHERE table_name = 'sessions' 
AND column_name = 'type';

-- =====================================================
-- END OF MIGRATION SCRIPT
-- After running this, restart your backend server
-- =====================================================