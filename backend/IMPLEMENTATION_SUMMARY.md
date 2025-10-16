# Token System Hardening - Implementation Summary

## ✅ Completed

### 1. Migration File Created
**File**: `backend/migrations/142_token_system_hardening.sql`

**Changes**:
- ✅ Convert `token_balances` columns to `BIGINT` (balance, total_purchased, total_spent, total_earned)
- ✅ Convert `token_transactions.tokens` and `token_transactions.bonus_tokens` to `BIGINT`
- ✅ Add `stripe_payment_intent_id` column to `token_transactions`
- ✅ Add `client_idempotency_key` column to `token_transactions`
- ✅ Add `related_user_id` column to `token_transactions` (for tracking transfers)
- ✅ Add UNIQUE constraint on `stripe_payment_intent_id` (prevents double-crediting)
- ✅ Add UNIQUE INDEX on `client_idempotency_key` (for non-Stripe transactions)
- ✅ Add `account_status` and `debt_amount` columns to `users` (for chargeback handling)
- ✅ Add performance indexes
- ✅ Enforce non-negative balance constraint

### 2. Patch Documentation Created
**File**: `backend/PATCH_tokens_hardening.md`

**Contains**:
- ✅ Complete replacement code for `/purchase` endpoint (idempotent, integer-safe)
- ✅ Complete replacement code for `/tip` endpoint (row-locking, race-proof)
- ✅ Guidance for updating `/calls/deduct` endpoint
- ✅ Deployment checklist

---

## ⏳ Remaining Implementation Work

### Step 1: Run Migration
```bash
cd backend
# Test on local/dev database first
psql $DATABASE_URL < migrations/142_token_system_hardening.sql

# Verify schema changes
psql $DATABASE_URL -c "\d token_balances"
psql $DATABASE_URL -c "\d token_transactions"
```

### Step 2: Update Routes (Manual Application Required)

Due to file size constraints, you'll need to manually apply the changes from `PATCH_tokens_hardening.md`:

**File to Edit**: `backend/routes/tokens.js`

**Sections to Replace**:

1. **Lines 354-462**: `/purchase` endpoint
   - Copy the hardened version from patch file
   - Adds: integer validation, idempotency via ON CONFLICT, clientIdempotencyKey support
   - Removes: immediate token crediting (webhook will handle this)

2. **Lines 465-654**: `/tip` endpoint
   - Copy the hardened version from patch file
   - Adds: FOR UPDATE row locking, atomic deduct+credit, related_user_id tracking

3. **Lines 657-832**: `/calls/deduct` endpoint
   - Apply the row locking pattern shown in patch
   - Similar changes as tip endpoint

4. **Lines 1543-1727**: `/gift` endpoint
   - Apply same row locking pattern
   - Lock sender balance before deducting

### Step 3: Update Webhook Handler

**File to Edit**: `backend/routes/payments.js`

**Add to webhook switch statement** (around line 542):

```javascript
case 'payment_intent.succeeded': {
  const pi = event.data.object;
  const userId = pi.metadata?.userId;
  const tokenAmount = parseInt(pi.metadata?.tokenAmount || '0', 10);
  const bonusTokens = parseInt(pi.metadata?.bonusTokens || '0', 10);
  const total = tokenAmount + bonusTokens;

  if (!userId || !Number.isInteger(total) || total <= 0) break;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Record purchase (idempotent by PI id)
    const tx = await client.query(
      `INSERT INTO token_transactions (
         user_id, type, tokens, amount_usd, bonus_tokens,
         stripe_payment_intent_id, status, created_at
       ) VALUES ($1,'purchase',$2,$3,$4,$5,'completed',NOW())
       ON CONFLICT (stripe_payment_intent_id) DO NOTHING
       RETURNING id`,
      [userId, total, pi.amount_received / 100, bonusTokens, pi.id]
    );

    if (tx.rowCount > 0) {
      // Credit balance once
      await client.query(
        `INSERT INTO token_balances (user_id, balance, total_purchased, updated_at)
         VALUES ($1,$2,$2,NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET
           balance = token_balances.balance + EXCLUDED.balance,
           total_purchased = token_balances.total_purchased + EXCLUDED.total_purchased,
           updated_at = NOW()`,
        [userId, total]
      );

      // Broadcast balance update
      updateUserBalance(userId);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PI succeeded webhook error:', err);
  } finally {
    client.release();
  }
  break;
}

case 'charge.refunded':
case 'payment_intent.refunded': {
  const obj = event.data.object;
  const piId = obj.payment_intent || obj.id;
  const tokensPurchased = parseInt((obj.metadata?.tokenAmount) || '0', 10);
  const userId = obj.metadata?.userId;

  if (!piId || !tokensPurchased || !userId) break;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock balance row
    const bal = await client.query(
      `SELECT balance FROM token_balances WHERE user_id = $1 FOR UPDATE`,
      [userId]
    );
    const current = parseInt(bal.rows[0]?.balance || 0, 10);

    if (current >= tokensPurchased) {
      // Sufficient balance - deduct tokens
      await client.query(
        `UPDATE token_balances SET balance = balance - $1, updated_at = NOW()
         WHERE user_id = $2`,
        [tokensPurchased, userId]
      );
      await client.query(
        `INSERT INTO token_transactions (
           user_id, type, tokens, amount_usd, stripe_payment_intent_id, status, created_at
         ) VALUES ($1,'refund',$2,$3,$4,'completed',NOW())`,
        [userId, -tokensPurchased, -(obj.amount_refunded || obj.amount) / 100, piId]
      );
    } else {
      // Insufficient balance - mark debt
      const shortage = tokensPurchased - current;
      await client.query(
        `UPDATE users SET account_status = 'debt', debt_amount = debt_amount + $1, updated_at = NOW()
         WHERE supabase_id = $2`,
        [shortage, userId]
      );
      await client.query(
        `UPDATE token_balances SET balance = 0, updated_at = NOW() WHERE user_id = $1`,
        [userId]
      );
      console.error(`🚨 Refund debt: User ${userId} owes ${shortage} tokens`);
    }

    await client.query('COMMIT');
    updateUserBalance(userId);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Refund webhook error:', err);
  } finally {
    client.release();
  }
  break;
}
```

### Step 4: Update Frontend (Optional but Recommended)

**File**: `frontend/src/components/ImprovedTokenPurchase.js`

**Add client idempotency key** (around line 125):

```javascript
// Generate client idempotency key
const clientIdempotencyKey = crypto.randomBytes(16).toString('hex');

const response = await fetchWithRetry(
  `${import.meta.env.VITE_BACKEND_URL}/api/tokens/purchase`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await getAuthToken()}`,
    },
    body: JSON.stringify({
      tokenAmount: selectedPackage.tokens,
      paymentMethodId: paymentMethod.id,
      clientIdempotencyKey,  // ← Add this
      isGift,
      giftRecipientId: giftRecipient?.uid,
    }),
  },
  3,
  1000
);
```

**Update balance display** (all wallet components):

```javascript
// Display as integer, not decimal
<span className="text-2xl font-bold">
  {tokenBalance.toLocaleString()} tokens
</span>
<span className="text-sm text-gray-500">
  ≈ ${(tokenBalance * 0.05).toFixed(2)} USD
</span>
```

---

## 🧪 Testing Checklist

Once changes are deployed:

### 1. Idempotency Test
```bash
# Make same purchase request twice with same idempotency key
# Expected: Second request returns "Purchase already processed"
# Balance increases only once
```

### 2. Concurrency Test
```javascript
// Open two browser tabs
// User balance: 500 tokens
// Tab 1: Send 300 token tip
// Tab 2: Send 300 token tip (at exact same time)
// Expected: One succeeds (balance → 200), one fails "Insufficient balance"
```

### 3. 3D Secure Test
```javascript
// Use test card that requires 3DS: 4000 0027 6000 3184
// Expected:
// - Initial response: requires_action
// - Complete 3DS challenge
// - Webhook credits tokens exactly once
// - Balance updates correctly
```

### 4. Refund Test (Sufficient Balance)
```javascript
// 1. Purchase 500 tokens
// 2. Refund via Stripe dashboard
// Expected:
// - Webhook deducts 500 tokens
// - Balance decreases
// - Transaction logged as 'refund'
```

### 5. Refund Test (Insufficient Balance)
```javascript
// 1. Purchase 500 tokens
// 2. Spend 400 tokens on tips
// 3. Refund original purchase
// Expected:
// - Balance goes to 0
// - User account_status → 'debt'
// - User debt_amount → 400
// - Admin alerted
```

### 6. Parallel Spending Test
```javascript
// Balance: 1000 tokens
// Send 3 concurrent requests:
// - Tip 400 tokens
// - Call charge 400 tokens
// - Gift 400 tokens
// Expected: First request succeeds, others fail with "Insufficient balance"
```

---

## 📊 Monitoring

After deployment, monitor these metrics:

1. **Token Purchase Success Rate**
   ```sql
   SELECT status, COUNT(*)
   FROM token_transactions
   WHERE type = 'purchase' AND created_at > NOW() - INTERVAL '1 day'
   GROUP BY status;
   ```

2. **Idempotency Blocks (Should be rare)**
   ```bash
   grep "Duplicate purchase blocked" backend/logs/app.log
   ```

3. **Race Condition Catches (Balance update failures)**
   ```sql
   SELECT COUNT(*)
   FROM token_transactions
   WHERE status = 'failed' AND created_at > NOW() - INTERVAL '1 day';
   ```

4. **Outstanding Debt (Chargebacks)**
   ```sql
   SELECT supabase_id, debt_amount
   FROM users
   WHERE account_status = 'debt';
   ```

5. **Balance Reconciliation**
   ```sql
   -- Compare balance table vs transaction ledger
   SELECT
     tb.user_id,
     tb.balance as stored_balance,
     COALESCE(SUM(tt.tokens), 0) as calculated_balance,
     tb.balance - COALESCE(SUM(tt.tokens), 0) as drift
   FROM token_balances tb
   LEFT JOIN token_transactions tt ON tt.user_id = tb.user_id
   GROUP BY tb.user_id, tb.balance
   HAVING tb.balance <> COALESCE(SUM(tt.tokens), 0);
   ```

---

## 🚨 Rollback Plan

If issues arise:

### Immediate Rollback (Code Only)
```bash
git revert <commit-hash>
git push
# Redeploy previous version
```

### Full Rollback (Including Schema)
```sql
-- ONLY IF NECESSARY - will lose data from new columns
BEGIN;

-- Remove new columns
ALTER TABLE token_transactions
  DROP COLUMN IF EXISTS stripe_payment_intent_id,
  DROP COLUMN IF EXISTS client_idempotency_key,
  DROP COLUMN IF EXISTS related_user_id;

ALTER TABLE users
  DROP COLUMN IF EXISTS account_status,
  DROP COLUMN IF EXISTS debt_amount;

-- Revert to DECIMAL (WARNING: may lose precision)
ALTER TABLE token_balances
  ALTER COLUMN balance TYPE DECIMAL(15,2);

COMMIT;
```

---

## 🎯 Success Criteria

System is working correctly when:

✅ No double-credits on retries or 3DS flows
✅ No race conditions on concurrent spending
✅ All balances remain non-negative
✅ Webhook is the single source of truth for purchases
✅ Refunds/chargebacks handled gracefully
✅ Balance reconciliation shows zero drift

---

## 📞 Support

Questions? Check:
- `PATCH_tokens_hardening.md` for detailed code examples
- `142_token_system_hardening.sql` for schema changes
- Test against staging environment first!
