-- Migration: Add server-authoritative minute billing fields
-- Created: 2025-01-19
-- Purpose: Enable real-time per-minute billing with no negative balances

-- Add status column (billing system uses 'status', base table has 'state')
-- Status tracks billing lifecycle: pending -> active -> ended
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'ended'));

-- Add started_at column (when call billing actually starts - when accepted/connected)
-- This is different from initiated_at (when call was first requested)
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- Add billing fields to calls table
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS rate_tokens_per_min INTEGER,
ADD COLUMN IF NOT EXISTS last_billed_minute INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS billing_group_id UUID DEFAULT gen_random_uuid();

-- Add index for active calls billing query
CREATE INDEX IF NOT EXISTS idx_calls_active_billing
ON calls(status, last_heartbeat_at)
WHERE status = 'active';

-- Add index for billing cron job
CREATE INDEX IF NOT EXISTS idx_calls_billing_due
ON calls(started_at, last_billed_minute, status)
WHERE status = 'active';

-- Add group_id to token_transactions for auditing related transactions
ALTER TABLE token_transactions
ADD COLUMN IF NOT EXISTS group_id UUID;

-- Add index for transaction groups
CREATE INDEX IF NOT EXISTS idx_token_transactions_group
ON token_transactions(group_id)
WHERE group_id IS NOT NULL;

-- Update existing active calls to have heartbeat timestamp
UPDATE calls
SET last_heartbeat_at = NOW()
WHERE status = 'active' AND last_heartbeat_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN calls.status IS 'Billing lifecycle status: pending (not started), active (billing in progress), ended (billing complete)';
COMMENT ON COLUMN calls.started_at IS 'When call billing started (when call was accepted/connected)';
COMMENT ON COLUMN calls.rate_tokens_per_min IS 'Tokens charged per minute (calculated at call start from creator price_per_min)';
COMMENT ON COLUMN calls.last_billed_minute IS 'Last minute successfully billed (0-based, 0 = no minutes billed yet)';
COMMENT ON COLUMN calls.last_heartbeat_at IS 'Last heartbeat received from client (used for disconnect detection)';
COMMENT ON COLUMN calls.billing_group_id IS 'Groups all billing transactions for this call together';

-- Migration complete
SELECT 'Migration 148: Server-authoritative billing fields added successfully' AS status;
