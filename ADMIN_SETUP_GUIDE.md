# 🛡️ Admin Access Setup Guide

Complete guide for setting up and accessing your Digis admin dashboard.

---

## 🎯 What Was Implemented

### ✅ New Files Created

1. **`/frontend/src/components/pages/AdminLoginPage.jsx`** (200+ lines)
   - Beautiful, professional admin login interface
   - Supabase authentication integration
   - Automatic role verification
   - Security notices and user feedback

2. **`/frontend/src/components/ui/AccessDenied.jsx`** (100+ lines)
   - Professional access denied page
   - Clear messaging for unauthorized users
   - Navigation options

### ✅ Files Updated

1. **`/frontend/src/components/ProtectedRoute.js`**
   - Enhanced admin route protection
   - Automatic redirect to `/admin/login` for admin routes
   - Shows AccessDenied page for non-admins

2. **`/frontend/src/routes/AppRoutes.jsx`**
   - Added `/admin/login` route
   - Lazy loading for performance

3. **`/backend/routes/admin.js`** (Previously fixed)
   - Updated approval endpoints to use correct database columns
   - Fixed `video_rate_cents`, `voice_rate_cents`, etc.

4. **`/backend/routes/auth.js`** (Previously fixed)
   - Fixed profileQuery to use correct column names
   - Resolved database error preventing creator account recognition

---

## 🚀 Quick Setup (5 Minutes)

### Step 1: Make Yourself an Admin

**Option A: Supabase SQL Editor** (Recommended)

1. Go to: https://supabase.com/dashboard
2. Select your **Digis project**
3. Click **SQL Editor** in left sidebar
4. Copy and paste this SQL:

```sql
-- Make your account an admin
UPDATE users
SET
  is_super_admin = true,
  role = 'admin',
  updated_at = NOW()
WHERE email = 'YOUR_EMAIL@example.com';

-- Verify it worked
SELECT
  username,
  email,
  is_super_admin,
  role,
  is_creator
FROM users
WHERE email = 'YOUR_EMAIL@example.com';
```

5. Replace `YOUR_EMAIL@example.com` with your actual email
6. Click **Run** (or press Ctrl/Cmd + Enter)
7. Check the results - you should see `is_super_admin: true` and `role: admin`

**Option B: Direct Database Access**

If you have direct PostgreSQL access:

```bash
psql "$DATABASE_URL" -c "UPDATE users SET is_super_admin = true, role = 'admin' WHERE email = 'your@email.com';"
```

### Step 2: Clear Browser Cache

```javascript
// In browser console (F12)
localStorage.clear();
sessionStorage.clear();
location.reload();
```

Or just use **Incognito/Private browsing** mode.

### Step 3: Access Admin Dashboard

Navigate to:
- **Production**: https://digis.cc/admin/login
- **Local Dev**: http://localhost:5173/admin/login

---

## 🔐 Admin Access Flow

### New User Experience

```
User navigates to /admin
↓
Not logged in?
↓
Redirect to /admin/login
↓
User enters credentials
↓
Supabase authenticates
↓
Check if user.is_super_admin = true OR user.role = 'admin'
↓
✅ YES → Redirect to /admin dashboard
❌ NO  → Show "Access Denied" page
```

### Already Logged In (Non-Admin)

```
User navigates to /admin
↓
Already logged in but not admin?
↓
Show beautiful "Access Denied" page
↓
Options:
- Go Back
- Return to Home
```

---

## 📍 Admin Routes

| Route | Access | Purpose |
|-------|--------|---------|
| `/admin/login` | Public | Admin login page |
| `/admin` | Admin Only | Main dashboard (overview, analytics) |
| `/admin` + tab query | Admin Only | Filtered views (pending, approved, etc.) |

---

## 🎨 Admin Dashboard Features

Once logged in, you'll see:

### Overview Tab
- **Platform Statistics**
  - Total users, creators, revenue
  - Active sessions today
- **Analytics Charts**
  - Revenue trends (line chart)
  - User growth (area chart)
  - Top performers (bar chart)
- **Quick Actions**
  - Recent applications
  - Activity feed

### Pending Applications Tab
- View all pending creator applications
- See user details:
  - Username, email
  - Profile picture
  - Join date, activity stats
  - Application reason
- **Actions:**
  - ✅ Approve (one-click)
  - ❌ Reject (with reason)
  - 📋 Bulk approve
  - 📥 Export data

### Users Management
- View all platform users
- Edit user roles
- Manage creator status

### Moderation
- Review reported content
- View audit logs
- Monitor platform activity

---

## 🧪 Testing Your Setup

### Test 1: Admin Login Flow

1. **Log out** if currently logged in
2. Navigate to: `https://digis.cc/admin`
3. **Expected**: Redirect to `/admin/login`
4. Enter your admin credentials
5. **Expected**: After login, redirect to `/admin` dashboard
6. **Expected**: See full admin dashboard with stats and charts

### Test 2: Non-Admin Access

1. Log in with a **non-admin account** (fan or creator)
2. Navigate to: `https://digis.cc/admin`
3. **Expected**: See "Access Denied" page
4. **Expected**: Clear message about needing admin privileges
5. Click "Return to Home"
6. **Expected**: Redirect to appropriate home page

### Test 3: Direct Dashboard Access

1. While logged in as admin
2. Navigate to: `https://digis.cc/admin`
3. **Expected**: See dashboard immediately (no login redirect)
4. Refresh page (Ctrl/Cmd + R)
5. **Expected**: Still see dashboard (session persisted)

### Test 4: Approve a Creator

1. Login to `/admin`
2. Click **Pending** tab
3. Find a pending application
4. Click **Approve**
5. **Expected**:
   - Success toast notification
   - Application moves to "Approved" tab
   - User's database record updated
   - Email sent to creator (if email service configured)

---

## 🔧 Troubleshooting

### Issue: "Access Denied" even though I'm admin

**Solution:**
```sql
-- Verify your admin status
SELECT email, is_super_admin, role FROM users WHERE email = 'your@email.com';

-- If both are false/null, run this:
UPDATE users SET is_super_admin = true, role = 'admin' WHERE email = 'your@email.com';

-- Then clear cache:
-- Browser console: localStorage.clear(); location.reload();
```

### Issue: Stuck on loading screen

**Solution:**
```javascript
// Browser console
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### Issue: "Invalid session" error

**Solution:**
1. Log out completely
2. Clear all browser data for digis.cc
3. Log back in
4. If persists, check Supabase auth logs

### Issue: Can't see any applications

**Possible causes:**
1. No applications submitted yet
2. All applications already processed
3. Backend API error

**Check:**
```sql
-- See all applications
SELECT status, COUNT(*) FROM creator_applications GROUP BY status;
```

---

## 🔒 Security Features

### Built-in Security

✅ **Role-based Access Control (RBAC)**
- Database-level role verification
- Backend middleware checks (`requireAdmin`)
- Frontend route guards

✅ **Audit Logging**
- All admin actions logged
- Viewable in admin dashboard
- Includes: timestamp, admin user, action, details

✅ **Secure Authentication**
- Supabase Auth (JWT tokens)
- HTTPS only in production
- Session management

✅ **Protected Endpoints**
- All `/admin/*` API routes require admin role
- Token verification on every request

---

## 🎯 Next Steps

### Recommended Enhancements

1. **Enable 2FA for Admins** (Supabase built-in)
   ```javascript
   // In Supabase Dashboard
   Authentication > Policies > Enable MFA
   ```

2. **IP Whitelisting** (Production)
   - Add your office/home IPs to allowed list
   - See `backend/routes/admin.js` for implementation

3. **Admin Activity Alerts**
   - Email notifications for critical actions
   - Slack/Discord webhooks

4. **Session Timeout**
   - Auto-logout after 30 minutes of inactivity
   - Prompt for re-authentication

---

## 📞 Support

### Common Questions

**Q: Can I have multiple admins?**
A: Yes! Just run the UPDATE query for each admin email.

**Q: Can admins also be creators?**
A: Yes! Admins can have both roles. Set both `is_super_admin=true` AND `is_creator=true`.

**Q: How do I revoke admin access?**
```sql
UPDATE users SET is_super_admin = false, role = 'fan' WHERE email = 'user@example.com';
```

**Q: Is the admin dashboard mobile-responsive?**
A: Yes! Fully optimized for all screen sizes.

---

## 📊 Quick Reference

### Make User Admin
```sql
UPDATE users SET is_super_admin = true, role = 'admin' WHERE email = 'USER@EMAIL.com';
```

### Remove Admin Access
```sql
UPDATE users SET is_super_admin = false WHERE email = 'USER@EMAIL.com';
```

### View All Admins
```sql
SELECT username, email, role FROM users WHERE is_super_admin = true OR role = 'admin';
```

### View All Pending Applications
```sql
SELECT
  ca.id,
  u.username,
  u.email,
  ca.status,
  ca.created_at
FROM creator_applications ca
LEFT JOIN users u ON ca.supabase_user_id = u.supabase_id
WHERE ca.status = 'pending'
ORDER BY ca.created_at ASC;
```

---

## ✅ Implementation Checklist

- [x] AdminLoginPage component created
- [x] AccessDenied component created
- [x] ProtectedRoute updated with admin handling
- [x] AppRoutes updated with `/admin/login` route
- [x] Backend admin approval endpoints fixed
- [x] Backend auth profileQuery fixed
- [ ] Set your account as admin in database
- [ ] Test admin login flow
- [ ] Test access denied for non-admins
- [ ] Test creator approval workflow

---

**🎉 You're all set! Your admin dashboard is ready to use.**

Navigate to: `https://digis.cc/admin/login`
