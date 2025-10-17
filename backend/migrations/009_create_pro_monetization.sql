-- =============================================
-- Pro Monetization Schema
-- Adds: streams, stream_tickets, calls, billing_events
-- =============================================

-- Streams table (public/private broadcasts)
CREATE TABLE IF NOT EXISTS streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('public','private')),
  channel TEXT NOT NULL UNIQUE,
  title TEXT,
  description TEXT,
  category TEXT,
  ticket_price_tokens INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  viewer_count INT DEFAULT 0,
  total_tips INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_streams_creator_id ON streams(creator_id);
CREATE INDEX IF NOT EXISTS idx_streams_status ON streams(status);
CREATE INDEX IF NOT EXISTS idx_streams_type ON streams(type);
CREATE INDEX IF NOT EXISTS idx_streams_channel ON streams(channel);

-- Stream tickets (for private broadcast access)
CREATE TABLE IF NOT EXISTS stream_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  price_tokens INT NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(stream_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_stream_tickets_stream_id ON stream_tickets(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_tickets_user_id ON stream_tickets(user_id);

-- Calls table (1:1 pay-per-minute calls)
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  fan_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  channel TEXT NOT NULL UNIQUE,
  rate_tokens_per_min INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  billed_seconds INT NOT NULL DEFAULT 0,
  total_cost_tokens INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calls_creator_id ON calls(creator_id);
CREATE INDEX IF NOT EXISTS idx_calls_fan_id ON calls(fan_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_channel ON calls(channel);

-- Billing events (audit log for all token movements)
CREATE TABLE IF NOT EXISTS billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('call', 'stream', 'tip', 'ticket', 'purchase')),
  subject_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  delta_tokens INT NOT NULL, -- negative for charges, positive for payouts
  reason TEXT NOT NULL CHECK (reason IN ('ppm', 'ticket', 'tip', 'payout', 'purchase', 'refund')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_user_id ON billing_events(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_subject_type ON billing_events(subject_type);
CREATE INDEX IF NOT EXISTS idx_billing_events_subject_id ON billing_events(subject_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_created_at ON billing_events(created_at);

-- Tips table (separate from billing_events for easier querying)
CREATE TABLE IF NOT EXISTS tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  to_creator_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  amount_tokens INT NOT NULL,
  message TEXT,
  context_type TEXT CHECK (context_type IN ('stream', 'call')),
  context_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tips_from_user_id ON tips(from_user_id);
CREATE INDEX IF NOT EXISTS idx_tips_to_creator_id ON tips(to_creator_id);
CREATE INDEX IF NOT EXISTS idx_tips_context_type ON tips(context_type);
CREATE INDEX IF NOT EXISTS idx_tips_context_id ON tips(context_id);
CREATE INDEX IF NOT EXISTS idx_tips_created_at ON tips(created_at);

-- Add wallet/balance tracking if not exists (adapt if you already have this)
CREATE TABLE IF NOT EXISTS wallets (
  user_id UUID PRIMARY KEY REFERENCES users(supabase_id) ON DELETE CASCADE,
  balance INT NOT NULL DEFAULT 0,
  lifetime_earned INT NOT NULL DEFAULT 0,
  lifetime_spent INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Initialize wallets for existing users
INSERT INTO wallets (user_id, balance)
SELECT supabase_id, 0
FROM users
WHERE supabase_id NOT IN (SELECT user_id FROM wallets)
ON CONFLICT (user_id) DO NOTHING;

-- Trigger to create wallet for new users
CREATE OR REPLACE FUNCTION create_wallet_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO wallets (user_id, balance)
  VALUES (NEW.supabase_id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_wallet_for_new_user
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_wallet_for_new_user();

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_streams_updated_at
  BEFORE UPDATE ON streams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_calls_updated_at
  BEFORE UPDATE ON calls
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
