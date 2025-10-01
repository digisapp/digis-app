-- Create creator payout tables for banking and payment processing

-- Store creator Stripe Connect account information
CREATE TABLE IF NOT EXISTS creator_stripe_accounts (
  id SERIAL PRIMARY KEY,
  creator_id VARCHAR(255) NOT NULL REFERENCES users(firebase_uid) ON DELETE CASCADE,
  stripe_account_id VARCHAR(255) UNIQUE,
  account_status VARCHAR(50) DEFAULT 'pending', -- pending, active, restricted, disabled
  onboarding_completed BOOLEAN DEFAULT false,
  charges_enabled BOOLEAN DEFAULT false,
  payouts_enabled BOOLEAN DEFAULT false,
  country VARCHAR(2),
  currency VARCHAR(3) DEFAULT 'USD',
  business_type VARCHAR(50), -- individual, company
  details_submitted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(creator_id)
);

-- Store creator bank account information (encrypted)
CREATE TABLE IF NOT EXISTS creator_bank_accounts (
  id SERIAL PRIMARY KEY,
  creator_id VARCHAR(255) NOT NULL REFERENCES users(firebase_uid) ON DELETE CASCADE,
  stripe_account_id VARCHAR(255) REFERENCES creator_stripe_accounts(stripe_account_id),
  bank_account_id VARCHAR(255), -- Stripe bank account ID
  account_holder_name VARCHAR(255),
  account_type VARCHAR(50), -- checking, savings
  bank_name VARCHAR(255),
  last4 VARCHAR(4), -- Last 4 digits of account
  currency VARCHAR(3) DEFAULT 'USD',
  country VARCHAR(2),
  status VARCHAR(50) DEFAULT 'new', -- new, verified, verification_failed
  is_default BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payout schedules and history
CREATE TABLE IF NOT EXISTS creator_payouts (
  id SERIAL PRIMARY KEY,
  creator_id VARCHAR(255) NOT NULL REFERENCES users(firebase_uid) ON DELETE CASCADE,
  stripe_payout_id VARCHAR(255),
  payout_period_start DATE NOT NULL,
  payout_period_end DATE NOT NULL,
  tokens_earned INTEGER NOT NULL DEFAULT 0,
  usd_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  token_to_usd_rate DECIMAL(10, 4) NOT NULL DEFAULT 0.05, -- $0.05 per token
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, paid, failed, cancelled
  failure_reason TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  stripe_transfer_id VARCHAR(255),
  stripe_balance_transaction VARCHAR(255),
  platform_fee_amount DECIMAL(10, 2) DEFAULT 0.00, -- Platform takes a fee
  platform_fee_percentage DECIMAL(5, 2) DEFAULT 0.00, -- No platform fee
  net_payout_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Token earnings ledger (tracks all earnings)
CREATE TABLE IF NOT EXISTS creator_earnings (
  id SERIAL PRIMARY KEY,
  creator_id VARCHAR(255) NOT NULL REFERENCES users(firebase_uid) ON DELETE CASCADE,
  earning_type VARCHAR(50) NOT NULL, -- session, tip, content_purchase, membership
  source_id VARCHAR(255), -- Reference to session_id, purchase_id, etc.
  tokens_earned INTEGER NOT NULL,
  usd_value DECIMAL(10, 2) NOT NULL,
  payout_id INTEGER REFERENCES creator_payouts(id), -- Links to payout when processed
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  description TEXT,
  fan_id VARCHAR(255) REFERENCES users(firebase_uid),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payout settings and preferences
CREATE TABLE IF NOT EXISTS creator_payout_settings (
  id SERIAL PRIMARY KEY,
  creator_id VARCHAR(255) NOT NULL REFERENCES users(firebase_uid) ON DELETE CASCADE,
  payout_enabled BOOLEAN DEFAULT true,
  minimum_payout_amount DECIMAL(10, 2) DEFAULT 50.00, -- Minimum $50 for payout
  payout_schedule VARCHAR(50) DEFAULT 'biweekly', -- biweekly, monthly, manual
  tax_form_submitted BOOLEAN DEFAULT false,
  tax_form_type VARCHAR(50), -- W9, W8BEN, etc.
  tax_id_provided BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(creator_id)
);

-- Payout notifications and alerts
CREATE TABLE IF NOT EXISTS payout_notifications (
  id SERIAL PRIMARY KEY,
  creator_id VARCHAR(255) NOT NULL REFERENCES users(firebase_uid) ON DELETE CASCADE,
  payout_id INTEGER REFERENCES creator_payouts(id),
  notification_type VARCHAR(50) NOT NULL, -- payout_initiated, payout_completed, payout_failed, bank_verification_required
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_creator_stripe_accounts_creator_id ON creator_stripe_accounts(creator_id);
CREATE INDEX idx_creator_stripe_accounts_status ON creator_stripe_accounts(account_status);
CREATE INDEX idx_creator_bank_accounts_creator_id ON creator_bank_accounts(creator_id);
CREATE INDEX idx_creator_payouts_creator_id ON creator_payouts(creator_id);
CREATE INDEX idx_creator_payouts_status ON creator_payouts(status);
CREATE INDEX idx_creator_payouts_period ON creator_payouts(payout_period_start, payout_period_end);
CREATE INDEX idx_creator_earnings_creator_id ON creator_earnings(creator_id);
CREATE INDEX idx_creator_earnings_payout_id ON creator_earnings(payout_id);
CREATE INDEX idx_creator_earnings_earned_at ON creator_earnings(earned_at);

-- Create function to calculate creator balance
CREATE OR REPLACE FUNCTION get_creator_pending_balance(p_creator_id VARCHAR(255))
RETURNS TABLE(
  total_tokens INTEGER,
  total_usd DECIMAL(10, 2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(ce.tokens_earned), 0)::INTEGER as total_tokens,
    COALESCE(SUM(ce.usd_value), 0)::DECIMAL(10, 2) as total_usd
  FROM creator_earnings ce
  WHERE ce.creator_id = p_creator_id
    AND ce.payout_id IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Create function to check if creator can receive payouts
CREATE OR REPLACE FUNCTION can_creator_receive_payouts(p_creator_id VARCHAR(255))
RETURNS BOOLEAN AS $$
DECLARE
  v_stripe_account RECORD;
  v_has_bank_account BOOLEAN;
BEGIN
  -- Check Stripe account status
  SELECT * INTO v_stripe_account
  FROM creator_stripe_accounts
  WHERE creator_id = p_creator_id
    AND account_status = 'active'
    AND payouts_enabled = true
    AND charges_enabled = true;
    
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Check if has verified bank account
  SELECT EXISTS(
    SELECT 1 FROM creator_bank_accounts
    WHERE creator_id = p_creator_id
      AND status = 'verified'
  ) INTO v_has_bank_account;
  
  RETURN v_has_bank_account;
END;
$$ LANGUAGE plpgsql;

-- Create view for payout dashboard
CREATE OR REPLACE VIEW creator_payout_dashboard AS
SELECT 
  u.firebase_uid as creator_id,
  u.username as display_name,
  COALESCE(pending.total_tokens, 0) as pending_tokens,
  COALESCE(pending.total_usd, 0) as pending_usd,
  COALESCE(paid.total_usd, 0) as lifetime_earnings_usd,
  COALESCE(paid.payout_count, 0) as total_payouts,
  sa.account_status as stripe_status,
  sa.payouts_enabled,
  ps.payout_enabled,
  ps.minimum_payout_amount,
  ps.payout_schedule,
  can_creator_receive_payouts(u.firebase_uid) as can_receive_payouts
FROM users u
LEFT JOIN LATERAL get_creator_pending_balance(u.firebase_uid) pending ON true
LEFT JOIN LATERAL (
  SELECT 
    SUM(net_payout_amount) as total_usd,
    COUNT(*) as payout_count
  FROM creator_payouts
  WHERE creator_id = u.firebase_uid AND status = 'paid'
) paid ON true
LEFT JOIN creator_stripe_accounts sa ON sa.creator_id = u.firebase_uid
LEFT JOIN creator_payout_settings ps ON ps.creator_id = u.firebase_uid
WHERE u.is_creator = true;

-- Add trigger to update token balances when earnings are added
CREATE OR REPLACE FUNCTION update_creator_token_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- When earnings are added, also update the creator's token balance
  IF TG_OP = 'INSERT' AND NEW.payout_id IS NULL THEN
    UPDATE users 
    SET creator_token_balance = COALESCE(creator_token_balance, 0) + NEW.tokens_earned
    WHERE uid = NEW.creator_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_creator_token_balance
AFTER INSERT ON creator_earnings
FOR EACH ROW
EXECUTE FUNCTION update_creator_token_balance();

-- Add creator_token_balance column to users table if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS creator_token_balance INTEGER DEFAULT 0;

-- Create scheduled payout generation function
CREATE OR REPLACE FUNCTION generate_scheduled_payouts(p_payout_date DATE)
RETURNS INTEGER AS $$
DECLARE
  v_payout_count INTEGER := 0;
  v_creator RECORD;
  v_period_start DATE;
  v_period_end DATE;
  v_payout_id INTEGER;
BEGIN
  -- Determine payout period based on date
  IF EXTRACT(DAY FROM p_payout_date) <= 15 THEN
    -- 1st of month payout covers 16th to end of previous month
    v_period_start := (p_payout_date - INTERVAL '1 month')::DATE + 15;
    v_period_end := (DATE_TRUNC('month', p_payout_date) - INTERVAL '1 day')::DATE;
  ELSE
    -- 15th of month payout covers 1st to 15th
    v_period_start := DATE_TRUNC('month', p_payout_date);
    v_period_end := p_payout_date;
  END IF;
  
  -- Process each eligible creator
  FOR v_creator IN 
    SELECT 
      u.firebase_uid as creator_id,
      COALESCE(SUM(ce.tokens_earned), 0) as tokens_earned,
      COALESCE(SUM(ce.usd_value), 0) as usd_amount,
      ps.minimum_payout_amount,
      ps.payout_enabled
    FROM users u
    INNER JOIN creator_payout_settings ps ON ps.creator_id = u.uid
    LEFT JOIN creator_earnings ce ON ce.creator_id = u.uid 
      AND ce.payout_id IS NULL
      AND ce.earned_at >= v_period_start 
      AND ce.earned_at <= v_period_end + INTERVAL '1 day'
    WHERE u.is_creator = true
      AND ps.payout_enabled = true
      AND can_creator_receive_payouts(u.firebase_uid) = true
    GROUP BY u.firebase_uid, ps.minimum_payout_amount, ps.payout_enabled
    HAVING COALESCE(SUM(ce.usd_value), 0) >= ps.minimum_payout_amount
  LOOP
    -- Calculate platform fee (0% - no fee)
    DECLARE
      v_platform_fee DECIMAL(10, 2);
      v_net_amount DECIMAL(10, 2);
    BEGIN
      v_platform_fee := 0;
      v_net_amount := v_creator.usd_amount - v_platform_fee;
      
      -- Create payout record
      INSERT INTO creator_payouts (
        creator_id,
        payout_period_start,
        payout_period_end,
        tokens_earned,
        usd_amount,
        token_to_usd_rate,
        platform_fee_amount,
        net_payout_amount,
        status
      ) VALUES (
        v_creator.creator_id,
        v_period_start,
        v_period_end,
        v_creator.tokens_earned,
        v_creator.usd_amount,
        0.05,
        v_platform_fee,
        v_net_amount,
        'pending'
      ) RETURNING id INTO v_payout_id;
      
      -- Link earnings to this payout
      UPDATE creator_earnings
      SET payout_id = v_payout_id
      WHERE creator_id = v_creator.creator_id
        AND payout_id IS NULL
        AND earned_at >= v_period_start
        AND earned_at <= v_period_end + INTERVAL '1 day';
        
      v_payout_count := v_payout_count + 1;
    END;
  END LOOP;
  
  RETURN v_payout_count;
END;
$$ LANGUAGE plpgsql;

-- Sample data for testing (remove in production)
-- INSERT INTO creator_payout_settings (creator_id, payout_enabled, minimum_payout_amount)
-- SELECT uid, true, 50.00 FROM users WHERE is_creator = true ON CONFLICT DO NOTHING;