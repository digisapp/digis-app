-- Verification Query - Run this in Supabase SQL Editor
-- This will check if the migration was successful

-- Check 1: Does withdrawal_requests table exist?
SELECT
  'withdrawal_requests' as table_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'withdrawal_requests'
    ) THEN '✅ EXISTS'
    ELSE '❌ NOT FOUND'
  END as status;

-- Check 2: What columns exist in withdrawal_requests?
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'withdrawal_requests'
ORDER BY ordinal_position;

-- Check 3: Were the new columns added to users table?
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('stripe_connect_account_id', 'payout_method', 'payout_details')
ORDER BY column_name;

-- Check 4: Count any withdrawal requests (should be 0 initially)
SELECT COUNT(*) as total_withdrawal_requests
FROM withdrawal_requests;
