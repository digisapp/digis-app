-- =====================================================
-- Migration: Backfill cents columns from decimals
-- Phase B: Safe batch updates to avoid long locks
-- =====================================================

-- Function to safely backfill in batches
CREATE OR REPLACE FUNCTION backfill_cents_batch(
  p_table_name TEXT,
  p_id_column TEXT,
  p_decimal_column TEXT,
  p_cents_column TEXT,
  p_batch_size INT DEFAULT 10000
) RETURNS TEXT AS $$
DECLARE
  v_updated INT;
  v_total INT := 0;
  v_sql TEXT;
BEGIN
  LOOP
    -- Build dynamic SQL for batch update
    v_sql := format(
      'UPDATE %I SET %I = ROUND(COALESCE(%I, 0) * 100)
       WHERE %I = 0 AND %I IS NOT NULL
         AND %I IN (
           SELECT %I FROM %I
           WHERE %I = 0 AND %I IS NOT NULL
           LIMIT %s
         )',
      p_table_name, p_cents_column, p_decimal_column,
      p_cents_column, p_decimal_column,
      p_id_column,
      p_id_column, p_table_name,
      p_cents_column, p_decimal_column,
      p_batch_size
    );

    EXECUTE v_sql;
    GET DIAGNOSTICS v_updated = ROW_COUNT;

    v_total := v_total + v_updated;

    IF v_updated = 0 THEN
      EXIT;
    END IF;

    -- Brief pause to reduce load
    PERFORM pg_sleep(0.05);
  END LOOP;

  RETURN format('Updated %s rows in %s', v_total, p_table_name);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Execute backfills
-- =====================================================

DO $$
DECLARE
  v_result TEXT;
BEGIN
  -- 1. Token balances
  v_result := backfill_cents_batch('token_balances', 'user_id', 'balance', 'balance_cents');
  RAISE NOTICE '%', v_result;

  -- 2. Users table
  v_result := backfill_cents_batch('users', 'id', 'token_balance', 'token_balance_cents');
  RAISE NOTICE '%', v_result;

  v_result := backfill_cents_batch('users', 'id', 'total_earnings', 'total_earnings_cents');
  RAISE NOTICE '%', v_result;

  v_result := backfill_cents_batch('users', 'id', 'pending_earnings', 'pending_earnings_cents');
  RAISE NOTICE '%', v_result;

  v_result := backfill_cents_batch('users', 'id', 'lifetime_earnings', 'lifetime_earnings_cents');
  RAISE NOTICE '%', v_result;

  -- 3. Token transactions
  UPDATE token_transactions
  SET amount_cents = ROUND(COALESCE(amount, 0) * 100)
  WHERE amount_cents = 0 AND amount IS NOT NULL;

  UPDATE token_transactions
  SET balance_after_cents = ROUND(COALESCE(balance_after, 0) * 100)
  WHERE balance_after_cents IS NULL AND balance_after IS NOT NULL;

  -- 4. Tips
  UPDATE tips
  SET tip_amount_cents = ROUND(COALESCE(amount, 0) * 100)
  WHERE tip_amount_cents = 0 AND amount IS NOT NULL;

  -- 5. Payments (handle fee/net calculation)
  UPDATE payments
  SET
    amount_cents = ROUND(COALESCE(amount, 0) * 100),
    fee_cents = ROUND(COALESCE(fee, 0) * 100),
    net_cents = ROUND(COALESCE(net, COALESCE(amount, 0) - COALESCE(fee, 0)) * 100)
  WHERE amount_cents = 0;

  -- 6. Creator earnings
  UPDATE creator_earnings
  SET usd_value_cents = ROUND(COALESCE(usd_value, 0) * 100)
  WHERE usd_value_cents = 0 AND usd_value IS NOT NULL;

  -- 7. Creator payouts
  UPDATE creator_payouts
  SET
    amount_cents = ROUND(COALESCE(amount, 0) * 100),
    fee_cents = ROUND(COALESCE(fee, 0) * 100),
    net_amount_cents = ROUND(COALESCE(net_amount, COALESCE(amount, 0) - COALESCE(fee, 0)) * 100)
  WHERE amount_cents = 0;

  -- 8. Subscription plans
  UPDATE subscription_plans
  SET price_cents = ROUND(COALESCE(price, 0) * 100)
  WHERE price_cents = 0 AND price IS NOT NULL;

  -- 9. Membership tiers
  UPDATE membership_tiers
  SET price_cents = ROUND(COALESCE(price, 0) * 100)
  WHERE price_cents = 0 AND price IS NOT NULL;

  -- 10. Offers
  UPDATE offers
  SET
    price_cents = ROUND(COALESCE(price, 0) * 100),
    discount_price_cents = ROUND(COALESCE(discount_price, 0) * 100)
  WHERE price_cents = 0 AND price IS NOT NULL;

  -- 11. Shop items
  UPDATE shop_items
  SET
    price_cents = ROUND(COALESCE(price, 0) * 100),
    cost_cents = ROUND(COALESCE(cost, 0) * 100)
  WHERE price_cents = 0 AND price IS NOT NULL;

  -- 12. Virtual gifts
  UPDATE virtual_gifts
  SET price_cents = ROUND(COALESCE(price, 0) * 100)
  WHERE price_cents = 0 AND price IS NOT NULL;

  -- 13. Ticketed shows
  UPDATE ticketed_shows
  SET
    ticket_price_cents = ROUND(COALESCE(ticket_price, 0) * 100),
    vip_price_cents = ROUND(COALESCE(vip_price, 0) * 100)
  WHERE ticket_price_cents = 0;

  -- 14. Streams
  UPDATE streams
  SET
    video_rate_cents = ROUND(COALESCE(video_rate, 0) * 100),
    voice_rate_cents = ROUND(COALESCE(voice_rate, 0) * 100),
    total_earnings_cents = ROUND(COALESCE(total_earnings, 0) * 100)
  WHERE total_earnings_cents = 0;

  -- 15. Withdrawals
  UPDATE withdrawals
  SET
    amount_cents = ROUND(COALESCE(amount, 0) * 100),
    fee_cents = ROUND(COALESCE(fee, 0) * 100),
    net_amount_cents = ROUND(COALESCE(net_amount, COALESCE(amount, 0) - COALESCE(fee, 0)) * 100)
  WHERE amount_cents = 0;

  -- 16. PPV messages
  UPDATE ppv_messages
  SET price_cents = ROUND(COALESCE(price, 0) * 100)
  WHERE price_cents = 0 AND price IS NOT NULL;

  -- 17. Live shopping purchases
  UPDATE live_shopping_purchases
  SET
    total_price_cents = ROUND(COALESCE(total_price, 0) * 100),
    discount_amount_cents = ROUND(COALESCE(discount_amount, 0) * 100)
  WHERE total_price_cents = 0;

  -- 18. VOD purchases
  UPDATE vod_purchases
  SET purchase_price_cents = ROUND(COALESCE(purchase_price, 0) * 100)
  WHERE purchase_price_cents = 0 AND purchase_price IS NOT NULL;

  RAISE NOTICE 'All backfills completed successfully';
END $$;

-- Drop the temporary function
DROP FUNCTION IF EXISTS backfill_cents_batch(TEXT, TEXT, TEXT, TEXT, INT);

-- =====================================================
-- Verification
-- =====================================================

-- Check for any remaining zero cents where decimals exist
SELECT
  'token_balances' as table_name,
  COUNT(*) as rows_to_fix
FROM token_balances
WHERE balance_cents = 0 AND balance > 0
UNION ALL
SELECT
  'users',
  COUNT(*)
FROM users
WHERE token_balance_cents = 0 AND token_balance > 0
UNION ALL
SELECT
  'payments',
  COUNT(*)
FROM payments
WHERE amount_cents = 0 AND amount > 0
UNION ALL
SELECT
  'tips',
  COUNT(*)
FROM tips
WHERE tip_amount_cents = 0 AND amount > 0;