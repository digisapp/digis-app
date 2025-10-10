# Bi-Monthly Withdrawal System

## Overview

The Digis platform uses a **bi-monthly payout schedule** (1st and 15th of each month) to protect against fraud and chargebacks while ensuring creators receive their earnings regularly.

## Key Features

✅ **Bi-monthly payout schedule** - Payouts processed on 1st and 15th of each month
✅ **Request-based withdrawals** - Creators request, platform processes on schedule
✅ **7-day chargeback buffer** - Recent earnings held to cover potential chargebacks
✅ **Manual creator approval** - Only approved creators can earn and withdraw
✅ **Automatic balance verification** - Final balance check before each payout
✅ **Stripe Connect integration** - Ready for bank transfers via Stripe

## Database Schema

### Tables Created (Migration 146)

```sql
-- Withdrawal requests table
CREATE TABLE withdrawal_requests (
  id SERIAL PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES users(supabase_id),
  amount BIGINT NOT NULL,                    -- Token amount
  amount_usd DECIMAL(10,2) NOT NULL,         -- USD equivalent
  payout_date DATE NOT NULL,                 -- Always 1st or 15th
  status VARCHAR(20) DEFAULT 'pending',      -- pending, completed, failed, cancelled
  stripe_transfer_id VARCHAR(255),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Added to users table
ALTER TABLE users
  ADD COLUMN stripe_connect_account_id VARCHAR(255),
  ADD COLUMN payout_method VARCHAR(50) DEFAULT 'stripe_connect',
  ADD COLUMN payout_details JSONB DEFAULT '{}';
```

### Database Functions

**`get_creator_earnings_summary(creator_id)`** - Returns:
- `total_earned` - All-time earnings
- `total_paid_out` - Total withdrawn
- `available_balance` - Available for withdrawal (excludes 7-day buffer)
- `buffered_earnings` - Earnings < 7 days old (chargeback protection)
- `pending_withdrawals` - Sum of pending requests
- `last_payout_date` - Most recent completed payout
- `next_payout_date` - Next scheduled payout (1st or 15th)

## API Endpoints

### 1. Get Earnings Summary

```http
GET /api/tokens/earnings
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "earnings": {
    "totalEarned": 50000,
    "totalPaidOut": 30000,
    "availableBalance": 18000,
    "bufferedEarnings": 2000,
    "pendingWithdrawals": 5000
  },
  "payoutSchedule": {
    "nextPayoutDate": "2025-11-01",
    "lastPayoutDate": "2025-10-15",
    "payoutDays": [1, 15],
    "minimumWithdrawal": 1000,
    "chargebackBuffer": "7 days"
  },
  "usdValues": {
    "availableUsd": 900.00,
    "bufferedUsd": 100.00,
    "pendingUsd": 250.00
  }
}
```

### 2. Request Withdrawal

```http
POST /api/tokens/request-withdrawal
Authorization: Bearer <token>
Content-Type: application/json

{
  "tokenAmount": 5000,
  "metadata": {
    "note": "Monthly payout request"
  }
}
```

**Response:**
```json
{
  "success": true,
  "request": {
    "id": 123,
    "amount": 5000,
    "amountUsd": 250.00,
    "payoutDate": "2025-11-01",
    "status": "pending"
  },
  "message": "Withdrawal of 5000 tokens ($250.00) queued for 2025-11-01"
}
```

**Error Responses:**

Insufficient balance:
```json
{
  "error": "Insufficient available balance",
  "details": {
    "requested": 5000,
    "available": 3000,
    "buffered": 2000,
    "bufferReason": "7-day chargeback protection"
  }
}
```

Too many pending requests:
```json
{
  "error": "Maximum 3 pending withdrawal requests allowed"
}
```

### 3. Get Withdrawal Requests

```http
GET /api/tokens/withdrawal-requests?status=pending&limit=50
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "requests": [
    {
      "id": 123,
      "amount": 5000,
      "amountUsd": 250.00,
      "payoutDate": "2025-11-01",
      "status": "pending",
      "createdAt": "2025-10-25T10:30:00Z",
      "processedAt": null,
      "stripeTransferId": null,
      "errorMessage": null
    }
  ]
}
```

### 4. Cancel Withdrawal Request

```http
DELETE /api/tokens/withdrawal-requests/123
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "request": {
    "id": 123,
    "status": "cancelled",
    "amount": 5000,
    "cancelledAt": "2025-10-26T14:20:00Z"
  }
}
```

## Configuration

File: `backend/utils/payout-scheduler.js`

```javascript
const PAYOUT_CONFIG = {
  PAYOUT_DAYS: [1, 15],           // 1st and 15th of month
  MIN_PAYOUT_AMOUNT: 1000,        // 1000 tokens = $50
  CHARGEBACK_BUFFER_DAYS: 7,      // Hold 7 days of earnings
  MAX_PENDING_REQUESTS: 3         // Max pending requests per creator
};
```

## Payout Processing

### Automated Batch Processing

The `processPayoutBatch()` function should be run on the **1st and 15th** of each month via cron job:

```javascript
const { processPayoutBatch } = require('./utils/payout-scheduler');

// Cron job (run at 2 AM on 1st and 15th)
// 0 2 1,15 * *
async function runPayouts() {
  const results = await processPayoutBatch(new Date());

  console.log(`Processed: ${results.processed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Total: $${results.totalAmount}`);
}
```

### Processing Flow

For each pending request on payout date:

1. **Final balance check** - Verify creator still has sufficient balance (may have decreased due to chargebacks)
2. **Stripe Connect transfer** - Send funds to creator's connected bank account
3. **Debit creator balance** - Record payout transaction
4. **Update request status** - Mark as `completed` or `failed`

```javascript
// Stripe Connect transfer
const transfer = await stripe.transfers.create({
  amount: Math.round(amountUsd * 100),
  currency: 'usd',
  destination: creator.stripe_connect_account_id,
  description: `Digis payout: ${tokenAmount} tokens`,
  metadata: {
    withdrawal_request_id: requestId,
    creator_id: creatorId,
    payout_date: payoutDate
  }
});

// Record payout in ledger
await pool.query(`
  INSERT INTO token_transactions (
    user_id, type, tokens, amount_usd, status,
    stripe_payment_intent_id, metadata
  ) VALUES ($1, 'payout', $2, $3, 'completed', $4, $5)
`, [creatorId, -tokenAmount, amountUsd, transfer.id, metadata]);
```

## Chargeback Protection

### 7-Day Buffer

Earnings less than 7 days old are **not available for withdrawal**. This protects against:

- Credit card chargebacks (typically arrive within 7-14 days)
- Fraudulent purchases that are reversed
- Disputed transactions

### Available Balance Calculation

```sql
WITH earnings AS (
  SELECT
    SUM(tokens) FILTER (WHERE created_at < NOW() - INTERVAL '7 days') AS safe_earnings,
    SUM(tokens) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS buffered
  FROM token_transactions
  WHERE user_id = $1
    AND tokens > 0
    AND type IN ('tip', 'call', 'gift_received', 'stream_tip')
    AND status = 'completed'
)
SELECT
  safe_earnings - chargebacks - pending_withdrawals AS available_balance,
  buffered AS buffered_earnings
FROM earnings;
```

## Fraud Prevention

The bi-monthly schedule provides **natural fraud protection**:

1. **Manual creator approval** - Only vetted creators can earn
2. **15-30 day delay** - Chargebacks arrive before payouts
3. **Request-based** - No automatic withdrawals
4. **Balance verification** - Final check before processing
5. **Maximum 3 pending requests** - Prevents withdrawal spam

**Why this is better than instant payouts:**
- Chargebacks typically arrive within 7-14 days
- Next payout is always 0-15 days away
- Combined with 7-day buffer = 7-22 day fraud window
- Platform can reverse fraudulent earnings before payout

## Stripe Connect Setup

### Creator Onboarding

Creators must connect a bank account before requesting withdrawals:

```javascript
// Create Stripe Connect account
const account = await stripe.accounts.create({
  type: 'express',
  country: 'US',
  email: creator.email,
  capabilities: {
    transfers: { requested: true }
  }
});

// Store account ID
await pool.query(
  'UPDATE users SET stripe_connect_account_id = $1 WHERE supabase_id = $2',
  [account.id, creatorId]
);

// Generate onboarding link
const accountLink = await stripe.accountLinks.create({
  account: account.id,
  refresh_url: 'https://digis.com/creator/settings',
  return_url: 'https://digis.com/creator/settings',
  type: 'account_onboarding'
});
```

## Deployment Checklist

- [x] Migration 146 created (`146_withdrawal_requests.sql`)
- [x] Payout scheduler utility created (`utils/payout-scheduler.js`)
- [x] API endpoints added to `routes/tokens.js`
- [ ] Run migration: `npm run migrate`
- [ ] Set up cron job for `processPayoutBatch()` (1st and 15th at 2 AM)
- [ ] Configure Stripe Connect for creator payouts
- [ ] Add creator onboarding flow for bank account connection
- [ ] Test withdrawal request flow
- [ ] Test payout processing with test creator
- [ ] Monitor first live payout batch

## Testing

### Test Withdrawal Request

```bash
# As creator, request withdrawal
curl -X POST https://api.digis.com/api/tokens/request-withdrawal \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tokenAmount": 1000}'

# Expected: Request queued for next payout date (1st or 15th)
```

### Test Insufficient Balance

```bash
# Request more than available
curl -X POST https://api.digis.com/api/tokens/request-withdrawal \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tokenAmount": 999999}'

# Expected: Error with available vs buffered breakdown
```

### Test Payout Processing

```javascript
// Manually trigger payout batch (admin only)
const { processPayoutBatch } = require('./utils/payout-scheduler');

// Process payouts for today
const results = await processPayoutBatch(new Date());
console.log(results);
```

## Monitoring

### Key Queries

```sql
-- Pending withdrawals for next payout
SELECT * FROM get_pending_payouts_for_date('2025-11-01');

-- Creator earnings overview
SELECT * FROM get_creator_earnings_summary('creator-uuid');

-- All pending requests
SELECT COUNT(*), SUM(amount_usd)
FROM withdrawal_requests
WHERE status = 'pending';

-- Failed payouts
SELECT *
FROM withdrawal_requests
WHERE status = 'failed'
ORDER BY processed_at DESC;
```

## Next Steps

1. **Set up cron job** - Run `processPayoutBatch()` on 1st and 15th
2. **Stripe Connect onboarding** - Add creator bank account connection flow
3. **Admin dashboard** - UI for reviewing pending withdrawals
4. **Email notifications** - Notify creators when:
   - Withdrawal request confirmed
   - Payout processed
   - Payout failed
5. **Analytics** - Track payout success rate, average withdrawal amount

## Support

**Creator FAQ:**

Q: When will I receive my payout?
A: Payouts are processed on the 1st and 15th of each month. Request withdrawal anytime, and it will be processed on the next scheduled date.

Q: Why can't I withdraw all my earnings?
A: Earnings less than 7 days old are held for chargeback protection. This protects both you and the platform.

Q: How do I connect my bank account?
A: Go to Settings → Payouts and complete the Stripe Connect onboarding flow.

Q: What's the minimum withdrawal?
A: 1,000 tokens ($50 USD).
