# Database Migration Cleanup Plan

## Current State Analysis

**Total SQL Files:** 108
- ✅ **Organized migrations:** 93 files in `./migrations/` (001-400 series)
- ⚠️ **Ad-hoc files:** 15 files scattered in root/backend

### Properly Numbered Migrations (Keep These)
```
./migrations/001_initial_schema.sql
./migrations/003-147_*.sql (Feature migrations)
./migrations/200-202_*.sql (Identity fixes)
./migrations/300-302_*.sql (Cents migration)
./migrations/400_*.sql (Ledger system)
```

### Ad-Hoc Files (Need Cleanup)

**Root Directory:**
1. `ADD_STREAM_PRICE.sql` - Adds stream_price column
2. `CHECK_DATABASE_STRUCTURE.sql` - Diagnostic query
3. `CREATE_CREATOR_APPLICATIONS_TABLE.sql` - Duplicate of migration
4. `FIX_ALL_DATABASE_ISSUES.sql` - Emergency fix (v1)
5. `FIX_ALL_DATABASE_ISSUES_V2.sql` - Emergency fix (v2)
6. `FIX_ALL_DATABASE_ISSUES_V3.sql` - Emergency fix (v3)
7. `FIX_ALL_DATABASE_ISSUES_V4.sql` - Emergency fix (v4)
8. `FIX_DATABASE_ERRORS.sql` - Another emergency fix
9. `FIX_DATABASE_FINAL.sql` - "Final" emergency fix
10. `check-miriam-role.sql` - Debug query
11. `create-admin-tables.sql` - Duplicate of migration 131
12. `create_session_ratings.sql` - Session ratings table
13. `fix-missing-columns.sql` - Column fixes
14. `fix-supabase-id.sql` - Supabase ID fix
15. `test-data.sql` - Test data insertion

**Backend Directory:**
- Various test and diagnostic files

### Migration Issues Found

**Duplicate Numbers:**
- `004_create_call_requests.sql` AND `004_supabase_auth_migration.sql`
- `005_call_requests.sql` AND `005_create_classes_tables.sql` AND `005_creator_applications.sql`
- `006_enhanced_call_features.sql` AND `006_supabase_functions.sql`
- `007_add_location_fields.sql` AND `007_remove_firebase_columns.sql`
- `008_add_tv_subscriptions.sql` AND `008_create_recordings_table.sql`
- `131_add_creator_card_image.sql` AND `131_create_admin_audit_tables.sql`
- `200_create_analytics_buckets.sql` AND `200_fix_identity_mismatch.sql`

## Cleanup Strategy

### Phase 1: Archive Ad-Hoc Files ✅
Move all ad-hoc SQL files to `./migrations/archive/` folder:
```bash
mkdir -p migrations/archive/emergency-fixes
mkdir -p migrations/archive/diagnostics
```

**Emergency Fixes → archive/emergency-fixes/**
- FIX_ALL_DATABASE_ISSUES*.sql
- FIX_DATABASE_*.sql
- fix-*.sql

**Diagnostic Queries → archive/diagnostics/**
- CHECK_DATABASE_STRUCTURE.sql
- check-miriam-role.sql
- test-data.sql

### Phase 2: Renumber Duplicates ✅
Resolve duplicate migration numbers:

```
004a_create_call_requests.sql
004b_supabase_auth_migration.sql
005a_call_requests.sql
005b_create_classes_tables.sql
005c_creator_applications.sql
... etc
```

### Phase 3: Create Migration Index ✅
Create `migrations/README.md` with:
- Complete migration order
- Description of each migration
- Dependencies between migrations
- How to run migrations

### Phase 4: Add Migration Validation Script ✅
Create `migrations/validate.js`:
- Check for duplicate numbers
- Verify all migrations are idempotent
- Check for missing dependencies

## Recommended File Structure

```
migrations/
├── README.md                          # Migration documentation
├── validate.js                        # Validation script
├── 001_initial_schema.sql
├── 002-147_feature_migrations.sql    # Main features
├── 200-202_identity_fixes.sql        # Critical fixes
├── 300-302_cents_migration.sql       # Financial migration
├── 400_ledger_system.sql             # Double-entry ledger
├── archive/
│   ├── emergency-fixes/              # Old FIX_*.sql files
│   ├── diagnostics/                  # CHECK_*.sql queries
│   └── duplicates/                   # Duplicate migrations
└── scripts/
    └── post-migration-verification.sql

backend/
└── utils/
    └── migrate.js                     # Migration runner
```

## Implementation Plan

### Step 1: Create Archive Structure
```bash
mkdir -p migrations/archive/emergency-fixes
mkdir -p migrations/archive/diagnostics
mkdir -p migrations/archive/duplicates
```

### Step 2: Move Ad-Hoc Files
```bash
# Emergency fixes
mv *FIX*.sql migrations/archive/emergency-fixes/
mv fix-*.sql migrations/archive/emergency-fixes/

# Diagnostics
mv CHECK_*.sql migrations/archive/diagnostics/
mv check-*.sql migrations/archive/diagnostics/
mv test-data.sql migrations/archive/diagnostics/
```

### Step 3: Rename Duplicates
Rename files with duplicate numbers to avoid conflicts

### Step 4: Create Documentation
Create `migrations/README.md` with complete migration guide

### Step 5: Add Validation
Create validation script to prevent future issues

## Benefits

✅ **Clear deployment process** - Know exactly what to run
✅ **Rollback capability** - Each migration documented
✅ **No conflicts** - All numbers unique
✅ **Production-ready** - CI can validate migrations
✅ **Team clarity** - Everyone knows the migration state
✅ **Historical record** - Archive preserves old fixes

## Safety Notes

⚠️ **Do NOT delete any SQL files** - Move to archive instead
⚠️ **All migrations are already applied to your DB** - This is just organization
⚠️ **CI will validate** - Automated checks prevent issues
⚠️ **Document everything** - Each migration explained in README

## Next Steps

1. ✅ Create archive directories
2. ✅ Move ad-hoc files to archive
3. ✅ Rename duplicate numbers
4. ✅ Create migration index (README.md)
5. ✅ Add validation script
6. ✅ Update .gitignore if needed
7. ✅ Commit changes with clear message
8. ✅ Update deployment docs

**Time Estimate:** 1-2 hours
**Risk Level:** Low (just organizing, not changing DB)
