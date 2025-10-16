# Token System Hardening Patches

## Critical Changes to Apply

### 1. Update `/purchase` endpoint (Line 354-462)

Replace the entire `/purchase` endpoint with this idempotent, integer-safe version:

```javascript
// Purchase tokens - HARDENED VERSION
router.post('/purchase', authenticateToken, purchaseLimiter, async (req, res) => {
  const { tokenAmount, paymentMethodId, clientIdempotencyKey } = req.body;

  if (!tokenAmount || !paymentMethodId) {
    return res.status(400).json({
      error: 'Missing required fields: tokenAmount, paymentMethodId',
      timestamp: new Date().toISOString()
    });
  }

  // Validate as integer
  const amountTokens = parseInt(tokenAmount, 10);
  if (!Number.isInteger(amountTokens) || amountTokens <= 0) {
    return res.status(400).json({
      error: 'Invalid token amount - must be positive integer',
      timestamp: new Date().toISOString()
    });
  }

  if (!TOKEN_PRICES[amountTokens]) {
    return res.status(400).json({
      error: 'Invalid token amount',
      validAmounts: Object.keys(TOKEN_PRICES),
      timestamp: new Date().toISOString()
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const userResult = await client.query(
      'SELECT id FROM users WHERE supabase_id = $1',
      [req.user.supabase_id]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    const amountUsd = TOKEN_PRICES[amountTokens];
    const bonusTokens = amountTokens >= 5000 ? Math.floor(amountTokens * 0.05) : 0;
    const totalTokens = amountTokens + bonusTokens;

    // Generate stable idempotency key
    const idemKey = clientIdempotencyKey || crypto.randomBytes(16).toString('hex');

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amountUsd * 100),
      currency: 'usd',
      payment_method: paymentMethodId,
      confirmation_method: 'manual',
      confirm: true,
      return_url: process.env.FRONTEND_URL || 'http://localhost:3000',
      description: `Purchase of ${amountTokens} tokens${bonusTokens ? ` + ${bonusTokens} bonus` : ''}`,
      metadata: {
        userId: req.user.supabase_id,
        tokenAmount: String(amountTokens),
        bonusTokens: String(bonusTokens),
        clientIdempotencyKey: idemKey
      }
    });

    let status = paymentIntent.status === 'succeeded' ? 'completed' :
                 paymentIntent.status === 'requires_action' ? 'requires_action' :
                 paymentIntent.status === 'requires_payment_method' ? 'failed' : 'pending';

    // Insert transaction idempotently (ON CONFLICT DO NOTHING)
    const transactionResult = await client.query(
      `INSERT INTO token_transactions (
        user_id, type, tokens, amount_usd, bonus_tokens,
        stripe_payment_intent_id, client_idempotency_key, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (stripe_payment_intent_id) DO NOTHING
      RETURNING *`,
      [req.user.supabase_id, 'purchase', totalTokens, amountUsd, bonusTokens,
       paymentIntent.id, idemKey, status]
    );

    // If no rows returned, this purchase was already processed
    if (transactionResult.rows.length === 0) {
      await client.query('COMMIT');
      logger.info(`⏭️ Duplicate purchase blocked: ${paymentIntent.id}`);
      return res.json({
        success: true,
        message: 'Purchase already processed',
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          client_secret: paymentIntent.client_secret
        }
      });
    }

    // NOTE: We do NOT credit tokens here - webhook will be the source of truth
    // This prevents double-crediting on retries or 3DS flows

    await client.query('COMMIT');

    res.json({
      success: true,
      transaction: transactionResult.rows[0],
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        client_secret: paymentIntent.client_secret
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    logger.error('❌ Token purchase error:', error);
    res.status(500).json({
      error: 'Failed to process token purchase',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (client) client.release();
  }
});
```

### 2. Update `/tip` endpoint (Line 465-654)

Replace the tip endpoint with this race-proof version using row locking:

```javascript
// Send tip - HARDENED VERSION with row locking
router.post('/tip', authenticateToken, async (req, res) => {
  const { creatorId, tokenAmount, channel } = req.body;

  if (!creatorId || !tokenAmount || !channel) {
    return res.status(400).json({
      error: 'Missing required fields: creatorId, tokenAmount, channel',
      timestamp: new Date().toISOString()
    });
  }

  // Validate as integer
  const tip = parseInt(tokenAmount, 10);
  if (!Number.isInteger(tip) || tip < 1) {
    return res.status(400).json({
      error: 'Token amount must be a positive integer',
      timestamp: new Date().toISOString()
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Verify creator exists
    const creatorResult = await client.query(
      `SELECT id FROM users WHERE supabase_id = $1 AND is_creator = TRUE`,
      [creatorId]
    );

    if (creatorResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Creator not found',
        timestamp: new Date().toISOString()
      });
    }

    // 1) Lock fan's balance row (prevents concurrent tips)
    const lockResult = await client.query(
      `SELECT balance FROM token_balances
       WHERE user_id = $1 FOR UPDATE`,
      [req.user.supabase_id]
    );

    const currentBalance = parseInt(lockResult.rows[0]?.balance || 0, 10);

    // 2) Verify sufficient funds
    if (currentBalance < tip) {
      await client.query('ROLLBACK');
      return res.status(402).json({
        error: 'Insufficient token balance',
        currentBalance,
        requiredTokens: tip,
        timestamp: new Date().toISOString()
      });
    }

    // 3) Deduct atomically (only if sufficient funds)
    const deductResult = await client.query(
      `UPDATE token_balances
       SET balance = balance - $1, updated_at = NOW()
       WHERE user_id = $2 AND balance >= $1
       RETURNING balance`,
      [tip, req.user.supabase_id]
    );

    // 4) Safety check (should never happen due to lock, but defensive)
    if (deductResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(500).json({
        error: 'Balance update failed',
        timestamp: new Date().toISOString()
      });
    }

    // 5) Credit creator atomically
    const creditResult = await client.query(
      `INSERT INTO token_balances (user_id, balance, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         balance = token_balances.balance + $2,
         total_earned = COALESCE(token_balances.total_earned, 0) + $2,
         updated_at = NOW()
       RETURNING balance`,
      [creatorId, tip]
    );

    // 6) Record both ledger entries (fan debit, creator credit)
    const usdValue = tip * TOKEN_VALUE;

    await client.query(
      `INSERT INTO token_transactions (
        user_id, type, tokens, amount_usd, status, related_user_id, channel, created_at
      ) VALUES ($1, 'tip', $2, $3, 'completed', $4, $5, NOW())`,
      [req.user.supabase_id, -tip, usdValue, creatorId, channel]
    );

    await client.query(
      `INSERT INTO token_transactions (
        user_id, type, tokens, amount_usd, status, related_user_id, channel, created_at
      ) VALUES ($1, 'tip', $2, $3, 'completed', $4, $5, NOW())`,
      [creatorId, tip, usdValue, req.user.supabase_id, channel]
    );

    // 7) Update creator earnings
    await client.query(
      `UPDATE users SET total_earnings = total_earnings + $1, updated_at = NOW()
       WHERE supabase_id = $2`,
      [usdValue, creatorId]
    );

    // 8) Record earnings for payout system
    await client.query(
      `INSERT INTO creator_earnings (
        creator_id, earning_type, source_id, tokens_earned, usd_value, description, fan_id
      ) VALUES ($1, 'tip', $2, $3, $4, $5, $6)`,
      [creatorId, `tip_${Date.now()}`, tip, usdValue, `Tip received in ${channel}`, req.user.supabase_id]
    );

    await client.query('COMMIT');

    // Emit real-time balance updates
    const senderNewBalance = deductResult.rows[0].balance;
    const recipientNewBalance = creditResult.rows[0].balance;
    updateUserBalance(req.user.supabase_id, senderNewBalance);
    updateUserBalance(creatorId, recipientNewBalance);

    res.json({
      success: true,
      tokensDeducted: tip,
      usdValue,
      creatorId,
      channel,
      senderBalance: senderNewBalance,
      recipientBalance: recipientNewBalance,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    logger.error('❌ Tip processing error:', error);
    res.status(500).json({
      error: 'Failed to process tip',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (client) client.release();
  }
});
```

### 3. Apply Same Pattern to `/calls/deduct` (Line 657-832)

Use identical row locking pattern - replace balance check section:

```javascript
// Inside /calls/deduct endpoint, replace lines 698-773 with:

// 1) Lock fan's balance row
const lockResult = await client.query(
  `SELECT balance FROM token_balances
   WHERE user_id = $1 FOR UPDATE`,
  [req.user.supabase_id]
);

const currentBalance = parseInt(lockResult.rows[0]?.balance || 0, 10);

// 2) Verify sufficient funds
if (currentBalance < tokenAmount) {
  await client.query('ROLLBACK');
  return res.status(402).json({
    error: 'Insufficient token balance',
    currentBalance,
    requiredTokens: tokenAmount,
    timestamp: new Date().toISOString()
  });
}

// 3) Deduct atomically
const deductResult = await client.query(
  `UPDATE token_balances
   SET balance = balance - $1, updated_at = NOW()
   WHERE user_id = $2 AND balance >= $1
   RETURNING balance`,
  [tokenAmount, req.user.supabase_id]
);

if (deductResult.rows.length === 0) {
  await client.query('ROLLBACK');
  return res.status(500).json({ error: 'Balance update failed' });
}

// 4) Credit creator atomically
await client.query(
  `INSERT INTO token_balances (user_id, balance, updated_at)
   VALUES ($1, $2, NOW())
   ON CONFLICT (user_id)
   DO UPDATE SET balance = token_balances.balance + $2, updated_at = NOW()`,
  [creatorResult.rows[0].supabase_id, tokenAmount]
);

// Continue with ledger entries...
```

## Deployment Checklist

1. ✅ Run migration `142_token_system_hardening.sql`
2. ✅ Update `routes/tokens.js` with hardened `/purchase` endpoint
3. ✅ Update `routes/tokens.js` with hardened `/tip` endpoint
4. ✅ Update `routes/tokens.js` with hardened `/calls/deduct` endpoint
5. ⏳ Update `routes/payments.js` webhook handler (see separate patch)
6. ⏳ Test concurrency scenarios
7. ⏳ Deploy to production

## Notes

- All token amounts now stored/processed as integers (BIGINT)
- Idempotency enforced at database level
- Row locking prevents race conditions
- Webhook will be source of truth for crediting (next patch)
- Frontend will refetch balance on websocket event for accuracy
