# Next Steps - Bi-Monthly Withdrawal System

## ✅ What's Been Completed

I've successfully implemented the complete bi-monthly creator withdrawal system with the following components:

### 1. **Database Schema** (Migration 146)
- ✅ `withdrawal_requests` table
- ✅ `creator_payout_history` view
- ✅ `get_creator_earnings_summary()` function
- ✅ `get_pending_payouts_for_date()` function
- ✅ Added Stripe Connect fields to `users` table

### 2. **Backend Logic**
- ✅ `utils/payout-scheduler.js` - Core payout processing logic
  - 7-day chargeback buffer
  - Bi-monthly schedule (1st and 15th)
  - Balance verification
  - Stripe Connect integration ready
- ✅ `jobs/payout-cron.js` - Automated job runner
- ✅ `jobs/reconciliation.js` - Already exists for ledger health

### 3. **API Endpoints** (Added to `routes/tokens.js`)
- ✅ `GET /api/tokens/earnings` - View creator earnings dashboard
- ✅ `POST /api/tokens/request-withdrawal` - Create withdrawal request
- ✅ `GET /api/tokens/withdrawal-requests` - View withdrawal history
- ✅ `DELETE /api/tokens/withdrawal-requests/:id` - Cancel pending request

### 4. **Stripe Connect Routes** (New file: `routes/stripe-connect.js`)
- ✅ `POST /api/stripe-connect/create-account` - Create Connect account
- ✅ `POST /api/stripe-connect/onboarding-link` - Generate onboarding link
- ✅ `GET /api/stripe-connect/account-status` - Check connection status
- ✅ `POST /api/stripe-connect/dashboard-link` - Access Stripe dashboard
- ✅ `DELETE /api/stripe-connect/disconnect` - Disconnect account

### 5. **Documentation**
- ✅ `WITHDRAWAL_SYSTEM.md` - Complete system documentation
- ✅ `DEPLOYMENT_STEPS.md` - Detailed deployment guide
- ✅ `scripts/setup-withdrawal-system.sh` - Automated setup script

### 6. **NPM Scripts** (Added to `package.json`)
- ✅ `npm run payout:run` - Run payout job manually
- ✅ `npm run payout:test` - Test payout processing

---

## 🚀 What You Need to Do Now

### **Step 1: Get Your Database URL**

You need to add your Supabase database credentials to the backend.

1. Go to: https://supabase.com/dashboard/project/lpphsjowsivjtcmafxnj
2. Click "Project Settings" → "Database"
3. Scroll to "Connection String" → "URI"
4. Copy the connection string

### **Step 2: Create `.env` File**

```bash
cd /Users/examodels/Desktop/digis-app/backend
nano .env
```

Add this line (replace `[YOUR-PASSWORD]` with your actual Supabase password):

```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.lpphsjowsivjtcmafxnj.supabase.co:5432/postgres
```

Save and exit (Ctrl+X, then Y, then Enter).

### **Step 3: Run the Setup Script**

```bash
cd /Users/examodels/Desktop/digis-app/backend
./scripts/setup-withdrawal-system.sh
```

This will:
1. Check database connection
2. Run migration 146
3. Verify tables were created
4. Check Stripe configuration

**OR** run manually:

```bash
# Test database connection
npm run db:test

# Run migration
npm run migrate

# Verify
npm run db:test
```

### **Step 4: Set Up Automated Payouts**

Choose ONE of the following options:

#### Option A: Vercel Cron Jobs (Recommended for Vercel)

1. Create `backend/api/cron/payouts.js`:

```javascript
const { runPayoutJob } = require('../../jobs/payout-cron');

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

2. Add to `backend/vercel.json`:

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

3. Add to `.env`:

```env
CRON_SECRET=your_random_secret_here_min_32_chars
```

4. Deploy:

```bash
vercel --prod
```

#### Option B: System Cron (For VPS/EC2)

```bash
# Edit crontab
crontab -e

# Add this line (runs at 2 AM on 1st and 15th of each month)
0 2 1,15 * * cd /Users/examodels/Desktop/digis-app/backend && npm run payout:run >> /var/log/digis-payouts.log 2>&1
```

#### Option C: node-cron (For always-running Node.js)

Already set up! The scheduler will automatically run when you start the backend in production mode.

### **Step 5: Configure Stripe Connect**

1. Go to https://dashboard.stripe.com/connect/overview
2. Enable "Stripe Connect" if not already enabled
3. Choose "Express" account type
4. Configure payout settings

Add to `.env`:

```env
STRIPE_SECRET_KEY=sk_test_your_stripe_key
# Or for production:
# STRIPE_SECRET_KEY=sk_live_your_stripe_key
```

### **Step 6: Test the System**

#### Test 1: View Earnings (as a creator)

```bash
curl -X GET http://localhost:3005/api/tokens/earnings \
  -H "Authorization: Bearer YOUR_CREATOR_TOKEN"
```

#### Test 2: Request Withdrawal

```bash
curl -X POST http://localhost:3005/api/tokens/request-withdrawal \
  -H "Authorization: Bearer YOUR_CREATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tokenAmount": 1000}'
```

#### Test 3: View Withdrawal Requests

```bash
curl -X GET http://localhost:3005/api/tokens/withdrawal-requests \
  -H "Authorization: Bearer YOUR_CREATOR_TOKEN"
```

#### Test 4: Test Payout Processing (Manual)

```bash
cd backend
npm run payout:test
```

---

## 📋 Deployment Checklist

Use this to track your progress:

- [ ] Create `.env` file with `DATABASE_URL`
- [ ] Run setup script: `./scripts/setup-withdrawal-system.sh`
- [ ] Verify migration: `npm run db:test`
- [ ] Add `STRIPE_SECRET_KEY` to `.env`
- [ ] Choose cron option (Vercel/System/node-cron)
- [ ] Configure Stripe Connect in dashboard
- [ ] Test earnings endpoint
- [ ] Test withdrawal request endpoint
- [ ] Test payout processing manually
- [ ] Deploy to production
- [ ] Monitor first payout batch (1st or 15th of month)

---

## 🎯 Quick Commands Reference

```bash
# Database
npm run migrate                 # Run migrations
npm run db:test                # Test connection

# Payouts
npm run payout:run             # Run payout job manually
npm run payout:test            # Test payout processing

# Development
npm run dev                    # Start backend dev server
npm run logs                   # View logs

# Deployment
vercel --prod                  # Deploy to Vercel
```

---

## 📚 Documentation Files

- **WITHDRAWAL_SYSTEM.md** - Complete system documentation
  - API reference
  - Database schema
  - Configuration options
  - Troubleshooting guide

- **DEPLOYMENT_STEPS.md** - Detailed deployment guide
  - Step-by-step instructions
  - Vercel setup
  - Stripe Connect onboarding
  - Email notifications setup

- **LEDGER_IMPROVEMENTS.md** - Ledger security documentation (already exists)

---

## ❓ FAQ

**Q: Where do I find my Supabase password?**
A: Go to your Supabase project → Project Settings → Database → Connection String. It's in the URI format.

**Q: Do I need to run the migration now?**
A: Yes, the migration creates the necessary database tables. Run `npm run migrate` after setting up `.env`.

**Q: Can I test without Stripe?**
A: Yes! You can create withdrawal requests and view earnings without Stripe. You'll only need Stripe when actually processing payouts.

**Q: When will the first payout run?**
A: The cron job runs at 2 AM on the 1st and 15th of each month. You can test manually with `npm run payout:test`.

**Q: How do I know if it's working?**
A: Check the logs at `backend/logs/app.log` or run `npm run logs` to see payout processing status.

---

## 🆘 Troubleshooting

### Can't connect to database

```bash
# Check if DATABASE_URL is set correctly
node -e "require('dotenv').config(); console.log('DATABASE_URL:', process.env.DATABASE_URL)"
```

### Migration fails

```bash
# Check database connection first
npm run db:test

# Try running migration with verbose output
NODE_ENV=development npm run migrate
```

### Payout job fails

```bash
# Check logs
cat backend/logs/app.log | grep payout

# Test manually
npm run payout:test
```

---

## 🎉 You're Almost Done!

The system is fully implemented and ready to go. Just need to:

1. Add your database credentials to `.env`
2. Run the migration
3. Set up automated payouts (choose your cron option)
4. Test the endpoints

Then you're live! Creators can request withdrawals and they'll be processed automatically on the 1st and 15th of each month.

---

## 📞 Need Help?

If you get stuck:

1. Check the logs: `npm run logs`
2. Review the documentation: `WITHDRAWAL_SYSTEM.md`
3. Check database: `npm run db:test`
4. View detailed deployment guide: `DEPLOYMENT_STEPS.md`

Good luck! 🚀
