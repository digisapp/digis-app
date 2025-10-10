# Fix Inngest Sync Error

## Problem
Inngest shows: "We could not reach your URL"

This happens because Inngest is trying to sync with a preview deployment URL instead of your production URL.

## Solution

### Step 1: Get Your Production Backend URL

1. Go to Vercel Dashboard: https://vercel.com/dashboard
2. Click on your **Backend** project
3. Look for the **Production** deployment (not Preview)
4. Copy the production URL (something like `https://backend.vercel.app`)

### Step 2: Update Inngest Sync URL

1. Go to Inngest Dashboard: https://app.inngest.com
2. Click on **Apps** in the sidebar
3. Find your app (should be "digis-app")
4. Click on the app to open settings
5. Look for **"Sync URL"** or **"Webhook URL"**
6. Update it to:
   ```
   https://YOUR-PRODUCTION-BACKEND-URL.vercel.app/api/inngest
   ```
   Replace `YOUR-PRODUCTION-BACKEND-URL` with your actual production backend URL

7. Click **"Save"** or **"Sync Now"**

### Step 3: Manually Trigger Sync

After updating the URL:

1. In Inngest Dashboard, click **"Sync"** or **"Sync Functions"**
2. Wait for the sync to complete (~30 seconds)
3. You should now see your functions appear:
   - `create-payout-batch`
   - `process-payout-chunk`
   - `retry-failed-payouts-v2`
   - Plus legacy functions

### Step 4: Verify Functions Appeared

1. In Inngest Dashboard, go to **Functions**
2. You should see all your payout functions listed
3. Status should show "Active" or "Ready"

---

## Alternative: Redeploy Backend

If updating the URL doesn't work:

```bash
cd /Users/examodels/Desktop/digis-app/backend
vercel --prod
```

After deployment completes:
1. Copy the new production URL
2. Update Inngest sync URL (Step 2 above)
3. Trigger sync (Step 3 above)

---

## Verify It's Working

### Test 1: Check Inngest Endpoint

```bash
curl https://YOUR-PRODUCTION-BACKEND-URL.vercel.app/api/inngest
```

Expected response: HTML page (Inngest UI in development) or 405 Method Not Allowed (production)

### Test 2: Trigger Test Event

```bash
curl -X POST https://YOUR-PRODUCTION-BACKEND-URL.vercel.app/api/inngest/trigger \
  -H "Content-Type: application/json" \
  -d '{"name": "test/hello", "data": {}}'
```

Expected response:
```json
{
  "success": true,
  "eventId": "...",
  "eventName": "test/hello"
}
```

---

## Common Issues

### Issue: Still getting "Could not reach URL"

**Check**:
1. Is the URL correct? (Should be production, not preview)
2. Is `/api/inngest` at the end of the URL?
3. Is your backend deployed and running?

**Fix**:
- Verify backend is deployed: Visit `https://YOUR-BACKEND-URL.vercel.app/health`
- Should return `{"status": "healthy", ...}`

### Issue: "Signature verification failed"

**Check**: `INNGEST_SIGNING_KEY` environment variable in Vercel

**Fix**:
1. Vercel → Backend Project → Settings → Environment Variables
2. Verify `INNGEST_SIGNING_KEY` is set
3. If not, the Inngest integration should have set it automatically
4. Try removing and re-adding the Inngest integration

### Issue: Functions not appearing after sync

**Check**: Look for errors in Vercel deployment logs

**Fix**:
1. Vercel → Backend Project → Deployments → Click latest
2. Look for errors in "Functions" tab
3. Common issue: Missing dependencies
4. Redeploy if needed

---

## Expected Result

After successful sync, you should see in Inngest Dashboard:

**Apps**:
- ✅ digis-app
- ✅ Status: Connected
- ✅ Last Sync: Just now

**Functions** (should see 9 total):
- ✅ create-payout-batch (NEW - V2)
- ✅ process-payout-chunk (NEW - V2)
- ✅ retry-failed-payouts-v2 (NEW - V2)
- ✅ process-scheduled-payouts (Legacy)
- ✅ retry-failed-payouts (Legacy)
- ✅ update-account-statuses (Legacy)
- ✅ process-single-payout (Legacy)
- ✅ daily-earnings-rollup
- ✅ monthly-earnings-rollup
- ✅ warm-analytics-cache

All should show status "Active" or "Ready".

---

## Next Steps After Fix

Once Inngest sync succeeds:

1. ✅ Continue with database migration (MANUAL_MIGRATION_V2_PRODUCTION_READY.sql)
2. ✅ Add CRON_SECRET to Vercel
3. ✅ Test the complete payout flow
4. ✅ Wait for first automated run (1st or 15th)

---

## Need Help?

If you're still stuck after trying these steps:

1. Check Vercel deployment logs for errors
2. Check Inngest dashboard for error details
3. Try the "Alternative: Redeploy Backend" option above

Good luck! 🚀
