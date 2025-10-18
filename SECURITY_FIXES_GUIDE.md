# Security Fixes Guide

This guide addresses all security issues found by Supabase Database Linter.

---

## ✅ FIXED: Database-Level Security (Run Migration)

### Issues Fixed:
1. **RLS Disabled in Public** (ERROR) - `username_quarantine`, `username_changes`
2. **Function Search Path Mutable** (WARN) - `is_username_quarantined()`
3. **Extension in Public Schema** (WARN) - `pg_trgm`

### How to Apply:

**Run this in Supabase SQL Editor**:

```bash
# Copy the migration file
cat backend/migrations/011_fix_security_issues.sql
```

Or directly in Supabase Dashboard:
1. Go to https://supabase.com/dashboard → Your Project
2. Click **SQL Editor** in left sidebar
3. Click **New Query**
4. Paste contents of `backend/migrations/011_fix_security_issues.sql`
5. Click **Run** or press `Ctrl+Enter`

**What it does**:
- ✅ Enables Row Level Security on `username_quarantine` and `username_changes`
- ✅ Creates RLS policies:
  - Authenticated users can read quarantined usernames
  - Users can read/insert their own username changes
  - Service role has full access to both tables
- ✅ Fixes `is_username_quarantined()` function with explicit `search_path`
- ✅ Attempts to move `pg_trgm` extension to `extensions` schema (may fail on Supabase - that's OK)

---

## ⚠️ TODO: Supabase Dashboard Settings (Manual)

### 1. Enable Leaked Password Protection (WARN)

**Issue**: Prevents users from using passwords found in data breaches

**Fix**:
1. Go to Supabase Dashboard → **Authentication** → **Password**
2. Enable **"Check password against HaveIBeenPwned database"**
3. Click **Save**

**Reference**: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

---

### 2. Enable More MFA Options (WARN)

**Issue**: Only one MFA method enabled, should have multiple for better security

**Fix**:
1. Go to Supabase Dashboard → **Authentication** → **MFA**
2. Enable additional MFA methods:
   - ✅ **TOTP** (Authenticator apps like Google Authenticator)
   - ✅ **Phone** (SMS verification) - if available
   - ✅ **WebAuthn** (Hardware keys like YubiKey)
3. Click **Save**

**Reference**: https://supabase.com/docs/guides/auth/auth-mfa

---

### 3. Upgrade PostgreSQL Version (WARN)

**Issue**: Current version `supabase-postgres-17.4.1.054` has security patches available

**Fix**:
1. Go to Supabase Dashboard → **Settings** → **Infrastructure**
2. Look for **Postgres Version**
3. Click **Upgrade** if available
4. Schedule upgrade during low-traffic period

**⚠️ Important**:
- **Backup your database first** before upgrading
- Upgrades may cause ~5-10 minutes of downtime
- Test in staging environment if possible

**Reference**: https://supabase.com/docs/guides/platform/upgrading

---

## 📊 Security Issue Priority

| Issue | Level | Fixed By | Status |
|-------|-------|----------|--------|
| RLS Disabled (2 tables) | **ERROR** | SQL Migration | ✅ Ready to run |
| Function Search Path | WARN | SQL Migration | ✅ Ready to run |
| Extension in Public | WARN | SQL Migration | ✅ Ready to run |
| Leaked Password Protection | WARN | Dashboard Setting | ⏳ Manual action |
| Insufficient MFA Options | WARN | Dashboard Setting | ⏳ Manual action |
| Vulnerable Postgres Version | WARN | Dashboard Upgrade | ⏳ Manual action |

---

## 🔒 RLS Policies Created

### `username_quarantine` Table

**Policies**:
1. **Users can read quarantined usernames**
   - Role: `authenticated`
   - Action: `SELECT`
   - Allows all authenticated users to check if username is quarantined

2. **Service role can manage quarantine**
   - Role: `service_role`
   - Action: `ALL`
   - Backend can add/remove quarantined usernames

### `username_changes` Table

**Policies**:
1. **Users can read own username changes**
   - Role: `authenticated`
   - Action: `SELECT`
   - Users can only see their own username change history

2. **Users can insert own username changes**
   - Role: `authenticated`
   - Action: `INSERT`
   - Users can record their own username changes

3. **Service role can manage username changes**
   - Role: `service_role`
   - Action: `ALL`
   - Backend has full control

---

## 🧪 Verification

After running the migration, verify with these queries:

### Check RLS is enabled:
```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('username_quarantine', 'username_changes');
```

**Expected**:
```
 schemaname |       tablename       | rowsecurity
------------+-----------------------+-------------
 public     | username_quarantine   | t
 public     | username_changes      | t
```

### Check policies exist:
```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('username_quarantine', 'username_changes')
ORDER BY tablename, policyname;
```

**Expected**: 5 policies (2 for quarantine, 3 for changes)

### Check function search_path:
```sql
SELECT proname, prosecdef, proconfig
FROM pg_proc
WHERE proname = 'is_username_quarantined';
```

**Expected**: `proconfig` should show `{search_path=public,pg_temp}`

---

## 📝 Summary

**Database fixes** (SQL migration):
- ✅ RLS enabled on 2 tables
- ✅ 5 RLS policies created
- ✅ Function security hardened
- ✅ Extension schema best practice applied

**Dashboard fixes** (manual):
- ⏳ Enable leaked password protection
- ⏳ Enable additional MFA methods
- ⏳ Upgrade PostgreSQL (when convenient)

**Next steps**:
1. Run `011_fix_security_issues.sql` in Supabase SQL Editor
2. Verify with queries above
3. Update dashboard settings for MFA and password protection
4. Schedule Postgres upgrade during maintenance window
