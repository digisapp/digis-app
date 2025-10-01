-- Migration: Standardized Subscription Tiers System
-- This migration converts from custom subscription plans to standardized 4-tier system

-- Create new subscription_tier_pricing table for creators
CREATE TABLE IF NOT EXISTS subscription_tier_pricing (
  id SERIAL PRIMARY KEY,
  creator_id UUID NOT NULL UNIQUE,
  bronze_price INTEGER NOT NULL DEFAULT 50 CHECK (bronze_price >= 50 AND bronze_price <= 1000),
  silver_price INTEGER NOT NULL DEFAULT 100 CHECK (silver_price >= 100 AND silver_price <= 2000),
  gold_price INTEGER NOT NULL DEFAULT 200 CHECK (gold_price >= 200 AND gold_price <= 4000),
  platinum_price INTEGER NOT NULL DEFAULT 400 CHECK (platinum_price >= 400 AND platinum_price <= 10000),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure tier pricing relationships
  CONSTRAINT valid_tier_progression CHECK (
    silver_price >= bronze_price * 1.5 AND
    gold_price >= bronze_price * 2.5 AND
    platinum_price >= bronze_price * 4.0 AND
    silver_price < gold_price AND
    gold_price < platinum_price
  )
);

-- Create index for quick lookups
CREATE INDEX idx_tier_pricing_creator ON subscription_tier_pricing(creator_id);

-- Update subscriptions table to use tier system (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
    ALTER TABLE subscriptions 
    ADD COLUMN IF NOT EXISTS tier VARCHAR(20) CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum'));
  END IF;
END $$;

-- Add tier column if it doesn't exist and migrate existing subscriptions
DO $$ 
BEGIN
  -- Only update if subscription_plans table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscription_plans') THEN
    -- Set default tiers based on existing price ranges (if applicable)
    UPDATE subscriptions s
    SET tier = CASE
      WHEN sp.price < 100 THEN 'bronze'
      WHEN sp.price < 250 THEN 'silver'
      WHEN sp.price < 500 THEN 'gold'
      ELSE 'platinum'
    END
    FROM subscription_plans sp
    WHERE s.plan_id = sp.id AND s.tier IS NULL;
  ELSE
    -- If subscription_plans doesn't exist, just set a default tier
    UPDATE subscriptions
    SET tier = 'bronze'
    WHERE tier IS NULL;
  END IF;
END $$;

-- Create subscription_tier_benefits table (static benefits reference)
CREATE TABLE IF NOT EXISTS subscription_tier_benefits (
  id SERIAL PRIMARY KEY,
  tier VARCHAR(20) NOT NULL UNIQUE CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  tier_order INTEGER NOT NULL,
  pay_per_view_content BOOLEAN DEFAULT true,
  free_messaging BOOLEAN DEFAULT false,
  free_streams BOOLEAN DEFAULT false,
  free_classes BOOLEAN DEFAULT false,
  messaging_discount INTEGER DEFAULT 0 CHECK (messaging_discount >= 0 AND messaging_discount <= 100),
  streams_discount INTEGER DEFAULT 0 CHECK (streams_discount >= 0 AND streams_discount <= 100),
  video_calls_discount INTEGER DEFAULT 0 CHECK (video_calls_discount >= 0 AND video_calls_discount <= 100),
  classes_discount INTEGER DEFAULT 0 CHECK (classes_discount >= 0 AND classes_discount <= 100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert tier benefits (static data)
INSERT INTO subscription_tier_benefits (
  tier, tier_order, pay_per_view_content, free_messaging, free_streams, free_classes,
  messaging_discount, streams_discount, video_calls_discount, classes_discount
) VALUES 
  ('bronze', 1, true, false, false, false, 0, 0, 0, 0),
  ('silver', 2, true, true, false, false, 100, 25, 10, 10),
  ('gold', 3, true, true, true, false, 100, 100, 30, 25),
  ('platinum', 4, true, true, true, true, 100, 100, 50, 100)
ON CONFLICT (tier) DO NOTHING;

-- Create function to validate tier pricing updates
CREATE OR REPLACE FUNCTION validate_tier_pricing()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate tier relationships
  IF NEW.silver_price < NEW.bronze_price * 1.5 THEN
    RAISE EXCEPTION 'Silver price must be at least 1.5x Bronze price';
  END IF;
  
  IF NEW.gold_price < NEW.bronze_price * 2.5 THEN
    RAISE EXCEPTION 'Gold price must be at least 2.5x Bronze price';
  END IF;
  
  IF NEW.platinum_price < NEW.bronze_price * 4.0 THEN
    RAISE EXCEPTION 'Platinum price must be at least 4x Bronze price';
  END IF;
  
  IF NEW.silver_price >= NEW.gold_price THEN
    RAISE EXCEPTION 'Gold price must be higher than Silver price';
  END IF;
  
  IF NEW.gold_price >= NEW.platinum_price THEN
    RAISE EXCEPTION 'Platinum price must be higher than Gold price';
  END IF;
  
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for pricing validation
CREATE TRIGGER validate_tier_pricing_trigger
BEFORE INSERT OR UPDATE ON subscription_tier_pricing
FOR EACH ROW
EXECUTE FUNCTION validate_tier_pricing();

-- Create view for subscription analytics (only if subscriptions table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
    EXECUTE 'CREATE OR REPLACE VIEW subscription_tier_analytics AS
    SELECT 
      stp.creator_id,
      COUNT(CASE WHEN s.tier = ''bronze'' THEN 1 END) as bronze_subscribers,
      COUNT(CASE WHEN s.tier = ''silver'' THEN 1 END) as silver_subscribers,
      COUNT(CASE WHEN s.tier = ''gold'' THEN 1 END) as gold_subscribers,
      COUNT(CASE WHEN s.tier = ''platinum'' THEN 1 END) as platinum_subscribers,
      COUNT(s.id) as total_subscribers,
      COALESCE(
        SUM(CASE 
          WHEN s.tier = ''bronze'' THEN stp.bronze_price
          WHEN s.tier = ''silver'' THEN stp.silver_price
          WHEN s.tier = ''gold'' THEN stp.gold_price
          WHEN s.tier = ''platinum'' THEN stp.platinum_price
        END), 0
      ) as monthly_recurring_revenue
    FROM subscription_tier_pricing stp
    LEFT JOIN subscriptions s ON s.creator_id = stp.creator_id AND s.status = ''active''
    GROUP BY stp.creator_id';
  END IF;
END $$;

-- Migrate existing subscription plans to tier pricing (if subscription_plans exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscription_plans') THEN
    INSERT INTO subscription_tier_pricing (creator_id, bronze_price, silver_price, gold_price, platinum_price)
    SELECT DISTINCT
      sp.creator_id,
      GREATEST(50, MIN(CASE WHEN sp.price < 100 THEN sp.price ELSE 50 END)),
      GREATEST(100, MIN(CASE WHEN sp.price >= 100 AND sp.price < 250 THEN sp.price ELSE 100 END)),
      GREATEST(200, MIN(CASE WHEN sp.price >= 250 AND sp.price < 500 THEN sp.price ELSE 200 END)),
      GREATEST(400, MIN(CASE WHEN sp.price >= 500 THEN sp.price ELSE 400 END))
    FROM subscription_plans sp
    WHERE NOT EXISTS (
      SELECT 1 FROM subscription_tier_pricing stp WHERE stp.creator_id = sp.creator_id
    )
    GROUP BY sp.creator_id;
  END IF;
END $$;

-- Add helper function to check subscriber benefits
CREATE OR REPLACE FUNCTION check_subscriber_benefits(
  p_user_id TEXT,
  p_creator_id TEXT,
  p_benefit_type TEXT
) RETURNS JSONB AS $$
DECLARE
  v_tier VARCHAR(20);
  v_benefits RECORD;
  v_result JSONB;
BEGIN
  -- Get user's subscription tier for this creator
  SELECT tier INTO v_tier
  FROM subscriptions
  WHERE fan_id = p_user_id 
    AND creator_id = p_creator_id 
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_tier IS NULL THEN
    RETURN jsonb_build_object(
      'has_subscription', false,
      'tier', null,
      'has_access', false,
      'discount', 0
    );
  END IF;
  
  -- Get tier benefits
  SELECT * INTO v_benefits
  FROM subscription_tier_benefits
  WHERE tier = v_tier;
  
  -- Check specific benefit
  CASE p_benefit_type
    WHEN 'messaging' THEN
      v_result := jsonb_build_object(
        'has_subscription', true,
        'tier', v_tier,
        'has_access', v_benefits.free_messaging,
        'discount', v_benefits.messaging_discount
      );
    WHEN 'streams' THEN
      v_result := jsonb_build_object(
        'has_subscription', true,
        'tier', v_tier,
        'has_access', v_benefits.free_streams,
        'discount', v_benefits.streams_discount
      );
    WHEN 'classes' THEN
      v_result := jsonb_build_object(
        'has_subscription', true,
        'tier', v_tier,
        'has_access', v_benefits.free_classes,
        'discount', v_benefits.classes_discount
      );
    WHEN 'video_calls' THEN
      v_result := jsonb_build_object(
        'has_subscription', true,
        'tier', v_tier,
        'has_access', false,
        'discount', v_benefits.video_calls_discount
      );
    ELSE
      v_result := jsonb_build_object(
        'has_subscription', true,
        'tier', v_tier,
        'has_access', v_benefits.pay_per_view_content,
        'discount', 0
      );
  END CASE;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Create index for subscription lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_fan_creator_tier 
ON subscriptions(fan_id, creator_id, tier) 
WHERE status = 'active';

-- Add comment documentation
COMMENT ON TABLE subscription_tier_pricing IS 'Stores creator-specific pricing for standardized subscription tiers';
COMMENT ON TABLE subscription_tier_benefits IS 'Static table defining benefits for each subscription tier';
COMMENT ON FUNCTION check_subscriber_benefits IS 'Helper function to check if a user has access to specific creator benefits based on their subscription tier';