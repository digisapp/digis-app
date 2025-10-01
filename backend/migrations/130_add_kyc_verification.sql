-- Add KYC (Know Your Customer) verification fields for creators
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(50) DEFAULT 'not_started' CHECK (kyc_status IN ('not_started', 'pending', 'verified', 'failed', 'expired')),
ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS kyc_expiry_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS stripe_identity_verification_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS identity_document_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS identity_document_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tax_form_status VARCHAR(50) DEFAULT 'not_submitted' CHECK (tax_form_status IN ('not_submitted', 'w9_submitted', 'w8ben_submitted', 'verified', 'expired')),
ADD COLUMN IF NOT EXISTS tax_form_submitted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tax_id VARCHAR(255), -- Encrypted SSN/EIN for US, other tax IDs for international
ADD COLUMN IF NOT EXISTS address_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(255),
ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(255),
ADD COLUMN IF NOT EXISTS address_city VARCHAR(100),
ADD COLUMN IF NOT EXISTS address_state VARCHAR(50),
ADD COLUMN IF NOT EXISTS address_postal_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS address_country VARCHAR(2), -- ISO country code
ADD COLUMN IF NOT EXISTS payouts_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS payout_hold_reason TEXT;

-- Create KYC verification history table
CREATE TABLE IF NOT EXISTS kyc_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
  verification_type VARCHAR(50) NOT NULL, -- 'identity', 'address', 'tax_form'
  status VARCHAR(50) NOT NULL,
  stripe_verification_id VARCHAR(255),
  document_type VARCHAR(50),
  verification_data JSONB,
  failure_reason TEXT,
  verified_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tax documents table
CREATE TABLE IF NOT EXISTS tax_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(supabase_id) ON DELETE CASCADE,
  document_type VARCHAR(20) NOT NULL CHECK (document_type IN ('W-9', 'W-8BEN', 'W-8BEN-E', '1099-NEC', '1099-K')),
  tax_year INTEGER NOT NULL,
  form_data JSONB, -- Encrypted sensitive data
  file_url TEXT, -- S3/Storage URL for PDF
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'verified', 'sent', 'archived')),
  submitted_at TIMESTAMP WITH TIME ZONE,
  verified_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, document_type, tax_year)
);

-- Create indexes for KYC queries
CREATE INDEX IF NOT EXISTS idx_users_kyc_status ON users(kyc_status) WHERE is_creator = true;
CREATE INDEX IF NOT EXISTS idx_users_payouts_enabled ON users(payouts_enabled) WHERE is_creator = true;
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_user_id ON kyc_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_status ON kyc_verifications(status);
CREATE INDEX IF NOT EXISTS idx_tax_documents_user_id ON tax_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_tax_documents_tax_year ON tax_documents(tax_year);

-- Add trigger to update payouts_enabled based on KYC status
CREATE OR REPLACE FUNCTION update_payouts_enabled()
RETURNS TRIGGER AS $$
BEGIN
  -- Enable payouts only if KYC is verified and tax form is submitted
  IF NEW.kyc_status = 'verified' AND 
     NEW.tax_form_status IN ('w9_submitted', 'w8ben_submitted', 'verified') AND
     NEW.identity_document_verified = true AND
     NEW.address_verified = true THEN
    NEW.payouts_enabled := true;
    NEW.payout_hold_reason := NULL;
  ELSE
    NEW.payouts_enabled := false;
    
    -- Set appropriate hold reason
    IF NEW.kyc_status != 'verified' THEN
      NEW.payout_hold_reason := 'Identity verification required';
    ELSIF NEW.tax_form_status = 'not_submitted' THEN
      NEW.payout_hold_reason := 'Tax form submission required';
    ELSIF NOT NEW.identity_document_verified THEN
      NEW.payout_hold_reason := 'Identity document verification required';
    ELSIF NOT NEW.address_verified THEN
      NEW.payout_hold_reason := 'Address verification required';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payouts_enabled
DROP TRIGGER IF EXISTS trigger_update_payouts_enabled ON users;
CREATE TRIGGER trigger_update_payouts_enabled
  BEFORE INSERT OR UPDATE OF kyc_status, tax_form_status, identity_document_verified, address_verified
  ON users
  FOR EACH ROW
  WHEN (NEW.is_creator = true)
  EXECUTE FUNCTION update_payouts_enabled();

-- Add comments
COMMENT ON COLUMN users.kyc_status IS 'KYC verification status: not_started, pending, verified, failed, expired';
COMMENT ON COLUMN users.stripe_identity_verification_id IS 'Stripe Identity verification session ID';
COMMENT ON COLUMN users.tax_form_status IS 'Tax form submission status';
COMMENT ON COLUMN users.tax_id IS 'Encrypted tax identification number (SSN/EIN/etc)';
COMMENT ON COLUMN users.payouts_enabled IS 'Whether creator can receive payouts (auto-managed by trigger)';
COMMENT ON COLUMN users.payout_hold_reason IS 'Reason why payouts are on hold';
COMMENT ON TABLE kyc_verifications IS 'History of all KYC verification attempts';
COMMENT ON TABLE tax_documents IS 'Tax forms and documents for creators';