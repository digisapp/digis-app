# Admin Security Best Practices (2025)

## Current Status

### ✅ What Digis Has Implemented
1. **Separate Admin Login Portal** (`/admin/login`)
2. **Admin Middleware** with role verification
3. **Audit Log Table** with IP and user agent tracking
4. **Row Level Security (RLS)** policies
5. **Role-based Access Control (RBAC)**

### ⚠️ What Needs Improvement

## 1. Automatic Audit Logging (CRITICAL)

**Issue:** Current audit logs require frontend to call `/audit-log` endpoint.

**Solution:** Use automatic audit middleware (see `/backend/middleware/adminAudit.js`)

**Implementation:**
```javascript
const { auditLog } = require('../middleware/adminAudit');

// Before (manual logging - can be bypassed):
router.put('/users/:id/role', authenticateToken, requireAdmin, async (req, res) => {
  // Admin action happens
  // Hope frontend remembers to log it
});

// After (automatic logging - cannot be bypassed):
router.put('/users/:id/role',
  authenticateToken,
  requireAdmin,
  auditLog('UPDATE_USER_ROLE'), // ← Automatically logs action
  async (req, res) => {
    // Admin action happens
    // Guaranteed to be logged
  }
);
```

**Apply to ALL admin routes:**
- `/admin/users` - User management
- `/admin/creator-applications` - Application approval
- `/admin/users/:id/role` - Role changes
- `/admin/tokens` - Token grants
- `/admin/moderation` - Content moderation

## 2. Multi-Factor Authentication (MFA/2FA)

**Status:** ❌ Not implemented

**2025 Standard:** MANDATORY for all admin accounts.

**Implementation with Supabase:**
```javascript
// 1. Enable MFA in Supabase settings
// 2. Enforce MFA for admin accounts

// backend/middleware/requireMFA.js
const requireMFA = async (req, res, next) => {
  const userId = getUserId(req);

  // Check if user is admin
  const { data: user } = await supabase.auth.admin.getUserById(userId);

  if (req.isAdmin) {
    // Check MFA status
    const { data: factors } = await supabase.auth.mfa.listFactors();

    if (!factors || factors.length === 0) {
      return res.status(403).json({
        error: 'MFA_REQUIRED',
        message: 'Multi-factor authentication is required for admin access'
      });
    }
  }

  next();
};

// Apply to admin routes:
router.use('/admin/*', requireMFA);
```

**Supabase MFA Setup:**
```bash
# 1. Enable MFA in Supabase Dashboard
# Authentication > Settings > Enable MFA

# 2. Frontend integration
import { supabase } from './supabase';

// Enroll MFA
const { data, error } = await supabase.auth.mfa.enroll({
  factorType: 'totp',
  friendlyName: 'Admin Account'
});

// Challenge MFA
const { data, error } = await supabase.auth.mfa.challenge({
  factorId: factorId
});

// Verify MFA
const { data, error } = await supabase.auth.mfa.verify({
  factorId: factorId,
  challengeId: challengeId,
  code: '123456' // User's TOTP code
});
```

## 3. Separate Session Management

**Status:** ❌ Admins use same session as regular users

**2025 Standard:** Admin sessions should have:
- **Shorter timeout:** 15-30 minutes (vs 24 hours for users)
- **No "Remember Me"**
- **Re-authentication for sensitive actions**

**Implementation:**
```javascript
// backend/middleware/adminSession.js
const ADMIN_SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

const adminSessionManager = async (req, res, next) => {
  if (req.isAdmin) {
    const lastActivity = req.session?.lastAdminActivity;
    const now = Date.now();

    if (lastActivity && (now - lastActivity > ADMIN_SESSION_TIMEOUT)) {
      // Session expired - require re-auth
      return res.status(401).json({
        error: 'ADMIN_SESSION_EXPIRED',
        message: 'Your admin session has expired. Please log in again.'
      });
    }

    // Update last activity
    req.session.lastAdminActivity = now;
  }

  next();
};

// Apply to all admin routes
router.use('/admin/*', adminSessionManager);
```

## 4. Require Re-auth for Sensitive Actions

**Status:** ❌ Not implemented

**2025 Standard:** Critical actions require password confirmation.

**Sensitive Actions:**
- Promoting users to admin
- Deleting user accounts
- Accessing payment information
- Modifying system settings

**Implementation:**
```javascript
// backend/middleware/reauth.js
const requireReauth = (maxAge = 5 * 60 * 1000) => { // 5 minutes
  return async (req, res, next) => {
    const lastReauth = req.session?.lastReauth;
    const now = Date.now();

    if (!lastReauth || (now - lastReauth > maxAge)) {
      return res.status(403).json({
        error: 'REAUTH_REQUIRED',
        message: 'Please confirm your password to continue'
      });
    }

    next();
  };
};

// Usage:
router.put('/admin/users/:id/promote',
  authenticateToken,
  requireAdmin,
  requireReauth(5 * 60 * 1000), // Reauth within last 5 min
  auditLog('PROMOTE_USER_TO_ADMIN'),
  async (req, res) => {
    // Critical action
  }
);

// Frontend reauth endpoint
router.post('/admin/reauth', authenticateToken, requireAdmin, async (req, res) => {
  const { password } = req.body;

  // Verify password with Supabase
  const { error } = await supabase.auth.signInWithPassword({
    email: req.user.email,
    password: password
  });

  if (error) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  // Mark as recently authenticated
  req.session.lastReauth = Date.now();
  res.json({ success: true });
});
```

## 5. IP Whitelisting (Optional but Recommended)

**Status:** ❌ Not implemented

**2025 Standard:** For high-security environments, restrict admin access to known IPs.

**Implementation:**
```javascript
// backend/middleware/ipWhitelist.js
const ADMIN_ALLOWED_IPS = process.env.ADMIN_ALLOWED_IPS?.split(',') || [];

const ipWhitelist = (req, res, next) => {
  if (req.isAdmin && ADMIN_ALLOWED_IPS.length > 0) {
    const clientIp = getClientIp(req);

    if (!ADMIN_ALLOWED_IPS.includes(clientIp)) {
      // Log unauthorized access attempt
      console.warn(`❌ Unauthorized admin access from IP: ${clientIp}`);

      return res.status(403).json({
        error: 'IP_NOT_WHITELISTED',
        message: 'Admin access is restricted to authorized IP addresses'
      });
    }
  }

  next();
};

// Apply to admin routes
router.use('/admin/*', ipWhitelist);
```

**.env configuration:**
```bash
# Leave empty to disable IP whitelisting
ADMIN_ALLOWED_IPS=203.0.113.1,203.0.113.2,203.0.113.3
```

## 6. Rate Limiting for Admin Routes

**Status:** ❌ Generic rate limiting (same as regular users)

**2025 Standard:** Stricter rate limits for admin endpoints.

**Implementation:**
```javascript
// backend/middleware/adminRateLimiter.js
const rateLimit = require('express-rate-limit');

const adminRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many admin requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,

  // Custom key generator (use both IP and user ID)
  keyGenerator: (req) => {
    return `${getClientIp(req)}-${getUserId(req)}`;
  }
});

router.use('/admin/*', adminRateLimiter);
```

## 7. Security Headers for Admin Portal

**Status:** ✅ Partial (Helmet.js configured)

**Enhancement:** Admin-specific CSP and security headers.

**Implementation:**
```javascript
// backend/middleware/adminHeaders.js
const adminSecurityHeaders = (req, res, next) => {
  // Stricter CSP for admin pages
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self'; " + // No inline scripts
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "frame-ancestors 'none'" // Prevent clickjacking
  );

  // Additional security headers
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  next();
};

router.use('/admin/*', adminSecurityHeaders);
```

## 8. Separate Admin Subdomain (Gold Standard)

**Current:** `digis.cc/admin`

**2025 Gold Standard:** `admin.digis.cc`

**Benefits:**
- ✅ Complete isolation from main app
- ✅ Different CORS policies
- ✅ Separate SSL certificate
- ✅ Can use different hosting (more secure environment)
- ✅ Easier to apply WAF (Web Application Firewall) rules

**Implementation:**
```bash
# 1. DNS Configuration
# Add A record: admin.digis.cc → Your server IP

# 2. Vercel/Netlify Configuration
# Create separate deployment for admin portal

# 3. Environment separation
# admin.digis.cc → admin-specific environment variables
# www.digis.cc → user-facing environment variables
```

## 9. Admin Action Notifications

**Status:** ❌ Not implemented

**2025 Standard:** Notify all admins of critical actions.

**Implementation:**
```javascript
// backend/utils/adminNotifications.js
const notifyAdmins = async (action, details) => {
  // Get all admin emails
  const admins = await pool.query(`
    SELECT email FROM users
    WHERE is_super_admin = true AND email IS NOT NULL
  `);

  // Send email notification
  for (const admin of admins.rows) {
    await sendEmail({
      to: admin.email,
      subject: `Admin Action Alert: ${action}`,
      body: `
        An admin action was performed:

        Action: ${action}
        Details: ${JSON.stringify(details, null, 2)}
        Time: ${new Date().toISOString()}

        If this wasn't you, please contact security immediately.
      `
    });
  }
};

// Usage in admin routes:
router.put('/admin/users/:id/role', async (req, res) => {
  // ... perform action

  await notifyAdmins('USER_ROLE_CHANGED', {
    targetUser: req.params.id,
    newRole: req.body.role,
    performedBy: req.user.email
  });
});
```

## 10. Immutable Audit Logs

**Status:** ✅ Table exists, ❌ Not immutable

**2025 Standard:** Audit logs should be append-only and tamper-proof.

**Implementation:**
```sql
-- Make audit_logs append-only (no UPDATE or DELETE)
CREATE POLICY "Audit logs are append-only" ON audit_logs
  FOR UPDATE USING (false);

CREATE POLICY "Audit logs cannot be deleted" ON audit_logs
  FOR DELETE USING (false);

-- Only allow INSERT
CREATE POLICY "Admins can create audit logs" ON audit_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.supabase_id = auth.uid()
      AND users.is_super_admin = true
    )
  );
```

## Implementation Priority

### 🔴 Critical (Implement Immediately)
1. ✅ Automatic audit logging middleware
2. ⏱️ MFA/2FA requirement for admins
3. ⏱️ Shorter session timeout (30 min)

### 🟡 Important (Implement Soon)
4. ⏱️ Re-authentication for sensitive actions
5. ⏱️ Immutable audit logs
6. ⏱️ Admin-specific rate limiting

### 🟢 Nice to Have (Future Enhancement)
7. ⏱️ IP whitelisting
8. ⏱️ Separate subdomain (`admin.digis.cc`)
9. ⏱️ Admin action notifications
10. ⏱️ Enhanced security headers

## Testing Checklist

- [ ] Test automatic audit logging on all admin routes
- [ ] Verify MFA enrollment and challenge flow
- [ ] Test session timeout (wait 30 min, ensure logged out)
- [ ] Test re-auth for sensitive actions
- [ ] Verify audit logs are immutable (try UPDATE/DELETE)
- [ ] Test rate limiting on admin endpoints
- [ ] Verify IP whitelist (if enabled)
- [ ] Check admin notification emails
- [ ] Verify CSP headers on admin pages
- [ ] Test admin login from mobile/desktop

## Compliance & Regulations

This setup helps with:
- **SOC 2 Type II** - Audit logging, access controls
- **GDPR** - Data access logging, admin accountability
- **PCI DSS** (if handling payments) - Role-based access, MFA
- **HIPAA** (if health data) - Audit trails, access controls

## Monitoring & Alerts

Set up alerts for:
- Failed admin login attempts (>3 in 5 min)
- Admin actions outside business hours
- Multiple admins accessing same account
- Audit log insertion failures
- MFA bypass attempts
- Session timeout overrides

## Questions?

Contact: security@digis.cc
