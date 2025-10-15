# Row Level Security (RLS) Migration Guide

## Overview

This migration addresses **253 critical security issues** detected by Supabase's database linter. These issues fall into two categories:

1. **RLS Disabled in Public (249 tables)**: Tables are publicly accessible without Row Level Security policies, allowing anyone with the Supabase API URL and anon key to potentially read/write data directly, bypassing backend authentication.

2. **Security Definer Views (4 views)**: Views that bypass RLS policies and enforce the view creator's permissions rather than the querying user's permissions.

## Security Impact

### Current Risk Level: **CRITICAL**

Without RLS enabled:
- **Data Exposure**: Anyone with your `SUPABASE_URL` and `SUPABASE_ANON_KEY` can query your database directly
- **Unauthorized Access**: Attackers can bypass your backend API and access sensitive data
- **Data Manipulation**: Without proper policies, users could modify data they shouldn't have access to
- **Privacy Violations**: User data (payments, messages, KYC docs) is exposed

### Example Attack Scenario

```javascript
// Attacker could do this with just your public Supabase credentials:
const { createClient } = require('@supabase/supabase-js')
const supabase = createClient('YOUR_SUPABASE_URL', 'YOUR_ANON_KEY')

// Without RLS, this would return ALL users' payment data
const { data } = await supabase.from('payments').select('*')

// Without RLS, attacker could modify other users' profiles
await supabase.from('users').update({ is_creator: true }).eq('id', 123)
```

## Migration File

**File**: `enable_rls_policies.sql`

This migration will:
1. Enable RLS on all 57 public tables
2. Create appropriate security policies for each table
3. Fix 4 SECURITY DEFINER views to use SECURITY INVOKER
4. Grant necessary permissions to authenticated users

## How to Apply This Migration

### Option 1: Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Navigate to https://supabase.com/dashboard
   - Select your project: `digis-app`

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "+ New query"

3. **Copy & Paste Migration**
   - Open `enable_rls_policies.sql`
   - Copy the entire contents
   - Paste into the SQL Editor

4. **Review Before Running**
   - **IMPORTANT**: Review the policies to ensure they match your business logic
   - Pay special attention to views - update the view definitions with your actual queries

5. **Run the Migration**
   - Click "Run" or press `Cmd/Ctrl + Enter`
   - Watch for any errors in the output panel

6. **Verify Success**
   - Go to "Database" → "Tables" in Supabase Dashboard
   - Click on any table (e.g., `users`)
   - Go to "Policies" tab
   - You should see RLS enabled and policies listed

### Option 2: psql Command Line

```bash
# Connect to your Supabase database
psql "postgresql://postgres:[YOUR-PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres"

# Run the migration
\i /path/to/enable_rls_policies.sql

# Verify RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

### Option 3: Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref [YOUR-PROJECT-REF]

# Run the migration
supabase db push --db-url "postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres" --file enable_rls_policies.sql
```

## Important: Update View Definitions

The migration includes placeholders for 4 views. **You must update these with your actual view queries**:

1. **show_statistics** (line ~925)
2. **ppv_analytics** (line ~935)
3. **subscription_tier_analytics** (line ~945)
4. **offer_statistics** (line ~955)

### How to Find Your Current View Definitions

Run this query in Supabase SQL Editor:

```sql
SELECT
  table_name as view_name,
  view_definition
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name IN ('show_statistics', 'ppv_analytics', 'subscription_tier_analytics', 'offer_statistics');
```

Then replace the placeholder `SELECT *` queries with your actual view definitions.

## Policy Architecture

### Policy Patterns Used

1. **Own Data Access**: Users can only access their own data
   ```sql
   USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()))
   ```

2. **Public Read, Private Write**: Anyone can view, only owners can modify
   ```sql
   -- SELECT policy
   USING (true)

   -- UPDATE/DELETE policy
   USING (creator_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()))
   ```

3. **Creator-Only Features**: Only creators can access certain tables
   ```sql
   USING (creator_id IN (
     SELECT id FROM users
     WHERE supabase_id = auth.uid() AND is_creator = true
   ))
   ```

4. **Subscription-Based Access**: Content visibility based on subscription status
   ```sql
   USING (
     visibility = 'public'
     OR
     creator_id IN (SELECT id FROM users WHERE supabase_id = auth.uid())
     OR
     (visibility = 'subscribers' AND EXISTS (
       SELECT 1 FROM subscriptions s
       WHERE s.creator_id = content_uploads.creator_id
       AND s.subscriber_id IN (SELECT id FROM users WHERE supabase_id = auth.uid())
     ))
   )
   ```

## Testing RLS Policies

### 1. Test as Regular User

```sql
-- Create a test user session
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

-- Try to access data (should only see own data)
SELECT * FROM payments;
SELECT * FROM notifications;
```

### 2. Test as Creator

```sql
-- Test creator-specific access
SELECT * FROM creator_analytics;
SELECT * FROM stream_sessions;
```

### 3. Test Unauthorized Access

```sql
-- Try to update another user's profile (should fail)
UPDATE users
SET is_creator = true
WHERE id = 999;  -- Different user ID
```

## Performance Considerations

RLS policies add WHERE clauses to every query, which can impact performance:

### 1. Add Indexes for Common Policy Checks

```sql
-- Index for user lookups by supabase_id
CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON users(supabase_id);

-- Index for follower/following queries
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);

-- Index for subscription queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber_id ON subscriptions(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_creator_id ON subscriptions(creator_id);

-- Index for content visibility checks
CREATE INDEX IF NOT EXISTS idx_content_uploads_creator_id ON content_uploads(creator_id);
CREATE INDEX IF NOT EXISTS idx_content_uploads_visibility ON content_uploads(visibility);
```

### 2. Monitor Query Performance

```sql
-- Enable query timing
\timing

-- Check slow queries
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE query LIKE '%FROM public.%'
ORDER BY mean_time DESC
LIMIT 20;
```

## Rollback Plan

If you need to rollback this migration:

```sql
-- Disable RLS on all tables (NOT RECOMMENDED - SECURITY RISK)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
  LOOP
    EXECUTE 'ALTER TABLE public.' || r.tablename || ' DISABLE ROW LEVEL SECURITY';
  END LOOP;
END$$;

-- Drop all policies
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  )
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.' || r.tablename;
  END LOOP;
END$$;
```

**WARNING**: Only use rollback in emergency situations. Disabling RLS exposes your database to security vulnerabilities.

## Verification Checklist

After applying the migration, verify:

- [ ] All 57 tables have RLS enabled
- [ ] Each table has appropriate policies
- [ ] Views are using SECURITY INVOKER
- [ ] Test user can access only their own data
- [ ] Test creator can access creator-specific features
- [ ] Public data is still accessible to all
- [ ] Backend API still functions correctly
- [ ] No unauthorized access is possible

## Common Issues & Troubleshooting

### Issue 1: "new row violates row-level security policy"

**Cause**: INSERT policy is too restrictive

**Fix**: Check the `WITH CHECK` condition in INSERT policies

### Issue 2: Queries return empty results after migration

**Cause**: Policy is filtering out data the user should see

**Fix**: Review SELECT policies and adjust USING clauses

### Issue 3: Backend API requests failing with 403

**Cause**: Backend is using anon key instead of service role key

**Fix**: Use `SUPABASE_SERVICE_ROLE_KEY` for backend requests that bypass RLS:

```javascript
// In your backend
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // This bypasses RLS
)
```

### Issue 4: Performance degradation

**Cause**: Missing indexes for policy checks

**Fix**: Add indexes as shown in "Performance Considerations" section

## Next Steps After Migration

1. **Update Backend Code**
   - Review all Supabase queries in your backend
   - Ensure service role key is used for admin operations
   - Update queries that expect different permission levels

2. **Update Frontend Code**
   - Test all user flows (login, profile update, content access)
   - Verify creator features work correctly
   - Test subscription-based content access

3. **Monitor Logs**
   - Watch for RLS policy violations in Supabase logs
   - Check application logs for unexpected errors
   - Monitor query performance

4. **Security Audit**
   - Review all policies for correctness
   - Test edge cases and boundary conditions
   - Consider adding additional policies for specific use cases

## Additional Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase Auth Helpers](https://supabase.com/docs/guides/auth/auth-helpers)

## Support

If you encounter issues:
1. Check Supabase Dashboard → Logs for detailed error messages
2. Review RLS policies in Dashboard → Database → Policies
3. Test policies using SQL Editor with different `auth.uid()` values
4. Check your backend authentication token handling

---

**Created**: 2025-10-15
**Migration File**: `enable_rls_policies.sql`
**Tables Affected**: 57 tables
**Views Affected**: 4 views
**Security Issues Resolved**: 253
