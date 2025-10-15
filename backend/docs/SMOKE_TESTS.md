# Payout System Smoke Tests

Production-ready smoke tests for the Stripe Connect payout system.

## Pre-Test Setup

### 1. Environment Variables

Ensure these are set in your backend `.env`:

```bash
STRIPE_SECRET_KEY=sk_test_xxx  # Use test key for staging
STRIPE_WEBHOOK_SECRET=whsec_xxx
CRON_SECRET_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
PAYOUT_MIN_THRESHOLD_CENTS=1000
PAYOUT_RESERVE_PERCENT=0
```

### 2. Test Creator Setup

Create a test creator account (Miriam or similar) and note their:
- User ID / supabase_id
- Email
- JWT token (for API calls)

### 3. Stripe Dashboard Access

Open Stripe Dashboard → Test Mode:
- https://dashboard.stripe.com/test/connect/accounts
- https://dashboard.stripe.com/test/webhooks

---

## Test 1: Onboarding & Banking Setup

**Goal**: Creator can set up Stripe Connect account and complete onboarding.

### Steps:

```bash
# 1. Generate account link
curl -X POST https://your-api.com/api/stripe/account-link \
  -H "Authorization: Bearer ${CREATOR_JWT}" \
  -H "Content-Type: application/json" \
  -d '{
    "return_url": "https://digis.cc/creator/wallet",
    "refresh_url": "https://digis.cc/creator/wallet"
  }'

# Expected response:
{
  "url": "https://connect.stripe.com/setup/e/acct_...",
  "expires_at": 1234567890
}
```

### Actions:

1. **Open the returned URL** in browser
2. Complete Stripe Express onboarding:
   - Business type: Individual
   - Personal details
   - Bank account (use Stripe test bank: routing `110000000`, account `000123456789`)
3. Submit and return to app

### Validation:

```bash
# Check account status
curl https://your-api.com/api/creator-payouts/stripe-account \
  -H "Authorization: Bearer ${CREATOR_JWT}"

# Expected:
{
  "hasAccount": true,
  "account": {
    "stripe_account_id": "acct_xxx",
    "payouts_enabled": true,
    "charges_enabled": true,
    "account_status": "active"
  }
}
```

**✅ Pass Criteria**: `payouts_enabled: true` and `charges_enabled: true`

---

## Test 2: Earning Funds (Destination Charge)

**Goal**: Fan payment creates balance in creator's connected account.

### Setup:

You need a test payment method. Use Stripe test card: `4242 4242 4242 4242`.

### Steps:

```bash
# Simulate a fan purchase (e.g., tokens, session, tip)
# This should create a Stripe Payment Intent with destination charge

curl -X POST https://your-api.com/api/payments/create-intent \
  -H "Authorization: Bearer ${FAN_JWT}" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "creatorId": "creator_supabase_id",
    "type": "session"
  }'

# Backend should create:
stripe.paymentIntents.create({
  amount: 5000,  // $50
  currency: 'usd',
  application_fee_amount: 500,  // $5 platform fee (10%)
  transfer_data: {
    destination: creator.stripeAccountId
  }
})
```

### Validation:

```bash
# Check creator's Stripe balance
curl https://your-api.com/api/stripe/balance \
  -H "Authorization: Bearer ${CREATOR_JWT}"

# Expected:
{
  "available": [
    { "amount": 45.00, "currency": "usd" }  // $50 - $5 fee
  ],
  "pending": []
}
```

**✅ Pass Criteria**: Available balance shows `$45.00` (after platform fee)

---

## Test 3: Manual Payout Trigger

**Goal**: Manually trigger a payout cycle and verify payout creation.

### Steps:

```bash
# Trigger payout run for today
curl -X POST https://your-api.com/internal/payouts/run \
  -H "X-Cron-Secret: ${CRON_SECRET_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "cycleDate": "2025-10-15"
  }'

# Expected response:
{
  "success": true,
  "message": "Payout run triggered",
  "runId": "uuid",
  "cycleDate": "2025-10-15",
  "method": "inngest" | "inline"
}
```

### Validation:

```bash
# Check run status
curl https://your-api.com/internal/payouts/status/${RUN_ID} \
  -H "X-Cron-Secret: ${CRON_SECRET_KEY}"

# Expected:
{
  "id": "uuid",
  "cycle_date": "2025-10-15",
  "status": "succeeded",
  "total_payouts": 1,
  "paid_count": 1,
  "failed_count": 0,
  "total_amount": 45.00
}
```

### Check Stripe Dashboard:

1. Go to: https://dashboard.stripe.com/test/connect/accounts/acct_xxx
2. Navigate to **Payouts** tab
3. Verify payout exists with amount `$45.00`

**✅ Pass Criteria**:
- Run status: `succeeded`
- Payout created in Stripe
- Database `creator_payouts` table has row with `status='paid'`

---

## Test 4: Below Threshold (Skip)

**Goal**: Creators with balance < threshold are skipped.

### Setup:

1. Create a second test creator
2. Give them only `$5` balance (below $10 threshold)

### Steps:

```bash
# Trigger payout run
curl -X POST https://your-api.com/internal/payouts/run \
  -H "X-Cron-Secret: ${CRON_SECRET_KEY}" \
  -d '{"cycleDate": "2025-10-15"}'
```

### Validation:

```bash
# Check creator_payouts table
SELECT * FROM creator_payouts 
WHERE creator_id = 'low_balance_creator_id' 
AND payout_period_end = '2025-10-15';

# Expected: No row OR status='skipped' with reason='below_threshold'
```

**✅ Pass Criteria**: Creator with <$10 balance is not paid out

---

## Test 5: Failed Payout (Invalid Bank)

**Goal**: Handle payout failures gracefully.

### Setup:

1. Use Stripe Dashboard to remove bank account from creator's connected account
2. Or: Use test routing number `111000025` (bank declined)

### Steps:

```bash
# Trigger payout
curl -X POST https://your-api.com/internal/payouts/run \
  -H "X-Cron-Secret: ${CRON_SECRET_KEY}" \
  -d '{"cycleDate": "2025-10-16"}'
```

### Validation:

```bash
# Check payout status
SELECT status, failure_reason FROM creator_payouts
WHERE creator_id = 'creator_id' AND payout_period_end = '2025-10-16';

# Expected:
status = 'failed'
failure_reason = 'No external account found for this transfer'
```

### Frontend Check:

1. Login as creator
2. Go to Wallet → Banking page
3. **Expected**: Error banner with "Update banking info" button

**✅ Pass Criteria**:
- Payout marked as `failed` in database
- Failure reason logged
- Creator sees error message in UI

---

## Test 6: Payout History Display

**Goal**: Frontend displays payout history correctly.

### Steps:

1. Login as creator (with completed payout from Test 3)
2. Navigate to Wallet → Banking / Payouts tab

### Validation:

**Frontend should show**:
- List of payouts
- Each payout displays:
  - Amount: `$45.00`
  - Status: Badge (green for "paid", yellow for "processing", red for "failed")
  - Date: `Oct 15, 2025`
  - Arrival date (if available)

**API Check**:
```bash
curl https://your-api.com/api/stripe/payouts?limit=10 \
  -H "Authorization: Bearer ${CREATOR_JWT}"

# Expected:
{
  "payouts": [
    {
      "id": "po_xxx",
      "amount": 45.00,
      "currency": "usd",
      "status": "paid",
      "arrival_date": 1234567890,
      "created": 1234567890
    }
  ],
  "hasMore": false
}
```

**✅ Pass Criteria**: Payout history displays correctly in UI and API

---

## Test 7: Webhook Handling

**Goal**: Stripe webhooks update payout status in real-time.

### Setup:

1. In Stripe Dashboard, add webhook endpoint:
   - URL: `https://your-api.com/webhooks/stripe`
   - Events: `payout.paid`, `payout.failed`, `account.updated`

### Steps:

```bash
# Trigger test webhook from Stripe Dashboard
# Send test event: payout.paid
```

### Validation:

```bash
# Check logs
tail -f /path/to/logs/app.log | grep "payout.paid"

# Check database
SELECT status, paid_at FROM creator_payouts WHERE stripe_payout_id = 'po_xxx';

# Expected:
status = 'paid'
paid_at = <timestamp>
```

**✅ Pass Criteria**: Webhook received and processed, status updated in DB

---

## Test 8: Idempotency

**Goal**: Running the same payout twice doesn't create duplicates.

### Steps:

```bash
# Run payout for same cycle twice
curl -X POST https://your-api.com/internal/payouts/run \
  -H "X-Cron-Secret: ${CRON_SECRET_KEY}" \
  -d '{"cycleDate": "2025-10-15"}'

# Wait 2 seconds

curl -X POST https://your-api.com/internal/payouts/run \
  -H "X-Cron-Secret: ${CRON_SECRET_KEY}" \
  -d '{"cycleDate": "2025-10-15"}'
```

### Validation:

```bash
# Check database
SELECT COUNT(*) FROM creator_payouts 
WHERE creator_id = 'creator_id' AND payout_period_end = '2025-10-15';

# Expected: COUNT = 1 (not 2)

# Check run status
SELECT * FROM payout_runs WHERE cycle_date = '2025-10-15';

# Expected: Single row, status='succeeded'
```

**✅ Pass Criteria**: Only ONE payout created, second request returns existing run

---

## Test 9: Cron Auth Protection

**Goal**: Internal endpoint rejects unauthorized requests.

### Steps:

```bash
# Try without secret
curl -X POST https://your-api.com/internal/payouts/run

# Expected: 401 Unauthorized

# Try with wrong secret
curl -X POST https://your-api.com/internal/payouts/run \
  -H "X-Cron-Secret: wrong_secret"

# Expected: 401 Unauthorized

# Try with correct secret
curl -X POST https://your-api.com/internal/payouts/run \
  -H "X-Cron-Secret: ${CRON_SECRET_KEY}"

# Expected: 200 OK
```

**✅ Pass Criteria**: Endpoint protected, only accepts valid secret

---

## Test 10: Health Check

**Goal**: Payout system health endpoint works.

### Steps:

```bash
curl https://your-api.com/internal/payouts/health \
  -H "X-Cron-Secret: ${CRON_SECRET_KEY}"
```

### Expected Response:

```json
{
  "healthy": true,
  "recentRuns": [
    {
      "cycle_date": "2025-10-15",
      "status": "succeeded",
      "created_at": "2025-10-15T06:00:00Z"
    }
  ],
  "stuckRuns": [],
  "failedPayoutsLast7Days": 0,
  "timestamp": "2025-10-15T12:00:00Z"
}
```

**✅ Pass Criteria**:
- `healthy: true`
- No stuck runs
- Failed payouts count is reasonable

---

## Automated Test Script

Save this as `test-payouts.sh`:

```bash
#!/bin/bash

# Payout System Smoke Tests
# Usage: ./test-payouts.sh

set -e

API_URL="${API_URL:-http://localhost:3005}"
CREATOR_JWT="${CREATOR_JWT:-your_jwt_here}"
CRON_SECRET="${CRON_SECRET:-your_secret_here}"

echo "🧪 Running Payout Smoke Tests..."
echo "API: $API_URL"
echo ""

# Test 1: Account Link
echo "✅ Test 1: Generate Account Link"
RESPONSE=$(curl -s -X POST "$API_URL/api/stripe/account-link" \
  -H "Authorization: Bearer $CREATOR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"return_url":"https://test.com","refresh_url":"https://test.com"}')
echo "$RESPONSE" | jq .

# Test 2: Check Account Status
echo ""
echo "✅ Test 2: Check Stripe Account"
curl -s "$API_URL/api/creator-payouts/stripe-account" \
  -H "Authorization: Bearer $CREATOR_JWT" | jq .

# Test 3: Trigger Payout
echo ""
echo "✅ Test 3: Trigger Payout Run"
RESPONSE=$(curl -s -X POST "$API_URL/internal/payouts/run" \
  -H "X-Cron-Secret: $CRON_SECRET" \
  -d '{"cycleDate":"2025-10-15"}')
RUN_ID=$(echo "$RESPONSE" | jq -r .runId)
echo "$RESPONSE" | jq .

# Test 4: Check Run Status
echo ""
echo "✅ Test 4: Check Run Status"
sleep 5
curl -s "$API_URL/internal/payouts/status/$RUN_ID" \
  -H "X-Cron-Secret: $CRON_SECRET" | jq .

# Test 5: Health Check
echo ""
echo "✅ Test 5: Health Check"
curl -s "$API_URL/internal/payouts/health" \
  -H "X-Cron-Secret: $CRON_SECRET" | jq .

echo ""
echo "✅ All tests completed!"
```

Make executable:
```bash
chmod +x test-payouts.sh
```

Run:
```bash
export API_URL=https://your-api.com
export CREATOR_JWT=eyJhbGc...
export CRON_SECRET=your_secret
./test-payouts.sh
```

---

## Success Criteria Summary

All tests should pass with:

- ✅ Creator onboarding completes successfully
- ✅ Destination charges create balance in connected account
- ✅ Payouts trigger and create Stripe payouts
- ✅ Below-threshold creators are skipped
- ✅ Failed payouts are handled and logged
- ✅ Payout history displays in UI
- ✅ Webhooks update status in real-time
- ✅ Idempotency prevents duplicates
- ✅ Auth protects internal endpoints
- ✅ Health check reports system status

---

## Troubleshooting

### Issue: "No external account found"

**Solution**: Creator needs to complete banking setup. Generate fresh account link:
```bash
curl -X POST $API_URL/api/stripe/account-link ...
```

### Issue: "Insufficient balance"

**Cause**: Using Transfers instead of Destination Charges.

**Solution**: Ensure Payment Intents use `transfer_data.destination`:
```javascript
stripe.paymentIntents.create({
  amount: 5000,
  transfer_data: { destination: acct_xxx }  // ← Key line
})
```

### Issue: Webhook not receiving

**Solution**:
1. Check Stripe Dashboard → Webhooks → Event logs
2. Verify endpoint URL is correct
3. Test with Stripe CLI:
```bash
stripe listen --forward-to localhost:3005/webhooks/stripe
```

---

## Next Steps

After all smoke tests pass:

1. **Deploy to staging** with test Stripe keys
2. **Run full test suite** with multiple creators
3. **Monitor for 1 week** in staging
4. **Deploy to production** with live Stripe keys
5. **Set up monitoring** (Sentry, DataDog, etc.)
6. **Configure alerts** (Slack, PagerDuty)

---

## Production Checklist

Before going live:

- [ ] All smoke tests pass in staging
- [ ] Stripe webhooks configured and tested
- [ ] CRON_SECRET_KEY set in production env
- [ ] Monitoring and alerts configured
- [ ] Backup and recovery plan documented
- [ ] Support team trained on payout system
- [ ] Creator help docs updated
- [ ] Load testing completed (1000+ creators)
- [ ] Security audit passed
- [ ] Compliance review completed (if applicable)
