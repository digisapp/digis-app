-- Create table for creator special offers
CREATE TABLE IF NOT EXISTS creator_offers (
    id SERIAL PRIMARY KEY,
    creator_id UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    offer_type VARCHAR(50) NOT NULL, -- 'discount', 'bundle', 'special', 'limited_time'
    discount_percentage INTEGER CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
    bundle_minutes INTEGER,
    bundle_price DECIMAL(10, 2),
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE,
    max_uses INTEGER,
    uses_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_creator_offers_creator_id ON creator_offers(creator_id);
CREATE INDEX idx_creator_offers_is_active ON creator_offers(is_active);
CREATE INDEX idx_creator_offers_valid_dates ON creator_offers(valid_from, valid_until);

-- Create table for offer redemptions
CREATE TABLE IF NOT EXISTS offer_redemptions (
    id SERIAL PRIMARY KEY,
    offer_id INTEGER NOT NULL REFERENCES creator_offers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    session_id UUID,
    redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    discount_applied DECIMAL(10, 2)
);

-- Create indexes for redemptions
CREATE INDEX idx_offer_redemptions_offer_id ON offer_redemptions(offer_id);
CREATE INDEX idx_offer_redemptions_user_id ON offer_redemptions(user_id);

-- Function to check if offer is valid
CREATE OR REPLACE FUNCTION is_offer_valid(p_offer_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    v_offer RECORD;
BEGIN
    SELECT * INTO v_offer
    FROM creator_offers
    WHERE id = p_offer_id
    AND is_active = true
    AND (valid_from IS NULL OR valid_from <= NOW())
    AND (valid_until IS NULL OR valid_until >= NOW())
    AND (max_uses IS NULL OR uses_count < max_uses);
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to redeem an offer
CREATE OR REPLACE FUNCTION redeem_offer(
    p_offer_id INTEGER,
    p_user_id UUID,
    p_session_id UUID DEFAULT NULL,
    p_discount_amount DECIMAL DEFAULT 0
)
RETURNS BOOLEAN AS $$
DECLARE
    v_valid BOOLEAN;
BEGIN
    -- Check if offer is valid
    v_valid := is_offer_valid(p_offer_id);
    
    IF NOT v_valid THEN
        RETURN FALSE;
    END IF;
    
    -- Insert redemption record
    INSERT INTO offer_redemptions (offer_id, user_id, session_id, discount_applied)
    VALUES (p_offer_id, p_user_id, p_session_id, p_discount_amount);
    
    -- Update uses count
    UPDATE creator_offers
    SET uses_count = uses_count + 1,
        updated_at = NOW()
    WHERE id = p_offer_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON TABLE creator_offers IS 'Special offers and promotions created by creators';
COMMENT ON COLUMN creator_offers.offer_type IS 'Type of offer: discount, bundle, special, or limited_time';
COMMENT ON TABLE offer_redemptions IS 'Track when offers are redeemed by users';