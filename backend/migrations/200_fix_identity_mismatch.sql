-- Migration: Fix identity mismatch between schema and middleware
-- Date: 2025-09-18
-- Critical fix for authentication to work properly

-- 1) Add supabase_id column to users table (this is what middleware expects)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS supabase_id UUID UNIQUE;

-- 2) Add role column for proper authorization
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role TEXT
  CHECK (role IN ('fan', 'creator', 'admin')) DEFAULT 'fan';

-- 3) Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON users(supabase_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role) WHERE role IN ('creator', 'admin');

-- 4) Update role based on existing is_creator flag
UPDATE users
SET role = CASE
  WHEN is_creator = true THEN 'creator'
  WHEN is_super_admin = true THEN 'admin'
  ELSE 'fan'
END
WHERE role IS NULL;

-- 5) Create proper ENUMs for type safety
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('fan', 'creator', 'admin');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_status') THEN
    CREATE TYPE session_status AS ENUM ('active', 'ended', 'cancelled', 'pending');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
  END IF;
END$$;

-- 6) Add money columns in cents (alongside existing decimal columns for safe migration)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS video_rate_cents INTEGER,
  ADD COLUMN IF NOT EXISTS voice_rate_cents INTEGER,
  ADD COLUMN IF NOT EXISTS stream_rate_cents INTEGER,
  ADD COLUMN IF NOT EXISTS message_price_cents INTEGER;

-- Backfill cents columns from existing decimal values
UPDATE users
SET
  video_rate_cents = ROUND(COALESCE(video_price, creator_rate, 100) * 100)::INTEGER,
  voice_rate_cents = ROUND(COALESCE(voice_price, voice_rate, 50) * 100)::INTEGER,
  stream_rate_cents = ROUND(COALESCE(stream_price, stream_rate, 25) * 100)::INTEGER,
  message_price_cents = ROUND(COALESCE(message_price, 10) * 100)::INTEGER
WHERE video_rate_cents IS NULL;

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS rate_per_minute_cents INTEGER,
  ADD COLUMN IF NOT EXISTS total_cost_cents INTEGER;

UPDATE sessions
SET
  rate_per_minute_cents = ROUND(COALESCE(rate_per_minute, 0) * 100)::INTEGER,
  total_cost_cents = ROUND(COALESCE(total_cost, 0) * 100)::INTEGER
WHERE rate_per_minute_cents IS NULL;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS amount_cents INTEGER;

UPDATE payments
SET amount_cents = ROUND(amount::NUMERIC * 100)::INTEGER
WHERE amount_cents IS NULL;

-- 7) Add request tracking columns for observability
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS request_id TEXT;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS request_id TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

-- 8) Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_sessions_request_id ON sessions(request_id);
CREATE INDEX IF NOT EXISTS idx_payments_request_id ON payments(request_id);
CREATE INDEX IF NOT EXISTS idx_payments_idempotency ON payments(idempotency_key);

-- 9) Add composite indexes for frequent queries
CREATE INDEX IF NOT EXISTS idx_users_supabase_creator ON users(supabase_id) WHERE role = 'creator';
CREATE INDEX IF NOT EXISTS idx_sessions_creator_fan_time ON sessions(creator_id, fan_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_user_status ON payments(user_id, status);

COMMENT ON COLUMN users.supabase_id IS 'Primary external identifier from Supabase Auth';
COMMENT ON COLUMN users.role IS 'User role: fan, creator, or admin';
COMMENT ON COLUMN payments.idempotency_key IS 'Stripe idempotency key to prevent duplicate charges';