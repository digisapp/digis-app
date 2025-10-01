-- Migration: Create Dual Badge System (Subscription + Loyalty)
-- Description: Implements combined subscription tier and loyalty badge tracking

-- Create loyalty badges table
CREATE TABLE IF NOT EXISTS loyalty_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    level VARCHAR(20) DEFAULT 'bronze' CHECK (level IN ('bronze', 'silver', 'gold', 'diamond')),
    total_spend DECIMAL(10,2) DEFAULT 0,
    support_duration_days INTEGER DEFAULT 0,
    first_interaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_interaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    perks JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, creator_id)
);

-- Create perk deliveries table
CREATE TABLE IF NOT EXISTS perk_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    perk_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed', 'expired')),
    delivery_data JSONB DEFAULT '{}',
    delivered_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add subscription tracking columns to memberships table
ALTER TABLE memberships 
ADD COLUMN IF NOT EXISTS loyalty_level VARCHAR(20),
ADD COLUMN IF NOT EXISTS combined_perks JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS total_months_subscribed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS lifetime_value DECIMAL(10,2) DEFAULT 0;

-- Create subscription tiers enhanced table (if not exists)
CREATE TABLE IF NOT EXISTS subscription_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    display_name VARCHAR(50),
    price DECIMAL(10,2) NOT NULL,
    tier_level INTEGER DEFAULT 1 CHECK (tier_level BETWEEN 1 AND 10),
    color VARCHAR(7) DEFAULT '#6366F1',
    badge_icon VARCHAR(255),
    perks JSONB DEFAULT '[]',
    tokens_included INTEGER DEFAULT 0,
    session_discount_percent INTEGER DEFAULT 0,
    exclusive_content BOOLEAN DEFAULT false,
    priority_support BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    max_subscribers INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(creator_id, name)
);

-- Create combined badge view for easy querying
CREATE OR REPLACE VIEW user_badges_view AS
SELECT 
    u.id as user_id,
    u.username,
    u.display_name,
    lb.level as loyalty_level,
    lb.total_spend,
    lb.support_duration_days,
    m.tier_id,
    mt.name as subscription_tier,
    mt.display_name as subscription_display_name,
    mt.color as subscription_color,
    mt.badge_icon as subscription_icon,
    m.status as subscription_status,
    m.started_at as subscription_started,
    CASE 
        WHEN lb.total_spend >= 500 OR lb.support_duration_days >= 180 THEN '💎'
        WHEN lb.total_spend >= 100 OR lb.support_duration_days >= 90 THEN '🥇'
        WHEN lb.total_spend >= 50 OR lb.support_duration_days >= 30 THEN '🥈'
        ELSE '🥉'
    END as loyalty_emoji,
    CASE 
        WHEN mt.tier_level >= 8 THEN '👑'
        WHEN mt.tier_level >= 5 THEN '⭐'
        WHEN mt.tier_level >= 3 THEN '✨'
        ELSE '🔸'
    END as subscription_emoji
FROM users u
LEFT JOIN loyalty_badges lb ON u.id = lb.user_id
LEFT JOIN memberships m ON u.id = m.user_id AND m.status = 'active'
LEFT JOIN membership_tiers mt ON m.tier_id = mt.id;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_loyalty_badges_user_id ON loyalty_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_badges_creator_id ON loyalty_badges(creator_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_badges_level ON loyalty_badges(level);
CREATE INDEX IF NOT EXISTS idx_perk_deliveries_user_id ON perk_deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_perk_deliveries_status ON perk_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_perk_deliveries_created_at ON perk_deliveries(created_at);

-- Function to update loyalty badge level
CREATE OR REPLACE FUNCTION update_loyalty_badge_level()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate support duration
    NEW.support_duration_days := EXTRACT(DAY FROM (CURRENT_TIMESTAMP - NEW.first_interaction_date));
    
    -- Determine badge level based on spend and duration
    IF NEW.total_spend >= 500 OR NEW.support_duration_days >= 180 THEN
        NEW.level := 'diamond';
        NEW.perks := '["20% extra discount", "Priority support", "Exclusive content", "Monthly bonus tokens"]'::jsonb;
    ELSIF NEW.total_spend >= 100 OR NEW.support_duration_days >= 90 THEN
        NEW.level := 'gold';
        NEW.perks := '["15% extra discount", "Priority messages", "Weekly exclusive content"]'::jsonb;
    ELSIF NEW.total_spend >= 50 OR NEW.support_duration_days >= 30 THEN
        NEW.level := 'silver';
        NEW.perks := '["10% extra discount", "Early access", "Monthly exclusive content"]'::jsonb;
    ELSE
        NEW.level := 'bronze';
        NEW.perks := '["5% welcome discount", "Community access"]'::jsonb;
    END IF;
    
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic badge level updates
DROP TRIGGER IF EXISTS trigger_update_loyalty_badge ON loyalty_badges;
CREATE TRIGGER trigger_update_loyalty_badge
BEFORE INSERT OR UPDATE OF total_spend ON loyalty_badges
FOR EACH ROW
EXECUTE FUNCTION update_loyalty_badge_level();

-- Function to calculate combined perks
CREATE OR REPLACE FUNCTION calculate_combined_perks(
    p_subscription_perks JSONB,
    p_loyalty_perks JSONB
) RETURNS JSONB AS $$
DECLARE
    combined_perks JSONB;
BEGIN
    -- Merge subscription and loyalty perks
    combined_perks := COALESCE(p_subscription_perks, '[]'::jsonb) || COALESCE(p_loyalty_perks, '[]'::jsonb);
    
    -- Remove duplicates
    SELECT jsonb_agg(DISTINCT value)
    INTO combined_perks
    FROM jsonb_array_elements(combined_perks);
    
    RETURN COALESCE(combined_perks, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Function to deliver perks
CREATE OR REPLACE FUNCTION deliver_perk(
    p_user_id UUID,
    p_creator_id UUID,
    p_perk_type VARCHAR,
    p_delivery_data JSONB
) RETURNS VOID AS $$
BEGIN
    INSERT INTO perk_deliveries (
        user_id, 
        creator_id, 
        perk_type, 
        status, 
        delivery_data, 
        delivered_at
    ) VALUES (
        p_user_id,
        p_creator_id,
        p_perk_type,
        'delivered',
        p_delivery_data,
        CURRENT_TIMESTAMP
    );
END;
$$ LANGUAGE plpgsql;

-- Archive old perk deliveries (older than 90 days)
CREATE OR REPLACE FUNCTION archive_old_perks() 
RETURNS void AS $$
BEGIN
    DELETE FROM perk_deliveries 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days'
    AND status IN ('delivered', 'expired');
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON user_badges_view TO authenticated;
GRANT ALL ON loyalty_badges TO authenticated;
GRANT ALL ON perk_deliveries TO authenticated;
GRANT ALL ON subscription_tiers TO authenticated;