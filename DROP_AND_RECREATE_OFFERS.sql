-- ============================================
-- DROP AND RECREATE OFFER TABLES
-- ============================================
-- This script drops existing offer tables and policies, then recreates them
-- ============================================

-- Step 1: Drop all existing policies that might be causing issues
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on offer-related tables if they exist
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE tablename IN (
            'offer_purchases', 
            'offer_bookings', 
            'creator_offers', 
            'offer_reviews', 
            'offer_favorites', 
            'offer_notifications', 
            'offer_analytics'
        )
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
            r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Step 2: Drop existing offer tables (CASCADE to drop dependent objects)
DROP TABLE IF EXISTS offer_analytics CASCADE;
DROP TABLE IF EXISTS offer_notifications CASCADE;
DROP TABLE IF EXISTS offer_favorites CASCADE;
DROP TABLE IF EXISTS offer_reviews CASCADE;
DROP TABLE IF EXISTS offer_bookings CASCADE;
DROP TABLE IF EXISTS offer_purchases CASCADE;
DROP TABLE IF EXISTS creator_offers CASCADE;

-- Step 3: Drop the view if it exists
DROP VIEW IF EXISTS offer_statistics CASCADE;

-- Step 4: Now create fresh tables without any foreign keys

-- Create creator_offers table
CREATE TABLE creator_offers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    creator_id UUID,
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

-- Create offer_purchases table
CREATE TABLE offer_purchases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    offer_id UUID,
    buyer_id UUID,
    creator_id UUID,
    tokens_paid INTEGER NOT NULL CHECK (tokens_paid > 0),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create offer_bookings table
CREATE TABLE offer_bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    offer_id UUID,
    buyer_id UUID,
    creator_id UUID,
    purchase_id UUID,
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    duration_minutes INTEGER DEFAULT 60,
    meeting_link TEXT,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'scheduled',
    reminder_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create offer_reviews table
CREATE TABLE offer_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_id UUID,
    offer_id UUID,
    reviewer_id UUID,
    creator_id UUID,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    is_public BOOLEAN DEFAULT true,
    creator_response TEXT,
    creator_responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create offer_favorites table
CREATE TABLE offer_favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    offer_id UUID,
    creator_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, offer_id)
);

-- Create offer_notifications table
CREATE TABLE offer_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    offer_id UUID,
    purchase_id UUID,
    booking_id UUID,
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create offer_analytics table
CREATE TABLE offer_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    offer_id UUID,
    creator_id UUID,
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

-- Step 5: Create indexes for performance
CREATE INDEX idx_offer_purchases_buyer ON offer_purchases(buyer_id);
CREATE INDEX idx_offer_purchases_creator ON offer_purchases(creator_id);
CREATE INDEX idx_offer_purchases_offer ON offer_purchases(offer_id);
CREATE INDEX idx_offer_purchases_status ON offer_purchases(status);
CREATE INDEX idx_offer_bookings_buyer ON offer_bookings(buyer_id);
CREATE INDEX idx_offer_bookings_creator ON offer_bookings(creator_id);
CREATE INDEX idx_offer_bookings_date ON offer_bookings(scheduled_date);
CREATE INDEX idx_offer_reviews_offer ON offer_reviews(offer_id);
CREATE INDEX idx_offer_reviews_creator ON offer_reviews(creator_id);
CREATE INDEX idx_offer_favorites_user ON offer_favorites(user_id);
CREATE INDEX idx_offer_favorites_offer ON offer_favorites(offer_id);
CREATE INDEX idx_offer_notifications_user ON offer_notifications(user_id);
CREATE INDEX idx_offer_analytics_offer ON offer_analytics(offer_id);
CREATE INDEX idx_offer_analytics_creator ON offer_analytics(creator_id);

-- Step 6: Grant permissions (no RLS for now)
GRANT ALL ON creator_offers TO authenticated;
GRANT ALL ON offer_purchases TO authenticated;
GRANT ALL ON offer_bookings TO authenticated;
GRANT ALL ON offer_reviews TO authenticated;
GRANT ALL ON offer_favorites TO authenticated;
GRANT ALL ON offer_notifications TO authenticated;
GRANT ALL ON offer_analytics TO authenticated;

-- Step 7: Create a simple view for statistics
CREATE VIEW offer_statistics AS
SELECT 
    o.id as offer_id,
    o.creator_id,
    o.title,
    o.category,
    o.price,
    o.active,
    COUNT(DISTINCT op.id) as total_purchases,
    COUNT(DISTINCT op.id) FILTER (WHERE op.status = 'completed') as completed_purchases,
    SUM(op.tokens_paid) FILTER (WHERE op.status = 'completed') as total_revenue,
    AVG(orv.rating) as average_rating,
    COUNT(DISTINCT orv.id) as total_reviews
FROM creator_offers o
LEFT JOIN offer_purchases op ON o.id = op.offer_id
LEFT JOIN offer_reviews orv ON o.id = orv.offer_id AND orv.is_public = true
GROUP BY o.id, o.creator_id, o.title, o.category, o.price, o.active;

-- Grant permission on the view
GRANT SELECT ON offer_statistics TO authenticated;

-- ============================================
-- COMPLETED - Tables recreated without RLS
-- ============================================
-- All offer tables have been dropped and recreated
-- No RLS policies are applied
-- No foreign key constraints are enforced
-- ============================================