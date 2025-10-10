-- Migration 144: Add Ledger Integrity Constraints and Idempotency
-- Purpose: Harden token accounting with proper constraints, indexes, and audit trails
-- Author: System
-- Date: 2025-01-XX

-- ============================================================================
-- PART 1: Add Missing Columns for Complete Transaction Tracking
-- ============================================================================

-- Ensure token_transactions has all required fields for double-entry accounting
ALTER TABLE token_transactions
  ADD COLUMN IF NOT EXISTS balance_before BIGINT,
  ADD COLUMN IF NOT EXISTS balance_after BIGINT,
  ADD COLUMN IF NOT EXISTS ref_id UUID,  -- Links related transactions (e.g., tip debit+credit pair)
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'internal',  -- 'stripe', 'internal', 'admin_adjust', etc.
  ADD COLUMN IF NOT EXISTS provider_event_id TEXT;  -- Stripe payment_intent.id, event.id, etc.

-- Add metadata column if missing (for storing additional context)
ALTER TABLE token_transactions
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Normalize transaction types to be more explicit
COMMENT ON COLUMN token_transactions.type IS
  'Transaction types: purchase, quick_purchase, tip, call, gift_sent, gift_received, ' ||
  'gift_card_created, gift_card_redeemed, smart_refill, payout, refund, admin_adjust, chargeback';

-- ============================================================================
-- PART 2: Idempotency - Prevent Duplicate Webhook Processing
-- ============================================================================

-- Create unique index on Stripe event IDs to prevent duplicate processing
CREATE UNIQUE INDEX IF NOT EXISTS uniq_provider_event_id
  ON token_transactions(provider_event_id)
  WHERE provider_event_id IS NOT NULL;

-- Create unique index on Stripe payment intent IDs
CREATE UNIQUE INDEX IF NOT EXISTS uniq_stripe_payment_intent
  ON token_transactions(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- Create index on ref_id to quickly find transaction pairs
CREATE INDEX IF NOT EXISTS idx_token_tx_ref_id
  ON token_transactions(ref_id)
  WHERE ref_id IS NOT NULL;

-- ============================================================================
-- PART 3: Balance Integrity Constraints
-- ============================================================================

-- Ensure balance snapshots are recorded (for future audit trails)
-- Note: Existing rows may have NULL, so we don't add NOT NULL constraint yet
-- New code must populate these fields

-- Add check constraint: balance changes must make sense
ALTER TABLE token_transactions
  ADD CONSTRAINT chk_balance_progression CHECK (
    balance_before IS NULL OR
    balance_after IS NULL OR
    balance_after = balance_before + tokens
  );

-- Ensure tokens column represents the delta correctly
COMMENT ON COLUMN token_transactions.tokens IS
  'Token delta: positive = credit (added to balance), negative = debit (removed from balance)';

-- ============================================================================
-- PART 4: Create Reconciliation Audit Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS reconciliation_audit (
  id SERIAL PRIMARY KEY,
  check_timestamp TIMESTAMPTZ DEFAULT NOW(),
  check_type TEXT NOT NULL,  -- 'hourly_balance', 'stripe_sync', 'double_entry'
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'warning')),

  -- Balance reconciliation fields
  total_purchased BIGINT,
  total_burned BIGINT,
  total_user_balances BIGINT,
  total_fees BIGINT,
  expected_balance BIGINT,
  actual_balance BIGINT,
  discrepancy BIGINT,

  -- Stripe reconciliation fields
  stripe_total_payments BIGINT,
  ledger_total_purchases BIGINT,
  missing_events TEXT[],
  duplicate_events TEXT[],

  -- Double-entry check fields
  unbalanced_ref_ids UUID[],

  details JSONB DEFAULT '{}',
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolution_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reconciliation_timestamp ON reconciliation_audit(check_timestamp DESC);
CREATE INDEX idx_reconciliation_status ON reconciliation_audit(status) WHERE status != 'passed';

COMMENT ON TABLE reconciliation_audit IS
  'Automated ledger integrity checks - alerts on discrepancies';

-- ============================================================================
-- PART 5: Gift Transaction Tracking Improvements
-- ============================================================================

-- Ensure token_gifts table has proper tracking
ALTER TABLE token_gifts
  ADD COLUMN IF NOT EXISTS ref_id UUID DEFAULT gen_random_uuid();

-- Link gifts to their transaction pairs
CREATE INDEX IF NOT EXISTS idx_token_gifts_ref_id ON token_gifts(ref_id);

-- ============================================================================
-- PART 6: Utility Functions for Reconciliation
-- ============================================================================

-- Function: Get total tokens in circulation (should equal sum of user balances)
CREATE OR REPLACE FUNCTION get_total_tokens_in_circulation()
RETURNS BIGINT AS $$
  SELECT COALESCE(SUM(token_balance), 0)::BIGINT
  FROM users;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION get_total_tokens_in_circulation() IS
  'Returns sum of all user token balances - should match ledger net purchases';

-- Function: Get total purchased from ledger
CREATE OR REPLACE FUNCTION get_total_purchased_from_ledger()
RETURNS BIGINT AS $$
  SELECT COALESCE(SUM(tokens), 0)::BIGINT
  FROM token_transactions
  WHERE type IN ('purchase', 'quick_purchase', 'smart_refill', 'gift_card_redeemed')
    AND status = 'completed';
$$ LANGUAGE SQL STABLE;

-- Function: Get total burned/spent (should be negative)
CREATE OR REPLACE FUNCTION get_total_burned_from_ledger()
RETURNS BIGINT AS $$
  SELECT COALESCE(SUM(tokens), 0)::BIGINT
  FROM token_transactions
  WHERE type IN ('payout', 'chargeback', 'burn', 'admin_adjust')
    AND status = 'completed'
    AND tokens < 0;
$$ LANGUAGE SQL STABLE;

-- Function: Check if ledger balances
CREATE OR REPLACE FUNCTION check_ledger_balance()
RETURNS TABLE(
  is_balanced BOOLEAN,
  total_purchased BIGINT,
  total_burned BIGINT,
  total_in_circulation BIGINT,
  expected_circulation BIGINT,
  discrepancy BIGINT
) AS $$
  SELECT
    (purchased + burned) = circulation AS is_balanced,
    purchased,
    burned,
    circulation,
    (purchased + burned) AS expected_circulation,
    circulation - (purchased + burned) AS discrepancy
  FROM (
    SELECT
      get_total_purchased_from_ledger() AS purchased,
      get_total_burned_from_ledger() AS burned,
      get_total_tokens_in_circulation() AS circulation
  ) subq;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION check_ledger_balance() IS
  'Verifies: Purchased + Burned = Current Circulation. Returns discrepancy if unbalanced.';

-- ============================================================================
-- PART 7: Trigger for Balance Snapshot (Future Enhancement)
-- ============================================================================

-- Note: This trigger is disabled by default (commented out)
-- Enable it once all application code is updated to use atomic operations

/*
CREATE OR REPLACE FUNCTION record_balance_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  current_balance BIGINT;
BEGIN
  -- Get current balance with row lock
  SELECT token_balance INTO current_balance
  FROM users
  WHERE supabase_id = NEW.user_id
  FOR UPDATE;

  -- Record balance before transaction
  NEW.balance_before := current_balance;
  NEW.balance_after := current_balance + NEW.tokens;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-populate balance_before/after
-- CREATE TRIGGER set_balance_snapshots
--   BEFORE INSERT ON token_transactions
--   FOR EACH ROW
--   WHEN (NEW.balance_before IS NULL OR NEW.balance_after IS NULL)
--   EXECUTE FUNCTION record_balance_snapshot();
*/

-- ============================================================================
-- PART 8: Add Constraints to Prevent Negative Balances
-- ============================================================================

-- Ensure users table has proper balance constraints
ALTER TABLE users
  ADD CONSTRAINT chk_token_balance_non_negative CHECK (token_balance >= 0);

-- Ensure token_balances table (if used separately) has constraints
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'token_balances') THEN
    ALTER TABLE token_balances
      ADD CONSTRAINT chk_balance_non_negative CHECK (balance >= 0);
  END IF;
END $$;

-- ============================================================================
-- PART 9: Create View for Transaction Pairs (Debugging)
-- ============================================================================

CREATE OR REPLACE VIEW transaction_pairs AS
SELECT
  t1.ref_id,
  t1.created_at,

  -- Debit side
  t1.user_id AS debit_user,
  t1.type AS debit_type,
  t1.tokens AS debit_amount,

  -- Credit side
  t2.user_id AS credit_user,
  t2.type AS credit_type,
  t2.tokens AS credit_amount,

  -- Validation
  (t1.tokens + t2.tokens) AS net_sum,
  CASE
    WHEN (t1.tokens + t2.tokens) = 0 THEN 'balanced'
    ELSE 'UNBALANCED'
  END AS status
FROM token_transactions t1
LEFT JOIN token_transactions t2
  ON t1.ref_id = t2.ref_id
  AND t1.user_id != t2.user_id
WHERE t1.ref_id IS NOT NULL
  AND t1.type IN ('tip', 'call', 'gift_sent', 'gift_received')
ORDER BY t1.created_at DESC;

COMMENT ON VIEW transaction_pairs IS
  'Shows paired debit/credit transactions. net_sum should always be 0 for balanced pairs.';

-- ============================================================================
-- PART 10: Migration Validation Query
-- ============================================================================

-- Run this after migration to verify integrity
DO $$
DECLARE
  balance_check RECORD;
BEGIN
  SELECT * INTO balance_check FROM check_ledger_balance();

  RAISE NOTICE '=== Ledger Balance Check ===';
  RAISE NOTICE 'Total Purchased: % tokens', balance_check.total_purchased;
  RAISE NOTICE 'Total Burned: % tokens', balance_check.total_burned;
  RAISE NOTICE 'Total in Circulation: % tokens', balance_check.total_in_circulation;
  RAISE NOTICE 'Expected Circulation: % tokens', balance_check.expected_circulation;
  RAISE NOTICE 'Discrepancy: % tokens', balance_check.discrepancy;
  RAISE NOTICE 'Is Balanced: %', balance_check.is_balanced;

  IF NOT balance_check.is_balanced THEN
    RAISE WARNING 'LEDGER DISCREPANCY DETECTED: % tokens difference', balance_check.discrepancy;
  END IF;
END $$;

-- ============================================================================
-- PART 11: Create Admin Utility Functions
-- ============================================================================

-- Function to find duplicate Stripe events
CREATE OR REPLACE FUNCTION find_duplicate_stripe_events()
RETURNS TABLE(
  provider_event_id TEXT,
  occurrence_count BIGINT,
  user_ids TEXT[]
) AS $$
  SELECT
    provider_event_id,
    COUNT(*) AS occurrence_count,
    ARRAY_AGG(DISTINCT user_id::TEXT) AS user_ids
  FROM token_transactions
  WHERE provider_event_id IS NOT NULL
  GROUP BY provider_event_id
  HAVING COUNT(*) > 1
  ORDER BY occurrence_count DESC;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION find_duplicate_stripe_events() IS
  'Identifies duplicate webhook processing - should return 0 rows after migration';

-- Function to find unbalanced transaction pairs
CREATE OR REPLACE FUNCTION find_unbalanced_pairs()
RETURNS TABLE(
  ref_id UUID,
  total_sum BIGINT,
  transaction_count BIGINT,
  user_ids TEXT[]
) AS $$
  SELECT
    ref_id,
    SUM(tokens) AS total_sum,
    COUNT(*) AS transaction_count,
    ARRAY_AGG(DISTINCT user_id::TEXT) AS user_ids
  FROM token_transactions
  WHERE ref_id IS NOT NULL
  GROUP BY ref_id
  HAVING SUM(tokens) != 0
  ORDER BY ABS(SUM(tokens)) DESC;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION find_unbalanced_pairs() IS
  'Finds transaction pairs where debit + credit != 0 (should be empty)';

-- ============================================================================
-- PART 12: Documentation and Next Steps
-- ============================================================================

COMMENT ON TABLE token_transactions IS
  'Append-only ledger of all token movements. ' ||
  'CRITICAL: Never UPDATE or DELETE rows except via admin_adjust transactions. ' ||
  'Each transaction should have balance_before/after populated for audit trails. ' ||
  'Paired transactions (tips, gifts) share the same ref_id and must sum to 0.';

-- Migration complete notice
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 144 Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '1. Update application code to use SELECT FOR UPDATE';
  RAISE NOTICE '2. Populate balance_before/after in new transactions';
  RAISE NOTICE '3. Set up reconciliation cron job (backend/jobs/reconciliation.js)';
  RAISE NOTICE '4. Update webhook handlers to check provider_event_id uniqueness';
  RAISE NOTICE '5. Monitor reconciliation_audit table for discrepancies';
  RAISE NOTICE '';
  RAISE NOTICE 'Verification Queries:';
  RAISE NOTICE '  SELECT * FROM check_ledger_balance();';
  RAISE NOTICE '  SELECT * FROM find_duplicate_stripe_events();';
  RAISE NOTICE '  SELECT * FROM find_unbalanced_pairs();';
  RAISE NOTICE '';
END $$;
