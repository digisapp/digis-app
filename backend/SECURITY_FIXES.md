# Security Warnings - Fixes and Remediation Guide

This document addresses all security warnings from Supabase Database Linter.

## Summary

| Issue | Severity | Status | Fix Type |
|-------|----------|--------|----------|
| Function Search Path Mutable | WARN | ✅ Fixed | Code (Migration) |
| Leaked Password Protection | WARN | ⚠️ Action Required | Dashboard Setting |
| Insufficient MFA Options | WARN | ⚠️ Action Required | Dashboard Setting |
| Vulnerable Postgres Version | WARN | ⚠️ Action Required | Platform Upgrade |

---

## ✅ 1. Function Search Path Mutable (FIXED)

### Issue
Functions `cached_auth_uid()` and `get_current_user_db_id()` were vulnerable to search_path injection attacks.

### Security Impact
**CRITICAL**: SECURITY DEFINER functions without `SET search_path` can be hijacked by attackers who create malicious functions in custom schemas.

### Fix Applied
Created migration `015_fix_function_search_path_security.sql` that adds `SET search_path = public` to both functions.

### How to Apply

```bash
cd backend

# Run the migration
./migrations/015_test_migration.sh

# Or manually:
psql "$DATABASE_URL" -f migrations/015_fix_function_search_path_security.sql
```

### Verification

After running migration, verify the fix:

```sql
SELECT
  proname as function_name,
  prosecdef as is_security_definer,
  proconfig as configuration
FROM pg_proc
WHERE proname IN ('cached_auth_uid', 'get_current_user_db_id')
  AND pronamespace = 'public'::regnamespace;
```

Expected output:
```
function_name            | is_security_definer | configuration
-------------------------|---------------------|-------------------
cached_auth_uid          | t                   | {search_path=public}
get_current_user_db_id   | t                   | {search_path=public}
```

---

## ⚠️ 2. Leaked Password Protection (ACTION REQUIRED)

### Issue
HaveIBeenPwned password leak detection is currently disabled.

### Security Impact
**MEDIUM**: Users can set passwords that have been compromised in data breaches, making their accounts vulnerable to credential stuffing attacks.

### How to Fix

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Settings**
3. Scroll to **Password Security**
4. Enable **"Check passwords against HaveIBeenPwned"**
5. Click **Save**

### What This Does
- Prevents users from using passwords that appear in known data breaches
- Checks passwords against the HaveIBeenPwned database during signup/password reset
- Provides immediate feedback to users if their password is compromised

### Reference
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

---

## ⚠️ 3. Insufficient MFA Options (ACTION REQUIRED)

### Issue
Too few Multi-Factor Authentication (MFA) options are enabled.

### Security Impact
**MEDIUM**: Accounts are more vulnerable to compromise without strong MFA options.

### How to Fix

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Settings** → **Multi-Factor Authentication**
3. Enable at least 2 of the following MFA methods:
   - ✅ **Time-based One-Time Password (TOTP)** - Recommended (Google Authenticator, Authy)
   - ✅ **SMS** (if phone provider configured)
   - ✅ **Email** (if SMTP configured)

4. Click **Save**

### Recommended Setup

**Minimum (addresses warning):**
- Enable TOTP (no extra setup required)
- Enable Email MFA (already configured with Supabase)

**Ideal (production):**
- Enable TOTP for security
- Enable Email as backup method
- Enable SMS if budget allows (requires Twilio setup)

### Reference
https://supabase.com/docs/guides/auth/auth-mfa

---

## ⚠️ 4. Vulnerable Postgres Version (ACTION REQUIRED)

### Issue
Current Postgres version `supabase-postgres-17.4.1.054` has security patches available.

### Security Impact
**HIGH**: Missing security patches can leave database vulnerable to known exploits.

### How to Fix

1. Go to your Supabase Dashboard
2. Navigate to **Settings** → **General**
3. Scroll to **Database Version**
4. Click **"Check for updates"**
5. Review the release notes
6. Click **"Upgrade Database"**

### Important Notes

⚠️ **BACKUP FIRST**: Create a database backup before upgrading

```bash
# Create backup via Supabase CLI
supabase db dump -f backup-before-upgrade.sql

# Or use pg_dump directly
pg_dump "$DATABASE_URL" > backup-before-upgrade.sql
```

⚠️ **Downtime**: The upgrade process may cause brief downtime (typically 1-5 minutes)

⚠️ **Test First**: If possible, test the upgrade in a staging environment

### Reference
https://supabase.com/docs/guides/platform/upgrading

---

## Priority Order

Fix these issues in this order:

1. **Function Search Path** (✅ Already fixed) - Apply migration immediately
2. **Postgres Version** - Schedule upgrade during low-traffic period
3. **Leaked Password Protection** - Enable in dashboard (1 minute)
4. **MFA Options** - Enable in dashboard (5 minutes)

---

## Verification Checklist

After applying all fixes:

- [ ] Migration 015 applied successfully
- [ ] Both functions show `search_path=public` in verification query
- [ ] HaveIBeenPwned protection enabled in Supabase Dashboard
- [ ] At least 2 MFA methods enabled
- [ ] Postgres upgraded to latest version
- [ ] Supabase Database Linter shows 0 warnings for these issues
- [ ] Application tested and working correctly

---

## Testing After Fixes

### Test Function Security
```bash
# Test that functions still work correctly
psql "$DATABASE_URL" -c "SELECT cached_auth_uid();"
psql "$DATABASE_URL" -c "SELECT get_current_user_db_id();"
```

### Test Password Protection
1. Sign up with a known leaked password (e.g., "password123")
2. Should receive error: "This password has been found in a data breach"

### Test MFA
1. Sign in to your app
2. Go to account settings
3. Enable MFA
4. Verify you can authenticate with chosen MFA method

---

## Questions?

If you encounter issues:

1. Check backend logs: `cd backend && npm run logs`
2. Check Supabase Dashboard → Database → Logs
3. Re-run Supabase Database Linter to verify fixes
4. Test with a non-production account first

---

## Additional Security Best Practices

Beyond these warnings, consider:

- [ ] Enable RLS on all public tables
- [ ] Review and audit all database policies
- [ ] Set up database connection pooling (PgBouncer)
- [ ] Enable Supabase Audit Logs
- [ ] Set up automated database backups
- [ ] Review Supabase security checklist: https://supabase.com/docs/guides/database/managing-passwords

---

**Last Updated**: 2025-10-18
**Migration Version**: 015
