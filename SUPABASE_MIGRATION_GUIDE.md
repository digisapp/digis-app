# Supabase Migration Guide

## Overview

This guide walks you through the complete migration from Firebase to Supabase for the Digis platform. The migration has been designed to be safe, reversible, and maintain data integrity throughout the process.

## Migration Files

1. **099_pre_migration_validation.sql** - Pre-flight checks
2. **100_complete_supabase_migration.sql** - Main migration script
3. **101_complete_rls_policies.sql** - Comprehensive RLS policies
4. **102_add_partitioning_and_fix_fkeys.sql** - Performance optimizations
5. **103_rollback_supabase_migration.sql** - Emergency rollback

## Pre-Migration Steps

### 1. Backup Your Database

```bash
# Create a complete backup
pg_dump -h your-database-host -U your-username -d your-database > backup_$(date +%Y%m%d_%H%M%S).sql

# For Supabase hosted databases
supabase db dump -f backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Run Validation Script

```bash
cd backend
psql -h your-database-host -U your-username -d your-database -f migrations/099_pre_migration_validation.sql
```

Review the output:
- **FAIL** - Must be fixed before proceeding
- **WARNING** - Should be reviewed, may proceed with caution
- **PASS** - No issues found
- **INFO** - Informational only

### 3. Clean Up Old Migrations

Remove or archive these deprecated migration files:
- `003_create_classes_tables.sql` (superseded by 005)
- `004_create_call_requests.sql` (superseded by 005)
- Any Firebase-specific migration files

## Migration Execution

### 1. Stop Application Services

```bash
# Stop all backend services
pm2 stop all
# or
systemctl stop digis-backend
```

### 2. Execute Main Migration

```bash
# Run the main migration
psql -h your-database-host -U your-username -d your-database -f migrations/100_complete_supabase_migration.sql

# Check for errors
echo $?  # Should return 0
```

### 3. Apply RLS Policies

```bash
# Apply comprehensive RLS policies
psql -h your-database-host -U your-username -d your-database -f migrations/101_complete_rls_policies.sql
```

### 4. Add Performance Optimizations

```bash
# Add partitioning and fix remaining foreign keys
psql -h your-database-host -U your-username -d your-database -f migrations/102_add_partitioning_and_fix_fkeys.sql
```

### 5. Verify Migration

Run these checks:

```sql
-- Check for any remaining Firebase references
SELECT table_name, column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND column_name LIKE '%firebase%';

-- Verify all tables have RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = false;

-- Check foreign key integrity
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
WHERE constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
AND ccu.column_name != 'supabase_id';
```

## Post-Migration Steps

### 1. Update Environment Variables

Remove all Firebase-related environment variables and ensure these Supabase variables are set:

```bash
# Backend .env
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=your-postgres-connection-string

# Frontend .env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Update Application Code

The migration assumes your application code has been updated to:
- Use `supabase_id` instead of `firebase_uid`
- Use Supabase Auth instead of Firebase Auth
- Handle RLS policies in queries

### 3. Test Critical Paths

Test these critical user flows:
1. User registration and login
2. Token purchases and balance updates
3. Video/voice calls
4. Creator payouts
5. Content uploads and streaming

### 4. Monitor Performance

Monitor these metrics post-migration:
- Query performance on partitioned tables
- RLS policy impact on query times
- Connection pool usage
- Database size growth

## Rollback Procedure

If you need to rollback:

### 1. Stop All Services

```bash
pm2 stop all
```

### 2. Execute Rollback

```bash
psql -h your-database-host -U your-username -d your-database -f migrations/103_rollback_supabase_migration.sql
```

### 3. Restore From Backup (if needed)

```bash
psql -h your-database-host -U your-username -d your-database < backup_YYYYMMDD_HHMMSS.sql
```

### 4. Revert Code Changes

Revert your application code to use Firebase authentication.

## Troubleshooting

### Common Issues

1. **Foreign key violations**
   - Check for orphaned records before migration
   - Use CASCADE options carefully

2. **RLS policy blocking queries**
   - Verify auth.uid() is set correctly
   - Check service role key for admin operations

3. **Performance degradation**
   - Analyze slow queries with EXPLAIN
   - Ensure indexes are present
   - Check partition pruning is working

### Debug Queries

```sql
-- Check active RLS policies
SELECT * FROM pg_policies WHERE schemaname = 'public';

-- View partition information
SELECT 
    parent.relname AS parent_table,
    child.relname AS partition_name,
    pg_get_expr(child.relpartbound, child.oid) AS partition_range
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
WHERE parent.relnamespace = 'public'::regnamespace;

-- Check for lock contention
SELECT * FROM pg_locks WHERE NOT granted;
```

## Migration Checklist

- [ ] Database backed up
- [ ] Validation script run and issues resolved
- [ ] Application services stopped
- [ ] Main migration executed successfully
- [ ] RLS policies applied
- [ ] Performance optimizations added
- [ ] Foreign key integrity verified
- [ ] No Firebase references remaining
- [ ] Application code updated
- [ ] Environment variables updated
- [ ] Critical paths tested
- [ ] Performance monitored
- [ ] Rollback plan ready

## Support

For issues during migration:
1. Check error logs in `/backend/logs/`
2. Review Supabase dashboard for database metrics
3. Use the rollback script if needed
4. Restore from backup as last resort

Remember: Always test on a staging environment first!