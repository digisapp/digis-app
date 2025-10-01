-- =====================================================
-- Migration: Create Shop Tables for Creator Marketplace
-- =====================================================

-- Shop Items Table
CREATE TABLE IF NOT EXISTS shop_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price_usd DECIMAL(10, 2) NOT NULL,
  price_tokens INTEGER,
  category VARCHAR(100),
  images JSONB DEFAULT '[]',
  stock_quantity INTEGER DEFAULT -1, -- -1 means unlimited
  is_digital BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  sales_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Shop Orders Table
CREATE TABLE IF NOT EXISTS shop_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  item_id UUID NOT NULL REFERENCES shop_items(id) ON DELETE RESTRICT,
  creator_id UUID NOT NULL REFERENCES users(supabase_id),
  buyer_id UUID REFERENCES users(supabase_id), -- Null for guest checkouts
  buyer_email VARCHAR(255) NOT NULL,
  buyer_name VARCHAR(255),
  quantity INTEGER NOT NULL DEFAULT 1,
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('stripe', 'tokens')),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id VARCHAR(255),
  stripe_session_id VARCHAR(255),
  amount_usd DECIMAL(10, 2),
  amount_tokens INTEGER,
  tokens_credited INTEGER, -- Tokens given to creator for USD purchases
  platform_fee_tokens INTEGER DEFAULT 0, -- Platform fee in token equivalent (30% for USD)
  platform_fee_usd DECIMAL(10,2) DEFAULT 0, -- Platform fee in USD
  creator_net_tokens INTEGER, -- Net tokens after platform fee
  shipping_address JSONB,
  digital_delivery_info JSONB,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Shop Categories Table
CREATE TABLE IF NOT EXISTS shop_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(creator_id, slug)
);

-- Shop Reviews Table (optional, for future)
CREATE TABLE IF NOT EXISTS shop_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES users(supabase_id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  is_verified_purchase BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(order_id, item_id)
);

-- Shop Settings Table
CREATE TABLE IF NOT EXISTS shop_settings (
  creator_id UUID PRIMARY KEY REFERENCES users(supabase_id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT false,
  shop_name VARCHAR(255),
  shop_description TEXT,
  banner_image VARCHAR(500),
  policies JSONB DEFAULT '{}', -- Return policy, shipping info, etc.
  accepts_usd BOOLEAN DEFAULT true,
  accepts_tokens BOOLEAN DEFAULT true,
  usd_to_token_rate DECIMAL(10, 4) DEFAULT 20.0, -- $1 = 20 tokens for creator
  shipping_countries JSONB DEFAULT '["US"]',
  tax_settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_shop_items_creator ON shop_items(creator_id, is_active);
CREATE INDEX idx_shop_items_category ON shop_items(category);
CREATE INDEX idx_shop_orders_creator ON shop_orders(creator_id, status);
CREATE INDEX idx_shop_orders_buyer ON shop_orders(buyer_id);
CREATE INDEX idx_shop_orders_number ON shop_orders(order_number);
CREATE INDEX idx_shop_orders_date ON shop_orders(created_at DESC);

-- Function to generate order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'ORD-' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDD') || '-' || 
         LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate order numbers
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number_trigger
  BEFORE INSERT ON shop_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_shop_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_shop_items_updated_at
  BEFORE UPDATE ON shop_items
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_updated_at();

CREATE TRIGGER update_shop_orders_updated_at
  BEFORE UPDATE ON shop_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_updated_at();

CREATE TRIGGER update_shop_settings_updated_at
  BEFORE UPDATE ON shop_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_updated_at();

-- RLS Policies
ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_settings ENABLE ROW LEVEL SECURITY;

-- Shop items are publicly readable when active
CREATE POLICY "Shop items are publicly readable when active"
  ON shop_items FOR SELECT
  USING (is_active = true);

-- Creators can manage their own shop items
CREATE POLICY "Creators can manage their own shop items"
  ON shop_items FOR ALL
  USING (auth.uid() = creator_id);

-- Orders are readable by creator and buyer
CREATE POLICY "Orders readable by creator and buyer"
  ON shop_orders FOR SELECT
  USING (auth.uid() = creator_id OR auth.uid() = buyer_id);

-- Anyone can create orders (for guest checkout)
CREATE POLICY "Anyone can create orders"
  ON shop_orders FOR INSERT
  WITH CHECK (true);

-- Creators can update their own orders
CREATE POLICY "Creators can update their orders"
  ON shop_orders FOR UPDATE
  USING (auth.uid() = creator_id);

-- Shop settings manageable by creator
CREATE POLICY "Shop settings manageable by creator"
  ON shop_settings FOR ALL
  USING (auth.uid() = creator_id);

-- Categories manageable by creator
CREATE POLICY "Categories manageable by creator"
  ON shop_categories FOR ALL
  USING (auth.uid() = creator_id);