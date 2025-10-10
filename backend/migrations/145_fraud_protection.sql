-- Migration 145: Fraud Protection Infrastructure
-- Creates tables and indexes for fraud detection and prevention

-- Create fraud_alerts table
CREATE TABLE IF NOT EXISTS fraud_alerts (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,
  details JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'false_positive')),
  severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  reviewed_by UUID REFERENCES users(supabase_id),
  reviewed_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate pending alerts of same type for same user
  CONSTRAINT unique_pending_alert UNIQUE (user_id, alert_type) DEFERRABLE INITIALLY DEFERRED
);

-- Create indexes for fraud_alerts
CREATE INDEX idx_fraud_alerts_user ON fraud_alerts(user_id);
CREATE INDEX idx_fraud_alerts_status ON fraud_alerts(status) WHERE status = 'pending';
CREATE INDEX idx_fraud_alerts_type ON fraud_alerts(alert_type);
CREATE INDEX idx_fraud_alerts_created ON fraud_alerts(created_at DESC);
CREATE INDEX idx_fraud_alerts_severity ON fraud_alerts(severity) WHERE severity IN ('high', 'critical');

-- Create user_risk_scores table (for future ML-based scoring)
CREATE TABLE IF NOT EXISTS user_risk_scores (
  user_id UUID PRIMARY KEY REFERENCES users(supabase_id) ON DELETE CASCADE,
  risk_score DECIMAL(5,2) DEFAULT 0.0 CHECK (risk_score >= 0 AND risk_score <= 100),
  last_calculated TIMESTAMPTZ DEFAULT NOW(),
  factors JSONB DEFAULT '{}',
  is_blocked BOOLEAN DEFAULT false,
  block_reason TEXT,
  blocked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_risk_scores_high_risk ON user_risk_scores(risk_score DESC)
  WHERE risk_score > 70;
CREATE INDEX idx_user_risk_scores_blocked ON user_risk_scores(is_blocked)
  WHERE is_blocked = true;

-- Create account_holds table (temporary balance holds for suspicious activity)
CREATE TABLE IF NOT EXISTS account_holds (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(supabase_id) ON DELETE CASCADE,
  hold_type VARCHAR(50) NOT NULL,
  tokens_held BIGINT NOT NULL CHECK (tokens_held > 0),
  reason TEXT,
  expires_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  released_by UUID REFERENCES users(supabase_id),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'released', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_account_holds_user ON account_holds(user_id);
CREATE INDEX idx_account_holds_status ON account_holds(status) WHERE status = 'active';
CREATE INDEX idx_account_holds_expires ON account_holds(expires_at);

-- Function: Calculate user risk score
CREATE OR REPLACE FUNCTION calculate_user_risk_score(p_user_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  v_score DECIMAL := 0;
  v_account_age_hours DECIMAL;
  v_failed_purchases INTEGER;
  v_cashout_ratio DECIMAL;
  v_velocity_violations INTEGER;
BEGIN
  -- Factor 1: Account age (newer = higher risk)
  SELECT EXTRACT(EPOCH FROM (NOW() - created_at))/3600 INTO v_account_age_hours
  FROM users WHERE supabase_id = p_user_id;

  IF v_account_age_hours < 24 THEN
    v_score := v_score + 30;  -- Very new account
  ELSIF v_account_age_hours < 72 THEN
    v_score := v_score + 15;  -- New account
  END IF;

  -- Factor 2: Failed purchases (card testing)
  SELECT COUNT(*) INTO v_failed_purchases
  FROM token_transactions
  WHERE user_id = p_user_id
    AND type IN ('purchase', 'quick_purchase')
    AND status = 'failed'
    AND created_at >= NOW() - INTERVAL '24 hours';

  v_score := v_score + (v_failed_purchases * 10);  -- +10 per failed purchase

  -- Factor 3: Suspicious cashout ratio
  WITH cashout_stats AS (
    SELECT
      SUM(CASE WHEN tokens > 0 THEN tokens ELSE 0 END) AS earned,
      SUM(CASE WHEN type = 'payout' AND tokens < 0 THEN ABS(tokens) ELSE 0 END) AS cashed_out
    FROM token_transactions
    WHERE user_id = p_user_id
      AND created_at >= NOW() - INTERVAL '7 days'
  )
  SELECT
    CASE WHEN earned > 0 THEN (cashed_out::DECIMAL / earned::DECIMAL) ELSE 0 END
  INTO v_cashout_ratio
  FROM cashout_stats;

  IF v_cashout_ratio > 0.9 THEN
    v_score := v_score + 25;  -- High cashout ratio
  ELSIF v_cashout_ratio > 0.7 THEN
    v_score := v_score + 10;
  END IF;

  -- Factor 4: Velocity violations (rapid actions)
  SELECT COUNT(DISTINCT alert_type) INTO v_velocity_violations
  FROM fraud_alerts
  WHERE user_id = p_user_id
    AND alert_type LIKE '%velocity%'
    AND created_at >= NOW() - INTERVAL '7 days';

  v_score := v_score + (v_velocity_violations * 5);

  -- Cap score at 100
  v_score := LEAST(v_score, 100);

  -- Update risk scores table
  INSERT INTO user_risk_scores (user_id, risk_score, last_calculated, factors)
  VALUES (p_user_id, v_score, NOW(), jsonb_build_object(
    'account_age_hours', v_account_age_hours,
    'failed_purchases', v_failed_purchases,
    'cashout_ratio', v_cashout_ratio,
    'velocity_violations', v_velocity_violations
  ))
  ON CONFLICT (user_id)
  DO UPDATE SET
    risk_score = v_score,
    last_calculated = NOW(),
    factors = EXCLUDED.factors,
    updated_at = NOW();

  RETURN v_score;
END;
$$ LANGUAGE plpgsql;

-- Function: Get active fraud alerts summary
CREATE OR REPLACE FUNCTION get_fraud_alerts_summary()
RETURNS TABLE(
  total_pending BIGINT,
  high_severity BIGINT,
  avg_age_hours DECIMAL,
  alert_types JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status = 'pending') AS total_pending,
    COUNT(*) FILTER (WHERE status = 'pending' AND severity IN ('high', 'critical')) AS high_severity,
    AVG(EXTRACT(EPOCH FROM (NOW() - created_at))/3600) FILTER (WHERE status = 'pending') AS avg_age_hours,
    jsonb_agg(DISTINCT jsonb_build_object('type', alert_type, 'count', cnt)) AS alert_types
  FROM (
    SELECT alert_type, COUNT(*) AS cnt
    FROM fraud_alerts
    WHERE status = 'pending'
    GROUP BY alert_type
  ) subq;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_fraud_tables_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fraud_alerts_timestamp
  BEFORE UPDATE ON fraud_alerts
  FOR EACH ROW EXECUTE FUNCTION update_fraud_tables_timestamp();

CREATE TRIGGER update_user_risk_scores_timestamp
  BEFORE UPDATE ON user_risk_scores
  FOR EACH ROW EXECUTE FUNCTION update_fraud_tables_timestamp();

CREATE TRIGGER update_account_holds_timestamp
  BEFORE UPDATE ON account_holds
  FOR EACH ROW EXECUTE FUNCTION update_fraud_tables_timestamp();

-- View: High risk users
CREATE OR REPLACE VIEW high_risk_users AS
SELECT
  u.supabase_id,
  u.email,
  u.username,
  u.created_at AS account_created,
  rs.risk_score,
  rs.factors,
  rs.is_blocked,
  (SELECT COUNT(*) FROM fraud_alerts WHERE user_id = u.supabase_id AND status = 'pending') AS pending_alerts,
  (SELECT SUM(token_balance) FROM users WHERE supabase_id = u.supabase_id) AS token_balance
FROM users u
JOIN user_risk_scores rs ON u.supabase_id = rs.user_id
WHERE rs.risk_score > 50 OR rs.is_blocked = true
ORDER BY rs.risk_score DESC, rs.last_calculated DESC;

-- Comments
COMMENT ON TABLE fraud_alerts IS
  'Fraud detection alerts requiring manual review. Auto-generated by fraud-protection middleware.';

COMMENT ON TABLE user_risk_scores IS
  'Risk scoring for users based on behavioral patterns. Updated by calculate_user_risk_score().';

COMMENT ON TABLE account_holds IS
  'Temporary token balance holds for accounts under review. Tokens released after manual verification.';

COMMENT ON FUNCTION calculate_user_risk_score(UUID) IS
  'Calculates risk score (0-100) based on account age, failed purchases, cashout patterns, and velocity violations.';

-- Add spend tracking columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_spend_check TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hourly_spend_total BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_spend_total BIGINT DEFAULT 0;

COMMENT ON COLUMN users.hourly_spend_total IS 'Cached hourly spend total (reset every hour)';
COMMENT ON COLUMN users.daily_spend_total IS 'Cached daily spend total (reset every 24h)';

-- Migration complete
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 145: Fraud Protection';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Created Tables:';
  RAISE NOTICE '  - fraud_alerts (pending fraud alerts)';
  RAISE NOTICE '  - user_risk_scores (risk scoring)';
  RAISE NOTICE '  - account_holds (balance holds)';
  RAISE NOTICE '';
  RAISE NOTICE 'Created Functions:';
  RAISE NOTICE '  - calculate_user_risk_score(user_id)';
  RAISE NOTICE '  - get_fraud_alerts_summary()';
  RAISE NOTICE '';
  RAISE NOTICE 'Created Views:';
  RAISE NOTICE '  - high_risk_users';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Apply fraud-protection middleware to routes';
  RAISE NOTICE '  2. Set up fraud alert monitoring dashboard';
  RAISE NOTICE '  3. Configure alert thresholds in middleware/fraud-protection.js';
  RAISE NOTICE '';
END $$;
