-- ========================================
-- PRODUCTION-READY MANUAL MIGRATION - Run in Supabase SQL Editor
-- Go to: https://supabase.com/dashboard/project/lpphsjowsivjtcmafxnj/sql/new
-- ========================================
--
-- Migration 147: Production-Ready Withdrawal System with Queue-Based Processing
--
-- Architecture:
-- - Vercel Cron triggers batch creation
-- - Inngest queue handles actual payout processing
-- - Idempotent operations with strict consistency checks
-- - Supports chunking, retries, and reconciliation
--
-- ========================================

-- ========================================
-- PART 1: PAYOUT BATCH MANAGEMENT
-- ========================================

-- Payout batches (one per scheduled run)
CREATE TABLE IF NOT EXISTS payout_batches (
  id SERIAL PRIMARY KEY,
  batch_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 of cutoff_at + schedule_type for idempotency
  cutoff_at TIMESTAMPTZ NOT NULL, -- Earnings before this timestamp are eligible
  schedule_type VARCHAR(20) NOT NULL CHECK (schedule_type IN ('bi_monthly', 'manual', 'hourly')),
  status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  successful_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  total_amount_tokens BIGINT DEFAULT 0,
  total_amount_usd DECIMAL(12,2) DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_batches_status ON payout_batches(status);
CREATE INDEX IF NOT EXISTS idx_payout_batches_created ON payout_batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payout_batches_cutoff ON payout_batches(cutoff_at);

-- ========================================
-- PART 2: INDIVIDUAL PAYOUT ITEMS
-- ========================================

-- Individual payout items (one per creator per batch)
CREATE TABLE IF NOT EXISTS payout_items (
  id SERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES payout_batches(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  amount_tokens BIGINT NOT NULL CHECK (amount_tokens > 0),
  amount_usd DECIMAL(10,2) NOT NULL CHECK (amount_usd > 0),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retrying')),
  provider VARCHAR(50) DEFAULT 'stripe_connect', -- stripe_connect, wise, paypal, etc.
  provider_payout_id VARCHAR(255), -- Stripe transfer ID, Wise ID, etc.
  idempotency_key VARCHAR(255) NOT NULL UNIQUE, -- Format: {batch_id}:{creator_id}
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_code VARCHAR(50),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one payout per creator per batch
  CONSTRAINT unique_batch_creator UNIQUE (batch_id, creator_id)
);

CREATE INDEX IF NOT EXISTS idx_payout_items_batch ON payout_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_payout_items_creator ON payout_items(creator_id);
CREATE INDEX IF NOT EXISTS idx_payout_items_status ON payout_items(status);
CREATE INDEX IF NOT EXISTS idx_payout_items_provider_id ON payout_items(provider_payout_id) WHERE provider_payout_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payout_items_created ON payout_items(created_at DESC);

-- ========================================
-- PART 3: WITHDRAWAL REQUESTS (LEGACY/OPTIONAL)
-- ========================================

-- Keep withdrawal_requests for user-initiated withdrawals
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id SERIAL PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  amount BIGINT NOT NULL CHECK (amount > 0),
  amount_usd DECIMAL(10,2) NOT NULL CHECK (amount_usd > 0),
  payout_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  payout_item_id INTEGER REFERENCES payout_items(id), -- Link to actual payout
  stripe_transfer_id VARCHAR(255),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_creator ON withdrawal_requests(creator_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_payout_date ON withdrawal_requests(payout_date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_created ON withdrawal_requests(created_at DESC);

-- ========================================
-- PART 4: LEDGER ENHANCEMENTS
-- ========================================

-- Add new transaction types to token_transactions if needed
-- Note: This assumes you already have a token_transactions table
-- Add these types: 'withdrawal_pending', 'withdrawal_completed', 'withdrawal_failed'

-- If you need to update the check constraint:
-- ALTER TABLE token_transactions DROP CONSTRAINT IF EXISTS token_transactions_type_check;
-- ALTER TABLE token_transactions ADD CONSTRAINT token_transactions_type_check
--   CHECK (type IN ('purchase', 'tip', 'call', 'gift_received', 'stream_tip', 'payout',
--                   'chargeback', 'withdrawal_pending', 'withdrawal_completed', 'withdrawal_failed'));

-- ========================================
-- PART 5: USER TABLE ENHANCEMENTS
-- ========================================

-- Add Stripe Connect fields to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS payout_method VARCHAR(50) DEFAULT 'stripe_connect',
  ADD COLUMN IF NOT EXISTS payout_details JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS kyc_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS min_payout_threshold BIGINT DEFAULT 1000; -- Minimum 1000 tokens ($50)

-- ========================================
-- PART 6: VIEWS
-- ========================================

-- Creator payout history (combines batches and items)
CREATE OR REPLACE VIEW creator_payout_history AS
SELECT
  pi.id,
  pi.batch_id,
  pb.batch_hash,
  pi.creator_id,
  u.email,
  u.username,
  pi.amount_tokens AS tokens,
  pi.amount_usd AS usd,
  pb.cutoff_at AS payout_cutoff,
  pi.status,
  pi.provider,
  pi.provider_payout_id,
  pi.created_at AS requested_at,
  pi.completed_at AS processed_at,
  pi.error_code,
  pi.error_message,
  pb.schedule_type,
  pb.status AS batch_status
FROM payout_items pi
JOIN payout_batches pb ON pi.batch_id = pb.id
JOIN users u ON pi.creator_id = u.supabase_id
ORDER BY pi.created_at DESC;

-- Batch summary view
CREATE OR REPLACE VIEW payout_batch_summary AS
SELECT
  pb.id,
  pb.batch_hash,
  pb.cutoff_at,
  pb.schedule_type,
  pb.status,
  pb.total_items,
  pb.processed_items,
  pb.successful_items,
  pb.failed_items,
  pb.total_amount_tokens,
  pb.total_amount_usd,
  pb.created_at,
  pb.completed_at,
  ROUND(
    CASE
      WHEN pb.total_items > 0 THEN (pb.successful_items::DECIMAL / pb.total_items) * 100
      ELSE 0
    END, 2
  ) AS success_rate_percent,
  pb.completed_at - pb.started_at AS processing_duration
FROM payout_batches pb
ORDER BY pb.created_at DESC;

-- ========================================
-- PART 7: FUNCTIONS
-- ========================================

-- Get creator earnings summary (enhanced with holds and KYC checks)
CREATE OR REPLACE FUNCTION get_creator_earnings_summary(p_creator_id UUID)
RETURNS TABLE(
  total_earned BIGINT,
  total_paid_out BIGINT,
  available_balance BIGINT,
  buffered_earnings BIGINT,
  pending_withdrawals BIGINT,
  last_payout_date TIMESTAMPTZ,
  next_payout_date DATE,
  kyc_verified BOOLEAN,
  min_threshold BIGINT,
  can_withdraw BOOLEAN
)
AS $$
DECLARE
  v_chargeback_buffer_date TIMESTAMPTZ := NOW() - INTERVAL '7 days'; -- 7-day hold
  v_user_kyc BOOLEAN;
  v_user_threshold BIGINT;
BEGIN
  -- Get user KYC status and threshold
  SELECT kyc_verified, min_payout_threshold INTO v_user_kyc, v_user_threshold
  FROM users WHERE supabase_id = p_creator_id;

  RETURN QUERY
  WITH earnings AS (
    SELECT
      COALESCE(SUM(tokens), 0) AS total_earned,
      COALESCE(SUM(tokens) FILTER (WHERE created_at < v_chargeback_buffer_date), 0) AS safe_earnings,
      COALESCE(SUM(tokens) FILTER (WHERE created_at >= v_chargeback_buffer_date), 0) AS buffered
    FROM token_transactions
    WHERE user_id = p_creator_id
      AND tokens > 0
      AND type IN ('tip', 'call', 'gift_received', 'stream_tip')
      AND status = 'completed'
  ),
  payouts AS (
    SELECT COALESCE(SUM(amount_tokens), 0) AS total_paid
    FROM payout_items
    WHERE creator_id = p_creator_id AND status = 'completed'
  ),
  chargebacks AS (
    SELECT COALESCE(SUM(ABS(tokens)), 0) AS total_chargebacks
    FROM token_transactions
    WHERE user_id = p_creator_id AND type = 'chargeback' AND status = 'completed'
  ),
  pending AS (
    SELECT COALESCE(SUM(amount_tokens), 0) AS total_pending
    FROM payout_items
    WHERE creator_id = p_creator_id AND status IN ('pending', 'processing', 'retrying')
  ),
  last_payout AS (
    SELECT MAX(completed_at) AS last_date
    FROM payout_items
    WHERE creator_id = p_creator_id AND status = 'completed'
  )
  SELECT
    e.total_earned,
    p.total_paid,
    GREATEST(0, e.safe_earnings - p.total_paid - c.total_chargebacks - pend.total_pending) AS available_balance,
    e.buffered,
    pend.total_pending,
    lp.last_date,
    CASE
      WHEN EXTRACT(DAY FROM NOW()) < 1 THEN DATE_TRUNC('month', NOW())::DATE
      WHEN EXTRACT(DAY FROM NOW()) < 15 THEN DATE_TRUNC('month', NOW())::DATE + INTERVAL '14 days'
      ELSE DATE_TRUNC('month', NOW() + INTERVAL '1 month')::DATE
    END::DATE AS next_payout_date,
    v_user_kyc AS kyc_verified,
    v_user_threshold AS min_threshold,
    (
      v_user_kyc = TRUE AND
      (e.safe_earnings - p.total_paid - c.total_chargebacks - pend.total_pending) >= v_user_threshold
    ) AS can_withdraw
  FROM earnings e, payouts p, chargebacks c, pending pend, last_payout lp;
END;
$$ LANGUAGE plpgsql;

-- Get eligible creators for payout (respects holds, KYC, and thresholds)
CREATE OR REPLACE FUNCTION get_eligible_creators_for_payout(
  p_cutoff_at TIMESTAMPTZ,
  p_min_threshold BIGINT DEFAULT 1000
)
RETURNS TABLE(
  creator_id UUID,
  email TEXT,
  username TEXT,
  available_balance BIGINT,
  stripe_connect_id TEXT
)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.supabase_id,
    u.email,
    u.username,
    summary.available_balance,
    u.stripe_connect_account_id
  FROM users u
  CROSS JOIN LATERAL get_creator_earnings_summary(u.supabase_id) AS summary
  WHERE u.is_creator = TRUE
    AND u.kyc_verified = TRUE
    AND u.stripe_connect_account_id IS NOT NULL
    AND summary.available_balance >= COALESCE(u.min_payout_threshold, p_min_threshold)
    AND summary.can_withdraw = TRUE
  ORDER BY summary.available_balance DESC;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- PART 8: TRIGGERS
-- ========================================

-- Update payout_batches timestamp
CREATE OR REPLACE FUNCTION update_payout_batches_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payout_batches_timestamp
  BEFORE UPDATE ON payout_batches
  FOR EACH ROW EXECUTE FUNCTION update_payout_batches_timestamp();

-- Update payout_items timestamp
CREATE OR REPLACE FUNCTION update_payout_items_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payout_items_timestamp
  BEFORE UPDATE ON payout_items
  FOR EACH ROW EXECUTE FUNCTION update_payout_items_timestamp();

-- Update withdrawal_requests timestamp
CREATE OR REPLACE FUNCTION update_withdrawal_requests_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_withdrawal_requests_timestamp
  BEFORE UPDATE ON withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION update_withdrawal_requests_timestamp();

-- Auto-update payout_batches stats when items change
CREATE OR REPLACE FUNCTION update_batch_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update batch statistics
  UPDATE payout_batches
  SET
    processed_items = (
      SELECT COUNT(*) FROM payout_items
      WHERE batch_id = COALESCE(NEW.batch_id, OLD.batch_id)
        AND status IN ('completed', 'failed')
    ),
    successful_items = (
      SELECT COUNT(*) FROM payout_items
      WHERE batch_id = COALESCE(NEW.batch_id, OLD.batch_id)
        AND status = 'completed'
    ),
    failed_items = (
      SELECT COUNT(*) FROM payout_items
      WHERE batch_id = COALESCE(NEW.batch_id, OLD.batch_id)
        AND status = 'failed'
    ),
    total_amount_tokens = (
      SELECT COALESCE(SUM(amount_tokens), 0) FROM payout_items
      WHERE batch_id = COALESCE(NEW.batch_id, OLD.batch_id)
    ),
    total_amount_usd = (
      SELECT COALESCE(SUM(amount_usd), 0) FROM payout_items
      WHERE batch_id = COALESCE(NEW.batch_id, OLD.batch_id)
    )
  WHERE id = COALESCE(NEW.batch_id, OLD.batch_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_batch_stats_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payout_items
  FOR EACH ROW EXECUTE FUNCTION update_batch_stats();

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

-- Verify installation
DO $$
BEGIN
  RAISE NOTICE '✅ Production-ready payout system migration completed successfully!';
  RAISE NOTICE '📊 Tables created: payout_batches, payout_items, withdrawal_requests';
  RAISE NOTICE '🔍 Views created: creator_payout_history, payout_batch_summary';
  RAISE NOTICE '⚙️  Functions created: get_creator_earnings_summary, get_eligible_creators_for_payout';
  RAISE NOTICE '🔔 Triggers: Auto-update timestamps and batch statistics';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Next steps:';
  RAISE NOTICE '   1. Deploy Inngest worker functions';
  RAISE NOTICE '   2. Configure Vercel Cron to trigger batches';
  RAISE NOTICE '   3. Set up KYC verification for creators';
  RAISE NOTICE '   4. Test with manual batch creation';
END $$;
