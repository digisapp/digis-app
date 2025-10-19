-- Fix creator_offers schema to match backend implementation
-- This migration replaces the old discount/bundle system with a pay-per-offer service marketplace

-- Drop old tables and any dependent objects (they had wrong schema)
DROP TABLE IF EXISTS offer_redemptions CASCADE;
DROP TABLE IF EXISTS offer_purchases CASCADE;
DROP TABLE IF EXISTS creator_offers CASCADE;

-- Drop old functions
DROP FUNCTION IF EXISTS is_offer_valid(INTEGER);
DROP FUNCTION IF EXISTS redeem_offer(INTEGER, UUID, UUID, DECIMAL);

-- Create new creator_offers table for pay-per-offer services
CREATE TABLE creator_offers (
    id SERIAL PRIMARY KEY,
    creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) DEFAULT 'General',
    price_tokens INTEGER NOT NULL CHECK (price_tokens >= 1 AND price_tokens <= 1000000),
    delivery_time VARCHAR(100), -- e.g., "24 hours", "1-3 days", "Instant"
    max_quantity INTEGER, -- NULL = unlimited
    active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create offer_purchases table for tracking purchases
CREATE TABLE offer_purchases (
    id SERIAL PRIMARY KEY,
    offer_id INTEGER NOT NULL REFERENCES creator_offers(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
    tokens_paid INTEGER NOT NULL,
    notes TEXT, -- Custom notes from buyer
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX idx_creator_offers_creator_id ON creator_offers(creator_id);
CREATE INDEX idx_creator_offers_active ON creator_offers(active);
CREATE INDEX idx_creator_offers_category ON creator_offers(category);
CREATE INDEX idx_creator_offers_display_order ON creator_offers(display_order);

CREATE INDEX idx_offer_purchases_offer_id ON offer_purchases(offer_id);
CREATE INDEX idx_offer_purchases_buyer_id ON offer_purchases(buyer_id);
CREATE INDEX idx_offer_purchases_creator_id ON offer_purchases(creator_id);
CREATE INDEX idx_offer_purchases_status ON offer_purchases(status);
CREATE INDEX idx_offer_purchases_created_at ON offer_purchases(created_at);

-- Add comments
COMMENT ON TABLE creator_offers IS 'Custom pay-per-offer services created by creators';
COMMENT ON COLUMN creator_offers.price_tokens IS 'Price in tokens (min 1, max 1,000,000)';
COMMENT ON COLUMN creator_offers.delivery_time IS 'Expected delivery timeframe (e.g., "24 hours", "1-3 days")';
COMMENT ON COLUMN creator_offers.max_quantity IS 'Maximum number of purchases allowed (NULL = unlimited)';
COMMENT ON COLUMN creator_offers.display_order IS 'Order in which offers are displayed on profile';

COMMENT ON TABLE offer_purchases IS 'Track purchases of creator offers';
COMMENT ON COLUMN offer_purchases.status IS 'Purchase status: pending, in_progress, completed, or cancelled';
COMMENT ON COLUMN offer_purchases.notes IS 'Custom notes/requirements from buyer';
