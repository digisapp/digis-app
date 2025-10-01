-- ============================================
-- Create Withdrawals Table
-- ============================================
-- This table tracks creator withdrawal requests and their status
-- ============================================

-- Create withdrawals table
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id SERIAL PRIMARY KEY,
  creator_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  account_details JSONB,
  stripe_transfer_id VARCHAR(255),
  stripe_payout_id VARCHAR(255),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_withdrawals_creator_id ON public.withdrawals(creator_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_withdrawals_requested_at ON public.withdrawals(requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_creator_status ON public.withdrawals(creator_id, status);

-- Add withdrawn_amount column to users table if not exists
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS withdrawn_amount DECIMAL(15,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS bank_account JSONB,
ADD COLUMN IF NOT EXISTS auto_withdraw_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_withdrawals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_withdrawals_updated_at_trigger
BEFORE UPDATE ON public.withdrawals
FOR EACH ROW
EXECUTE FUNCTION update_withdrawals_updated_at();

-- ============================================
-- Verification
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Withdrawals table created successfully!';
  RAISE NOTICE '============================================';
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'withdrawals') THEN
    RAISE NOTICE '✅ Table: withdrawals';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'withdrawn_amount') THEN
    RAISE NOTICE '✅ Column: users.withdrawn_amount';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'bank_account') THEN
    RAISE NOTICE '✅ Column: users.bank_account';
  END IF;
  
  RAISE NOTICE '============================================';
END $$;