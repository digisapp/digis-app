-- =====================================================
-- Cents Migration Verification Queries
-- Run these to ensure data integrity after migration
-- =====================================================

-- =====================================================
-- 1. CHECK FOR NEGATIVE VALUES (should be 0 except refunds)
-- =====================================================
SELECT
  'Negative Balance Check' as check_type,
  'token_balances' as table_name,
  COUNT(*) as issue_count
FROM token_balances
WHERE balance_cents < 0

UNION ALL

SELECT
  'Negative Balance Check',
  'users',
  COUNT(*)
FROM users
WHERE token_balance_cents < 0

UNION ALL

SELECT
  'Negative Tips Check',
  'tips',
  COUNT(*)
FROM tips
WHERE tip_amount_cents < 0;

-- =====================================================
-- 2. CHECK FOR NULL VALUES
-- =====================================================
SELECT
  'NULL Values Check' as check_type,
  'token_balances' as table_name,
  COUNT(*) as null_count
FROM token_balances
WHERE balance_cents IS NULL

UNION ALL

SELECT
  'NULL Values Check',
  'token_transactions',
  COUNT(*)
FROM token_transactions
WHERE amount_cents IS NULL

UNION ALL

SELECT
  'NULL Values Check',
  'payments',
  COUNT(*)
FROM payments
WHERE amount_cents IS NULL OR fee_cents IS NULL OR net_cents IS NULL;

-- =====================================================
-- 3. COMPARE OLD VS NEW TOTALS
-- =====================================================
WITH comparison AS (
  SELECT
    'token_balances' as table_name,
    COALESCE(SUM(balance), 0) as old_total_dollars,
    COALESCE(SUM(balance_cents), 0)/100.0 as new_total_dollars
  FROM token_balances

  UNION ALL

  SELECT
    'users.token_balance',
    COALESCE(SUM(token_balance), 0),
    COALESCE(SUM(token_balance_cents), 0)/100.0
  FROM users

  UNION ALL

  SELECT
    'users.total_earnings',
    COALESCE(SUM(total_earnings), 0),
    COALESCE(SUM(total_earnings_cents), 0)/100.0
  FROM users

  UNION ALL

  SELECT
    'tips',
    COALESCE(SUM(amount), 0),
    COALESCE(SUM(tip_amount_cents), 0)/100.0
  FROM tips

  UNION ALL

  SELECT
    'payments',
    COALESCE(SUM(amount), 0),
    COALESCE(SUM(amount_cents), 0)/100.0
  FROM payments
)
SELECT
  table_name,
  old_total_dollars,
  new_total_dollars,
  ABS(old_total_dollars - new_total_dollars) as difference,
  CASE
    WHEN ABS(old_total_dollars - new_total_dollars) > 1 THEN 'MISMATCH!'
    WHEN ABS(old_total_dollars - new_total_dollars) > 0.01 THEN 'Minor Rounding'
    ELSE 'OK'
  END as status
FROM comparison
ORDER BY ABS(old_total_dollars - new_total_dollars) DESC;

-- =====================================================
-- 4. PAYMENT CONSISTENCY CHECK
-- =====================================================
SELECT
  'Payment Math Check' as check_type,
  COUNT(*) as inconsistent_count,
  STRING_AGG(id::TEXT, ', ' ORDER BY id LIMIT 10) as sample_ids
FROM payments
WHERE amount_cents != (fee_cents + net_cents)
  AND amount_cents > 0;

-- =====================================================
-- 5. FIND SUSPICIOUSLY LARGE VALUES
-- =====================================================
SELECT
  'Max Values Check' as check_type,
  'token_balances' as table_name,
  MAX(balance_cents) as max_cents,
  MAX(balance_cents)/100.0 as max_dollars,
  CASE
    WHEN MAX(balance_cents) > 100000000 THEN 'WARNING: Over $1M'
    WHEN MAX(balance_cents) > 10000000 THEN 'Note: Over $100K'
    ELSE 'Normal Range'
  END as status
FROM token_balances

UNION ALL

SELECT
  'Max Values Check',
  'payments',
  MAX(amount_cents),
  MAX(amount_cents)/100.0,
  CASE
    WHEN MAX(amount_cents) > 100000000 THEN 'WARNING: Over $1M'
    WHEN MAX(amount_cents) > 10000000 THEN 'Note: Over $100K'
    ELSE 'Normal Range'
  END
FROM payments

UNION ALL

SELECT
  'Max Values Check',
  'tips',
  MAX(tip_amount_cents),
  MAX(tip_amount_cents)/100.0,
  CASE
    WHEN MAX(tip_amount_cents) > 100000 THEN 'WARNING: Over $1K tip'
    WHEN MAX(tip_amount_cents) > 10000 THEN 'Note: Over $100 tip'
    ELSE 'Normal Range'
  END
FROM tips;

-- =====================================================
-- 6. CONVERSION ACCURACY CHECK (sample)
-- =====================================================
WITH sample_check AS (
  SELECT
    id,
    balance,
    balance_cents,
    ROUND(balance * 100) as expected_cents,
    balance_cents - ROUND(balance * 100) as diff
  FROM token_balances
  WHERE balance IS NOT NULL
    AND balance > 0
  LIMIT 100
)
SELECT
  COUNT(*) as sample_size,
  COUNT(*) FILTER (WHERE diff = 0) as exact_matches,
  COUNT(*) FILTER (WHERE diff != 0) as mismatches,
  MAX(ABS(diff)) as max_difference
FROM sample_check;

-- =====================================================
-- 7. MISSING BACKFILL CHECK
-- =====================================================
SELECT
  'Missing Backfill' as check_type,
  table_name,
  missing_count,
  CASE
    WHEN missing_count > 0 THEN 'NEEDS BACKFILL'
    ELSE 'OK'
  END as status
FROM (
  SELECT 'token_balances' as table_name,
         COUNT(*) as missing_count
  FROM token_balances
  WHERE balance > 0 AND balance_cents = 0

  UNION ALL

  SELECT 'users',
         COUNT(*)
  FROM users
  WHERE token_balance > 0 AND token_balance_cents = 0

  UNION ALL

  SELECT 'tips',
         COUNT(*)
  FROM tips
  WHERE amount > 0 AND tip_amount_cents = 0

  UNION ALL

  SELECT 'payments',
         COUNT(*)
  FROM payments
  WHERE amount > 0 AND amount_cents = 0
) t
WHERE missing_count > 0;

-- =====================================================
-- 8. TRANSACTION TOTALS BY TYPE
-- =====================================================
SELECT
  type as transaction_type,
  COUNT(*) as count,
  SUM(amount_cents)/100.0 as total_dollars,
  AVG(amount_cents)/100.0 as avg_dollars,
  MIN(amount_cents)/100.0 as min_dollars,
  MAX(amount_cents)/100.0 as max_dollars
FROM token_transactions
WHERE amount_cents > 0
GROUP BY type
ORDER BY SUM(amount_cents) DESC;

-- =====================================================
-- 9. DATA QUALITY SCORE
-- =====================================================
WITH quality_checks AS (
  SELECT
    (SELECT COUNT(*) = 0 FROM token_balances WHERE balance_cents < 0) as no_negative_balances,
    (SELECT COUNT(*) = 0 FROM token_balances WHERE balance_cents IS NULL) as no_null_balances,
    (SELECT COUNT(*) = 0 FROM payments WHERE amount_cents != (fee_cents + net_cents)) as payment_math_ok,
    (SELECT ABS(SUM(balance) - SUM(balance_cents)/100.0) < 1 FROM token_balances) as totals_match,
    (SELECT COUNT(*) = 0 FROM token_balances WHERE balance > 0 AND balance_cents = 0) as all_backfilled
)
SELECT
  CASE
    WHEN no_negative_balances AND no_null_balances AND payment_math_ok AND totals_match AND all_backfilled
    THEN '✅ MIGRATION SUCCESSFUL - All checks passed'
    ELSE '⚠️ ISSUES FOUND - Review detailed checks above'
  END as overall_status,
  no_negative_balances,
  no_null_balances,
  payment_math_ok,
  totals_match,
  all_backfilled
FROM quality_checks;

-- =====================================================
-- 10. ROLLBACK READINESS CHECK
-- =====================================================
-- Ensure decimal columns still exist and are in sync
SELECT
  'Rollback Ready' as check_type,
  COUNT(*) FILTER (WHERE ABS(balance * 100 - balance_cents) > 1) as out_of_sync_count,
  CASE
    WHEN COUNT(*) FILTER (WHERE ABS(balance * 100 - balance_cents) > 1) = 0
    THEN 'SAFE TO ROLLBACK'
    ELSE 'DECIMAL COLUMNS OUT OF SYNC'
  END as status
FROM token_balances
WHERE balance IS NOT NULL;