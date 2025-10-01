-- Live Shopping Features Migration
-- This migration creates tables for live shopping functionality in streams

-- Stream products association table
CREATE TABLE IF NOT EXISTS stream_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  featured BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  discount_percentage INTEGER DEFAULT 0,
  flash_sale BOOLEAN DEFAULT false,
  flash_sale_ends_at TIMESTAMP WITH TIME ZONE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  featured_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(stream_id, product_id)
);

-- Live shopping purchases during streams
CREATE TABLE IF NOT EXISTS live_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  price_tokens INTEGER NOT NULL,
  discount_applied INTEGER DEFAULT 0,
  purchase_type VARCHAR(50) DEFAULT 'standard', -- standard, flash_sale, auction
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product showcase analytics
CREATE TABLE IF NOT EXISTS product_showcase_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- showcased, clicked, wishlisted, purchased
  viewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Live shopping interactions (polls, questions about products)
CREATE TABLE IF NOT EXISTS shopping_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interaction_type VARCHAR(50) NOT NULL, -- poll, size_request, color_vote, etc
  product_id UUID REFERENCES shop_items(id) ON DELETE SET NULL,
  question TEXT,
  options JSONB, -- For polls: [{option: "Red", votes: 0}, {option: "Blue", votes: 0}]
  active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Viewer interactions with shopping polls/questions
CREATE TABLE IF NOT EXISTS shopping_interaction_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id UUID NOT NULL REFERENCES shopping_interactions(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  response TEXT NOT NULL,
  responded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(interaction_id, viewer_id)
);

-- Flash sale history
CREATE TABLE IF NOT EXISTS flash_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  original_price INTEGER NOT NULL,
  sale_price INTEGER NOT NULL,
  discount_percentage INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL,
  max_quantity INTEGER,
  sold_quantity INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stream_products_stream ON stream_products(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_products_featured ON stream_products(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_live_purchases_stream ON live_purchases(stream_id);
CREATE INDEX IF NOT EXISTS idx_live_purchases_buyer ON live_purchases(buyer_id);
CREATE INDEX IF NOT EXISTS idx_live_purchases_time ON live_purchases(purchased_at DESC);
CREATE INDEX IF NOT EXISTS idx_showcase_events_stream ON product_showcase_events(stream_id);
CREATE INDEX IF NOT EXISTS idx_showcase_events_product ON product_showcase_events(product_id);
CREATE INDEX IF NOT EXISTS idx_showcase_events_type ON product_showcase_events(event_type);
CREATE INDEX IF NOT EXISTS idx_shopping_interactions_stream ON shopping_interactions(stream_id);
CREATE INDEX IF NOT EXISTS idx_shopping_interactions_active ON shopping_interactions(active);
CREATE INDEX IF NOT EXISTS idx_interaction_responses_interaction ON shopping_interaction_responses(interaction_id);
CREATE INDEX IF NOT EXISTS idx_flash_sales_stream ON flash_sales(stream_id);
CREATE INDEX IF NOT EXISTS idx_flash_sales_active ON flash_sales(ends_at);
CREATE INDEX IF NOT EXISTS idx_live_purchases_recent ON live_purchases(purchased_at DESC);

-- Add columns to streams table for shopping features
ALTER TABLE streams 
ADD COLUMN IF NOT EXISTS shopping_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS featured_product_id UUID REFERENCES shop_items(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS total_sales INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS shopping_cart_position VARCHAR(20) DEFAULT 'bottom-right';

-- Add shopping stats to shop_items
ALTER TABLE shop_items
ADD COLUMN IF NOT EXISTS times_showcased INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS live_sales_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_showcased_at TIMESTAMP WITH TIME ZONE;

-- Create function to update product stats after showcase
CREATE OR REPLACE FUNCTION update_product_showcase_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.event_type = 'showcased' THEN
    UPDATE shop_items 
    SET times_showcased = times_showcased + 1,
        last_showcased_at = NOW()
    WHERE id = NEW.product_id;
  ELSIF NEW.event_type = 'purchased' THEN
    UPDATE shop_items 
    SET live_sales_count = live_sales_count + 1
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for showcase stats
DROP TRIGGER IF EXISTS update_showcase_stats_trigger ON product_showcase_events;
CREATE TRIGGER update_showcase_stats_trigger
AFTER INSERT ON product_showcase_events
FOR EACH ROW
EXECUTE FUNCTION update_product_showcase_stats();

-- Grant permissions
GRANT ALL ON stream_products TO authenticated;
GRANT ALL ON live_purchases TO authenticated;
GRANT ALL ON product_showcase_events TO authenticated;
GRANT ALL ON shopping_interactions TO authenticated;
GRANT ALL ON shopping_interaction_responses TO authenticated;
GRANT ALL ON flash_sales TO authenticated;