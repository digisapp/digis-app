-- Migration to add withdrawal protection features
-- This adds reserved balance and auto-withdrawal toggle for creators

-- 1. Add reserved_balance column to users table (for creators)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS reserved_balance DECIMAL(20, 2) DEFAULT 0 
CHECK (reserved_balance >= 0);

-- 2. Add auto_withdraw_enabled column with default FALSE for safety
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS auto_withdraw_enabled BOOLEAN DEFAULT FALSE;

-- 3. Add last_auto_withdraw_date to track withdrawal history
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_auto_withdraw_date TIMESTAMP;

-- 4. Add next_auto_withdraw_date for scheduling
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS next_auto_withdraw_date TIMESTAMP;

-- 5. Set all existing creators to have auto-withdrawal DISABLED by default
UPDATE users 
SET auto_withdraw_enabled = FALSE 
WHERE is_creator = TRUE;

-- 6. Add comments for documentation
COMMENT ON COLUMN users.reserved_balance IS 'Amount of tokens reserved from auto-withdrawal (creator-defined minimum balance)';
COMMENT ON COLUMN users.auto_withdraw_enabled IS 'Whether auto-withdrawal is enabled (default FALSE for safety)';
COMMENT ON COLUMN users.last_auto_withdraw_date IS 'Date of last automatic withdrawal';
COMMENT ON COLUMN users.next_auto_withdraw_date IS 'Scheduled date for next automatic withdrawal (bi-weekly)';

-- 7. Create an index for efficient queries on auto-withdrawal
CREATE INDEX IF NOT EXISTS idx_users_auto_withdraw 
ON users(is_creator, auto_withdraw_enabled, next_auto_withdraw_date) 
WHERE is_creator = TRUE;

-- 8. Create a function to calculate withdrawable balance
CREATE OR REPLACE FUNCTION get_withdrawable_balance(user_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    current_balance DECIMAL;
    reserved DECIMAL;
    withdrawable DECIMAL;
BEGIN
    -- Get user's current token balance and reserved amount
    SELECT 
        COALESCE(tb.balance, 0),
        COALESCE(u.reserved_balance, 0)
    INTO current_balance, reserved
    FROM users u
    LEFT JOIN token_balances tb ON tb.user_id = u.supabase_id
    WHERE u.supabase_id = user_id;
    
    -- Calculate withdrawable amount (balance minus reserved)
    withdrawable := GREATEST(0, current_balance - reserved);
    
    RETURN withdrawable;
END;
$$ LANGUAGE plpgsql;

-- 9. Create a view for easy access to withdrawal information
CREATE OR REPLACE VIEW creator_withdrawal_info AS
SELECT 
    u.supabase_id,
    u.display_name,
    u.email,
    u.is_creator,
    u.auto_withdraw_enabled,
    u.reserved_balance,
    u.last_auto_withdraw_date,
    u.next_auto_withdraw_date,
    COALESCE(tb.balance, 0) as current_balance,
    GREATEST(0, COALESCE(tb.balance, 0) - COALESCE(u.reserved_balance, 0)) as withdrawable_balance,
    CASE 
        WHEN u.stripe_account_id IS NOT NULL THEN TRUE
        ELSE FALSE
    END as has_bank_account
FROM users u
LEFT JOIN token_balances tb ON tb.user_id = u.supabase_id
WHERE u.is_creator = TRUE;

-- 10. Add a trigger to prevent withdrawal if no bank account is set up
CREATE OR REPLACE FUNCTION check_withdrawal_requirements()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if creator has bank account setup
    IF NEW.auto_withdraw_enabled = TRUE AND 
       (NEW.stripe_account_id IS NULL OR NEW.stripe_account_id = '') THEN
        RAISE EXCEPTION 'Cannot enable auto-withdrawal without bank account setup';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_withdrawal_requirements
BEFORE UPDATE ON users
FOR EACH ROW
WHEN (NEW.auto_withdraw_enabled IS DISTINCT FROM OLD.auto_withdraw_enabled)
EXECUTE FUNCTION check_withdrawal_requirements();

-- Note: After this migration:
-- 1. All creators will have auto-withdrawal DISABLED by default
-- 2. Creators must manually enable auto-withdrawal
-- 3. Creators can set a reserved balance that won't be withdrawn
-- 4. System will only withdraw (balance - reserved_balance)
-- 5. If no bank account is set up, tokens will accumulate