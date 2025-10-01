-- Critical Data Integrity Fixes

-- 1. Add unique constraints to prevent duplicate purchases
-- Check if constraint exists before adding
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_vod_purchase'
  ) THEN
    ALTER TABLE vod_purchases ADD CONSTRAINT unique_vod_purchase
      UNIQUE (user_id, recording_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_poll_vote'
  ) THEN
    -- Check if poll_votes has user_id or voter_id column
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'poll_votes' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE poll_votes ADD CONSTRAINT unique_poll_vote
        UNIQUE (poll_id, user_id);
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'poll_votes' AND column_name = 'voter_id'
    ) THEN
      ALTER TABLE poll_votes ADD CONSTRAINT unique_poll_vote
        UNIQUE (poll_id, voter_id);
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  -- Check if flash_sale_purchases table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'flash_sale_purchases'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'unique_flash_sale_purchase'
    ) THEN
      -- Check column names
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'flash_sale_purchases' AND column_name = 'user_id'
      ) THEN
        ALTER TABLE flash_sale_purchases ADD CONSTRAINT unique_flash_sale_purchase
          UNIQUE (sale_id, user_id, product_id);
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'flash_sale_purchases' AND column_name = 'buyer_id'
      ) THEN
        ALTER TABLE flash_sale_purchases ADD CONSTRAINT unique_flash_sale_purchase
          UNIQUE (sale_id, buyer_id, product_id);
      END IF;
    END IF;
  END IF;
END $$;

-- 2. Add idempotency keys for VOD purchases
ALTER TABLE vod_purchases ADD COLUMN IF NOT EXISTS idempotency_key UUID DEFAULT gen_random_uuid();
CREATE INDEX IF NOT EXISTS idx_vod_purchases_idempotency ON vod_purchases (idempotency_key);

-- 3. Add unique constraint for active polls per stream
DO $$
BEGIN
  -- Check if polls table exists first
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'polls'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE indexname = 'unique_active_poll_per_stream'
    ) THEN
      CREATE UNIQUE INDEX unique_active_poll_per_stream
        ON polls (stream_id)
        WHERE is_active = true;
    END IF;
  END IF;
END $$;

-- 4. Add unique constraint for flash sales
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'flash_sales'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'unique_active_flash_sale'
    ) THEN
      -- Check if is_active column exists
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'flash_sales' AND column_name = 'is_active'
      ) THEN
        ALTER TABLE flash_sales ADD CONSTRAINT unique_active_flash_sale
          UNIQUE (stream_id, product_id, is_active);
      ELSE
        -- If no is_active column, just ensure one flash sale per product per stream
        ALTER TABLE flash_sales ADD CONSTRAINT unique_active_flash_sale
          UNIQUE (stream_id, product_id);
      END IF;
    END IF;
  END IF;
END $$;

-- 5. Create system configuration table for all hardcoded values
CREATE TABLE IF NOT EXISTS system_config (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'tokens', 'pricing', 'limits', 'features'
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES users(supabase_id)
);

-- Insert default configuration values
INSERT INTO system_config (key, value, category, description) VALUES
  ('token_usd_rate', '0.05', 'tokens', 'USD value per token'),
  ('platform_fee_percentage', '20', 'pricing', 'Platform fee percentage for transactions'),
  ('vod_default_price', '50', 'pricing', 'Default VOD price in tokens'),
  ('vod_purchase_expiry_hours', '48', 'pricing', 'Hours before VOD purchase expires'),
  ('tv_subscription_trial_days', '60', 'features', 'TV subscription trial period in days'),
  ('tv_subscription_price', '100', 'pricing', 'TV subscription price in tokens'),
  ('min_withdrawal_amount', '1000', 'limits', 'Minimum withdrawal amount in tokens'),
  ('max_file_upload_size', '104857600', 'limits', 'Maximum file upload size in bytes (100MB)'),
  ('session_auto_end_minutes', '30', 'features', 'Minutes of inactivity before auto-ending session'),
  ('refresh_token_days', '7', 'features', 'Refresh token validity in days'),
  ('access_token_minutes', '15', 'features', 'Access token validity in minutes')
ON CONFLICT (key) DO NOTHING;

-- 6. Create gift catalog table (move from hardcoded)
CREATE TABLE IF NOT EXISTS gift_catalog (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  price_tokens INTEGER NOT NULL,
  icon VARCHAR(50),
  animation_url TEXT,
  rarity VARCHAR(20) DEFAULT 'common', -- common, rare, epic, legendary
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default gifts
INSERT INTO gift_catalog (name, display_name, price_tokens, icon, rarity) VALUES
  ('heart', 'Heart', 10, '❤️', 'common'),
  ('rose', 'Rose', 20, '🌹', 'common'),
  ('diamond', 'Diamond', 100, '💎', 'rare'),
  ('crown', 'Crown', 500, '👑', 'epic'),
  ('rocket', 'Rocket', 1000, '🚀', 'legendary'),
  ('star', 'Star', 50, '⭐', 'common'),
  ('fire', 'Fire', 75, '🔥', 'rare'),
  ('unicorn', 'Unicorn', 250, '🦄', 'epic')
ON CONFLICT (name) DO NOTHING;

-- 7. Add audit trail for badge changes
CREATE TABLE IF NOT EXISTS loyalty_history (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(supabase_id),
  badge_id UUID, -- May reference badges if table exists, but no FK constraint for flexibility
  badge_name VARCHAR(100), -- Store badge name for reference
  action VARCHAR(50) NOT NULL, -- 'earned', 'revoked', 'upgraded'
  previous_tier VARCHAR(20),
  new_tier VARCHAR(20),
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_loyalty_history_user ON loyalty_history(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_history_badge ON loyalty_history(badge_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_history_created ON loyalty_history(created_at);

-- 8. Fix token_balances to be the single source of truth
-- Ensure all users have an entry in token_balances
-- This is skipped as it requires understanding your specific FK structure
-- You can manually run the appropriate query based on your database:
-- Option 1: If token_balances.user_id references users.supabase_id:
--   INSERT INTO token_balances (user_id, balance)
--   SELECT supabase_id::text, COALESCE(token_balance, 0) FROM users
--   ON CONFLICT (user_id) DO NOTHING;
-- Option 2: If token_balances.user_id references users.id:
--   INSERT INTO token_balances (user_id, balance)
--   SELECT id::text, COALESCE(token_balance, 0) FROM users
--   ON CONFLICT (user_id) DO NOTHING;

-- 9. Add indexes for performance on frequently queried tables
-- Check each table and column exists before creating index
DO $$
BEGIN
  -- Sessions index
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sessions') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'sessions'
      AND column_name IN ('creator_id', 'status')
      GROUP BY table_name
      HAVING COUNT(*) = 2
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_sessions_creator_status ON sessions(creator_id, status);
    END IF;
  END IF;

  -- Shop items index
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shop_items') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'shop_items'
      AND column_name IN ('creator_id', 'is_active')
      GROUP BY table_name
      HAVING COUNT(*) = 2
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_shop_items_creator_active ON shop_items(creator_id, is_active);
    END IF;
  END IF;

  -- Creator offers index - check for different possible column names
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'creator_offers') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'creator_offers'
      AND column_name IN ('creator_id', 'is_active')
      GROUP BY table_name
      HAVING COUNT(*) = 2
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_creator_offers_creator_active ON creator_offers(creator_id, is_active);
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'creator_offers'
      AND column_name IN ('creator_id', 'active')
      GROUP BY table_name
      HAVING COUNT(*) = 2
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_creator_offers_creator_active ON creator_offers(creator_id, active);
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'creator_offers'
      AND column_name = 'creator_id'
    ) THEN
      -- Just index by creator_id if no active/is_active column
      CREATE INDEX IF NOT EXISTS idx_creator_offers_creator ON creator_offers(creator_id);
    END IF;
  END IF;

  -- Polls index
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'polls') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'polls'
      AND column_name IN ('stream_id', 'is_active')
      GROUP BY table_name
      HAVING COUNT(*) = 2
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_polls_stream_active ON polls(stream_id, is_active);
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'polls'
      AND column_name = 'stream_id'
    ) THEN
      -- Just index by stream_id if no is_active column
      CREATE INDEX IF NOT EXISTS idx_polls_stream ON polls(stream_id);
    END IF;
  END IF;
END $$;

-- 10. Add transaction status tracking for better rollback handling
CREATE TABLE IF NOT EXISTS transaction_logs (
  id SERIAL PRIMARY KEY,
  transaction_id UUID DEFAULT gen_random_uuid(),
  transaction_type VARCHAR(50) NOT NULL, -- 'tip', 'purchase', 'subscription', 'gift', 'vod'
  user_id UUID REFERENCES users(supabase_id),
  amount INTEGER NOT NULL, -- in tokens
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'rolled_back'
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_transaction_logs_user ON transaction_logs(user_id);
CREATE INDEX idx_transaction_logs_status ON transaction_logs(status);
CREATE INDEX idx_transaction_logs_type ON transaction_logs(transaction_type);