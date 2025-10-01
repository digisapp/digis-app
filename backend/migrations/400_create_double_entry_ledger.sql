-- Double-Entry Ledger System for Financial Integrity
-- Ensures all financial transactions are properly tracked and balanced

-- Account types enum
CREATE TYPE account_type AS ENUM (
  'user',           -- User wallets
  'platform',       -- Platform revenue account
  'treasury',       -- Platform treasury/reserve
  'escrow',        -- Temporary holding for pending transactions
  'fees',          -- Fee collection account
  'payouts'        -- Payout processing account
);

-- Transaction types enum
CREATE TYPE transaction_type AS ENUM (
  'token_purchase',
  'token_transfer',
  'tip',
  'session_payment',
  'withdrawal',
  'refund',
  'platform_fee',
  'creator_payout',
  'subscription_payment',
  'content_purchase',
  'gift_purchase',
  'adjustment'  -- For corrections/admin actions
);

-- Accounts table - represents all financial accounts
CREATE TABLE IF NOT EXISTS accounts (
  id BIGSERIAL PRIMARY KEY,
  owner_id UUID NOT NULL,  -- User ID or system ID
  type account_type NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  balance_cents BIGINT NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  available_balance_cents BIGINT NOT NULL DEFAULT 0 CHECK (available_balance_cents >= 0),
  pending_balance_cents BIGINT NOT NULL DEFAULT 0 CHECK (pending_balance_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Constraints
  UNIQUE(owner_id, type, currency)
);

-- Journals table - groups related entries for atomic transactions
CREATE TABLE IF NOT EXISTS journals (
  id BIGSERIAL PRIMARY KEY,
  ref_type transaction_type NOT NULL,
  ref_id UUID NOT NULL,  -- Reference to original transaction (payment_id, session_id, etc.)
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,  -- User who initiated the transaction
  idempotency_key TEXT UNIQUE,
  metadata JSONB DEFAULT '{}',
  reversed_by BIGINT REFERENCES journals(id),  -- For reversal tracking
  is_reversed BOOLEAN NOT NULL DEFAULT FALSE
);

-- Entries table - individual debit/credit entries
CREATE TABLE IF NOT EXISTS entries (
  id BIGSERIAL PRIMARY KEY,
  journal_id BIGINT NOT NULL REFERENCES journals(id) ON DELETE RESTRICT,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  amount_cents BIGINT NOT NULL,  -- Positive for debit, negative for credit
  balance_before_cents BIGINT NOT NULL,  -- Account balance before this entry
  balance_after_cents BIGINT NOT NULL,   -- Account balance after this entry
  entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('debit', 'credit')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',

  -- Ensure entries balance within a journal
  CONSTRAINT valid_amount CHECK (
    (entry_type = 'debit' AND amount_cents > 0) OR
    (entry_type = 'credit' AND amount_cents < 0)
  )
);

-- Audit log for all financial actions (append-only)
CREATE TABLE IF NOT EXISTS financial_audit_log (
  id BIGSERIAL PRIMARY KEY,
  action VARCHAR(50) NOT NULL,
  actor_id UUID,
  target_account_id BIGINT REFERENCES accounts(id),
  journal_id BIGINT REFERENCES journals(id),
  amount_cents BIGINT,
  before_state JSONB,
  after_state JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Ledger balance snapshots for reconciliation
CREATE TABLE IF NOT EXISTS ledger_snapshots (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id),
  balance_cents BIGINT NOT NULL,
  entry_count INTEGER NOT NULL,
  last_entry_id BIGINT REFERENCES entries(id),
  snapshot_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(account_id, snapshot_date)
);

-- Pending transactions table (for two-phase commits)
CREATE TABLE IF NOT EXISTS pending_transactions (
  id BIGSERIAL PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  transaction_type transaction_type NOT NULL,
  amount_cents BIGINT NOT NULL,
  from_account_id BIGINT REFERENCES accounts(id),
  to_account_id BIGINT REFERENCES accounts(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  journal_id BIGINT REFERENCES journals(id),
  metadata JSONB DEFAULT '{}',

  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired'))
);

-- Function to ensure journal entries balance
CREATE OR REPLACE FUNCTION check_journal_balance()
RETURNS TRIGGER AS $$
DECLARE
  total_amount BIGINT;
BEGIN
  -- Calculate total of all entries for this journal
  SELECT COALESCE(SUM(amount_cents), 0) INTO total_amount
  FROM entries
  WHERE journal_id = NEW.journal_id;

  -- Check if journal is balanced (should sum to zero)
  IF total_amount != 0 THEN
    -- Check if this is the balancing entry
    IF total_amount + NEW.amount_cents != 0 THEN
      RAISE EXCEPTION 'Journal entries must balance to zero. Current sum: %, New entry: %',
        total_amount, NEW.amount_cents;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce double-entry balance
CREATE TRIGGER enforce_journal_balance
  AFTER INSERT ON entries
  FOR EACH ROW
  EXECUTE FUNCTION check_journal_balance();

-- Function to update account balance
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Update account balance
  UPDATE accounts
  SET
    balance_cents = NEW.balance_after_cents,
    updated_at = NOW()
  WHERE id = NEW.account_id;

  -- Log to audit
  INSERT INTO financial_audit_log (
    action,
    target_account_id,
    journal_id,
    amount_cents,
    before_state,
    after_state,
    created_at
  ) VALUES (
    'balance_update',
    NEW.account_id,
    NEW.journal_id,
    NEW.amount_cents,
    jsonb_build_object('balance_cents', NEW.balance_before_cents),
    jsonb_build_object('balance_cents', NEW.balance_after_cents),
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update account balance on entry
CREATE TRIGGER update_account_on_entry
  AFTER INSERT ON entries
  FOR EACH ROW
  EXECUTE FUNCTION update_account_balance();

-- Function for atomic token transfer
CREATE OR REPLACE FUNCTION transfer_tokens(
  p_from_account_id BIGINT,
  p_to_account_id BIGINT,
  p_amount_cents BIGINT,
  p_transaction_type transaction_type,
  p_ref_id UUID,
  p_description TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
  v_journal_id BIGINT;
  v_from_balance BIGINT;
  v_to_balance BIGINT;
BEGIN
  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_journal_id
    FROM journals
    WHERE idempotency_key = p_idempotency_key;

    IF v_journal_id IS NOT NULL THEN
      RETURN v_journal_id;  -- Return existing transaction
    END IF;
  END IF;

  -- Lock accounts in order to prevent deadlock
  IF p_from_account_id < p_to_account_id THEN
    PERFORM * FROM accounts WHERE id = p_from_account_id FOR UPDATE;
    PERFORM * FROM accounts WHERE id = p_to_account_id FOR UPDATE;
  ELSE
    PERFORM * FROM accounts WHERE id = p_to_account_id FOR UPDATE;
    PERFORM * FROM accounts WHERE id = p_from_account_id FOR UPDATE;
  END IF;

  -- Get current balances
  SELECT balance_cents INTO v_from_balance FROM accounts WHERE id = p_from_account_id;
  SELECT balance_cents INTO v_to_balance FROM accounts WHERE id = p_to_account_id;

  -- Check sufficient balance
  IF v_from_balance < p_amount_cents THEN
    RAISE EXCEPTION 'Insufficient balance. Available: %, Required: %',
      v_from_balance, p_amount_cents;
  END IF;

  -- Create journal entry
  INSERT INTO journals (ref_type, ref_id, description, idempotency_key)
  VALUES (p_transaction_type, p_ref_id, p_description, p_idempotency_key)
  RETURNING id INTO v_journal_id;

  -- Create debit entry (from account)
  INSERT INTO entries (
    journal_id, account_id, amount_cents,
    balance_before_cents, balance_after_cents, entry_type
  ) VALUES (
    v_journal_id, p_from_account_id, p_amount_cents,
    v_from_balance, v_from_balance - p_amount_cents, 'debit'
  );

  -- Create credit entry (to account)
  INSERT INTO entries (
    journal_id, account_id, amount_cents,
    balance_before_cents, balance_after_cents, entry_type
  ) VALUES (
    v_journal_id, p_to_account_id, -p_amount_cents,
    v_to_balance, v_to_balance + p_amount_cents, 'credit'
  );

  RETURN v_journal_id;
END;
$$ LANGUAGE plpgsql;

-- Create initial system accounts
INSERT INTO accounts (owner_id, type, currency, balance_cents)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'platform', 'USD', 0),
  ('00000000-0000-0000-0000-000000000001', 'treasury', 'USD', 0),
  ('00000000-0000-0000-0000-000000000002', 'fees', 'USD', 0),
  ('00000000-0000-0000-0000-000000000003', 'escrow', 'USD', 0),
  ('00000000-0000-0000-0000-000000000004', 'payouts', 'USD', 0)
ON CONFLICT (owner_id, type, currency) DO NOTHING;

-- Add RLS policies
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_audit_log ENABLE ROW LEVEL SECURITY;

-- Create indexes separately after tables are created
CREATE INDEX IF NOT EXISTS idx_accounts_owner_id ON accounts(owner_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);
CREATE INDEX IF NOT EXISTS idx_accounts_active ON accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_accounts_balance ON accounts(balance_cents);

CREATE INDEX IF NOT EXISTS idx_journals_ref ON journals(ref_type, ref_id);
CREATE INDEX IF NOT EXISTS idx_journals_created_at ON journals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journals_idempotency ON journals(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_journals_reversed ON journals(is_reversed);
CREATE INDEX IF NOT EXISTS idx_journals_metadata ON journals USING GIN(metadata);

CREATE INDEX IF NOT EXISTS idx_entries_journal ON entries(journal_id);
CREATE INDEX IF NOT EXISTS idx_entries_account ON entries(account_id);
CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_amount ON entries(amount_cents);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON financial_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON financial_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON financial_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_metadata ON financial_audit_log USING GIN(metadata);

CREATE INDEX IF NOT EXISTS idx_snapshots_account ON ledger_snapshots(account_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON ledger_snapshots(snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_transactions(status);
CREATE INDEX IF NOT EXISTS idx_pending_expires ON pending_transactions(expires_at);