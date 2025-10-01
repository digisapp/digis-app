-- =====================================================
-- Migration: Convert all money fields to integer cents
-- Phase A: Add new _cents columns (non-blocking)
-- =====================================================

BEGIN;

-- =====================================================
-- 1. TOKEN BALANCES
-- =====================================================
ALTER TABLE token_balances
  ADD COLUMN IF NOT EXISTS balance_cents BIGINT NOT NULL DEFAULT 0,
  ADD CONSTRAINT token_balances_balance_cents_nonneg CHECK (balance_cents >= 0);

COMMENT ON COLUMN token_balances.balance_cents IS 'Token balance in smallest unit (cents equivalent)';

-- =====================================================
-- 2. TOKEN TRANSACTIONS
-- =====================================================
ALTER TABLE token_transactions
  ADD COLUMN IF NOT EXISTS amount_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_after_cents BIGINT,
  ADD CONSTRAINT token_tx_amount_cents_check CHECK (amount_cents >= 0 OR type IN ('deduction', 'refund', 'chargeback'));

COMMENT ON COLUMN token_transactions.amount_cents IS 'Transaction amount in cents';
COMMENT ON COLUMN token_transactions.balance_after_cents IS 'Balance after transaction in cents';

-- =====================================================
-- 3. USERS TABLE (earnings, balances)
-- =====================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS token_balance_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earnings_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_earnings_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_earnings_cents BIGINT NOT NULL DEFAULT 0,
  ADD CONSTRAINT users_token_balance_cents_nonneg CHECK (token_balance_cents >= 0),
  ADD CONSTRAINT users_earnings_cents_nonneg CHECK (total_earnings_cents >= 0 AND pending_earnings_cents >= 0);

-- =====================================================
-- 4. TIPS
-- =====================================================
ALTER TABLE tips
  ADD COLUMN IF NOT EXISTS tip_amount_cents BIGINT NOT NULL DEFAULT 0,
  ADD CONSTRAINT tips_amount_cents_positive CHECK (tip_amount_cents > 0);

-- =====================================================
-- 5. PAYMENTS
-- =====================================================
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS amount_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_cents BIGINT NOT NULL DEFAULT 0,
  ADD CONSTRAINT payments_cents_consistency CHECK (amount_cents = fee_cents + net_cents);

-- =====================================================
-- 6. CREATOR EARNINGS
-- =====================================================
ALTER TABLE creator_earnings
  ADD COLUMN IF NOT EXISTS usd_value_cents BIGINT NOT NULL DEFAULT 0,
  ADD CONSTRAINT creator_earnings_cents_nonneg CHECK (usd_value_cents >= 0);

-- =====================================================
-- 7. CREATOR PAYOUTS
-- =====================================================
ALTER TABLE creator_payouts
  ADD COLUMN IF NOT EXISTS amount_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount_cents BIGINT NOT NULL DEFAULT 0,
  ADD CONSTRAINT creator_payouts_cents_nonneg CHECK (amount_cents >= 0 AND net_amount_cents >= 0);

-- =====================================================
-- 8. SUBSCRIPTION PLANS
-- =====================================================
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS price_cents BIGINT NOT NULL DEFAULT 0,
  ADD CONSTRAINT subscription_plans_price_positive CHECK (price_cents > 0);

-- =====================================================
-- 9. MEMBERSHIP TIERS
-- =====================================================
ALTER TABLE membership_tiers
  ADD COLUMN IF NOT EXISTS price_cents BIGINT NOT NULL DEFAULT 0,
  ADD CONSTRAINT membership_tiers_price_positive CHECK (price_cents >= 0);

-- =====================================================
-- 10. OFFERS
-- =====================================================
ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS price_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_price_cents BIGINT,
  ADD CONSTRAINT offers_price_positive CHECK (price_cents > 0);

-- =====================================================
-- 11. SHOP ITEMS
-- =====================================================
ALTER TABLE shop_items
  ADD COLUMN IF NOT EXISTS price_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_cents BIGINT,
  ADD CONSTRAINT shop_items_price_positive CHECK (price_cents >= 0);

-- =====================================================
-- 12. VIRTUAL GIFTS
-- =====================================================
ALTER TABLE virtual_gifts
  ADD COLUMN IF NOT EXISTS price_cents BIGINT NOT NULL DEFAULT 0,
  ADD CONSTRAINT virtual_gifts_price_positive CHECK (price_cents > 0);

-- =====================================================
-- 13. TICKETED SHOWS
-- =====================================================
ALTER TABLE ticketed_shows
  ADD COLUMN IF NOT EXISTS ticket_price_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vip_price_cents BIGINT,
  ADD CONSTRAINT ticketed_shows_price_positive CHECK (ticket_price_cents >= 0);

-- =====================================================
-- 14. STREAM SESSIONS (call rates)
-- =====================================================
ALTER TABLE streams
  ADD COLUMN IF NOT EXISTS video_rate_cents BIGINT,
  ADD COLUMN IF NOT EXISTS voice_rate_cents BIGINT,
  ADD COLUMN IF NOT EXISTS total_earnings_cents BIGINT NOT NULL DEFAULT 0;

-- =====================================================
-- 15. WITHDRAWALS
-- =====================================================
ALTER TABLE withdrawals
  ADD COLUMN IF NOT EXISTS amount_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount_cents BIGINT NOT NULL DEFAULT 0,
  ADD CONSTRAINT withdrawals_cents_nonneg CHECK (amount_cents > 0 AND net_amount_cents > 0);

-- =====================================================
-- 16. PPV MESSAGES
-- =====================================================
ALTER TABLE ppv_messages
  ADD COLUMN IF NOT EXISTS price_cents BIGINT NOT NULL DEFAULT 0,
  ADD CONSTRAINT ppv_messages_price_positive CHECK (price_cents > 0);

-- =====================================================
-- 17. LIVE SHOPPING PURCHASES
-- =====================================================
ALTER TABLE live_shopping_purchases
  ADD COLUMN IF NOT EXISTS total_price_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount_cents BIGINT,
  ADD CONSTRAINT live_shopping_cents_nonneg CHECK (total_price_cents >= 0);

-- =====================================================
-- 18. VOD PURCHASES
-- =====================================================
ALTER TABLE vod_purchases
  ADD COLUMN IF NOT EXISTS purchase_price_cents BIGINT NOT NULL DEFAULT 0,
  ADD CONSTRAINT vod_purchases_price_positive CHECK (purchase_price_cents > 0);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
-- Create indexes concurrently in separate transactions
-- Run these AFTER the main transaction commits

COMMIT;

-- Run these separately to avoid locking:
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_token_balances_user_cents
  ON token_balances(user_id, balance_cents);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_token_tx_user_created_cents
  ON token_transactions(user_id, created_at DESC, amount_cents);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tips_creator_created_cents
  ON tips(creator_id, created_at DESC, tip_amount_cents);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_earnings_cents
  ON creator_earnings(creator_id, created_at DESC, usd_value_cents);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_user_cents
  ON payments(user_id, created_at DESC, amount_cents);

-- =====================================================
-- Phase B: Backfill Script (run separately)
-- =====================================================
/*
-- Run this in batches to avoid long locks:

-- Batch update function
DO $$
DECLARE
  batch_size INT := 10000;
  updated INT;
BEGIN
  LOOP
    -- Token balances
    UPDATE token_balances
    SET balance_cents = ROUND(COALESCE(balance, 0) * 100)
    WHERE balance_cents = 0
      AND id IN (
        SELECT id FROM token_balances
        WHERE balance_cents = 0
        LIMIT batch_size
      );

    GET DIAGNOSTICS updated = ROW_COUNT;
    IF updated = 0 THEN EXIT; END IF;

    RAISE NOTICE 'Updated % token_balances rows', updated;
    PERFORM pg_sleep(0.1); -- Brief pause between batches
  END LOOP;
END $$;

-- Repeat similar batch updates for other tables...
*/

-- =====================================================
-- Verification Queries
-- =====================================================
/*
-- Run these to verify data integrity:

-- Check for negative balances
SELECT COUNT(*) as negative_balances
FROM token_balances WHERE balance_cents < 0;

-- Check for NULL values
SELECT
  COUNT(*) FILTER (WHERE balance_cents IS NULL) as null_balances,
  COUNT(*) FILTER (WHERE amount_cents IS NULL) as null_amounts
FROM token_balances, token_transactions;

-- Compare old vs new totals
SELECT
  'token_balances' as table_name,
  SUM(balance) as old_total_dollars,
  SUM(balance_cents)/100.0 as new_total_dollars,
  ABS(SUM(balance) - SUM(balance_cents)/100.0) as difference
FROM token_balances;

-- Check payment consistency
SELECT COUNT(*) as inconsistent_payments
FROM payments
WHERE amount_cents != (fee_cents + net_cents);

-- Find suspiciously large values
SELECT MAX(balance_cents) as max_balance_cents,
       MAX(balance_cents)/100.0 as max_balance_dollars
FROM token_balances;
*/