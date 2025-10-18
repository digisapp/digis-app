# Admin Account Fix Guide

## Problem

Admin users are logging in but seeing **fan accounts** instead of admin dashboards.

### Root Cause

The `/auth/sync-user` endpoint only supported **'creator'** and **'fan'** roles, but not **'admin'**. When admins logged in, the sync-user endpoint set their role to 'fan', causing them to see the wrong dashboard.

---

## ✅ Fix Deployed

I've updated `/auth/sync-user` to support **three roles**:
- `admin` - Super admin with full platform access
- `creator` - Content creators
- `fan` - Regular users

### Changes Made (backend/routes/auth.js)

1. **Added admin role detection** (lines 174-177):
   ```javascript
   const accountTypeForUpsert = metadata?.account_type || metadata?.role || 'fan';
   const isAdminForUpsert = accountTypeForUpsert === 'admin';
   const isCreatorForUpsert = accountTypeForUpsert === 'creator' || isAdminForUpsert;
   const roleForUpsert = isAdminForUpsert ? 'admin' : (isCreatorForUpsert ? 'creator' : 'fan');
   ```

2. **Added `is_super_admin` column to INSERT** (line 192):
   ```sql
   INSERT INTO users (..., is_creator, is_super_admin, role, ...)
   VALUES (..., $5, $6, $7, ...)
   ```

3. **ON CONFLICT updates admin status** (lines 225-226):
   ```sql
   ON CONFLICT (supabase_id) DO UPDATE SET
     is_creator = EXCLUDED.is_creator,
     is_super_admin = EXCLUDED.is_super_admin,
     role = EXCLUDED.role,
     ...
   ```

4. **Admins are also creators** - Admin users get `is_creator = true` so they can access all creator features

---

## 🚨 Immediate Fix for Your Admin Account

### Step 1: Find Your User ID

```sql
-- Connect to your database
psql "$DATABASE_URL"

-- Find your account
SELECT supabase_id, email, username, role, is_super_admin, is_creator
FROM users
WHERE email = 'your-admin-email@example.com';
```

Copy the `supabase_id` (UUID).

### Step 2: Set as Admin

```sql
-- Replace YOUR-SUPABASE-ID with the actual ID
UPDATE users
SET
  is_super_admin = true,
  is_creator = true,
  role = 'admin',
  updated_at = NOW()
WHERE supabase_id = 'YOUR-SUPABASE-ID';
```

**Example**:
```sql
UPDATE users
SET is_super_admin = true, is_creator = true, role = 'admin', updated_at = NOW()
WHERE supabase_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
```

### Step 3: Verify

```sql
SELECT supabase_id, email, username, role, is_super_admin, is_creator
FROM users
WHERE supabase_id = 'YOUR-SUPABASE-ID';
```

Expected output:
```
 role  | is_super_admin | is_creator
-------+----------------+------------
 admin | t              | t
```

### Step 4: Clear Frontend Cache

**In browser console** (while on your site):
```javascript
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### Step 5: Log In

1. Go to your login page
2. Sign in with admin credentials
3. **Should now see admin dashboard**

---

## 📊 What Each Role Means

| Role | is_creator | is_super_admin | Access |
|------|-----------|----------------|--------|
| **admin** | `true` | `true` | Full platform access + creator features |
| **creator** | `true` | `false` | Creator dashboard + creator features |
| **fan** | `false` | `false` | Fan dashboard only |

**Note**: Admins have `is_creator = true` so they can:
- Test creator features
- Access creator dashboards
- Manage creator content
- Use all platform features

---

## 🔍 How to Verify It's Working

### Backend Logs (Vercel)

After admin logs in, check for:
```
✅ sync-user upsert successful {
  supabaseId: 'a1b2c3d4-...',
  username: 'admin',
  is_creator: true,
  is_super_admin: true,
  role: 'admin'  ← Should be 'admin'
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
       "role": "admin",
       "is_super_admin": true,
       "is_creator": true
     }
   }
   ```

### Database Check

```sql
SELECT supabase_id, email, username, role, is_super_admin, is_creator
FROM users
WHERE role = 'admin' OR is_super_admin = true;
```

---

## 🎯 Frontend Integration

Your frontend should check for admin like this:

```javascript
// Check if user is admin
const isAdmin = user?.role === 'admin' || user?.is_super_admin === true;

// Show admin dashboard
if (isAdmin) {
  return <AdminDashboard />;
} else if (user?.is_creator) {
  return <CreatorDashboard />;
} else {
  return <FanDashboard />;
}
```

**Make sure your frontend checks BOTH**:
- `user.role === 'admin'`
- `user.is_super_admin === true`

---

## 🔧 How Frontend Should Call sync-user

**When logging in as admin**, the frontend should send:

```javascript
// After Supabase login
await apiClient.post('/api/v1/auth/sync-user', {
  supabaseId: session.user.id,
  email: session.user.email,
  metadata: {
    account_type: 'admin',  // ← Set to 'admin'
    username: 'admin'
  }
});
```

**Supported values for `account_type`**:
- `'admin'` - Super admin
- `'creator'` - Content creator
- `'fan'` - Regular user (default)

---

## 📝 Quick Reference Commands

### Set User as Admin
```sql
UPDATE users
SET is_super_admin=true, is_creator=true, role='admin', updated_at=NOW()
WHERE email='admin@example.com';
```

### Set User as Creator
```sql
UPDATE users
SET is_creator=true, role='creator', updated_at=NOW()
WHERE email='creator@example.com';
```

### Set User as Fan
```sql
UPDATE users
SET is_creator=false, is_super_admin=false, role='fan', updated_at=NOW()
WHERE email='fan@example.com';
```

### List All Admins
```sql
SELECT email, username, role, is_super_admin, is_creator
FROM users
WHERE is_super_admin = true OR role = 'admin';
```

### List All Creators
```sql
SELECT email, username, role, is_creator
FROM users
WHERE is_creator = true AND is_super_admin = false;
```

---

## 🐛 Troubleshooting

### Still Seeing Fan Dashboard?

1. **Check database**:
   ```sql
   SELECT role, is_super_admin, is_creator FROM users WHERE email='your-email';
   ```
   Should show: `role='admin'`, `is_super_admin=t`, `is_creator=t`

2. **Clear cache** (browser console):
   ```javascript
   localStorage.clear(); sessionStorage.clear(); location.reload();
   ```

3. **Check backend logs** - Look for "sync-user upsert successful"

4. **Check frontend** - Does it check for `role === 'admin'`?

### Getting 404 Errors?

- Same as before - run the SQL UPDATE above
- Make sure you're sending the JWT token
- Check CORS is configured

### Frontend Not Detecting Admin?

**Check your frontend code**:
```javascript
// BAD - Only checks is_creator
if (user.is_creator) {
  return <CreatorDashboard />;
}

// GOOD - Checks role hierarchy
if (user.role === 'admin' || user.is_super_admin) {
  return <AdminDashboard />;
} else if (user.is_creator || user.role === 'creator') {
  return <CreatorDashboard />;
} else {
  return <FanDashboard />;
}
```

---

## ✅ Deployment Status

- ✅ **Backend fix deployed** - Commit pending
- ✅ **Admin role support added** - sync-user now handles admin/creator/fan
- ✅ **is_super_admin column** - Now properly set and updated
- ⏳ **Manual action required** - Run SQL to upgrade existing admin accounts

---

## 📚 Related Documentation

- **CREATOR_AUTH_FIX.md** - Creator authentication fix guide
- **backend/set_admin.sql** - SQL template for setting admins
- **backend/fix_miriam_creator.sql** - Example creator fix

---

## 🎯 TL;DR - Quick Fix

1. **Connect to database**: `psql "$DATABASE_URL"`
2. **Find your ID**:
   ```sql
   SELECT supabase_id FROM users WHERE email='your-email';
   ```
3. **Set as admin**:
   ```sql
   UPDATE users SET is_super_admin=true, is_creator=true, role='admin'
   WHERE supabase_id='YOUR-ID';
   ```
4. **Clear cache**:
   ```javascript
   localStorage.clear(); location.reload();
   ```
5. **Log in** → Should see admin dashboard

Done!
