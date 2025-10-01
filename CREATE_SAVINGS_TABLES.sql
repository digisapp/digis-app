-- Add savings_balance column to token_balances table
ALTER TABLE token_balances 
ADD COLUMN IF NOT EXISTS savings_balance DECIMAL(20, 2) DEFAULT 0;

-- Create savings_goals table
CREATE TABLE IF NOT EXISTS savings_goals (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  target_amount DECIMAL(20, 2) NOT NULL,
  target_date DATE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_savings_goals_user_id ON savings_goals(user_id);

-- Update token_transactions to track savings transfers
-- The metadata column should already exist to store transfer details

-- Sample query to check savings balance
-- SELECT balance, savings_balance, (balance + savings_balance) as total_tokens 
-- FROM token_balances WHERE user_id = 'YOUR_USER_ID';