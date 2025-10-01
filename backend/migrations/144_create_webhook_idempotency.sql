-- Create table for Stripe webhook idempotency to prevent double processing
CREATE TABLE IF NOT EXISTS processed_webhooks (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(255) NOT NULL UNIQUE, -- Stripe event ID
  event_type VARCHAR(100) NOT NULL, -- Type of webhook event
  webhook_source VARCHAR(50) DEFAULT 'stripe', -- Source system (stripe, agora, etc.)
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processing_status VARCHAR(50) DEFAULT 'success', -- success, failed, skipped
  processing_error TEXT, -- Error details if processing failed
  payload JSONB, -- Store the full event payload for debugging
  metadata JSONB, -- Additional processing metadata

  -- Ensure we never process the same event twice
  CONSTRAINT unique_event_id UNIQUE (event_id, webhook_source)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_processed_webhooks_event_type ON processed_webhooks (event_type);
CREATE INDEX IF NOT EXISTS idx_processed_webhooks_processed_at ON processed_webhooks (processed_at);
CREATE INDEX IF NOT EXISTS idx_processed_webhooks_status ON processed_webhooks (processing_status);
CREATE INDEX IF NOT EXISTS idx_processed_webhooks_source ON processed_webhooks (webhook_source);

-- Create a function to clean up old webhook records (keep 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_webhooks()
RETURNS void AS $$
BEGIN
  DELETE FROM processed_webhooks
  WHERE processed_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Add index for faster cleanup (simple index without WHERE clause to avoid IMMUTABLE requirement)
CREATE INDEX IF NOT EXISTS idx_processed_webhooks_cleanup ON processed_webhooks (processed_at);

-- Optional: Schedule cleanup with pg_cron (uncomment if available)
-- SELECT cron.schedule('cleanup-old-webhooks', '0 4 * * *', 'SELECT cleanup_old_webhooks();');