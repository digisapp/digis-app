# 🚀 Admin Security - Quick Start (5 Commands)

## TL;DR - Run These Commands

```bash
# 1. Setup (installs deps, generates secrets, adds to .env)
cd /Users/examodels/Desktop/digis-app/backend
./setup-admin-security.sh

# 2. Set admin role in Supabase
# Go to: https://supabase.com/dashboard
# Authentication → Users → Your User → Edit
# app_metadata: { "role": "admin", "is_staff": true }

# 3. Update admin routes (see FINISH_LINE_PLAN.md section 2)
# Add security middleware chain to backend/routes/admin.js

# 4. Create robots.txt
cat > ../frontend/public/robots.txt << 'EOF'
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
EOF

# 5. Test & Deploy
npm run dev  # Test locally
vercel --prod  # Deploy
```

---

## Files to Reference

| File | Purpose |
|------|---------|
| `/FINISH_LINE_PLAN.md` | **START HERE** - Complete 10-min guide |
| `/IMPLEMENTATION_CHECKLIST.md` | Detailed step-by-step checklist |
| `/ADMIN_SECURITY_SUMMARY.md` | Quick reference of all features |
| `/backend/routes/admin-secure.js` | Complete example with all security |

---

## Security Middleware Chain (Copy-Paste)

Add to `backend/routes/admin.js`:

```javascript
// Import middlewares
const { adminHeaders } = require('../middleware/adminHeaders');
const { requireMFA } = require('../middleware/requireMFA');
const { adminSessionFreshness } = require('../middleware/adminSessionFreshness');
const { adminRateLimiter, sensitiveActionLimiter } = require('../middleware/adminRateLimit');
const { ipAllowlist } = require('../middleware/ipAllowlist');
const { auditLog } = require('../middleware/adminAudit');
const { requireStepUp } = require('../middleware/stepUpReauth');

// Check admin role
const requireAdmin = (req, res, next) => {
  if (req.user?.app_metadata?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Apply to all routes
router.use(
  authenticateToken,
  requireAdmin,
  requireMFA,
  adminSessionFreshness,
  adminRateLimiter,
  ipAllowlist,
  adminHeaders
);

// Example route with audit logging
router.get('/users',
  auditLog('ADMIN_VIEW_USERS'),
  async (req, res) => { /* ... */ }
);

// Example sensitive route with step-up
router.put('/users/:id/role',
  sensitiveActionLimiter,
  requireStepUp({ maxAgeSeconds: 300 }),
  auditLog('ADMIN_UPDATE_USER_ROLE'),
  async (req, res) => { /* ... */ }
);
```

---

## Environment Variables (Already Added by Setup Script)

```bash
ADMIN_SECURITY_ENFORCED=true
ADMIN_SESSION_MINUTES=30
ADMIN_RATE_LIMIT_WINDOW_MS=60000
ADMIN_RATE_LIMIT_MAX=60
STEP_UP_SECRET=<generated-secret>
BREAK_GLASS_CODE=<generated-code>
ADMIN_ALLOWED_IPS=  # Optional
```

**⚠️ IMPORTANT:** Add these to Vercel Dashboard too!

---

## Smoke Tests

```bash
# Test 1: Admin health check (should work)
curl http://localhost:3001/api/admin/health \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
# Expected: 200 OK

# Test 2: Non-admin blocked (should fail)
curl http://localhost:3001/api/admin/health \
  -H "Authorization: Bearer NON_ADMIN_TOKEN"
# Expected: 403 Forbidden

# Test 3: Audit logging
psql $DATABASE_URL -c "SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 1;"
# Expected: See your request logged
```

---

## Emergency Bypass

If something breaks and locks you out:

```bash
# Set in Vercel (temporarily)
ADMIN_SECURITY_ENFORCED=false

# This bypasses MFA + session checks but STILL LOGS the bypass
```

---

## Future: Migrate to Subdomain

When ready (6-12 months):

```bash
# 1. Add DNS
admin.digis.cc  CNAME  cname.vercel-dns.com

# 2. Create new Vercel project for admin
# 3. Point admin.digis.cc to new project
# 4. Backend stays the same!
```

---

## 📞 Help

- **Full guide:** `/FINISH_LINE_PLAN.md`
- **Examples:** `/backend/routes/admin-secure.js`
- **Security docs:** `/backend/docs/ADMIN_SECURITY_2025.md`

---

## ✅ Done!

Your admin portal now has:
- ✅ MFA enforcement
- ✅ 30-min session timeout
- ✅ Rate limiting (60 req/min)
- ✅ Step-up re-auth for sensitive actions
- ✅ Automatic audit logging
- ✅ Immutable audit logs
- ✅ Admin security headers
- ✅ Emergency bypass (with logging)

**Deploy:** `vercel --prod` 🚀
