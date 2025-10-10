# Add INNGEST_SIGNING_KEY to Vercel - Step by Step

## The Signing Key You Need

```
signkey-prod-719bb75dd4bcdbe09caf59bb120f975e9f06e467f034d2bfa2ed31049e1a226d
```

---

## Step-by-Step Instructions

### Step 1: Open Vercel Dashboard

1. Go to: https://vercel.com/dashboard
2. You should see a list of your projects

### Step 2: Find Your Backend Project

Look for your backend project in the list. It might be named:
- `backend`
- `digis-backend`
- `digis-app-backend`

Click on it to open the project.

### Step 3: Go to Settings

1. At the top of the page, you'll see tabs: **Overview**, **Deployments**, **Analytics**, **Settings**, etc.
2. Click on **"Settings"** (usually the last tab)

### Step 4: Go to Environment Variables

1. On the left sidebar in Settings, you'll see options like:
   - General
   - Domains
   - **Environment Variables** ← Click this one
   - Git
   - etc.

2. Click **"Environment Variables"**

### Step 5: Add New Variable

1. You'll see a section that says **"Environment Variables"** with an input form

2. Fill in the form:
   - **Name (Key)**: Type exactly: `INNGEST_SIGNING_KEY`
   - **Value**: Copy and paste this:
     ```
     signkey-prod-719bb75dd4bcdbe09caf59bb120f975e9f06e467f034d2bfa2ed31049e1a226d
     ```

3. Below the value field, you'll see checkboxes for environments:
   - ✅ Check **Production**
   - ✅ Check **Preview**
   - ✅ Check **Development**

4. Click the **"Save"** button (usually blue button on the right)

### Step 6: Verify It Was Added

After saving, you should see the new variable in the list:
- Name: `INNGEST_SIGNING_KEY`
- Value: `signkey-prod-...` (partially hidden for security)
- Environments: Production, Preview, Development

---

## Step 7: Add CRON_SECRET While You're Here

Since you're already in Environment Variables, let's add the other one too:

1. Click **"Add Another"** or scroll down to the empty form

2. Fill in:
   - **Name**: `CRON_SECRET`
   - **Value**:
     ```
     40180ab69b86ff2a0346af5ea3ac00523cc66211d4c6a92fda7682f0179e7095
     ```
   - **Environments**: Check all 3 (Production, Preview, Development)

3. Click **"Save"**

---

## Step 8: Redeploy Your Backend

After adding environment variables, you MUST redeploy for them to take effect.

**Option A: Redeploy via Vercel Dashboard**

1. Go back to your project overview (click your project name at the top)
2. Go to **"Deployments"** tab
3. Find the latest deployment (first one in the list)
4. Click the **"..."** menu on the right
5. Click **"Redeploy"**
6. Confirm the redeploy

**Option B: Redeploy via Terminal** (Easier)

Open your terminal and run:

```bash
cd /Users/examodels/Desktop/digis-app/backend
vercel --prod
```

Wait for the deployment to complete (usually 1-2 minutes).

---

## Step 9: Sync with Inngest

After the redeploy finishes:

1. Go back to Inngest Dashboard: https://app.inngest.com
2. Go to the sync screen you had open
3. Make sure it still shows:
   - App URL: `https://backend-wine-theta-69.vercel.app/api/inngest`
   - Signing Key: `signkey-prod-719bb75dd4bcdbe09caf59bb120f975e9f06e467f034d2bfa2ed31049e1a226d`
4. Click **"Sync app"**
5. Wait ~30 seconds

---

## ✅ Success Looks Like

After sync completes, in Inngest Dashboard you'll see:

**Apps Page**:
- Your app appears in the list
- Status: Active (green)
- Functions: 9

**Functions Page**:
Click on your app and you'll see all 9 functions listed:
- create-payout-batch
- process-payout-chunk
- retry-failed-payouts-v2
- process-scheduled-payouts
- retry-failed-payouts
- update-account-statuses
- process-single-payout
- daily-earnings-rollup
- monthly-earnings-rollup
- warm-analytics-cache

---

## 🆘 Troubleshooting

### Can't find Environment Variables in Vercel?

Make sure you're:
1. In the correct project (backend, not frontend)
2. In **Settings** tab (not Overview or Deployments)
3. Looking in the left sidebar for "Environment Variables"

### Don't see the "Save" button?

- Make sure you filled in both Name and Value
- Make sure at least one environment is checked

### Sync still fails after adding key?

- Make sure you redeployed after adding the key
- Wait 2-3 minutes for deployment to complete
- Try the sync again

### "Could not reach URL" error?

Test your backend is running:
```bash
curl https://backend-wine-theta-69.vercel.app/health
```

Should return: `{"status":"healthy",...}`

If that fails, your backend isn't deployed properly. Try redeploying.

---

## Summary of What You're Adding

**Two environment variables**:

1. `INNGEST_SIGNING_KEY` = `signkey-prod-719bb75dd4bcdbe09caf59bb120f975e9f06e467f034d2bfa2ed31049e1a226d`
   - Allows Inngest to securely communicate with your backend

2. `CRON_SECRET` = `40180ab69b86ff2a0346af5ea3ac00523cc66211d4c6a92fda7682f0179e7095`
   - Allows Vercel Cron to trigger payout batches

**Both** should be set for all environments (Production, Preview, Development).

---

Let me know which step you're stuck on and I can provide more detailed help! 🚀
