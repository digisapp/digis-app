-- Migration Phase 2: Drop DECIMAL columns and enforce cents
-- Date: 2025-09-18
-- WARNING: Only run this AFTER the application is fully using *_cents columns
-- This is a destructive migration that removes the old decimal columns

-- ============================================
-- SAFETY CHECKS
-- ============================================

-- Ensure cents columns exist before dropping decimals
DO $$
BEGIN
  -- Check users table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='users' AND column_name='video_rate_cents') THEN
    RAISE EXCEPTION 'video_rate_cents missing on users - run migration 200 first';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='users' AND column_name='voice_rate_cents') THEN
    RAISE EXCEPTION 'voice_rate_cents missing on users - run migration 200 first';
  END IF;

  -- Check sessions table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='sessions' AND column_name='rate_per_minute_cents') THEN
    RAISE EXCEPTION 'rate_per_minute_cents missing on sessions - run migration 200 first';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='sessions' AND column_name='total_cost_cents') THEN
    RAISE EXCEPTION 'total_cost_cents missing on sessions - run migration 200 first';
  END IF;

  -- Check payments table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='payments' AND column_name='amount_cents') THEN
    RAISE EXCEPTION 'amount_cents missing on payments - run migration 200 first';
  END IF;
END$$;

-- ============================================
-- 1. ENFORCE NOT NULL + CONSTRAINTS
-- ============================================

-- Users table: Ensure all cents columns have values
UPDATE users
SET
  video_rate_cents = COALESCE(video_rate_cents, 10000),  -- Default $100
  voice_rate_cents = COALESCE(voice_rate_cents, 5000),   -- Default $50
  stream_rate_cents = COALESCE(stream_rate_cents, 2500), -- Default $25
  message_price_cents = COALESCE(message_price_cents, 1000) -- Default $10
WHERE video_rate_cents IS NULL
   OR voice_rate_cents IS NULL
   OR stream_rate_cents IS NULL
   OR message_price_cents IS NULL;

-- Add NOT NULL constraints
ALTER TABLE users
  ALTER COLUMN video_rate_cents SET NOT NULL,
  ALTER COLUMN voice_rate_cents SET NOT NULL,
  ALTER COLUMN stream_rate_cents SET NOT NULL,
  ALTER COLUMN message_price_cents SET NOT NULL;

-- Add CHECK constraints for non-negative values (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_video_rate_cents_nonneg') THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_video_rate_cents_nonneg CHECK (video_rate_cents >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_voice_rate_cents_nonneg') THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_voice_rate_cents_nonneg CHECK (voice_rate_cents >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_stream_rate_cents_nonneg') THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_stream_rate_cents_nonneg CHECK (stream_rate_cents >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_message_price_cents_nonneg') THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_message_price_cents_nonneg CHECK (message_price_cents >= 0);
  END IF;
END$$;

-- Sessions table: Ensure all cents columns have values
UPDATE sessions
SET
  rate_per_minute_cents = COALESCE(rate_per_minute_cents, 0),
  total_cost_cents = COALESCE(total_cost_cents, 0)
WHERE rate_per_minute_cents IS NULL
   OR total_cost_cents IS NULL;

-- Add NOT NULL constraints
ALTER TABLE sessions
  ALTER COLUMN rate_per_minute_cents SET NOT NULL,
  ALTER COLUMN total_cost_cents SET NOT NULL;

-- Add CHECK constraints (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sessions_rate_cents_nonneg') THEN
    ALTER TABLE sessions ADD CONSTRAINT chk_sessions_rate_cents_nonneg CHECK (rate_per_minute_cents >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sessions_cost_cents_nonneg') THEN
    ALTER TABLE sessions ADD CONSTRAINT chk_sessions_cost_cents_nonneg CHECK (total_cost_cents >= 0);
  END IF;
END$$;

-- Payments table: Ensure amount_cents has values
UPDATE payments
SET amount_cents = COALESCE(amount_cents, 0)
WHERE amount_cents IS NULL;

-- Add NOT NULL constraint
ALTER TABLE payments
  ALTER COLUMN amount_cents SET NOT NULL;

-- Add CHECK constraint (payments must be positive) if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_payments_amount_cents_positive') THEN
    ALTER TABLE payments ADD CONSTRAINT chk_payments_amount_cents_positive CHECK (amount_cents > 0);
  END IF;
END$$;

-- ============================================
-- 2. DROP LEGACY DECIMAL COLUMNS
-- ============================================

-- Drop deprecated columns from users table
ALTER TABLE users
  DROP COLUMN IF EXISTS price_per_min,
  DROP COLUMN IF EXISTS creator_rate,
  DROP COLUMN IF EXISTS voice_rate,
  DROP COLUMN IF EXISTS stream_rate,
  DROP COLUMN IF EXISTS video_price,
  DROP COLUMN IF EXISTS voice_price,
  DROP COLUMN IF EXISTS stream_price,
  DROP COLUMN IF EXISTS message_price;

-- Drop deprecated columns from sessions table
ALTER TABLE sessions
  DROP COLUMN IF EXISTS rate_per_minute,
  DROP COLUMN IF EXISTS rate_per_min,
  DROP COLUMN IF EXISTS total_cost;

-- Drop deprecated columns from payments table
ALTER TABLE payments
  DROP COLUMN IF EXISTS amount_usd,
  DROP COLUMN IF EXISTS tokens_amount,
  DROP COLUMN IF EXISTS amount; -- Only drop if exists

-- ============================================
-- 3. CREATE OPTIMIZED INDEXES
-- ============================================

-- Index for finding users by price ranges (for matching/filtering)
CREATE INDEX IF NOT EXISTS idx_users_creator_prices ON users(video_rate_cents, voice_rate_cents, stream_rate_cents)
  WHERE is_creator = true OR role = 'creator';

-- Index for session cost calculations
CREATE INDEX IF NOT EXISTS idx_sessions_cost_analysis ON sessions(creator_id, total_cost_cents, created_at DESC)
  WHERE status = 'completed';

-- Index for payment analytics
CREATE INDEX IF NOT EXISTS idx_payments_amount_analysis ON payments(amount_cents, status, created_at DESC);

-- Compound index for revenue reporting
CREATE INDEX IF NOT EXISTS idx_payments_revenue ON payments(status, created_at, amount_cents)
  WHERE status = 'completed';

-- ============================================
-- 4. CREATE HELPER VIEWS
-- ============================================

-- View for easy dollar amount display
CREATE OR REPLACE VIEW payment_amounts_view AS
SELECT
  id,
  user_id,
  amount_cents,
  ROUND(amount_cents / 100.0, 2) AS amount_dollars,
  status,
  created_at
FROM payments;

COMMENT ON VIEW payment_amounts_view IS 'Helper view to display payment amounts in dollars';

-- View for session pricing
CREATE OR REPLACE VIEW session_pricing_view AS
SELECT
  id,
  creator_id,
  fan_id,
  rate_per_minute_cents,
  ROUND(rate_per_minute_cents / 100.0, 2) AS rate_per_minute_dollars,
  total_cost_cents,
  ROUND(total_cost_cents / 100.0, 2) AS total_cost_dollars,
  duration_minutes,
  status,
  created_at
FROM sessions;

COMMENT ON VIEW session_pricing_view IS 'Helper view to display session costs in dollars';

-- ============================================
-- 5. UPDATE FUNCTIONS (if any use old columns)
-- ============================================

-- Example: Update any stored procedures that reference old columns
-- This is project-specific and should be reviewed case by case

-- ============================================
-- 6. FINAL VERIFICATION
-- ============================================

-- Verify no NULL values in critical columns
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM users
  WHERE video_rate_cents IS NULL
     OR voice_rate_cents IS NULL
     OR stream_rate_cents IS NULL
     OR message_price_cents IS NULL;

  IF null_count > 0 THEN
    RAISE WARNING 'Found % users with NULL rate values', null_count;
  END IF;

  SELECT COUNT(*) INTO null_count
  FROM payments
  WHERE amount_cents IS NULL;

  IF null_count > 0 THEN
    RAISE WARNING 'Found % payments with NULL amount_cents', null_count;
  END IF;
END$$;

-- Migration completed successfully
-- Note: application_logs table not available, skipping logging

COMMENT ON COLUMN users.video_rate_cents IS 'Video call rate in cents per minute';
COMMENT ON COLUMN users.voice_rate_cents IS 'Voice call rate in cents per minute';
COMMENT ON COLUMN users.stream_rate_cents IS 'Live stream rate in cents per minute';
COMMENT ON COLUMN users.message_price_cents IS 'Message price in cents';
COMMENT ON COLUMN sessions.rate_per_minute_cents IS 'Session rate in cents per minute';
COMMENT ON COLUMN sessions.total_cost_cents IS 'Total session cost in cents';
COMMENT ON COLUMN payments.amount_cents IS 'Payment amount in cents (always positive)';