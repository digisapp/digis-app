-- 142_token_system_hardening.sql
-- Token System Hardening: Integer tokens, idempotency, row locking support
-- Prevents double-credits, race conditions, and rounding bugs

BEGIN;

-- 1) Add missing columns to token_balances (total_purchased, total_spent, total_earned)
ALTER TABLE token_balances
  ADD COLUMN IF NOT EXISTS total_purchased BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_spent BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earned BIGINT DEFAULT 0;

-- Rename 'amount' column to 'tokens' for consistency
ALTER TABLE token_transactions
  RENAME COLUMN amount TO tokens;

-- Add bonus_tokens column
ALTER TABLE token_transactions
  ADD COLUMN IF NOT EXISTS bonus_tokens BIGINT DEFAULT 0;

-- 2) Idempotency + linkage
-- Note: stripe_payment_intent_id already exists, so only add the missing ones
ALTER TABLE token_transactions
  ADD COLUMN IF NOT EXISTS client_idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS related_user_id UUID;

-- Unique per Stripe intent (prevents double credit on retries/webhooks)
-- Note: This will fail silently if constraint already exists
ALTER TABLE token_transactions
  DROP CONSTRAINT IF EXISTS uniq_purchase_by_intent;

ALTER TABLE token_transactions
  ADD CONSTRAINT uniq_purchase_by_intent
  UNIQUE (stripe_payment_intent_id) DEFERRABLE INITIALLY IMMEDIATE;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_tt_client_key
  ON token_transactions (client_idempotency_key)
  WHERE client_idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tt_user_created
  ON token_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tt_related_user
  ON token_transactions (related_user_id);

CREATE INDEX IF NOT EXISTS idx_tb_user
  ON token_balances (user_id);

-- 3) Enforce non-negative balances
ALTER TABLE token_balances
  DROP CONSTRAINT IF EXISTS chk_balance_non_negative;
ALTER TABLE token_balances
  ADD CONSTRAINT chk_balance_non_negative CHECK (balance >= 0);

-- 4) Account debt flags (for chargebacks)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_status VARCHAR(50) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS debt_amount BIGINT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_account_status
  ON users (account_status) WHERE account_status <> 'active';

-- Add table comments
COMMENT ON CONSTRAINT uniq_purchase_by_intent ON token_transactions IS
  'Prevents double-crediting tokens from duplicate Stripe webhook events or retries';

COMMENT ON INDEX uniq_tt_client_key IS
  'Client-generated idempotency key for non-Stripe transactions (gifts, tips)';

COMMENT ON COLUMN users.account_status IS
  'Account status: active, suspended, debt (chargeback with insufficient balance)';

COMMENT ON COLUMN users.debt_amount IS
  'Outstanding token debt from chargebacks when balance was insufficient';

COMMIT;
