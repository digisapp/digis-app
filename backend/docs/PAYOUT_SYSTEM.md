# Digis Creator Payout System

## Overview

The Digis creator payout system uses **Stripe Connect (Express)** with **manual payout schedules** to handle twice-monthly payouts (1st & 15th of each month) for 1,000+ creators.

## Architecture

### Stripe Connect Setup

- **Account Type**: Express (lightweight, Stripe-managed KYC/AML)
- **Payout Schedule**: Manual (configured per account)
- **Charge Pattern**: Destination Charges (funds go directly to creator's connected account)
- **Platform Fee**: Configurable via `application_fee_amount`

### Key Components

1. **Stripe Connect Service** (`/services/stripe-connect.js`)
   - Account creation with manual payout schedule
   - Account status management
   - Direct payout creation from connected accounts
   - Balance retrieval
   - Payout history fetching

2. **Creator Payout Routes** (`/routes/creator-payouts.js`)
   - Payout dashboard data
   - Stripe account management
   - Payout history and settings
   - Manual payout requests

3. **Stripe API Routes** (`/routes/stripe.js`)
   - `/api/stripe/account-link` - Generate onboarding/update links
   - `/api/stripe/payouts` - Fetch payout history
   - `/api/stripe/balance` - Get available balance

4. **Inngest Functions** (`/inngest/functions/payouts.js`)
   - Scheduled payout processing (1st & 15th)
   - Failed payout retry logic
   - Account status updates
   - Single payout processing

5. **Database Schema** (`/migrations/010_create_creator_payouts.sql`)
   - `creator_stripe_accounts` - Connected account info
   - `creator_payouts` - Payout records
   - `creator_earnings` - Earnings ledger
   - `creator_payout_settings` - Creator preferences
   - `payout_notifications` - Payout alerts

## Workflow

### 1. Creator Onboarding

```javascript
// Create Express account with manual payouts
const account = await stripe.accounts.create({
  type: 'express',
  country: 'US',
  email: creator.email,
  settings: {
    payouts: {
      schedule: {
        interval: 'manual' // Key for 1st & 15th schedule
      }
    }
  }
});

// Generate onboarding link
const accountLink = await stripe.accountLinks.create({
  account: account.id,
  type: 'account_onboarding',
  return_url: 'https://digis.cc/creator/payouts/complete',
  refresh_url: 'https://digis.cc/creator/payouts/refresh'
});
```

### 2. Charge Fans (Destination Charges)

```javascript
const paymentIntent = await stripe.paymentIntents.create({
  amount: 5000, // $50.00
  currency: 'usd',
  application_fee_amount: 500, // $5.00 platform fee (10%)
  transfer_data: {
    destination: creator.stripeAccountId // Funds go directly to creator
  }
});
```

Funds settle directly in the creator's connected account balance.

### 3. Twice-Monthly Payout Job (1st & 15th)

The payout job is triggered by Inngest on the 1st and 15th of each month:

```javascript
// For each creator with payouts_enabled
for (const creator of eligibleCreators) {
  // 1. Read available balance
  const balance = await stripe.balance.retrieve({
    stripeAccount: creator.stripeAccountId
  });

  // 2. Calculate payout amount (with reserve & threshold)
  const { amount, reserve } = computePayoutAmount(
    balance.available,
    'usd',
    {
      reservePercent: 0.0, // Optional reserve for chargebacks
      minThreshold: 1000    // $10 minimum
    }
  );

  if (amount < minThreshold) continue;

  // 3. Create payout with idempotency
  const idempotencyKey = `payout:${creator.stripeAccountId}:${cycleDate}:usd`;

  const payout = await stripe.payouts.create(
    {
      amount: amount, // in cents
      currency: 'usd',
      metadata: {
        payout_id: dbPayoutId,
        creator_id: creator.id,
        cycle_date: cycleDate
      }
    },
    {
      stripeAccount: creator.stripeAccountId,
      idempotencyKey: idempotencyKey
    }
  );

  // 4. Update database
  await db.query(
    `UPDATE creator_payouts
     SET stripe_payout_id = $1, status = 'processing'
     WHERE id = $2`,
    [payout.id, dbPayoutId]
  );
}
```

### 4. Webhook Handling

Subscribe to these Stripe events:

- `account.updated` - Update account status in DB
- `payout.paid` - Mark payout as completed
- `payout.failed` - Mark payout as failed, notify creator
- `payment_intent.succeeded` - Track revenue
- `charge.dispute.*` - Handle disputes

```javascript
switch (event.type) {
  case 'account.updated':
    const account = event.data.object;
    await db.query(
      `UPDATE creator_stripe_accounts
       SET payouts_enabled = $1, charges_enabled = $2
       WHERE stripe_account_id = $3`,
      [account.payouts_enabled, account.charges_enabled, account.id]
    );
    break;

  case 'payout.paid':
    const payout = event.data.object;
    await db.query(
      `UPDATE creator_payouts
       SET status = 'paid', paid_at = NOW()
       WHERE stripe_payout_id = $1`,
      [payout.id]
    );
    break;

  case 'payout.failed':
    // Notify creator to update banking info
    await generateAccountLink(creator.stripeAccountId);
    break;
}
```

## Database Schema

### creator_stripe_accounts

```sql
CREATE TABLE creator_stripe_accounts (
  id SERIAL PRIMARY KEY,
  creator_id VARCHAR(255) NOT NULL,
  stripe_account_id VARCHAR(255) UNIQUE,
  account_status VARCHAR(50) DEFAULT 'pending',
  payouts_enabled BOOLEAN DEFAULT false,
  charges_enabled BOOLEAN DEFAULT false,
  country VARCHAR(2),
  currency VARCHAR(3) DEFAULT 'usd',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### creator_payouts

```sql
CREATE TABLE creator_payouts (
  id SERIAL PRIMARY KEY,
  creator_id VARCHAR(255) NOT NULL,
  stripe_payout_id VARCHAR(255),
  payout_period_start DATE NOT NULL,
  payout_period_end DATE NOT NULL,
  tokens_earned INTEGER NOT NULL DEFAULT 0,
  usd_amount DECIMAL(10, 2) NOT NULL,
  platform_fee_amount DECIMAL(10, 2) DEFAULT 0.00,
  net_payout_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, paid, failed
  failure_reason TEXT,
  processed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### creator_earnings

```sql
CREATE TABLE creator_earnings (
  id SERIAL PRIMARY KEY,
  creator_id VARCHAR(255) NOT NULL,
  earning_type VARCHAR(50) NOT NULL, -- session, tip, gift, subscription
  tokens_earned INTEGER NOT NULL,
  usd_value DECIMAL(10, 2) NOT NULL,
  payout_id INTEGER REFERENCES creator_payouts(id),
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  fan_id VARCHAR(255)
);
```

## API Endpoints

### POST /api/stripe/account-link

Generate Stripe Connect onboarding/update link.

**Request:**
```json
{
  "return_url": "https://digis.cc/creator/payouts/complete",
  "refresh_url": "https://digis.cc/creator/payouts/refresh"
}
```

**Response:**
```json
{
  "url": "https://connect.stripe.com/setup/e/acct_...",
  "expires_at": 1234567890
}
```

### GET /api/stripe/payouts

Get payout history from Stripe for creator's connected account.

**Query Parameters:**
- `limit` (default: 50) - Number of payouts to return

**Response:**
```json
{
  "payouts": [
    {
      "id": "po_123",
      "amount": 150.00,
      "currency": "usd",
      "status": "paid",
      "arrival_date": 1234567890,
      "created": 1234567890,
      "method": "standard",
      "type": "bank_account"
    }
  ],
  "hasMore": false
}
```

### GET /api/stripe/balance

Get available and pending balance from creator's connected account.

**Response:**
```json
{
  "available": [
    { "amount": 250.50, "currency": "usd" }
  ],
  "pending": [
    { "amount": 50.00, "currency": "usd" }
  ]
}
```

### GET /api/creator-payouts/stripe-account

Get creator's Stripe Connect account status.

**Response:**
```json
{
  "hasAccount": true,
  "account": {
    "stripe_account_id": "acct_123",
    "account_status": "active",
    "payouts_enabled": true,
    "charges_enabled": true,
    "country": "US",
    "currency": "usd",
    "email": "creator@example.com",
    "display_name": "Jane Creator"
  }
}
```

## Payout Policy

### Reserve Strategy

Optionally hold a percentage of available balance to cover refunds/chargebacks:

```javascript
const reservePercent = 0.0; // Start with 0%, adjust as needed
const reserve = Math.floor(availableBalance * reservePercent);
const payoutAmount = availableBalance - reserve;
```

### Minimum Threshold

Set minimum payout amount to avoid small transactions and bank fees:

```javascript
const minThreshold = 1000; // $10.00 in cents

if (payoutAmount < minThreshold) {
  // Skip payout, will be included in next cycle
  return { skipped: true, reason: 'below_threshold' };
}
```

### Multi-Currency Support

If supporting multiple currencies, create one payout per currency:

```javascript
for (const balanceItem of balance.available) {
  if (balanceItem.amount >= minThreshold) {
    await stripe.payouts.create(
      { amount: balanceItem.amount, currency: balanceItem.currency },
      { stripeAccount: accountId }
    );
  }
}
```

## Idempotency & Safety

### Idempotency Keys

Prevent duplicate payouts using idempotency keys:

```javascript
const idempotencyKey = `payout:${accountId}:${cycleDate}:${currency}`;
// Format: "payout:acct_123:2025-11-01:usd"
```

Stripe guarantees same result for duplicate requests with same key.

### Database Ledger

Track all payouts in `creator_payouts` table for:
- Accounting/reconciliation
- Dispute resolution
- Creator transparency
- Tax reporting (1099-K handled by Stripe)

### Error Handling

```javascript
try {
  const payout = await stripe.payouts.create(/* ... */);
  await db.query(`UPDATE creator_payouts SET status='processing'`);
} catch (error) {
  await db.query(
    `UPDATE creator_payouts SET status='failed', failure_reason=$1`,
    [error.message]
  );
  // Retry logic handled by Inngest
}
```

## Cron Schedule

### Production (Inngest + QStash)

For serverless deployments on Vercel:

```javascript
// In /api/inngest/trigger endpoint
if (dayOfMonth === 1 || dayOfMonth === 15) {
  await inngest.send({
    name: 'payout.scheduled',
    data: {
      payoutDate: new Date().toISOString(),
      dayOfMonth: dayOfMonth
    }
  });
}
```

Triggered via QStash cron at 06:00 UTC on 1st & 15th.

### Local Development

For local testing with node-cron:

```javascript
const cron = require('node-cron');

// Run at 06:00 on 1st and 15th
cron.schedule('0 6 1,15 * *', async () => {
  await runPayoutCycle(new Date().toISOString().split('T')[0]);
});
```

## Monitoring & Alerts

### Metrics to Track

- Payout success rate
- Failed payout count
- Average payout amount
- Processing time
- Balance reserves

### Alerting

- Slack/Email on payout failures
- Admin dashboard for payout runs
- Creator notifications for successful/failed payouts

### Logs

```javascript
logger.info('Payout cycle completed', {
  cycleDate: '2025-11-01',
  totalCreators: 1250,
  successfulPayouts: 1220,
  failedPayouts: 30,
  totalAmount: 125000.00
});
```

## Testing

### Stripe Test Mode

Use Stripe test mode for development:

```bash
export STRIPE_SECRET_KEY=sk_test_...
```

### Test Cards

- `4000 0000 0000 3220` - 3D Secure required
- `4000 0000 0000 9995` - Insufficient funds
- `4242 4242 4242 4242` - Success

### Manual Trigger

Trigger payout job manually for testing:

```bash
POST /api/inngest/trigger
{
  "function": "payout.scheduled",
  "data": {
    "payoutDate": "2025-11-01",
    "dayOfMonth": 1
  }
}
```

## Compliance & Tax

### 1099-K Forms

Stripe automatically handles 1099-K generation for US creators earning > $600/year.

### International Creators

Support via W-8BEN forms (handled by Stripe Express onboarding).

### Record Keeping

Maintain 7-year history of:
- Payout records
- Earnings ledger
- Platform fees
- Balance adjustments

## Security

### API Authentication

All endpoints require valid JWT token:

```javascript
const { authenticateToken } = require('../middleware/auth');
router.post('/account-link', authenticateToken, requireCreator, async (req, res) => {
  // ...
});
```

### Creator Verification

Verify user is creator before allowing payout operations:

```javascript
const requireCreator = async (req, res, next) => {
  const result = await pool.query(
    'SELECT is_creator FROM users WHERE supabase_id = $1',
    [req.user.supabase_id]
  );
  if (!result.rows[0]?.is_creator) {
    return res.status(403).json({ error: 'Creator access required' });
  }
  next();
};
```

### Rate Limiting

Protect sensitive endpoints:

```javascript
app.use('/api/stripe', rateLimiters.api, stripeRoutes);
```

## Migration Path

### From Existing System

If migrating from another payout system:

1. Create Stripe accounts for existing creators
2. Set manual payout schedule
3. Run migration to copy balance data
4. Test with small group first
5. Gradually roll out to all creators

### Database Migration

```sql
-- Add Stripe account ID to existing creators
ALTER TABLE users ADD COLUMN stripe_account_id VARCHAR(255);

-- Migrate existing payout data
INSERT INTO creator_payouts (creator_id, usd_amount, status, created_at)
SELECT uid, payout_amount, 'paid', payout_date
FROM legacy_payouts;
```

## Troubleshooting

### Payout Failed: Insufficient Balance

**Cause**: Creator's connected account doesn't have enough funds.

**Solution**: Ensure Destination Charges are used, not Transfers. Funds should settle directly in connected account.

### Payout Failed: Invalid Bank Account

**Cause**: Creator's banking information is incomplete or invalid.

**Solution**: Generate fresh account link for creator to update banking info:

```javascript
const link = await stripe.accountLinks.create({
  account: creator.stripeAccountId,
  type: 'account_update',
  return_url: 'https://digis.cc/creator/payouts',
  refresh_url: 'https://digis.cc/creator/payouts'
});
```

### Duplicate Payouts

**Cause**: Idempotency key not used or job ran twice.

**Solution**: Always use idempotency keys. Check database for existing payout before creating:

```javascript
const existing = await db.query(
  `SELECT id FROM creator_payouts
   WHERE creator_id = $1 AND payout_period_end = $2`,
  [creatorId, cycleDate]
);

if (existing.rows.length > 0) {
  return; // Skip, already created
}
```

## Future Enhancements

1. **Dynamic Reserves**: Adjust reserve based on chargeback history
2. **Instant Payouts**: Use Stripe Instant Payouts for premium creators
3. **Multi-Currency**: Support EUR, GBP, CAD payouts
4. **Payout Scheduling**: Let creators choose weekly/monthly
5. **Tax Withholding**: Automatic tax withholding for international creators
6. **Analytics Dashboard**: Real-time payout metrics

## Resources

- [Stripe Connect Docs](https://stripe.com/docs/connect)
- [Express Accounts](https://stripe.com/docs/connect/express-accounts)
- [Manual Payouts](https://stripe.com/docs/connect/manual-payouts)
- [Destination Charges](https://stripe.com/docs/connect/destination-charges)
- [Idempotency](https://stripe.com/docs/api/idempotent_requests)
