-- ============================================
-- SIMPLE DATABASE FIX - NO FOREIGN KEYS, NO POLICIES
-- ============================================
-- This creates all offer tables without any constraints or policies
-- Run this to get the tables created first
-- ============================================

-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255),
    username VARCHAR(100),
    display_name VARCHAR(255),
    bio TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    is_creator BOOLEAN DEFAULT false,
    is_admin BOOLEAN DEFAULT false,
    role VARCHAR(50) DEFAULT 'fan',
    token_balance INTEGER DEFAULT 0,
    offers_enabled BOOLEAN DEFAULT false,
    offers_auto_accept BOOLEAN DEFAULT false,
    offers_response_time VARCHAR(50) DEFAULT '24 hours',
    offers_completion_rate DECIMAL(5,2) DEFAULT 0.00,
    total_offers_completed INTEGER DEFAULT 0,
    average_offer_rating DECIMAL(3,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create creator_offers table
CREATE TABLE IF NOT EXISTS creator_offers (
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
CREATE TABLE IF NOT EXISTS offer_purchases (
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
CREATE TABLE IF NOT EXISTS offer_bookings (
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
CREATE TABLE IF NOT EXISTS offer_reviews (
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
CREATE TABLE IF NOT EXISTS offer_favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    offer_id UUID,
    creator_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create offer_notifications table
CREATE TABLE IF NOT EXISTS offer_notifications (
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
CREATE TABLE IF NOT EXISTS offer_analytics (
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint for offer_analytics
ALTER TABLE offer_analytics DROP CONSTRAINT IF EXISTS offer_analytics_offer_id_date_key;
ALTER TABLE offer_analytics ADD CONSTRAINT offer_analytics_offer_id_date_key UNIQUE (offer_id, date);

-- Add unique constraint for offer_favorites  
ALTER TABLE offer_favorites DROP CONSTRAINT IF EXISTS offer_favorites_user_id_offer_id_key;
ALTER TABLE offer_favorites ADD CONSTRAINT offer_favorites_user_id_offer_id_key UNIQUE (user_id, offer_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_offer_purchases_buyer ON offer_purchases(buyer_id);
CREATE INDEX IF NOT EXISTS idx_offer_purchases_creator ON offer_purchases(creator_id);
CREATE INDEX IF NOT EXISTS idx_offer_purchases_offer ON offer_purchases(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_purchases_status ON offer_purchases(status);
CREATE INDEX IF NOT EXISTS idx_offer_bookings_buyer ON offer_bookings(buyer_id);
CREATE INDEX IF NOT EXISTS idx_offer_bookings_creator ON offer_bookings(creator_id);
CREATE INDEX IF NOT EXISTS idx_offer_bookings_date ON offer_bookings(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_offer_reviews_offer ON offer_reviews(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_reviews_creator ON offer_reviews(creator_id);
CREATE INDEX IF NOT EXISTS idx_offer_favorites_user ON offer_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_offer_favorites_offer ON offer_favorites(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_notifications_user ON offer_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_offer_analytics_offer ON offer_analytics(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_analytics_creator ON offer_analytics(creator_id);

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================
-- TABLES CREATED SUCCESSFULLY!
-- ============================================
-- All offer system tables are now created without any foreign keys or policies
-- The system will work with UUID references
-- You can add foreign keys and policies later if needed
-- ============================================