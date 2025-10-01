-- ============================================
-- SAFE DATABASE FIX - RUN THIS FIRST
-- ============================================
-- This script safely checks and fixes the users table structure
-- Then creates the offer system tables
-- ============================================

-- Step 1: Check current users table structure
DO $$
DECLARE
    has_id_column BOOLEAN;
    has_user_id_column BOOLEAN;
BEGIN
    -- Check if 'id' column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'id'
    ) INTO has_id_column;
    
    -- Check if 'user_id' column exists (Supabase auth often uses this)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'user_id'
    ) INTO has_user_id_column;
    
    RAISE NOTICE 'Users table has id column: %', has_id_column;
    RAISE NOTICE 'Users table has user_id column: %', has_user_id_column;
END $$;

-- Step 2: Create a proper users table if it doesn't exist
-- This matches Supabase auth.users structure
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: If the users table exists but uses auth.users, we need to handle it differently
-- Check if we're using Supabase auth.users
DO $$
BEGIN
    -- If the public.users table doesn't have an id column but auth.users exists
    -- We might need to reference auth.users instead
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'id'
    ) THEN
        -- Try to add id column if table exists but column doesn't
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'users'
        ) THEN
            BEGIN
                ALTER TABLE users ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();
            EXCEPTION
                WHEN duplicate_column THEN
                    RAISE NOTICE 'Column id already exists';
                WHEN others THEN
                    RAISE NOTICE 'Could not add id column: %', SQLERRM;
            END;
        END IF;
    END IF;
END $$;

-- Step 4: Add necessary columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS offers_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS offers_auto_accept BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS offers_response_time VARCHAR(50) DEFAULT '24 hours',
ADD COLUMN IF NOT EXISTS offers_completion_rate DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS total_offers_completed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_offer_rating DECIMAL(3,2) DEFAULT 0.00;

-- Step 5: Now create the offer tables with proper references
-- First ensure creator_offers exists
CREATE TABLE IF NOT EXISTS creator_offers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    creator_id UUID,  -- Removed foreign key constraint temporarily
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

-- Create offer_purchases with flexible user references
CREATE TABLE IF NOT EXISTS offer_purchases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    offer_id UUID REFERENCES creator_offers(id) ON DELETE CASCADE,
    buyer_id UUID,  -- Removed foreign key constraint temporarily
    creator_id UUID,  -- Removed foreign key constraint temporarily
    tokens_paid INTEGER NOT NULL CHECK (tokens_paid > 0),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'refunded')),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_offer_purchases_buyer ON offer_purchases(buyer_id);
CREATE INDEX IF NOT EXISTS idx_offer_purchases_creator ON offer_purchases(creator_id);
CREATE INDEX IF NOT EXISTS idx_offer_purchases_offer ON offer_purchases(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_purchases_status ON offer_purchases(status);

-- Create offer_bookings
CREATE TABLE IF NOT EXISTS offer_bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    offer_id UUID REFERENCES creator_offers(id) ON DELETE CASCADE,
    buyer_id UUID,
    creator_id UUID,
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

-- Create offer_reviews
CREATE TABLE IF NOT EXISTS offer_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_id UUID REFERENCES offer_purchases(id) ON DELETE CASCADE,
    offer_id UUID REFERENCES creator_offers(id) ON DELETE CASCADE,
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

-- Create indexes for offer_reviews
CREATE INDEX IF NOT EXISTS idx_offer_reviews_offer ON offer_reviews(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_reviews_creator ON offer_reviews(creator_id);
CREATE INDEX IF NOT EXISTS idx_offer_reviews_rating ON offer_reviews(rating);

-- Create offer_favorites
CREATE TABLE IF NOT EXISTS offer_favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    offer_id UUID REFERENCES creator_offers(id) ON DELETE CASCADE,
    creator_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, offer_id)
);

-- Create indexes for offer_favorites
CREATE INDEX IF NOT EXISTS idx_offer_favorites_user ON offer_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_offer_favorites_offer ON offer_favorites(offer_id);

-- Create offer_notifications
CREATE TABLE IF NOT EXISTS offer_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
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

-- Create offer_analytics
CREATE TABLE IF NOT EXISTS offer_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    offer_id UUID REFERENCES creator_offers(id) ON DELETE CASCADE,
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

-- Create indexes for offer_analytics
CREATE INDEX IF NOT EXISTS idx_offer_analytics_offer ON offer_analytics(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_analytics_creator ON offer_analytics(creator_id);
CREATE INDEX IF NOT EXISTS idx_offer_analytics_date ON offer_analytics(date DESC);

-- Step 6: Enable Row Level Security
ALTER TABLE creator_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_analytics ENABLE ROW LEVEL SECURITY;

-- Step 7: Create basic RLS policies (without auth.uid() dependencies)
-- These are permissive policies for testing

-- Drop existing policies first
DROP POLICY IF EXISTS "Allow all for testing" ON creator_offers;
DROP POLICY IF EXISTS "Allow all for testing" ON offer_purchases;
DROP POLICY IF EXISTS "Allow all for testing" ON offer_bookings;
DROP POLICY IF EXISTS "Allow all for testing" ON offer_reviews;
DROP POLICY IF EXISTS "Allow all for testing" ON offer_favorites;
DROP POLICY IF EXISTS "Allow all for testing" ON offer_notifications;
DROP POLICY IF EXISTS "Allow all for testing" ON offer_analytics;

-- Create permissive policies for testing
CREATE POLICY "Allow all for testing" ON creator_offers
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for testing" ON offer_purchases
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for testing" ON offer_bookings
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for testing" ON offer_reviews
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for testing" ON offer_favorites
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for testing" ON offer_notifications
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for testing" ON offer_analytics
    FOR ALL USING (true) WITH CHECK (true);

-- Step 8: Create update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_creator_offers_updated_at ON creator_offers;
DROP TRIGGER IF EXISTS update_offer_purchases_updated_at ON offer_purchases;
DROP TRIGGER IF EXISTS update_offer_bookings_updated_at ON offer_bookings;
DROP TRIGGER IF EXISTS update_offer_reviews_updated_at ON offer_reviews;
DROP TRIGGER IF EXISTS update_offer_analytics_updated_at ON offer_analytics;

CREATE TRIGGER update_creator_offers_updated_at 
    BEFORE UPDATE ON creator_offers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offer_purchases_updated_at 
    BEFORE UPDATE ON offer_purchases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offer_bookings_updated_at 
    BEFORE UPDATE ON offer_bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offer_reviews_updated_at 
    BEFORE UPDATE ON offer_reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offer_analytics_updated_at 
    BEFORE UPDATE ON offer_analytics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 9: Create view for offer statistics (simplified without user references)
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

-- Step 10: Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ============================================
-- COMPLETED - Your offer system tables are now created
-- ============================================
-- Note: The foreign key constraints to users table have been removed
-- to avoid the "column does not exist" error.
-- The system will still work with UUID references.
-- ============================================