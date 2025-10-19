# 🚀 Admin Security Implementation Checklist (Single Project)

## Overview
This checklist implements 2025 admin security in your **existing single Vercel project**.

**Time to complete:** ~30-45 minutes

---

## ✅ Step 1: Database Migration (5 min)

### 1.1 Run Migration Script

```bash
cd /Users/examodels/Desktop/digis-app

# Set your DATABASE_URL
export DATABASE_URL="your-supabase-database-url"

# Run migration
psql "$DATABASE_URL" -f backend/migrations/016_admin_security_2025.sql
```

**What this creates:**
- ✅ `admin_sessions` table
- ✅ `admin_stepup_auth` table
- ✅ `admin_notification_preferences` table
- ✅ RLS admin bypass policies
- ✅ Immutable audit logs
- ✅ Helper functions

### 1.2 Verify Migration

```sql
-- Test that audit_logs are immutable
psql "$DATABASE_URL" -c "SELECT * FROM audit_logs LIMIT 1;"  -- Should work
psql "$DATABASE_URL" -c "UPDATE audit_logs SET action = 'test' WHERE id = (SELECT id FROM audit_logs LIMIT 1);"  -- Should FAIL

-- Check tables exist
psql "$DATABASE_URL" -c "\dt admin_*"
```

**Expected:** Tables created, UPDATE/DELETE blocked on audit_logs

---

## ✅ Step 2: Set Admin Role in Supabase (3 min)

### 2.1 Open Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **Authentication → Users**
4. Find your admin user (your email)
5. Click the user row to edit

### 2.2 Set app_metadata

Click "Edit User" and set `app_metadata`:

```json
{
  "role": "admin",
  "is_staff": true,
  "mfa_enrolled": false
}
```

**Note:** Set `mfa_enrolled: true` after you complete MFA setup (Step 6)

### 2.3 For Other Users (Creators/Fans)

**Creators:**
```json
{
  "role": "creator"
}
```

**Fans:**
```json
{
  "role": "fan"
}
```

---

## ✅ Step 3: Environment Variables (2 min)

### 3.1 Generate Step-Up Secret

```bash
cd /Users/examodels/Desktop/digis-app/backend

# Generate secure secret
openssl rand -hex 32
```

Copy the output.

### 3.2 Add to .env

```bash
# Add to backend/.env
cat >> .env << 'EOF'

# ============================================================================
# ADMIN SECURITY (2025)
# ============================================================================

# Step-Up Re-Auth Secret (generated above)
STEP_UP_SECRET=your-generated-secret-here

# Optional: IP Allowlist (comma-separated IPs or CIDR ranges)
# Leave empty to disable
ADMIN_ALLOWED_IPS=

# Optional: Admin Session Timeout (milliseconds)
# Default: 30 minutes
ADMIN_SESSION_TIMEOUT_MS=1800000

EOF
```

### 3.3 Update Vercel Environment Variables

If deploying to Vercel, add these in:
- Vercel Dashboard → Your Project → Settings → Environment Variables

---

## ✅ Step 4: Install Dependencies (1 min)

```bash
cd /Users/examodels/Desktop/digis-app/backend

npm install express-rate-limit jsonwebtoken

# Optional: For IP allowlist CIDR support
npm install ip-range-check
```

---

## ✅ Step 5: Update Admin Routes (10 min)

### 5.1 Backup Existing Routes

```bash
cd /Users/examodels/Desktop/digis-app/backend/routes

# Backup current admin routes
cp admin.js admin-backup-$(date +%Y%m%d).js
```

### 5.2 Update admin.js

Open `backend/routes/admin.js` and add security middleware at the top:

```javascript
// At the top of admin.js, after existing imports:

// ============================================================================
// IMPORT SECURITY MIDDLEWARES (2025)
// ============================================================================
const { auditLog } = require('../middleware/adminAudit');
const { requireMFA } = require('../middleware/requireMFA');
const { adminSessionFreshness } = require('../middleware/adminSessionFreshness');
const { requireStepUp } = require('../middleware/stepUpReauth');
const { adminRateLimiter, sensitiveActionLimiter } = require('../middleware/adminRateLimit');
const { ipAllowlist } = require('../middleware/ipAllowlist');

// ============================================================================
// APPLY TO ALL ADMIN ROUTES
// ============================================================================
router.use(
  // NOTE: authenticateToken and requireAdmin are already applied
  // Just add the new middlewares below:
  requireMFA,                // MFA enforcement
  adminSessionFreshness,     // 30-min session timeout
  adminRateLimiter,          // Rate limiting
  ipAllowlist                // Optional IP allowlist
);
```

### 5.3 Add Audit Logging to Existing Routes

Add `auditLog()` to each route:

```javascript
// BEFORE:
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  // ...
});

// AFTER:
router.get('/users',
  authenticateToken,
  requireAdmin,
  auditLog('ADMIN_VIEW_USERS'),  // ← ADD THIS
  async (req, res) => {
    // ...
  }
);

// Apply to all routes:
router.get('/creator-applications', authenticateToken, requireAdmin, auditLog('ADMIN_VIEW_APPLICATIONS'), async (req, res) => { ... });
router.put('/creator-applications/:id/approve', authenticateToken, requireAdmin, auditLog('ADMIN_APPROVE_CREATOR'), async (req, res) => { ... });
router.put('/users/:userId/role', authenticateToken, requireAdmin, auditLog('ADMIN_UPDATE_USER_ROLE'), async (req, res) => { ... });
// etc.
```

### 5.4 Add Step-Up to Sensitive Routes

For sensitive actions (role changes, deletions, token grants):

```javascript
const { requireStepUp } = require('../middleware/stepUpReauth');
const { sensitiveActionLimiter } = require('../middleware/adminRateLimit');

// Promote user to admin (SENSITIVE)
router.put('/users/:userId/role',
  authenticateToken,
  requireAdmin,
  sensitiveActionLimiter,           // ← Extra rate limiting
  requireStepUp(5 * 60 * 1000),    // ← Require password within 5min
  auditLog('ADMIN_UPDATE_USER_ROLE'),
  async (req, res) => {
    // ... existing code
  }
);

// Delete user (SENSITIVE)
router.delete('/users/:userId',
  authenticateToken,
  requireAdmin,
  sensitiveActionLimiter,
  requireStepUp(5 * 60 * 1000),
  auditLog('ADMIN_DELETE_USER'),
  async (req, res) => {
    // ... existing code
  }
);
```

### 5.5 Add Security Status Endpoints

At the end of `admin.js`, add:

```javascript
// Security status endpoints
const { getMFAStatus } = require('../middleware/requireMFA');
const { getSessionStatus } = require('../middleware/adminSessionFreshness');
const { performStepUp, checkStepUpStatus } = require('../middleware/stepUpReauth');
const { getAllowlistStatus } = require('../middleware/ipAllowlist');

router.get('/session/status', authenticateToken, requireAdmin, getSessionStatus);
router.get('/mfa/status', authenticateToken, requireAdmin, getMFAStatus);
router.post('/stepup/reauth', authenticateToken, requireAdmin, performStepUp);
router.get('/stepup/status', authenticateToken, requireAdmin, checkStepUpStatus);
router.get('/allowlist/status', authenticateToken, requireAdmin, getAllowlistStatus);
```

**OR** use the complete example in `backend/routes/admin-secure.js` as reference.

---

## ✅ Step 6: Frontend Updates (10 min)

### 6.1 Update DashboardRouter (Already Done!)

You already fixed this in the earlier conversation:

```javascript
// /frontend/src/components/pages/DashboardRouter.js

// Priority 1: Admin users get admin dashboard
if (isAdmin) {
  console.log('👑 Admin status confirmed - showing admin dashboard');
  return <EnhancedAdminDashboard user={user} />;
}

// Priority 2: Creators...
// Priority 3: Fans...
```

✅ **Already implemented!**

### 6.2 Update AuthContext to Use app_metadata

Open `frontend/src/contexts/AuthContext.jsx`:

```javascript
// Check if role comes from app_metadata (NEW)
const role = useMemo(() => {
  // Check app_metadata first (JWT claims)
  const metadataRole = user?.app_metadata?.role;
  if (metadataRole) return metadataRole;

  // Fallback to profile (DB)
  if (profile?.is_admin === true) return 'admin';
  if (profile?.is_creator === true) return 'creator';
  if (!user) return null;
  if (!roleResolved) return null;
  return 'fan';
}, [user, profile, roleResolved]);

const isAdmin = user?.app_metadata?.role === 'admin' || profile?.is_admin === true;
const isCreator = user?.app_metadata?.role === 'creator' || profile?.is_creator === true;
```

This makes `app_metadata.role` the **primary source** with DB fallback.

### 6.3 Add Route-Based Auto Redirect

In `frontend/src/routes/AppRoutes.jsx` or wherever you handle routing after login:

```javascript
// Auto-redirect based on role
useEffect(() => {
  if (!currentUser || !roleResolved) return;

  const metadataRole = currentUser?.app_metadata?.role;
  const currentPath = location.pathname;

  // Redirect admins away from regular dashboard
  if (metadataRole === 'admin' && currentPath === '/dashboard') {
    navigate('/admin', { replace: true });
  }

  // Redirect creators/fans away from admin
  if (metadataRole !== 'admin' && currentPath.startsWith('/admin')) {
    navigate('/dashboard', { replace: true });
  }
}, [currentUser, roleResolved, location]);
```

---

## ✅ Step 7: Test Everything (10 min)

### 7.1 Test Admin Login

```bash
# Start backend
cd backend
npm run dev

# Start frontend
cd frontend
npm start
```

1. Go to http://localhost:3000/admin/login
2. Log in with your admin account
3. Verify you see the admin dashboard

### 7.2 Test MFA Enforcement

Currently MFA is NOT enforced (we haven't set `mfa_enrolled: true` yet).

Try accessing admin routes - should work but log a warning.

### 7.3 Test Audit Logging

1. Perform an admin action (e.g., view users)
2. Check database:

```sql
psql "$DATABASE_URL" -c "SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 5;"
```

**Expected:** See your action logged with IP, user agent, etc.

### 7.4 Test Rate Limiting

Make 101 requests rapidly:

```bash
# In terminal
for i in {1..101}; do
  curl http://localhost:3001/api/admin/stats \
    -H "Authorization: Bearer YOUR_TOKEN" &
done
```

**Expected:** 429 error after 100 requests

### 7.5 Test Immutable Audit Logs

```sql
# Try to modify audit log (should FAIL)
psql "$DATABASE_URL" -c "UPDATE audit_logs SET action = 'hacked' WHERE id = (SELECT id FROM audit_logs LIMIT 1);"
```

**Expected:** Error message saying UPDATE not allowed

### 7.6 Test Session Timeout

1. Log in as admin
2. Wait 31 minutes
3. Try to access admin route

**Expected:** 401 error with ADMIN_SESSION_EXPIRED

---

## ✅ Step 8: MFA Setup (Optional - Recommended)

### 8.1 Enable MFA in Supabase

1. Supabase Dashboard → Authentication → Settings
2. Enable "Multi-Factor Authentication"
3. Select "TOTP" (Time-based One-Time Password)

### 8.2 Create MFA Setup Component (Optional)

You can create an MFA enrollment flow later. For now, admins can use Supabase's built-in MFA.

### 8.3 Mark Admin as MFA Enrolled

After admin sets up MFA in their account:

```json
// Update app_metadata in Supabase
{
  "role": "admin",
  "is_staff": true,
  "mfa_enrolled": true  // ← Change this
}
```

Now `requireMFA` middleware will enforce it.

---

## ✅ Step 9: Deploy to Vercel (5 min)

### 9.1 Add Environment Variables

Vercel Dashboard → Your Project → Settings → Environment Variables:

```
STEP_UP_SECRET = your-generated-secret
ADMIN_ALLOWED_IPS = (leave empty for now)
```

### 9.2 Deploy

```bash
cd /Users/examodels/Desktop/digis-app

# Deploy to Vercel
vercel --prod
```

### 9.3 Test Production

1. Go to https://digis.cc/admin/login
2. Log in
3. Verify admin dashboard loads
4. Check audit logs in Supabase

---

## 🎉 You're Done!

Your admin portal now has:
- ✅ Automatic audit logging
- ✅ MFA enforcement (when enabled)
- ✅ 30-minute session timeout
- ✅ Rate limiting
- ✅ IP allowlist (optional)
- ✅ Immutable audit logs
- ✅ RLS admin bypass
- ✅ Step-up re-auth (for sensitive actions)

**All in your single Vercel project!**

---

## 📚 Reference Files

- **Implementation Guide:** `/backend/docs/ADMIN_SECURITY_IMPLEMENTATION_GUIDE.md`
- **Security Best Practices:** `/backend/docs/ADMIN_SECURITY_2025.md`
- **Complete Example Routes:** `/backend/routes/admin-secure.js`
- **Summary:** `/ADMIN_SECURITY_SUMMARY.md`

---

## 🔮 Future: Migrate to `admin.digis.cc`

When you're ready (6-12 months), follow the migration guide in the docs.

**For now:** Single project is perfect! ✅
