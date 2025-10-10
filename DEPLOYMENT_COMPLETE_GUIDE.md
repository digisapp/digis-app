# Complete Deployment Guide - Digis App

## ✅ What's Been Completed

### 1. UI Fixes
- ✅ Fixed self-following issue (creators won't see themselves in followers list)
- ✅ Fixed "Calls" menu navigation in Profile dropdown
- ✅ Fixed Profile dropdown not closing on some pages
- ✅ Verified follower username navigation to public profiles

### 2. Bi-Monthly Withdrawal System
- ✅ Database schema (Migration 146)
- ✅ Backend API endpoints for withdrawal requests
- ✅ Stripe Connect integration routes
- ✅ Automated payout processing logic
- ✅ **NEW:** Vercel Cron job configuration

### 3. Environment Configuration
- ✅ `.env` file created with all credentials
- ✅ CRON_SECRET generated for secure cron job authentication

---

## 🚀 Deployment Steps

### Step 1: Run Database Migration (REQUIRED - Do this first!)

1. Go to Supabase SQL Editor:
   https://supabase.com/dashboard/project/lpphsjowsivjtcmafxnj/sql/new

2. Open the file: `/Users/examodels/Desktop/digis-app/MANUAL_MIGRATION.sql`

3. Copy the entire contents and paste into the SQL Editor

4. Click **"Run"** to execute the migration

5. Verify success - you should see:
   - ✅ `withdrawal_requests` table created
   - ✅ Columns added to `users` table
   - ✅ Views and functions created

### Step 2: Add Environment Variables to Vercel

You need to add the `CRON_SECRET` to your Vercel project:

#### For Backend Deployment:

1. Go to your Vercel dashboard:
   https://vercel.com/dashboard

2. Select your **backend** project

3. Go to **Settings** → **Environment Variables**

4. Add this variable:
   ```
   Name: CRON_SECRET
   Value: 40180ab69b86ff2a0346af5ea3ac00523cc66211d4c6a92fda7682f0179e7095
   ```

5. Make sure it's available for **Production**, **Preview**, and **Development**

6. Click **Save**

### Step 3: Deploy to Vercel

#### Deploy Backend:

```bash
cd /Users/examodels/Desktop/digis-app/backend
vercel --prod
```

This will:
- Deploy your updated backend code
- Set up the cron job to run at 2 AM on the 1st and 15th of each month
- Enable the withdrawal system endpoints

#### Deploy Frontend:

```bash
cd /Users/examodels/Desktop/digis-app/frontend
vercel --prod
```

This will deploy the UI fixes.

### Step 4: Verify Vercel Cron Job

After deployment:

1. Go to your Vercel project dashboard
2. Click on **Settings** → **Cron Jobs**
3. You should see:
   ```
   Path: /api/cron/payouts
   Schedule: 0 2 1,15 * * (At 2 AM on the 1st and 15th)
   Status: Active
   ```

---

## 🧪 Testing

### Test 1: UI Fixes (Local Testing)

Start your frontend locally:
```bash
cd /Users/examodels/Desktop/digis-app/frontend
npm start
```

Test:
1. Login as Miriam (creator account)
2. Check Followers page - Miriam should NOT appear in her own followers
3. Click Profile dropdown → "Calls" - should navigate to Call Requests page
4. Open/close Profile dropdown on different pages - should close properly
5. Click on a follower's username - should navigate to their public profile

### Test 2: Withdrawal Endpoints (After Migration)

#### Get Earnings Summary:
```bash
curl -X GET https://your-backend-url.vercel.app/api/tokens/earnings \
  -H "Authorization: Bearer YOUR_CREATOR_TOKEN"
```

Expected response:
```json
{
  "success": true,
  "earnings": {
    "totalEarned": 0,
    "totalPaidOut": 0,
    "availableBalance": 0,
    "bufferedEarnings": 0,
    "pendingWithdrawals": 0,
    "nextPayoutDate": "2025-11-01"
  }
}
```

#### Request Withdrawal:
```bash
curl -X POST https://your-backend-url.vercel.app/api/tokens/request-withdrawal \
  -H "Authorization: Bearer YOUR_CREATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tokenAmount": 1000}'
```

#### View Withdrawal Requests:
```bash
curl -X GET https://your-backend-url.vercel.app/api/tokens/withdrawal-requests \
  -H "Authorization: Bearer YOUR_CREATOR_TOKEN"
```

### Test 3: Manual Payout Test (Optional)

Test the payout processing manually (requires migration to be complete):

```bash
cd /Users/examodels/Desktop/digis-app/backend
npm run payout:test
```

---

## 📋 Vercel Cron Job Details

### Schedule
- **Runs on**: 1st and 15th of every month
- **Time**: 2:00 AM UTC
- **Endpoint**: `/api/cron/payouts`

### How It Works
1. Vercel automatically calls the endpoint at scheduled times
2. The endpoint verifies the `CRON_SECRET` for security
3. Processes all pending withdrawal requests for that payout date
4. Creates Stripe transfers to creator accounts
5. Updates withdrawal request statuses
6. Logs all activity

### Monitoring

Check cron job execution:
1. Go to Vercel Dashboard → Your Project
2. Click **Logs** or **Functions**
3. Filter by `/api/cron/payouts`
4. View execution logs and results

---

## 🔐 Security Notes

### CRON_SECRET
- **Value**: `40180ab69b86ff2a0346af5ea3ac00523cc66211d4c6a92fda7682f0179e7095`
- **Purpose**: Prevents unauthorized access to the cron endpoint
- **Required**: Must be set in Vercel environment variables
- **Location**: Already in `/Users/examodels/Desktop/digis-app/backend/.env` (local only)

⚠️ **IMPORTANT**: Make sure to add this to Vercel's environment variables, not just your local `.env` file!

---

## 📂 Files Modified/Created

### Backend Files:
1. `backend/routes/creators.js` - Added self-following filter
2. `backend/api/cron/payouts.js` - **NEW** Vercel cron endpoint
3. `backend/vercel.json` - Added cron configuration
4. `backend/.env` - Added CRON_SECRET

### Frontend Files:
1. `frontend/src/components/ProfileDropdown.js` - Fixed navigation and dropdown closing

### Documentation:
1. `MANUAL_MIGRATION.sql` - Database migration script
2. `DEPLOYMENT_COMPLETE_GUIDE.md` - **NEW** This file

---

## ⏭️ Next Actions (In Order)

1. ✅ **Run MANUAL_MIGRATION.sql** in Supabase (Step 1 above)
2. ✅ **Add CRON_SECRET** to Vercel environment variables (Step 2 above)
3. ✅ **Deploy backend** to Vercel (Step 3 above)
4. ✅ **Deploy frontend** to Vercel (Step 3 above)
5. ✅ **Test withdrawal endpoints** (Test 2 above)
6. ✅ **Configure Stripe Connect** (if not already done)
7. ✅ **Monitor first payout** on Nov 1st or 15th

---

## 🎯 Quick Command Reference

```bash
# Local Development
cd backend && npm run dev              # Start backend
cd frontend && npm start               # Start frontend

# Testing
npm run payout:test                    # Test payout processing
npm run db:test                        # Test database connection

# Deployment
vercel --prod                          # Deploy to production

# Database
npm run migrate                        # Run migrations (alternative to manual)
```

---

## ❓ Troubleshooting

### Cron job not running?
- Check Vercel Dashboard → Settings → Cron Jobs
- Verify CRON_SECRET is set in environment variables
- Check deployment logs for errors

### Migration failed?
- Verify database connection in Supabase
- Check for existing tables with same names
- Try running migration line-by-line

### Withdrawal endpoints not working?
- Ensure migration has been run
- Check that user is authenticated
- Verify creator has available balance

---

## 🎉 You're Ready!

Once you complete Steps 1-3:
- ✅ All UI fixes will be live
- ✅ Creators can request withdrawals
- ✅ Payouts will process automatically on 1st and 15th
- ✅ All systems fully operational

Good luck! 🚀
