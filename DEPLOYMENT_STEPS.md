# Bi-Monthly Payout System - Deployment Guide

## Prerequisites

Before deploying the withdrawal system, ensure you have:

- [x] Supabase PostgreSQL database access
- [x] Stripe account with Connect enabled
- [ ] Database credentials (DATABASE_URL or individual DB vars)
- [ ] Vercel CLI authenticated (for production deployment)

## Step 1: Set Up Environment Variables

### Option A: Create `.env` file in `backend/` directory

```bash
cd backend
cp .env.example .env
```

Then edit `.env` and add your database credentials. You need either:

**Option 1 - DATABASE_URL (Recommended):**
```env
DATABASE_URL=postgresql://username:password@host:5432/database_name
```

**Option 2 - Individual DB variables:**
```env
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_HOST=your_db_host
DB_PORT=5432
DB_NAME=your_db_name
```

### Get Supabase DATABASE_URL

1. Go to your Supabase project: https://supabase.com/dashboard/project/lpphsjowsivjtcmafxnj
2. Click "Project Settings" → "Database"
3. Scroll to "Connection String" → "URI"
4. Copy the connection string (it starts with `postgresql://`)
5. Add it to `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.lpphsjowsivjtcmafxnj.supabase.co:5432/postgres
```

## Step 2: Run Database Migration

```bash
cd backend
npm run migrate
```

**Expected Output:**
```
Migration 146: Withdrawal Requests
========================================
Created Table:
  - withdrawal_requests
Created View:
  - creator_payout_history
Created Functions:
  - get_creator_earnings_summary(creator_id)
  - get_pending_payouts_for_date(date)
Added Columns to users:
  - stripe_connect_account_id
  - payout_method
  - payout_details
```

## Step 3: Verify Database Schema

```bash
npm run db:test
```

You should see the new tables:
- `withdrawal_requests`
- New columns in `users` table

## Step 4: Set Up Stripe Connect

### Enable Stripe Connect in your Stripe Dashboard

1. Go to https://dashboard.stripe.com/connect/overview
2. Enable "Connect" if not already enabled
3. Choose "Express" account type for creators
4. Configure payout settings

### Add Stripe Configuration to Environment

```env
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
# Or for production:
# STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
```

## Step 5: Set Up Automated Payout Processing

### Option A: Using Vercel Cron Jobs (Recommended for Vercel deployments)

Create `vercel.json` in backend directory (if not exists):

```json
{
  "crons": [
    {
      "path": "/api/cron/payouts",
      "schedule": "0 2 1,15 * *"
    }
  ]
}
```

Create cron endpoint at `backend/api/cron/payouts.js`:

```javascript
const { runPayoutJob } = require('../jobs/payout-cron');

module.exports = async (req, res) => {
  // Verify request is from Vercel Cron
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const results = await runPayoutJob();
    res.status(200).json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

Add to `.env`:
```env
CRON_SECRET=your_random_secret_here
```

### Option B: Using System Cron (For VPS/EC2 deployment)

```bash
# Edit crontab
crontab -e

# Add this line (runs at 2 AM on 1st and 15th of each month)
0 2 1,15 * * cd /path/to/digis-app/backend && npm run payout:run >> /var/log/digis-payouts.log 2>&1
```

### Option C: Using node-cron (For always-running Node.js process)

Create `backend/utils/scheduler.js`:

```javascript
const cron = require('node-cron');
const { runPayoutJob } = require('../jobs/payout-cron');

// Run at 2 AM on 1st and 15th of each month
cron.schedule('0 2 1,15 * *', async () => {
  console.log('🕐 Running bi-monthly payout job...');
  try {
    await runPayoutJob();
  } catch (error) {
    console.error('Payout job failed:', error);
  }
}, {
  scheduled: true,
  timezone: "America/New_York" // Adjust to your timezone
});

console.log('✅ Payout scheduler initialized');
```

Then import in `backend/api/index.js`:

```javascript
// Add after other requires
if (process.env.NODE_ENV === 'production') {
  require('../utils/scheduler');
}
```

## Step 6: Test the System

### Test Withdrawal Request

```bash
# Create a test creator withdrawal request
curl -X POST http://localhost:3005/api/tokens/request-withdrawal \
  -H "Authorization: Bearer YOUR_CREATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tokenAmount": 1000}'
```

**Expected Response:**
```json
{
  "success": true,
  "request": {
    "id": 1,
    "amount": 1000,
    "amountUsd": 50.00,
    "payoutDate": "2025-11-01",
    "status": "pending"
  },
  "message": "Withdrawal of 1000 tokens ($50.00) queued for 2025-11-01"
}
```

### Test Earnings Summary

```bash
curl -X GET http://localhost:3005/api/tokens/earnings \
  -H "Authorization: Bearer YOUR_CREATOR_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "earnings": {
    "totalEarned": 5000,
    "totalPaidOut": 0,
    "availableBalance": 4000,
    "bufferedEarnings": 1000,
    "pendingWithdrawals": 0
  },
  "payoutSchedule": {
    "nextPayoutDate": "2025-11-01",
    "lastPayoutDate": null,
    "payoutDays": [1, 15],
    "minimumWithdrawal": 1000,
    "chargebackBuffer": "7 days"
  }
}
```

### Test Payout Processing (Manual)

```bash
cd backend
npm run payout:test
```

This will:
1. Find all pending withdrawal requests for today's date
2. Process Stripe Connect transfers
3. Update creator balances
4. Mark requests as completed/failed

## Step 7: Deploy to Production

### Update Vercel Environment Variables

```bash
# If not already logged in
vercel login

# Link to project
cd backend
vercel link

# Add environment variables
vercel env add DATABASE_URL production
vercel env add STRIPE_SECRET_KEY production
vercel env add CRON_SECRET production

# Deploy
vercel --prod
```

### Or use Vercel Dashboard

1. Go to https://vercel.com/team_R3athwOQBfdB6tbDOfGuPQn3/backend
2. Settings → Environment Variables
3. Add:
   - `DATABASE_URL` (Sensitive)
   - `STRIPE_SECRET_KEY` (Sensitive)
   - `CRON_SECRET` (Sensitive)
4. Redeploy

## Step 8: Monitor Payout Jobs

### View Logs

```bash
# Vercel logs
vercel logs --follow

# Or local logs
tail -f backend/logs/app.log | grep payout
```

### Database Queries for Monitoring

```sql
-- Pending withdrawals
SELECT COUNT(*), SUM(amount_usd)
FROM withdrawal_requests
WHERE status = 'pending';

-- Next payout batch
SELECT * FROM get_pending_payouts_for_date('2025-11-01');

-- Failed payouts
SELECT *
FROM withdrawal_requests
WHERE status = 'failed'
ORDER BY processed_at DESC
LIMIT 10;

-- Payout history
SELECT * FROM creator_payout_history
ORDER BY requested_at DESC
LIMIT 20;
```

## Step 9: Creator Onboarding (Stripe Connect)

Creators need to connect their bank accounts before receiving payouts.

### Add Stripe Connect Onboarding Flow

Create `backend/routes/stripe-connect.js`:

```javascript
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../utils/db');
const router = express.Router();

// Create Stripe Connect account
router.post('/create-account', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT is_creator, email FROM users WHERE supabase_id = $1',
      [req.user.supabase_id]
    );

    if (!userResult.rows[0]?.is_creator) {
      return res.status(403).json({ error: 'Only creators can create payout accounts' });
    }

    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      email: userResult.rows[0].email,
      capabilities: {
        transfers: { requested: true }
      }
    });

    await pool.query(
      'UPDATE users SET stripe_connect_account_id = $1 WHERE supabase_id = $2',
      [account.id, req.user.supabase_id]
    );

    res.json({ success: true, accountId: account.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate onboarding link
router.post('/onboarding-link', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT stripe_connect_account_id FROM users WHERE supabase_id = $1',
      [req.user.supabase_id]
    );

    const accountId = userResult.rows[0]?.stripe_connect_account_id;
    if (!accountId) {
      return res.status(404).json({ error: 'No Connect account found' });
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.FRONTEND_URL}/creator/settings`,
      return_url: `${process.env.FRONTEND_URL}/creator/settings?connected=true`,
      type: 'account_onboarding'
    });

    res.json({ success: true, url: accountLink.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

Add to `backend/api/index.js`:
```javascript
app.use('/api/stripe-connect', require('../routes/stripe-connect'));
```

## Step 10: Email Notifications (Optional)

Add email notifications for payout events.

### Install Postmark (if using)

```bash
npm install postmark
```

Add to `.env`:
```env
POSTMARK_API_KEY=your_postmark_api_key
ADMIN_EMAIL=admin@digis.com
```

### Update `jobs/payout-cron.js`

```javascript
const postmark = require('postmark');
const client = new postmark.ServerClient(process.env.POSTMARK_API_KEY);

async function sendPayoutSummaryEmail(results) {
  await client.sendEmail({
    From: 'noreply@digis.com',
    To: process.env.ADMIN_EMAIL,
    Subject: `Payout Batch Complete - ${new Date().toISOString().split('T')[0]}`,
    TextBody: `
      Payout Summary:
      - Processed: ${results.processed}
      - Failed: ${results.failed}
      - Total Amount: $${results.totalAmount.toFixed(2)}

      ${results.errors.length > 0 ? 'Errors:\n' + results.errors.map(e => `- ${e.creator}: ${e.error}`).join('\n') : 'No errors'}
    `
  });
}
```

## Troubleshooting

### Migration Fails

**Error:** `Missing required environment variables`

**Solution:** Ensure `DATABASE_URL` is set in `backend/.env`

```bash
# Check if DATABASE_URL is set
cd backend
node -e "require('dotenv').config(); console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET')"
```

### Payout Processing Fails

**Error:** `No payout method configured for creator`

**Solution:** Creator needs to complete Stripe Connect onboarding

```sql
-- Check which creators don't have Stripe Connect
SELECT email, username, is_creator, stripe_connect_account_id
FROM users
WHERE is_creator = true AND stripe_connect_account_id IS NULL;
```

### Insufficient Balance Error

**Error:** `Insufficient balance: X available, Y requested`

**Solution:** Check for recent chargebacks

```sql
-- Check creator's recent transactions
SELECT * FROM token_transactions
WHERE user_id = 'creator-uuid'
ORDER BY created_at DESC
LIMIT 20;
```

## Deployment Checklist

- [ ] Run migration 146
- [ ] Set up DATABASE_URL environment variable
- [ ] Configure Stripe Connect
- [ ] Set up cron job (Vercel Cron, system cron, or node-cron)
- [ ] Test withdrawal request endpoint
- [ ] Test earnings summary endpoint
- [ ] Manually test payout processing with test creator
- [ ] Add Stripe Connect onboarding flow
- [ ] Configure email notifications (optional)
- [ ] Deploy to production
- [ ] Monitor first live payout batch
- [ ] Document creator onboarding process

## Quick Commands Reference

```bash
# Run migration
npm run migrate

# Test database connection
npm run db:test

# Run payout job manually
npm run payout:run

# Test payout job
npm run payout:test

# View logs
npm run logs

# Deploy to Vercel
vercel --prod
```

## Support

For issues or questions:
1. Check logs: `tail -f backend/logs/app.log`
2. Check database: `SELECT * FROM withdrawal_requests WHERE status = 'failed';`
3. Review Stripe dashboard for transfer errors
4. Contact Stripe support for Connect-related issues
