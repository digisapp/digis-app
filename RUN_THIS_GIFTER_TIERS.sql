-- GIFTER TIERS MIGRATION
-- Run this in Supabase SQL Editor to enable the Medieval Nobility Tier System
-- This tracks lifetime token spending and assigns color-coded tiers to users

-- =====================================================
-- STEP 1: Add columns to users table for tier tracking
-- =====================================================
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS lifetime_tokens_spent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS gifter_tier VARCHAR(50) DEFAULT 'Supporter',
ADD COLUMN IF NOT EXISTS gifter_tier_color VARCHAR(7) DEFAULT '#5C4033',
ADD COLUMN IF NOT EXISTS gifter_tier_achieved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- =====================================================
-- STEP 2: Create gifter tiers reference table
-- =====================================================
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

-- Insert tier definitions (Medieval Nobility Theme)
INSERT INTO gifter_tiers (tier_name, display_name, minimum_tokens, color_hex, tier_order, description) VALUES
('Supporter', 'Supporter', 0, '#5C4033', 1, 'Earthy brown for common supporters, evoking the humble loyalty of medieval villagers'),
('Squire', 'Squire Gifter', 2500, '#008080', 2, 'Vibrant teal, symbolizing the aspiring loyalty of a squire serving a knight'),
('Knight', 'Knight Gifter', 10000, '#B22222', 3, 'Bold red, reflecting the valor and sworn fealty of a knight'),
('Baron', 'Baron Gifter', 20000, '#FFD700', 4, 'Rich gold, signifying the rising status of a landed baron'),
('Count', 'Count Gifter', 50000, '#4169E1', 5, 'Deep blue, denoting the noble authority of a count in the royal court'),
('Duke', 'Duke Gifter', 100000, '#9B59B6', 6, 'Regal purple, reserved for the elite loyalty of a duke, close to royalty'),
('Crown', 'Crown Gifter', 1000000, '#FF4500', 7, 'Fiery orange-red, marking the ultimate loyalty akin to a royal patron')
ON CONFLICT (tier_name) DO NOTHING;

-- =====================================================
-- STEP 3: Create tier achievement history table
-- =====================================================
CREATE TABLE IF NOT EXISTS gifter_tier_history (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier_name VARCHAR(50) NOT NULL,
  tokens_spent INTEGER NOT NULL,
  achieved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_tier UNIQUE(user_id, tier_name)
);

-- =====================================================
-- STEP 4: Create indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_users_lifetime_tokens_spent ON users(lifetime_tokens_spent DESC);
CREATE INDEX IF NOT EXISTS idx_users_gifter_tier ON users(gifter_tier);
CREATE INDEX IF NOT EXISTS idx_gifter_tier_history_user_id ON gifter_tier_history(user_id);

-- =====================================================
-- STEP 5: Function to calculate and update user tier
-- =====================================================
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
  WHERE id = user_id;
  
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
    WHERE id = user_id;
    
    -- Record achievement in history
    INSERT INTO gifter_tier_history (user_id, tier_name, tokens_spent)
    VALUES (user_id, new_tier.tier_name, user_tokens)
    ON CONFLICT (user_id, tier_name) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 6: Trigger to update tier when tokens are spent
-- =====================================================
CREATE OR REPLACE FUNCTION update_lifetime_tokens_spent()
RETURNS TRIGGER AS $$
BEGIN
  -- Only count spending transactions (negative amounts for token_transactions)
  IF NEW.amount < 0 AND NEW.type IN ('spend', 'tip', 'gift', 'call', 'session', 'message', 'gift_sent') THEN
    -- Update lifetime_tokens_spent for the user
    UPDATE users
    SET lifetime_tokens_spent = lifetime_tokens_spent + ABS(NEW.amount)
    WHERE id = NEW.user_id;
    
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

-- =====================================================
-- STEP 7: Calculate existing lifetime spending
-- =====================================================
-- Update existing users with their lifetime token spending (one-time calculation)
-- This looks at all past spending transactions
UPDATE users u
SET lifetime_tokens_spent = COALESCE((
  SELECT SUM(ABS(amount))
  FROM token_transactions t
  WHERE t.user_id = u.id
  AND t.amount < 0
  AND t.type IN ('spend', 'tip', 'gift', 'call', 'session', 'message', 'gift_sent')
), 0);

-- =====================================================
-- STEP 8: Update all users' tiers based on spending
-- =====================================================
-- Update all users' tiers based on their lifetime spending
UPDATE users u
SET 
  gifter_tier = gt.tier_name,
  gifter_tier_color = gt.color_hex
FROM (
  SELECT DISTINCT ON (u2.id)
    u2.id,
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
WHERE u.id = gt.id;

-- =====================================================
-- VERIFICATION: Check the results
-- =====================================================
-- Show tier distribution
SELECT 
  gifter_tier,
  COUNT(*) as user_count,
  MIN(lifetime_tokens_spent) as min_tokens,
  MAX(lifetime_tokens_spent) as max_tokens,
  AVG(lifetime_tokens_spent)::INTEGER as avg_tokens
FROM users
GROUP BY gifter_tier
ORDER BY 
  CASE gifter_tier
    WHEN 'Crown' THEN 7
    WHEN 'Duke' THEN 6
    WHEN 'Count' THEN 5
    WHEN 'Baron' THEN 4
    WHEN 'Knight' THEN 3
    WHEN 'Squire' THEN 2
    WHEN 'Supporter' THEN 1
    ELSE 0
  END DESC;

-- Show top 10 spenders
SELECT 
  username,
  lifetime_tokens_spent,
  gifter_tier,
  gifter_tier_color
FROM users
WHERE lifetime_tokens_spent > 0
ORDER BY lifetime_tokens_spent DESC
LIMIT 10;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
-- The Gifter Tier System is now active!
-- Users will be automatically assigned tiers based on lifetime spending.
-- Colors will appear in the frontend wherever GifterUsername component is used.