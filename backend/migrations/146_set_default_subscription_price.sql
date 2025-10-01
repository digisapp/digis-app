-- Set default subscription price to 500 tokens for all creators
-- This ensures every creator has a starting subscription price

-- First, add the subscription_price column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users'
                   AND column_name = 'subscription_price') THEN
        ALTER TABLE users ADD COLUMN subscription_price INTEGER DEFAULT 500;
        RAISE NOTICE 'Added subscription_price column to users table';
    END IF;
END $$;

-- Update all creators who don't have a subscription price set
UPDATE users
SET subscription_price = 500
WHERE is_creator = true
  AND (subscription_price IS NULL OR subscription_price = 0);

-- Add a check constraint to ensure subscription price is at least 100 tokens
-- First drop existing constraint if it exists
ALTER TABLE users DROP CONSTRAINT IF EXISTS check_min_subscription_price;

-- Add new constraint
ALTER TABLE users
ADD CONSTRAINT check_min_subscription_price
CHECK (subscription_price IS NULL OR subscription_price >= 100);

-- Set default value for subscription_price column (in case it already existed)
ALTER TABLE users
ALTER COLUMN subscription_price SET DEFAULT 500;

-- Log the update
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count
    FROM users
    WHERE is_creator = true AND subscription_price = 500;

    RAISE NOTICE 'Set default subscription price for % creators', updated_count;
END $$;