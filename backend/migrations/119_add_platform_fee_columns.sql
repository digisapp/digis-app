-- Add platform fee tracking columns to shop_orders table
ALTER TABLE shop_orders 
ADD COLUMN IF NOT EXISTS platform_fee_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS platform_fee_usd DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS creator_net_tokens INTEGER;

-- Create platform_earnings table to track Digis revenue
CREATE TABLE IF NOT EXISTS platform_earnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES shop_orders(id) ON DELETE CASCADE,
  earning_type VARCHAR(50) NOT NULL, -- 'shop_commission', 'token_purchase', etc.
  amount_usd DECIMAL(10,2),
  amount_tokens INTEGER,
  creator_id UUID REFERENCES users(supabase_id),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_platform_earnings_type (earning_type),
  INDEX idx_platform_earnings_created (created_at)
);

-- Add commission rate to shop settings
ALTER TABLE shop_settings
ADD COLUMN IF NOT EXISTS platform_commission_rate DECIMAL(5,2) DEFAULT 20.00; -- 20% default

-- Create view for creator net earnings
CREATE OR REPLACE VIEW creator_shop_earnings AS
SELECT 
  o.creator_id,
  COUNT(DISTINCT o.id) as total_orders,
  SUM(o.amount_usd) as gross_sales_usd,
  SUM(o.amount_tokens) as gross_sales_tokens,
  SUM(o.creator_net_tokens) as net_tokens_earned,
  SUM(o.platform_fee_usd) as platform_fees_usd,
  SUM(o.platform_fee_tokens) as platform_fees_tokens,
  AVG(CASE 
    WHEN o.amount_usd > 0 THEN (o.creator_net_tokens::DECIMAL / (o.amount_usd * 20)) * 100
    ELSE 100 
  END) as avg_creator_percentage
FROM shop_orders o
WHERE o.payment_status = 'completed'
GROUP BY o.creator_id;

COMMENT ON COLUMN shop_orders.platform_fee_tokens IS 'Platform commission in token equivalent (20% for USD purchases)';
COMMENT ON COLUMN shop_orders.platform_fee_usd IS 'Platform commission in USD';
COMMENT ON COLUMN shop_orders.creator_net_tokens IS 'Net tokens credited to creator after platform fee';
COMMENT ON TABLE platform_earnings IS 'Tracks all platform revenue streams including shop commissions';