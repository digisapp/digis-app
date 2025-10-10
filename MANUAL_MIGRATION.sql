-- ========================================
-- MANUAL MIGRATION - Run in Supabase SQL Editor
-- Go to: https://supabase.com/dashboard/project/lpphsjowsivjtcmafxnj/sql/new
-- ========================================

-- Migration 146: Withdrawal Requests System

-- Create withdrawal_requests table
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id SERIAL PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  amount BIGINT NOT NULL CHECK (amount > 0),
  amount_usd DECIMAL(10,2) NOT NULL CHECK (amount_usd > 0),
  payout_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
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

-- Add Stripe Connect fields to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS payout_method VARCHAR(50) DEFAULT 'stripe_connect',
  ADD COLUMN IF NOT EXISTS payout_details JSONB DEFAULT '{}';

-- Create view
CREATE OR REPLACE VIEW creator_payout_history AS
SELECT wr.id, wr.creator_id, u.email, u.username, wr.amount AS tokens, wr.amount_usd AS usd,
       wr.payout_date, wr.status, wr.created_at AS requested_at, wr.processed_at,
       wr.stripe_transfer_id, wr.error_message
FROM withdrawal_requests wr
JOIN users u ON wr.creator_id = u.supabase_id
ORDER BY wr.created_at DESC;

-- Create functions
CREATE OR REPLACE FUNCTION get_creator_earnings_summary(p_creator_id UUID)
RETURNS TABLE(total_earned BIGINT, total_paid_out BIGINT, available_balance BIGINT,
              buffered_earnings BIGINT, pending_withdrawals BIGINT, last_payout_date DATE, next_payout_date DATE)
AS $$ DECLARE v_chargeback_buffer_date TIMESTAMPTZ := NOW() - INTERVAL '7 days';
BEGIN RETURN QUERY WITH earnings AS (
  SELECT COALESCE(SUM(tokens), 0) AS total_earned,
         COALESCE(SUM(tokens) FILTER (WHERE created_at < v_chargeback_buffer_date), 0) AS safe_earnings,
         COALESCE(SUM(tokens) FILTER (WHERE created_at >= v_chargeback_buffer_date), 0) AS buffered
  FROM token_transactions WHERE user_id = p_creator_id AND tokens > 0
    AND type IN ('tip', 'call', 'gift_received', 'stream_tip') AND status = 'completed'
), payouts AS (
  SELECT COALESCE(SUM(ABS(tokens)), 0) AS total_paid FROM token_transactions
  WHERE user_id = p_creator_id AND type = 'payout' AND status = 'completed'
), chargebacks AS (
  SELECT COALESCE(SUM(ABS(tokens)), 0) AS total_chargebacks FROM token_transactions
  WHERE user_id = p_creator_id AND type = 'chargeback' AND status = 'completed'
), pending AS (
  SELECT COALESCE(SUM(amount), 0) AS total_pending FROM withdrawal_requests
  WHERE creator_id = p_creator_id AND status = 'pending'
), last_payout AS (
  SELECT MAX(payout_date) AS last_date FROM withdrawal_requests
  WHERE creator_id = p_creator_id AND status = 'completed'
) SELECT e.total_earned, p.total_paid,
    GREATEST(0, e.safe_earnings - p.total_paid - c.total_chargebacks - pend.total_pending) AS available_balance,
    e.buffered, pend.total_pending, lp.last_date,
    CASE WHEN EXTRACT(DAY FROM NOW()) < 1 THEN DATE_TRUNC('month', NOW())::DATE
         WHEN EXTRACT(DAY FROM NOW()) < 15 THEN DATE_TRUNC('month', NOW())::DATE + INTERVAL '14 days'
         ELSE DATE_TRUNC('month', NOW() + INTERVAL '1 month')::DATE
    END::DATE AS next_payout_date
FROM earnings e, payouts p, chargebacks c, pending pend, last_payout lp;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_pending_payouts_for_date(p_payout_date DATE)
RETURNS TABLE(request_id INTEGER, creator_email TEXT, creator_username TEXT,
              amount BIGINT, amount_usd DECIMAL, requested_at TIMESTAMPTZ, stripe_connect_id TEXT)
AS $$ BEGIN RETURN QUERY
  SELECT wr.id, u.email, u.username, wr.amount, wr.amount_usd, wr.created_at, u.stripe_connect_account_id
  FROM withdrawal_requests wr JOIN users u ON wr.creator_id = u.supabase_id
  WHERE wr.status = 'pending' AND wr.payout_date = p_payout_date ORDER BY wr.created_at ASC;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_withdrawal_requests_timestamp()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER update_withdrawal_requests_timestamp
  BEFORE UPDATE ON withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION update_withdrawal_requests_timestamp();
