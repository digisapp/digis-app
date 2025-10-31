# Firebase to Supabase UUID Migration Guide

## Overview

This guide explains how to complete the migration from Firebase UID to Supabase UUID throughout the application.

## Current Status

✅ **Backend Code**: All Firebase references removed from `/backend/routes`
✅ **Frontend Code**: No Firebase references found
✅ **Database Queries**: Updated to use `supabase_id::text` for JOINs
⚠️ **Database Schema**: Still has legacy `firebase_uid` column in some environments

## What This Migration Does

1. Ensures `supabase_id` column exists and is properly configured (UUID, NOT NULL, UNIQUE)
2. Removes `firebase_uid` column from users table if it exists
3. Drops all Firebase-related foreign key constraints
4. Creates performance indexes on `supabase_id` and related columns
5. Verifies no Firebase references remain

## How to Run the Migration

### Option 1: Using the Shell Script (Recommended)

```bash
cd backend

# Set your database connection string
export DATABASE_URL="postgresql://user:password@host:5432/database"

# Run the migration script
./run_firebase_removal.sh
```

The script will:
- Check if DATABASE_URL is set
- Ask for confirmation before proceeding
- Create a backup of current schema
- Run the migration
- Verify the results

### Option 2: Manual Execution

```bash
# Connect to your database
psql "$DATABASE_URL"

# Run the migration
\i migrations/999_complete_firebase_removal.sql
```

### Option 3: Via Vercel (Production)

If you're using Vercel with Supabase:

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Copy the contents of `migrations/999_complete_firebase_removal.sql`
4. Paste and execute

## Verification

After running the migration, verify everything is working:

### 1. Check Database Schema

```sql
-- Verify firebase_uid is gone
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'users' AND column_name LIKE '%firebase%';
-- Should return 0 rows

-- Verify supabase_id exists and is configured
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'supabase_id';
-- Should show: supabase_id | uuid | NO | NULL
```

### 2. Test API Endpoints

```bash
# Test creator stats endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://backend-digis.vercel.app/api/v1/creators/stats

# Should return: {"success":true,"followersCount":0,"subscribersCount":0}
```

### 3. Test Application Features

- ✅ User login/signup
- ✅ Creator dashboard loads
- ✅ Followers list displays
- ✅ Subscribers list displays
- ✅ Profile navigation works

## What Changed

### Database Schema

**Before:**
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(255) UNIQUE NOT NULL,  -- OLD
    supabase_id UUID,                            -- Optional
    ...
);

CREATE TABLE followers (
    follower_id VARCHAR(255) REFERENCES users(firebase_uid)  -- OLD
);
```

**After:**
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    supabase_id UUID UNIQUE NOT NULL,            -- PRIMARY ID
    ...
);

CREATE TABLE followers (
    follower_id VARCHAR(255)  -- Stores supabase_id as text
);
```

### Backend Queries

**Before:**
```javascript
JOIN users u ON u.firebase_uid = f.follower_id
```

**After:**
```javascript
JOIN users u ON u.supabase_id::text = f.follower_id
```

## Rollback (Emergency Only)

If you need to rollback (not recommended):

1. Restore from the backup created by the script:
   ```bash
   # Find your backup file
   ls -l backup_before_firebase_removal_*.sql

   # Restore (consult DBA first!)
   ```

2. Revert the code changes:
   ```bash
   git revert 4102eae f38c17b
   git push origin main
   ```

## Troubleshooting

### Error: "column firebase_uid does not exist"

This is expected if you run the migration twice. The migration is idempotent and safe to re-run.

### Error: "Cannot make supabase_id NOT NULL"

Some users don't have a supabase_id. You need to populate them first:

```sql
-- Check which users are missing supabase_id
SELECT id, email, username
FROM users
WHERE supabase_id IS NULL;

-- You'll need to generate UUIDs for them or clean them up
```

### API Returns 500 Error After Migration

Check the error logs:
```bash
vercel logs production
```

Common issues:
- Old deployment still running (wait 60 seconds for new deployment)
- Browser cache (hard refresh with Cmd+Shift+R)
- Database connection issue (check DATABASE_URL)

## Support

If you encounter issues:
1. Check Vercel logs: `vercel logs production`
2. Check database connection: Ensure DATABASE_URL is correct
3. Verify migration ran: Check for Firebase columns
4. Clear browser cache: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

## Files Changed

- `backend/routes/creators.js` - Updated to use `supabase_id::text`
- `backend/migrations/999_complete_firebase_removal.sql` - Migration script
- `backend/run_firebase_removal.sh` - Execution script
- `backend/FIREBASE_REMOVAL_GUIDE.md` - This guide

## Next Steps

After successful migration:

1. ✅ Monitor production for 24-48 hours
2. ✅ Check error rates in Vercel dashboard
3. ✅ Verify user authentication works
4. ✅ Test all creator features
5. ✅ Test all fan features
6. 🗑️ Archive old Firebase migration scripts (optional)

---

**Migration completed on:** Run `./run_firebase_removal.sh` to execute
**Status:** ⏳ Pending execution on production database
