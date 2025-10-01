-- Add subscription_price column to creators table for single-tier subscription model
-- This replaces the old Bronze/Silver/Gold/Platinum tier system

-- Add subscription_price column if it doesn't exist
ALTER TABLE creators
ADD COLUMN IF NOT EXISTS subscription_price INTEGER DEFAULT 500;

-- Add comment for documentation
COMMENT ON COLUMN creators.subscription_price IS 'Single subscription price in tokens set by creator (replaces tier system)';

-- Update existing creators with a default price if needed
UPDATE creators
SET subscription_price = 500
WHERE subscription_price IS NULL;

-- Remove old tier-related columns from subscriptions table if they exist
ALTER TABLE subscriptions
DROP COLUMN IF EXISTS tier,
DROP COLUMN IF EXISTS tier_id,
DROP COLUMN IF EXISTS tier_name;

-- Add price column to subscriptions if it doesn't exist
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS price INTEGER;

-- Update existing subscriptions with creator's current price
UPDATE subscriptions s
SET price = COALESCE(c.subscription_price, 500)
FROM creators c
WHERE s.creator_id = c.user_id
AND s.price IS NULL;

-- Drop old tier-related tables if they exist
DROP TABLE IF EXISTS subscription_tiers CASCADE;
DROP TABLE IF EXISTS subscription_tier_pricing CASCADE;
DROP TABLE IF EXISTS subscription_tier_analytics CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_creators_subscription_price ON creators(subscription_price);
CREATE INDEX IF NOT EXISTS idx_subscriptions_price ON subscriptions(price);

-- Success message
SELECT 'Subscription system simplified to single-tier model' as status;