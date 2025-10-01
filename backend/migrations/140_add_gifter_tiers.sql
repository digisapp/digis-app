-- Migration: Add Gifter Tiers System
-- Description: Implements medieval nobility tier system based on lifetime token spending

-- Add columns to users table for tier tracking
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS lifetime_tokens_spent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS gifter_tier VARCHAR(50) DEFAULT 'Supporter',
ADD COLUMN IF NOT EXISTS gifter_tier_color VARCHAR(7) DEFAULT '#5C4033',
ADD COLUMN IF NOT EXISTS gifter_tier_achieved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Create gifter tiers reference table
CREATE TABLE IF NOT EXISTS gifter_tiers (
  id SERIAL PRIMARY KEY,
  tier_name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(50) NOT NULL,
  minimum_tokens INTEGER NOT NULL,
  color_hex VARCHAR(7) NOT NULL,
  tier_order INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert tier definitions
INSERT INTO gifter_tiers (tier_name, display_name, minimum_tokens, color_hex, tier_order, description) VALUES
('Supporter', 'Supporter', 0, '#5C4033', 1, 'Earthy brown for common supporters, evoking the humble loyalty of medieval villagers'),
('Squire', 'Squire Gifter', 2500, '#008080', 2, 'Vibrant teal, symbolizing the aspiring loyalty of a squire serving a knight'),
('Knight', 'Knight Gifter', 10000, '#B22222', 3, 'Bold red, reflecting the valor and sworn fealty of a knight'),
('Baron', 'Baron Gifter', 20000, '#FFD700', 4, 'Rich gold, signifying the rising status of a landed baron'),
('Count', 'Count Gifter', 50000, '#4169E1', 5, 'Deep blue, denoting the noble authority of a count in the royal court'),
('Duke', 'Duke Gifter', 100000, '#9B59B6', 6, 'Regal purple, reserved for the elite loyalty of a duke, close to royalty'),
('Crown', 'Crown Gifter', 1000000, '#FF4500', 7, 'Fiery orange-red, marking the ultimate loyalty akin to a royal patron')
ON CONFLICT (tier_name) DO NOTHING;

-- Create table to track tier achievement history
CREATE TABLE IF NOT EXISTS gifter_tier_history (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  tier_name VARCHAR(50) NOT NULL,
  tokens_spent INTEGER NOT NULL,
  achieved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_tier UNIQUE(user_id, tier_name)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_lifetime_tokens_spent ON users(lifetime_tokens_spent DESC);
CREATE INDEX IF NOT EXISTS idx_users_gifter_tier ON users(gifter_tier);
CREATE INDEX IF NOT EXISTS idx_gifter_tier_history_user_id ON gifter_tier_history(user_id);

-- Function to calculate and update user tier
CREATE OR REPLACE FUNCTION update_user_gifter_tier(user_id UUID)
RETURNS void AS $$
DECLARE
  user_tokens INTEGER;
  new_tier RECORD;
  current_tier VARCHAR(50);
BEGIN
  -- Get user's lifetime tokens spent
  SELECT lifetime_tokens_spent, gifter_tier INTO user_tokens, current_tier
  FROM users
  WHERE supabase_id = user_id;
  
  -- Find the appropriate tier
  SELECT * INTO new_tier
  FROM gifter_tiers
  WHERE minimum_tokens <= user_tokens
  ORDER BY tier_order DESC
  LIMIT 1;
  
  -- Update user's tier if it changed
  IF new_tier.tier_name IS NOT NULL AND new_tier.tier_name != current_tier THEN
    UPDATE users
    SET 
      gifter_tier = new_tier.tier_name,
      gifter_tier_color = new_tier.color_hex,
      gifter_tier_achieved_at = CURRENT_TIMESTAMP
    WHERE supabase_id = user_id;
    
    -- Record achievement in history
    INSERT INTO gifter_tier_history (user_id, tier_name, tokens_spent)
    VALUES (user_id, new_tier.tier_name, user_tokens)
    ON CONFLICT (user_id, tier_name) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update tier when tokens are spent
CREATE OR REPLACE FUNCTION update_lifetime_tokens_spent()
RETURNS TRIGGER AS $$
BEGIN
  -- Only count spending transactions (negative amounts)
  IF NEW.amount < 0 AND NEW.type IN ('spend', 'tip', 'gift', 'call', 'session', 'message', 'gift_sent') THEN
    -- Update lifetime_tokens_spent for the user
    UPDATE users
    SET lifetime_tokens_spent = lifetime_tokens_spent + ABS(NEW.amount)
    WHERE supabase_id = NEW.user_id;
    
    -- Update the user's tier
    PERFORM update_user_gifter_tier(NEW.user_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on token_transactions table
DROP TRIGGER IF EXISTS update_user_tier_on_token_spend ON token_transactions;
CREATE TRIGGER update_user_tier_on_token_spend
AFTER INSERT ON token_transactions
FOR EACH ROW
EXECUTE FUNCTION update_lifetime_tokens_spent();

-- Update existing users with their lifetime token spending (one-time calculation)
UPDATE users u
SET lifetime_tokens_spent = COALESCE((
  SELECT SUM(ABS(amount))
  FROM token_transactions t
  WHERE t.user_id = u.supabase_id
  AND t.amount < 0
  AND t.type IN ('spend', 'tip', 'gift', 'call', 'session', 'message', 'gift_sent')
), 0);

-- Update all users' tiers based on their lifetime spending
UPDATE users u
SET 
  gifter_tier = gt.tier_name,
  gifter_tier_color = gt.color_hex
FROM (
  SELECT DISTINCT ON (u2.supabase_id)
    u2.supabase_id,
    gt2.tier_name,
    gt2.color_hex
  FROM users u2
  CROSS JOIN LATERAL (
    SELECT *
    FROM gifter_tiers gt3
    WHERE gt3.minimum_tokens <= u2.lifetime_tokens_spent
    ORDER BY gt3.tier_order DESC
    LIMIT 1
  ) gt2
) gt
WHERE u.supabase_id = gt.supabase_id;