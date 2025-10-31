#!/bin/bash

# Script to remove all Firebase references and migrate to Supabase UUID only
# This script should be run once on production database

set -e  # Exit on error

echo "🔥 Starting Firebase Removal Migration..."
echo "========================================"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo "Please set it with: export DATABASE_URL='your_connection_string'"
    exit 1
fi

# Confirm before proceeding
echo ""
echo "⚠️  WARNING: This migration will:"
echo "   1. Remove all firebase_uid references"
echo "   2. Migrate all data to use supabase_id (UUID)"
echo "   3. Drop firebase_uid column from users table"
echo ""
read -p "Do you want to proceed? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Migration cancelled"
    exit 0
fi

echo ""
echo "📋 Step 1: Backing up current schema..."
echo "--------------------------------------"

# Create backup
BACKUP_FILE="backup_before_firebase_removal_$(date +%Y%m%d_%H%M%S).sql"
echo "Creating backup: $BACKUP_FILE"

# Note: This requires psql to be installed
if command -v psql &> /dev/null; then
    psql "$DATABASE_URL" -c "\dt" > "$BACKUP_FILE.tables.txt" 2>&1 || echo "Could not create table backup"
    echo "✅ Schema backup saved"
else
    echo "⚠️  psql not found - skipping backup (not critical)"
fi

echo ""
echo "🔄 Step 2: Running Firebase Removal Migration..."
echo "--------------------------------------"

# Run the migration
if command -v psql &> /dev/null; then
    psql "$DATABASE_URL" -f migrations/999_complete_firebase_removal.sql
    echo "✅ Migration completed successfully"
else
    echo "❌ ERROR: psql command not found"
    echo "Please install PostgreSQL client tools"
    exit 1
fi

echo ""
echo "🔍 Step 3: Verifying migration..."
echo "--------------------------------------"

# Check for remaining firebase columns
FIREBASE_COLUMNS=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE column_name LIKE '%firebase%'
")

if [ "$FIREBASE_COLUMNS" -eq "0" ]; then
    echo "✅ No Firebase columns remaining"
else
    echo "⚠️  Found $FIREBASE_COLUMNS Firebase-related columns"
    echo "Listing them:"
    psql "$DATABASE_URL" -c "
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE column_name LIKE '%firebase%'
    "
fi

echo ""
echo "✅ Migration Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Test your application thoroughly"
echo "2. Monitor for any errors in production"
echo "3. If issues occur, you may need to restore from backup"
echo ""
