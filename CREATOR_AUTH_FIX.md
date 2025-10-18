# Creator Authentication Fix

## Problem Identified

Creators (like Miriam) were logging in but showing as fan accounts, with these errors:
```
GET /api/v1/auth/session 404 (Not Found)
GET /api/v1/users/profile 404 (Not Found)
GET /api/v1/auth/verify-role 404 (Not Found)
```

### Root Cause

The `/auth/sync-user` endpoint had **two critical bugs**:

1. **Missing `role` column** - The INSERT query didn't set the `role` column, only `is_creator`
2. **No updates on conflict** - When a user logged in again, the ON CONFLICT clause didn't update `is_creator` or `role`, so creators stayed as fans forever

---

## ✅ Fix Deployed (Commit 93899a6)

### Changes Made

1. **Added `role` column to INSERT** (line 190)
   ```sql
   INSERT INTO users (..., is_creator, role, ...)
   VALUES (..., $5, $6, ...)
   ```

2. **Calculate role from is_creator** (line 175)
   ```javascript
   const roleForUpsert = isCreatorForUpsert ? 'creator' : 'fan';
   ```

3. **ON CONFLICT now updates creator status** (lines 220-221)
   ```sql
   ON CONFLICT (supabase_id) DO UPDATE SET
     is_creator = EXCLUDED.is_creator,
     role = EXCLUDED.role,
     username = COALESCE(EXCLUDED.username, users.username),
     display_name = COALESCE(EXCLUDED.display_name, users.display_name),
     ...
   ```

4. **Added logging for verification** (lines 247-253)
   ```javascript
   console.log('✅ sync-user upsert successful', {
     rid,
     supabaseId,
     username: upsertResult.rows[0]?.username,
     is_creator: upsertResult.rows[0]?.is_creator,
     role: upsertResult.rows[0]?.role
   });
   ```

---

## 🚨 Immediate Fix for Miriam

### Step 1: Run SQL Script to Upgrade Miriam

The fix is deployed but **won't help Miriam until she logs in again with the correct metadata**. To fix her account immediately:

```bash
# Connect to your Supabase database
psql "$DATABASE_URL"
```

Then run:
```sql
-- Update Miriam to be a creator
UPDATE users
SET
  is_creator = true,
  role = 'creator',
  updated_at = NOW()
WHERE supabase_id = '963af068-edb0-4d12-8e8e-cfdb270eea26';

-- Verify the fix
SELECT
  supabase_id,
  email,
  username,
  display_name,
  role,
  is_creator
FROM users
WHERE supabase_id = '963af068-edb0-4d12-8e8e-cfdb270eea26';
```

Expected output:
```
 supabase_id                          | email          | username | display_name | role    | is_creator
--------------------------------------+----------------+----------+--------------+---------+------------
 963af068-edb0-4d12-8e8e-cfdb270eea26 | miriam@...     | miriam   | Miriam       | creator | t
```

**Alternative**: Use the provided SQL script:
```bash
psql "$DATABASE_URL" -f backend/fix_miriam_creator.sql
```

### Step 2: Clear Frontend Auth State

After updating the database, clear Miriam's cached auth state:

**In Browser Console** (while on digis.cc):
```javascript
// Clear all auth-related localStorage
localStorage.removeItem('supabase.auth.token');
localStorage.removeItem('sb-auth-token');
localStorage.removeItem('user');
localStorage.removeItem('userRole');

// Clear session storage
sessionStorage.clear();

// Reload
window.location.reload();
```

**Or just**:
```javascript
// Hard refresh
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### Step 3: Log In Again

1. Go to https://digis.cc/login
2. Sign in as Miriam
3. **The frontend should now show creator dashboard**

---

## 🔍 How to Verify It's Working

### Backend Logs (Vercel)

After Miriam logs in, check Vercel logs for:
```
✅ sync-user upsert successful {
  rid: '...',
  supabaseId: '963af068-edb0-4d12-8e8e-cfdb270eea26',
  username: 'miriam',
  is_creator: true,
  role: 'creator'
}
```

### Frontend Network Tab

1. Open DevTools → Network
2. Filter: `session`
3. Find `GET /api/v1/auth/session`
4. **Should return 200** with:
   ```json
   {
     "ok": true,
     "user": {
       "supabase_id": "963af068-edb0-4d12-8e8e-cfdb270eea26",
       "email": "...",
       "username": "miriam",
       "is_creator": true,
       "role": "creator"
     }
   }
   ```

### Database Check

```sql
SELECT supabase_id, email, username, role, is_creator
FROM users
WHERE supabase_id = '963af068-edb0-4d12-8e8e-cfdb270eea26';
```

Should show:
- `role`: `creator`
- `is_creator`: `true`

---

## 🔧 How Frontend Should Call sync-user

**The frontend needs to send `account_type` in metadata** when calling `/auth/sync-user`:

### Correct Implementation

```javascript
// After successful Supabase login
const { data: { session } } = await supabase.auth.getSession();

// Call sync-user with account_type
await apiClient.post('/api/v1/auth/sync-user', {
  supabaseId: session.user.id,
  email: session.user.email,
  metadata: {
    account_type: 'creator',  // ← THIS IS CRITICAL
    username: 'miriam'
  }
});

// Now fetch profile
const profile = await apiClient.get('/api/v1/users/profile');
```

### Check Current Frontend Implementation

Search for where `sync-user` is called:

```bash
# Find sync-user calls
grep -rn "sync-user" frontend/src --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx"
```

Make sure it includes:
```javascript
metadata: {
  account_type: userType // 'creator' or 'fan'
}
```

---

## 📊 Before vs After

### Before (Broken)

```sql
-- First login
INSERT INTO users (supabase_id, email, username, is_creator)
VALUES ('963af...', 'miriam@...', 'miriam', true);
-- ❌ role column is NULL or defaults to 'fan'

-- Second login
ON CONFLICT (supabase_id) DO UPDATE SET
  email = EXCLUDED.email,
  last_active = NOW();
-- ❌ is_creator and role NEVER updated
```

Result: Creator forever stuck as fan

### After (Fixed)

```sql
-- First login
INSERT INTO users (supabase_id, email, username, is_creator, role)
VALUES ('963af...', 'miriam@...', 'miriam', true, 'creator');
-- ✅ Both is_creator and role set correctly

-- Second login
ON CONFLICT (supabase_id) DO UPDATE SET
  email = EXCLUDED.email,
  is_creator = EXCLUDED.is_creator,
  role = EXCLUDED.role,
  last_active = NOW();
-- ✅ Creator status updated on every login
```

Result: Role always matches metadata

---

## 🎯 Testing Checklist

- [ ] Run SQL script to fix Miriam's account
- [ ] Clear frontend localStorage/sessionStorage
- [ ] Log in as Miriam
- [ ] Verify backend logs show `role: 'creator'`
- [ ] Verify `/auth/session` returns 200 with `is_creator: true`
- [ ] Verify creator dashboard loads (not fan view)
- [ ] Verify no 404 errors in console
- [ ] Test with a new creator account to ensure it works from signup

---

## 🐛 If Still Not Working

### Check 1: Authorization Header

Open DevTools → Network → `session` request → Headers

**Should have**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**If missing**: Frontend apiClient interceptor isn't working. Check:
```javascript
// frontend/src/utils/apiClient.js
apiClient.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});
```

### Check 2: CORS Preflight

If you see `(CORS error)` or `preflight`:

1. Verify CORS is configured globally in `backend/api/index.js`
2. Check `Access-Control-Allow-Origin` header in response
3. Ensure preflight OPTIONS returns 204

### Check 3: Database Connection

```sql
-- Verify connection
SELECT current_database(), current_user;

-- Check users table exists
\d users

-- Check Miriam's row
SELECT * FROM users WHERE email ILIKE '%miriam%';
```

### Check 4: Supabase Auth

```bash
# Get Supabase session
const { data: { session }, error } = await supabase.auth.getSession();
console.log('Session:', session);
console.log('User ID:', session?.user?.id);
```

Verify `session.user.id` matches database `supabase_id`.

---

## 📝 Summary

**What was broken**:
- sync-user didn't set `role` column
- ON CONFLICT never updated `is_creator` or `role`
- Creators stuck as fans forever

**What was fixed**:
- sync-user now sets `role` based on `is_creator`
- ON CONFLICT updates both `is_creator` and `role`
- Logging added for debugging

**Immediate action required**:
1. Run SQL script to fix Miriam's account
2. Clear frontend cache
3. Log in again
4. Verify creator dashboard loads

**Long-term fix**:
- Backend deployed (Commit 93899a6)
- All future logins will work correctly
- Existing creator accounts need one-time SQL update

---

## 🚀 Deployment Status

- ✅ **Backend fix deployed**: Commit `93899a6`
- ✅ **Auto-deployed to Vercel**: Live in ~1-2 minutes
- ⏳ **Waiting for**: Miriam to log in with updated backend
- 📝 **Manual step**: Run SQL script for existing creators

Once Miriam's account is updated in the database and she logs in again, she should see her creator dashboard immediately.
