-- Post-Migration Verification SQL
-- Date: 2025-09-18
-- Purpose: Verify database integrity after applying critical fixes
-- Run in Supabase SQL Editor or psql

-- ============================================
-- 1. IDENTITY VERIFICATION
-- ============================================
\echo '========== IDENTITY VERIFICATION =========='

-- Check for users without supabase_id
SELECT COUNT(*) AS "Users missing supabase_id"
FROM users
WHERE supabase_id IS NULL;

-- Check for duplicate supabase_ids (should be 0)
SELECT COUNT(*) AS "Duplicate supabase_ids"
FROM (
  SELECT supabase_id, COUNT(*) AS cnt
  FROM users
  WHERE supabase_id IS NOT NULL
  GROUP BY supabase_id
  HAVING COUNT(*) > 1
) duplicates;

-- Check role distribution
SELECT
  role,
  COUNT(*) AS count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS percentage
FROM users
GROUP BY role
ORDER BY count DESC;

-- ============================================
-- 2. FOREIGN KEY INTEGRITY
-- ============================================
\echo '========== FOREIGN KEY INTEGRITY =========='

-- Check orphaned token_balances
SELECT COUNT(*) AS "Orphan token_balances"
FROM token_balances tb
WHERE NOT EXISTS (
  SELECT 1 FROM users u
  WHERE u.supabase_id = tb.user_id
     OR u.id::text = tb.user_id
);

-- Check orphaned payments
SELECT COUNT(*) AS "Orphan payments"
FROM payments p
WHERE p.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM users u
    WHERE u.supabase_id = p.user_id
       OR u.id::text = p.user_id
  );

-- Check orphaned sessions (by creator)
SELECT COUNT(*) AS "Orphan sessions (creator)"
FROM sessions s
WHERE s.creator_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = s.creator_id
  );

-- Check orphaned sessions (by fan)
SELECT COUNT(*) AS "Orphan sessions (fan)"
FROM sessions s
WHERE s.fan_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = s.fan_id
  );

-- ============================================
-- 3. MONEY COLUMNS VERIFICATION
-- ============================================
\echo '========== MONEY COLUMNS VERIFICATION =========='

-- Check for negative money values in users
SELECT
  SUM(CASE WHEN video_rate_cents < 0 THEN 1 ELSE 0 END) AS "Negative video rates",
  SUM(CASE WHEN voice_rate_cents < 0 THEN 1 ELSE 0 END) AS "Negative voice rates",
  SUM(CASE WHEN stream_rate_cents < 0 THEN 1 ELSE 0 END) AS "Negative stream rates",
  SUM(CASE WHEN message_price_cents < 0 THEN 1 ELSE 0 END) AS "Negative message prices"
FROM users
WHERE video_rate_cents IS NOT NULL
   OR voice_rate_cents IS NOT NULL
   OR stream_rate_cents IS NOT NULL
   OR message_price_cents IS NOT NULL;

-- Check sessions money columns
SELECT
  SUM(CASE WHEN rate_per_minute_cents < 0 THEN 1 ELSE 0 END) AS "Negative session rates",
  SUM(CASE WHEN total_cost_cents < 0 THEN 1 ELSE 0 END) AS "Negative session costs"
FROM sessions
WHERE rate_per_minute_cents IS NOT NULL
   OR total_cost_cents IS NOT NULL;

-- Check payments money columns
SELECT
  SUM(CASE WHEN amount_cents <= 0 THEN 1 ELSE 0 END) AS "Invalid payment amounts"
FROM payments
WHERE amount_cents IS NOT NULL;

-- ============================================
-- 4. RECENT DATA SAMPLES
-- ============================================
\echo '========== RECENT DATA SAMPLES =========='

-- Recent users with new columns
SELECT
  substring(supabase_id::text, 1, 8) || '...' AS supabase_id,
  email,
  role,
  is_creator,
  token_balance,
  to_char(created_at, 'YYYY-MM-DD') AS created
FROM users
ORDER BY created_at DESC
LIMIT 5;

-- Recent payments with idempotency
SELECT
  substring(id::text, 1, 8) || '...' AS payment_id,
  amount_cents,
  status,
  CASE WHEN idempotency_key IS NOT NULL THEN 'Yes' ELSE 'No' END AS has_idempotency,
  to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created
FROM payments
ORDER BY created_at DESC
LIMIT 5;

-- Recent sessions with cents columns
SELECT
  substring(id::text, 1, 8) || '...' AS session_id,
  type,
  status,
  rate_per_minute_cents,
  total_cost_cents,
  duration_minutes
FROM sessions
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 5;

-- ============================================
-- 5. WEBHOOK DEDUPLICATION
-- ============================================
\echo '========== WEBHOOK DEDUPLICATION =========='

-- Check webhook events table
SELECT
  COUNT(*) AS total_events,
  COUNT(DISTINCT stripe_event_id) AS unique_events,
  COUNT(*) - COUNT(DISTINCT stripe_event_id) AS duplicates_prevented
FROM stripe_webhook_events;

-- Webhook event types distribution
SELECT
  type,
  COUNT(*) AS count,
  MAX(received_at) AS last_received
FROM stripe_webhook_events
GROUP BY type
ORDER BY count DESC
LIMIT 10;

-- ============================================
-- 6. INDEX VERIFICATION
-- ============================================
\echo '========== INDEX VERIFICATION =========='

-- Check for critical indexes
SELECT
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    indexname LIKE '%supabase_id%'
    OR indexname LIKE '%role%'
    OR indexname LIKE '%idempotency%'
    OR indexname LIKE '%request_id%'
    OR indexname LIKE '%stripe_event_id%'
  )
ORDER BY tablename, indexname;

-- ============================================
-- 7. ENUM TYPES VERIFICATION
-- ============================================
\echo '========== ENUM TYPES =========='

-- List all custom enum types
SELECT
  typname AS enum_name,
  array_agg(enumlabel ORDER BY enumsortorder) AS values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
GROUP BY typname
ORDER BY typname;

-- ============================================
-- 8. SUMMARY STATISTICS
-- ============================================
\echo '========== SUMMARY STATISTICS =========='

-- Overall system health metrics
WITH stats AS (
  SELECT
    (SELECT COUNT(*) FROM users) AS total_users,
    (SELECT COUNT(*) FROM users WHERE role = 'creator' OR is_creator = true) AS creators,
    (SELECT COUNT(*) FROM users WHERE role = 'admin' OR is_admin = true OR is_super_admin = true) AS admins,
    (SELECT COUNT(*) FROM payments WHERE created_at > NOW() - INTERVAL '30 days') AS recent_payments,
    (SELECT COUNT(*) FROM sessions WHERE created_at > NOW() - INTERVAL '30 days') AS recent_sessions,
    (SELECT COUNT(*) FROM stripe_webhook_events) AS webhook_events,
    (SELECT COALESCE(SUM(amount_cents), 0) / 100 FROM payments WHERE status = 'completed' AND created_at > NOW() - INTERVAL '30 days') AS revenue_30d
)
SELECT
  'Total Users' AS metric,
  total_users::text AS value
FROM stats
UNION ALL
SELECT 'Creators', creators::text FROM stats
UNION ALL
SELECT 'Admins', admins::text FROM stats
UNION ALL
SELECT 'Payments (30d)', recent_payments::text FROM stats
UNION ALL
SELECT 'Sessions (30d)', recent_sessions::text FROM stats
UNION ALL
SELECT 'Webhook Events', webhook_events::text FROM stats
UNION ALL
SELECT 'Revenue (30d)', '$' || revenue_30d::numeric(10,2) FROM stats;

\echo '=========================================='
\echo 'Verification complete! Check results above.'
\echo '==========================================