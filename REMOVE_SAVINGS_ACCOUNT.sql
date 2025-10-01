-- Migration to remove savings account feature
-- This simplifies the token economy by having a single balance

-- 1. Drop the savings_balance column from token_balances table
ALTER TABLE token_balances 
DROP COLUMN IF EXISTS savings_balance CASCADE;

-- 2. Drop the savings_goals table if it exists
DROP TABLE IF EXISTS savings_goals CASCADE;

-- 3. Remove any savings-related transaction types from token_transactions
-- Update historical records to generic 'transfer' type
UPDATE token_transactions 
SET type = 'transfer'
WHERE type IN ('transfer_to_savings', 'transfer_from_savings');

-- 4. Optional: Add a comment to the balance column explaining the change
COMMENT ON COLUMN token_balances.balance IS 'Single token balance for all purposes (previously split between available and savings)';

-- 5. Create an index on balance for better query performance
CREATE INDEX IF NOT EXISTS idx_token_balances_balance ON token_balances(balance);

-- Note: After running this migration, all tokens will be in a single balance
-- that can be used for any purchase (classes, streams, tips, etc.)