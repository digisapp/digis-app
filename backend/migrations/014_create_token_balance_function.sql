-- Migration: Create SECURITY DEFINER function to bypass RLS for token_balances
-- This allows sync-user to create initial token balances without needing an INSERT policy

-- Create function that bypasses RLS for token balance creation
CREATE OR REPLACE FUNCTION public.ensure_token_balance(p_supabase_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO token_balances (
    user_id,
    balance,
    total_earned,
    total_spent,
    total_purchased,
    created_at,
    updated_at
  )
  VALUES (
    p_supabase_id,
    0,
    0,
    0,
    0,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- Lock it down - only authenticated users can call this
REVOKE ALL ON FUNCTION public.ensure_token_balance(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_token_balance(UUID) TO authenticated;

-- Also add column defaults to prevent NOT NULL errors
ALTER TABLE users
  ALTER COLUMN video_rate_cents SET DEFAULT 0,
  ALTER COLUMN voice_rate_cents SET DEFAULT 0,
  ALTER COLUMN stream_rate_cents SET DEFAULT 0,
  ALTER COLUMN message_price_cents SET DEFAULT 0;

-- Backfill any NULL values
UPDATE users
SET
  video_rate_cents = COALESCE(video_rate_cents, 0),
  voice_rate_cents = COALESCE(voice_rate_cents, 0),
  stream_rate_cents = COALESCE(stream_rate_cents, 0),
  message_price_cents = COALESCE(message_price_cents, 0)
WHERE
  video_rate_cents IS NULL
  OR voice_rate_cents IS NULL
  OR stream_rate_cents IS NULL
  OR message_price_cents IS NULL;

-- Verify function was created
SELECT proname, prosecdef
FROM pg_proc
WHERE proname = 'ensure_token_balance';

-- Expected output: ensure_token_balance | t (where t means SECURITY DEFINER is enabled)
