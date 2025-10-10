-- Simple Migration: Essential Payout System Tables
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/lpphsjowsivjtcmafxnj/sql/new

-- 1. Add Stripe Connect fields to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS payout_method VARCHAR(50) DEFAULT 'stripe_connect',
  ADD COLUMN IF NOT EXISTS payout_details JSONB DEFAULT '{}';

-- 2. Create withdrawal_requests table (simple version)
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id SERIAL PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  amount BIGINT NOT NULL CHECK (amount > 0),
  amount_usd DECIMAL(10,2) NOT NULL CHECK (amount_usd > 0),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  stripe_transfer_id VARCHAR(255),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_creator ON withdrawal_requests(creator_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);

-- 3. Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed successfully!';
  RAISE NOTICE 'Tables created: withdrawal_requests';
  RAISE NOTICE 'Columns added to users: stripe_connect_account_id, payout_method, payout_details';
END $$;
