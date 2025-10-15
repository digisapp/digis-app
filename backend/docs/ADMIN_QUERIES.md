# Payout System Admin Queries

Quick reference SQL queries for monitoring and managing the twice-monthly payout system.

## Monitoring Queries

### Who's queued for the next run?

```sql
SELECT
  u.display_name,
  u.email,
  i.user_id,
  i.cycle_date,
  i.status,
  i.created_at
FROM creator_payout_intents i
JOIN users u ON u.supabase_id = i.user_id
WHERE i.cycle_date = '2025-11-01'  -- Replace with target cycle date
  AND i.status = 'pending'
ORDER BY i.created_at DESC;
```

### Payout run status

```sql
SELECT
  pr.id,
  pr.cycle_date,
  pr.status,
  pr.started_at,
  pr.finished_at,
  COUNT(cp.id) as total_payouts,
  SUM(CASE WHEN cp.status = 'paid' THEN 1 ELSE 0 END) as paid_count,
  SUM(CASE WHEN cp.status = 'failed' THEN 1 ELSE 0 END) as failed_count,
  SUM(CASE WHEN cp.status = 'skipped' THEN 1 ELSE 0 END) as skipped_count,
  SUM(cp.net_payout_amount) as total_amount
FROM payout_runs pr
LEFT JOIN creator_payouts cp ON cp.run_id = pr.id
WHERE pr.cycle_date = '2025-11-01'  -- Replace with target cycle date
GROUP BY pr.id;
```

### Skipped payouts breakdown

```sql
SELECT
  skip_reason,
  COUNT(*) as count,
  SUM(gross_amount) as total_amount
FROM creator_payouts
WHERE status = 'skipped'
  AND payout_period_end >= NOW() - INTERVAL '30 days'
GROUP BY skip_reason
ORDER BY count DESC;
```

### Failed payouts needing attention

```sql
SELECT
  u.display_name,
  u.email,
  cp.net_payout_amount,
  cp.failure_reason,
  cp.created_at,
  sa.stripe_account_id
FROM creator_payouts cp
JOIN users u ON u.supabase_id = cp.creator_id
JOIN creator_stripe_accounts sa ON sa.creator_id = cp.creator_id
WHERE cp.status = 'failed'
  AND cp.created_at > NOW() - INTERVAL '7 days'
ORDER BY cp.created_at DESC;
```

### Stuck payout runs

```sql
SELECT
  id,
  cycle_date,
  status,
  started_at,
  EXTRACT(EPOCH FROM (NOW() - started_at)) / 60 as minutes_running
FROM payout_runs
WHERE status = 'running'
  AND started_at < NOW() - INTERVAL '1 hour'
ORDER BY started_at ASC;
```

### Creator payout eligibility

```sql
SELECT
  u.display_name,
  u.email,
  sa.stripe_account_id,
  sa.payouts_enabled,
  sa.charges_enabled,
  sa.account_status,
  b.available[1]->>'amount' as available_balance_cents
FROM users u
JOIN creator_stripe_accounts sa ON sa.creator_id = u.supabase_id
LEFT JOIN LATERAL (
  -- This would need actual Stripe API call, shown as example
  SELECT jsonb_build_array(jsonb_build_object('amount', 5000)) as available
) b ON true
WHERE u.is_creator = true
  AND sa.payouts_enabled = true
ORDER BY u.display_name;
```

## Admin Operations

### Force-set intent for a creator (VIP support)

```sql
INSERT INTO creator_payout_intents (user_id, cycle_date, status, created_at, updated_at)
VALUES (
  'creator_supabase_id',  -- Replace with actual user ID
  '2025-11-01',            -- Replace with target cycle date
  'pending',
  NOW(),
  NOW()
)
ON CONFLICT (user_id, cycle_date)
DO UPDATE SET
  status = 'pending',
  updated_at = NOW();
```

### Cancel intent for a creator

```sql
UPDATE creator_payout_intents
SET status = 'canceled', updated_at = NOW()
WHERE user_id = 'creator_supabase_id'  -- Replace with actual user ID
  AND cycle_date = '2025-11-01'         -- Replace with target cycle date
  AND status = 'pending';
```

### View creator's recent payout history

```sql
SELECT
  cp.payout_period_start,
  cp.payout_period_end,
  cp.gross_amount,
  cp.net_payout_amount,
  cp.status,
  cp.skip_reason,
  cp.failure_reason,
  cp.stripe_payout_id,
  cp.paid_at,
  cp.created_at
FROM creator_payouts cp
WHERE cp.creator_id = 'creator_supabase_id'  -- Replace with actual user ID
ORDER BY cp.created_at DESC
LIMIT 10;
```

### Manually mark payout as paid (emergency)

```sql
UPDATE creator_payouts
SET
  status = 'paid',
  paid_at = NOW(),
  updated_at = NOW()
WHERE id = 'payout_id'  -- Replace with actual payout ID
  AND status = 'processing';
```

## Analytics Queries

### Payout volume by month

```sql
SELECT
  DATE_TRUNC('month', payout_period_end) as month,
  COUNT(*) as payout_count,
  SUM(net_payout_amount) as total_paid,
  AVG(net_payout_amount) as avg_payout,
  COUNT(DISTINCT creator_id) as unique_creators
FROM creator_payouts
WHERE status = 'paid'
  AND payout_period_end >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', payout_period_end)
ORDER BY month DESC;
```

### Intent adoption rate

```sql
WITH cycles AS (
  SELECT DISTINCT cycle_date
  FROM payout_runs
  WHERE cycle_date >= NOW() - INTERVAL '90 days'
),
eligible_creators AS (
  SELECT COUNT(DISTINCT creator_id) as count
  FROM creator_stripe_accounts
  WHERE payouts_enabled = true
    AND account_status = 'active'
)
SELECT
  c.cycle_date,
  COUNT(i.id) as intents_set,
  e.count as eligible_creators,
  ROUND(100.0 * COUNT(i.id) / e.count, 2) as adoption_rate_percent
FROM cycles c
CROSS JOIN eligible_creators e
LEFT JOIN creator_payout_intents i ON i.cycle_date = c.cycle_date AND i.status != 'canceled'
GROUP BY c.cycle_date, e.count
ORDER BY c.cycle_date DESC;
```

### Top earners (last 30 days)

```sql
SELECT
  u.display_name,
  u.email,
  COUNT(cp.id) as payout_count,
  SUM(cp.net_payout_amount) as total_earned,
  MAX(cp.paid_at) as last_payout
FROM creator_payouts cp
JOIN users u ON u.supabase_id = cp.creator_id
WHERE cp.status = 'paid'
  AND cp.paid_at >= NOW() - INTERVAL '30 days'
GROUP BY u.supabase_id, u.display_name, u.email
ORDER BY total_earned DESC
LIMIT 20;
```

## Troubleshooting Queries

### Find missing intents (creators with balance but no intent)

```sql
-- Note: This requires joining with Stripe balance data
-- Shown as conceptual query
SELECT
  u.display_name,
  u.email,
  sa.stripe_account_id
FROM users u
JOIN creator_stripe_accounts sa ON sa.creator_id = u.supabase_id
LEFT JOIN creator_payout_intents i ON i.user_id = u.supabase_id
  AND i.cycle_date = '2025-11-01'  -- Next cycle
WHERE u.is_creator = true
  AND sa.payouts_enabled = true
  AND i.id IS NULL;
```

### Audit payout intent changes

```sql
-- If you add an audit log table, query would look like:
SELECT
  u.display_name,
  al.action,
  al.old_value,
  al.new_value,
  al.changed_by,
  al.changed_at
FROM audit_log al
JOIN users u ON u.supabase_id = al.user_id
WHERE al.table_name = 'creator_payout_intents'
  AND al.record_id = 'intent_id'
ORDER BY al.changed_at DESC;
```

## Performance Monitoring

### Slow payout queries

```sql
-- Enable pg_stat_statements extension first
-- Then query slow queries related to payouts
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE query LIKE '%creator_payout%'
  OR query LIKE '%payout_intent%'
ORDER BY total_time DESC
LIMIT 20;
```

### Table sizes

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
FROM pg_tables
WHERE tablename IN ('creator_payouts', 'creator_payout_intents', 'payout_runs', 'creator_stripe_accounts')
ORDER BY size_bytes DESC;
```

## cURL Examples

### Set intent (as creator)

```bash
curl -H "Authorization: Bearer <creator_jwt>" \
  -X POST \
  https://api.digis.cc/api/creator-payouts/intent
```

### Cancel intent (as creator)

```bash
curl -H "Authorization: Bearer <creator_jwt>" \
  -X DELETE \
  https://api.digis.cc/api/creator-payouts/intent
```

### Check intent status (as creator)

```bash
curl -H "Authorization: Bearer <creator_jwt>" \
  https://api.digis.cc/api/creator-payouts/intent
```

### Trigger payout run (cron-protected)

```bash
curl -H "X-Cron-Secret: $CRON_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"cycleDate":"2025-11-01"}' \
  -X POST \
  https://api.digis.cc/internal/payouts/run
```

### Check run status (cron-protected)

```bash
curl -H "X-Cron-Secret: $CRON_SECRET_KEY" \
  https://api.digis.cc/internal/payouts/status/{runId}
```

### Health check (cron-protected)

```bash
curl -H "X-Cron-Secret: $CRON_SECRET_KEY" \
  https://api.digis.cc/internal/payouts/health
```

## Alerts to Set Up

Create alerts for these conditions:

1. **Stuck runs**: `payout_runs.status = 'running' AND started_at < NOW() - INTERVAL '1 hour'`
2. **High failure rate**: `>= 5% of payouts failed in last run`
3. **No intents**: `< 10% of eligible creators set intent 24h before cycle`
4. **Webhook delays**: Stripe webhook not received within 15 min of payout creation
5. **Balance anomalies**: Creator available balance < payout amount attempted

## Data Retention Policy

```sql
-- Archive old payout runs (keep last 12 months)
DELETE FROM payout_runs
WHERE cycle_date < NOW() - INTERVAL '12 months'
  AND status IN ('succeeded', 'partial');

-- Archive consumed intents (keep last 6 months)
DELETE FROM creator_payout_intents
WHERE status = 'consumed'
  AND updated_at < NOW() - INTERVAL '6 months';
```
