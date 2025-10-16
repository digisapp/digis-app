# Database Connection Configuration Guide

## Current Issue

Your `DATABASE_URL` is using the **session pooler** instead of a **direct connection**:

```
Current: postgresql://...@aws-0-us-east-2.pooler.supabase.com:5432/postgres
         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
         This is the pooler host, NOT direct
```

## Why This Matters

Supabase has three connection modes:

| Mode | Host | Port | Max Connections | Use Case |
|------|------|------|----------------|----------|
| **Direct** | `db.<project-ref>.supabase.co` | 5432 | ~60 | **Best for serverless** ✅ |
| Session Pooler | `pooler.supabase.com` | 5432 | Limited | PgBouncer session mode |
| Transaction Pooler | `pooler.supabase.com` | 6543 | ~15 | Fastest per-query |

**Your current setup** uses the session pooler, which can cause "max client connections" errors under load in serverless environments like Vercel.

## Fix: Update to Direct Connection

### Step 1: Get Your Direct Connection URL

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Settings** → **Database**
4. Under **Connection String**, select **URI** format
5. Make sure you're viewing the **Direct connection** tab (NOT "Transaction pooler")
6. Copy the connection string

It should look like:
```
postgresql://postgres.lpphsjowsivjtcmafxnj:JWiYM6v3bq4Imaot@db.lpphsjowsivjtcmafxnj.supabase.co:5432/postgres
                                                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                                              This is the direct host
```

### Step 2: Update Vercel Environment Variable

#### Option A: Via Vercel Dashboard
1. Go to your [Vercel Dashboard](https://vercel.com)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Find `DATABASE_URL`
5. Click **Edit**
6. Replace with your direct connection URL
7. Make sure it's set for **Production**, **Preview**, and **Development**
8. Click **Save**

#### Option B: Via Vercel CLI
```bash
# Remove old variable
vercel env rm DATABASE_URL production

# Add new variable with direct connection
vercel env add DATABASE_URL production
# When prompted, paste your direct connection URL

# Repeat for preview and development
vercel env add DATABASE_URL preview
vercel env add DATABASE_URL development
```

### Step 3: Redeploy

Vercel will automatically redeploy when you save environment variables. Or manually trigger:

```bash
vercel --prod
```

### Step 4: Verify

After deployment, check your Vercel logs. You should see:

```
[DB] host=db.lpphsjowsivjtcmafxnj.supabase.co port=5432 mode=direct
📊 Database pool configured for SERVERLESS environment: {
  max: 2,
  idleTimeout: 1000,
  allowExitOnIdle: true,
  connectionMode: 'direct',
  keepAlive: true
}
```

**Good signs:**
- ✅ `mode=direct`
- ✅ `host=db.<project-ref>.supabase.co`
- ✅ `keepAlive: true`

**Bad signs:**
- ❌ `mode=pooler:session` or `mode=pooler:transaction`
- ❌ `host=pooler.supabase.com`
- ❌ Any warnings about using pooler host

## Optimal Pool Configuration for Serverless

Your pool is already correctly configured for direct connection + serverless:

```javascript
{
  max: 2,                    // Small pool for serverless
  min: 0,                    // Start with no connections
  idleTimeoutMillis: 1000,   // Aggressive cleanup (1s)
  allowExitOnIdle: true,     // Allow Node to exit when idle
  keepAlive: true,           // Keep connections alive (direct only)
  connectionTimeoutMillis: 10000  // 10s timeout
}
```

## Testing Locally (Optional)

Test the direct connection from your terminal:

```bash
psql "postgresql://postgres.lpphsjowsivjtcmafxnj:JWiYM6v3bq4Imaot@db.lpphsjowsivjtcmafxnj.supabase.co:5432/postgres" -c "SELECT now();"
```

If successful, you'll see the current timestamp.

## Troubleshooting

### Still seeing "pooler" in logs?
- Double-check you updated the correct environment variable
- Make sure you redeployed after updating
- Clear any local `.env` files that might override

### Connection timeouts?
- Verify your Supabase project is not paused
- Check Supabase status: https://status.supabase.com
- Ensure your database password doesn't have special characters that need escaping

### "Max client connections" errors?
- This should be resolved by switching to direct connection
- Direct connection supports ~60 concurrent connections vs pooler's 15-20

## Summary

✅ **Before:** Session pooler (`pooler.supabase.com:5432`) - Limited connections
✅ **After:** Direct connection (`db.<ref>.supabase.co:5432`) - Up to 60 connections

This change will eliminate connection pool exhaustion issues in your serverless environment.
