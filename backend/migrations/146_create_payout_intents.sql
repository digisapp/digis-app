-- Migration: Add Creator Payout Intents (Release Funds Feature)
--
-- Allows creators to opt-in to payouts on a per-cycle basis.
-- Creators must click "Release Funds" to be included in the next payout run.
-- If they don't opt-in, funds remain in their connected account.

-- Create payout intents table
CREATE TABLE IF NOT EXISTS creator_payout_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  cycle_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'canceled', 'consumed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure one intent per creator per cycle
  CONSTRAINT uq_creator_payout_intents_user_cycle UNIQUE (user_id, cycle_date)
);

-- Add foreign key constraint (with proper user identification)
-- Note: Adjust the reference column based on your users table structure
-- If users.id is UUID, use: REFERENCES users(id)
-- If users.supabase_id is UUID, use: REFERENCES users(supabase_id)
DO $$
BEGIN
  -- Try to add FK constraint if supabase_id column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'supabase_id'
  ) THEN
    EXECUTE 'ALTER TABLE creator_payout_intents
             ADD CONSTRAINT fk_creator_payout_intents_user
             FOREIGN KEY (user_id) REFERENCES users(supabase_id) ON DELETE CASCADE';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    EXECUTE 'ALTER TABLE creator_payout_intents
             ADD CONSTRAINT fk_creator_payout_intents_user
             FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;  -- FK already exists
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_creator_payout_intents_cycle
  ON creator_payout_intents(cycle_date);

CREATE INDEX IF NOT EXISTS idx_creator_payout_intents_user_status
  ON creator_payout_intents(user_id, status);

CREATE INDEX IF NOT EXISTS idx_creator_payout_intents_cycle_status
  ON creator_payout_intents(cycle_date, status)
  WHERE status = 'pending';

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_creator_payout_intents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_creator_payout_intents_updated_at
  ON creator_payout_intents;

CREATE TRIGGER trigger_creator_payout_intents_updated_at
  BEFORE UPDATE ON creator_payout_intents
  FOR EACH ROW
  EXECUTE FUNCTION update_creator_payout_intents_updated_at();

-- Add comment for documentation
COMMENT ON TABLE creator_payout_intents IS
  'Tracks creator opt-in for payouts. Creators must click "Release Funds" to be included in the next payout cycle (1st or 15th).';

COMMENT ON COLUMN creator_payout_intents.status IS
  'pending: waiting for payout run, canceled: creator canceled before run, consumed: payout created';

COMMENT ON COLUMN creator_payout_intents.cycle_date IS
  'The payout cycle date (always 1st or 15th of a month)';
