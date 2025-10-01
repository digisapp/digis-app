-- ============================================
-- DIGIS DATABASE - MISSING TABLES & COLUMNS FIX
-- ============================================
-- This script adds all missing tables and columns to your Supabase database
-- Run this in your Supabase SQL Editor
-- Created: 2024
-- ============================================

-- ============================================
-- 1. OFFER PURCHASES TABLE (Currently missing and causing errors)
-- ============================================
CREATE TABLE IF NOT EXISTS offer_purchases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    offer_id UUID REFERENCES creator_offers(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tokens_paid INTEGER NOT NULL CHECK (tokens_paid > 0),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'refunded')),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for offer_purchases
CREATE INDEX IF NOT EXISTS idx_offer_purchases_buyer ON offer_purchases(buyer_id);
CREATE INDEX IF NOT EXISTS idx_offer_purchases_creator ON offer_purchases(creator_id);
CREATE INDEX IF NOT EXISTS idx_offer_purchases_offer ON offer_purchases(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_purchases_status ON offer_purchases(status);
CREATE INDEX IF NOT EXISTS idx_offer_purchases_created ON offer_purchases(created_at DESC);

-- ============================================
-- 2. OFFER BOOKINGS TABLE (For scheduling creator services)
-- ============================================
CREATE TABLE IF NOT EXISTS offer_bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    offer_id UUID REFERENCES creator_offers(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    purchase_id UUID REFERENCES offer_purchases(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    duration_minutes INTEGER DEFAULT 60,
    meeting_link TEXT,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
    reminder_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for offer_bookings
CREATE INDEX IF NOT EXISTS idx_offer_bookings_buyer ON offer_bookings(buyer_id);
CREATE INDEX IF NOT EXISTS idx_offer_bookings_creator ON offer_bookings(creator_id);
CREATE INDEX IF NOT EXISTS idx_offer_bookings_date ON offer_bookings(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_offer_bookings_status ON offer_bookings(status);

-- ============================================
-- 3. ENSURE CREATOR_OFFERS TABLE EXISTS
-- ============================================
CREATE TABLE IF NOT EXISTS creator_offers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'custom',
    price INTEGER NOT NULL CHECK (price > 0),
    delivery_time VARCHAR(100),
    includes TEXT[],
    requirements TEXT,
    max_orders_per_day INTEGER DEFAULT 5,
    active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    tags TEXT[],
    sample_work_urls TEXT[],
    revision_count INTEGER DEFAULT 1,
    express_delivery BOOLEAN DEFAULT false,
    express_price INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for creator_offers if they don't exist
CREATE INDEX IF NOT EXISTS idx_creator_offers_creator ON creator_offers(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_offers_active ON creator_offers(active);
CREATE INDEX IF NOT EXISTS idx_creator_offers_category ON creator_offers(category);
CREATE INDEX IF NOT EXISTS idx_creator_offers_display_order ON creator_offers(display_order);

-- ============================================
-- 4. ADD MISSING COLUMNS TO USERS TABLE
-- ============================================
-- Add offer-related columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS offers_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS offers_auto_accept BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS offers_response_time VARCHAR(50) DEFAULT '24 hours',
ADD COLUMN IF NOT EXISTS offers_completion_rate DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS total_offers_completed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_offer_rating DECIMAL(3,2) DEFAULT 0.00;

-- ============================================
-- 5. OFFER REVIEWS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS offer_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_id UUID REFERENCES offer_purchases(id) ON DELETE CASCADE,
    offer_id UUID REFERENCES creator_offers(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    is_public BOOLEAN DEFAULT true,
    creator_response TEXT,
    creator_responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for offer_reviews
CREATE INDEX IF NOT EXISTS idx_offer_reviews_offer ON offer_reviews(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_reviews_creator ON offer_reviews(creator_id);
CREATE INDEX IF NOT EXISTS idx_offer_reviews_rating ON offer_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_offer_reviews_public ON offer_reviews(is_public);

-- ============================================
-- 6. OFFER FAVORITES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS offer_favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    offer_id UUID REFERENCES creator_offers(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, offer_id)
);

-- Create indexes for offer_favorites
CREATE INDEX IF NOT EXISTS idx_offer_favorites_user ON offer_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_offer_favorites_offer ON offer_favorites(offer_id);

-- ============================================
-- 7. OFFER NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS offer_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    offer_id UUID REFERENCES creator_offers(id) ON DELETE CASCADE,
    purchase_id UUID REFERENCES offer_purchases(id),
    booking_id UUID REFERENCES offer_bookings(id),
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for offer_notifications
CREATE INDEX IF NOT EXISTS idx_offer_notifications_user ON offer_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_offer_notifications_unread ON offer_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_offer_notifications_created ON offer_notifications(created_at DESC);

-- ============================================
-- 8. OFFER ANALYTICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS offer_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    offer_id UUID REFERENCES creator_offers(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    views INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    purchases INTEGER DEFAULT 0,
    revenue INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(offer_id, date)
);

-- Create indexes for offer_analytics
CREATE INDEX IF NOT EXISTS idx_offer_analytics_offer ON offer_analytics(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_analytics_creator ON offer_analytics(creator_id);
CREATE INDEX IF NOT EXISTS idx_offer_analytics_date ON offer_analytics(date DESC);

-- ============================================
-- 9. ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE offer_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_analytics ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 10. CREATE RLS POLICIES
-- ============================================

-- Drop existing policies if they exist before creating new ones
DROP POLICY IF EXISTS "Users can view their own purchases" ON offer_purchases;
DROP POLICY IF EXISTS "Users can create purchases" ON offer_purchases;
DROP POLICY IF EXISTS "Creators can update their sales" ON offer_purchases;
DROP POLICY IF EXISTS "Users can view their own bookings" ON offer_bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON offer_bookings;
DROP POLICY IF EXISTS "Users can update their bookings" ON offer_bookings;
DROP POLICY IF EXISTS "Anyone can view active offers" ON creator_offers;
DROP POLICY IF EXISTS "Creators can manage their offers" ON creator_offers;
DROP POLICY IF EXISTS "Anyone can view public reviews" ON offer_reviews;
DROP POLICY IF EXISTS "Users can create reviews for their purchases" ON offer_reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON offer_reviews;
DROP POLICY IF EXISTS "Users can view their favorites" ON offer_favorites;
DROP POLICY IF EXISTS "Users can manage their favorites" ON offer_favorites;
DROP POLICY IF EXISTS "Users can view their notifications" ON offer_notifications;
DROP POLICY IF EXISTS "System can create notifications" ON offer_notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON offer_notifications;
DROP POLICY IF EXISTS "Creators can view their analytics" ON offer_analytics;
DROP POLICY IF EXISTS "System can manage analytics" ON offer_analytics;

-- Policies for offer_purchases
CREATE POLICY "Users can view their own purchases" ON offer_purchases
    FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = creator_id);

CREATE POLICY "Users can create purchases" ON offer_purchases
    FOR INSERT WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Creators can update their sales" ON offer_purchases
    FOR UPDATE USING (auth.uid() = creator_id);

-- Policies for offer_bookings
CREATE POLICY "Users can view their own bookings" ON offer_bookings
    FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = creator_id);

CREATE POLICY "Users can create bookings" ON offer_bookings
    FOR INSERT WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Users can update their bookings" ON offer_bookings
    FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = creator_id);

-- Policies for creator_offers
CREATE POLICY "Anyone can view active offers" ON creator_offers
    FOR SELECT USING (active = true);

CREATE POLICY "Creators can manage their offers" ON creator_offers
    FOR ALL USING (auth.uid() = creator_id);

-- Policies for offer_reviews
CREATE POLICY "Anyone can view public reviews" ON offer_reviews
    FOR SELECT USING (is_public = true);

CREATE POLICY "Users can create reviews for their purchases" ON offer_reviews
    FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "Users can update their own reviews" ON offer_reviews
    FOR UPDATE USING (auth.uid() = reviewer_id);

-- Policies for offer_favorites
CREATE POLICY "Users can view their favorites" ON offer_favorites
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their favorites" ON offer_favorites
    FOR ALL USING (auth.uid() = user_id);

-- Policies for offer_notifications
CREATE POLICY "Users can view their notifications" ON offer_notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" ON offer_notifications
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their notifications" ON offer_notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Policies for offer_analytics
CREATE POLICY "Creators can view their analytics" ON offer_analytics
    FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "System can manage analytics" ON offer_analytics
    FOR ALL USING (true);

-- ============================================
-- 11. CREATE TRIGGERS FOR UPDATED_AT
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for all tables
CREATE TRIGGER update_offer_purchases_updated_at BEFORE UPDATE ON offer_purchases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offer_bookings_updated_at BEFORE UPDATE ON offer_bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_creator_offers_updated_at BEFORE UPDATE ON creator_offers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offer_reviews_updated_at BEFORE UPDATE ON offer_reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offer_analytics_updated_at BEFORE UPDATE ON offer_analytics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 12. CREATE ANALYTICS AGGREGATION FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION aggregate_offer_analytics()
RETURNS void AS $$
BEGIN
    -- Aggregate today's analytics
    INSERT INTO offer_analytics (offer_id, creator_id, date, purchases, revenue)
    SELECT 
        op.offer_id,
        op.creator_id,
        CURRENT_DATE,
        COUNT(*),
        SUM(op.tokens_paid)
    FROM offer_purchases op
    WHERE DATE(op.created_at) = CURRENT_DATE
    GROUP BY op.offer_id, op.creator_id
    ON CONFLICT (offer_id, date) 
    DO UPDATE SET
        purchases = EXCLUDED.purchases,
        revenue = EXCLUDED.revenue,
        updated_at = NOW();
        
    -- Update average ratings
    UPDATE offer_analytics oa
    SET average_rating = (
        SELECT AVG(rating)
        FROM offer_reviews orv
        WHERE orv.offer_id = oa.offer_id
        AND orv.is_public = true
    )
    WHERE oa.date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 13. CREATE NOTIFICATION HELPER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION create_offer_notification(
    p_user_id UUID,
    p_offer_id UUID,
    p_purchase_id UUID,
    p_booking_id UUID,
    p_type VARCHAR,
    p_title VARCHAR,
    p_message TEXT
)
RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO offer_notifications (
        user_id,
        offer_id,
        purchase_id,
        booking_id,
        notification_type,
        title,
        message
    ) VALUES (
        p_user_id,
        p_offer_id,
        p_purchase_id,
        p_booking_id,
        p_type,
        p_title,
        p_message
    ) RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 14. CREATE VIEW FOR OFFER STATISTICS
-- ============================================
CREATE OR REPLACE VIEW offer_statistics AS
SELECT 
    o.id as offer_id,
    o.creator_id,
    o.title,
    o.category,
    o.price,
    o.active,
    COUNT(DISTINCT op.id) as total_purchases,
    COUNT(DISTINCT op.id) FILTER (WHERE op.status = 'completed') as completed_purchases,
    COUNT(DISTINCT op.id) FILTER (WHERE op.status = 'cancelled') as cancelled_purchases,
    SUM(op.tokens_paid) FILTER (WHERE op.status = 'completed') as total_revenue,
    AVG(orv.rating) as average_rating,
    COUNT(DISTINCT orv.id) as total_reviews,
    COUNT(DISTINCT of.id) as total_favorites
FROM creator_offers o
LEFT JOIN offer_purchases op ON o.id = op.offer_id
LEFT JOIN offer_reviews orv ON o.id = orv.offer_id AND orv.is_public = true
LEFT JOIN offer_favorites of ON o.id = of.offer_id
GROUP BY o.id, o.creator_id, o.title, o.category, o.price, o.active;

-- ============================================
-- 15. GRANT PERMISSIONS
-- ============================================
-- Grant necessary permissions to authenticated users
GRANT SELECT ON offer_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION create_offer_notification TO authenticated;
GRANT EXECUTE ON FUNCTION aggregate_offer_analytics TO authenticated;

-- ============================================
-- END OF SCRIPT
-- ============================================
-- Run this entire script in your Supabase SQL Editor
-- After running, your offer system should be fully functional
-- ============================================