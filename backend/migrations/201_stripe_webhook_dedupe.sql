-- Migration: Stripe Webhook Deduplication
-- Date: 2025-09-18
-- Purpose: Prevent double-processing of Stripe webhooks on retries

-- ============================================
-- CREATE WEBHOOK EVENTS TABLE
-- ============================================

-- Idempotent Stripe webhook receipts
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id BIGSERIAL PRIMARY KEY,
  stripe_event_id TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'received' CHECK (status IN ('received', 'processing', 'completed', 'failed', 'skipped')),
  processing_result TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type ON stripe_webhook_events(type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_received_at ON stripe_webhook_events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status ON stripe_webhook_events(status);

-- Comments
COMMENT ON TABLE stripe_webhook_events IS 'Tracks all Stripe webhook events to prevent duplicate processing';
COMMENT ON COLUMN stripe_webhook_events.stripe_event_id IS 'Unique Stripe event ID for deduplication';
COMMENT ON COLUMN stripe_webhook_events.type IS 'Stripe event type (e.g., payment_intent.succeeded)';
COMMENT ON COLUMN stripe_webhook_events.status IS 'Processing status to track webhook handling';

-- ============================================
-- ADD IDEMPOTENCY TO PAYMENTS TABLE
-- ============================================

-- Add idempotency support to payments table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'payments' AND column_name = 'request_id') THEN
    ALTER TABLE payments ADD COLUMN request_id TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'payments' AND column_name = 'idempotency_key') THEN
    ALTER TABLE payments ADD COLUMN idempotency_key TEXT;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_payments_request_id ON payments(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_idempotency_key ON payments(idempotency_key) WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN payments.request_id IS 'Request ID for tracking payment operations';
COMMENT ON COLUMN payments.idempotency_key IS 'Idempotency key for Stripe API calls';

-- ============================================
-- CLEANUP FUNCTION
-- ============================================

-- Function to clean up old webhook events (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM stripe_webhook_events
  WHERE received_at < NOW() - INTERVAL '30 days'
    AND status = 'completed'
    AND type NOT IN ('payment_intent.succeeded', 'payment_intent.failed', 'charge.dispute.created');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_webhook_events() IS 'Removes webhook events older than 30 days (keeps important payment events)';

-- ============================================
-- VERIFICATION
-- ============================================

DO $$
BEGIN
  -- Verify table creation
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_name = 'stripe_webhook_events') THEN
    RAISE WARNING 'stripe_webhook_events table was not created';
  ELSE
    RAISE NOTICE 'stripe_webhook_events table created successfully';
  END IF;

  -- Verify columns added to payments
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'payments' AND column_name = 'idempotency_key') THEN
    RAISE WARNING 'idempotency_key column was not added to payments table';
  ELSE
    RAISE NOTICE 'idempotency columns added to payments table successfully';
  END IF;
END$$;