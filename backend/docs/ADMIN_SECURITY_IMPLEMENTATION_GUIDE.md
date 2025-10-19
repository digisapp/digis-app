# Admin Security Implementation Guide (2025)

## 🎯 Overview

This guide shows you how to implement 2025 best-practice security for your Digis admin portal.

**What we're building:**
- ✅ Separate `/admin/login` (easy to move to `admin.digis.cc` later)
- ✅ MFA mandatory for all admins
- ✅ 30-minute admin session timeout
- ✅ Step-up re-auth for sensitive actions
- ✅ Automatic audit logging (tamper-proof)
- ✅ IP allowlist (optional)
- ✅ Admin-specific rate limiting
- ✅ RLS admin bypass policies

---

## 📋 Implementation Checklist

### Phase 1: Database Setup

#### 1.1 Run Migration
```bash
cd backend
psql $DATABASE_URL -f migrations/016_admin_security_2025.sql
```

This creates:
- ✅ `admin_sessions` table
- ✅ `admin_stepup_auth` table
- ✅ `admin_notification_preferences` table
- ✅ Immutable audit_logs (no UPDATE/DELETE)
- ✅ RLS admin bypass policies
- ✅ Helper functions (`is_admin()`, `log_admin_action()`)

#### 1.2 Verify Migration
```sql
-- Check audit logs are immutable
UPDATE audit_logs SET action = 'test' WHERE id = '...'; -- Should FAIL
DELETE FROM audit_logs WHERE id = '...'; -- Should FAIL

-- Check admin bypass works
SELECT * FROM users; -- Should work for admin role
```

---

### Phase 2: Set Admin Roles in Supabase

#### 2.1 Set app_metadata for Admin Users

Go to Supabase Dashboard → Authentication → Users, find your admin, click edit:

```json
{
  "role": "admin",
  "is_staff": true,
  "mfa_enrolled": false
}
```

For creators/fans:
```json
{
  "role": "creator"  // or "fan"
}
```

#### 2.2 Why app_metadata?

- ✅ Available in JWT claims (no DB query needed)
- ✅ Can be used in RLS policies
- ✅ Cannot be modified by users (only admins can change it)
- ✅ Single source of truth for roles

---

### Phase 3: Backend Routes

#### 3.1 Replace `routes/admin.js` with `routes/admin-secure.js`

```bash
# Backup old routes
mv backend/routes/admin.js backend/routes/admin-old.js

# Use new secure routes
mv backend/routes/admin-secure.js backend/routes/admin.js
```

#### 3.2 Wire Up in Main App

In `backend/api/index.js` or `backend/server.js`:

```javascript
const adminRoutes = require('./routes/admin');

// Mount admin routes
app.use('/api/admin', adminRoutes);

// That's it! All security is handled in the route file.
```

#### 3.3 Environment Variables

Add to `.env`:

```bash
# MFA/Step-Up Secret (generate with: openssl rand -hex 32)
STEP_UP_SECRET=your-secure-secret-here-change-in-production

# IP Allowlist (optional - leave empty to disable)
# Format: IP1,IP2,CIDR_RANGE
ADMIN_ALLOWED_IPS=203.0.113.1,192.168.1.0/24

# Admin Session Timeout (optional - defaults to 30min)
ADMIN_SESSION_TIMEOUT_MS=1800000
```

---

### Phase 4: Frontend Setup

#### 4.1 Update Role Routing

Create `frontend/src/utils/routeAfterLogin.js`:

```javascript
export function routeAfterLogin(user) {
  const role = user?.app_metadata?.role;

  if (role === 'admin') return '/admin';
  if (role === 'creator') return '/dashboard';
  return '/explore'; // fans
}
```

Use after login:

```javascript
// In your Auth component
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password
});

if (data.user) {
  const destination = routeAfterLogin(data.user);
  navigate(destination);
}
```

#### 4.2 Admin Route Guard

Create `frontend/src/components/AdminGuard.jsx`:

```javascript
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AdminGuard({ children }) {
  const { user, authLoading } = useAuth();

  if (authLoading) {
    return <div>Loading...</div>;
  }

  const role = user?.app_metadata?.role;

  if (role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
}
```

Wrap admin routes:

```javascript
import AdminGuard from './components/AdminGuard';

<Route path="/admin/*" element={
  <AdminGuard>
    <EnhancedAdminDashboard />
  </AdminGuard>
} />
```

#### 4.3 Auto-Redirect Admins from Dashboard

In `DashboardRouter.js` or main app:

```javascript
useEffect(() => {
  const role = user?.app_metadata?.role;

  if (role === 'admin' && location.pathname === '/dashboard') {
    navigate('/admin', { replace: true });
  }
}, [user, location]);
```

---

### Phase 5: MFA Setup

#### 5.1 Enable MFA in Supabase

1. Go to Supabase Dashboard → Authentication → Settings
2. Enable "Multi-Factor Authentication"
3. Select "TOTP" (Time-based One-Time Password)

#### 5.2 Frontend MFA Enrollment

Create `frontend/src/components/MFASetup.jsx`:

```javascript
import { useState } from 'react';
import { supabase } from '../utils/supabase-auth';
import QRCode from 'qrcode.react';

export default function MFASetup({ user, onComplete }) {
  const [qrCode, setQrCode] = useState(null);
  const [verifyCode, setVerifyCode] = useState('');

  const enrollMFA = async () => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Admin Account'
    });

    if (error) {
      console.error('MFA enrollment error:', error);
      return;
    }

    setQrCode(data.totp.qr_code);
  };

  const verifyMFA = async () => {
    const { data, error } = await supabase.auth.mfa.verify({
      factorId: data.id,
      code: verifyCode
    });

    if (error) {
      alert('Invalid code. Please try again.');
      return;
    }

    // Update app_metadata to mark MFA as enrolled
    // (This should be done on backend via admin API)
    await fetch('/api/admin/mfa/mark-enrolled', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${user.access_token}` }
    });

    onComplete();
  };

  return (
    <div>
      <h2>Enable Two-Factor Authentication</h2>
      <p>Scan this QR code with Google Authenticator or Authy:</p>

      {!qrCode ? (
        <button onClick={enrollMFA}>Enable MFA</button>
      ) : (
        <>
          <QRCode value={qrCode} size={256} />
          <input
            type="text"
            placeholder="Enter 6-digit code"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
          />
          <button onClick={verifyMFA}>Verify & Enable</button>
        </>
      )}
    </div>
  );
}
```

#### 5.3 Force MFA Setup for Admins

In admin dashboard:

```javascript
const { user } = useAuth();
const [mfaEnrolled, setMfaEnrolled] = useState(false);

useEffect(() => {
  // Check if MFA is enrolled
  const checkMFA = async () => {
    const res = await fetch('/api/admin/mfa/status', {
      headers: { 'Authorization': `Bearer ${user.access_token}` }
    });
    const data = await res.json();
    setMfaEnrolled(data.mfa_enrolled);
  };

  checkMFA();
}, [user]);

if (!mfaEnrolled) {
  return <MFASetup user={user} onComplete={() => setMfaEnrolled(true)} />;
}

// Show normal admin dashboard
return <EnhancedAdminDashboard />;
```

---

### Phase 6: Step-Up Re-Auth for Sensitive Actions

#### 6.1 Frontend: Request Step-Up Token

Create `frontend/src/utils/stepUpAuth.js`:

```javascript
import { supabase } from './supabase-auth';

let stepUpToken = null;
let stepUpExpiry = null;

export async function requestStepUp(password) {
  const { data } = await supabase.auth.getSession();

  const response = await fetch('/api/admin/stepup/reauth', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${data.session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ password })
  });

  if (!response.ok) {
    throw new Error('Invalid password');
  }

  const result = await response.json();

  stepUpToken = result.step_up_token;
  stepUpExpiry = new Date(result.expires_at).getTime();

  return stepUpToken;
}

export function getStepUpToken() {
  if (!stepUpToken || Date.now() > stepUpExpiry) {
    return null; // Expired
  }
  return stepUpToken;
}

export function clearStepUpToken() {
  stepUpToken = null;
  stepUpExpiry = null;
}
```

#### 6.2 Frontend: Use Step-Up for Sensitive Actions

```javascript
import { requestStepUp, getStepUpToken } from '../utils/stepUpAuth';

async function promoteUserToAdmin(userId) {
  // Check if we have recent step-up
  let token = getStepUpToken();

  if (!token) {
    // Prompt for password
    const password = prompt('Please confirm your password:');
    token = await requestStepUp(password);
  }

  // Now make the sensitive request
  const response = await fetch(`/api/admin/users/${userId}/role`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Step-Up-Token': token, // Required header
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ role: 'admin' })
  });

  if (response.status === 403) {
    const data = await response.json();
    if (data.required_step_up) {
      // Step-up expired, re-prompt
      const password = prompt('Your session expired. Please confirm your password:');
      token = await requestStepUp(password);
      // Retry the request...
    }
  }
}
```

---

### Phase 7: Testing

#### 7.1 Test MFA Enforcement

```bash
# Without MFA enrolled
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:3001/api/admin/users

# Expected: 403 with MFA_REQUIRED error
```

#### 7.2 Test Session Timeout

```bash
# Wait 31 minutes after login
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:3001/api/admin/users

# Expected: 401 with ADMIN_SESSION_EXPIRED error
```

#### 7.3 Test Step-Up Re-Auth

```bash
# Try sensitive action without step-up token
curl -X PUT \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"admin"}' \
  http://localhost:3001/api/admin/users/USER_ID/role

# Expected: 403 with STEP_UP_REQUIRED error
```

#### 7.4 Test Audit Logging

```bash
# Perform any admin action
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:3001/api/admin/users

# Check audit logs
psql $DATABASE_URL -c "SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 5;"

# You should see automatic log entries
```

#### 7.5 Test Rate Limiting

```bash
# Make 101 requests rapidly
for i in {1..101}; do
  curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
    http://localhost:3001/api/admin/stats
done

# Expected: 429 Too Many Requests after 100 requests
```

---

### Phase 8: Migration to `admin.digis.cc` (Future)

When you're ready to move to a separate subdomain:

#### 8.1 DNS Setup

Add A record:
```
admin.digis.cc → Your server IP
```

#### 8.2 Vercel Configuration

Create separate Vercel project for admin portal:

```json
// vercel.json (admin project)
{
  "buildCommand": "npm run build:admin",
  "outputDirectory": "dist/admin",
  "routes": [
    { "src": "/api/(.*)", "dest": "https://api.digis.cc/api/$1" }
  ]
}
```

#### 8.3 Redirect Old Routes

In main app's `vercel.json`:

```json
{
  "redirects": [
    {
      "source": "/admin",
      "destination": "https://admin.digis.cc",
      "permanent": false
    },
    {
      "source": "/admin/:path*",
      "destination": "https://admin.digis.cc/:path*",
      "permanent": false
    }
  ]
}
```

---

## 🎉 You're Done!

Your admin portal now has:
- ✅ Separate login portal
- ✅ MFA mandatory
- ✅ 30-min session timeout
- ✅ Step-up re-auth for sensitive actions
- ✅ Automatic audit logging
- ✅ Rate limiting
- ✅ IP allowlist (optional)
- ✅ RLS admin bypass
- ✅ Easy migration to subdomain

---

## 📞 Support

Questions? Issues?
- Check `/backend/docs/ADMIN_SECURITY_2025.md`
- Review `/backend/routes/admin-secure.js` for examples
- Contact: security@digis.cc
