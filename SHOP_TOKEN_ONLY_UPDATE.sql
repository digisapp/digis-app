-- Update Shop to be Token-Only (No USD)
-- Creators keep 100% of token revenue

-- 1. Update shop_items table to focus on token pricing
ALTER TABLE shop_items 
ALTER COLUMN price_tokens SET NOT NULL,
ALTER COLUMN price_tokens SET DEFAULT 100,
ALTER COLUMN price_usd DROP NOT NULL,
ALTER COLUMN price_usd SET DEFAULT NULL;

-- 2. Update shop_orders to handle token-only payments
ALTER TABLE shop_orders
ALTER COLUMN payment_method SET DEFAULT 'tokens',
DROP CONSTRAINT IF EXISTS shop_orders_payment_method_check;

ALTER TABLE shop_orders
ADD CONSTRAINT shop_orders_payment_method_check 
CHECK (payment_method IN ('tokens', 'stripe')); -- Keep stripe for future if needed

-- 3. Update shop_settings to default to tokens only
UPDATE shop_settings 
SET accepts_tokens = true,
    accepts_usd = false
WHERE creator_id IS NOT NULL;

-- 4. Set all platform fees to 0 (creators keep 100%)
UPDATE shop_orders
SET platform_fee_tokens = 0,
    platform_fee_usd = 0,
    creator_net_tokens = amount_tokens
WHERE platform_fee_tokens > 0;

-- 5. Update default token prices for common items
UPDATE shop_items
SET price_tokens = CASE
    WHEN price_usd <= 10 THEN 200    -- $10 = 200 tokens
    WHEN price_usd <= 25 THEN 500    -- $25 = 500 tokens  
    WHEN price_usd <= 50 THEN 1000   -- $50 = 1000 tokens
    WHEN price_usd <= 100 THEN 2000  -- $100 = 2000 tokens
    ELSE 5000                         -- Higher = 5000 tokens
END
WHERE price_tokens IS NULL;

-- 6. Add comment to clarify token-only system
COMMENT ON COLUMN shop_items.price_tokens IS 'Product price in tokens (primary pricing method)';
COMMENT ON COLUMN shop_items.price_usd IS 'DEPRECATED - Use tokens only. Kept for historical data';
COMMENT ON COLUMN shop_orders.platform_fee_tokens IS 'Platform fee (currently 0% - creators keep 100%)';

-- 7. Create view for simplified shop analytics (tokens only)
CREATE OR REPLACE VIEW shop_analytics_tokens AS
SELECT 
    creator_id,
    COUNT(DISTINCT order_id) as total_orders,
    SUM(amount_tokens) as total_revenue_tokens,
    AVG(amount_tokens) as avg_order_value_tokens,
    COUNT(DISTINCT buyer_id) as unique_customers
FROM shop_orders
WHERE status = 'completed'
GROUP BY creator_id;