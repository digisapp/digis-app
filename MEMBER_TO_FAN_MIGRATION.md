# Member ID to Fan ID Migration Guide

## Summary

This guide documents the complete migration from `member_id` to `fan_id` throughout the DIGIS application for consistency and clarity.

## Changes Made

### 1. Database Migration ✅
- Created migration file: `023_rename_member_id_to_fan_id.sql`
- Renames the column in the sessions table
- Updates all related indexes
- Safe to run multiple times (idempotent)

### 2. Schema Files Updated ✅
- `supabase-complete-schema-update-fixed.sql` - Now uses `fan_id`
- `001_initial_schema.sql` - Updated to use `fan_id`

### 3. Backend Files Updated ✅
All JavaScript files in the backend now use `fan_id` instead of `member_id`:
- `/routes/payments.js`
- `/routes/users.js`
- `/routes/creators.js`
- `/routes/admin.js`
- `/routes/auth.js`
- `/routes/analytics.js`
- `/utils/db.js`
- `/utils/db-with-cache.js`
- All test files

### 4. Frontend Files ✅
No frontend files were using `member_id`, so no changes needed.

## Migration Steps

### For New Installations:
1. Use `supabase-complete-schema-update-fixed.sql` directly
2. All tables will be created with `fan_id`

### For Existing Installations:
1. Run the migration in your Supabase SQL editor:
   ```sql
   -- Run the migration
   ALTER TABLE public.sessions RENAME COLUMN member_id TO fan_id;
   DROP INDEX IF EXISTS idx_sessions_member_id;
   CREATE INDEX IF NOT EXISTS idx_sessions_fan_id ON public.sessions(fan_id);
   ```

2. Deploy the updated backend code
3. No frontend changes needed

## Rollback Plan

If you need to rollback:
```sql
-- Rollback the change
ALTER TABLE public.sessions RENAME COLUMN fan_id TO member_id;
DROP INDEX IF EXISTS idx_sessions_fan_id;
CREATE INDEX IF NOT EXISTS idx_sessions_member_id ON public.sessions(member_id);
```

Then revert the code changes.

## Benefits

1. **Clarity**: `fan_id` clearly indicates the user joining a creator's session
2. **Consistency**: Matches the business terminology (fans and creators)
3. **Future-proof**: Avoids confusion with membership features

## Testing

After migration, test:
1. Creating new sessions
2. Viewing session history
3. Payment processing
4. Analytics queries
5. Admin functions

All queries have been updated to use `fan_id` so functionality remains the same.