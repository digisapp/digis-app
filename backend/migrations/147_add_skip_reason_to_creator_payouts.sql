-- Migration: Add skip_reason to creator_payouts
--
-- Adds skip_reason column to track why a payout was skipped
-- (e.g., 'below_threshold', 'no_intent', 'account_inactive')

-- Add skip_reason column
ALTER TABLE creator_payouts
ADD COLUMN IF NOT EXISTS skip_reason TEXT;

-- Create index for filtering by skip reason
CREATE INDEX IF NOT EXISTS idx_creator_payouts_skip_reason
  ON creator_payouts(skip_reason)
  WHERE skip_reason IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN creator_payouts.skip_reason IS
  'Reason why payout was skipped: below_threshold, no_intent, account_inactive, etc.';
