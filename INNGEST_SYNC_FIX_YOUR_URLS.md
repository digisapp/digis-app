# Fix Inngest Sync - Your Specific URLs

## Your Backend URLs

**Production Domain**: `backend-wine-theta-69.vercel.app`
**Preview URL**: `backend-ofh1p3dl1-nathans-projects-43dfdae0.vercel.app`

⚠️ **Problem**: Inngest is trying to sync with the **Preview URL** instead of the **Production Domain**

---

## Quick Fix (2 minutes)

### Step 1: Update Inngest Sync URL

1. Go to Inngest Dashboard: https://app.inngest.com

2. Click **Apps** in sidebar

3. Find and click on your app (`digis-app`)

4. Look for the Sync URL setting

5. Update it to:
   ```
   https://backend-wine-theta-69.vercel.app/api/inngest
   ```

6. Click **"Sync Now"** or **"Save & Sync"**

### Step 2: Verify Functions Appear

After sync completes (30 seconds):

1. Go to **Functions** tab in Inngest Dashboard

2. You should see **9 functions**:
   - ✅ `create-payout-batch` (NEW - V2)
   - ✅ `process-payout-chunk` (NEW - V2)
   - ✅ `retry-failed-payouts-v2` (NEW - V2)
   - ✅ `process-scheduled-payouts` (Legacy)
   - ✅ `retry-failed-payouts` (Legacy)
   - ✅ `update-account-statuses` (Legacy)
   - ✅ `process-single-payout` (Legacy)
   - ✅ `daily-earnings-rollup`
   - ✅ `monthly-earnings-rollup`
   - ✅ `warm-analytics-cache`

---

## Test Your Endpoint (Optional)

Verify the Inngest endpoint is accessible:

```bash
curl https://backend-wine-theta-69.vercel.app/api/inngest
```

Should return a response (might be 405 Method Not Allowed - that's OK, it means the endpoint exists).

Or test your health endpoint:

```bash
curl https://backend-wine-theta-69.vercel.app/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "...",
  "uptime": ...,
  "memory": {...}
}
```

---

## If Sync Still Fails

### Option 1: Redeploy to Production

```bash
cd /Users/examodels/Desktop/digis-app/backend
vercel --prod
```

This will create a fresh production deployment and Inngest should auto-sync.

### Option 2: Check Vercel Logs

1. Go to Vercel Dashboard
2. Click on backend project
3. Click **Logs**
4. Look for any errors when Inngest tries to connect

### Option 3: Remove & Re-add Inngest Integration

1. Vercel Dashboard → Your Backend Project → Settings → Integrations
2. Find Inngest → Click **Manage** → **Remove**
3. Go to https://vercel.com/integrations/inngest
4. Click **Add Integration**
5. Select your backend project
6. This will re-sync everything automatically

---

## Expected Result ✅

**Inngest Dashboard** should show:

**App Status**:
- Name: `digis-app`
- Status: ✅ Connected
- URL: `https://backend-wine-theta-69.vercel.app/api/inngest`
- Last Sync: Just now
- Functions: 9 discovered

**Functions** (All Active):
- ✅ create-payout-batch
- ✅ process-payout-chunk
- ✅ retry-failed-payouts-v2
- ✅ (plus 6 other functions)

---

## After Inngest Sync Works

Continue with deployment:

1. ✅ **Run Database Migration**
   - File: `MANUAL_MIGRATION_V2_PRODUCTION_READY.sql`
   - Run in: https://supabase.com/dashboard/project/lpphsjowsivjtcmafxnj/sql/new

2. ✅ **Add CRON_SECRET to Vercel**
   - Go to: Vercel → Backend → Settings → Environment Variables
   - Add: `CRON_SECRET` = `40180ab69b86ff2a0346af5ea3ac00523cc66211d4c6a92fda7682f0179e7095`

3. ✅ **Test the System**
   - Test UI fixes
   - Test withdrawal endpoints
   - Wait for automated payout (1st or 15th)

---

## Quick Reference

**Your Production Backend**: `https://backend-wine-theta-69.vercel.app`

**Inngest Sync URL**: `https://backend-wine-theta-69.vercel.app/api/inngest`

**Supabase SQL Editor**: https://supabase.com/dashboard/project/lpphsjowsivjtcmafxnj/sql/new

**Inngest Dashboard**: https://app.inngest.com

**Vercel Dashboard**: https://vercel.com/dashboard

---

Good luck! Once Inngest syncs successfully, you're almost done with deployment! 🚀
